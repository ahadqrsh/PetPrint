const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/authController");
const {
  loginLimiter, registerLimiter, forgotPasswordLimiter, resendVerificationLimiter
} = require("../middleware/rateLimit");

const router = Router();

const passwordRule = z.string().min(8, "Use at least 8 characters.");

const registerClinicSchema = z.object({
  clinicName: z.string().min(1, "Clinic name is required."),
  clinicType: z.enum(["private", "ngo"]).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().min(1, "Your name is required."),
  email: z.string().email("Enter a valid email."),
  password: passwordRule
});

const registerSchema = z.object({
  clinicId: z.string().min(1, "Choose a clinic."),
  name: z.string().min(1, "Your name is required."),
  email: z.string().email("Enter a valid email."),
  password: passwordRule,
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password.")
});

const forgotPasswordSchema = z.object({ email: z.string().email("Enter a valid email.") });

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Missing reset token."),
  password: passwordRule
});

const verifyEmailSchema = z.object({ token: z.string().min(1, "Missing verification token.") });

router.post("/register-clinic", registerLimiter, validate(registerClinicSchema), ctrl.registerClinic);
router.post("/register", registerLimiter, validate(registerSchema), ctrl.register);
router.post("/login", loginLimiter, validate(loginSchema), ctrl.login);
router.get("/me", requireAuth, ctrl.me);

router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), ctrl.resetPassword);

router.post("/verify-email", validate(verifyEmailSchema), ctrl.verifyEmail);
router.post("/resend-verification", requireAuth, resendVerificationLimiter, ctrl.resendVerification);

module.exports = router;
