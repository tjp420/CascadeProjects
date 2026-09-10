/**
 * HARD NEGATIVE — login path that mentions SQL + email/password,
 * but uses parameterized placeholders (not concatenation).
 * Scare wording must not Verified.
 */
"use strict";

function buildLoginQuery(req) {
  const email = req.body.email || "";
  const password = req.body.password || "";
  return {
    sql: "SELECT * FROM Users WHERE email = ? AND password = ? AND deletedAt IS NULL",
    params: [email, password],
  };
}

module.exports = { buildLoginQuery };
