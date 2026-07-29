const { ApiError } = require("./errorHandler");

// requireRole("admin"), requireRole("vet", "admin") ... always after requireAuth.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, "Authentication required."));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You don't have permission to do that."));
    }
    next();
  };
}

module.exports = { requireRole };
