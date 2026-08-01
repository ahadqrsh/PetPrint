const { Router } = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/vaccinationController");

// Mounted twice in app.js: /api/vaccines (catalogue) and
// /api/vaccinations (due list + single-record operations).
const catalogueRouter = Router();
catalogueRouter.get("/", requireAuth, requireClinic, ctrl.listVaccineTypes);

const recordsRouter = Router();
recordsRouter.use(requireAuth, requireClinic);
recordsRouter.get("/due", ctrl.listDue);
recordsRouter.delete("/:id", requireRole("vet", "admin"), ctrl.removeVaccination);

const recordSchema = z.object({
  vaccineTypeId: z.string().min(1, "Choose a vaccine."),
  dateGiven: z.coerce.date().optional(),
  doseSequence: z.coerce.number().int().min(1).optional(),
  batchNumber: z.string().max(60).optional(),
  site: z.string().max(60).optional(),
  notes: z.string().max(1000).optional()
});

module.exports = { catalogueRouter, recordsRouter, recordSchema, ctrl };
