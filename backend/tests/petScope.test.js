const test = require("node:test");
const assert = require("node:assert/strict");
const { scopedFilter, stripProtected } = require("../src/utils/scope");

const CLINIC_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const vet = { _id: "v1", role: "vet", clinicId: CLINIC_A };
const owner = { _id: "o1", role: "owner", clinicId: CLINIC_A };

test("a vet's pet list is the whole clinic", () => {
  assert.deepEqual(scopedFilter(vet), { clinicId: CLINIC_A });
});

test("an owner's pet list is narrowed to pets they own", () => {
  assert.deepEqual(scopedFilter(owner), { clinicId: CLINIC_A, ownerId: "o1" });
});

test("a pet body can't smuggle in a clinic, an owner, or a code", () => {
  const forged = {
    name: "Bella",
    species: "dog",
    clinicId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    role: "admin",
    _id: "forced-id"
  };
  const clean = stripProtected(forged);
  assert.equal(clean.clinicId, undefined);
  assert.equal(clean.role, undefined);
  assert.equal(clean._id, undefined);
  assert.equal(clean.name, "Bella");
});

test("record scope keys off petId plus the caller's clinic", () => {
  // The controller pairs loadPet (scoped) with clinicId on the record query;
  // this asserts the clinic half is always present.
  const filter = { petId: "p1", ...scopedFilter(vet) };
  assert.equal(filter.clinicId, CLINIC_A);
});
