const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const ctrl = require("../controllers/authController");

const router = Router();

const password = z.string().min(8, "Password must be at least 8 characters.");

const registerClinicSchema = z.object({
  clinic: z.object({
    name: z.string().min(2),
    type: z.enum(["ngo", "private"]),
    address: z.string().optional(),
    phone: z.string().optional()
  }),
  admin: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password,
    phone: z.string().optional()
  })
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password,
  phone: z.string().optional(),
  clinicId: z.string().min(1, "Please choose a clinic.")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/register-clinic", validate(registerClinicSchema), ctrl.registerClinic);
router.post("/register", validate(registerSchema), ctrl.register);
router.post("/login", validate(loginSchema), ctrl.login);
router.get("/me", requireAuth, ctrl.me);

module.exports = router;
