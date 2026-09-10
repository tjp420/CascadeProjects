/**
 * V5 OOS — DOM XSS via insertAdjacentHTML afterend (fresh placement).
 */
"use strict";

function injectNotice(req, el) {
  const html = req.body.html || "";
  // DELIBERATE VULNERABILITY
  el.insertAdjacentHTML("afterend", html);
}

module.exports = { injectNotice };
