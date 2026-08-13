const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/rbac");
const { requireClinic } = require("../middleware/tenant");
const { listAuditLog } = require("../controllers/auditController");

const router = Router();
router.get("/", requireAuth, requireClinic, requireRole("admin"), listAuditLog);
module.exports = router;
