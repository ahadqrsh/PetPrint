const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ApiError } = require("./errorHandler");

// Verifies the Bearer token and attaches a fresh user record to req.user.
// Role and clinicId are always read from the DB record, never from the client.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Authentication required.");

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new ApiError(401, "Session expired or invalid. Please log in again.");
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, "Account no longer exists.");

    req.user = user; // full mongoose doc; controllers use req.user.role / clinicId
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
