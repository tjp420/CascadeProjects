/**
 * HARD NEGATIVE — parameterized Sequelize-style query.
 */
"use strict";

function findUserByEmail(req, sequelize) {
  const email = req.body.email || "";
  return sequelize.query(
    "SELECT * FROM Users WHERE email = :email AND deletedAt IS NULL",
    { replacements: { email }, type: "SELECT" },
  );
}

module.exports = { findUserByEmail };
