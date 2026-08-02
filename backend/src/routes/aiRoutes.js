const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/aiController");

// /api/ai — status only. The drafting endpoints hang off /pets and /records,
// because a draft is always about a specific animal or a specific visit.
const statusRouter = Router();
statusRouter.get("/status", requireAuth, ctrl.status);

const draftSchema = z.object({
  observations: z
    .string()
    .min(15, "Write a little more detail for the assistant to work from.")
    .max(4000, "Keep observations under 4000 characters.")
});

const ownerSummarySchema = z.object({
  summary: z.string().max(4000).optional(),
  approved: z.boolean().optional()
});

// Mounted onto the existing pet and record routers so scoping middleware
// already applied there continues to apply here.
function attachPetAiRoutes(router) {
  router.post(
    "/:id/ai/draft-record",
    requireRole("vet", "admin"),
    validate(draftSchema),
    ctrl.draftRecord
  );
}

function attachRecordAiRoutes(router) {
  router.post("/:id/ai/owner-summary", requireRole("vet", "admin"), ctrl.draftOwnerSummary);
  router.put(
    "/:id/owner-summary",
    requireRole("vet", "admin"),
    validate(ownerSummarySchema),
    ctrl.saveOwnerSummary
  );
}

module.exports = { statusRouter, attachPetAiRoutes, attachRecordAiRoutes, requireClinic };
