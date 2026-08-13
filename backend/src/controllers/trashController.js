const mongoose = require("mongoose");
const Pet = require("../models/Pet");
const MedicalRecord = require("../models/MedicalRecord");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, assertSameClinic } = require("../utils/scope");
const { logAudit } = require("../services/auditLog");

// GET /api/trash/pets — [admin]
async function listDeletedPets(req, res, next) {
  try {
    // deletedAt is explicit here, so the soft-delete hook's default
    // (deletedAt: null) does not override this — that's the whole mechanism
    // that lets Trash see what everything else can't.
    const pets = await Pet.find({ ...clinicFilter(req.user), deletedAt: { $ne: null } })
      .sort({ deletedAt: -1 })
      .lean();

    res.json({
      pets: pets.map((p) => ({
        id: p._id, name: p.name, petCode: p.petCode, species: p.species, deletedAt: p.deletedAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/trash/pets/:id/restore — [admin]
async function restorePet(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Pet not found.");
    // Explicit deletedAt filter again, for the same reason: this is the one
    // place we deliberately want to find a soft-deleted document.
    const pet = await Pet.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
    assertSameClinic(req.user, pet, "Pet");

    await pet.restore();
    logAudit(req.user, "pet.restored", { petId: pet._id, petName: pet.name }, req);

    res.json({ ok: true, pet: { id: pet._id, name: pet.name } });
  } catch (err) {
    next(err);
  }
}

// GET /api/trash/records — [admin]
async function listDeletedRecords(req, res, next) {
  try {
    const records = await MedicalRecord.find({ ...clinicFilter(req.user), deletedAt: { $ne: null } })
      .sort({ deletedAt: -1 })
      .lean();

    const pets = await Pet.find(
      { _id: { $in: records.map((r) => r.petId) } },
      "name petCode"
    ).setOptions({ includeDeleted: true }); // a pet's own record view shouldn't 404 just because the pet is also in Trash
    const petById = new Map(pets.map((p) => [String(p._id), p]));

    res.json({
      records: records.map((r) => ({
        id: r._id,
        petId: r.petId,
        petName: petById.get(String(r.petId))?.name || "Unknown pet",
        visitDate: r.visitDate,
        deletedAt: r.deletedAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/trash/records/:id/restore — [admin]
async function restoreRecord(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await MedicalRecord.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
    assertSameClinic(req.user, record, "Record");

    await record.restore();
    logAudit(req.user, "record.restored", { recordId: record._id, petId: record.petId }, req);

    res.json({ ok: true, record: { id: record._id } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDeletedPets, restorePet, listDeletedRecords, restoreRecord };
