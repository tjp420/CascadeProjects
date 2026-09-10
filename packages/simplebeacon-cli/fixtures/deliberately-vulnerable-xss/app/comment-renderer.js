/**
 * DELIBERATE VULNERABILITY — Track 2 Slice 6 fixture only.
 * Not production code. Used to prove:
 *   real source → evidence chain → independently reproducible → Verified
 *
 * Attack path (intentional):
 *   req.body.comment → renderMarkdown() → element.innerHTML
 * with no sanitizer on the path.
 */

"use strict";

function renderMarkdown(input) {
  // Intentionally unsanitized — fixture only.
  return String(input);
}

function renderUserComment(req, element) {
  const comment = req.body.comment;
  const html = renderMarkdown(comment);
  element.innerHTML = html;
}

module.exports = {
  renderMarkdown,
  renderUserComment,
};
