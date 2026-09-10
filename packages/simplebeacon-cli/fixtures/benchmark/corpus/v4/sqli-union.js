/**
 * V4 OOS — SQLi via UNION concatenation (not WHERE/ORDER BY).
 */
"use strict";

function buildUnionSearch(req) {
  const id = req.query.id || "0";
  // DELIBERATE VULNERABILITY — id concatenated enabling UNION injection
  return (
    "SELECT name, price FROM Products WHERE id = " +
    id +
    " UNION SELECT username, password FROM Users"
  );
}

module.exports = { buildUnionSearch };
