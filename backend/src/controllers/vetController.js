const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const Clinic = require("../models/Clinic");
const notify = require("../services/emailService");

const SALT_ROUNDS = 10;

// Loads a vet by id *within the caller's clinic*.
// Cross-tenant ids fall through to 404 via assertSameClinic.
async function findVetInClinic(req, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Vet not found.");
  const vet = await User.findById(id);
  assertSameClinic(req.user, vet, "Vet");
  if (vet.role !== "vet") {
    // Admins and owners are managed elsewhere; this endpoint only touches vets.
    throw new ApiError(404, "Vet not found.");
  }
  return vet;
}

// GET /api/vets  [admin]
async function listVets(req, res, next) {
  try {
    const vets = await User.find({ ...clinicFilter(req.user), role: "vet" })
      .sort({ name: 1 })
      .lean();

    res.json({
      vets: vets.map((v) => ({
        id: v._id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        role: v.role,
        createdAt: v.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/vets  [admin] — clinicId and role come from the session, never the body
async function createVet(req, res, next) {
  try {
    const { name, email, password, phone } = stripProtected(req.body);

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, "That email is already in use.");

    const vet = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role: "vet",
      clinicId: req.user.clinicId,
      phone: phone || ""
    });

    const clinic = await Clinic.findById(req.user.clinicId).lean();
    if (clinic) notify.vetAccountCreated({ vet, clinic, temporaryPassword: true });

    res.status(201).json({ vet: vet.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/vets/:id  [admin]
async function updateVet(req, res, next) {
  try {
    const vet = await findVetInClinic(req, req.params.id);
    const { name, email, phone, password } = stripProtected(req.body);

    if (email && email !== vet.email) {
      const taken = await User.findOne({ email });
      if (taken) throw new ApiError(409, "That email is already in use.");
      vet.email = email;
    }
    if (name !== undefined) vet.name = name;
    if (phone !== undefined) vet.phone = phone;
    if (password) vet.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await vet.save();
    res.json({ vet: vet.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/vets/:id  [admin]
async function removeVet(req, res, next) {
  try {
    const vet = await findVetInClinic(req, req.params.id);

    if (String(vet._id) === String(req.user._id)) {
      throw new ApiError(400, "You can't remove your own account.");
    }

    // Phase 3 note: once MedicalRecord exists, refuse deletion when the vet has
    // signed records and offer deactivation instead, so history stays intact.
    await User.deleteOne({ _id: vet._id });
    res.json({ ok: true, id: vet._id });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVets, createVet, updateVet, removeVet };
