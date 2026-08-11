# Phase 8 — how to check everything works

```bash
cd backend
npm install express-rate-limit
npm test            # should show 78 tests passing (7 new)
npm run dev
```

New terminal:
```bash
npm run verify:8     # after adding the script alias — see PHASE-8-CHANGES.md
```

---

## A. Password reset

- [ ] `/forgot-password` → enter a real registered email → generic "check
      your email" message (same message even if you deliberately mistype the
      email — that's intentional, not a bug)
- [ ] Check the backend console (or your inbox, if `EMAIL_USER`/`EMAIL_PASS`
      are set) for the reset link
- [ ] Open the link → set a new password → you're signed in automatically
- [ ] Try your **old** password → rejected
- [ ] Try your **new** password → works
- [ ] Click the **same reset link again** → "This link is invalid or has
      expired" — links are single-use
- [ ] Wait isn't practical to test live, but confirm in code review: the
      token expires after 1 hour (`RESET_TOKEN_HOURS` in authController.js)

## B. Email verification

- [ ] Register a new account → the verification banner appears at the top of
      the app
- [ ] **Confirm you can still use the app fully while unverified** — add a
      pet, look around. Nothing should be blocked.
- [ ] Click **Resend email** on the banner → check console/inbox for a new link
- [ ] Open the link → "Email confirmed"
- [ ] Reload the app → the banner is gone
- [ ] Click **Dismiss** on the banner (before verifying) → it disappears for
      the session but should reappear on your next visit (it's not
      permanently dismissed, just per-session)

## C. Login lockout

- [ ] Deliberately enter the wrong password **5 times** for one account
- [ ] The 5th attempt should say **"Too many failed attempts. Try again in 15
      minutes"** — not a generic wrong-password message
- [ ] Attempt #6, this time with the **correct** password → still rejected
      with the same lockout message. If the correct password gets through,
      that's a real bug — the lockout isn't working.
- [ ] This is the exact bug the automated test caught before shipping — worth
      confirming by hand too

## D. Vet deactivation

- [ ] As admin, create a vet, confirm they can sign in
- [ ] Deactivate them → they can no longer sign in, **even with the correct
      password** — message should mention contacting the clinic administrator
- [ ] Check the vet still appears in your Team list (not silently removed)
- [ ] Open a medical record that vet previously authored → "Seen by [Name]"
      should still resolve correctly, not show a broken reference
- [ ] Reactivate them → they can sign in again

## E. CORS returns 403, not 500 (needs a real browser — this is the one thing
the automated script can't confirm on its own)

- [ ] Open your **live Vercel site** in a browser
- [ ] Open DevTools → Console
- [ ] Temporarily change `NEXT_PUBLIC_API_URL` in a scratch fetch, or simpler:
      open your browser console on the Vercel site and run:
      ```js
      fetch("https://your-backend.onrender.com/api/health", {
        headers: { Origin: "https://not-your-real-domain.com" }
      })
      ```
      (Browsers don't let you spoof the `Origin` header from fetch, so the
      more realistic test is: open your site from an **unlisted preview URL**
      if you have `ALLOW_VERCEL_PREVIEWS` off, and confirm the browser's
      Network tab shows **403** on the blocked request, not 500.)
- [ ] Check the Render logs — a blocked attempt should print
      `[cors] blocked origin: ...` with the exact origin it saw

## F. Rate limiting

- [ ] Attempt to log in with the wrong password **20+ times in quick
      succession** (script this if doing it by hand is tedious) → eventually
      you should get **429 Too Many Requests** with the message about your
      network, distinct from the 423 lockout message
- [ ] This confirms two independent layers are both active: the IP limiter
      (429) and the account lockout (423)

---

## If something fails

| Symptom | Likely cause |
| --- | --- |
| `Cannot find module 'express-rate-limit'` | Run `npm install express-rate-limit` |
| Reset link 404s on the frontend | Confirm `app/(auth)/reset-password/[token]/page.js` extracted to the right path, brackets included |
| Verification banner never appears | Check it's actually mounted in your `(app)` layout — see PHASE-8-CHANGES.md §4 |
| CORS still returns 500 | The one-line `app.js` fix wasn't applied — check `ApiError` is imported and used in the rejection callback |
| Lockout never triggers | Confirm `User.js` has the new `failedLoginAttempts`/`lockUntil` fields and you're running the updated `authController.js` |
| Everything 401s immediately after this deploy | A stale JWT from before — this phase didn't change the token format, so this would be unrelated; check `JWT_SECRET` didn't change |
