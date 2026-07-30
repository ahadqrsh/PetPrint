const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/clinicController");
const { clinicCsv } = require("../controllers/exportController");

// Mounted twice in app.js: /api/clinics (public list) and /api/clinic (mine).
const publicRouter = Router();
publicRouter.get("/", ctrl.listClinics);

const myRouter = Router();
const updateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  phone: z.string().optional()
});

// Static path first so "export.csv" isn't read as something else.
myRouter.get("/export.csv", requireAuth, requireClinic, requireRole("admin"), clinicCsv);

myRouter.get("/", requireAuth, requireClinic, ctrl.getMyClinic);
myRouter.put("/", requireAuth, requireClinic, requireRole("admin"), validate(updateSchema), ctrl.updateMyClinic);

module.exports = { publicRouter, myRouter };
