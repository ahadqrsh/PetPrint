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
    notes: { type: String, trim: true, default: "" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// The timeline query: one pet's visits, newest first.
medicalRecordSchema.index({ petId: 1, visitDate: -1 });

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
