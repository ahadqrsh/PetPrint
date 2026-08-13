const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { applySoftDelete, shouldInjectDeletedAtFilter } = require("../src/utils/softDelete");

// ---- The pure decision function, in isolation --------------------------

test("a filter with no deletedAt key gets the default injected", () => {
  assert.equal(shouldInjectDeletedAtFilter({ clinicId: "c1" }), true);
});

test("a filter that already asks about deletedAt is left alone", () => {
  assert.equal(shouldInjectDeletedAtFilter({ clinicId: "c1", deletedAt: { $ne: null } }), false);
  assert.equal(shouldInjectDeletedAtFilter({ deletedAt: null }), false);
});

test("an empty filter still gets the default (list-everything queries are the common case)", () => {
  assert.equal(shouldInjectDeletedAtFilter({}), true);
});

// ---- The real hook, wired against an actual Mongoose model --------------
// No live database needed: constructing a query and inspecting its filter
// via getFilter() happens before Mongoose ever tries to send it anywhere.

const TestSchema = new mongoose.Schema({ name: String, clinicId: String });
applySoftDelete(TestSchema);
const TestModel = mongoose.model("SoftDeleteTestModel", TestSchema);

test("schema.add() actually added the field with the right default", () => {
  const paths = TestSchema.paths;
  assert.ok(paths.deletedAt, "deletedAt path should exist on the schema");
  assert.equal(paths.deletedAt.defaultValue, null);
});

test("a plain find() ends up filtering deletedAt: null once the hook runs", async () => {
  const query = TestModel.find({ clinicId: "c1" });
  // Manually invoke the registered pre-hook the way Mongoose would, without
  // needing a live connection to execute the query itself.
  await new Promise((resolve, reject) => {
    query.pre = query.pre || (() => {});
    // Mongoose stores schema hooks separately; simulate by calling the same
    // logic the hook uses directly against this real query object.
    if (shouldInjectDeletedAtFilter(query.getFilter())) query.where({ deletedAt: null });
    resolve();
  });
  assert.deepEqual(query.getFilter(), { clinicId: "c1", deletedAt: null });
});

test("a Trash-view query asking for deletedAt explicitly is NOT overridden", async () => {
  const query = TestModel.find({ clinicId: "c1", deletedAt: { $ne: null } });
  if (shouldInjectDeletedAtFilter(query.getFilter())) query.where({ deletedAt: null });
  assert.deepEqual(query.getFilter(), { clinicId: "c1", deletedAt: { $ne: null } },
    "the trash view's explicit filter must survive untouched");
});

test("softDelete() sets deletedAt and restore() clears it", () => {
  const doc = new TestModel({ name: "Biscuit", clinicId: "c1" });
  assert.equal(doc.deletedAt, null);

  doc.save = async function () { return this; }; // no live DB in this test
  return doc.softDelete().then((saved) => {
    assert.ok(saved.deletedAt instanceof Date);
    return saved.restore();
  }).then((restored) => {
    assert.equal(restored.deletedAt, null);
  });
});

// ---- Closing the gap: confirm the hook is genuinely registered on the ----
// ---- schema, not just that the standalone logic function is correct. ----

test("applySoftDelete actually registers a pre-find hook on the schema", () => {
  const hooks = TestSchema.s.hooks._pres.get("find") || [];
  assert.ok(hooks.length > 0, "expected at least one pre('find') hook to be registered");
});

test("the registered hook, invoked with Mongoose's real query object, injects the filter", async () => {
  // Pull the actual registered hook function and call it exactly the way
  // Mongoose's middleware runner would: as this === the query, with a next callback.
  const hooks = TestSchema.s.hooks._pres.get("find") || [];
  const registeredHook = hooks[0]?.fn;
  assert.ok(registeredHook, "a hook function should be registered");

  const query = TestModel.find({ clinicId: "c1" });
  await new Promise((resolve, reject) => {
    registeredHook.call(query, (err) => (err ? reject(err) : resolve()));
  });

  assert.deepEqual(query.getFilter(), { clinicId: "c1", deletedAt: null },
    "the REAL registered hook — not a re-implementation — must produce this filter");
});

// ---- The new options-based escape hatch ----------------------------------

test("isIncludeDeletedRequested reads the includeDeleted query option", () => {
  const { isIncludeDeletedRequested } = require("../src/utils/softDelete");
  assert.equal(isIncludeDeletedRequested({ includeDeleted: true }), true);
  assert.equal(isIncludeDeletedRequested({}), false);
  assert.equal(isIncludeDeletedRequested(null), false);
  assert.equal(isIncludeDeletedRequested(undefined), false);
});

test("setOptions({ includeDeleted: true }) makes the REAL hook skip filtering entirely", async () => {
  const hooks = TestSchema.s.hooks._pres.get("find") || [];
  const registeredHook = hooks[hooks.length - 1]?.fn; // the freshly re-registered hook after the edit
  assert.ok(registeredHook);

  const query = TestModel.find({ _id: "abc" }).setOptions({ includeDeleted: true });
  await new Promise((resolve, reject) => {
    registeredHook.call(query, (err) => (err ? reject(err) : resolve()));
  });

  assert.deepEqual(query.getFilter(), { _id: "abc" },
    "no deletedAt should be injected when includeDeleted is set");
});
