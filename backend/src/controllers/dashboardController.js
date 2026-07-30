const Pet = require("../models/Pet");
const User = require("../models/User");
const MedicalRecord = require("../models/MedicalRecord");
const AdoptionListing = require("../models/AdoptionListing");
const AdoptionApplication = require("../models/AdoptionApplication");
const { clinicFilter, scopedFilter } = require("../utils/scope");

/**
 * GET /api/dashboard/stats
 * The single source for dashboard numbers. Everything is scoped the same way
 * the underlying list endpoints are, so a count can never disagree with the
 * page it links to.
 */
async function stats(req, res, next) {
  try {
    const isOwner = req.user.role === "owner";
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const petScope = scopedFilter(req.user);
    const clinic = clinicFilter(req.user);

    // An owner's visit and application counts must be narrowed to their own.
    const ownPetIds = isOwner
      ? (await Pet.find(petScope, "_id").lean()).map((p) => p._id)
      : null;

    const visitFilter = isOwner
      ? { petId: { $in: ownPetIds }, visitDate: { $gte: weekAgo } }
      : { ...clinic, visitDate: { $gte: weekAgo } };

    const applicationFilter = { ...clinic, status: "applied" };
    if (isOwner) applicationFilter.applicantId = req.user._id;

    const [
      pets, visitsThisWeek, petsWithAllergies,
      adoptable, pendingAdoptions, openApplications,
      vets, owners, recent
    ] = await Promise.all([
      Pet.countDocuments(petScope),
      MedicalRecord.countDocuments(visitFilter),
      Pet.countDocuments({ ...petScope, "allergies.0": { $exists: true } }),
      AdoptionListing.countDocuments({ ...clinic, status: { $in: ["available", "pending"] } }),
      AdoptionListing.countDocuments({ ...clinic, status: "pending" }),
      AdoptionApplication.countDocuments(applicationFilter),
      isOwner ? 0 : User.countDocuments({ ...clinic, role: "vet" }),
      isOwner ? 0 : User.countDocuments({ ...clinic, role: "owner" }),
      MedicalRecord.find(isOwner ? { petId: { $in: ownPetIds } } : clinic)
        .sort({ visitDate: -1, createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    // Hydrate the activity feed with pet and vet names.
    const recentPets = await Pet.find(
      { _id: { $in: recent.map((r) => r.petId) } },
      "name petCode"
    ).lean();
    const recentVets = await User.find(
      { _id: { $in: recent.map((r) => r.vetId) } },
      "name"
    ).lean();
    const petById = new Map(recentPets.map((p) => [String(p._id), p]));
    const vetById = new Map(recentVets.map((v) => [String(v._id), v]));

    res.json({
      role: req.user.role,
      counts: {
        pets,
        visitsThisWeek,
        petsWithAllergies,
        adoptable,
        pendingAdoptions,
        openApplications,
        ...(isOwner ? {} : { vets, owners })
      },
      recentVisits: recent.map((r) => {
        const pet = petById.get(String(r.petId));
        return {
          id: r._id,
          visitDate: r.visitDate,
          diagnosis: r.diagnosis || "",
          petId: r.petId,
          petName: pet?.name || "Deleted pet",
          petCode: pet?.petCode || "",
          vetName: vetById.get(String(r.vetId))?.name || ""
        };
      })
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { stats };
