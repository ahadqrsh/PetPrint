const User = require("../models/User");
const { clinicFilter } = require("../utils/scope");

// GET /api/owners — [vet, admin] the clinic's owners, for the "register a pet"
// picker. Name and email only; no phone numbers or ids beyond what's needed.
async function listOwners(req, res, next) {
  try {
    const owners = await User.find({ ...clinicFilter(req.user), role: "owner" }, "name email")
      .sort({ name: 1 })
      .lean();
    res.json({ owners: owners.map((o) => ({ id: o._id, name: o.name, email: o.email })) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listOwners };
