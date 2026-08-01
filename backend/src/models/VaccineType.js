const mongoose = require("mongoose");

/**
 * A vaccine's schedule as data, not code.
 *
 * doseSchedule describes the primary course, one entry per dose:
 *   sequence              1, 2, 3 …
 *   minAgeWeeks           earliest the dose may be given, measured from birth
 *   intervalFromPrevDays  gap after the previous dose (ignored for sequence 1)
 *
 * boosterIntervalDays is the repeat interval once the course is complete.
 *
 * Adding a vaccine means inserting a document here — no code changes.
 */
const doseSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, min: 1 },
    minAgeWeeks: { type: Number, default: 0, min: 0 },
    intervalFromPrevDays: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const vaccineTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    species: { type: String, enum: ["cat", "dog"], required: true },
    // Core vaccines are recommended for every animal of the species; the rest
    // are lifestyle-dependent and only surface when a vet adds them.
    isCore: { type: Boolean, default: false },
    doseSchedule: { type: [doseSchema], default: [] },
    boosterIntervalDays: { type: Number, default: 365, min: 1 },
    notes: { type: String, trim: true, default: "" },

    // null = a global catalogue entry seeded for everyone.
    // Set = a clinic's own addition, visible only to that clinic.
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", default: null, index: true }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

vaccineTypeSchema.index({ species: 1, name: 1, clinicId: 1 }, { unique: true });

// Keep doses in order regardless of the order they were entered.
vaccineTypeSchema.pre("save", function (next) {
  this.doseSchedule.sort((a, b) => a.sequence - b.sequence);
  next();
});

module.exports = mongoose.model("VaccineType", vaccineTypeSchema);
