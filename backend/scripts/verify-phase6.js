/**
 * Phase 6 (vaccinations) end-to-end verification.
 *
 *   npm run dev              (one terminal)
 *   npm run seed             (once)
 *   npm run seed:vaccines    (once)
 *   npm run verify:6
 *
 * Cleans up every vaccination it records.
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

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    signal: AbortSignal.timeout(12000),
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

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const daysFromNow = (n) => new Date(Date.now() + n * 864e5);

(async () => {
  console.log(`\nVerifying Phase 6 against ${BASE}\n${"─".repeat(52)}`);

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

  const created = [];

  // ---- 1. Catalogue -------------------------------------------------------
  section("1. Vaccine catalogue");

  const cat = await call("GET", "/vaccines", { token: vet.token });
  check("the catalogue loads", cat.status === 200);
  if (!cat.body?.vaccineTypes?.length) {
    console.error('\n  The catalogue is empty. Run "npm run seed:vaccines" first.\n');
    process.exit(1);
  }
  check("it contains core dog and cat vaccines",
    cat.body.vaccineTypes.some((v) => v.name === "DHPP" && v.species === "dog") &&
    cat.body.vaccineTypes.some((v) => v.name === "FVRCP" && v.species === "cat"));

  const dogOnly = await call("GET", "/vaccines?species=dog", { token: vet.token });
  check("the species filter works",
    dogOnly.body.vaccineTypes.every((v) => v.species === "dog"));
  check("schedules ship as data, not code",
    dogOnly.body.vaccineTypes.find((v) => v.name === "DHPP")?.doseSchedule?.length > 0);

  const dhpp = cat.body.vaccineTypes.find((v) => v.name === "DHPP" && v.species === "dog");
  const fvrcp = cat.body.vaccineTypes.find((v) => v.name === "FVRCP" && v.species === "cat");

  // ---- 2. Per-pet schedule ------------------------------------------------
  section("2. A pet's schedule");

  const pets = await call("GET", "/pets", { token: vet.token });
  const biscuit = pets.body.pets.find((p) => p.name === "Biscuit"); // dog, has a DOB
  const marmalade = pets.body.pets.find((p) => p.name === "Marmalade"); // cat

  const sched = await call("GET", `/pets/${biscuit.id}/vaccinations`, { token: vet.token });
  check("the schedule loads for a pet", sched.status === 200);
  check("it lists only vaccines for that species",
    sched.body.schedule.every((s) => s.vaccineType.species === "dog"),
    "a dog must not be offered FVRCP");
  check("nothing is started yet", sched.body.schedule.every((s) => !s.started));
  check("a dog with a date of birth gets real due dates",
    sched.body.schedule.some((s) => s.next.dueDate !== null));

  const catSched = await call("GET", `/pets/${marmalade.id}/vaccinations`, { token: vet.token });
  check("a cat gets cat vaccines",
    catSched.body.schedule.some((s) => s.vaccineType.name === "FVRCP") &&
    !catSched.body.schedule.some((s) => s.vaccineType.name === "DHPP"));

  // ---- 3. Recording and the engine ---------------------------------------
  section("3. Recording a dose drives the next due date");

  const firstGiven = daysFromNow(-40);
  const dose1 = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token,
    body: { vaccineTypeId: dhpp.id, dateGiven: firstGiven.toISOString(), batchNumber: "TEST-001" }
  });
  if (dose1.body?.record?.id) created.push(dose1.body.record.id);

  check("a vet can record a vaccination", dose1.status === 201, JSON.stringify(dose1.body));
  check("the dose number defaults to 1", dose1.body?.record?.doseSequence === 1);
  check("a next due date is computed", Boolean(dose1.body?.next?.dueDate));
  check("the second dose is timed from the first, not from birth",
    iso(dose1.body.next.dueDate) === iso(new Date(firstGiven.getTime() + 21 * 864e5)),
    `got ${iso(dose1.body.next.dueDate)}, expected ${iso(new Date(firstGiven.getTime() + 21 * 864e5))}`);
  check("it is flagged as dose 2, not a booster",
    dose1.body.next.doseSequence === 2 && dose1.body.next.isBooster === false);

  const afterOne = await call("GET", `/pets/${biscuit.id}/vaccinations`, { token: vet.token });
  const dhppEntry = afterOne.body.schedule.find((s) => s.vaccineType.name === "DHPP");
  check("the schedule now shows the course started", dhppEntry.started === true);
  check("it reports 1 dose recorded", dhppEntry.doses.length === 1);
  check("a due date 19 days ago reads as overdue", dhppEntry.next.status === "overdue",
    `status was ${dhppEntry.next.status}`);
  check("the batch number is stored", dhppEntry.doses[0].batchNumber === "TEST-001");
  check("the dose is credited to the vet who gave it",
    dhppEntry.doses[0].givenBy === vet.user.name);

  const dose2 = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token,
    body: { vaccineTypeId: dhpp.id, dateGiven: daysFromNow(-19).toISOString() }
  });
  if (dose2.body?.record?.id) created.push(dose2.body.record.id);
  check("the dose number auto-increments", dose2.body?.record?.doseSequence === 2);
  check("the schedule advances to dose 3", dose2.body?.next?.doseSequence === 3);

  // ---- 4. Validation ------------------------------------------------------
  section("4. Validation");

  const wrongSpecies = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token,
    body: { vaccineTypeId: fvrcp.id }
  });
  check("a cat vaccine can't be given to a dog", wrongSpecies.status === 400,
    `got ${wrongSpecies.status}`);

  const future = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token,
    body: { vaccineTypeId: dhpp.id, dateGiven: daysFromNow(5).toISOString() }
  });
  check("a future date is rejected", future.status === 400);

  const beforeBirth = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token,
    body: { vaccineTypeId: dhpp.id, dateGiven: "2000-01-01" }
  });
  check("a date before the pet was born is rejected", beforeBirth.status === 400);

  const noVaccine = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: vet.token, body: {}
  });
  check("a vaccine must be chosen", noVaccine.status === 400);

  // ---- 5. Roles -----------------------------------------------------------
  section("5. Role limits");

  const ownerRecord = await call("POST", `/pets/${biscuit.id}/vaccinations`, {
    token: owner.token,
    body: { vaccineTypeId: dhpp.id }
  });
  check("an owner can't record a vaccination", ownerRecord.status === 403);

  const ownerRead = await call("GET", `/pets/${biscuit.id}/vaccinations`, { token: owner.token });
  check("the pet's owner can read the schedule", ownerRead.status === 200);

  // ---- 6. Tenant isolation ------------------------------------------------
  section("6. Tenant isolation");

  const crossRead = await call("GET", `/pets/${biscuit.id}/vaccinations`, {
    token: otherAdmin.token
  });
  check("another clinic gets 404 on the schedule", crossRead.status === 404);

  const crossDelete = await call("DELETE", `/vaccinations/${created[0]}`, {
    token: otherAdmin.token
  });
  check("another clinic can't delete a record", crossDelete.status === 404);

  const otherDue = await call("GET", "/vaccinations/due?days=365", { token: otherAdmin.token });
  check("another clinic's due list excludes these pets",
    !otherDue.body.due.some((d) => d.pet.name === "Biscuit"));

  // ---- 7. The due list ----------------------------------------------------
  section("7. What's due");

  const due = await call("GET", "/vaccinations/due?days=30", { token: vet.token });
  check("the due list loads", due.status === 200);
  check("Biscuit's overdue DHPP appears",
    due.body.due.some((d) => d.pet.name === "Biscuit" && d.vaccine?.name === "DHPP"),
    JSON.stringify(due.body.counts));
  check("it is sorted by due date",
    due.body.due.every((d, i, a) => i === 0 || new Date(a[i - 1].dueDate) <= new Date(d.dueDate)));
  check("overdue items are counted", due.body.counts.overdue > 0);
  check("staff see the owner's details for follow-up",
    due.body.due.find((d) => d.pet.name === "Biscuit")?.owner?.name === "Olive Byrne");

  const ownerDue = await call("GET", "/vaccinations/due?days=365", { token: owner.token });
  check("an owner sees their own pets' due list", ownerDue.status === 200);
  check("and only their own pets",
    ownerDue.body.due.every((d) => d.pet.name !== "Juno"));

  // ---- 8. Only the latest dose carries the due date -----------------------
  section("8. No duplicate reminders");

  const dueForBiscuit = due.body.due.filter(
    (d) => d.pet.name === "Biscuit" && d.vaccine?.name === "DHPP"
  );
  check("one due entry per vaccine, not one per dose given",
    dueForBiscuit.length === 1, `got ${dueForBiscuit.length}`);

  // ---- 9. Deleting recalculates ------------------------------------------
  section("9. Corrections recalculate the schedule");

  const removeSecond = await call("DELETE", `/vaccinations/${created[1]}`, { token: vet.token });
  check("a vet can remove a mistaken entry", removeSecond.status === 200);

  const afterDelete = await call("GET", `/pets/${biscuit.id}/vaccinations`, { token: vet.token });
  const entryAfter = afterDelete.body.schedule.find((s) => s.vaccineType.name === "DHPP");
  check("the course steps back to 1 dose", entryAfter.doses.length === 1);
  check("the next due date reverts to dose 2",
    entryAfter.next.doseSequence === 2,
    `got dose ${entryAfter.next.doseSequence}`);

  // ---- 10. Dashboard ------------------------------------------------------
  section("10. Dashboard counts");

  const stats = await call("GET", "/dashboard/stats", { token: vet.token });
  check("vaccination counts appear in dashboard stats",
    typeof stats.body?.counts?.vaccinationsDue === "number");
  check("overdue is counted separately", stats.body.counts.vaccinationsOverdue > 0);

  const ownerStats = await call("GET", "/dashboard/stats", { token: owner.token });
  check("an owner's vaccination count is scoped to their pets",
    ownerStats.body.counts.vaccinationsDue <= stats.body.counts.vaccinationsDue);

  // ---- 11. Auth -----------------------------------------------------------
  section("11. Authentication");
  check("the catalogue needs a token", (await call("GET", "/vaccines")).status === 401);
  check("the due list needs a token", (await call("GET", "/vaccinations/due")).status === 401);

  // ---- Cleanup ------------------------------------------------------------
  section("Cleanup");
  let removed = 0;
  for (const id of created) {
    const res = await call("DELETE", `/vaccinations/${id}`, { token: admin.token });
    if (res.status === 200 || res.status === 404) removed += 1;
  }
  check("removed the vaccinations this script recorded", removed === created.length);

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
