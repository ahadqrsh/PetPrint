# Phase 6 — Vaccination engine

Extract this into your project root; every path matches. **Nothing was deleted.**

## New files (12)

```
backend/src/models/VaccineType.js              schedules stored as data
backend/src/models/VaccinationRecord.js        one row per dose given
backend/src/services/vaccineEngine.js          the due-date rules (pure, no DB)
backend/src/controllers/vaccinationController.js
backend/src/routes/vaccinationRoutes.js
backend/scripts/seed-vaccines.js               7 vaccines into the catalogue
backend/scripts/reminder-scan.js               for a scheduled job
backend/scripts/verify-phase6.js               48 API checks
backend/tests/vaccineEngine.test.js            17 unit tests

frontend/components/VaccinationPanel.jsx       the schedule on a pet's chart
frontend/components/DueChip.jsx
frontend/app/(app)/vaccinations/page.js        clinic-wide "what's due"
```

## Modified files (7)

```
backend/src/app.js                             mounts /api/vaccines, /api/vaccinations
backend/src/routes/petRoutes.js                adds /pets/:id/vaccinations
backend/src/controllers/dashboardController.js adds vaccination counts
backend/package.json                           adds seed:vaccines, reminders, verify:6

frontend/components/nav-items.js               adds Vaccinations to the rail
frontend/app/(app)/dashboard/page.js           swaps a stat card for vaccinations due
frontend/app/(app)/pets/[id]/page.js           mounts VaccinationPanel
```

## After extracting

```bash
cd backend
npm run seed:vaccines     # required — the catalogue starts empty
npm run test              # 57 tests
npm run dev

# another terminal
npm run verify:6          # 48 checks
```

No new dependencies, so `npm install` isn't needed unless you skipped the
Phase 5 fix (which added `eslint`).

## New endpoints

```
GET    /api/vaccines                    ?species=cat|dog — the catalogue
GET    /api/pets/:id/vaccinations       the pet's full schedule
POST   /api/pets/:id/vaccinations       [vet, admin] record a dose
DELETE /api/vaccinations/:id            [vet, admin] correct a mistake
GET    /api/vaccinations/due            ?days=30 — overdue and upcoming
```

## How the engine works

The rule in one sentence: **the first dose of a course is timed from the pet's
birthday, each later dose from the previous dose, and once the course is
finished the booster interval repeats.**

Everything lives in `VaccineType`, so adding a vaccine is inserting a document,
not writing code:

```js
{
  name: "DHPP",
  species: "dog",
  isCore: true,
  doseSchedule: [
    { sequence: 1, minAgeWeeks: 6,  intervalFromPrevDays: 0  },
    { sequence: 2, minAgeWeeks: 9,  intervalFromPrevDays: 21 },
    { sequence: 3, minAgeWeeks: 12, intervalFromPrevDays: 21 },
    { sequence: 4, minAgeWeeks: 16, intervalFromPrevDays: 21 }
  ],
  boosterIntervalDays: 1095
}
```

Two details worth knowing:

- **Both gates apply to later doses.** A dose is due at the interval *or* the
  minimum age, whichever is later. A puppy given dose 1 early still waits until
  it's old enough for dose 2.
- **Only the most recent dose carries `nextDueDate`.** Older rows are nulled
  out, so the due list is one indexed query and nobody gets four reminders for
  the same vaccine.

A clinic can override a global schedule by creating its own `VaccineType` with
the same name and species — `clinicId` set. That entry wins for that clinic and
affects nobody else.

## Reminder scan

Not wired to a scheduler — it's a script, so you control when it runs.

```bash
npm run reminders                          # 14-day window
node scripts/reminder-scan.js --days 30 --dry-run
```

`--dry-run` prints what would be sent without sending. One email per pet
listing everything due, rather than one per vaccine.

**On Render:** create a **Cron Job** service pointing at the same repo, with
`node scripts/reminder-scan.js` as the command and a daily schedule
(`0 9 * * *` for 9am). Give it the same `MONGODB_URI` and `EMAIL_*` variables
as the web service. Run it daily, not hourly — the same reminder simply goes
out again.

## Notes for review

- **A pet with no date of birth can't have first doses scheduled.** The panel
  says so rather than inventing a date; add a DOB on the chart and the dates
  fill in. Deliberate — a guessed vaccination date is worse than a blank one.
- **The seeded schedules follow common practice, but rabies booster intervals
  are set by law and vary by jurisdiction.** Check yours before relying on the
  dates. That's exactly why schedules are data.
- **Deleting a dose recalculates the schedule** rather than leaving a stale due
  date — that's what makes it safe as a correction tool.
- **`GET /pets/:id/record.pdf` doesn't include vaccinations yet.** Worth adding
  before launch: a printed history is the thing an owner takes to a boarding
  kennel, and that's the record they'll be asked for.
