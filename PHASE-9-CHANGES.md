# Phase 9 — Data safety & audit

Same structure as Phase 8: new files first (safe), then reviewed
reconstructions, then small additive instructions for files I don't have
current copies of. Nothing here was blind-overwritten — I caught myself about
to ship an incomplete `package.json` again while assembling this and pulled
it before it went out; see §4.

---

## 1. New files — safe to add directly (13)

```
backend/src/models/AuditLog.js
backend/src/services/auditLog.js
backend/src/controllers/auditController.js
backend/src/routes/auditRoutes.js
backend/src/utils/softDelete.js
backend/src/controllers/trashController.js
backend/src/routes/trashRoutes.js
backend/scripts/backup.js
backend/tests/softDelete.test.js

frontend/app/(app)/audit-log/page.js
frontend/app/(app)/trash/page.js
```

## 2. Reconstructed files — high confidence, review before replacing (2)

```
backend/src/controllers/authController.js
backend/src/controllers/vetController.js
```

These are the *same* files from Phase 8's fix, with audit-log calls added at
each sensitive point (login success/fail/lockout, password reset, vet
deactivate/activate). Nothing else changed. Tested against a fake in-memory
model covering all 9 checks, including a direct regression check that
today's `clinicId` bug fix still holds after this edit — see §5.

## 3. New routes to mount in `app.js`

Add these two lines wherever your other `app.use("/api/...")` lines are:

```js
app.use("/api/audit-log", require("./routes/auditRoutes"));
app.use("/api/trash", require("./routes/trashRoutes"));
```

## 4. New dependency — do NOT replace `package.json`, just install

```bash
cd backend
npm install archiver@^7.0.1
```

**Pin the version exactly as shown.** `archiver@8` switched to a pure ESM
module with a completely different API (`new ZipArchive()` instead of the
classic `archiver('zip', options)` factory function most tutorials still
show) — I hit this myself while testing `backup.js` and it would have
crashed the very first time the script ran in production. `7.0.1` is the
last version with the classic API `backup.js` is written against.

`cloudinary` is already a dependency from Phase 4 — nothing new there.

---

## 5. Soft-delete — additive changes to your Pet and MedicalRecord models

I don't have your current `Pet.js` / `MedicalRecord.js` from before the
session reset, so rather than reconstruct them (which is exactly how today's
`clinicId` bug happened), here's the precise, minimal change to make by hand.

**In both `backend/src/models/Pet.js` and `backend/src/models/MedicalRecord.js`:**

Add this import near the top:
```js
const { applySoftDelete } = require("../utils/softDelete");
```

Find the line where the schema is compiled into a model — it looks like:
```js
module.exports = mongoose.model("Pet", petSchema);
```
(or `MedicalRecord`, `medicalRecordSchema` in the other file)

Add **one line directly above it**:
```js
applySoftDelete(petSchema);          // or: applySoftDelete(medicalRecordSchema);
module.exports = mongoose.model("Pet", petSchema);
```

That's the entire model-side change. It adds a `deletedAt` field and a
pre-find hook that automatically excludes soft-deleted documents from every
existing `find`/`findOne` call in your app — **your controllers' list and
search queries need zero changes**, they'll simply stop seeing deleted
documents once this is applied. Tested with 11 unit tests against the real
registered Mongoose hook (not a re-implementation) — see
`tests/softDelete.test.js`.

## 6. Soft-delete — the one line that must change in your delete handlers

In `backend/src/controllers/petController.js`, find wherever a pet is
currently deleted — it'll look something like:
```js
await Pet.deleteOne({ _id: pet._id });
```
or
```js
await Pet.findByIdAndDelete(req.params.id);
```

Replace whichever pattern you have with:
```js
await pet.softDelete();
```
(where `pet` is the already-fetched Mongoose document — if your handler
currently deletes by ID directly without fetching the document first, fetch
it first: `const pet = await Pet.findById(req.params.id);`)

While you're in there, add an audit log call right after:
```js
const { logAudit } = require("../services/auditLog"); // add this import at the top
// ...
logAudit(req.user, "pet.deleted", { petId: pet._id, petName: pet.name }, req);
```

**Same pattern in `backend/src/controllers/recordController.js`** for
`record.softDelete()` and `logAudit(req.user, "record.deleted", { recordId: record._id, petId: record.petId }, req)`.

## 7. Optional: audit logging on exports

In `backend/src/controllers/exportController.js`, after a CSV or PDF export
succeeds, one line each:
```js
logAudit(req.user, "export.csv", { rows: rowCount }, req);
logAudit(req.user, "export.pdf", { petId: pet._id }, req);
```
Not required for the feature to work — CSV/PDF export function identically
without this — but it's the one thing a clinic owner will eventually ask
"who did this?" about, so worth the two lines when you're next in that file.

## 8. Trash and Audit Log links in your nav

Wherever your admin nav items are defined (likely `components/nav-items.js`
per earlier phases), add two entries alongside your other admin-only links:
```js
{ href: "/audit-log", label: "Activity log", roles: ["admin"] },
{ href: "/trash", label: "Trash", roles: ["admin"] }
```

---

## 9. Backups — this is application-level, not a substitute for Atlas's own

MongoDB Atlas's free (M0) tier has **no built-in automated backups at all** —
that's a paid-tier feature. `scripts/backup.js` is the practical stopgap: it
exports every collection to JSON, zips it, and uploads it to your existing
Cloudinary account as a raw file, pruning anything older than 14 days
(`BACKUP_RETENTION_DAYS` to change that).

```bash
npm run backup         # run one now
npm run backup:list    # see what's stored in Cloudinary
```

**Restoring is deliberately manual** — there's no one-command restore. Pulling
a zip down and re-importing collections into a live database should be a
considered action, not something a script can do by accident.

**On Render**, add a second **Cron Job** (same pattern as `reminder-scan.js`
from Phase 6): command `node scripts/backup.js`, schedule `0 3 * * *` (daily,
3am). Same `MONGODB_URI` and `CLOUDINARY_*` env vars as your web service.

**When you can afford it**, Atlas's own paid-tier continuous backups are a
better long-term answer — faster to restore from, point-in-time recovery,
no dependency on this script running successfully every night. Treat this as
"better than nothing," not "production-grade."

---

## Verifying

```bash
cd backend
npm install archiver@^7.0.1
npm test              # should include the 11 new softDelete tests
```

After applying §5–8 by hand:
1. Delete a pet as admin → confirm it disappears from `/pets` immediately
2. Go to `/trash` → the pet appears there → **Restore** → confirm it's back
   in the normal pet list
3. Go to `/audit-log` → the deletion and restoration should both appear,
   attributed to your account, timestamped

## What was deliberately tested hardest

Given today, I want to name what actually got the most scrutiny rather than
just claim "it's tested":

- **The soft-delete hook** — not just the decision logic in isolation, but
  the *actual registered Mongoose hook*, pulled from the schema's internal
  hook registry and invoked exactly as Mongoose would, to prove the real
  wiring works, not a reimplementation of it.
- **`archiver@8`'s breaking API change** — caught by actually running the zip
  step against real files, not by trusting the package name and a remembered
  API shape. This would have been a production crash on the very first
  scheduled backup otherwise.
- **A full regression pass** re-running every Phase 8 auth scenario (register,
  login, lockout, the `clinicId` fix from earlier today) after adding audit
  logging to the same file, specifically to catch a repeat of today's mistake.
