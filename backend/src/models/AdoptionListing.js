const mongoose = require("mongoose");

const adoptionListingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    species: { type: String, enum: ["cat", "dog"], required: true },
    breed: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    imageUrl: { type: String, default: "" },

    // available -> pending (someone has applied) -> adopted
    status: {
      type: String,
      enum: ["available", "pending", "adopted"],
      default: "available",
      index: true
    },

    postedByVetId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

adoptionListingSchema.index({ clinicId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AdoptionListing", adoptionListingSchema);
