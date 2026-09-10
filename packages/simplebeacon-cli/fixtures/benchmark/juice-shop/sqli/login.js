/**
 * Juice Shop–style SQL injection surface (minimal extract for Track 2 benchmarks).
 * Inspired by OWASP Juice Shop login challenges — synthetic, not a full clone.
 *
 * Attack path (intentional):
 *   req.body.email / req.body.password → string-interpolated SQL
 */
"use strict";

function buildLoginQuery(req) {
  const email = req.body.email;
  const password = req.body.password;
  // DELIBERATE VULNERABILITY — attacker-controlled SQL concatenation
  return (
    "SELECT * FROM Users WHERE email = '" +
    email +
    "' AND password = '" +
    password +
    "'"
  );
}

module.exports = { buildLoginQuery };
