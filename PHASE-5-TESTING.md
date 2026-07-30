# Phase 5 — how to check everything works

```bash
cd backend
npm install           # pdfkit, @json2csv/plainjs, nodemailer are new
npm run dev

# in another terminal
npm test              # 34 unit tests, no database
npm run verify:core   # 65 checks, includes the PDF and CSV exports
```

Expected: `All 65 checks passed.` The Phase 5 additions are in section **9b** of
that output — it downloads a real PDF and checks the `%PDF-` magic bytes,
exports the CSV and confirms it contains this clinic's pets and *not* the other
clinic's, and verifies a vet gets 403 on the admin-only CSV.

`npm run verify` runs that plus the adoption suite.

---

## A. Dashboard — sign in as `vet@ngo.test`

- [ ] Four stat cards across the top: Pets on file, Visits this week, Up for
      adoption, To review.
- [ ] **The cards are links.** Clicking "Pets on file" goes to `/pets`, "To
      review" goes to the adoption queue.
- [ ] **Recent activity** lists the last five visits, newest first, each showing
      the pet name, its code, the diagnosis, and how long ago. Clicking one
      opens that pet's chart.
- [ ] The **Alerts** panel appears in clay, saying how many pets have a recorded
      allergy. (The seed gives Biscuit two, so this should read 1 pet.)
- [ ] Numbers agree with reality: open `/pets`, count the pets, come back — the
      card should match. Same for adoption.
- [ ] Add a visit dated today → "Visits this week" goes up by one and the visit
      appears at the top of Recent activity.

Sign in as `owner@ngo.test`:

- [ ] Cards read My pets / Visits this week / Looking for a home / My
      applications. **No vet or owner counts.**
- [ ] Recent activity shows only their own pets' visits.
- [ ] No Alerts panel (that's a staff view).

## B. PDF export

On any pet's chart, in the Details panel on the right:

- [ ] **Print history (PDF)** downloads a file named like
      `PET-2026-0001-history.pdf`.
- [ ] Open it. Check, in order:
  - Clinic name, address, and phone at the top, with the generation date on the
    right
  - Pet name large, pet code beside it
  - Two columns of details: species, breed, sex / date of birth, age, owner
  - **A clay-bordered allergy panel** listing Penicillin and Chicken protein —
    this should be impossible to miss
  - Ongoing conditions below it
  - "Visit history — 3 visits", newest first, each with the date, who was seen,
    and labelled symptoms / diagnosis / treatment / notes
  - A footer on **every** page: pet name, code, who issued it, and `Page N of M`
- [ ] Check the page numbers are right. Add several long visits to a pet so it
      runs past one page, then re-export — the last page should say
      `Page 3 of 3`, not `Page 1 of 5`.
- [ ] Export a pet with **no visits** → still a valid one-page PDF saying no
      visits have been recorded.
- [ ] As `owner@ngo.test`, export your own pet → works.
- [ ] As `admin@private.test`, paste the other clinic's pet URL and try → the
      page 404s, so there's no button to press. (The API returns 404 too; the
      script checks this.)

## C. CSV export — `admin@ngo.test`

- [ ] The rail now has **Clinic details** (no longer greyed out).
- [ ] **Export records as CSV** downloads `petprint-records-<date>.csv`.
- [ ] Open it in Excel or Sheets and check:
  - A header row of readable labels ("Pet code", "Owner email", "Seen by"…)
  - One row per visit, with the pet and owner repeated on each row
  - Biscuit's three visits are three rows
  - A pet with no visits still gets a row, with "No visits recorded" in Notes
  - Allergies read `Penicillin; Chicken protein` in one cell
  - Dates are `2026-06-13` format, and **sort correctly** as a column
  - **Northside's pets are not in the file**
- [ ] Sign in as `vet@ngo.test` → there's no Clinic details link, and the API
      returns 403 if you force the URL.
- [ ] If a visit note contains a comma or a quote mark, the row must not split
      across two lines. Add one deliberately and re-export to confirm.

## D. Clinic details — `admin@ngo.test`

- [ ] Change the address and save → toast confirms.
- [ ] **Re-export a PDF** → the new address appears in the header. That's the
      point of the field.
- [ ] Type and Plan are shown read-only with a note that they aren't self-serve.
- [ ] The Team panel shows admin / vet / owner counts and links to Team.

## E. Email notifications

**With `EMAIL_USER` and `EMAIL_PASS` blank** (the default), nothing is sent —
every notification becomes a console line instead. Watch the backend terminal:

- [ ] Register a new owner → `[email:skipped] to=… subject="Your PetPrint
      account at …"`
- [ ] As an admin, add a vet → a skipped line addressed to the vet.
- [ ] As an owner, apply to adopt → **two** lines: one to the applicant, and one
      per staff member at the clinic.
- [ ] Approve that application → a line to the approved applicant.
- [ ] With two applicants, approve one → a line to the winner *and* a rejection
      line to the other.

**To actually send mail**, put a Gmail address in `EMAIL_USER` and a **Gmail App
Password** (not your account password) in `EMAIL_PASS`, then restart:

1. Google Account → Security → 2-Step Verification must be on
2. Then Security → App passwords → generate one for "Mail"
3. Paste the 16-character password into `EMAIL_PASS`

- [ ] Repeat the steps above → console lines change from `[email:skipped]` to
      `[email:sent]` and the mail arrives.
- [ ] **Break it on purpose:** put a wrong password in `EMAIL_PASS` and register
      an owner. The signup must still **succeed** — you should see
      `[email:failed]` in the terminal but get a working account. Email is
      fire-and-forget by design.

For a non-Gmail provider, set `EMAIL_HOST` and `EMAIL_PORT` as well.

---

## If something fails

| Symptom | Likely cause |
| --- | --- |
| PDF downloads as 0 bytes or won't open | Check the backend terminal for a pdfkit error mid-stream |
| PDF footer says "Page 1 of 5" on page 3 | Regression in the footer pass — `doc.page.margins.bottom` must be zeroed while writing it |
| CSV opens with accents mangled in Excel | The UTF-8 BOM was stripped; `withBOM: true` in `csvService.js` |
| CSV rows split across lines | A field with a newline wasn't quoted — check the json2csv version |
| Download does nothing, console shows 401 | The blob request lost the token; check the axios interceptor |
| Download fails with an unreadable error | `downloadError()` in `lib/download.js` unwraps blob error bodies — make sure it's being used |
| Gmail returns "Username and Password not accepted" | You used the account password; generate an App Password |
| Dashboard numbers disagree with the list pages | Both should come from `/dashboard/stats` — check nothing reintroduced counts on `/clinic` |
