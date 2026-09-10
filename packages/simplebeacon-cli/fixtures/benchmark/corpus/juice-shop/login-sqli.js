/**
 * Juice Shop–style login SQL injection (minimal extract).
 * Inspired by OWASP Juice Shop routes/login.ts — MIT (see ../../juice-shop/NOTICE).
 *
 * Attack path (intentional):
 *   req.body.email / hashed password → string-interpolated SELECT
 */
"use strict";

function buildLoginQuery(req, hashFn) {
  const email = req.body.email || "";
  const password = hashFn(req.body.password || "");
  // DELIBERATE VULNERABILITY — email concatenated into SQL
  return (
    "SELECT * FROM Users WHERE email = '" +
    email +
    "' AND password = '" +
    password +
    "' AND deletedAt IS NULL"
  );
}

module.exports = { buildLoginQuery };
