const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const notify = require("../services/emailService");

function shape(vet) {
  return { ...vet.toSafeJSON() };
}

// GET /api/vets — [admin]
async function listVets(req, res, next) {
  try {
    const vets = await User.find({ ...clinicFilter(req.user), role: "vet" }).sort({ name: 1 });
    res.json({ vets: vets.map(shape) });
  } catch (err) {
    next(err);
  }
}

// POST /api/vets — [admin]
async function createVet(req, res, next) {
  try {
    const { name, email, password, phone } = stripProtected(req.body);
    const passwordHash = await bcrypt.hash(password, 10);

    const vet = await User.create({
      name, email, phone: phone || "", passwordHash, role: "vet", clinicId: req.user.clinicId
    });

    const clinic = await Clinic.findById(req.user.clinicId).lean();
    if (clinic) notify.vetAccountCreated({ vet, clinic });

    res.status(201).json({ vet: shape(vet) });
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, "A vet with that email already exists here."));
    next(err);
  }
}

/**
 * PATCH /api/vets/:id/deactivate — [admin]
 *
 * Replaces a hard delete. A deactivated vet can no longer sign in, but every
 * medical record and vaccination they authored keeps a valid "seen by" author
 * forever — a hard delete would either orphan those references or cascade-
 * delete clinical history, both worse than a toggle.
 */
async function deactivateVet(req, res, next) {
  try {
    const vet = await User.findOne({ _id: req.params.id, role: "vet" });
    assertSameClinic(req.user, vet, "Vet");

    vet.isActive = false;
    await vet.save();

    res.json({ vet: shape(vet) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/vets/:id/activate — [admin]
async function activateVet(req, res, next) {
  try {
    const vet = await User.findOne({ _id: req.params.id, role: "vet" });
    assertSameClinic(req.user, vet, "Vet");

    vet.isActive = true;
    // A fresh start, not a loophole: reactivating clears any lockout so the
    // vet isn't reinstated into an account still counting down a 15-minute
    // lock from before they were deactivated.
    vet.failedLoginAttempts = 0;
    vet.lockUntil = null;
    await vet.save();

    res.json({ vet: shape(vet) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVets, createVet, deactivateVet, activateVet };
