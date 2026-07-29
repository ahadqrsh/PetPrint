const mongoose = require("mongoose");

const clinicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["ngo", "private"], required: true },
    // Plan gates paid-only features later. Defaults per type: NGOs ride free.
    plan: { type: String, enum: ["free", "paid"] },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

clinicSchema.pre("validate", function (next) {
  if (this.isNew && !this.plan) {
    this.plan = this.type === "private" ? "paid" : "free";
  }
  next();
});

module.exports = mongoose.model("Clinic", clinicSchema);
