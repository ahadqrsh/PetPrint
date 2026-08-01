/**
 * Vaccination due-date engine.
 *
 * Pure functions only — no database, no clock beyond what's passed in — so the
 * rules can be tested exhaustively and reused by the API, the PDF, and the
 * reminder scan without three copies of the logic.
 *
 * The rule, in one sentence: the first dose of a course is timed from the pet's
 * birthday, each later dose from the previous dose, and once the course is
 * finished the booster interval repeats forever.
 */

const DAY = 864e5;

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY);
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

/** Midnight-aligned so comparisons don't hinge on the time of day. */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

/**
 * When is the pet's next dose of this vaccine due?
 *
 * @param {object}   vaccineType  doseSchedule + boosterIntervalDays
 * @param {Array}    doses        this pet's records for this vaccine
 * @param {Date}     dateOfBirth  may be null — see below
 * @returns {{ dueDate: Date|null, doseSequence: number, isBooster: boolean,
 *             courseComplete: boolean, reason: string }}
 *
 * With no doses recorded and no date of birth we can't time the first dose from
 * anything, so dueDate is null and the caller shows "date of birth needed"
 * rather than inventing a date.
 */
function computeNextDue({ vaccineType, doses = [], dateOfBirth = null, now = new Date() }) {
  const schedule = [...(vaccineType.doseSchedule || [])].sort((a, b) => a.sequence - b.sequence);
  const boosterDays = vaccineType.boosterIntervalDays || 365;

  const given = [...doses]
    .filter((d) => d.dateGiven)
    .sort((a, b) => new Date(a.dateGiven) - new Date(b.dateGiven));

  // ---- Nothing given yet: the first dose of the primary course -------------
  if (given.length === 0) {
    const first = schedule[0];

    if (!first) {
      // No primary course defined (a booster-only vaccine, e.g. annual rabies).
      return {
        dueDate: dateOfBirth ? addDays(dateOfBirth, boosterDays) : null,
        doseSequence: 1,
        isBooster: true,
        courseComplete: false,
        reason: dateOfBirth ? "First dose, timed from birth" : "Date of birth needed"
      };
    }

    if (!dateOfBirth) {
      return {
        dueDate: null,
        doseSequence: first.sequence,
        isBooster: false,
        courseComplete: false,
        reason: "Date of birth needed to schedule the first dose"
      };
    }

    // Never earlier than the minimum age; if the pet is already older than
    // that, it's due now rather than retroactively.
    const earliest = addWeeks(dateOfBirth, first.minAgeWeeks || 0);
    return {
      dueDate: earliest < startOfDay(now) ? startOfDay(now) : earliest,
      doseSequence: first.sequence,
      isBooster: false,
      courseComplete: false,
      reason: `Dose ${first.sequence} — from ${first.minAgeWeeks || 0} weeks of age`
    };
  }

  // ---- Part-way through, or past, the primary course ----------------------
  const lastDose = given[given.length - 1];
  const highestSequence = Math.max(...given.map((d) => d.doseSequence || 0));
  const nextInCourse = schedule.find((s) => s.sequence > highestSequence);

  if (nextInCourse) {
    // Each later dose is timed from the previous one, but still can't be given
    // before the pet reaches the minimum age for it.
    const fromPrevious = addDays(lastDose.dateGiven, nextInCourse.intervalFromPrevDays || 0);
    const byAge = dateOfBirth
      ? addWeeks(dateOfBirth, nextInCourse.minAgeWeeks || 0)
      : null;

    const dueDate = byAge && byAge > fromPrevious ? byAge : fromPrevious;

    return {
      dueDate,
      doseSequence: nextInCourse.sequence,
      isBooster: false,
      courseComplete: false,
      reason: `Dose ${nextInCourse.sequence} — ${nextInCourse.intervalFromPrevDays || 0} days after the previous dose`
    };
  }

  // ---- Course finished: boosters from here on ----------------------------
  return {
    dueDate: addDays(lastDose.dateGiven, boosterDays),
    doseSequence: highestSequence + 1,
    isBooster: true,
    courseComplete: true,
    reason: `Booster — every ${boosterDays} days`
  };
}

/**
 * Turns a due date into something a UI can colour and sort by.
 * overdue < due (within the window) < upcoming < unknown
 */
function dueStatus(dueDate, { now = new Date(), soonDays = 30 } = {}) {
  if (!dueDate) return { status: "unknown", days: null, label: "Not scheduled" };

  const days = daysBetween(now, dueDate);

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      status: "overdue",
      days,
      label: overdue === 1 ? "1 day overdue" : `${overdue} days overdue`
    };
  }
  if (days === 0) return { status: "due", days, label: "Due today" };
  if (days <= soonDays) {
    return { status: "due", days, label: days === 1 ? "Due tomorrow" : `Due in ${days} days` };
  }
  return { status: "upcoming", days, label: `Due in ${Math.round(days / 30)} mo` };
}

/**
 * The full picture for one pet: every vaccine relevant to its species, whether
 * it's been started, and when the next dose is due.
 */
function buildPetSchedule({ pet, vaccineTypes, records, now = new Date() }) {
  const byType = new Map();
  for (const record of records) {
    const key = String(record.vaccineTypeId);
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(record);
  }

  return vaccineTypes
    .filter((type) => type.species === pet.species)
    .map((type) => {
      const doses = byType.get(String(type._id)) || [];
      const next = computeNextDue({
        vaccineType: type,
        doses,
        dateOfBirth: pet.dateOfBirth,
        now
      });
      const status = dueStatus(next.dueDate, { now });

      return {
        vaccineType: {
          id: type._id,
          name: type.name,
          species: type.species,
          isCore: type.isCore,
          totalDoses: (type.doseSchedule || []).length,
          boosterIntervalDays: type.boosterIntervalDays,
          notes: type.notes
        },
        doses: [...doses]
          .sort((a, b) => new Date(b.dateGiven) - new Date(a.dateGiven))
          .map((d) => ({
            id: d._id,
            doseSequence: d.doseSequence,
            dateGiven: d.dateGiven,
            batchNumber: d.batchNumber,
            site: d.site,
            notes: d.notes,
            givenByVetId: d.givenByVetId
          })),
        started: doses.length > 0,
        next: { ...next, ...status }
      };
    })
    // Anything overdue first, then due, then everything else by date.
    .sort((a, b) => {
      const rank = { overdue: 0, due: 1, upcoming: 2, unknown: 3 };
      const byStatus = rank[a.next.status] - rank[b.next.status];
      if (byStatus !== 0) return byStatus;
      if (a.next.dueDate && b.next.dueDate) {
        return new Date(a.next.dueDate) - new Date(b.next.dueDate);
      }
      return a.vaccineType.name.localeCompare(b.vaccineType.name);
    });
}

module.exports = {
  computeNextDue,
  dueStatus,
  buildPetSchedule,
  addDays,
  addWeeks,
  startOfDay,
  daysBetween
};
