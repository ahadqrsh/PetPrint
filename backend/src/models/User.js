const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "vet", "owner"], required: true },
    // null only for a future platform super-admin
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      default: null,
      index: true
    },
    phone: { type: String, trim: true, default: "" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// One safe shape for every response that includes a user.
userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, role, clinicId, phone, createdAt } = this;
  return { id: _id, name, email, role, clinicId, phone, createdAt };
};

module.exports = mongoose.model("User", userSchema);
