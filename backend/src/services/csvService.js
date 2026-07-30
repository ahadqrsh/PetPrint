const { Parser } = require("@json2csv/plainjs");

/**
 * One row per recorded visit, with the pet and owner denormalised onto it —
 * the shape someone actually wants when they open this in Excel. Pets with no
 * visits still get a row so nothing silently disappears from the export.
 */
const FIELDS = [
  { label: "Pet code", value: "petCode" },
  { label: "Pet name", value: "petName" },
  { label: "Species", value: "species" },
  { label: "Breed", value: "breed" },
  { label: "Sex", value: "sex" },
  { label: "Date of birth", value: "dateOfBirth" },
  { label: "Allergies", value: "allergies" },
  { label: "Ongoing conditions", value: "chronicConditions" },
  { label: "Owner name", value: "ownerName" },
  { label: "Owner email", value: "ownerEmail" },
  { label: "Owner phone", value: "ownerPhone" },
  { label: "Visit date", value: "visitDate" },
  { label: "Seen by", value: "vetName" },
  { label: "Symptoms", value: "symptoms" },
  { label: "Diagnosis", value: "diagnosis" },
  { label: "Treatment", value: "treatment" },
  { label: "Notes", value: "notes" }
];

// ISO dates so spreadsheets sort them correctly regardless of locale.
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function buildRecordsCsv({ pets, records, owners, vets }) {
  const ownerById = new Map(owners.map((o) => [String(o._id), o]));
  const vetById = new Map(vets.map((v) => [String(v._id), v]));
  const recordsByPet = new Map();
  for (const record of records) {
    const key = String(record.petId);
    if (!recordsByPet.has(key)) recordsByPet.set(key, []);
    recordsByPet.get(key).push(record);
  }

  const rows = [];
  for (const pet of pets) {
    const owner = ownerById.get(String(pet.ownerId));
    const base = {
      petCode: pet.petCode,
      petName: pet.name,
      species: pet.species,
      breed: pet.breed || "",
      sex: pet.sex,
      dateOfBirth: isoDate(pet.dateOfBirth),
      allergies: (pet.allergies || []).join("; "),
      chronicConditions: (pet.chronicConditions || []).join("; "),
      ownerName: owner?.name || "",
      ownerEmail: owner?.email || "",
      ownerPhone: owner?.phone || ""
    };

    const petRecords = (recordsByPet.get(String(pet._id)) || []).sort(
      (a, b) => new Date(b.visitDate) - new Date(a.visitDate)
    );

    if (petRecords.length === 0) {
      rows.push({
        ...base,
        visitDate: "",
        vetName: "",
        symptoms: "",
        diagnosis: "",
        treatment: "",
        notes: "No visits recorded"
      });
      continue;
    }

    for (const record of petRecords) {
      rows.push({
        ...base,
        visitDate: isoDate(record.visitDate),
        vetName: vetById.get(String(record.vetId))?.name || "",
        symptoms: record.symptoms || "",
        diagnosis: record.diagnosis || "",
        treatment: record.treatment || "",
        notes: record.notes || ""
      });
    }
  }

  // withBOM so Excel on Windows reads accented names as UTF-8.
  const parser = new Parser({ fields: FIELDS, withBOM: true });
  return { csv: parser.parse(rows), rowCount: rows.length };
}

module.exports = { buildRecordsCsv, FIELDS };
