const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const notify = require("../services/emailService");
const { logAudit } = require("../services/auditLog");

function shape(vet) {
  return { ...vet.toSafeJSON() };
}

async function listVets(req, res, next) {
  try {
    const vets = await User.find({ ...clinicFilter(req.user), role: "vet" }).sort({ name: 1 });
    res.json({ vets: vets.map(shape) });
  } catch (err) {
    next(err);
  }
}

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

async function deactivateVet(req, res, next) {
  try {
    const vet = await User.findOne({ _id: req.params.id, role: "vet" });
    assertSameClinic(req.user, vet, "Vet");

    vet.isActive = false;
    await vet.save();
    logAudit(req.user, "vet.deactivated", { vetId: vet._id, vetName: vet.name }, req);

    res.json({ vet: shape(vet) });
  } catch (err) {
    next(err);
  }
}

async function activateVet(req, res, next) {
  try {
    const vet = await User.findOne({ _id: req.params.id, role: "vet" });
    assertSameClinic(req.user, vet, "Vet");

    vet.isActive = true;
    vet.failedLoginAttempts = 0;
    vet.lockUntil = null;
    await vet.save();
    logAudit(req.user, "vet.activated", { vetId: vet._id, vetName: vet.name }, req);

    res.json({ vet: shape(vet) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVets, createVet, deactivateVet, activateVet };
