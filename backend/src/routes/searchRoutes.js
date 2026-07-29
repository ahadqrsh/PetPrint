const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireClinic } = require("../middleware/tenant");
const { search } = require("../controllers/searchController");

const router = Router();
router.get("/", requireAuth, requireClinic, search);

module.exports = router;
