const mongoose = require("mongoose");
const { applySoftDelete } = require("../utils/softDelete");

const petSchema = new mongoose.Schema(
  {
    // Human-friendly, printed on the tag: PET-2026-0042. Generated server-side.
    petCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    species: { type: String, enum: ["cat", "dog"], required: true },
    breed: { type: String, trim: true, default: "" },
    sex: { type: String, enum: ["male", "female"], required: true },
    dateOfBirth: { type: Date, default: null },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },

    // Surfaced as a banner at the top of the profile — the first thing a vet
    // should see before prescribing anything.
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },

    photoUrl: { type: String, default: "" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// The two lookups that matter: a clinic's roster, and an owner's own pets.
petSchema.index({ clinicId: 1, name: 1 });
petSchema.index({ clinicId: 1, ownerId: 1 });

applySoftDelete(petSchema);
module.exports = mongoose.model("Pet", petSchema);

