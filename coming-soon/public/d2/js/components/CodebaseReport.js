// simplebeacon-ignore documentation
import { escapeHtml, formatNumber } from "../utils.js";

/**
 * Severity class.
 * @param {any} severity
 * @returns {any}
 */
function severityClass(severity) {
  if (severity === "critical") return "warn";
  if (severity === "high") return "warn";
  if (severity === "medium") return "warn";
  return "";
}

/**
 * Render codebase panel.
 * @param {Object} options
 * @param {any} loading
 * @param {any} error }
 * @returns {any}
 */
export function renderCodebasePanel({ scan, loading, error } = {}) {
  if (loading) {
    return '<p class="text-muted"><span class="loading-spinner"></span> Analyzing codebase…</p>';
  }
  if (error) {
    return `<p class="text-danger">${escapeHtml(error)}</p>`;
  }
  if (!scan?.summary) {
    return '<p class="text-muted card">No codebase analysis yet — run the scan to find technical debt, broken files, and placeholder data.</p>';
  }

  const s = scan.summary;
  const categories = (scan.categories || []).slice(0, 8);
  const findings = (scan.findings || []).slice(0, 12);
  const analyzerCounts = s.analyzerCounts || {};
  const eslintSummary = scan.eslintSummary || {};
  const rubric = scan.rubric || {};

  return `
    <div class="metrics-row mb-4">
      <div class="metric-chip" title="Audit-scoped repository inventory">
        <strong>${formatNumber(s.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles)}</strong> repo files
      </div>
      <div class="metric-chip" title="Source-like files content-scanned">
        <strong>${formatNumber(s.codeFilesAnalyzed)}</strong> code files analyzed
      </div>
      <div class="metric-chip" title="0–100 health score (lower = more findings)">
        <strong>${s.healthScore ?? "—"}%</strong> health
      </div>
      <div class="metric-chip"><strong>${formatNumber(s.findingsTotal)}</strong> findings</div>
      <div class="metric-chip gate-badge ${(s.severityCounts?.critical ?? 0) === 0 ? "pass" : "warn"}">
        <strong>${s.severityCounts?.critical ?? 0}</strong> critical
      </div>
      <div class="metric-chip gate-badge ${(s.severityCounts?.high ?? 0) === 0 ? "pass" : "warn"}">
        <strong>${s.severityCounts?.high ?? 0}</strong> high
      </div>
      <div class="metric-chip"><strong>${s.eslintErrors ?? 0}</strong> eslint errors</div>
      <div class="metric-chip"><strong>${s.eslintWarnings ?? 0}</strong> eslint warnings</div>
      <div class="metric-chip"><strong>${analyzerCounts.debugArtifacts ?? 0}</strong> debug artifacts</div>
      <div class="metric-chip"><strong>${analyzerCounts.placeholderOrFictionalData ?? 0}</strong> placeholder/fiction hits</div>
      ${
        scan.scanScope?.scanProfile
          ? `
        <div class="metric-chip" title="Extension profile for this scan">
          <strong>${escapeHtml(scan.scanScope.scanProfile)}</strong> profile
        </div>
      `
          : ""
      }
      ${
        scan.codeUnderstanding?.mode && scan.codeUnderstanding.mode !== "off"
          ? `
        <div class="metric-chip" title="Semantic/context understanding layer">
          <strong>${escapeHtml(scan.codeUnderstanding.mode)}</strong> understanding
        </div>
      `
          : ""
      }
      ${
        scan.structureInsights?.summary?.sampledFiles
          ? `
        <div class="metric-chip" title="Tier-1 structure hints from language plugins">
          <strong>${formatNumber(scan.structureInsights.summary.sampledFiles)}</strong> structure samples
        </div>
      `
          : ""
      }
      ${
        scan.scanScope?.universalLanguageCount
          ? `
        <div class="metric-chip" title="Registered language analyzer plugins">
          <strong>${formatNumber(scan.scanScope.universalLanguageCount)}</strong> language plugins
        </div>
      `
          : ""
      }
    </div>
    ${
      rubric?.severityBands
        ? `
      <div class="card mb-4">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Severity rubric</p>
        <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
          <strong>High</strong>: ${escapeHtml(rubric.severityBands.high)} ·
          <strong>Medium</strong>: ${escapeHtml(rubric.severityBands.medium)} ·
          <strong>Low</strong>: ${escapeHtml(rubric.severityBands.low)}
        </p>
      </div>
    `
        : ""
    }
    ${
      eslintSummary?.totalIssues
        ? `
      <div class="card mb-4">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">
          ESLint integration ${eslintSummary.source === "artifact" ? "(report artifact)" : "(live command)"}
        </p>
        <div class="metrics-row mb-2">
          <div class="metric-chip"><strong>${formatNumber(eslintSummary.totalIssues)}</strong> total eslint issues</div>
          <div class="metric-chip"><strong>${formatNumber(eslintSummary.filesWithIssues)}</strong> files with issues</div>
        </div>
        ${
          eslintSummary.categorizedWarnings?.length
            ? `
          <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
            Categories: ${eslintSummary.categorizedWarnings
              .slice(0, 5)
              .map((c) => `${escapeHtml(c.category)} (${c.count})`)
              .join(" · ")}
          </p>
        `
            : ""
        }
      </div>
    `
        : ""
    }
    ${
      scan.scanScope?.description
        ? `
      <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">
        ${escapeHtml(scan.scanScope.description)}
      </p>
    `
        : ""
    }
    ${
      categories.length
        ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Finding categories</h3>
      <div class="consolidation-list mb-4">
        ${categories
          .map(
            (cat) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">${escapeHtml(cat.label || cat.category)} · ${cat.count} hit(s) · ${cat.fileCount} file(s)</div>
            <p class="text-muted" style="font-size: var(--font-size-sm); margin: 0;">
              ${cat.topFiles?.length ? cat.topFiles.map((f) => `<code>${escapeHtml(f)}</code>`).join(", ") : "—"}
            </p>
          </div>
        `,
          )
          .join("")}
      </div>
    `
        : ""
    }
    ${
      findings.length
        ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Top findings</h3>
      <div class="consolidation-list">
        ${findings
          .map(
            (item) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">
              <span class="gate-badge ${severityClass(item.severity)}">${escapeHtml(item.severity || "—")}</span>
              ${escapeHtml(item.category || item.type || "finding")}
              ${item.line ? ` · line ${item.line}` : ""}
            </div>
            <p><code>${escapeHtml(item.filePath || "—")}</code></p>
            <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(item.description || "")}</p>
            ${item.recommendedAction ? `<p class="text-muted" style="font-size: var(--font-size-xs);">${escapeHtml(item.recommendedAction)}</p>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `
        : `
      <p class="text-muted card">No significant issues found in analyzed code files.</p>
    `
    }
    ${
      scan.structureInsights?.samples?.length
        ? `
      <div class="card mb-4">
        <h3 class="section-title">Structure hints (Tier-1)</h3>
        <p class="text-muted" style="font-size: var(--font-size-sm);">
          Regex-based estimates from language plugins — ${formatNumber(scan.structureInsights.summary?.sampledFiles)} file(s) sampled.
        </p>
        <div class="consolidation-list">
          ${scan.structureInsights.samples
            .slice(0, 6)
            .map(
              (item) => `
            <div class="consolidation-item">
              <div class="consolidation-meta">
                <span class="gate-badge pass">${escapeHtml(item.language || "generic")}</span>
                ${escapeHtml(item.complexity || "low")} complexity
                · ${formatNumber(item.approximateFunctions)} fn · ${formatNumber(item.approximateClasses)} types
              </div>
              <p><code>${escapeHtml(item.filePath || "—")}</code></p>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
        : ""
    }
  `;
}

/**
 * Build codebase conclusion.
 * @param {any} scan
 * @returns {any}
 */
export function buildCodebaseConclusion(scan) {
  if (!scan?.summary) return "No codebase analysis available.";
  const s = scan.summary;
  const critical = s.severityCounts?.critical ?? 0;
  const high = s.severityCounts?.high ?? 0;
  const medium = s.severityCounts?.medium ?? 0;
  const low = s.severityCounts?.low ?? 0;
  const repo = s.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles;
  const repoNote =
    repo != null
      ? ` Repository inventory: ${Number(repo).toLocaleString()} files; ${Number(s.codeFilesAnalyzed ?? 0).toLocaleString()} code files content-scanned.`
      : "";
  if (!s.findingsTotal) {
    return `No codebase issues detected in ${s.codeFilesAnalyzed ?? 0} analyzed files.${repoNote} Health score: ${s.healthScore ?? 100}%.`;
  }
  return `${s.findingsTotal} finding(s) — ${critical} critical, ${high} high, ${medium} medium, ${low} low.${repoNote} Health score: ${s.healthScore ?? "—"}%. ESLint: ${s.eslintErrors ?? 0} errors, ${s.eslintWarnings ?? 0} warnings.`;
}
