/**
 * DOM XSS variant using outerHTML (not innerHTML).
 * Same class, different sink structure.
 *
 * Attack path (intentional):
 *   req.query.html → element.outerHTML assignment
 */
"use strict";

function renderBanner(req, element) {
  const html = req.query.html || "";
  // DELIBERATE VULNERABILITY — unsanitized outerHTML write
  element.outerHTML = "<div class=\"banner\">" + html + "</div>";
}

module.exports = { renderBanner };
