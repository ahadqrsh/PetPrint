const User = require("../models/User");
const Clinic = require("../models/Clinic");
const bcrypt = require("bcryptjs");
const { signAccessToken } = require("../utils/tokens");
const { generateToken, hashToken } = require("../utils/secureToken");
const { ApiError } = require("../middleware/errorHandler");
const { stripProtected } = require("../utils/scope");
const notify = require("../services/emailService");
const loginGuard = require("../services/loginGuard");

const RESET_TOKEN_HOURS = 1;
const VERIFY_TOKEN_HOURS = 24;

function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const first = (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0].trim();
  return first.replace(/\/$/, "");
}

async function issueVerification(user) {
  const { raw, hash } = generateToken();
  user.emailVerifyTokenHash = hash;
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TOKEN_HOURS * 3600000);
  await user.save();
  return raw;
}

// POST /api/auth/register-clinic — bootstraps a new clinic + its first admin
async function registerClinic(req, res, next) {
  try {
    const body = stripProtected(req.body);
    const clinicDoc = await Clinic.create({
      name: body.clinicName,
      type: body.clinicType === "ngo" ? "ngo" : "private",
      address: body.address || "",
      phone: body.phone || ""
    });

    const passwordHash = await bcrypt.hash(body.password, 10);
    const adminDoc = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "admin",
      clinicId: clinicDoc._id
    });

    const rawToken = await issueVerification(adminDoc);
    notify.welcomeClinic({ user: adminDoc, clinic: clinicDoc });
    notify.sendVerificationEmail({ user: adminDoc, rawToken, appUrl: appUrl() });

    res.status(201).json({
      token: signAccessToken(adminDoc),
      user: adminDoc.toSafeJSON(),
      clinic: clinicDoc
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/register — a pet owner joining an EXISTING clinic
async function register(req, res, next) {
  try {
    // clinicId is read directly from the raw body, deliberately BEFORE
    // stripProtected(). This is the one endpoint in the app where clinicId is
    // legitimately a client-supplied field: registration happens before any
    // session exists, so there is no authenticated user to derive it from —
    // it's the clinic the person picked from the public dropdown. Every OTHER
    // endpoint in the app must keep stripping it (a logged-in client must
    // never be able to set their own clinicId), so stripProtected() itself is
    // unchanged — it's still applied to the rest of the body below, just not
    // relied on for this one field.
    const { clinicId } = req.body;
    const body = stripProtected(req.body);

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) throw new ApiError(400, "Choose a clinic to register with.");

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "owner",
      clinicId: clinic._id,
      phone: body.phone || ""
    });

    const rawToken = await issueVerification(user);
    notify.welcomeOwner({ user, clinic });
    notify.sendVerificationEmail({ user, rawToken, appUrl: appUrl() });

    res.status(201).json({ token: signAccessToken(user), user: user.toSafeJSON() });
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, "An account with that email already exists at this clinic."));
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const invalid = () => new ApiError(401, "Incorrect email or password.");

    const user = await User.findOne({ email: String(email).toLowerCase().trim() })
      .select("+resetTokenHash +resetTokenExpires");
    if (!user) throw invalid();

    if (loginGuard.isLocked(user)) {
      const mins = loginGuard.minutesRemaining(user);
      throw new ApiError(423, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }

    const correct = await user.checkPassword(password);
    if (!correct) {
      Object.assign(user, loginGuard.recordFailedAttempt(user));
      await user.save();
      if (loginGuard.isLocked(user)) {
        const mins = loginGuard.minutesRemaining(user);
        throw new ApiError(423, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      }
      throw invalid();
    }

    if (!user.isActive) {
      throw new ApiError(403, "This account has been deactivated. Contact your clinic administrator.");
    }

    Object.assign(user, loginGuard.clearAttempts());
    await user.save();

    res.json({ token: signAccessToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

// ---- Password reset --------------------------------------------------------

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    const genericResponse = { message: "If an account exists for that email, a reset link has been sent." };

    if (!user) {
      console.log(`[auth] password reset requested for unregistered email: ${email}`);
      return res.json(genericResponse);
    }

    const { raw, hash } = generateToken();
    user.resetTokenHash = hash;
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_HOURS * 3600000);
    await user.save();

    notify.sendPasswordResetEmail({ user, rawToken: raw, appUrl: appUrl() });

    res.json(genericResponse);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const hash = hashToken(String(token || ""));

    const user = await User.findOne({
      resetTokenHash: hash,
      resetTokenExpires: { $gt: new Date() }
    }).select("+resetTokenHash +resetTokenExpires");

    if (!user) throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    Object.assign(user, loginGuard.clearAttempts());
    await user.save();

    res.json({ token: signAccessToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
}

// ---- Email verification -----------------------------------------------

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    const hash = hashToken(String(token || ""));

    const user = await User.findOne({
      emailVerifyTokenHash: hash,
      emailVerifyExpires: { $gt: new Date() }
    }).select("+emailVerifyTokenHash +emailVerifyExpires");

    if (!user) throw new ApiError(400, "This verification link is invalid or has expired.");

    user.emailVerified = true;
    user.emailVerifyTokenHash = null;
    user.emailVerifyExpires = null;
    await user.save();

    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    if (req.user.emailVerified) throw new ApiError(400, "This email is already verified.");
    const rawToken = await issueVerification(req.user);
    notify.sendVerificationEmail({ user: req.user, rawToken, appUrl: appUrl() });
    res.json({ sent: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerClinic, register, login, me,
  forgotPassword, resetPassword,
  verifyEmail, resendVerification
};