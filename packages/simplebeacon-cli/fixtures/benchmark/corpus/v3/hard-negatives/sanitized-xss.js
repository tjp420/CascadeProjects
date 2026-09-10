/**
 * HARD NEGATIVE — looks like XSS surface, but DOMPurify sanitizes before sink.
 * Convincing detector bait; must NOT Verified without evidenced bypass.
 */
"use strict";

const DOMPurify = { sanitize(s) { return String(s); } };

function renderComment(req, element) {
  const comment = req.body.comment || "";
  const clean = DOMPurify.sanitize(comment);
  element.innerHTML = clean;
}

module.exports = { renderComment };
