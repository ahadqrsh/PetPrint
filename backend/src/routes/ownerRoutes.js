const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const { listOwners } = require("../controllers/ownerController");

const router = Router();
router.get("/", requireAuth, requireClinic, requireRole("vet", "admin"), listOwners);

module.exports = router;
