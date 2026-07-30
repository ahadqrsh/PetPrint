# Phase 4 — how to check everything works

Same shape as Phase 3: run the script first, then walk the UI.

```bash
cd backend
npm install           # multer + cloudinary are new
npm run seed          # now also creates adoption listings
npm run dev

# in another terminal
npm run verify:4      # 44 checks
```

Expected: `All 44 checks passed.` It creates listings and applications and
deletes them afterwards. It also registers one throwaway owner account to test
two people competing for the same animal, and tells you its email at the end so
you can delete it if you want to.

`npm run verify` runs the Phase 3 and Phase 4 suites back to back.

The seed leaves you with three listings at Paws & Whiskers — Pepper (a lurcher,
already has one application, so its status is **pending**), Clementine, and
Rooster — plus Sable at Northside for isolation checks. None have photos, which
is deliberate: it exercises the placeholder, and you can add real ones through
the UI.

---

## The route guard fix

- [ ] Sign in as anyone. Now type `/login` in the address bar → you're sent
      straight back to the dashboard.
- [ ] Same for `/register`.
- [ ] Press the browser **Back** button right after signing in → you stay on the
      dashboard instead of bouncing between it and the sign-in page.
- [ ] **Sign out**, then press Back → you stay on sign-in, not the dashboard.
- [ ] Sign-in still works normally in a fresh incognito window.

---

## A. As a vet — `vet@ngo.test`

- [ ] The rail now has an **Adoption** section with "Listings" and "Review
      queue". Nothing is greyed out except Clinic details.
- [ ] The dashboard shows **Up for adoption: 3** and **Applications to review: 1**.
- [ ] **Listings** shows three cards. Pepper is marked "Application pending";
      the other two "Available". Each card shows its application count.
- [ ] Cards with no photo show a species placeholder rather than a broken image.
- [ ] Filters work: Cats → Clementine only; "Adopted" → nothing yet.
- [ ] **New listing:** fill in a name, species, description, and attach a photo.
      You should see a live preview before submitting, with "Choose another" and
      "Remove".
- [ ] Try attaching a file over 5 MB → rejected in the browser, before upload.
- [ ] Publish → you land on the new listing and the photo is displayed.
- [ ] Open Pepper → the description reads in full, "1 open application" links to
      the queue.

## B. The review queue — still as the vet

- [ ] **Review queue** shows Olive's application for Pepper, with her name,
      email, and phone in a contact block, and her message below.
- [ ] Filters switch between Awaiting review / Approved / Rejected / All.
- [ ] **Reject** it → the chip changes to "Rejected", and Pepper's listing goes
      back to **Available** (no open applications left).
- [ ] Now sign in as the owner, apply again (section C), come back and
      **Approve** it. The dialog warns that the animal will be marked adopted.
- [ ] After approving: Pepper reads **Adopted** on the card and detail page, and
      the dashboard's "Up for adoption" count drops to 2.

## C. As an owner — `owner@ngo.test`

- [ ] The rail says "Looking for a home" and "My applications".
- [ ] The listings grid shows what's open. There are **no application counts** —
      owners don't see how many people they're competing with.
- [ ] The default filter is "Looking for a home"; switching to "Already adopted"
      shows animals that have gone.
- [ ] Open Clementine → **Apply to adopt Clementine** opens a dialog. It tells
      you the clinic will see your name, email, and phone.
- [ ] Send an application → toast confirms, and the page now shows "You applied
      on <date>" with an "Awaiting review" chip.
- [ ] The **Apply** button is gone — you can't apply twice.
- [ ] **Withdraw application** → confirm → the Apply button returns, and back in
      the vet's view Clementine is **Available** again.
- [ ] **My applications** lists everything you've sent with its current status.
- [ ] Open an adopted listing (Pepper, after section B) → no Apply button, and a
      line saying they've found a home.

## D. Isolation — `owner@private.test` and `admin@private.test`

- [ ] As `owner@private.test`, the listings grid shows **Sable only**. Pepper,
      Clementine, and Rooster are not there.
- [ ] Copy Pepper's URL (`/adoptions/<id>`) from the other clinic and paste it in
      → **404**, phrased as "may have been removed, or belongs to another
      clinic". Not a permission error.
- [ ] As `admin@private.test`, the review queue is empty — Olive's application
      belongs to the other clinic.
- [ ] Northside's dashboard adoption counts reflect Sable only.

## E. Edge cases worth poking

- [ ] **Two applicants:** sign up a second owner at Paws & Whiskers (sign out →
      Register → "I own a pet" → pick Paws & Whiskers). Have both apply for
      Rooster, then approve one. The other should flip to **"Not chosen"**
      automatically, and Rooster reads Adopted.
- [ ] **Delete a listing** with applications on it (staff, from the detail page)
      → the dialog says the applications go too. Afterwards the owner's "My
      applications" shows "Listing removed" rather than crashing.
- [ ] **Staff can't apply:** there's no Apply button on any listing for a vet or
      admin. (The API returns 403 if you force it.)
- [ ] **Nav highlighting:** on the Review queue, "Review queue" is highlighted,
      not "Listings".
- [ ] **Mobile width:** the grid drops to one column, and the rail becomes the
      Menu drawer.
- [ ] **Keyboard:** open the Apply dialog, press Escape → it closes and focus
      returns to the Apply button.

---

## Cloudinary vs local disk

By default the three `CLOUDINARY_*` variables in `backend/.env` are empty, so
uploads are written to `backend/uploads/` and served from `/uploads`. That works
out of the box for local development.

- [ ] Check a file actually appeared in `backend/uploads/` after your first
      upload.
- [ ] If images 404, set `API_PUBLIC_URL=http://localhost:5000` in
      `backend/.env` — stored URLs need an absolute origin.

To test the Cloudinary path, fill in the three variables and restart the API;
uploads after that point return `res.cloudinary.com` URLs. Existing listings
keep whichever URL they were created with.

---

## If something fails

| Symptom | Likely cause |
| --- | --- |
| Upload returns 400 "Send the image in a field called image" | The form field isn't named `image` |
| Upload returns 500 | Cloudinary variables are partially filled — set all three or none |
| Image uploads but shows broken | `API_PUBLIC_URL` unset while using the disk fallback |
| Listing stuck on "pending" | An application is still `applied` — check the review queue |
| A rejected animal won't leave "Adopted" | Correct behaviour: adopted is terminal by design |
| Owner sees no listings at all | They belong to a clinic with no listings; check which clinic they registered under |
