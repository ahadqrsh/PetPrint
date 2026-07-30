/**
 * Derives a listing's status from its applications.
 *
 *   an approved application -> adopted
 *   any application still open -> pending
 *   otherwise -> available
 *
 * Adopted is terminal: once an animal has gone home, withdrawing or rejecting a
 * leftover application must not put it back on the board.
 */
function nextListingStatus({ current, approvedCount = 0, openCount = 0 }) {
  if (current === "adopted") return "adopted";
  if (approvedCount > 0) return "adopted";
  return openCount > 0 ? "pending" : "available";
}

module.exports = { nextListingStatus };
