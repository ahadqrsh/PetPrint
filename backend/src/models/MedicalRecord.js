const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    vetId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },

    visitDate: { type: Date, required: true, default: Date.now },
    symptoms: { type: String, trim: true, default: "" },
    diagnosis: { type: String, trim: true, default: "" },
    treatment: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // ---- AI provenance -------------------------------------------------
    // True when a draft from the assistant contributed to this record. It stays
    // true even after heavy editing: the point is disclosure, not blame.
    aiAssisted: { type: Boolean, default: false },
    // The vet who reviewed and saved it. A record only exists because someone
    // pressed save, so this is always a real sign-off.
    aiApprovedByVetId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ---- Owner-facing summary ------------------------------------------
    // Drafted from the approved record, then held back until a vet releases it.
    // Owners never see this field until ownerSummaryApproved is true.
    ownerSummary: { type: String, trim: true, default: "" },
    ownerSummaryAiAssisted: { type: Boolean, default: false },
    ownerSummaryApproved: { type: Boolean, default: false },
    ownerSummaryApprovedByVetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    ownerSummaryApprovedAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// The timeline query: one pet's visits, newest first.
medicalRecordSchema.index({ petId: 1, visitDate: -1 });

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
