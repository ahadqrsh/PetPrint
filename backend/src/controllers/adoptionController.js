const mongoose = require("mongoose");
const AdoptionListing = require("../models/AdoptionListing");
const AdoptionApplication = require("../models/AdoptionApplication");
const User = require("../models/User");
const { ApiError } = require("../middleware/errorHandler");
const { clinicFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const { storeImage, deleteLocalImage } = require("../services/uploadService");
const { nextListingStatus } = require("../utils/adoptionStatus");
const notify = require("../services/emailService");

const publicBase = (req) => `${req.protocol}://${req.get("host")}`;

function shapeListing(listing, { postedBy, applicationCount, myApplication } = {}) {
  return {
    id: listing._id,
    name: listing.name,
    species: listing.species,
    breed: listing.breed,
    description: listing.description,
    imageUrl: listing.imageUrl,
    status: listing.status,
    createdAt: listing.createdAt,
    postedBy: postedBy ? { id: postedBy._id, name: postedBy.name } : null,
    applicationCount: applicationCount ?? undefined,
    myApplication: myApplication
      ? { id: myApplication._id, status: myApplication.status, createdAt: myApplication.createdAt }
      : null
  };
}

function shapeApplication(app, { listing, applicant } = {}) {
  return {
    id: app._id,
    status: app.status,
    message: app.message,
    createdAt: app.createdAt,
    listing: listing
      ? {
          id: listing._id,
          name: listing.name,
          species: listing.species,
          breed: listing.breed,
          imageUrl: listing.imageUrl,
          status: listing.status
        }
      : null,
    applicant: applicant
      ? { id: applicant._id, name: applicant.name, email: applicant.email, phone: applicant.phone }
      : null
  };
}

async function loadListing(req, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Listing not found.");
  const listing = await AdoptionListing.findById(id);
  assertSameClinic(req.user, listing, "Listing");
  return listing;
}

/** Recomputes listing.status from its applications and saves if it changed. */
async function syncListingStatus(listing) {
  const [approvedCount, openCount] = await Promise.all([
    AdoptionApplication.countDocuments({ listingId: listing._id, status: "approved" }),
    AdoptionApplication.countDocuments({ listingId: listing._id, status: "applied" })
  ]);

  const next = nextListingStatus({ current: listing.status, approvedCount, openCount });
  if (next !== listing.status) {
    listing.status = next;
    await listing.save();
  }
  return listing;
}

// GET /api/adoptions — listings in the caller's clinic.
// Owners see what's still open; staff see everything, including adopted.
async function listListings(req, res, next) {
  try {
    const filter = clinicFilter(req.user);
    const { status, species } = req.query;

    if (req.user.role === "owner") {
      filter.status = status === "adopted" ? "adopted" : { $in: ["available", "pending"] };
    } else if (["available", "pending", "adopted"].includes(status)) {
      filter.status = status;
    }
    if (species === "cat" || species === "dog") filter.species = species;

    const listings = await AdoptionListing.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const ids = listings.map((l) => l._id);

    const [posters, counts, mine] = await Promise.all([
      User.find({ _id: { $in: listings.map((l) => l.postedByVetId) } }, "name").lean(),
      req.user.role === "owner"
        ? []
        : AdoptionApplication.aggregate([
            { $match: { listingId: { $in: ids }, status: "applied" } },
            { $group: { _id: "$listingId", n: { $sum: 1 } } }
          ]),
      req.user.role === "owner"
        ? AdoptionApplication.find({ listingId: { $in: ids }, applicantId: req.user._id }).lean()
        : []
    ]);

    const posterById = new Map(posters.map((p) => [String(p._id), p]));
    const countById = new Map(counts.map((c) => [String(c._id), c.n]));
    const mineById = new Map(mine.map((m) => [String(m.listingId), m]));

    res.json({
      listings: listings.map((l) =>
        shapeListing(l, {
          postedBy: posterById.get(String(l.postedByVetId)),
          applicationCount: req.user.role === "owner" ? undefined : countById.get(String(l._id)) || 0,
          myApplication: mineById.get(String(l._id))
        })
      )
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/adoptions/:id
async function getListing(req, res, next) {
  try {
    const listing = await loadListing(req, req.params.id);
    const postedBy = await User.findById(listing.postedByVetId, "name").lean();

    const extras = {};
    if (req.user.role === "owner") {
      extras.myApplication = await AdoptionApplication.findOne({
        listingId: listing._id,
        applicantId: req.user._id
      }).lean();
    } else {
      extras.applicationCount = await AdoptionApplication.countDocuments({
        listingId: listing._id,
        status: "applied"
      });
    }

    res.json({ listing: shapeListing(listing, { postedBy, ...extras }) });
  } catch (err) {
    next(err);
  }
}

// POST /api/adoptions — [vet, admin], multipart with an optional "image" field
async function createListing(req, res, next) {
  try {
    const body = stripProtected(req.body);
    const imageUrl = await storeImage(req.file, { publicBaseUrl: publicBase(req) });

    const listing = await AdoptionListing.create({
      name: body.name,
      species: body.species,
      breed: body.breed || "",
      description: body.description || "",
      imageUrl,
      status: "available",
      postedByVetId: req.user._id,
      clinicId: req.user.clinicId
    });

    res.status(201).json({ listing: shapeListing(listing, { postedBy: req.user, applicationCount: 0 }) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/adoptions/:id — [vet, admin]. A new image replaces the old one.
async function updateListing(req, res, next) {
  try {
    const listing = await loadListing(req, req.params.id);
    const body = stripProtected(req.body);

    for (const field of ["name", "species", "breed", "description"]) {
      if (body[field] !== undefined) listing[field] = body[field];
    }

    // Status is normally derived from applications; allow staff to reopen or
    // close a listing by hand, but never to fake "adopted".
    if (body.status === "available" || body.status === "pending") {
      listing.status = body.status;
    }

    if (req.file) {
      const previous = listing.imageUrl;
      listing.imageUrl = await storeImage(req.file, { publicBaseUrl: publicBase(req) });
      await deleteLocalImage(previous);
    }

    await listing.save();
    const postedBy = await User.findById(listing.postedByVetId, "name").lean();
    res.json({ listing: shapeListing(listing, { postedBy }) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/adoptions/:id — [vet, admin]. Takes its applications with it.
async function removeListing(req, res, next) {
  try {
    const listing = await loadListing(req, req.params.id);
    await AdoptionApplication.deleteMany({ listingId: listing._id });
    await deleteLocalImage(listing.imageUrl);
    await AdoptionListing.deleteOne({ _id: listing._id });
    res.json({ ok: true, id: listing._id });
  } catch (err) {
    next(err);
  }
}

// POST /api/adoptions/:id/apply — [owner]
async function apply(req, res, next) {
  try {
    const listing = await loadListing(req, req.params.id);

    if (listing.status === "adopted") {
      throw new ApiError(409, `${listing.name} has already been adopted.`);
    }

    const existing = await AdoptionApplication.findOne({
      listingId: listing._id,
      applicantId: req.user._id
    });
    if (existing) {
      throw new ApiError(409, `You've already applied for ${listing.name}.`);
    }

    const application = await AdoptionApplication.create({
      listingId: listing._id,
      applicantId: req.user._id,
      clinicId: req.user.clinicId,
      message: stripProtected(req.body).message || ""
    });

    await syncListingStatus(listing);

    // Confirm to the applicant, and let the clinic's staff know there's
    // something to review.
    notify.applicationReceived({ applicant: req.user, listing });
    const staff = await User.find(
      { ...clinicFilter(req.user), role: { $in: ["vet", "admin"] } },
      "email"
    ).lean();
    notify.newApplicationForStaff({
      recipients: staff.map((s) => s.email).filter(Boolean),
      applicant: req.user,
      listing
    });

    res.status(201).json({
      application: shapeApplication(application, { listing, applicant: req.user })
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/adoptions/applications/:id — an owner withdrawing their own
async function withdrawApplication(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Application not found.");
    const application = await AdoptionApplication.findById(req.params.id);
    assertSameClinic(req.user, application, "Application");

    if (String(application.applicantId) !== String(req.user._id)) {
      throw new ApiError(404, "Application not found.");
    }
    if (application.status !== "applied") {
      throw new ApiError(409, "That application has already been decided.");
    }

    const listing = await AdoptionListing.findById(application.listingId);
    await AdoptionApplication.deleteOne({ _id: application._id });
    if (listing) await syncListingStatus(listing);

    res.json({ ok: true, id: application._id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/adoptions/applications
 * Role-aware: staff get the clinic's review queue, owners get their own
 * applications so they can track them.
 */
async function listApplications(req, res, next) {
  try {
    const filter = clinicFilter(req.user);
    if (req.user.role === "owner") filter.applicantId = req.user._id;
    if (["applied", "approved", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const applications = await AdoptionApplication.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const [listings, applicants] = await Promise.all([
      AdoptionListing.find({ _id: { $in: applications.map((a) => a.listingId) } }).lean(),
      req.user.role === "owner"
        ? []
        : User.find(
            { _id: { $in: applications.map((a) => a.applicantId) } },
            "name email phone"
          ).lean()
    ]);

    const listingById = new Map(listings.map((l) => [String(l._id), l]));
    const applicantById = new Map(applicants.map((a) => [String(a._id), a]));

    res.json({
      applications: applications.map((a) =>
        shapeApplication(a, {
          listing: listingById.get(String(a.listingId)),
          applicant: applicantById.get(String(a.applicantId))
        })
      )
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/adoptions/applications/:id — [vet, admin] approve or reject.
// Approving marks the listing adopted and rejects everyone else waiting on it.
async function decideApplication(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Application not found.");
    const application = await AdoptionApplication.findById(req.params.id);
    assertSameClinic(req.user, application, "Application");

    const { status } = stripProtected(req.body);
    if (status !== "approved" && status !== "rejected") {
      throw new ApiError(400, "Set status to approved or rejected.");
    }

    const listing = await AdoptionListing.findById(application.listingId);
    if (!listing) throw new ApiError(404, "Listing not found.");

    if (status === "approved" && listing.status === "adopted" && application.status !== "approved") {
      throw new ApiError(409, `${listing.name} has already been adopted.`);
    }

    application.status = status;
    await application.save();

    if (status === "approved") {
      // Everyone else waiting on this animal is turned down. They were told an
      // application was under review, so they get told the outcome too.
      const alsoWaiting = await AdoptionApplication.find({
        listingId: listing._id,
        _id: { $ne: application._id },
        status: "applied"
      }).lean();

      if (alsoWaiting.length) {
        await AdoptionApplication.updateMany(
          { _id: { $in: alsoWaiting.map((a) => a._id) } },
          { $set: { status: "rejected" } }
        );

        const others = await User.find(
          { _id: { $in: alsoWaiting.map((a) => a.applicantId) } },
          "name email"
        ).lean();
        for (const other of others) {
          notify.applicationDecided({ applicant: other, listing, status: "rejected" });
        }
      }
    }

    await syncListingStatus(listing);

    const applicant = await User.findById(application.applicantId, "name email phone").lean();
    if (applicant) notify.applicationDecided({ applicant, listing, status });

    res.json({ application: shapeApplication(application, { listing, applicant }) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listListings, getListing, createListing, updateListing, removeListing,
  apply, withdrawApplication, listApplications, decideApplication, syncListingStatus
};
