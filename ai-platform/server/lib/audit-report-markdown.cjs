const { escapeHtml } = require("./code-roadmap-export.cjs");

/**
 * Convert simple markdown to HTML (headings, bold, code, lists, tables).
 * @param {string} markdown
 * @returns {string}
 */
function markdownToHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const html = [];
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    html.push('<table class="data-table"><tbody>');
    tableRows.forEach((row, index) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (!cells.length) return;
      if (index === 1 && cells.every((c) => /^[-:]+$/.test(c))) return;
      const tag = index === 0 ? "th" : "td";
      html.push(
        "<tr>",
        ...cells.map((c) => `<${tag}>${inlineMarkdown(c)}</${tag}>`),
        "</tr>",
      );
    });
    html.push("</tbody></table>");
    tableRows = [];
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      tableRows.push(trimmed);
      continue;
    }
    flushTable();
    if (!trimmed) continue;
    if (trimmed.startsWith("### "))
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
    else if (trimmed.startsWith("## "))
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
    else if (trimmed.startsWith("- "))
      html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
    else html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  flushTable();
  return html.join("\n");
}

module.exports = { markdownToHtml };
