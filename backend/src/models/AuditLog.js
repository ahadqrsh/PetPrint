const mongoose = require("mongoose");

/**
 * A record of who did what to sensitive data, and when. Answers the question
 * every clinic owner eventually asks: "who exported our client list?" or
 * "who deleted that pet's record?"
 *
 * Deliberately append-only — nothing in this app ever edits or deletes an
 * AuditLog document. An audit trail that can be quietly edited isn't one.
 *
 * clinicId is stored even though the acting user also carries it, so a log
 * entry remains queryable and correct even if the user is later deleted.
 */
const auditLogSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "" }, // snapshotted so it survives the actor being deleted
    actorRole: { type: String, default: "" },

    action: {
      type: String,
      required: true,
      enum: [
        "login.success",
        "login.failed",
        "login.locked",
        "password.reset_requested",
        "password.reset_completed",
        "vet.deactivated",
        "vet.activated",
        "pet.deleted",
        "pet.restored",
        "record.deleted",
        "record.restored",
        "export.csv",
        "export.pdf",
        "ai.draft_used"
      ],
      index: true
    },

    // Loosely typed on purpose: different actions carry different context
    // (a pet's name, an export's row count, an IP address) and forcing a
    // single rigid shape would mean constantly changing the schema.
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: "" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

auditLogSchema.index({ clinicId: 1, createdAt: -1 });
auditLogSchema.index({ clinicId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
