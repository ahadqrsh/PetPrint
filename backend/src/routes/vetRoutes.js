const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/vetController");

const router = Router();
router.use(requireAuth, requireClinic, requireRole("admin"));

const createVetSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
  phone: z.string().optional()
});

router.get("/", ctrl.listVets);
router.post("/", validate(createVetSchema), ctrl.createVet);
router.patch("/:id/deactivate", ctrl.deactivateVet);
router.patch("/:id/activate", ctrl.activateVet);

module.exports = router;
