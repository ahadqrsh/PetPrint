const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "vet", "owner"], required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    phone: { type: String, trim: true, default: "" },

    // Deactivation replaces hard delete: a vet's old records keep a valid
    // author forever, and a mistaken removal is a toggle, not data loss.
    isActive: { type: Boolean, default: true },

    // ---- Email verification ------------------------------------------
    // Non-blocking: an unverified account can still sign in and use the app.
    // Verification just confirms the inbox is real, so password reset and
    // notifications land somewhere the person actually controls.
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, default: null, select: false },
    emailVerifyExpires: { type: Date, default: null, select: false },

    // ---- Password reset -------------------------------------------------
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },

    // ---- Login protection -------------------------------------------
    // Per-account lockout, independent of the IP-based rate limiter — the
    // limiter stops one IP hammering many accounts; this stops many IPs
    // hammering one account.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

userSchema.index({ email: 1, clinicId: 1 }, { unique: true });

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    clinicId: this.clinicId,
    phone: this.phone,
    isActive: this.isActive,
    emailVerified: this.emailVerified
  };
};

module.exports = mongoose.model("User", userSchema);
