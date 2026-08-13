const AuditLog = require("../models/AuditLog");
const { clinicFilter } = require("../utils/scope");

// GET /api/audit-log — [admin] paginated, newest first, optional action filter
async function listAuditLog(req, res, next) {
  try {
    const filter = clinicFilter(req.user);
    if (req.query.action) filter.action = req.query.action;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      entries: entries.map((e) => ({
        id: e._id,
        action: e.action,
        actorName: e.actorName,
        actorRole: e.actorRole,
        detail: e.detail,
        createdAt: e.createdAt
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAuditLog };
