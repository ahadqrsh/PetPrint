const mongoose = require("mongoose");

const adoptionApplicationSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdoptionListing",
      required: true,
      index: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    // Denormalised so the review queue can be scoped without a join.
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },

    message: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["applied", "approved", "rejected"],
      default: "applied",
      index: true
    }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// One application per person per listing.
adoptionApplicationSchema.index({ listingId: 1, applicantId: 1 }, { unique: true });

module.exports = mongoose.model("AdoptionApplication", adoptionApplicationSchema);
