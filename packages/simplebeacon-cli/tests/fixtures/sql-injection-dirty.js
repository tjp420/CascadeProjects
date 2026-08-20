/* eslint-disable no-unused-vars */
/**
 * Dirty fixture for SQL injection AST detection.
 * This file intentionally contains unsafe patterns for testing.
 */

const db = require("./db");

// SB-JS-SQL-001: Dynamic SQL via template literal
function getUserUnsafe(userId) {
  const sql = `SELECT * FROM users WHERE id = ${userId}`;
  return db.query(sql);
}

// SB-JS-SQL-001: Dynamic SQL via binary concatenation
function deleteUserUnsafe(table, id) {
  const sql = "DELETE FROM " + table + " WHERE id = " + id;
  return db.execute(sql);
}

// SB-JS-SQL-002: Unparameterized query (variable SQL without param array)
function searchUsers(searchTerm) {
  const query = "SELECT * FROM users WHERE name LIKE '%" + searchTerm + "%'";
  return db.query(query);
}

// Safe: parameterized query with array
function getUserSafe(userId) {
  return db.query("SELECT * FROM users WHERE id = ?", [userId]);
}

// Safe: static string literal
function getAllUsers() {
  return db.query("SELECT * FROM users");
}
