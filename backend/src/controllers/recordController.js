const mongoose = require("mongoose");
const MedicalRecord = require("../models/MedicalRecord");
const User = require("../models/User");
const { ApiError } = require("../middleware/errorHandler");
const { assertSameClinic, stripProtected } = require("../utils/scope");
const { loadPet } = require("./petController");

function shape(record, vet, { forOwner = false } = {}) {
  const base = {
    id: record._id,
    petId: record.petId,
    visitDate: record.visitDate,
    symptoms: record.symptoms,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    notes: record.notes,
    createdAt: record.createdAt,
    aiAssisted: Boolean(record.aiAssisted),
    vet: vet ? { id: vet._id, name: vet.name } : null
  };

  // An owner only ever sees a summary a vet has released. Unapproved drafts
  // are not sent to the client at all — hiding them in the UI would still put
  // them on the wire.
  if (forOwner) {
    return {
      ...base,
      ownerSummary: record.ownerSummaryApproved ? record.ownerSummary : "",
      ownerSummaryApproved: Boolean(record.ownerSummaryApproved),
      ownerSummaryAiAssisted: Boolean(record.ownerSummaryAiAssisted)
    };
  }

  return {
    ...base,
    ownerSummary: record.ownerSummary || "",
    ownerSummaryApproved: Boolean(record.ownerSummaryApproved),
    ownerSummaryAiAssisted: Boolean(record.ownerSummaryAiAssisted),
    ownerSummaryApprovedAt: record.ownerSummaryApprovedAt || null
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

    const forOwner = req.user.role === "owner";
    res.json({
      pet: { id: pet._id, name: pet.name, petCode: pet.petCode },
      records: records.map((r) => shape(r, byId.get(String(r.vetId)), { forOwner }))
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
      notes: body.notes || "",
      // Set by the client when a draft contributed to this record. Saving is
      // the vet's sign-off, so the author is the approver.
      aiAssisted: Boolean(body.aiAssisted),
      aiApprovedByVetId: body.aiAssisted ? req.user._id : null
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
    if (body.aiAssisted !== undefined) {
      record.aiAssisted = Boolean(body.aiAssisted);
      if (record.aiAssisted && !record.aiApprovedByVetId) {
        record.aiApprovedByVetId = req.user._id;
      }
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
