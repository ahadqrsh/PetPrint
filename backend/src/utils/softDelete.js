/**
 * Soft-delete as a schema plugin, applied to Pet and MedicalRecord.
 *
 * Deleting a pet or a visit record doesn't remove it — it sets `deletedAt`
 * and the document stays in the database, excluded from normal views but
 * recoverable from Trash. A hard delete on clinical data is rarely
 * reversible and rarely what anyone actually wanted; "I clicked the wrong
 * one" should be a correctable mistake, not a support ticket.
 *
 * The exclusion is enforced at the schema level via a pre-find hook, rather
 * than requiring every list/search query in every controller to remember to
 * add `deletedAt: null` by hand. One place to get right, not a dozen.
 *
 * Known limitation: this hook covers find/findOne/findOneAndUpdate — it does
 * NOT cover .aggregate() pipelines, which Mongoose handles as a separate
 * hook entirely. If aggregation-based reporting is added later, it needs its
 * own explicit `{ $match: { deletedAt: null } }` stage.
 */

function shouldInjectDeletedAtFilter(existingFilter) {
  // Only apply the default when the caller hasn't already asked about
  // deletedAt explicitly — that's how an intentional Trash-view query
  // (`{ deletedAt: { $ne: null } }`) opts out cleanly.
  return !Object.prototype.hasOwnProperty.call(existingFilter, "deletedAt");
}

/** The second, more ergonomic opt-out: Model.find(...).setOptions({ includeDeleted: true }) */
function isIncludeDeletedRequested(queryOptions) {
  return Boolean(queryOptions && queryOptions.includeDeleted);
}

function applySoftDelete(schema) {
  schema.add({ deletedAt: { type: Date, default: null, index: true } });

  schema.pre(/^find/, function (next) {
    if (isIncludeDeletedRequested(this.getOptions())) return next();
    if (shouldInjectDeletedAtFilter(this.getFilter())) {
      this.where({ deletedAt: null });
    }
    next();
  });

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
  };

  schema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
  };
}

module.exports = { applySoftDelete, shouldInjectDeletedAtFilter, isIncludeDeletedRequested };
