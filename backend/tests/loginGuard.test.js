const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_ATTEMPTS, isLocked, minutesRemaining, recordFailedAttempt, clearAttempts
} = require("../src/services/loginGuard");

function freshUser() {
  return { failedLoginAttempts: 0, lockUntil: null };
}

test("an account with no failures is not locked", () => {
  assert.equal(isLocked(freshUser()), false);
});

test("attempts below the threshold just increment", () => {
  let user = freshUser();
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    user = { ...user, ...recordFailedAttempt(user) };
    assert.equal(isLocked(user), false, `should not lock at attempt ${i}`);
    assert.equal(user.failedLoginAttempts, i);
  }
});

test("hitting the threshold locks the account", () => {
  let user = freshUser();
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    user = { ...user, ...recordFailedAttempt(user) };
  }
  assert.equal(isLocked(user), true);
  assert.equal(user.failedLoginAttempts, 0, "the counter resets once locked, the lock itself is the state");
});

test("the lock expires after its window", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const locked = recordFailedAttempt(
    { failedLoginAttempts: MAX_ATTEMPTS - 1, lockUntil: null },
    now
  );
  const user = { ...locked };

  assert.equal(isLocked(user, now), true, "locked right away");
  const justBefore = new Date(user.lockUntil.getTime() - 1000);
  assert.equal(isLocked(user, justBefore), true, "still locked a second before expiry");
  const justAfter = new Date(user.lockUntil.getTime() + 1000);
  assert.equal(isLocked(user, justAfter), false, "unlocked a second after expiry");
});

test("minutesRemaining counts down and hits zero once unlocked", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const user = recordFailedAttempt({ failedLoginAttempts: MAX_ATTEMPTS - 1, lockUntil: null }, now);
  assert.equal(minutesRemaining(user, now), 15);
  const halfway = new Date(now.getTime() + 7.5 * 60000);
  assert.ok(minutesRemaining(user, halfway) <= 8 && minutesRemaining(user, halfway) >= 7);
  assert.equal(minutesRemaining(user, new Date(user.lockUntil.getTime() + 1)), 0);
});

test("a correct login clears both the counter and the lock", () => {
  const lockedUser = { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + 60000) };
  const cleared = clearAttempts();
  const user = { ...lockedUser, ...cleared };
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockUntil, null);
  assert.equal(isLocked(user), false);
});

test("a lock does not somehow tighten on a subsequent failure while still locked", () => {
  // Defence in depth: the controller should check isLocked() before ever
  // calling recordFailedAttempt(), but confirm the function itself is inert
  // if called on an already-locked user with a reset counter.
  const now = new Date("2026-01-01T12:00:00Z");
  const locked = { failedLoginAttempts: 0, lockUntil: new Date(now.getTime() + 5 * 60000) };
  const result = recordFailedAttempt(locked, now);
  assert.equal(result.failedLoginAttempts, 1, "counts as a fresh attempt if called");
  assert.equal(result.lockUntil.getTime(), locked.lockUntil.getTime(), "does not extend an existing lock by itself");
});
