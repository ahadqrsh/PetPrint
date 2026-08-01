const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeNextDue, dueStatus, buildPetSchedule, addDays, addWeeks, daysBetween
} = require("../src/services/vaccineEngine");

// A realistic puppy DHPP course: 3 doses from 6 weeks, 3 weeks apart, then
// annual boosters.
const DHPP = {
  _id: "vt1",
  name: "DHPP",
  species: "dog",
  isCore: true,
  doseSchedule: [
    { sequence: 1, minAgeWeeks: 6, intervalFromPrevDays: 0 },
    { sequence: 2, minAgeWeeks: 9, intervalFromPrevDays: 21 },
    { sequence: 3, minAgeWeeks: 12, intervalFromPrevDays: 21 }
  ],
  boosterIntervalDays: 365
};

// Booster-only, no primary course.
const RABIES = {
  _id: "vt2", name: "Rabies", species: "dog", isCore: true,
  doseSchedule: [], boosterIntervalDays: 1095
};

const iso = (d) => new Date(d).toISOString().slice(0, 10);

test("first dose is timed from the pet's birthday", () => {
  const dob = new Date("2026-01-01");
  const now = new Date("2026-01-05"); // pet is only a few days old
  const next = computeNextDue({ vaccineType: DHPP, doses: [], dateOfBirth: dob, now });

  assert.equal(iso(next.dueDate), iso(addWeeks(dob, 6)), "due at 6 weeks of age");
  assert.equal(next.doseSequence, 1);
  assert.equal(next.isBooster, false);
});

test("a pet already past the minimum age is due now, not in the past", () => {
  const dob = new Date("2020-01-01"); // adult dog, never vaccinated
  const now = new Date("2026-06-01");
  const next = computeNextDue({ vaccineType: DHPP, doses: [], dateOfBirth: dob, now });

  assert.equal(iso(next.dueDate), iso(now), "due today rather than in 2020");
});

test("without a date of birth the first dose can't be scheduled", () => {
  const next = computeNextDue({ vaccineType: DHPP, doses: [], dateOfBirth: null });
  assert.equal(next.dueDate, null);
  assert.match(next.reason, /date of birth/i);
});

test("the second dose is timed from the first, not from birth", () => {
  const dob = new Date("2026-01-01");
  const firstGiven = new Date("2026-03-01"); // given late, at ~8 weeks
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [{ doseSequence: 1, dateGiven: firstGiven }],
    dateOfBirth: dob,
    now: firstGiven
  });

  assert.equal(next.doseSequence, 2);
  assert.equal(iso(next.dueDate), iso(addDays(firstGiven, 21)),
    "21 days after the dose actually given");
});

test("minimum age wins when it falls after the interval", () => {
  const dob = new Date("2026-01-01");
  // Dose 1 given at 4 weeks (earlier than the schedule's 6-week minimum — it
  // happens, e.g. an orphan pup vaccinated early). 21 days later the pet is
  // only 7 weeks old, so the 9-week gate for dose 2 is what governs.
  const firstGiven = addWeeks(dob, 4);
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [{ doseSequence: 1, dateGiven: firstGiven }],
    dateOfBirth: dob,
    now: firstGiven
  });

  const byInterval = addDays(firstGiven, 21); // 7 weeks of age
  const byAge = addWeeks(dob, 9);
  assert.ok(byAge > byInterval, "precondition: age gate is later");
  assert.equal(iso(next.dueDate), iso(byAge), "the later of the two is used");
});

test("the interval wins when the pet is already old enough", () => {
  const dob = new Date("2026-01-01");
  // Dose 1 given late, at 20 weeks. The 9-week age gate is long past, so the
  // 21-day interval is what matters.
  const firstGiven = addWeeks(dob, 20);
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [{ doseSequence: 1, dateGiven: firstGiven }],
    dateOfBirth: dob,
    now: firstGiven
  });

  assert.equal(iso(next.dueDate), iso(addDays(firstGiven, 21)));
});

test("finishing the course switches to boosters", () => {
  const dob = new Date("2025-01-01");
  const last = new Date("2025-04-01");
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [
      { doseSequence: 1, dateGiven: new Date("2025-02-15") },
      { doseSequence: 2, dateGiven: new Date("2025-03-08") },
      { doseSequence: 3, dateGiven: last }
    ],
    dateOfBirth: dob,
    now: last
  });

  assert.equal(next.isBooster, true);
  assert.equal(next.courseComplete, true);
  assert.equal(next.doseSequence, 4);
  assert.equal(iso(next.dueDate), iso(addDays(last, 365)));
});

test("boosters repeat from the most recent dose, not the course end", () => {
  const first = new Date("2024-04-01");
  const booster = new Date("2025-04-10"); // given slightly late
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [
      { doseSequence: 1, dateGiven: new Date("2024-02-15") },
      { doseSequence: 2, dateGiven: new Date("2024-03-08") },
      { doseSequence: 3, dateGiven: first },
      { doseSequence: 4, dateGiven: booster }
    ],
    dateOfBirth: new Date("2024-01-01"),
    now: booster
  });

  assert.equal(iso(next.dueDate), iso(addDays(booster, 365)),
    "the clock restarts from the late booster");
});

test("a booster-only vaccine works with no primary course", () => {
  const given = new Date("2025-05-01");
  const next = computeNextDue({
    vaccineType: RABIES,
    doses: [{ doseSequence: 1, dateGiven: given }],
    dateOfBirth: new Date("2024-01-01"),
    now: given
  });

  assert.equal(next.isBooster, true);
  assert.equal(iso(next.dueDate), iso(addDays(given, 1095)), "three-year rabies");
});

test("doses recorded out of order still resolve correctly", () => {
  const dob = new Date("2025-01-01");
  const next = computeNextDue({
    vaccineType: DHPP,
    doses: [
      { doseSequence: 2, dateGiven: new Date("2025-03-08") },
      { doseSequence: 1, dateGiven: new Date("2025-02-15") }
    ],
    dateOfBirth: dob,
    now: new Date("2025-03-08")
  });

  assert.equal(next.doseSequence, 3, "picks up from the highest sequence given");
});

// ---- Status ---------------------------------------------------------------

test("status distinguishes overdue, due, and upcoming", () => {
  const now = new Date("2026-06-15");
  assert.equal(dueStatus(new Date("2026-06-01"), { now }).status, "overdue");
  assert.equal(dueStatus(new Date("2026-06-15"), { now }).status, "due");
  assert.equal(dueStatus(new Date("2026-07-01"), { now }).status, "due", "within 30 days");
  assert.equal(dueStatus(new Date("2026-12-01"), { now }).status, "upcoming");
  assert.equal(dueStatus(null, { now }).status, "unknown");
});

test("overdue labels count days, not months", () => {
  const now = new Date("2026-06-15");
  assert.equal(dueStatus(new Date("2026-06-14"), { now }).label, "1 day overdue");
  assert.equal(dueStatus(new Date("2026-06-05"), { now }).label, "10 days overdue");
  assert.equal(dueStatus(new Date("2026-06-15"), { now }).label, "Due today");
  assert.equal(dueStatus(new Date("2026-06-16"), { now }).label, "Due tomorrow");
});

test("time of day never affects the day count", () => {
  const now = new Date("2026-06-15T23:59:00Z");
  const due = new Date("2026-06-16T00:01:00Z");
  assert.equal(daysBetween(now, due), 1, "two minutes apart is still one day");
  assert.equal(dueStatus(due, { now }).status, "due");
});

// ---- Whole-pet schedule ---------------------------------------------------

test("the schedule covers only vaccines for the pet's species", () => {
  const FVRCP = { ...DHPP, _id: "vt3", name: "FVRCP", species: "cat" };
  const schedule = buildPetSchedule({
    pet: { species: "dog", dateOfBirth: new Date("2025-01-01") },
    vaccineTypes: [DHPP, RABIES, FVRCP],
    records: [],
    now: new Date("2026-06-15")
  });

  assert.equal(schedule.length, 2);
  assert.ok(!schedule.some((s) => s.vaccineType.name === "FVRCP"), "no cat vaccines for a dog");
});

test("overdue vaccines sort to the top", () => {
  const now = new Date("2026-06-15");
  const schedule = buildPetSchedule({
    pet: { species: "dog", dateOfBirth: new Date("2020-01-01") },
    vaccineTypes: [DHPP, RABIES],
    records: [
      // Rabies given 4 years ago on a 3-year cycle: overdue.
      { vaccineTypeId: "vt2", doseSequence: 1, dateGiven: new Date("2022-06-01") },
      // DHPP course complete last month: not due for another year.
      { vaccineTypeId: "vt1", doseSequence: 1, dateGiven: new Date("2026-03-01") },
      { vaccineTypeId: "vt1", doseSequence: 2, dateGiven: new Date("2026-03-22") },
      { vaccineTypeId: "vt1", doseSequence: 3, dateGiven: new Date("2026-05-15") }
    ],
    now
  });

  assert.equal(schedule[0].vaccineType.name, "Rabies");
  assert.equal(schedule[0].next.status, "overdue");
  assert.equal(schedule[1].next.status, "upcoming");
});

test("a pet's dose history is returned newest first", () => {
  const schedule = buildPetSchedule({
    pet: { species: "dog", dateOfBirth: new Date("2025-01-01") },
    vaccineTypes: [DHPP],
    records: [
      { _id: "r1", vaccineTypeId: "vt1", doseSequence: 1, dateGiven: new Date("2025-02-15") },
      { _id: "r2", vaccineTypeId: "vt1", doseSequence: 2, dateGiven: new Date("2025-03-08") }
    ],
    now: new Date("2026-06-15")
  });

  assert.equal(schedule[0].doses[0].doseSequence, 2, "most recent dose first");
  assert.equal(schedule[0].started, true);
});

test("a pet with no date of birth reports unknown rather than guessing", () => {
  const schedule = buildPetSchedule({
    pet: { species: "dog", dateOfBirth: null },
    vaccineTypes: [DHPP],
    records: [],
    now: new Date("2026-06-15")
  });

  assert.equal(schedule[0].next.status, "unknown");
  assert.equal(schedule[0].next.dueDate, null);
});
