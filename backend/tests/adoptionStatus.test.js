const test = require("node:test");
const assert = require("node:assert/strict");
const { nextListingStatus } = require("../src/utils/adoptionStatus");

test("a fresh listing with no applications is available", () => {
  assert.equal(nextListingStatus({ current: "available" }), "available");
});

test("the first application moves a listing to pending", () => {
  assert.equal(
    nextListingStatus({ current: "available", openCount: 1 }),
    "pending"
  );
});

test("approving an application marks the listing adopted", () => {
  assert.equal(
    nextListingStatus({ current: "pending", approvedCount: 1, openCount: 2 }),
    "adopted"
  );
});

test("withdrawing the only open application reopens the listing", () => {
  assert.equal(nextListingStatus({ current: "pending", openCount: 0 }), "available");
});

test("rejecting one of two applicants keeps the listing pending", () => {
  assert.equal(nextListingStatus({ current: "pending", openCount: 1 }), "pending");
});

test("adopted is terminal — a late rejection can't reopen it", () => {
  assert.equal(nextListingStatus({ current: "adopted", openCount: 0 }), "adopted");
  assert.equal(nextListingStatus({ current: "adopted", openCount: 3 }), "adopted");
  assert.equal(
    nextListingStatus({ current: "adopted", approvedCount: 0, openCount: 0 }),
    "adopted"
  );
});

test("an approval outranks open applications", () => {
  assert.equal(
    nextListingStatus({ current: "available", approvedCount: 1, openCount: 5 }),
    "adopted"
  );
});
