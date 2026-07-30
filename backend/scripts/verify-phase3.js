/**
 * Phase 3 end-to-end verification.
 *
 * Exercises every Phase 3 rule against a running server, including the ones the
 * UI won't let you break: forged clinic ids, cross-tenant reads, role limits.
 *
 * Requires: the API running, and `npm run seed` already applied.
 *   npm run dev            (in one terminal)
 *   npm run verify         (in another)
 *
 * Creates a few pets while it runs and deletes them again at the end.
 */
require("dotenv").config();

const BASE = process.env.VERIFY_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const PASSWORD = "password123";

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

/** Returns { status, body } and never throws on a 4xx/5xx. */
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    // Without this a database that's down leaves us waiting on Mongoose's
    // 10s command buffer for every single call.
    signal: AbortSignal.timeout(12000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: parsed };
}

async function login(email) {
  let res;
  try {
    res = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
  } catch (err) {
    throw new Error(
      `Sign-in as ${email} timed out. That usually means the API is running but ` +
      `can't reach MongoDB — check the server terminal for a connection error.`
    );
  }
  if (res.status === 401) {
    throw new Error(
      `${email} isn't a valid account. Run "npm run seed" to create the demo users.`
    );
  }
  if (res.status !== 200) {
    throw new Error(
      `Sign-in as ${email} returned ${res.status}. Check the server terminal for the error.`
    );
  }
  return { token: res.body.token, user: res.body.user };
}

(async () => {
  console.log(`\nVerifying Phase 3 against ${BASE}\n${"─".repeat(52)}`);

  // ---- Reachability -------------------------------------------------------
  let health;
  try {
    health = await call("GET", "/health");
  } catch {
    console.error(
      `\nNothing is listening at ${BASE}.\nStart the API with "npm run dev" in another terminal, then run this again.\n`
    );
    process.exit(1);
  }
  if (health.status !== 200) {
    console.error(
      `\nThe API answered ${health.status} at ${BASE}/health. Check the server logs.\n`
    );
    process.exit(1);
  }

  const vet = await login("vet@ngo.test");
  const admin = await login("admin@ngo.test");
  const owner = await login("owner@ngo.test");
  const otherAdmin = await login("admin@private.test");
  const otherOwner = await login("owner@private.test");

  const createdPetIds = [];

  // ---- 1. Seed data is visible and scoped --------------------------------
  section("1. Pet lists are scoped by role");

  const vetPets = await call("GET", "/pets", { token: vet.token });
  const biscuit = vetPets.body.pets.find((p) => p.name === "Biscuit");
  const marmalade = vetPets.body.pets.find((p) => p.name === "Marmalade");

  check("vet sees the clinic's pets", Boolean(biscuit && marmalade),
    `got: ${vetPets.body.pets.map((p) => p.name).join(", ") || "nothing"}`);
  check("vet does not see the other clinic's pet",
    !vetPets.body.pets.some((p) => p.name === "Juno"));

  const ownerPets = await call("GET", "/pets", { token: owner.token });
  check("owner sees only pets they own",
    ownerPets.body.pets.length > 0 &&
      ownerPets.body.pets.every((p) => String(p.owner?.id) === String(owner.user.id)));

  const otherOwnerPets = await call("GET", "/pets", { token: otherOwner.token });
  check("an owner in another clinic sees none of these pets",
    !otherOwnerPets.body.pets.some((p) => p.name === "Biscuit"));

  const catsOnly = await call("GET", "/pets?species=cat", { token: vet.token });
  check("species filter returns cats only",
    catsOnly.body.pets.length > 0 && catsOnly.body.pets.every((p) => p.species === "cat"));

  // ---- 2. Pet codes -------------------------------------------------------
  section("2. Pet codes are generated, unique, and normalised");

  const petA = await call("POST", "/pets", {
    token: vet.token,
    body: { name: "Verify-A", species: "dog", sex: "male", ownerId: owner.user.id }
  });
  const petB = await call("POST", "/pets", {
    token: vet.token,
    body: { name: "Verify-B", species: "cat", sex: "female", ownerId: owner.user.id }
  });
  if (petA.body?.pet?.id) createdPetIds.push(petA.body.pet.id);
  if (petB.body?.pet?.id) createdPetIds.push(petB.body.pet.id);

  check("registering a pet returns 201", petA.status === 201, JSON.stringify(petA.body));
  check("pet code matches PET-YYYY-NNNN",
    /^PET-\d{4}-\d{4,}$/.test(petA.body?.pet?.petCode || ""),
    `got: ${petA.body?.pet?.petCode}`);
  check("two pets never share a code",
    petA.body?.pet?.petCode !== petB.body?.pet?.petCode);

  const byCode = await call("GET", `/pets/code/${biscuit.petCode}`, { token: vet.token });
  check("lookup by exact code finds the pet", byCode.body?.pet?.name === "Biscuit");

  const loose = biscuit.petCode.toLowerCase().replace("pet-", "").replace(/-0+/, "-");
  const byLoose = await call("GET", `/pets/code/${encodeURIComponent(loose)}`, { token: vet.token });
  check(`a loosely typed code ("${loose}") resolves to the same pet`,
    byLoose.body?.pet?.id === biscuit.id, `status ${byLoose.status}`);

  // ---- 3. Medical records -------------------------------------------------
  section("3. Medical history");

  const history = await call("GET", `/pets/${biscuit.id}/records`, { token: vet.token });
  const dates = history.body.records.map((r) => new Date(r.visitDate).getTime());
  check("history returns the seeded visits", history.body.records.length >= 3);
  check("history is ordered newest first",
    dates.every((d, i) => i === 0 || dates[i - 1] >= d));

  const newVisit = await call("POST", `/pets/${biscuit.id}/records`, {
    token: vet.token,
    body: { visitDate: new Date().toISOString(), diagnosis: "Verification visit" }
  });
  check("a vet can add a visit", newVisit.status === 201);
  check("the visit is credited to the vet who wrote it",
    newVisit.body?.record?.vet?.name === vet.user.name,
    `got: ${newVisit.body?.record?.vet?.name}`);

  const after = await call("GET", `/pets/${biscuit.id}/records`, { token: vet.token });
  check("the new visit is now at the top of the timeline",
    after.body.records[0]?.id === newVisit.body.record.id);

  const edited = await call("PUT", `/records/${newVisit.body.record.id}`, {
    token: vet.token,
    body: { diagnosis: "Verification visit (edited)" }
  });
  check("a vet can edit a visit", edited.body?.record?.diagnosis === "Verification visit (edited)");

  const ownerRead = await call("GET", `/pets/${biscuit.id}/records`, { token: owner.token });
  check("the pet's owner can read the history", ownerRead.status === 200);

  // ---- 4. Allergies and conditions ---------------------------------------
  section("4. Allergies reach the client");

  const biscuitFull = await call("GET", `/pets/${biscuit.id}`, { token: vet.token });
  check("allergies are returned for the banner",
    (biscuitFull.body?.pet?.allergies || []).includes("Penicillin"),
    `got: ${JSON.stringify(biscuitFull.body?.pet?.allergies)}`);
  check("ongoing conditions are returned",
    (biscuitFull.body?.pet?.chronicConditions || []).length > 0);

  // ---- 5. QR codes --------------------------------------------------------
  section("5. QR code");

  const qr = await call("GET", `/pets/${biscuit.id}/qrcode`, { token: vet.token });
  check("qr endpoint returns a PNG data URL",
    (qr.body?.dataUrl || "").startsWith("data:image/png;base64,"));
  check("the encoded scan URL points at this pet's code",
    (qr.body?.scanUrl || "").endsWith(biscuit.petCode),
    `got: ${qr.body?.scanUrl}`);

  // ---- 6. Search ----------------------------------------------------------
  section("6. Search");

  const byName = await call("GET", "/search?q=Bisc", { token: vet.token });
  check("search finds a pet by name", byName.body.pets.some((p) => p.name === "Biscuit"));

  const byOwner = await call("GET", "/search?q=Olive", { token: vet.token });
  check("search finds pets by owner name", byOwner.body.pets.length > 0);

  const bySearchCode = await call("GET", `/search?q=${biscuit.petCode}`, { token: vet.token });
  check("search finds a pet by code", bySearchCode.body.pets.some((p) => p.id === biscuit.id));

  const short = await call("GET", "/search?q=a", { token: vet.token });
  check("a one-character query returns nothing rather than everything",
    short.body.pets.length === 0);

  const ownerSearch = await call("GET", "/search?q=Juno", { token: owner.token });
  check("an owner can't find another clinic's pet by name",
    ownerSearch.body.pets.length === 0);

  // ---- 7. Tenant isolation ------------------------------------------------
  section("7. Tenant isolation (the important part)");

  const crossId = await call("GET", `/pets/${biscuit.id}`, { token: otherAdmin.token });
  check("another clinic's admin gets 404 on a pet id, not 403",
    crossId.status === 404, `got ${crossId.status}`);

  const crossCode = await call("GET", `/pets/code/${biscuit.petCode}`, { token: otherAdmin.token });
  check("another clinic's admin gets 404 on a pet code", crossCode.status === 404);

  const crossRecords = await call("GET", `/pets/${biscuit.id}/records`, { token: otherAdmin.token });
  check("another clinic can't read the history", crossRecords.status === 404);

  const crossEdit = await call("PUT", `/pets/${biscuit.id}`, {
    token: otherAdmin.token,
    body: { name: "Hijacked" }
  });
  check("another clinic can't edit the pet", crossEdit.status === 404);

  const otherClinic = await call("GET", "/clinic", { token: otherAdmin.token });
  const forged = await call("POST", "/pets", {
    token: vet.token,
    body: {
      name: "Verify-Forged",
      species: "dog",
      sex: "male",
      ownerId: owner.user.id,
      clinicId: otherClinic.body.clinic.id // should be ignored
    }
  });
  if (forged.body?.pet?.id) createdPetIds.push(forged.body.pet.id);
  const forgedVisible = await call("GET", "/pets", { token: vet.token });
  check("a forged clinicId in the body is ignored",
    forgedVisible.body.pets.some((p) => p.id === forged.body?.pet?.id));

  const wrongOwner = await call("POST", "/pets", {
    token: vet.token,
    body: { name: "Verify-X", species: "dog", sex: "male", ownerId: otherOwner.user.id }
  });
  check("a pet can't be filed against another clinic's owner",
    wrongOwner.status === 400, `got ${wrongOwner.status}`);

  // ---- 8. Validation ------------------------------------------------------
  section("8. Validation");

  const badSpecies = await call("POST", "/pets", {
    token: vet.token,
    body: { name: "Hammy", species: "hamster", sex: "male", ownerId: owner.user.id }
  });
  check("species is restricted to cat and dog", badSpecies.status === 400);

  const noName = await call("POST", "/pets", {
    token: vet.token,
    body: { species: "dog", sex: "male", ownerId: owner.user.id }
  });
  check("a pet must have a name", noName.status === 400);

  const codeChange = await call("PUT", `/pets/${petA.body.pet.id}`, {
    token: vet.token,
    body: { petCode: "PET-1900-0001", name: "Verify-A2" }
  });
  check("petCode can't be changed once assigned",
    codeChange.body?.pet?.petCode === petA.body.pet.petCode,
    `got: ${codeChange.body?.pet?.petCode}`);

  // ---- 9. Role limits -----------------------------------------------------
  section("9. Role limits");

  const ownerWrite = await call("POST", `/pets/${biscuit.id}/records`, {
    token: owner.token,
    body: { diagnosis: "Self-diagnosed" }
  });
  check("an owner can't write a medical record", ownerWrite.status === 403);

  const vetDeletePet = await call("DELETE", `/pets/${petB.body.pet.id}`, { token: vet.token });
  check("a vet can't delete a pet", vetDeletePet.status === 403);

  const vetDeleteRecord = await call("DELETE", `/records/${newVisit.body.record.id}`, {
    token: vet.token
  });
  check("a vet can't delete a visit", vetDeleteRecord.status === 403);

  const adminDeleteRecord = await call("DELETE", `/records/${newVisit.body.record.id}`, {
    token: admin.token
  });
  check("an admin can delete a visit", adminDeleteRecord.status === 200);

  const ownerOwnPet = await call("POST", "/pets", {
    token: owner.token,
    body: { name: "Verify-Own", species: "cat", sex: "female" }
  });
  if (ownerOwnPet.body?.pet?.id) createdPetIds.push(ownerOwnPet.body.pet.id);
  check("an owner can register their own pet", ownerOwnPet.status === 201);
  check("that pet is filed against the owner themselves",
    String(ownerOwnPet.body?.pet?.owner?.id) === String(owner.user.id));

  const ownerListsOwners = await call("GET", "/owners", { token: owner.token });
  check("an owner can't list the clinic's owners", ownerListsOwners.status === 403);

  // ---- 10. Auth -----------------------------------------------------------
  section("10. Authentication");

  const anon = await call("GET", "/pets");
  check("no token is rejected", anon.status === 401);

  const junk = await call("GET", "/pets", { token: "not-a-real-token" });
  check("a forged token is rejected", junk.status === 401);

  // ---- Cleanup ------------------------------------------------------------
  section("Cleanup");
  let removed = 0;
  for (const id of createdPetIds) {
    const res = await call("DELETE", `/pets/${id}`, { token: admin.token });
    if (res.status === 200) removed += 1;
  }
  check(`removed the ${createdPetIds.length} pets this script created`,
    removed === createdPetIds.length, `removed ${removed}`);

  // ---- Result -------------------------------------------------------------
  console.log(`\n${"─".repeat(52)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32mAll ${passed} checks passed.\x1b[0m\n`);
    process.exit(0);
  } else {
    console.log(`\x1b[31m${failures.length} failed\x1b[0m, ${passed} passed:\n`);
    failures.forEach((f) => console.log(`  · ${f}`));
    console.log("");
    process.exit(1);
  }
})().catch((err) => {
  console.error(`\n\x1b[31mVerification stopped:\x1b[0m ${err.message}\n`);
  process.exit(1);
});
