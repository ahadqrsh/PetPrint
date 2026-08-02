const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/recordController");
const { attachRecordAiRoutes } = require("./aiRoutes");

const router = Router();
router.use(requireAuth, requireClinic);

const updateSchema = z.object({
  visitDate: z.coerce.date().optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  aiAssisted: z.boolean().optional()
});

router.put("/:id", requireRole("vet", "admin"), validate(updateSchema), ctrl.updateRecord);
router.delete("/:id", requireRole("admin"), ctrl.removeRecord);

attachRecordAiRoutes(router);

module.exports = router;
