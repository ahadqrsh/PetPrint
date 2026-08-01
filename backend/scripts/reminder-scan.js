/**
 * Vaccination reminder scan.
 *
 * Finds every vaccination due in the next N days and emails the pet's owner
 * once per pet — one message listing everything due, rather than one per
 * vaccine, which is how you get people to unsubscribe.
 *
 * Designed to run as a scheduled job (Render Cron Job, or any scheduler):
 *   node scripts/reminder-scan.js
 *   node scripts/reminder-scan.js --days 14 --dry-run
 *
 * Safe to run more than once a day: with --dry-run nothing is sent, and
 * without it the same reminder simply goes out again, so pick a daily
 * schedule rather than hourly.
 */
require("dotenv").config();
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");

const Pet = require("../src/models/Pet");
const User = require("../src/models/User");
const Clinic = require("../src/models/Clinic");
const VaccineType = require("../src/models/VaccineType");
const VaccinationRecord = require("../src/models/VaccinationRecord");
const notify = require("../src/services/emailService");
const { dueStatus } = require("../src/services/vaccineEngine");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
}
const DRY_RUN = process.argv.includes("--dry-run");
const WITHIN_DAYS = Number(arg("--days", 14));

(async () => {
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");

  const horizon = new Date(Date.now() + WITHIN_DAYS * 864e5);
  const records = await VaccinationRecord.find({
    nextDueDate: { $ne: null, $lte: horizon }
  }).lean();

  if (records.length === 0) {
    console.log(`Nothing due within ${WITHIN_DAYS} days. Nothing to send.`);
    await mongoose.connection.close();
    return;
  }

  const [pets, types] = await Promise.all([
    Pet.find({ _id: { $in: records.map((r) => r.petId) } }).lean(),
    VaccineType.find({ _id: { $in: records.map((r) => r.vaccineTypeId) } }).lean()
  ]);
  const petById = new Map(pets.map((p) => [String(p._id), p]));
  const typeById = new Map(types.map((t) => [String(t._id), t]));

  const [owners, clinics] = await Promise.all([
    User.find({ _id: { $in: pets.map((p) => p.ownerId) } }, "name email").lean(),
    Clinic.find({ _id: { $in: pets.map((p) => p.clinicId) } }, "name phone").lean()
  ]);
  const ownerById = new Map(owners.map((o) => [String(o._id), o]));
  const clinicById = new Map(clinics.map((c) => [String(c._id), c]));

  // Group by pet so an owner gets one message per animal.
  const byPet = new Map();
  for (const record of records) {
    const pet = petById.get(String(record.petId));
    if (!pet) continue; // orphaned record, pet deleted
    const key = String(pet._id);
    if (!byPet.has(key)) byPet.set(key, { pet, items: [] });

    const type = typeById.get(String(record.vaccineTypeId));
    byPet.get(key).items.push({
      name: type?.name || "Vaccination",
      dueDate: record.nextDueDate,
      ...dueStatus(record.nextDueDate)
    });
  }

  let sent = 0;
  let skipped = 0;

  for (const { pet, items } of byPet.values()) {
    const owner = ownerById.get(String(pet.ownerId));
    if (!owner?.email) {
      skipped += 1;
      continue;
    }
    const clinic = clinicById.get(String(pet.clinicId));
    items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const overdue = items.filter((i) => i.status === "overdue");
    const lines = items.map((i) => `${i.name} — ${i.label}`);

    const subject = overdue.length
      ? `${pet.name}'s ${overdue.length > 1 ? "vaccinations are" : "vaccination is"} overdue`
      : `${pet.name}'s vaccination is due soon`;

    const body = [
      `${pet.name} (${pet.petCode}) has ${items.length === 1 ? "a vaccination" : "vaccinations"} coming up:`,
      "",
      ...lines.map((l) => `  · ${l}`),
      "",
      clinic ? `Contact ${clinic.name}${clinic.phone ? ` on ${clinic.phone}` : ""} to book.` : ""
    ].join("\n");

    if (DRY_RUN) {
      console.log(`[dry-run] ${owner.email} — ${subject}`);
      lines.forEach((l) => console.log(`            ${l}`));
    } else {
      notify.queueMail({ to: owner.email, subject, text: body });
    }
    sent += 1;
  }

  console.log(
    `\n${DRY_RUN ? "Would send" : "Queued"} ${sent} reminder${sent === 1 ? "" : "s"} ` +
    `covering ${records.length} vaccination${records.length === 1 ? "" : "s"} due within ${WITHIN_DAYS} days.` +
    (skipped ? ` Skipped ${skipped} pet(s) with no owner email.` : "")
  );
  if (!DRY_RUN && !notify.EMAIL_CONFIGURED) {
    console.log("EMAIL_USER/EMAIL_PASS aren't set, so these were logged rather than sent.");
  }

  // Give queued mail a moment to flush before the process exits.
  setTimeout(async () => {
    await mongoose.connection.close();
    process.exit(0);
  }, 2000);
})().catch(async (err) => {
  console.error("Reminder scan failed:", err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
