const Counter = require("../models/Counter");

/**
 * Builds the next pet code for the current year: PET-2026-0042.
 * The sequence comes from an atomic counter, and petCode carries a unique
 * index as a backstop, so concurrent registrations can't collide.
 */
async function generatePetCode(date = new Date()) {
  const year = date.getFullYear();
  const seq = await Counter.next(`petCode:${year}`);
  return `PET-${year}-${String(seq).padStart(4, "0")}`;
}

/** Normalises user input from a scan or the search box: "pet 2026 42" -> PET-2026-0042. */
function normalisePetCode(input = "") {
  const cleaned = String(input).trim().toUpperCase().replace(/[\s_]+/g, "-");
  const match = cleaned.match(/^(?:PET-)?(\d{4})-?(\d{1,6})$/);
  if (!match) return cleaned;
  return `PET-${match[1]}-${match[2].padStart(4, "0")}`;
}

module.exports = { generatePetCode, normalisePetCode };
