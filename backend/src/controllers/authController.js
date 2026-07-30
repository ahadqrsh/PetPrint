const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const { ApiError } = require("../middleware/errorHandler");
const { signAccessToken } = require("../utils/tokens");
const email = require("../services/emailService");

const SALT_ROUNDS = 10;

// POST /api/auth/register-clinic
// Bootstraps a tenant: creates the Clinic and its first admin in one step.
async function registerClinic(req, res, next) {
  try {
    const { clinic, admin } = req.body;

    const existing = await User.findOne({ email: admin.email });
    if (existing) throw new ApiError(409, "That email is already in use.");

    const clinicDoc = await Clinic.create({
      name: clinic.name,
      type: clinic.type,
      address: clinic.address || "",
      phone: clinic.phone || ""
    });

    let adminDoc;
    try {
      adminDoc = await User.create({
        name: admin.name,
        email: admin.email,
        passwordHash: await bcrypt.hash(admin.password, SALT_ROUNDS),
        role: "admin",
        clinicId: clinicDoc._id,
        phone: admin.phone || ""
      });
    } catch (err) {
      // Don't leave an orphan tenant if the admin insert lost a race.
      await Clinic.deleteOne({ _id: clinicDoc._id });
      throw err;
    }

    // Fire-and-forget: a failing mail server must not fail a signup.
    email.welcomeClinic({ user: adminDoc, clinic: clinicDoc });

    res.status(201).json({
      token: signAccessToken(adminDoc),
      user: adminDoc.toSafeJSON(),
      clinic: clinicDoc
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/register  — owner self-registration into an existing clinic
async function register(req, res, next) {
  try {
    const { name, email, password, phone, clinicId } = req.body;

    if (!mongoose.isValidObjectId(clinicId)) {
      throw new ApiError(400, "Please choose a valid clinic.");
    }
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) throw new ApiError(400, "That clinic doesn't exist.");

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, "That email is already in use.");

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role: "owner", // self-registration is owner-only; vets are created by admins
      clinicId: clinic._id,
      phone: phone || ""
    });

    email.welcomeOwner({ user, clinic });

    res.status(201).json({ token: signAccessToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+passwordHash");
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new ApiError(401, "Email or password is incorrect.");

    res.json({ token: signAccessToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

module.exports = { registerClinic, register, login, me };
