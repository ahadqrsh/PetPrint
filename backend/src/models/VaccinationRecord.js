const mongoose = require("mongoose");

const vaccinationRecordSchema = new mongoose.Schema(
  {
    petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    vaccineTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VaccineType",
      required: true,
      index: true
    },
    doseSequence: { type: Number, required: true, min: 1 },
    dateGiven: { type: Date, required: true },

    givenByVetId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },

    batchNumber: { type: String, trim: true, default: "" },
    site: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // Computed on save by the engine and stored so "what's due" is one indexed
    // query rather than a recomputation across every pet.
    nextDueDate: { type: Date, default: null, index: true }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

vaccinationRecordSchema.index({ petId: 1, vaccineTypeId: 1, doseSequence: 1 });
vaccinationRecordSchema.index({ clinicId: 1, nextDueDate: 1 });

module.exports = mongoose.model("VaccinationRecord", vaccinationRecordSchema);
