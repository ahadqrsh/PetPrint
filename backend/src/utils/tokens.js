const jwt = require("jsonwebtoken");

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role }, // role in payload is informational only
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

module.exports = { signAccessToken };
