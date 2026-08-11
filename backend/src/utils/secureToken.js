const crypto = require("crypto");

/**
 * The token emailed to the person is random and unguessable. Only its SHA-256
 * hash is stored — the same principle as never storing a plain password — so
 * a database leak alone can't be used to reset anyone's account or forge a
 * verification.
 */
function generateToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = { generateToken, hashToken };
