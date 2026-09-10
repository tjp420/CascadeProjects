/**
 * HARD NEGATIVE — escapeHtml before innerHTML.
 */
"use strict";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNotice(req, element) {
  const notice = req.body.notice || "";
  element.innerHTML = "<p>" + escapeHtml(notice) + "</p>";
}

module.exports = { renderNotice, escapeHtml };
