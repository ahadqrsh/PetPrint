/**
 * Phase 4 (adoption) end-to-end verification.
 *
 *   npm run dev            (one terminal)
 *   npm run seed           (once, if you haven't)
 *   npm run verify:4       (another terminal)
 *
 * Covers listings, the multipart image upload, the apply -> approve/reject
 * workflow, the status machine, and tenant isolation. Cleans up after itself.
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

const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function call(method, path, { token, body, form } = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  // FormData sets its own multipart Content-Type with a boundary.
  if (body && !form) headers["Content-Type"] = "application/json";

  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(12000),
    headers,
    body: form || (body ? JSON.stringify(body) : undefined)
  });

  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: parsed };
}

async function login(email) {
  const res = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
  if (res.status === 401) {
    throw new Error(`${email} isn't a valid account. Run "npm run seed" first.`);
  }
  if (res.status !== 200) {
    throw new Error(`Sign-in as ${email} returned ${res.status}. Check the server terminal.`);
  }
  return { token: res.body.token, user: res.body.user };
}

/** A real 1x1 PNG, so the upload path is exercised end to end. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64"
);

function listingForm({ name, species = "dog", breed = "", description = "", withImage = false }) {
  const form = new FormData();
  form.append("name", name);
  form.append("species", species);
  form.append("breed", breed);
  form.append("description", description);
  if (withImage) {
    form.append("image", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");
  }
  return form;
}

(async () => {
  console.log(`\nVerifying Phase 4 against ${BASE}\n${"─".repeat(52)}`);

  try {
    const health = await call("GET", "/health");
    if (health.status !== 200) throw new Error(`/health returned ${health.status}`);
  } catch {
    console.error(`\nNothing is listening at ${BASE}. Start it with "npm run dev".\n`);
    process.exit(1);
  }

  const vet = await login("vet@ngo.test");
  const admin = await login("admin@ngo.test");
  const owner = await login("owner@ngo.test");
  const otherVet = await login("vet@private.test");
  const otherOwner = await login("owner@private.test");

  const cleanup = [];

  // ---- 1. Creating listings ----------------------------------------------
  section("1. Creating listings");

  const created = await call("POST", "/adoptions", {
    token: vet.token,
    form: listingForm({ name: "Verify-Pip", species: "cat", breed: "Tabby", description: "Test listing." })
  });
  if (created.body?.listing?.id) cleanup.push(created.body.listing.id);

  check("a vet can create a listing", created.status === 201, JSON.stringify(created.body));
  check("a new listing starts available", created.body?.listing?.status === "available");
  check("the poster is recorded", created.body?.listing?.postedBy?.name === vet.user.name);

  const withImage = await call("POST", "/adoptions", {
    token: vet.token,
    form: listingForm({ name: "Verify-Photo", withImage: true })
  });
  if (withImage.body?.listing?.id) cleanup.push(withImage.body.listing.id);
  check("a multipart image upload succeeds", withImage.status === 201);
  check("an image URL is stored, not the bytes",
    typeof withImage.body?.listing?.imageUrl === "string" &&
      withImage.body.listing.imageUrl.length > 0 &&
      !withImage.body.listing.imageUrl.startsWith("data:"),
    `got: ${String(withImage.body?.listing?.imageUrl).slice(0, 40)}`);

  const ownerCreate = await call("POST", "/adoptions", {
    token: owner.token,
    form: listingForm({ name: "Verify-NotAllowed" })
  });
  check("an owner can't create a listing", ownerCreate.status === 403);

  const badSpecies = await call("POST", "/adoptions", {
    token: vet.token,
    form: listingForm({ name: "Verify-Bird", species: "parrot" })
  });
  check("species is restricted to cat and dog", badSpecies.status === 400);

  const noName = await call("POST", "/adoptions", {
    token: vet.token,
    form: listingForm({ name: "" })
  });
  check("a listing must have a name", noName.status === 400);

  const listingId = created.body.listing.id;

  // ---- 2. Browsing --------------------------------------------------------
  section("2. Browsing and scoping");

  const staffList = await call("GET", "/adoptions", { token: vet.token });
  check("staff see their clinic's listings",
    staffList.body.listings.some((l) => l.id === listingId));
  check("staff see an application count per listing",
    staffList.body.listings.every((l) => typeof l.applicationCount === "number"));

  const ownerList = await call("GET", "/adoptions", { token: owner.token });
  check("owners see open listings", ownerList.body.listings.some((l) => l.id === listingId));
  check("owners are not given application counts",
    ownerList.body.listings.every((l) => l.applicationCount === undefined));

  const otherList = await call("GET", "/adoptions", { token: otherVet.token });
  check("another clinic doesn't see these listings",
    !otherList.body.listings.some((l) => l.id === listingId));

  const cats = await call("GET", "/adoptions?species=cat", { token: vet.token });
  check("the species filter works",
    cats.body.listings.length > 0 && cats.body.listings.every((l) => l.species === "cat"));

  const crossRead = await call("GET", `/adoptions/${listingId}`, { token: otherVet.token });
  check("another clinic gets 404 on a listing id, not 403",
    crossRead.status === 404, `got ${crossRead.status}`);

  const crossDelete = await call("DELETE", `/adoptions/${listingId}`, { token: otherVet.token });
  check("another clinic can't delete the listing", crossDelete.status === 404);

  // ---- 3. Applying --------------------------------------------------------
  section("3. Applying");

  const applied = await call("POST", `/adoptions/${listingId}/apply`, {
    token: owner.token,
    body: { message: "Verification application." }
  });
  check("an owner can apply", applied.status === 201, JSON.stringify(applied.body));
  check("a new application starts as applied", applied.body?.application?.status === "applied");

  const afterApply = await call("GET", `/adoptions/${listingId}`, { token: vet.token });
  check("the first application moves the listing to pending",
    afterApply.body?.listing?.status === "pending",
    `got ${afterApply.body?.listing?.status}`);

  const twice = await call("POST", `/adoptions/${listingId}/apply`, {
    token: owner.token,
    body: { message: "Again." }
  });
  check("the same person can't apply twice", twice.status === 409, `got ${twice.status}`);

  const staffApply = await call("POST", `/adoptions/${listingId}/apply`, {
    token: vet.token,
    body: { message: "Staff." }
  });
  check("staff can't apply to their own listings", staffApply.status === 403);

  const crossApply = await call("POST", `/adoptions/${listingId}/apply`, {
    token: otherOwner.token,
    body: { message: "Wrong clinic." }
  });
  check("an owner from another clinic can't apply", crossApply.status === 404);

  const ownerSees = await call("GET", "/adoptions/applications", { token: owner.token });
  check("an owner sees their own applications",
    ownerSees.body.applications.some((a) => a.listing?.id === listingId));
  check("an owner's own view carries no applicant block",
    ownerSees.body.applications.every((a) => a.applicant === null));

  const queue = await call("GET", "/adoptions/applications?status=applied", { token: vet.token });
  const mine = queue.body.applications.find((a) => a.listing?.id === listingId);
  check("staff see the application in the review queue", Boolean(mine));
  check("staff see the applicant's contact details",
    mine?.applicant?.email === owner.user.email, `got ${mine?.applicant?.email}`);

  const crossQueue = await call("GET", "/adoptions/applications", { token: otherVet.token });
  check("another clinic's queue doesn't include this application",
    !crossQueue.body.applications.some((a) => a.id === applied.body.application.id));

  // ---- 4. Withdrawing -----------------------------------------------------
  section("4. Withdrawing");

  const withdrawn = await call("DELETE", `/adoptions/applications/${applied.body.application.id}`, {
    token: owner.token
  });
  check("an owner can withdraw an open application", withdrawn.status === 200);

  const afterWithdraw = await call("GET", `/adoptions/${listingId}`, { token: vet.token });
  check("withdrawing the only application reopens the listing",
    afterWithdraw.body?.listing?.status === "available",
    `got ${afterWithdraw.body?.listing?.status}`);

  // ---- 5. Approve and reject ---------------------------------------------
  section("5. Deciding");

  const reapplied = await call("POST", `/adoptions/${listingId}/apply`, {
    token: owner.token,
    body: { message: "Second attempt." }
  });
  check("an owner can apply again after withdrawing", reapplied.status === 201);

  const applicationId = reapplied.body.application.id;

  const badDecision = await call("PUT", `/adoptions/applications/${applicationId}`, {
    token: vet.token,
    body: { status: "maybe" }
  });
  check("only approved or rejected are accepted", badDecision.status === 400);

  const ownerDecides = await call("PUT", `/adoptions/applications/${applicationId}`, {
    token: owner.token,
    body: { status: "approved" }
  });
  check("an owner can't approve their own application", ownerDecides.status === 403);

  const approved = await call("PUT", `/adoptions/applications/${applicationId}`, {
    token: vet.token,
    body: { status: "approved" }
  });
  check("a vet can approve an application", approved.status === 200);
  check("the application reads approved", approved.body?.application?.status === "approved");

  const afterApprove = await call("GET", `/adoptions/${listingId}`, { token: vet.token });
  check("approving marks the listing adopted",
    afterApprove.body?.listing?.status === "adopted",
    `got ${afterApprove.body?.listing?.status}`);

  const applyToAdopted = await call("POST", `/adoptions/${listingId}/apply`, {
    token: owner.token,
    body: { message: "Too late." }
  });
  check("nobody can apply to an adopted animal", applyToAdopted.status === 409);

  const rejectAfter = await call("PUT", `/adoptions/applications/${applicationId}`, {
    token: admin.token,
    body: { status: "rejected" }
  });
  check("an admin can also decide applications", rejectAfter.status === 200);

  const stillAdopted = await call("GET", `/adoptions/${listingId}`, { token: vet.token });
  check("adopted is terminal — a later rejection doesn't reopen the listing",
    stillAdopted.body?.listing?.status === "adopted",
    `got ${stillAdopted.body?.listing?.status}`);

  // ---- 6. Approving one rejects the rest ---------------------------------
  section("6. Approving one turns down the others");

  const contested = await call("POST", "/adoptions", {
    token: vet.token,
    form: listingForm({ name: "Verify-Contested" })
  });
  const contestedId = contested.body.listing.id;
  cleanup.push(contestedId);

  const appA = await call("POST", `/adoptions/${contestedId}/apply`, {
    token: owner.token,
    body: { message: "First." }
  });
  // A second applicant, created just for this check and removed afterwards.
  const secondOwner = await call("POST", "/auth/register", {
    body: {
      name: "Verify Applicant",
      email: `verify-applicant-${Date.now()}@example.test`,
      password: "password123",
      clinicId: String(owner.user.clinicId)
    }
  });
  const appB = await call("POST", `/adoptions/${contestedId}/apply`, {
    token: secondOwner.body.token,
    body: { message: "Second." }
  });
  check("two different owners can apply to the same listing",
    appA.status === 201 && appB.status === 201);

  await call("PUT", `/adoptions/applications/${appA.body.application.id}`, {
    token: vet.token,
    body: { status: "approved" }
  });

  const allForContested = await call("GET", "/adoptions/applications", { token: vet.token });
  const loser = allForContested.body.applications.find((a) => a.id === appB.body.application.id);
  check("the other applicant is rejected automatically",
    loser?.status === "rejected", `got ${loser?.status}`);

  // ---- 7. Auth ------------------------------------------------------------
  section("7. Authentication");

  check("anonymous browsing is rejected", (await call("GET", "/adoptions")).status === 401);
  check("anonymous applying is rejected",
    (await call("POST", `/adoptions/${listingId}/apply`)).status === 401);

  // ---- Cleanup ------------------------------------------------------------
  section("Cleanup");
  let removed = 0;
  for (const id of cleanup) {
    const res = await call("DELETE", `/adoptions/${id}`, { token: admin.token });
    if (res.status === 200) removed += 1;
  }
  check(`removed the ${cleanup.length} listings this script created`,
    removed === cleanup.length, `removed ${removed}`);
  console.log(
    `  \x1b[33mNOTE\x1b[0m  one throwaway owner account was created ` +
    `(${secondOwner.body?.user?.email}); remove it from the users collection if it bothers you.`
  );

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
