const rateLimit = require("express-rate-limit");

/**
 * IP-based limits, deliberately separate from the per-account lockout in
 * loginGuard.js: this stops one IP hammering many accounts (or brute-forcing
 * one), the lockout stops many IPs hammering a single account.
 *
 * Every limiter shares the same JSON error shape as the rest of the API
 * ({ error: { message } }) so the frontend doesn't need special-case handling
 * for a 429.
 */
function limiterFor(message) {
  return (windowMinutes, max) =>
    rateLimit({
      windowMs: windowMinutes * 60000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({ error: { message } });
      }
    });
}

const loginLimiter = limiterFor(
  "Too many sign-in attempts from this network. Try again in a few minutes."
)(15, 20);

const registerLimiter = limiterFor(
  "Too many accounts created from this network recently. Try again later."
)(60, 10);

const forgotPasswordLimiter = limiterFor(
  "Too many reset requests. Try again in a few minutes."
)(15, 5);

const resendVerificationLimiter = limiterFor(
  "Too many verification emails requested. Try again later."
)(60, 5);

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter, resendVerificationLimiter };
