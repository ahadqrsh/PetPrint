/**
 * Phase 7 (AI assistant) end-to-end verification.
 *
 *   npm run dev
 *   npm run verify:7
 *
 * Most checks run WITHOUT an ANTHROPIC_API_KEY, because the safety properties
 * must hold whether or not the assistant is switched on: the owner-summary
 * approval gate, role limits, and tenant isolation are not AI features.
 *
 * With a key set, it additionally drafts a real record and checks the model
 * didn't invent content.
 */
require("dotenv").config();

const BASE = process.env.VERIFY_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const PASSWORD = "password123";

let passed = 0;
const failures = [];
const skipped = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}
function skip(name, why) {
  skipped.push(name);
  console.log(`  \x1b[33mSKIP\x1b[0m  ${name} — ${why}`);
}
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(45000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: parsed };
}

async function login(email) {
  const res = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
  if (res.status === 401) throw new Error(`${email} isn't valid. Run "npm run seed".`);
  if (res.status !== 200) throw new Error(`Sign-in as ${email} returned ${res.status}.`);
  return { token: res.body.token, user: res.body.user };
}

(async () => {
  console.log(`\nVerifying Phase 7 against ${BASE}\n${"─".repeat(52)}`);

  try {
    const h = await call("GET", "/health");
    if (h.status !== 200) throw new Error();
  } catch {
    console.error(`\nNothing is listening at ${BASE}. Start it with "npm run dev".\n`);
    process.exit(1);
  }

  const vet = await login("vet@ngo.test");
  const admin = await login("admin@ngo.test");
  const owner = await login("owner@ngo.test");
  const otherAdmin = await login("admin@private.test");

  // ---- 1. Availability ----------------------------------------------------
  section("1. The assistant is optional");

  const status = await call("GET", "/ai/status", { token: vet.token });
  check("the status endpoint responds", status.status === 200);
  check("it reports whether the assistant is configured",
    typeof status.body?.available === "boolean");
  check("it carries a disclaimer for the UI to show",
    typeof status.body?.disclaimer === "string" && status.body.disclaimer.length > 10);

  const AI_ON = status.body.available;
  console.log(`         (assistant is ${AI_ON ? "ON — " + status.body.model : "OFF"})`);

  const anonStatus = await call("GET", "/ai/status");
  check("status still requires a token", anonStatus.status === 401);

  // ---- 2. A record to work with -------------------------------------------
  const pets = await call("GET", "/pets", { token: vet.token });
  const biscuit = pets.body.pets.find((p) => p.name === "Biscuit");

  const madeRecord = await call("POST", `/pets/${biscuit.id}/records`, {
    token: vet.token,
    body: {
      visitDate: new Date().toISOString(),
      symptoms: "Head shaking and scratching at the right ear for three days.",
      diagnosis: "Otitis externa, right ear.",
      treatment: "Ear flush in clinic. Otic drops twice daily for seven days.",
      notes: "Verification record."
    }
  });
  const recordId = madeRecord.body.record.id;
  check("a plain record saves with aiAssisted false",
    madeRecord.body.record.aiAssisted === false || madeRecord.body.record.aiAssisted === undefined);

  // ---- 3. Provenance ------------------------------------------------------
  section("2. AI provenance is recorded");

  const flagged = await call("POST", `/pets/${biscuit.id}/records`, {
    token: vet.token,
    body: {
      visitDate: new Date().toISOString(),
      diagnosis: "Verification, AI-flagged.",
      aiAssisted: true
    }
  });
  const flaggedId = flagged.body.record.id;
  check("a record can be marked AI-assisted", flagged.status === 201);

  const listed = await call("GET", `/pets/${biscuit.id}/records`, { token: vet.token });
  const flaggedBack = listed.body.records.find((r) => r.id === flaggedId);
  check("the flag survives a round trip", flaggedBack?.aiAssisted === true);
  check("an unflagged record stays unflagged",
    listed.body.records.find((r) => r.id === recordId)?.aiAssisted === false);

  // ---- 4. The approval gate — the important part --------------------------
  section("3. Owner summaries are withheld until released");

  const savedDraft = await call("PUT", `/records/${recordId}/owner-summary`, {
    token: vet.token,
    body: { summary: "SECRET-DRAFT-TEXT the owner must not see yet." }
  });
  check("a vet can save an unreleased draft", savedDraft.status === 200);
  check("it is not approved by default", savedDraft.body.approved === false);

  const staffView = await call("GET", `/pets/${biscuit.id}/records`, { token: vet.token });
  check("staff can see their own draft",
    staffView.body.records.find((r) => r.id === recordId)?.ownerSummary?.includes("SECRET-DRAFT"));

  const ownerView = await call("GET", `/pets/${biscuit.id}/records`, { token: owner.token });
  const ownerRecord = ownerView.body.records.find((r) => r.id === recordId);
  check("the owner receives an empty summary while it is unapproved",
    ownerRecord?.ownerSummary === "",
    `owner got: ${JSON.stringify(ownerRecord?.ownerSummary)}`);
  check("the draft text is nowhere in the owner's payload",
    !JSON.stringify(ownerView.body).includes("SECRET-DRAFT"),
    "an unapproved draft must not be sent to the client at all");
  check("approval metadata is staff-only",
    ownerRecord?.ownerSummaryApprovedAt === undefined);

  const released = await call("PUT", `/records/${recordId}/owner-summary`, {
    token: vet.token,
    body: { summary: "Biscuit had a sore right ear. We cleaned it and sent drops home.", approved: true }
  });
  check("a vet can release the summary", released.body.approved === true);

  const ownerAfter = await call("GET", `/pets/${biscuit.id}/records`, { token: owner.token });
  const releasedToOwner = ownerAfter.body.records.find((r) => r.id === recordId);
  check("the owner now receives it",
    releasedToOwner?.ownerSummary?.includes("sore right ear"));
  check("and it is marked approved", releasedToOwner?.ownerSummaryApproved === true);

  const withdrawn = await call("PUT", `/records/${recordId}/owner-summary`, {
    token: vet.token,
    body: { approved: false }
  });
  check("approval can be withdrawn", withdrawn.body.approved === false);

  const ownerAfterWithdraw = await call("GET", `/pets/${biscuit.id}/records`, { token: owner.token });
  check("withdrawing hides it from the owner again",
    ownerAfterWithdraw.body.records.find((r) => r.id === recordId)?.ownerSummary === "");

  const emptyApprove = await call("PUT", `/records/${flaggedId}/owner-summary`, {
    token: vet.token,
    body: { approved: true }
  });
  check("an empty summary can't be approved", emptyApprove.status === 400);

  // ---- 5. Roles and tenants ----------------------------------------------
  section("4. Role limits and isolation");

  const ownerWrites = await call("PUT", `/records/${recordId}/owner-summary`, {
    token: owner.token,
    body: { summary: "I approve my own summary.", approved: true }
  });
  check("an owner can't write or approve a summary", ownerWrites.status === 403);

  const ownerDrafts = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
    token: owner.token,
    body: { observations: "My dog seems unwell and has been shaking his head a lot." }
  });
  check("an owner can't use the drafting assistant", ownerDrafts.status === 403);

  const crossDraft = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
    token: otherAdmin.token,
    body: { observations: "Head shaking, right ear, inflamed canal, otitis externa noted." }
  });
  check("another clinic gets 404 on drafting for this pet", crossDraft.status === 404);

  const crossSummary = await call("PUT", `/records/${recordId}/owner-summary`, {
    token: otherAdmin.token,
    body: { summary: "Injected by another clinic." }
  });
  check("another clinic can't touch the summary", crossSummary.status === 404);

  const anonDraft = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
    body: { observations: "Head shaking, right ear, inflamed, otitis externa." }
  });
  check("drafting needs a token", anonDraft.status === 401);

  // ---- 6. Input screening -------------------------------------------------
  section("5. The assistant refuses clinical questions");

  const asks = [
    ["a request for a diagnosis", "What's wrong with this dog? He has been vomiting for two days."],
    ["a request for treatment advice", "Should I prescribe antibiotics for this ear infection?"],
    ["a request for a dose", "What dose of meloxicam should I give a 14kg spaniel?"]
  ];
  for (const [label, observations] of asks) {
    const res = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
      token: vet.token, body: { observations }
    });
    check(`${label} is refused with 400`, res.status === 400, `got ${res.status}`);
  }

  const tooShort = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
    token: vet.token, body: { observations: "ear" }
  });
  check("too-short input is refused", tooShort.status === 400);

  // ---- 7. Real drafting, only when a key is present -----------------------
  section("6. Drafting (needs ANTHROPIC_API_KEY)");

  if (!AI_ON) {
    skip("clinical drafting", "no API key configured");
    skip("owner summary drafting", "no API key configured");
    const off = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
      token: vet.token,
      body: { observations: "Head shaking, right ear, canal inflamed, yeasty smell. Otitis externa. Flushed, drops BID 7 days." }
    });
    check("with no key, drafting fails cleanly with 503", off.status === 503, `got ${off.status}`);
  } else {
    const observations =
      "Head shaking, right ear only. Canal red and inflamed, yeasty smell. " +
      "Otitis externa. Flushed in clinic, otic drops twice daily for 7 days. " +
      "Weight 14.2kg.";

    const drafted = await call("POST", `/pets/${biscuit.id}/ai/draft-record`, {
      token: vet.token, body: { observations }
    });
    check("a draft is returned", drafted.status === 200, JSON.stringify(drafted.body).slice(0, 200));
    check("it fills the record fields",
      typeof drafted.body?.draft?.symptoms === "string" &&
      typeof drafted.body?.draft?.diagnosis === "string");
    check("it is labelled as AI-assisted", drafted.body?.aiAssisted === true);

    const all = JSON.stringify(drafted.body.draft).toLowerCase();
    check("the vet's own diagnosis is preserved", all.includes("otitis"));
    check("the specific measurement survives verbatim", all.includes("14.2"));
    check("nothing is prescribed that the vet didn't write",
      !/\b(amoxicillin|prednisolone|metacam|meloxicam|recommend starting)\b/.test(all),
      `draft was: ${all.slice(0, 300)}`);

    const summary = await call("POST", `/records/${recordId}/ai/owner-summary`, {
      token: vet.token
    });
    check("an owner summary can be drafted", summary.status === 200);
    check("it comes back unapproved", summary.body?.approved === false);
    check("it is prose of a sensible length",
      typeof summary.body?.summary === "string" && summary.body.summary.length > 40);

    const ownerStillBlind = await call("GET", `/pets/${biscuit.id}/records`, { token: owner.token });
    check("the freshly drafted summary is still hidden from the owner",
      ownerStillBlind.body.records.find((r) => r.id === recordId)?.ownerSummary === "",
      "drafting must not release anything");
  }

  // ---- Cleanup ------------------------------------------------------------
  section("Cleanup");
  let removed = 0;
  for (const id of [recordId, flaggedId]) {
    const res = await call("DELETE", `/records/${id}`, { token: admin.token });
    if (res.status === 200) removed += 1;
  }
  check("removed the records this script created", removed === 2);

  console.log(`\n${"─".repeat(52)}`);
  if (failures.length === 0) {
    console.log(
      `\x1b[32mAll ${passed} checks passed.\x1b[0m` +
      (skipped.length ? ` \x1b[33m${skipped.length} skipped\x1b[0m (no API key).` : "") + "\n"
    );
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
