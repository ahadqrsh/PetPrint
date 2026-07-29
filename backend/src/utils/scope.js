const { ApiError } = require("../middleware/errorHandler");

/**
 * Tenant scoping. Every read and write goes through one of these so a query
 * can never accidentally reach across clinics.
 *
 * Rules:
 *   admin / vet -> everything in their own clinic
 *   owner       -> only rows in their clinic that also belong to them
 *
 * The user argument is always req.user, which auth middleware loads fresh
 * from the database — never from the request body.
 */

function clinicIdOf(user) {
  if (!user || !user.clinicId) {
    throw new ApiError(403, "Your account isn't attached to a clinic.");
  }
  return user.clinicId;
}

/** Filter for staff-level resources (vets, clinic settings, exports). */
function clinicFilter(user) {
  return { clinicId: clinicIdOf(user) };
}

/**
 * Filter for resources an owner may see a slice of.
 * ownerField names the column that points at the owning user (pets use
 * "ownerId", adoption applications use "applicantId").
 */
function scopedFilter(user, { ownerField = "ownerId" } = {}) {
  const filter = { clinicId: clinicIdOf(user) };
  if (user.role === "owner") filter[ownerField] = user._id;
  return filter;
}

/** True when a loaded document belongs to this user's clinic. */
function sameClinic(user, doc) {
  if (!doc || !doc.clinicId) return false;
  return String(doc.clinicId) === String(clinicIdOf(user));
}

/**
 * Guard a document loaded by id. Cross-tenant hits return 404, not 403 —
 * a 403 would confirm that the id exists in some other clinic.
 */
function assertSameClinic(user, doc, label = "Record") {
  if (!doc || !sameClinic(user, doc)) {
    throw new ApiError(404, `${label} not found.`);
  }
  return doc;
}

/** Fields a client is never allowed to set directly. */
const PROTECTED_FIELDS = ["role", "clinicId", "passwordHash", "_id", "id"];

function stripProtected(body = {}) {
  const clean = { ...body };
  for (const field of PROTECTED_FIELDS) delete clean[field];
  return clean;
}

module.exports = {
  clinicFilter,
  scopedFilter,
  sameClinic,
  assertSameClinic,
  stripProtected,
  PROTECTED_FIELDS
};
