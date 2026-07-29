const Clinic = require("../models/Clinic");
const User = require("../models/User");
const Pet = require("../models/Pet");
const MedicalRecord = require("../models/MedicalRecord");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, scopedFilter, stripProtected } = require("../utils/scope");

// GET /api/clinics — public, minimal list so owners can pick their clinic at sign-up.
// Deliberately returns name/type only: no addresses, phones, or counts.
async function listClinics(req, res, next) {
  try {
    const clinics = await Clinic.find({}, "name type").sort("name").lean();
    res.json({ clinics: clinics.map((c) => ({ id: c._id, name: c.name, type: c.type })) });
  } catch (err) {
    next(err);
  }
}

// GET /api/clinic — the caller's own clinic, plus team counts. Any signed-in role.
async function getMyClinic(req, res, next) {
  try {
    const clinic = await Clinic.findById(req.user.clinicId).lean();
    if (!clinic) throw new ApiError(404, "Clinic not found.");

    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const petScope = scopedFilter(req.user);

    const [admins, vets, owners, pets, visitsThisWeek] = await Promise.all([
      User.countDocuments({ ...clinicFilter(req.user), role: "admin" }),
      User.countDocuments({ ...clinicFilter(req.user), role: "vet" }),
      User.countDocuments({ ...clinicFilter(req.user), role: "owner" }),
      // Pets and visits follow the caller's scope: an owner counts only their own.
      Pet.countDocuments(petScope),
      req.user.role === "owner"
        ? Pet.find(petScope, "_id").lean().then((own) =>
            MedicalRecord.countDocuments({
              petId: { $in: own.map((p) => p._id) },
              visitDate: { $gte: weekAgo }
            })
          )
        : MedicalRecord.countDocuments({
            ...clinicFilter(req.user),
            visitDate: { $gte: weekAgo }
          })
    ]);

    res.json({
      clinic: {
        id: clinic._id,
        name: clinic.name,
        type: clinic.type,
        plan: clinic.plan,
        address: clinic.address,
        phone: clinic.phone,
        createdAt: clinic.createdAt
      },
      counts: { pets, visitsThisWeek },
      // Owners get the clinic card but not a roster of who else is registered.
      team: req.user.role === "owner" ? null : { admins, vets, owners }
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/clinic  [admin] — name, address, phone. Type and plan are not self-serve.
async function updateMyClinic(req, res, next) {
  try {
    const clinic = await Clinic.findById(req.user.clinicId);
    if (!clinic) throw new ApiError(404, "Clinic not found.");

    const { name, address, phone } = stripProtected(req.body);
    if (name !== undefined) clinic.name = name;
    if (address !== undefined) clinic.address = address;
    if (phone !== undefined) clinic.phone = phone;

    await clinic.save();
    res.json({ clinic });
  } catch (err) {
    next(err);
  }
}

module.exports = { listClinics, getMyClinic, updateMyClinic };
