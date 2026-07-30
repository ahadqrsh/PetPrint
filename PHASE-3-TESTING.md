# Phase 3 — how to check everything works

Two layers. Run the script first: it covers the rules the UI won't let you
break, and it takes about ten seconds. Then click through the UI checklist for
the things a script can't judge, like whether the allergy banner is actually
noticeable.

---

## Setup

```bash
cd backend
npm install
npm run seed          # wipes and rebuilds the demo data
npm run dev           # leave running
```

```bash
cd frontend
npm install
npm run dev           # leave running, http://localhost:3000
```

The seed prints the pet codes it generated. Keep that terminal visible — you'll
want `Biscuit`'s code for the QR and search checks.

All demo accounts use the password `password123`.

| Email | Role | Clinic |
| --- | --- | --- |
| `admin@ngo.test` | admin | Paws & Whiskers Rescue |
| `vet@ngo.test` | vet | Paws & Whiskers Rescue |
| `owner@ngo.test` | owner | Paws & Whiskers Rescue |
| `admin@private.test` | admin | Northside Veterinary Clinic |
| `owner@private.test` | owner | Northside Veterinary Clinic |

---

## Layer 1 — automated API checks

With both servers running, in a third terminal:

```bash
cd backend
npm run verify:core
```

This exercises 45 rules: scoping, pet code generation and normalisation,
timeline ordering, record authorship, QR output, search, tenant isolation,
validation, and every role limit. It creates a handful of pets and deletes them
again at the end.

Expected: `All 45 checks passed.` Any failure names the exact rule that broke.

Also run the unit tests, which need no server:

```bash
npm test              # 20 tests, no database required
```

---

## Layer 2 — UI walkthrough

Tick these off in order. Each one states what you should see.

### A. As a vet — `vet@ngo.test`

- [ ] **Sign in** lands on the dashboard. The left rail shows the clinic name
      and a `free` plan chip.
- [ ] **Nav is role-correct:** Overview and Pets are clickable; Adoptions is
      greyed with a `P4` marker; there is no Team link.
- [ ] **Counts are real:** "Pets on file" reads 2, "Visits this week" reads 0
      (every seeded visit is older than a week).
- [ ] **Pets list** shows Biscuit and Marmalade, each with its owner's name and
      a brass code tag. Biscuit carries an "Allergy on file" chip.
- [ ] **Filters work:** Dogs → Biscuit only. Cats → Marmalade only. All → both.
- [ ] **Open Biscuit.** The clay allergy banner sits above the history and
      lists Penicillin and Chicken protein. Ongoing conditions appear below it.
- [ ] **History is newest first** — the ear infection visit is at the top with a
      "Latest" chip, then the annual check, then the gastroenteritis visit.
      Each shows which vet was seen.
- [ ] **QR panel** renders a code on the right. "Download PNG" saves a file
      named after the pet code.
- [ ] **Add a visit** dated today. It appears at the top of the timeline, takes
      the "Latest" chip, and a toast confirms it.
- [ ] Go back to the dashboard — **"Visits this week" now reads 1**.
- [ ] **Edit that visit,** change the diagnosis, save. The change sticks after a
      page refresh.
- [ ] **No Delete link** appears on any visit, and there's no "Delete this
      chart" in the Details panel. Deleting is admin-only.
- [ ] **Register a pet.** The owner dropdown lists Olive Byrne and *not* Marcus
      Webb, who belongs to the other clinic.
- [ ] Fill the form, add an allergy with the tag input (type, press Enter),
      submit. You land on the new chart, the code follows on from the last one,
      and the allergy banner is already showing.

### B. Search — still as the vet

Use the search box on the dashboard or the pets page.

- [ ] `bisc` → Biscuit appears, with its allergy chip.
- [ ] `Olive` → both of Olive's pets appear (searching by *owner* name).
- [ ] Paste Biscuit's full code, e.g. `PET-2026-0001` → Biscuit.
- [ ] Type the same code sloppily: `pet 2026 1` → still Biscuit.
- [ ] A single letter returns nothing rather than everything.
- [ ] Clicking a result opens that pet's chart.

### C. QR scan — the real point of the feature

- [ ] On a pet's chart, download the QR PNG and scan it with your phone camera,
      **or** just visit `http://localhost:3000/scan/PET-2026-0001` in the
      browser (substitute a real code).
- [ ] Signed in, it forwards straight to that pet's chart.
- [ ] Try a code that doesn't exist, e.g. `/scan/PET-2026-9999` → a clear
      "No pet at this clinic matches that code" with a link to search.

> Phone scanning only works if the phone can reach your laptop. On the same
> Wi-Fi, set `CLIENT_ORIGIN` in `backend/.env` to your machine's LAN address
> (e.g. `http://192.168.1.20:3000`) and re-generate the QR by reloading the
> chart. Otherwise the browser check above is equivalent.

### D. As an admin — `admin@ngo.test`

- [ ] The Team link appears in the rail; the vet's view didn't have it.
- [ ] Open any pet: **Delete now appears** on each visit, and "Delete this
      chart" appears in the Details panel.
- [ ] Delete a visit → the visit count drops and the timeline re-renders.
- [ ] Delete one of the pets you created earlier → you're returned to the pets
      list and it's gone. Its visits went with it.

### E. As an owner — `owner@ngo.test`

- [ ] The rail says **"My pets"**, not "Pets".
- [ ] The pets list shows only Olive's pets.
- [ ] Open one: **no "Add visit" button**, and no Edit or Delete on any visit.
      The history is fully readable.
- [ ] The allergy banner still shows — owners need it too.
- [ ] The dashboard shows "My pets" and "Visits this week" only, with **no vet
      or owner counts**.
- [ ] "Register a pet" works and doesn't ask who the owner is — it files the
      pet against them automatically.

### F. Tenant isolation — the checks that matter most

Sign in as **`admin@private.test`** (the other clinic).

- [ ] The pets list shows Juno only. Biscuit and Marmalade are not there.
- [ ] Search `Biscuit` → nothing.
- [ ] Take Biscuit's URL from the first clinic — `/pets/<id>` — and paste it in
      while signed in here. You get **"Pet not found"**, not a permission error.
      (404 rather than 403 is deliberate: a 403 would confirm the pet exists
      somewhere.)
- [ ] Visit `/scan/<Biscuit's code>` here → the same "no pet matches that code"
      as for a made-up code.
- [ ] The dashboard counts show Northside's numbers only.

### G. Quality-of-life checks

- [ ] **Reload** any chart page directly by URL — it loads without bouncing you
      to the dashboard.
- [ ] **Sign out**, then paste a `/pets/...` URL → redirected to sign-in.
- [ ] **Narrow the window** to phone width: the rail collapses to a Menu button
      and the drawer opens over the page.
- [ ] **Keyboard only:** Tab through the pets list — focus outlines are visible.
      Open "Add visit" and press Escape — the dialog closes and focus returns to
      the button.
- [ ] **Empty state:** as the private-clinic admin, delete Juno. The list shows
      "No pets on file yet" with a register button rather than a blank page.

---

## If something fails

| Symptom | Likely cause |
| --- | --- |
| `npm run verify` says nothing is listening | The API isn't running, or it's on a port other than 5000 |
| Sign-in times out | The API is up but can't reach MongoDB — check the backend terminal |
| `isn't a valid account` | Run `npm run seed` |
| QR panel spins forever | `qrcode` wasn't installed — re-run `npm install` in `backend/` |
| Pets list is empty for everyone | The seed ran against a different database than the server is using; compare `MONGODB_URI` |
| Phone can't open a scanned QR | `CLIENT_ORIGIN` still points at `localhost` — see the note in section C |
