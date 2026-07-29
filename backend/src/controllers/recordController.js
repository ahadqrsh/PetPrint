const mongoose = require("mongoose");
const MedicalRecord = require("../models/MedicalRecord");
const User = require("../models/User");
const { ApiError } = require("../middleware/errorHandler");
const { assertSameClinic, stripProtected } = require("../utils/scope");
const { loadPet } = require("./petController");

function shape(record, vet) {
  return {
    id: record._id,
    petId: record.petId,
    visitDate: record.visitDate,
    symptoms: record.symptoms,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    notes: record.notes,
    createdAt: record.createdAt,
    vet: vet ? { id: vet._id, name: vet.name } : null
  };
}

// GET /api/pets/:id/records — the history timeline, newest first.
// loadPet applies the caller's scope, so an owner only ever reaches their own.
async function listRecords(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);

    const records = await MedicalRecord.find({ petId: pet._id, clinicId: req.user.clinicId })
      .sort({ visitDate: -1, createdAt: -1 })
      .lean();

    const vets = await User.find({ _id: { $in: records.map((r) => r.vetId) } }, "name").lean();
    const byId = new Map(vets.map((v) => [String(v._id), v]));

    res.json({
      pet: { id: pet._id, name: pet.name, petCode: pet.petCode },
      records: records.map((r) => shape(r, byId.get(String(r.vetId))))
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/pets/:id/records — [vet, admin]. The author is always the caller.
async function createRecord(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);
    const body = stripProtected(req.body);

    const record = await MedicalRecord.create({
      petId: pet._id,
      vetId: req.user._id,
      clinicId: req.user.clinicId,
      visitDate: body.visitDate || new Date(),
      symptoms: body.symptoms || "",
      diagnosis: body.diagnosis || "",
      treatment: body.treatment || "",
      notes: body.notes || ""
    });

    res.status(201).json({ record: shape(record, req.user) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/records/:id — [vet, admin]
async function updateRecord(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await MedicalRecord.findById(req.params.id);
    assertSameClinic(req.user, record, "Record");

    const body = stripProtected(req.body);
    for (const field of ["visitDate", "symptoms", "diagnosis", "treatment", "notes"]) {
      if (body[field] !== undefined) record[field] = body[field];
    }

    await record.save();
    const vet = await User.findById(record.vetId, "name").lean();
    res.json({ record: shape(record, vet) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/records/:id — [admin]
async function removeRecord(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await MedicalRecord.findById(req.params.id);
    assertSameClinic(req.user, record, "Record");

    await MedicalRecord.deleteOne({ _id: record._id });
    res.json({ ok: true, id: record._id });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRecords, createRecord, updateRecord, removeRecord };
