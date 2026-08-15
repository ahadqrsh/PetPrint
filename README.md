# PetPrint — pet clinic & rescue management

Multi-tenant app for veterinary clinics and animal-rescue NGOs: pet medical
histories, vaccinations, and adoptions. Cats and dogs only.

Monorepo: `/backend` (Express + MongoDB) and `/frontend` (Next.js App Router),
talking only over HTTP.

## Status

**Phase 1 — Auth & roles ✅**
Clinic + User models, owner self-registration, clinic bootstrap, bcrypt + JWT
login, `requireAuth` / `requireRole` middleware, zod validation, one central
error handler.

**Phase 2 — Multi-tenancy ✅**
Every scoped query is built by a single set of helpers in `src/utils/scope.js`,
a `requireClinic` middleware rejects clinic-less accounts before a controller
can build a filter, and admins can add, edit, and remove vets inside their own
clinic.

**Phase 3 — Pets & medical history ✅ (the core loop)**
Pet CRUD with server-generated `petCode`, the medical-record timeline newest
first, the allergy banner, a QR code per pet with a `/scan/:petCode` landing
page, and search across pet name, owner name, and code. 20 unit tests.

**Phase 4 — Adoption ✅**
Listings with Multer image upload to Cloudinary (local disk as fallback), the
browse grid for owners, and the apply → approve/reject workflow that drives
listing status. Approving one application marks the animal adopted and turns
down everyone else waiting on it. 27 unit tests.

**Phase 5 — Polish & value-adds ✅**
`GET /dashboard/stats` as the single source for every dashboard number, a
printable PDF history per pet (pdfkit), a clinic-wide CSV export for admins
(json2csv), an editable clinic-details page, and Nodemailer notifications for
signup, vet accounts, and every step of an adoption application. 34 unit tests.

Phases 6–7 (vaccination engine, AI assistant) are not started.

## Run it

Prereqs: Node 18+, a MongoDB instance (local or Atlas).

```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI and JWT_SECRET
npm install
npm run seed                # two clinics, staffed, with pets and histories
npm test                    # unit tests, no database needed
npm run dev                 # http://localhost:5000
npm run verify              # end-to-end API checks (needs the server running)
```

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
npm run check               # catches components used without being imported
```

`npm run check` exists because `next build` does **not** catch an undefined
component on a dynamic route: an undefined identifier is valid JavaScript, and
a route marked `ƒ` is never executed at build time, so the error only surfaces
when someone opens the page. Run it after editing any page.

### Seed logins (password `password123`)

| Email | Role | Clinic |
| --- | --- | --- |
| admin@ngo.test | admin | Paws & Whiskers Rescue |
| vet@ngo.test | vet | Paws & Whiskers Rescue |
| vet2@ngo.test | vet | Paws & Whiskers Rescue |
| owner@ngo.test | owner | Paws & Whiskers Rescue |
| admin@private.test | admin | Northside Veterinary Clinic |
| vet@private.test | vet | Northside Veterinary Clinic |
| owner@private.test | owner | Northside Veterinary Clinic |

**To check isolation by hand:** sign in as `admin@ngo.test` and open Team — you
should see exactly two vets (Vikram, Sofia) and never Northside's Tom. Copy
Tom's id and `PUT`/`DELETE /api/vets/<that id>` returns 404, not 403.

## API

```
GET    /api/health
GET    /api/clinics                 # public: id/name/type for the sign-up dropdown
POST   /api/auth/register-clinic    # creates a Clinic + its first admin
POST   /api/auth/register           # owner self-registration into a clinic
POST   /api/auth/login
GET    /api/auth/me

GET    /api/clinic                  # caller's own clinic (+ team counts; null for owners)
PUT    /api/clinic                  # [admin] name, address, phone

GET    /api/vets                    # [admin] vets in the caller's clinic only
POST   /api/vets                    # [admin]
PUT    /api/vets/:id                # [admin]
DELETE /api/vets/:id                # [admin]
GET    /api/owners                  # [vet, admin] owner picker for pet registration

GET    /api/pets                    # scoped: owner sees own, staff see the clinic
                                    #   ?species=cat|dog  ?q=name
GET    /api/pets/:id
GET    /api/pets/code/:petCode      # QR scan target
POST   /api/pets                    # staff register for any owner; owners for themselves
PUT    /api/pets/:id                # [vet, admin]
DELETE /api/pets/:id                # [vet, admin] — soft-deletes the pet + its records, recoverable from Trash
GET    /api/pets/:id/qrcode         # { petCode, scanUrl, dataUrl }

GET    /api/pets/:id/records        # the history timeline, newest first
POST   /api/pets/:id/records        # [vet, admin] — author is always the caller
PUT    /api/records/:id             # [vet, admin]
DELETE /api/records/:id             # [admin]

GET    /api/search?q=               # pet name, owner name, or pet code — all scoped

GET    /api/adoptions               # ?status= ?species= — owners see open listings only
GET    /api/adoptions/:id
POST   /api/adoptions               # [vet, admin] multipart, image in an "image" field
PUT    /api/adoptions/:id           # [vet, admin] multipart; a new image replaces the old
DELETE /api/adoptions/:id           # [vet, admin] — also deletes its applications
POST   /api/adoptions/:id/apply     # [owner]

GET    /api/adoptions/applications  # staff: the clinic's queue; owner: their own
PUT    /api/adoptions/applications/:id      # [vet, admin] approved | rejected
DELETE /api/adoptions/applications/:id      # [owner] withdraw an undecided application

GET    /api/dashboard/stats         # every dashboard number, scoped by role
GET    /api/pets/:id/record.pdf     # printable history (pdfkit)
GET    /api/clinic/export.csv       # [admin] every pet and visit (json2csv)
```

### Exports are authenticated, so downloads go through a blob

Neither `<a href>` nor `<img src>` can carry a bearer token, so
`lib/download.js` fetches the file with the token, wraps it in a blob, and
triggers a temporary link. It reads the filename out of `Content-Disposition`,
and unwraps JSON error bodies (which arrive as blobs when `responseType` is
`"blob"`) so failures still show a readable message.

### Email never blocks a request

`emailService.queueMail()` is deliberately fire-and-forget: a signup must not
500 because SMTP is down. With `EMAIL_USER`/`EMAIL_PASS` unset every send
becomes a `[email:skipped]` console line, so development and CI need no mail
server. Gmail requires an **App Password**, not the account password.

Notifications sent: welcome (owner and clinic signup), vet account created,
adoption application received (to the applicant *and* the clinic's staff), and
application approved or rejected — including the applicants who are turned down
automatically when someone else is approved.

### Listing status is derived, never set by hand

`nextListingStatus()` in `src/utils/adoptionStatus.js` computes it from the
applications: an approved one makes the listing **adopted**, any open one makes
it **pending**, otherwise **available**. Adopted is terminal, so withdrawing or
rejecting a leftover application can't put an animal that has gone home back on
the board.

### Image uploads

Multer parses the multipart body into memory; `uploadService.storeImage()` then
pushes it to Cloudinary if the three `CLOUDINARY_*` variables are set, and
otherwise writes it to `backend/uploads/` which Express serves at `/uploads`.
Either way only the URL reaches MongoDB. Set `API_PUBLIC_URL` when using the
disk fallback so stored URLs are absolute. Limits: 5 MB, one file, JPEG/PNG/
WebP/GIF only.

### Pet codes

Generated server-side as `PET-<year>-<0000>` from an atomic counter, with a
unique index as a backstop, so two simultaneous registrations can't collide.
Input is normalised before lookup — `pet 2026 42`, `2026-42`, and
`PET-2026-0042` all resolve to the same pet.

### Why the QR endpoint returns JSON

The endpoint is authenticated, and an `<img src>` can't send a bearer token.
So it returns `{ petCode, scanUrl, dataUrl }` and the client renders the data
URL. The QR itself encodes `CLIENT_ORIGIN/scan/PET-2026-0042`, so a phone
camera opens the chart directly.

Error shape everywhere: `{ "error": { "message", "details?" } }`.

## How tenancy is enforced

- `req.user` is loaded fresh from the database on every request, so `role` and
  `clinicId` never come from the client. `stripProtected()` deletes `role`,
  `clinicId`, `passwordHash`, and `_id` from any request body before use.
- `clinicFilter(user)` and `scopedFilter(user, { ownerField })` are the only
  ways a query filter gets built. Owners get their clinic filter *plus* their
  own id; staff get the clinic filter alone.
- **Cross-tenant reads return 404, not 403.** A 403 would confirm that the id
  exists in someone else's clinic. `assertSameClinic()` enforces this.
- `requireClinic` runs before every scoped route so a clinic-less account can
  never produce `{ clinicId: undefined }`, which would match across tenants.

## Design

Direction is **"petrol & brass"** — the paper patient file, digitised.

- **Colour:** deep petrol (`#0f2b2a`) for the nav rail, cool paper (`#eef2f0`)
  canvas, jade for actions, and brass (`#c9922e`) used *only* for the active-page
  marker, the paid-plan chip, and pet codes. Clay is reserved for warnings and
  destructive actions — the Phase 3 allergy banner will claim it.
- **Type:** Fraunces (soft serif) for titles, Public Sans for interface text,
  IBM Plex Mono for anything that is a *record* — pet codes, counts, dates,
  roles. Mono isn't decoration here; it marks data.
- **Signature:** the **folder tab**. Every page's section label sits on a tab
  attached to the sheet below it, the way a divider sticks out of a paper file.
  It reappears as the empty state's blank file and as the chart specimen on the
  sign-in screen.
- Responsive to mobile (rail collapses to a drawer), visible keyboard focus
  throughout, focus-trapped dialogs, and `prefers-reduced-motion` respected.

## Notes for review

- **Route groups:** protected pages live in `app/(app)/` and auth pages in
  `app/(auth)/`. URLs are unchanged (`/dashboard`, `/admin/vets`) — the groups
  just let each set share a layout.
- **Beyond the spec's endpoint list:** `POST /auth/register-clinic` and
  `GET /clinics` (needed to create the first tenant and let owners pick theirs),
  plus `GET/PUT /clinic`. Flag if you'd rather bootstrap tenants differently.
- **Deleting a vet is still a hard delete**, and now that medical records
  exist, a vet with signed visits should be *deactivated* instead so history
  keeps its author. Worth doing in Phase 4 — the spot is marked in
  `vetController.js`.
- **`/pets/code/:petCode` is clinic-scoped.** A pet from another clinic 404s
  exactly like an unknown code. That's correct for tenant isolation, but it
  means a pet arriving at a different clinic can't be looked up by tag. If you
  want cross-clinic read with the owner's consent, that's a design decision for
  later, not a bug.
- **`GET /api/clinic` no longer returns counts** — they all moved to
  `/dashboard/stats` so a number can't disagree with the page it links to.
  `/clinic` returns clinic details plus team totals only.
- **`json2csv` is installed as `@json2csv/plainjs`**, its current package name;
  the old `json2csv` package is deprecated.
- **CSV exports contain owner contact details and clinical notes.** There's a
  warning next to the button, but if this handles real patient data you'll want
  an audit log of who exported what — worth adding before launch.
- **Signed-in users can no longer reach `/login` or `/register`.** A `GuestOnly`
  guard wraps the auth layout and redirects them to the dashboard, and both auth
  pages now navigate with `replace()` so Back doesn't bounce between the two.
- **Staff can't apply to their own listings** (403). If a vet should be able to
  adopt from their own clinic, they'd need a separate owner account — worth
  deciding before this goes live.
- Admins can't be created or removed through `/api/vets` — that endpoint only
  touches `role: "vet"`. Worth deciding in Phase 3 whether admins need their own
  management screen.
- JWT is in localStorage with an axios interceptor. Fine for development; say
  the word if you want httpOnly cookies before this goes anywhere real.

## Testing

```bash
npm test              # 27 unit tests, no database needed
npm run verify        # both API suites end to end (needs the server running)
npm run verify:core   # pets, records, exports, stats — 65 checks
npm run verify:4      # adoption — 44 checks
```

`PHASE-3-TESTING.md` and `PHASE-4-TESTING.md` add the UI walkthroughs, for the
things a script can't judge.

## Upgrading from Phase 4

**One file was renamed:** `backend/scripts/verify-phase3.js` is now
`backend/scripts/verify-core.js` (it grew to cover the Phase 5 exports too).
If you extract over your existing folder, delete the old one:

```powershell
Remove-Item backend\scripts\verify-phase3.js
```

Nothing else was deleted. Changed: `backend/src/app.js`,
`backend/src/controllers/` (auth, vet, clinic, adoption — all now send email),
`backend/src/routes/` (pet, clinic), `backend/package.json` (adds `pdfkit`,
`@json2csv/plainjs`, `nodemailer`), `backend/.env.example`,
`frontend/app/(app)/dashboard/page.js`, `frontend/app/(app)/pets/[id]/page.js`,
and `frontend/components/nav-items.js`.

After extracting: `npm install` in **both** folders. No re-seed needed, though
it's harmless.
