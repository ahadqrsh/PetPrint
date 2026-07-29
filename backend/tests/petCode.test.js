const test = require("node:test");
const assert = require("node:assert/strict");
const { normalisePetCode } = require("../src/utils/generatePetCode");

test("a well-formed code passes through untouched", () => {
  assert.equal(normalisePetCode("PET-2026-0042"), "PET-2026-0042");
});

test("scanner and typist variations land on the same code", () => {
  for (const input of [
    "pet-2026-0042",
    " PET-2026-0042 ",
    "PET-2026-42",
    "2026-0042",
    "2026-42",
    "pet 2026 42",
    "PET_2026_42"
  ]) {
    assert.equal(normalisePetCode(input), "PET-2026-0042", `failed on: ${input}`);
  }
});

test("sequence numbers are padded to four digits but can outgrow them", () => {
  assert.equal(normalisePetCode("PET-2026-7"), "PET-2026-0007");
  assert.equal(normalisePetCode("PET-2026-12345"), "PET-2026-12345");
});

test("junk is uppercased but not coerced into a fake code", () => {
  assert.equal(normalisePetCode("bella"), "BELLA");
  assert.equal(normalisePetCode(""), "");
});

test("regex-special input can't break the matcher", () => {
  assert.doesNotThrow(() => normalisePetCode("PET-2026-.*"));
});
