# Phase 8 — Account security & recovery

**Read this before extracting.** This phase's delivery is structured
differently from previous phases, for a specific reason explained below.

---

## Why this phase looks different

The sandbox this was built in reset between sessions, so I rebuilt the
project's scaffolding from scratch to actually test against. For most files
that's fine — but `app.js`, `emailService.js`, and `package.json` are
**aggregator files that accumulate content across every phase**, and my
rebuilt versions of them are missing things your real ones have (adoption
email templates, most of your API routes, most of your npm dependencies).

Shipping those as full-file replacements would have **deleted working
features** — so I didn't. Instead:

- **9 files below are brand new.** Zero risk — drop them straight in.
- **5 files are full reconstructions of existing files** (`User.js`,
  `authController.js`, `vetController.js`, `authRoutes.js`, `vetRoutes.js`).
  I have high confidence in these — they were built and re-discussed
  extensively across our conversation — but if your real versions have
  anything beyond what Phase 8 needed, a straight overwrite would lose it.
  **Diff before replacing if you're not sure.**
- **3 files need small, additive edits only** — given as exact snippets
  below, not full files, specifically so there's no way to lose anything.

---

## 1. New files — safe to add directly (9)

```
backend/src/utils/secureToken.js
backend/src/services/loginGuard.js
backend/src/middleware/rateLimit.js
backend/tests/loginGuard.test.js
backend/scripts/verify-phase8.js

frontend/app/(auth)/forgot-password/page.js
frontend/app/(auth)/reset-password/[token]/page.js
frontend/app/verify-email/[token]/page.js
frontend/components/EmailVerificationBanner.jsx
```

Extract these into your project root; every path matches.

## 2. Reconstructed files — review before replacing (5)

```
backend/src/models/User.js
backend/src/controllers/authController.js
backend/src/controllers/vetController.js
backend/src/routes/authRoutes.js
backend/src/routes/vetRoutes.js
```

What each needed to gain, if you'd rather hand-merge instead of overwriting:

- **User.js** — 6 new fields: `isActive`, `emailVerified`,
  `emailVerifyTokenHash`, `emailVerifyExpires`, `resetTokenHash`,
  `resetTokenExpires`, `failedLoginAttempts`, `lockUntil`. Plus an
  `isLocked()` method, and `toSafeJSON()` needs `isActive` and
  `emailVerified` added to its return object.
- **authController.js** — `register-clinic` and `register` now issue a
  verification token after creating the user. `login` now checks
  `isLocked()` before comparing the password, increments/clears
  `failedLoginAttempts` on failure/success, and checks `isActive`. Four new
  exports: `forgotPassword`, `resetPassword`, `verifyEmail`,
  `resendVerification`.
- **vetController.js** — `createVet` unchanged in shape. Two new exports:
  `deactivateVet`, `activateVet` (sets `isActive`, and `activateVet` also
  clears any lockout).
- **authRoutes.js** — 5 new routes: `forgot-password`, `reset-password`,
  `verify-email`, `resend-verification`, plus rate limiters attached to
  `login`/`register`/`register-clinic`.
- **vetRoutes.js** — 2 new routes: `PATCH /:id/deactivate`,
  `PATCH /:id/activate`.

## 3. Additive-only edits — paste these in, nothing to delete (3 files)

### `backend/src/services/emailService.js`

Add these two functions anywhere in the file (after your existing
`vetAccountCreated`, for example), **and** add both names to your existing
`module.exports` object:

```js
function sendPasswordResetEmail({ user, rawToken, appUrl }) {
  const link = `${appUrl}/reset-password/${rawToken}`;
  const heading = "Reset your password";
  const body = `
    <p>We received a request to reset the password for your PetPrint account.
    This link expires in 1 hour and can only be used once.</p>
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1a6b58;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
        Reset password
      </a>
    </p>
    <p style="font-size:12px;color:#8a9a94">
      If you didn't request this, you can ignore this email — your password
      won't change unless you open the link above and choose a new one.
    </p>`;
  queueMail({
    to: user.email,
    subject: "Reset your PetPrint password",
    text: `Reset your password: ${link} (expires in 1 hour)`,
    html: shell(heading, body)
  });
}

function sendVerificationEmail({ user, rawToken, appUrl }) {
  const link = `${appUrl}/verify-email/${rawToken}`;
  const heading = "Confirm your email";
  const body = `
    <p>Click below to confirm ${user.email} is yours. This isn't required to
    use PetPrint, but it's what lets a password reset reach you if you ever
    need one.</p>
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1a6b58;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
        Confirm email
      </a>
    </p>`;
  queueMail({
    to: user.email,
    subject: "Confirm your PetPrint email",
    text: `Confirm your email: ${link}`,
    html: shell(heading, body)
  });
}
```

Then in your `module.exports = { ... }` at the bottom, add:
```js
sendPasswordResetEmail,
sendVerificationEmail
```

`shell()` and `queueMail()` already exist in your file from Phase 5 — these
two functions just call them the same way your existing templates do.

### `backend/src/app.js`

Find your CORS setup. It currently rejects a disallowed origin with something
like:

```js
return callback(new Error("Not allowed by CORS"));
```

Change that **one line** to:

```js
const { ApiError } = require("./middleware/errorHandler"); // add this import at the top if not already there
// ...
return callback(new ApiError(403, "This origin isn't allowed to access the API."));
```

That's the entire change. A rejected origin was surfacing as a 500 because a
plain `Error` has no `.status`, so your error handler fell back to 500. An
`ApiError` carries `.status = 403`, and the `cors` package forwards it through
unmodified. Confirmed against a real running server — see `PHASE-8-TESTING.md`.

### `backend/package.json`

One new dependency:

```bash
cd backend
npm install express-rate-limit
```

That's the only new package Phase 8 needs. (`cookie-parser` is **not**
required — the httpOnly-cookie migration was deliberately deferred; see below.)

## 4. Manual wiring (files I don't have a copy of at all)

Two small additions I can't safely auto-patch since I don't have these files
from before the reset:

**Mount the verification banner.** In your `(app)` layout — the file that
wraps every signed-in page — import and render it near the top of the main
content area, above `{children}`:
```jsx
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
// ...
<EmailVerificationBanner />
{children}
```

**Add deactivate/reactivate to your Team page.** Wherever you render the vets
list, add a button per vet:
```jsx
<button
  onClick={() => api.patch(`/vets/${vet.id}/${vet.isActive ? "deactivate" : "activate"}`)
    .then(() => reload())}
>
  {vet.isActive ? "Deactivate" : "Reactivate"}
</button>
```
Show an "Inactive" badge next to deactivated vets so it's visually obvious in
the list, not just discoverable by clicking.

If you'd rather I do these two precisely instead of by hand, paste me your
current `(app)` layout and Team page and I'll give you exact patches.

---

## Environment variable (optional)

```dotenv
# Where email links point. Falls back to the first entry of CLIENT_ORIGIN
# if unset, so this is optional — only set it if that fallback isn't right.
APP_URL=https://your-frontend.vercel.app
```

## What was deliberately left out

**httpOnly cookies**, despite being in the original roadmap. Your frontend
(`*.vercel.app`) and backend (`*.onrender.com`) are different domains — a
cross-domain cookie needs `SameSite=None`, which Safari blocks by default.
Shipping that now would silently break login for Safari users. The real fix
needs a custom domain (frontend and backend as subdomains of one root), which
un-blocks it entirely. Revisit this once you have one.

## Verifying

```bash
cd backend
npm install express-rate-limit
npm test              # adds 7 new tests for the lockout logic — should be 78 total
npm run dev
```

New terminal:
```bash
npm pkg set scripts.verify:8="node scripts/verify-phase8.js"
npm run verify:8
```

See `PHASE-8-TESTING.md` for the UI checklist, including the one check that
needs a real browser (the CORS 403 fix — a server-to-server check can't
observe what a browser enforces client-side).

## A bug this caught before it reached you

The 5th wrong password correctly locked the account internally, but the
response still said generic "incorrect password" — the person would only
discover the lockout on their *next* attempt, even with the right password.
Found by an automated end-to-end test, not by reading the code, and fixed
before this ever reached you: the lockout is now reported on the exact
attempt that triggers it.
