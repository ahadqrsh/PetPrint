const mongoose = require("mongoose");
const VaccineType = require("../models/VaccineType");
const VaccinationRecord = require("../models/VaccinationRecord");
const Pet = require("../models/Pet");
const User = require("../models/User");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, scopedFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const { buildPetSchedule, computeNextDue, dueStatus } = require("../services/vaccineEngine");
const { loadPet } = require("./petController");

/**
 * The catalogue a clinic can use: global entries (clinicId null) plus its own.
 * A clinic's own entry with the same name and species overrides the global one,
 * so a practice can adjust a schedule without affecting anyone else.
 */
async function catalogueFor(user) {
  const types = await VaccineType.find({
    $or: [{ clinicId: null }, { clinicId: user.clinicId }]
  }).lean();

  const byKey = new Map();
  for (const type of types) {
    const key = `${type.species}:${type.name.toLowerCase()}`;
    const existing = byKey.get(key);
    // A clinic-specific entry always beats the global one.
    if (!existing || (type.clinicId && !existing.clinicId)) byKey.set(key, type);
  }
  return [...byKey.values()];
}

/** Recomputes and stores nextDueDate on a pet's most recent dose of a vaccine. */
async function refreshNextDue({ pet, vaccineType, clinicId }) {
  const doses = await VaccinationRecord.find({
    petId: pet._id,
    vaccineTypeId: vaccineType._id
  }).lean();

  const next = computeNextDue({ vaccineType, doses, dateOfBirth: pet.dateOfBirth });

  // Only the latest dose carries the due date, so "what's due" is one query
  // and old rows don't produce duplicate reminders.
  const latest = doses.sort((a, b) => new Date(b.dateGiven) - new Date(a.dateGiven))[0];
  if (latest) {
    await VaccinationRecord.updateOne(
      { _id: latest._id },
      { $set: { nextDueDate: next.dueDate } }
    );
    await VaccinationRecord.updateMany(
      { petId: pet._id, vaccineTypeId: vaccineType._id, _id: { $ne: latest._id } },
      { $set: { nextDueDate: null } }
    );
  }
  return next;
}

// GET /api/vaccines — the catalogue for this clinic
async function listVaccineTypes(req, res, next) {
  try {
    const types = await catalogueFor(req.user);
    const { species } = req.query;

    res.json({
      vaccineTypes: types
        .filter((t) => (species === "cat" || species === "dog" ? t.species === species : true))
        .sort((a, b) => Number(b.isCore) - Number(a.isCore) || a.name.localeCompare(b.name))
        .map((t) => ({
          id: t._id,
          name: t.name,
          species: t.species,
          isCore: t.isCore,
          doseSchedule: t.doseSchedule,
          boosterIntervalDays: t.boosterIntervalDays,
          notes: t.notes,
          isClinicSpecific: Boolean(t.clinicId)
        }))
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/:id/vaccinations — the pet's full schedule
async function getPetVaccinations(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);

    const [types, records] = await Promise.all([
      catalogueFor(req.user),
      VaccinationRecord.find({ petId: pet._id, clinicId: req.user.clinicId }).lean()
    ]);

    const vets = await User.find(
      { _id: { $in: records.map((r) => r.givenByVetId) } },
      "name"
    ).lean();
    const vetById = new Map(vets.map((v) => [String(v._id), v.name]));

    const schedule = buildPetSchedule({ pet, vaccineTypes: types, records });

    res.json({
      pet: {
        id: pet._id,
        name: pet.name,
        petCode: pet.petCode,
        species: pet.species,
        dateOfBirth: pet.dateOfBirth
      },
      schedule: schedule.map((entry) => ({
        ...entry,
        doses: entry.doses.map((d) => ({
          ...d,
          givenBy: vetById.get(String(d.givenByVetId)) || ""
        }))
      }))
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/pets/:id/vaccinations — [vet, admin] record a shot
async function recordVaccination(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);
    const body = stripProtected(req.body);

    if (!mongoose.isValidObjectId(body.vaccineTypeId)) {
      throw new ApiError(400, "Choose a vaccine.");
    }

    const catalogue = await catalogueFor(req.user);
    const vaccineType = catalogue.find((t) => String(t._id) === String(body.vaccineTypeId));
    if (!vaccineType) throw new ApiError(400, "That vaccine isn't in your catalogue.");

    if (vaccineType.species !== pet.species) {
      throw new ApiError(
        400,
        `${vaccineType.name} is a ${vaccineType.species} vaccine — ${pet.name} is a ${pet.species}.`
      );
    }

    const dateGiven = body.dateGiven ? new Date(body.dateGiven) : new Date();
    if (dateGiven > new Date()) {
      throw new ApiError(400, "A vaccination can't be recorded for a future date.");
    }
    if (pet.dateOfBirth && dateGiven < new Date(pet.dateOfBirth)) {
      throw new ApiError(400, `That's before ${pet.name} was born.`);
    }

    // Default the dose number to the next one in the course.
    const existing = await VaccinationRecord.find({
      petId: pet._id,
      vaccineTypeId: vaccineType._id
    }).lean();
    const doseSequence =
      body.doseSequence ||
      (existing.length
        ? Math.max(...existing.map((d) => d.doseSequence || 0)) + 1
        : 1);

    const record = await VaccinationRecord.create({
      petId: pet._id,
      vaccineTypeId: vaccineType._id,
      doseSequence,
      dateGiven,
      givenByVetId: req.user._id,
      clinicId: req.user.clinicId,
      batchNumber: body.batchNumber || "",
      site: body.site || "",
      notes: body.notes || ""
    });

    const next_ = await refreshNextDue({ pet, vaccineType, clinicId: req.user.clinicId });

    res.status(201).json({
      record: {
        id: record._id,
        vaccineTypeId: vaccineType._id,
        vaccineName: vaccineType.name,
        doseSequence: record.doseSequence,
        dateGiven: record.dateGiven,
        batchNumber: record.batchNumber,
        site: record.site,
        notes: record.notes,
        givenBy: req.user.name
      },
      next: { ...next_, ...dueStatus(next_.dueDate) }
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/vaccinations/:id — [vet, admin] correct a mistaken entry
async function removeVaccination(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await VaccinationRecord.findById(req.params.id);
    assertSameClinic(req.user, record, "Record");

    const [pet, vaccineType] = await Promise.all([
      Pet.findById(record.petId),
      VaccineType.findById(record.vaccineTypeId).lean()
    ]);

    await VaccinationRecord.deleteOne({ _id: record._id });

    // The due date depended on this dose, so it has to be recomputed.
    if (pet && vaccineType) {
      await refreshNextDue({ pet, vaccineType, clinicId: req.user.clinicId });
    }

    res.json({ ok: true, id: record._id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/vaccinations/due
 * Everything overdue or due soon, for the clinic (or an owner's own pets).
 * Reads the stored nextDueDate rather than recomputing across every pet.
 */
async function listDue(req, res, next) {
  try {
    const withinDays = Math.min(Number(req.query.days) || 30, 365);
    const horizon = new Date(Date.now() + withinDays * 864e5);

    const petScope = scopedFilter(req.user);
    const petFilter =
      req.user.role === "owner"
        ? { petId: { $in: (await Pet.find(petScope, "_id").lean()).map((p) => p._id) } }
        : clinicFilter(req.user);

    const records = await VaccinationRecord.find({
      ...petFilter,
      nextDueDate: { $ne: null, $lte: horizon }
    })
      .sort({ nextDueDate: 1 })
      .limit(200)
      .lean();

    const [pets, types] = await Promise.all([
      Pet.find({ _id: { $in: records.map((r) => r.petId) } }).lean(),
      VaccineType.find({ _id: { $in: records.map((r) => r.vaccineTypeId) } }).lean()
    ]);
    const petById = new Map(pets.map((p) => [String(p._id), p]));
    const typeById = new Map(types.map((t) => [String(t._id), t]));

    const owners = await User.find(
      { _id: { $in: pets.map((p) => p.ownerId) } },
      "name email"
    ).lean();
    const ownerById = new Map(owners.map((o) => [String(o._id), o]));

    const due = records
      .map((r) => {
        const pet = petById.get(String(r.petId));
        if (!pet) return null; // pet deleted; the record is orphaned
        const type = typeById.get(String(r.vaccineTypeId));
        const owner = ownerById.get(String(pet.ownerId));

        return {
          id: r._id,
          dueDate: r.nextDueDate,
          ...dueStatus(r.nextDueDate),
          lastGiven: r.dateGiven,
          doseSequence: r.doseSequence + 1,
          pet: { id: pet._id, name: pet.name, petCode: pet.petCode, species: pet.species },
          vaccine: type ? { id: type._id, name: type.name, isCore: type.isCore } : null,
          owner: owner ? { id: owner._id, name: owner.name, email: owner.email } : null
        };
      })
      .filter(Boolean);

    res.json({
      withinDays,
      counts: {
        overdue: due.filter((d) => d.status === "overdue").length,
        due: due.filter((d) => d.status === "due").length
      },
      due
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVaccineTypes,
  getPetVaccinations,
  recordVaccination,
  removeVaccination,
  listDue,
  refreshNextDue,
  catalogueFor
};
