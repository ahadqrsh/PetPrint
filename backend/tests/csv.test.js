const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRecordsCsv } = require("../src/services/csvService");

const owner = { _id: "o1", name: "Olive Byrne", email: "olive@test", phone: "555" };
const vet = { _id: "v1", name: "Vikram Rao" };

const pet = {
  _id: "p1", petCode: "PET-2026-0001", name: "Biscuit", species: "dog",
  breed: "Spaniel", sex: "male", dateOfBirth: new Date("2022-03-04"),
  allergies: ["Penicillin", "Chicken"], chronicConditions: ["Otitis"], ownerId: "o1"
};

test("one row per visit, newest first", () => {
  const { csv, rowCount } = buildRecordsCsv({
    pets: [pet],
    records: [
      { petId: "p1", vetId: "v1", visitDate: new Date("2026-01-01"), diagnosis: "Older" },
      { petId: "p1", vetId: "v1", visitDate: new Date("2026-06-01"), diagnosis: "Newer" }
    ],
    owners: [owner],
    vets: [vet]
  });

  assert.equal(rowCount, 2);
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 3, "header plus two rows");
  assert.ok(lines[1].includes("Newer"), "newest visit comes first");
  assert.ok(lines[2].includes("Older"));
});

test("a pet with no visits still appears", () => {
  const { csv, rowCount } = buildRecordsCsv({
    pets: [pet], records: [], owners: [owner], vets: []
  });
  assert.equal(rowCount, 1);
  assert.ok(csv.includes("No visits recorded"));
  assert.ok(csv.includes("PET-2026-0001"));
});

test("list fields are joined, not dropped", () => {
  const { csv } = buildRecordsCsv({ pets: [pet], records: [], owners: [owner], vets: [] });
  assert.ok(csv.includes("Penicillin; Chicken"), "allergies joined with semicolons");
});

test("dates are ISO so spreadsheets sort them", () => {
  const { csv } = buildRecordsCsv({
    pets: [pet],
    records: [{ petId: "p1", vetId: "v1", visitDate: new Date("2026-06-01T10:00:00Z") }],
    owners: [owner], vets: [vet]
  });
  assert.ok(csv.includes("2026-06-01"));
  assert.ok(csv.includes("2022-03-04"), "date of birth is ISO too");
});

test("commas and quotes in clinical text can't break the columns", () => {
  const { csv } = buildRecordsCsv({
    pets: [pet],
    records: [{
      petId: "p1", vetId: "v1", visitDate: new Date("2026-06-01"),
      notes: 'Owner said "he ate a sock", then, later, two more.'
    }],
    owners: [owner], vets: [vet]
  });
  const dataLine = csv.trim().split("\n")[1];
  // json2csv escapes inner quotes by doubling them and wraps the field.
  assert.ok(dataLine.includes('""he ate a sock""'), "inner quotes are escaped");
  assert.equal(csv.trim().split("\n").length, 2, "the row didn't split across lines");
});

test("a UTF-8 BOM is present so Excel reads accents correctly", () => {
  const { csv } = buildRecordsCsv({
    pets: [{ ...pet, name: "Chloë" }], records: [], owners: [owner], vets: []
  });
  assert.equal(csv.charCodeAt(0), 0xfeff);
});

test("a missing owner doesn't crash the export", () => {
  const { csv, rowCount } = buildRecordsCsv({
    pets: [{ ...pet, ownerId: "gone" }], records: [], owners: [], vets: []
  });
  assert.equal(rowCount, 1);
  assert.ok(csv.includes("Biscuit"));
});
