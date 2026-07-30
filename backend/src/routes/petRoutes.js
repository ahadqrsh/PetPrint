const { Router } = require("express");
const { z } = require("zod");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const pets = require("../controllers/petController");
const records = require("../controllers/recordController");
const exports_ = require("../controllers/exportController");

const router = Router();
router.use(requireAuth, requireClinic);

const speciesEnum = z.enum(["cat", "dog"], {
  errorMap: () => ({ message: "Species must be cat or dog." })
});

const petBase = {
  name: z.string().min(1, "Give the pet a name."),
  species: speciesEnum,
  sex: z.enum(["male", "female"]),
  breed: z.string().optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  allergies: z.array(z.string().min(1)).optional(),
  chronicConditions: z.array(z.string().min(1)).optional(),
  photoUrl: z.string().optional(),
  ownerId: z.string().optional() // ignored for owners; required for staff
};

const createPetSchema = z.object(petBase);
const updatePetSchema = z.object({
  name: petBase.name.optional(),
  species: speciesEnum.optional(),
  sex: z.enum(["male", "female"]).optional(),
  breed: z.string().optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  allergies: z.array(z.string().min(1)).optional(),
  chronicConditions: z.array(z.string().min(1)).optional(),
  photoUrl: z.string().optional(),
  ownerId: z.string().optional()
});

const recordSchema = z.object({
  visitDate: z.coerce.date().optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional()
});

// Static segment first so "code" is never read as an id.
router.get("/code/:petCode", pets.getPetByCode);

router.get("/", pets.listPets);
router.post("/", validate(createPetSchema), pets.createPet);
router.get("/:id", pets.getPet);
router.put("/:id", requireRole("vet", "admin"), validate(updatePetSchema), pets.updatePet);
router.delete("/:id", requireRole("admin"), pets.removePet);
router.get("/:id/qrcode", pets.getPetQrCode);
router.get("/:id/record.pdf", exports_.petHistoryPdf);

router.get("/:id/records", records.listRecords);
router.post("/:id/records", requireRole("vet", "admin"), validate(recordSchema), records.createRecord);

module.exports = router;
