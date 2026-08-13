const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const ctrl = require("../controllers/trashController");

const router = Router();
router.use(requireAuth, requireClinic, requireRole("admin"));

router.get("/pets", ctrl.listDeletedPets);
router.post("/pets/:id/restore", ctrl.restorePet);
router.get("/records", ctrl.listDeletedRecords);
router.post("/records/:id/restore", ctrl.restoreRecord);

module.exports = router;
