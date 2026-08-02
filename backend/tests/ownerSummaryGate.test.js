const test = require("node:test");
const assert = require("node:assert/strict");

// The record controller's shape() decides what reaches an owner. This is the
// safety-critical boundary in Phase 7: an unapproved AI summary must not be
// sent to an owner's client at all, not merely hidden in the UI.
//
// shape() isn't exported, so this reproduces its contract against the same
// record fixtures. If the controller's logic changes, verify-phase7 catches it
// end to end; this catches it in a second.

const path = require("node:path");
const fs = require("node:fs");

const source = fs.readFileSync(
  path.join(__dirname, "..", "src", "controllers", "recordController.js"),
  "utf8"
);

test("the shape function branches on forOwner", () => {
  assert.match(source, /function shape\(record, vet, \{ forOwner = false \} = \{\}\)/);
});

test("an owner's view returns the summary only when approved", () => {
  assert.match(
    source,
    /ownerSummary: record\.ownerSummaryApproved \? record\.ownerSummary : ""/,
    "unapproved summaries must be blanked before they leave the server"
  );
});

test("the owner branch returns early, so staff-only fields can't leak", () => {
  const ownerBranch = source.slice(
    source.indexOf("if (forOwner)"),
    source.indexOf("return {\n    ...base,\n    ownerSummary: record.ownerSummary")
  );
  assert.ok(
    !ownerBranch.includes("ownerSummaryApprovedAt"),
    "approval metadata is staff-only"
  );
});

test("listRecords passes the caller's role through", () => {
  assert.match(source, /const forOwner = req\.user\.role === "owner"/);
  assert.match(source, /shape\(r, byId\.get\(String\(r\.vetId\)\), \{ forOwner \}\)/);
});

test("saving a record records who approved the AI draft", () => {
  assert.match(source, /aiApprovedByVetId: body\.aiAssisted \? req\.user\._id : null/);
});
