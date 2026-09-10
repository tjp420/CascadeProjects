/**
 * V4 OOS — DOM XSS via insertAdjacentHTML (not innerHTML/outerHTML).
 */
"use strict";

function appendFlash(req, element) {
  const msg = req.query.msg || "";
  // DELIBERATE VULNERABILITY — unsanitized insertAdjacentHTML
  element.insertAdjacentHTML("beforeend", "<span class=\"flash\">" + msg + "</span>");
}

module.exports = { appendFlash };
