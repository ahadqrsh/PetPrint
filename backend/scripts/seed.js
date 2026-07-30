// Dev convenience: two tenants, each staffed and with pets on file, so every
// role and cross-clinic isolation can be tested immediately.
//   npm run seed
require("dotenv").config();
const bcrypt = require("bcrypt");
const { connectDB } = require("../src/config/db");
const Clinic = require("../src/models/Clinic");
const User = require("../src/models/User");
const Pet = require("../src/models/Pet");
const MedicalRecord = require("../src/models/MedicalRecord");
const Counter = require("../src/models/Counter");
const AdoptionListing = require("../src/models/AdoptionListing");
const AdoptionApplication = require("../src/models/AdoptionApplication");
const { generatePetCode } = require("../src/utils/generatePetCode");

const PASSWORD = "password123"; // dev only

const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const yearsAgo = (n) => new Date(Date.now() - n * 365 * 864e5);

async function upsertUser(data, hash) {
  return User.findOneAndUpdate(
    { email: data.email },
    { ...data, passwordHash: hash },
    { upsert: true, new: true }
  );
}

async function seedPet({ owner, clinic, vet, pet, visits }) {
  let doc = await Pet.findOne({ name: pet.name, ownerId: owner._id });
  if (!doc) {
    doc = await Pet.create({ ...pet, petCode: await generatePetCode(), ownerId: owner._id, clinicId: clinic._id });
  }
  await MedicalRecord.deleteMany({ petId: doc._id });
  await MedicalRecord.insertMany(
    visits.map((v) => ({ ...v, petId: doc._id, vetId: vet._id, clinicId: clinic._id }))
  );
  return doc;
}

(async () => {
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");
  const hash = await bcrypt.hash(PASSWORD, 10);

  const ngo = await Clinic.findOneAndUpdate(
    { name: "Paws & Whiskers Rescue" },
    { name: "Paws & Whiskers Rescue", type: "ngo", plan: "free", address: "12 Shelter Lane", phone: "555-0101" },
    { upsert: true, new: true }
  );
  const priv = await Clinic.findOneAndUpdate(
    { name: "Northside Veterinary Clinic" },
    { name: "Northside Veterinary Clinic", type: "private", plan: "paid", address: "88 High Street", phone: "555-0202" },
    { upsert: true, new: true }
  );

  const [adminA, vetA, vetA2, ownerA, adminB, vetB, ownerB] = await Promise.all([
    upsertUser({ name: "Ada Mensah", email: "admin@ngo.test", role: "admin", clinicId: ngo._id, phone: "555-0110" }, hash),
    upsertUser({ name: "Vikram Rao", email: "vet@ngo.test", role: "vet", clinicId: ngo._id, phone: "555-0111" }, hash),
    upsertUser({ name: "Sofia Duarte", email: "vet2@ngo.test", role: "vet", clinicId: ngo._id, phone: "" }, hash),
    upsertUser({ name: "Olive Byrne", email: "owner@ngo.test", role: "owner", clinicId: ngo._id, phone: "555-0112" }, hash),
    upsertUser({ name: "Priya Nair", email: "admin@private.test", role: "admin", clinicId: priv._id, phone: "" }, hash),
    upsertUser({ name: "Tom Halloran", email: "vet@private.test", role: "vet", clinicId: priv._id, phone: "" }, hash),
    upsertUser({ name: "Marcus Webb", email: "owner@private.test", role: "owner", clinicId: priv._id, phone: "" }, hash)
  ]);

  const pets = [];
  pets.push(await seedPet({
    owner: ownerA, clinic: ngo, vet: vetA,
    pet: {
      name: "Biscuit", species: "dog", breed: "Cocker Spaniel", sex: "male",
      dateOfBirth: yearsAgo(4),
      allergies: ["Penicillin", "Chicken protein"],
      chronicConditions: ["Recurrent otitis externa"]
    },
    visits: [
      { visitDate: daysAgo(47), symptoms: "Head shaking, scratching at right ear, yeasty odour.", diagnosis: "Otitis externa, right ear.", treatment: "Ear flush in clinic. Otic drops twice daily for 7 days.", notes: "Third episode this year. Owner advised on drying ears after swimming." },
      { visitDate: daysAgo(146), symptoms: "None — routine.", diagnosis: "Healthy. Weight 14.2kg, up 0.4kg.", treatment: "DHPP booster given.", notes: "Do not use penicillin — reaction on file from 2024." },
      { visitDate: daysAgo(400), symptoms: "Lethargy, reduced appetite for two days.", diagnosis: "Mild gastroenteritis, likely dietary.", treatment: "Bland diet 3 days, fluids. Recheck if no improvement in 48h.", notes: "Owner reports he got into the bin." }
    ]
  }));

  pets.push(await seedPet({
    owner: ownerA, clinic: ngo, vet: vetA2,
    pet: {
      name: "Marmalade", species: "cat", breed: "Domestic Shorthair", sex: "female",
      dateOfBirth: yearsAgo(7), allergies: [], chronicConditions: ["Early-stage CKD"]
    },
    visits: [
      { visitDate: daysAgo(21), symptoms: "Increased thirst, some weight loss.", diagnosis: "IRIS stage 1 chronic kidney disease.", treatment: "Renal diet started. Bloods to be repeated in 3 months.", notes: "Owner coping well with the diet change." },
      { visitDate: daysAgo(190), symptoms: "Routine senior check.", diagnosis: "Mild dental tartar, otherwise well.", treatment: "Dental scale and polish booked.", notes: "" }
    ]
  }));

  pets.push(await seedPet({
    owner: ownerB, clinic: priv, vet: vetB,
    pet: {
      name: "Juno", species: "dog", breed: "Border Collie", sex: "female",
      dateOfBirth: yearsAgo(2), allergies: [], chronicConditions: []
    },
    visits: [
      { visitDate: daysAgo(9), symptoms: "Limping on left forelimb after agility session.", diagnosis: "Soft tissue strain.", treatment: "Rest 10 days, NSAIDs. Recheck if still lame.", notes: "" }
    ]
  }));

  // ---- Adoption listings -------------------------------------------------
  // No images: uploads belong to a real request, so these start photo-less and
  // exercise the placeholder path. Add photos through the UI.
  await AdoptionApplication.deleteMany({});
  await AdoptionListing.deleteMany({});

  const listings = await AdoptionListing.insertMany([
    {
      name: "Pepper", species: "dog", breed: "Lurcher cross",
      description:
        "Six-year-old lurcher, came in as a stray in March. Calm indoors, walks well on a lead, and would rather sleep on a sofa than chase anything. Fine with other dogs; untested with cats. Best suited to a quiet home.",
      status: "available", postedByVetId: vetA._id, clinicId: ngo._id
    },
    {
      name: "Clementine", species: "cat", breed: "Domestic Shorthair",
      description:
        "Two years old, spayed, fully vaccinated. Shy for the first week and then extremely affectionate. Litter trained. Would do well as the only cat in the house.",
      status: "available", postedByVetId: vetA2._id, clinicId: ngo._id
    },
    {
      name: "Rooster", species: "dog", breed: "Jack Russell Terrier",
      description:
        "Eight-year-old terrier with plenty of opinions and a bad knee. Needs an adult-only home and short walks. Fully house trained.",
      status: "available", postedByVetId: vetA._id, clinicId: ngo._id
    },
    {
      name: "Sable", species: "cat", breed: "Tabby",
      description:
        "Found in a barn with three kittens, all now homed. Sable is independent, good with children, and an excellent mouser.",
      status: "available", postedByVetId: vetB._id, clinicId: priv._id
    }
  ]);

  // One listing already has an application, so the review queue isn't empty
  // and the pending status is visible on first load.
  const pepper = listings.find((l) => l.name === "Pepper");
  await AdoptionApplication.create({
    listingId: pepper._id,
    applicantId: ownerA._id,
    clinicId: ngo._id,
    message:
      "We have a quiet house with a big garden and no other pets. I work from home four days a week, so Pepper wouldn't be left alone for long. We had a lurcher before and know the breed well.",
    status: "applied"
  });
  pepper.status = "pending";
  await pepper.save();

  console.log(`\nSeeded ${pets.length} pets and ${listings.length} adoption listings across 2 clinics. All accounts use password: ${PASSWORD}\n`);
  console.table([
    { email: "admin@ngo.test", role: "admin", clinic: "Paws & Whiskers" },
    { email: "vet@ngo.test", role: "vet", clinic: "Paws & Whiskers" },
    { email: "vet2@ngo.test", role: "vet", clinic: "Paws & Whiskers" },
    { email: "owner@ngo.test", role: "owner", clinic: "Paws & Whiskers" },
    { email: "admin@private.test", role: "admin", clinic: "Northside" },
    { email: "vet@private.test", role: "vet", clinic: "Northside" },
    { email: "owner@private.test", role: "owner", clinic: "Northside" }
  ]);
  console.log("\nPet codes:", pets.map((p) => `${p.name} ${p.petCode}`).join(" · "));
  console.log("Adoption: 3 listings at Paws & Whiskers (Pepper has 1 application), 1 at Northside\n");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
