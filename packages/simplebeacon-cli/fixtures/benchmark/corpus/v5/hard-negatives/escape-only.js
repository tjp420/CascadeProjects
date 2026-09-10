/**
 * HARD NEGATIVE — template with encoded HTML entity helpers (no DOM sink).
 */
"use strict";

function formatTitle(req) {
  const title = String(req.query.title || "");
  return title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = { formatTitle };
