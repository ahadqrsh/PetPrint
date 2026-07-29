const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/vetController");

const router = Router();

// Every route here: authenticated + attached to a clinic + admin.
router.use(requireAuth, requireClinic, requireRole("admin"));

const createSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().optional()
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional()
});

router.get("/", ctrl.listVets);
router.post("/", validate(createSchema), ctrl.createVet);
router.put("/:id", validate(updateSchema), ctrl.updateVet);
router.delete("/:id", ctrl.removeVet);

module.exports = router;
