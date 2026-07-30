const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const { singleImage } = require("../middleware/upload");
const ctrl = require("../controllers/adoptionController");

const router = Router();
router.use(requireAuth, requireClinic);

const speciesEnum = z.enum(["cat", "dog"], {
  errorMap: () => ({ message: "Species must be cat or dog." })
});

// Multipart bodies arrive as strings, so these schemas run after Multer.
const createSchema = z.object({
  name: z.string().min(1, "Give the animal a name."),
  species: speciesEnum,
  breed: z.string().optional(),
  description: z.string().max(2000).optional()
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  species: speciesEnum.optional(),
  breed: z.string().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["available", "pending"]).optional()
});

const applySchema = z.object({
  message: z.string().max(2000).optional()
});

const decideSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Set status to approved or rejected." })
  })
});

// Static "applications" paths must be declared before "/:id".
router.get("/applications", ctrl.listApplications);
router.put(
  "/applications/:id",
  requireRole("vet", "admin"),
  validate(decideSchema),
  ctrl.decideApplication
);
router.delete("/applications/:id", requireRole("owner"), ctrl.withdrawApplication);

router.get("/", ctrl.listListings);
router.post(
  "/",
  requireRole("vet", "admin"),
  singleImage("image"),
  validate(createSchema),
  ctrl.createListing
);

router.get("/:id", ctrl.getListing);
router.put(
  "/:id",
  requireRole("vet", "admin"),
  singleImage("image"),
  validate(updateSchema),
  ctrl.updateListing
);
router.delete("/:id", requireRole("vet", "admin"), ctrl.removeListing);

router.post("/:id/apply", requireRole("owner"), validate(applySchema), ctrl.apply);

module.exports = router;
