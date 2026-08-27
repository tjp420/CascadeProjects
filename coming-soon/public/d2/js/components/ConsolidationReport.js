// simplebeacon-ignore documentation
import { escapeHtml, formatNumber } from "../utils.js";

/**
 * Render consolidation panel.
 * @param {Object} options
 * @param {any} loading
 * @param {any} error }
 * @returns {any}
 */
export function renderConsolidationPanel({ scan, loading, error } = {}) {
  if (loading) {
    return '<p class="text-muted"><span class="loading-spinner"></span> Scanning sample paths…</p>';
  }
  if (error) {
    return `<p class="text-danger">${escapeHtml(error)}</p>`;
  }
  if (!scan?.summary) {
    return '<p class="text-muted card">No consolidation scan yet — run the scan to find duplicate JSON and merge candidates.</p>';
  }

  const s = scan.summary;
  const staleReport = scan.reportVersion == null || scan.reportVersion < 2;
  const repoFiles =
    s.repositoryFilesTotal ??
    scan.repositoryInventory?.totalFiles ??
    (staleReport ? null : s.filesAnalyzed);
  const repoFolders =
    s.repositoryFoldersTotal ?? scan.repositoryInventory?.totalFolders;
  const sampleFiles =
    s.sampleDataFilesAnalyzed ?? (staleReport ? s.filesAnalyzed : null);
  const jsonFiles = s.jsonFilesAnalyzed;
  const candidates = (scan.mergeCandidates || []).slice(0, 6);
  const opportunities = (scan.reductionOpportunities || []).slice(0, 4);

  return `
    ${
      staleReport
        ? `
      <div class="card mb-4" style="border-color: var(--warning-color, #f59e0b);">
        <p style="margin: 0; font-size: var(--font-size-sm);">
          Stale consolidation report — restart the dashboard server and re-run the scan to include full repository inventory.
        </p>
      </div>
    `
        : ""
    }
    <div class="metrics-row mb-4">
      <div class="metric-chip" title="All files under project root (audit inventory — skips node_modules, .git, build artifacts)">
        <strong>${formatNumber(repoFiles)}</strong> repo files
      </div>
      ${repoFolders != null ? `<div class="metric-chip"><strong>${formatNumber(repoFolders)}</strong> folders</div>` : ""}
      ${jsonFiles != null ? `<div class="metric-chip" title="JSON files hashed for duplicate detection"><strong>${formatNumber(jsonFiles)}</strong> JSON scanned</div>` : ""}
      <div class="metric-chip" title="JSON under configured mock/sample paths">
        <strong>${formatNumber(sampleFiles)}</strong> sample JSON
      </div>
      <div class="metric-chip"><strong>${s.exactDuplicateGroups}</strong> duplicate groups</div>
      <div class="metric-chip"><strong>${s.mergeCandidates}</strong> merge candidates</div>
      <div class="metric-chip"><strong>${s.oversizedFiles}</strong> oversized</div>
      <div class="metric-chip"><strong>${escapeHtml(s.potentialSavingsLabel || "—")}</strong> potential savings</div>
    </div>
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
      scan.scanPaths?.length
        ? `
      <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">
        Sample paths: ${scan.scanPaths.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")}
      </p>
    `
        : ""
    }
    ${
      !candidates.length && !opportunities.length
        ? `
      <p class="text-muted card">No merge or reduction candidates — ${formatNumber(jsonFiles ?? sampleFiles)} JSON file(s) checked for duplicates across ${formatNumber(repoFiles)} repo files (${formatNumber(sampleFiles)} under sample paths).</p>
    `
        : `
      ${candidates.length ? '<h3 class="mb-2" style="font-size: var(--font-size-base);">Merge candidates</h3>' : ""}
      <div class="consolidation-list mb-4">
        ${candidates
          .map(
            (item) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">${escapeHtml(item.mergeType || "candidate")} · ${Math.round((item.similarity || 0) * 100)}% similar · ${escapeHtml(item.risk || "—")} risk</div>
            <p><code>${escapeHtml((item.files || []).map((f) => f.path).join(" ↔ ") || "—")}</code></p>
            <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(item.recommendation || "")}</p>
            <p class="text-muted" style="font-size: var(--font-size-xs);">Save ${escapeHtml(item.savingsLabel || "—")} · ${escapeHtml(item.effort || "—")} effort</p>
          </div>
        `,
          )
          .join("")}
      </div>
      ${opportunities.length ? '<h3 class="mb-2" style="font-size: var(--font-size-base);">Reduction opportunities</h3>' : ""}
      <div class="consolidation-list">
        ${opportunities
          .map(
            (item) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">${escapeHtml(item.type || "reduction")} · ${escapeHtml(item.method || "")}</div>
            <p><code>${escapeHtml((item.files || []).map((f) => f.path).join(", ") || "—")}</code></p>
            <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(item.description || "")}</p>
            <p class="text-muted" style="font-size: var(--font-size-xs);">Save ${escapeHtml(item.savingsLabel || "—")}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    `
    }
  `;
}
