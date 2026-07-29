const Pet = require("../models/Pet");
const User = require("../models/User");
const { scopedFilter, clinicFilter } = require("../utils/scope");
const { normalisePetCode } = require("../utils/generatePetCode");

// GET /api/search?q= — pets by name, owner name, or pet code.
// Everything runs inside the caller's scope, so an owner searching "Bella"
// only ever finds their own Bella.
async function search(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.json({ query: q, pets: [], hint: "Type at least two characters." });
    }

    const base = scopedFilter(req.user);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // Owner-name matches are resolved to ids first; owners skip this because
    // they can only ever match themselves.
    let ownerIds = [];
    if (req.user.role !== "owner") {
      const owners = await User.find(
        { ...clinicFilter(req.user), role: "owner", name: rx },
        "_id"
      ).lean();
      ownerIds = owners.map((o) => o._id);
    }

    const or = [{ name: rx }, { petCode: normalisePetCode(q) }, { petCode: rx }];
    if (ownerIds.length) or.push({ ownerId: { $in: ownerIds } });

    const pets = await Pet.find({ ...base, $or: or }).sort({ name: 1 }).limit(25).lean();

    const owners = await User.find(
      { _id: { $in: pets.map((p) => p.ownerId) } },
      "name"
    ).lean();
    const byId = new Map(owners.map((o) => [String(o._id), o.name]));

    res.json({
      query: q,
      pets: pets.map((p) => ({
        id: p._id,
        petCode: p.petCode,
        name: p.name,
        species: p.species,
        breed: p.breed,
        ownerName: byId.get(String(p.ownerId)) || null,
        hasAllergies: (p.allergies || []).length > 0
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search };
