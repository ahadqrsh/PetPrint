const { ApiError } = require("./errorHandler");

// Runs after requireAuth on every tenant-scoped route.
// Rejects accounts with no clinic before a controller can build a filter
// with clinicId: undefined (which would match across tenants).
function requireClinic(req, res, next) {
  if (!req.user) return next(new ApiError(401, "Authentication required."));
  if (!req.user.clinicId) {
    return next(new ApiError(403, "Your account isn't attached to a clinic."));
  }
  req.clinicId = req.user.clinicId;
  next();
}

module.exports = { requireClinic };
