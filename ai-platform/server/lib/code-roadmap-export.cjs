/**
 * Server-side executive HTML export for code roadmap scans.
 */

/**
 * Escape html.
 * @param {any} value
 * @returns {any}
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render executive html.
 * @param {any} roadmap
 * @returns {any}
 */
function renderExecutiveHtml(roadmap) {
  const es = roadmap.executiveSummary || {};
  const po = roadmap.projectOverview || {};
  const phases = roadmap.developmentPhases || [];
  const phase2 = roadmap.codeAnalysis?.phase2 || {};
  const resources = phase2.resourceEstimate || roadmap.resourceEstimate || {};
  const cycles = phase2.dependencyGraph?.circularDependencies || [];
  const fuzzy = phase2.fuzzySimilarity?.pairs || [];
  const semanticHints = phase2.semanticHints || {};

  const phaseRows = phases
    .map(
      (phase) => `
        <tr>
            <td>${escapeHtml(phase.phase || phase.title)}</td>
            <td class="${escapeHtml(phase.status || "")}">${escapeHtml(phase.status || "—")}</td>
            <td>${Math.round(phase.progress || 0)}%</td>
            <td>${escapeHtml(phase.description || "")}</td>
        </tr>
    `,
    )
    .join("");

  const cycleRows =
    cycles
      .slice(0, 10)
      .map(
        (cycle) => `
        <tr>
            <td>${cycle.length}</td>
            <td>${escapeHtml(cycle.impact || "low")}</td>
            <td><code>${escapeHtml(cycle.path.join(" → "))}</code></td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="3">No require cycles detected in scanned JS graph</td></tr>';

  const fuzzyRows =
    fuzzy
      .slice(0, 8)
      .map(
        (pair) => `
        <tr>
            <td>${Math.round(pair.similarity * 100)}%</td>
            <td><code>${escapeHtml(pair.fileA)}</code></td>
            <td><code>${escapeHtml(pair.fileB)}</code></td>
        </tr>
    `,
      )
      .join("") ||
    '<tr><td colspan="3">No high-similarity pairs above threshold</td></tr>';

  const hintRows =
    semanticHints.enabled && semanticHints.hints?.length
      ? semanticHints.hints
          .slice(0, 8)
          .map(
            (hint) => `
        <tr>
            <td>${escapeHtml(hint.priority || "low")}</td>
            <td><code>${escapeHtml((hint.files || []).join(" ↔ "))}</code></td>
            <td>${escapeHtml(hint.suggestion || "Review for consolidation")}</td>
        </tr>
    `,
          )
          .join("")
      : `<tr><td colspan="3">${escapeHtml(semanticHints.note || "Set LLAMA_CPP_BIN for optional semantic review hints")}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(roadmap.projectTitle || roadmap.projectName || "Code Roadmap Report")}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; max-width: 960px; }
        h1 { border-bottom: 2px solid #111827; padding-bottom: 8px; }
        h2 { color: #374151; margin-top: 28px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0 20px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
        .meta { color: #4b5563; font-size: 14px; }
        .completed { color: #166534; }
        .in-progress { color: #b45309; }
        .planned { color: #4b5563; }
        code { font-size: 12px; word-break: break-all; }
        @media print { body { margin: 12mm; } }
    </style>
</head>
<body>
    <h1>${escapeHtml(roadmap.projectTitle || roadmap.projectName || "Code Roadmap Report")}</h1>
    <p class="meta"><strong>Generated:</strong> ${escapeHtml(roadmap.generatedAt || roadmap.timestamp || new Date().toISOString())}</p>
    <p class="meta"><strong>Source:</strong> ${escapeHtml(roadmap.generatedBy || "code-roadmap-generator")} · ${escapeHtml(roadmap.dataSource || "filesystem-scan")}</p>
    <p class="meta"><strong>Inference:</strong> ${escapeHtml(roadmap.inferenceMode || phase2.fuzzySimilarity?.gguf?.mode || "filesystem")}</p>

    <h2>Executive Summary</h2>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Sprint completion</td><td>${escapeHtml(String(es.completionRate ?? po.completionRate ?? "—"))}%</td></tr>
        <tr><td>Completed sprints</td><td>${escapeHtml(String(es.completedFeatures ?? "—"))} / ${escapeHtml(String(es.totalFeatures ?? "—"))}</td></tr>
        <tr><td>Project health</td><td>${escapeHtml(es.projectHealth || po.projectHealth || "—")}</td></tr>
        <tr><td>Team</td><td>${escapeHtml(String(resources.teamSize || es.teamSize || 1))} (${escapeHtml(resources.role || "solo maintainer")})</td></tr>
        <tr><td>Remaining effort</td><td>${escapeHtml(String(resources.estimatedHours ?? "—"))} hours (internal ~$${escapeHtml(String(resources.internalBudgetUsd ?? "—"))})</td></tr>
    </table>

    <h2>Development Phases</h2>
    <table>
        <tr><th>Phase</th><th>Status</th><th>Progress</th><th>Description</th></tr>
        ${phaseRows}
    </table>

    <h2>Circular Dependencies</h2>
    <table>
        <tr><th>Length</th><th>Impact</th><th>Cycle path</th></tr>
        ${cycleRows}
    </table>

    <h2>Fuzzy Similarity Pairs</h2>
    <table>
        <tr><th>Similarity</th><th>File A</th><th>File B</th></tr>
        ${fuzzyRows}
    </table>

    <h2>Semantic Hints (optional)</h2>
    <table>
        <tr><th>Priority</th><th>Files</th><th>Action</th></tr>
        ${hintRows}
    </table>

    <p class="meta">Measured baseline — not 47-feature / 98% GGUF fiction. Print this page to save as PDF.</p>
</body>
</html>`;
}

module.exports = {
  renderExecutiveHtml,
  escapeHtml,
};
