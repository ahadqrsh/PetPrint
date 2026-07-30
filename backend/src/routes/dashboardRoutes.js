const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireClinic } = require("../middleware/tenant");
const { stats } = require("../controllers/dashboardController");

const router = Router();
router.get("/stats", requireAuth, requireClinic, stats);

module.exports = router;
