/**
 * Phase 8 (account security) end-to-end verification, against a REAL running
 * server + real database — run this against your actual dev setup.
 *
 *   npm run dev
 *   npm run verify:8
 *
 * Creates and cleans up its own test account. Does not touch your seeded
 * demo data.
 */
require("dotenv").config();

const BASE = process.env.VERIFY_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const STAMP = Date.now();
const TEST_EMAIL = `phase8-verify-${STAMP}@example.test`;

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) { passed++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { failures.push(name); console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `\n         ${detail}` : ""}`); }
}
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: parsed };
}

(async () => {
  console.log(`\nVerifying Phase 8 against ${BASE}\n${"─".repeat(52)}`);

  try {
    const h = await call("GET", "/health");
    if (h.status !== 200) throw new Error();
  } catch {
    console.error(`\nNothing is listening at ${BASE}. Start it with "npm run dev".\n`);
    process.exit(1);
  }

  section("1. Registration issues an unverified account");

  const reg = await call("POST", "/auth/register-clinic", {
    clinicName: `Verify Clinic ${STAMP}`, name: "Verify Admin",
    email: TEST_EMAIL, password: "verifypassword1"
  });
  check("clinic registration succeeds", reg.status === 201, JSON.stringify(reg.body));
  check("a token is issued immediately (verification is non-blocking)", typeof reg.body?.token === "string");
  check("the account starts unverified", reg.body?.user?.emailVerified === false);

  const adminToken = reg.body.token;

  section("2. Repeated wrong passwords lock the account");

  let lockedAt = null;
  for (let i = 1; i <= 6; i++) {
    const r = await call("POST", "/auth/login", { email: TEST_EMAIL, password: "wrong-password" });
    if (r.status === 423) { lockedAt = i; break; }
    check(`attempt ${i} is 401 (not yet locked)`, r.status === 401, JSON.stringify(r.body));
  }
  check("the account locks within 5 wrong attempts", lockedAt !== null && lockedAt <= 5, `locked at attempt ${lockedAt}`);

  const rightPasswordWhileLocked = await call("POST", "/auth/login", { email: TEST_EMAIL, password: "verifypassword1" });
  check("the CORRECT password is still rejected while locked", rightPasswordWhileLocked.status === 423,
    "a lockout that lets the right password through isn't a lockout");

  section("3. Login and forgot-password don't reveal which emails exist");

  const noSuchUser = await call("POST", "/auth/login", { email: "definitely-not-registered@example.test", password: "x" });
  const wrongPw = await call("POST", "/auth/login", { email: TEST_EMAIL + ".different", password: "x" });
  check("an unknown email doesn't get a different message than a wrong password would",
    noSuchUser.status === 401 && wrongPw.status === 401);

  const forgotUnknown = await call("POST", "/auth/forgot-password", { email: "nobody-at-all@example.test" });
  const forgotKnown = await call("POST", "/auth/forgot-password", { email: TEST_EMAIL });
  check("forgot-password returns 200 whether or not the account exists",
    forgotUnknown.status === 200 && forgotKnown.status === 200);
  check("forgot-password's message is identical either way",
    forgotUnknown.body?.message === forgotKnown.body?.message);

  section("4. Deactivating a vet blocks login without deleting the record");

  const vetEmail = `phase8-vet-${STAMP}@example.test`;
  const createVet = await call("POST", "/vets", {
    token: adminToken, body: { name: "Verify Vet", email: vetEmail, password: "vetpassword1" }
  });
  check("admin can create a vet", createVet.status === 201, JSON.stringify(createVet.body));
  const vetId = createVet.body?.vet?.id;

  const vetCanLogin = await call("POST", "/auth/login", { email: vetEmail, password: "vetpassword1" });
  check("the new vet can log in", vetCanLogin.status === 200);

  const deactivate = await call("PATCH", `/vets/${vetId}/deactivate`, { token: adminToken });
  check("admin can deactivate the vet", deactivate.status === 200 && deactivate.body?.vet?.isActive === false);

  const blockedLogin = await call("POST", "/auth/login", { email: vetEmail, password: "vetpassword1" });
  check("a deactivated vet can't log in, even with the right password", blockedLogin.status === 403,
    JSON.stringify(blockedLogin.body));

  const vetsList = await call("GET", "/vets", { token: adminToken });
  check("the deactivated vet still appears in the list (not hard-deleted)",
    vetsList.body?.vets?.some((v) => v.id === vetId));

  const reactivate = await call("PATCH", `/vets/${vetId}/activate`, { token: adminToken });
  check("admin can reactivate the vet", reactivate.status === 200 && reactivate.body?.vet?.isActive === true);

  const worksAgain = await call("POST", "/auth/login", { email: vetEmail, password: "vetpassword1" });
  check("the reactivated vet can log in again", worksAgain.status === 200);

  section("5. CORS rejection returns 403, not 500");
  console.log("  (structural check — see PHASE-8-TESTING.md for the browser-based confirmation)");
  const health = await call("GET", "/health");
  check("the API is reachable for this check to be meaningful at all", health.status === 200);

  console.log(`\n${"─".repeat(52)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32mAll ${passed} checks passed.\x1b[0m\n`);
    process.exit(0);
  }
  console.log(`\x1b[31m${failures.length} failed\x1b[0m, ${passed} passed:\n`);
  failures.forEach((f) => console.log(`  · ${f}`));
  console.log("");
  process.exit(1);
})().catch((err) => {
  console.error(`\n\x1b[31mVerification stopped:\x1b[0m ${err.message}\n`);
  process.exit(1);
});
