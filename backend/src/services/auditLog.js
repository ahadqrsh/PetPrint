const AuditLog = require("../models/AuditLog");

/**
 * Fire-and-forget, deliberately — same principle as email in this app.
 * Recording that something happened must never be the reason the thing
 * itself fails: a login that succeeds shouldn't 500 because the audit write
 * had a hiccup.
 *
 * Call as: logAudit(req.user, "vet.deactivated", { vetId, vetName }, req)
 * The req parameter is optional and only used to capture an IP.
 */
function logAudit(actor, action, detail = {}, req = null) {
  const entry = {
    clinicId: actor?.clinicId,
    actorId: actor?._id || null,
    actorName: actor?.name || "",
    actorRole: actor?.role || "",
    action,
    detail,
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || ""
  };

  if (!entry.clinicId) {
    // Can happen for pre-auth events (a failed login for an email that
    // doesn't exist has no clinic to attribute it to) — log to console
    // instead of silently dropping it, but don't write a malformed document.
    console.log(`[audit:no-clinic] action=${action} detail=${JSON.stringify(detail)}`);
    return;
  }

  AuditLog.create(entry).catch((err) => {
    console.error(`[audit:failed] action=${action}: ${err.message}`);
  });
}

module.exports = { logAudit };
