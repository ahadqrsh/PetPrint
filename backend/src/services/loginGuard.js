/**
 * Per-account lockout after repeated failed passwords.
 *
 * Deliberately separate from the IP-based rate limiter: the limiter stops one
 * IP hammering many accounts, this stops many IPs (or a botnet) hammering one
 * account. Pure functions over a plain user-shaped object, so the rules can be
 * tested without touching Mongoose or a database.
 */

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function isLocked(user, now = new Date()) {
  return Boolean(user.lockUntil && user.lockUntil > now);
}

function minutesRemaining(user, now = new Date()) {
  if (!isLocked(user, now)) return 0;
  return Math.ceil((user.lockUntil.getTime() - now.getTime()) / 60000);
}

/** Call after a wrong password. Returns the fields to persist on the user. */
function recordFailedAttempt(user, now = new Date()) {
  const attempts = (user.failedLoginAttempts || 0) + 1;

  if (attempts >= MAX_ATTEMPTS) {
    return {
      failedLoginAttempts: 0,
      lockUntil: new Date(now.getTime() + LOCK_MINUTES * 60000)
    };
  }
  return { failedLoginAttempts: attempts, lockUntil: user.lockUntil || null };
}

/** Call after a correct password. Clears any accumulated attempts or lock. */
function clearAttempts() {
  return { failedLoginAttempts: 0, lockUntil: null };
}

module.exports = { MAX_ATTEMPTS, LOCK_MINUTES, isLocked, minutesRemaining, recordFailedAttempt, clearAttempts };
