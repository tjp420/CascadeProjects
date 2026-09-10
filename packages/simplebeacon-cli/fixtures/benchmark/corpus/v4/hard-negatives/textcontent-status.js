/**
 * HARD NEGATIVE — textContent sink (not HTML injection).
 */
"use strict";

function showStatus(req, element) {
  const msg = req.query.msg || "";
  element.textContent = msg;
}

module.exports = { showStatus };
