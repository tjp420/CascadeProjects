/**
 * HARD NEGATIVE — if(false) around innerHTML.
 */
"use strict";

function maybeRender(req, el) {
  if (false) {
    el.innerHTML = req.body.html;
  }
  el.textContent = "safe";
}

module.exports = { maybeRender };
