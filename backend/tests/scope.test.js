const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clinicFilter,
  scopedFilter,
  sameClinic,
  assertSameClinic,
  stripProtected
} = require("../src/utils/scope");
const { requireRole } = require("../src/middleware/rbac");
const { requireClinic } = require("../src/middleware/tenant");

const CLINIC_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const CLINIC_B = "bbbbbbbbbbbbbbbbbbbbbbbb";

const admin = { _id: "u1", role: "admin", clinicId: CLINIC_A };
const vet = { _id: "u2", role: "vet", clinicId: CLINIC_A };
const owner = { _id: "u3", role: "owner", clinicId: CLINIC_A };
const otherAdmin = { _id: "u4", role: "admin", clinicId: CLINIC_B };

test("staff filters are pinned to the caller's clinic", () => {
  assert.deepEqual(clinicFilter(admin), { clinicId: CLINIC_A });
  assert.deepEqual(clinicFilter(vet), { clinicId: CLINIC_A });
  assert.notDeepEqual(clinicFilter(otherAdmin), clinicFilter(admin));
});

test("owners are narrowed to their own rows on top of the clinic filter", () => {
  assert.deepEqual(scopedFilter(owner), { clinicId: CLINIC_A, ownerId: "u3" });
  assert.deepEqual(scopedFilter(owner, { ownerField: "applicantId" }), {
    clinicId: CLINIC_A,
    applicantId: "u3"
  });
});

test("staff are not narrowed by owner id", () => {
  assert.deepEqual(scopedFilter(vet), { clinicId: CLINIC_A });
  assert.equal("ownerId" in scopedFilter(admin), false);
});

test("a user with no clinic cannot produce a filter", () => {
  const orphan = { _id: "u9", role: "admin", clinicId: null };
  assert.throws(() => clinicFilter(orphan), /isn't attached to a clinic/);
  assert.throws(() => scopedFilter(orphan), /isn't attached to a clinic/);
});

test("cross-tenant documents are rejected as 404, not 403", () => {
  const docInB = { _id: "d1", clinicId: CLINIC_B };
  assert.equal(sameClinic(admin, docInB), false);
  try {
    assertSameClinic(admin, docInB, "Vet");
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err.status, 404, "must not confirm the record exists elsewhere");
    assert.match(err.message, /not found/i);
  }
});

test("a missing document is also 404", () => {
  assert.throws(() => assertSameClinic(admin, null), (e) => e.status === 404);
});

test("same-clinic documents pass through", () => {
  const docInA = { _id: "d2", clinicId: CLINIC_A };
  assert.equal(sameClinic(vet, docInA), true);
  assert.equal(assertSameClinic(vet, docInA), docInA);
});

test("clinicId comparison survives ObjectId vs string", () => {
  const objectIdish = { toString: () => CLINIC_A };
  assert.equal(sameClinic(admin, { clinicId: objectIdish }), true);
});

test("privilege fields are stripped from request bodies", () => {
  const body = {
    name: "Vikram",
    role: "admin",
    clinicId: CLINIC_B,
    passwordHash: "injected",
    _id: "forged"
  };
  assert.deepEqual(stripProtected(body), { name: "Vikram" });
  assert.equal(body.role, "admin", "input must not be mutated");
});

test("requireRole allows listed roles and blocks others", () => {
  const run = (user, ...roles) => {
    let err = null;
    requireRole(...roles)({ user }, {}, (e) => { err = e || null; });
    return err;
  };
  assert.equal(run(admin, "admin"), null);
  assert.equal(run(vet, "vet", "admin"), null);
  assert.equal(run(owner, "admin").status, 403);
  assert.equal(run(vet, "admin").status, 403);
  assert.equal(run(undefined, "admin").status, 401);
});

test("requireClinic blocks accounts with no clinic and attaches clinicId", () => {
  let err = null;
  const req = { user: admin };
  requireClinic(req, {}, (e) => { err = e || null; });
  assert.equal(err, null);
  assert.equal(req.clinicId, CLINIC_A);

  let err2 = null;
  requireClinic({ user: { role: "admin", clinicId: null } }, {}, (e) => { err2 = e; });
  assert.equal(err2.status, 403);
});
