/**
 * Seeds the global vaccine catalogue (clinicId: null — visible to every clinic).
 *
 * Schedules follow common small-animal practice, but they are deliberately
 * *data*: a clinic that does things differently adds its own VaccineType with
 * the same name and species, and that overrides the global entry for them
 * without affecting anyone else.
 *
 *   npm run seed:vaccines
 */
require("dotenv").config();
const { connectDB } = require("../src/config/db");
const VaccineType = require("../src/models/VaccineType");

const CATALOGUE = [
  {
    name: "DHPP",
    species: "dog",
    isCore: true,
    doseSchedule: [
      { sequence: 1, minAgeWeeks: 6, intervalFromPrevDays: 0 },
      { sequence: 2, minAgeWeeks: 9, intervalFromPrevDays: 21 },
      { sequence: 3, minAgeWeeks: 12, intervalFromPrevDays: 21 },
      { sequence: 4, minAgeWeeks: 16, intervalFromPrevDays: 21 }
    ],
    boosterIntervalDays: 1095,
    notes: "Distemper, hepatitis, parainfluenza, parvovirus. Final puppy dose at 16 weeks or later."
  },
  {
    name: "Rabies",
    species: "dog",
    isCore: true,
    doseSchedule: [{ sequence: 1, minAgeWeeks: 12, intervalFromPrevDays: 0 }],
    boosterIntervalDays: 1095,
    notes: "Booster interval varies by jurisdiction — check local law before relying on this."
  },
  {
    name: "Leptospirosis",
    species: "dog",
    isCore: false,
    doseSchedule: [
      { sequence: 1, minAgeWeeks: 8, intervalFromPrevDays: 0 },
      { sequence: 2, minAgeWeeks: 12, intervalFromPrevDays: 28 }
    ],
    boosterIntervalDays: 365,
    notes: "Lifestyle vaccine — dogs with access to standing water or livestock."
  },
  {
    name: "Bordetella",
    species: "dog",
    isCore: false,
    doseSchedule: [{ sequence: 1, minAgeWeeks: 8, intervalFromPrevDays: 0 }],
    boosterIntervalDays: 365,
    notes: "Kennel cough. Often required before boarding."
  },
  {
    name: "FVRCP",
    species: "cat",
    isCore: true,
    doseSchedule: [
      { sequence: 1, minAgeWeeks: 6, intervalFromPrevDays: 0 },
      { sequence: 2, minAgeWeeks: 9, intervalFromPrevDays: 21 },
      { sequence: 3, minAgeWeeks: 12, intervalFromPrevDays: 21 },
      { sequence: 4, minAgeWeeks: 16, intervalFromPrevDays: 21 }
    ],
    boosterIntervalDays: 1095,
    notes: "Rhinotracheitis, calicivirus, panleukopenia."
  },
  {
    name: "Rabies",
    species: "cat",
    isCore: true,
    doseSchedule: [{ sequence: 1, minAgeWeeks: 12, intervalFromPrevDays: 0 }],
    boosterIntervalDays: 1095,
    notes: "Booster interval varies by jurisdiction."
  },
  {
    name: "Chlamydia felis",
    species: "cat",
    isCore: false,
    doseSchedule: [
      { sequence: 1, minAgeWeeks: 9, intervalFromPrevDays: 0 },
      { sequence: 2, minAgeWeeks: 12, intervalFromPrevDays: 21 }
    ],
    boosterIntervalDays: 365,
    notes: "Conjunctivitis. Mainly for multi-cat households and shelters."
  },
  {
    name: "FeLV",
    species: "cat",
    isCore: false,
    doseSchedule: [
      { sequence: 1, minAgeWeeks: 8, intervalFromPrevDays: 0 },
      { sequence: 2, minAgeWeeks: 12, intervalFromPrevDays: 21 }
    ],
    boosterIntervalDays: 365,
    notes: "Feline leukaemia. Recommended for cats with outdoor access."
  }
];

(async () => {
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");

  for (const entry of CATALOGUE) {
    await VaccineType.findOneAndUpdate(
      { name: entry.name, species: entry.species, clinicId: null },
      { ...entry, clinicId: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`\nSeeded ${CATALOGUE.length} vaccine types into the global catalogue.\n`);
  console.table(
    CATALOGUE.map((v) => ({
      vaccine: v.name,
      species: v.species,
      core: v.isCore ? "yes" : "",
      doses: v.doseSchedule.length,
      booster: `${v.boosterIntervalDays} days`
    }))
  );
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
