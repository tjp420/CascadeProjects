/**
 * HARD NEGATIVE — Mongo find with object equality (no $where string).
 */
"use strict";

function findActiveUser(req, collection) {
  const email = req.body.email || "";
  return collection.find({ email: email, active: true });
}

module.exports = { findActiveUser };
