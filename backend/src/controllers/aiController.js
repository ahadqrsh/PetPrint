const mongoose = require("mongoose");
const MedicalRecord = require("../models/MedicalRecord");
const { ApiError } = require("../middleware/errorHandler");
const { assertSameClinic, stripProtected } = require("../utils/scope");
const ai = require("../services/aiService");
const { loadPet } = require("./petController");

/**
 * Every endpoint here returns a *draft*. None of them writes clinical content
 * to a record — saving is a separate, deliberate act by the vet through the
 * normal record endpoints. That separation is the safety property: there is no
 * code path where AI output reaches a patient record without a human pressing
 * save.
 */

const DISCLAIMER =
  "AI-assisted draft. Review every line against your own findings before saving.";

// GET /api/ai/status — so the UI can hide the feature when it isn't set up
async function status(req, res) {
  res.json({
    available: ai.AI_CONFIGURED,
    model: ai.AI_CONFIGURED ? ai.MODEL : null,
    disclaimer: DISCLAIMER
  });
}

// POST /api/pets/:id/ai/draft-record — [vet, admin]
async function draftRecord(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);
    const { observations } = stripProtected(req.body);

    const draft = await ai.draftClinicalRecord({ observations, pet });

    res.json({
      draft,
      aiAssisted: true,
      disclaimer: DISCLAIMER,
      // Echoed back so the vet can compare the draft against what they wrote.
      source: String(observations).trim()
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/records/:id/ai/owner-summary — [vet, admin]
// Drafts from the saved record, so it can only restate approved content.
async function draftOwnerSummary(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await MedicalRecord.findById(req.params.id);
    assertSameClinic(req.user, record, "Record");

    const pet = await loadPet(req, String(record.petId));
    const { summary } = await ai.draftOwnerSummary({ record, pet });

    // Stored unapproved: written down so it isn't lost, but withheld from the
    // owner until a vet releases it.
    record.ownerSummary = summary;
    record.ownerSummaryAiAssisted = true;
    record.ownerSummaryApproved = false;
    record.ownerSummaryApprovedByVetId = null;
    record.ownerSummaryApprovedAt = null;
    await record.save();

    res.json({
      summary,
      approved: false,
      disclaimer:
        "AI-assisted draft. The owner cannot see this until you approve it."
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/records/:id/owner-summary — [vet, admin] edit and/or release it
async function saveOwnerSummary(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Record not found.");
    const record = await MedicalRecord.findById(req.params.id);
    assertSameClinic(req.user, record, "Record");

    const { summary, approved } = stripProtected(req.body);

    if (summary !== undefined) {
      // The flag stays true once AI drafted it: the owner is told a draft was
      // machine-assisted regardless of how much the vet then rewrote.
      record.ownerSummary = String(summary).trim();
    }

    if (approved === true) {
      if (!record.ownerSummary) {
        throw new ApiError(400, "There's nothing to approve — write a summary first.");
      }
      record.ownerSummaryApproved = true;
      record.ownerSummaryApprovedByVetId = req.user._id;
      record.ownerSummaryApprovedAt = new Date();
    } else if (approved === false) {
      record.ownerSummaryApproved = false;
      record.ownerSummaryApprovedByVetId = null;
      record.ownerSummaryApprovedAt = null;
    }

    await record.save();

    res.json({
      summary: record.ownerSummary,
      approved: record.ownerSummaryApproved,
      approvedAt: record.ownerSummaryApprovedAt,
      aiAssisted: record.ownerSummaryAiAssisted
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { status, draftRecord, draftOwnerSummary, saveOwnerSummary, DISCLAIMER };
