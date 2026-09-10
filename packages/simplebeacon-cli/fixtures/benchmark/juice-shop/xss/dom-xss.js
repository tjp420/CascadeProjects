/**
 * Juice Shop–style DOM XSS surface (minimal extract for Track 2 benchmarks).
 * Inspired by OWASP Juice Shop XSS challenges — synthetic, not a full clone.
 *
 * Attack path (intentional):
 *   req.query.q → searchResults.innerHTML
 */
"use strict";

function renderSearch(req, searchResults) {
  const q = req.query.q;
  // DELIBERATE VULNERABILITY — unsanitized DOM sink
  searchResults.innerHTML = "<span>Results for " + q + "</span>";
}

module.exports = { renderSearch };
