import { escapeHtml, formatPathLabel, formatNumber } from "../utils.js";
import {
  severityLabel,
  redactMatch,
} from "../utils/snippetDiagnostic.js?v=20260716cachefix1";
import {
  loadRecentPaths,
  basenamePath,
} from "../lib/analyzePathSuggestions.js?v=20260731audit3";
import { sourceChipTitle } from "../lib/analyzePathSources.js";

export function renderSourceChips(
  sources,
  currentPath,
  containerId,
  options = {},
) {
  if (!sources?.length) {
    return containerId === "analyze-preset-paths"
      ? `<div class="analyze-quick-paths" id="${containerId}"><span class="text-muted" style="font-size:var(--font-size-xs)">Loading test sources…</span></div>`
      : "";
  }
  return `
      <div class="analyze-quick-paths" id="${containerId}">
        ${sources
          .map((source) => {
            const value = source.value || "";
            const kindClass = source.kind
              ? `analyze-path-chip--${source.kind}`
              : "";
            const active = value === currentPath;
            const dismissible = options.dismissible && !source.primary;
            return `
          <span class="analyze-path-chip-wrap ${source.primary ? "primary" : ""} ${active ? "active" : ""} ${kindClass}">
            <button type="button" class="analyze-path-chip ${source.primary ? "primary" : ""} ${active ? "active" : ""} ${kindClass}"
              data-path="${escapeHtml(value)}" title="${escapeHtml(sourceChipTitle(source))}">
              ${source.kind === "remote" ? "🌐 " : source.kind === "cached" ? "📦 " : "📁 "}${escapeHtml(source.label)}
            </button>
            ${dismissible ? `<button type="button" class="analyze-path-chip-dismiss" data-path="${escapeHtml(value)}" aria-label="Remove ${escapeHtml(source.label)} from quick paths" title="Remove">×</button>` : ""}
          </span>`;
          })
          .join("")}
      </div>
    `;
}

export function renderPathSourceSections(defaultPath, currentPath) {
  const recent = loadRecentPaths().filter((p) => p !== defaultPath);
  const recentChips = [];
  if (defaultPath) {
    recentChips.push({
      path: defaultPath,
      label: `Server: ${basenamePath(defaultPath)}`,
      primary: true,
    });
  }
  for (const p of recent) {
    // simplebeacon-ignore memory-leak
    recentChips.push({
      path: p,
      label: formatPathLabel(p) || basenamePath(p),
      primary: false,
    });
  }
  const recentHtml = recentChips.length
    ? renderSourceChips(
        recentChips.map((c) => ({
          id: c.path,
          kind: "recent",
          label: c.label,
          value: c.path,
          primary: c.primary,
        })),
        currentPath,
        "analyze-recent-paths",
        { dismissible: true },
      )
    : "";
  if (!recentHtml) return "";
  return `
      ${
        recentHtml
          ? `
        <div class="analyze-path-sources">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
            <span class="analyze-path-sources-label text-muted">Recent</span>
            <button type="button" class="btn btn-ghost btn-xs" id="clear-recent-paths-btn">Clear all</button>
          </div>
          ${recentHtml}
        </div>
      `
          : ""
      }
    `;
}

export function renderSnippetResults(result, snippetBusy = false) {
  var _a, _b, _c, _d, _e, _f, _g;
  const findings = result.findings || [];
  const threatScore =
    (_a = result.threatScore) !== null && _a !== void 0 ? _a : 0;
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const understanding = result.understanding;
  const findingsHtml = findings.length
    ? `<ul class="analyze-snippet-findings">
          ${findings
            .slice(0, 8)
            .map(
              (f) => `
            <li>
              <span class="analyze-snippet-sev analyze-snippet-sev--${escapeHtml(f.severity)}">${escapeHtml(severityLabel(f.severity))}</span>
              <strong>${escapeHtml(f.label)}</strong> line ${f.line}
              <code>${escapeHtml(redactMatch(f.match))}</code>
            </li>
          `,
            )
            .join("")}
          ${findings.length > 8 ? `<li class="text-muted">+ ${findings.length - 8} more — run a full repo scan for branch-wide coverage</li>` : ""}
        </ul>`
    : result.cacheMeta
      ? `<p class="text-muted analyze-snippet-clean">${
          result.cacheMeta.documentation
            ? // simplebeacon:production-leak-intent - legitimate sample path reference for documentation
              "Documentation file — rule names like `-sample.json` describe scanner behavior, not production imports."
            : result.cacheMeta.lockfile
              ? "Dependency lockfile — npm/yarn bin entries are not production mock-path leaks."
              : `Scanner cache index${
                  result.cacheMeta.fileCount != null
                    ? ` (${formatNumber(result.cacheMeta.fileCount)} tracked path(s))`
                    : ""
                } — path keys are not production leak findings. Run a full repo scan for gate coverage.`
        }</p>`
      : '<p class="text-muted analyze-snippet-clean">No credential, mock-path, or AI-fiction KPI patterns in this file.</p>';
  const understandingHtml = understanding
    ? `
        <div class="analyze-snippet-understanding">
          <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0 0 0.5rem;">
            Server understanding · ${escapeHtml(((_c = (_b = understanding.layers) === null || _b === void 0 ? void 0 : _b.static) === null || _c === void 0 ? void 0 : _c.languageLabel) || ((_e = (_d = understanding.layers) === null || _d === void 0 ? void 0 : _d.static) === null || _e === void 0 ? void 0 : _e.language) || "unknown")}
          </p>
          <p style="font-size: var(--font-size-sm); margin: 0;">${escapeHtml(understanding.summary || ((_g = (_f = understanding.layers) === null || _f === void 0 ? void 0 : _f.semantic) === null || _g === void 0 ? void 0 : _g.purpose) || "Summary unavailable.")}</p>
        </div>
      `
    : result.understandingSkipped
      ? `<p class="text-muted analyze-snippet-note">${escapeHtml(result.understandingSkipped)}</p>`
      : "";
  return `
      <div class="analyze-snippet-results" id="analyze-snippet-results">
        <div class="analyze-snippet-results-head">
          <div>
            <strong>${escapeHtml(result.fileName || "File")}</strong>
            <span class="text-muted"> · ${formatNumber(result.bytes)} bytes</span>
          </div>
          <div class="metric-chip ${threatScore >= 35 ? "metric-chip-danger" : ""}">
            Threat score <strong>${threatScore}</strong>/100
          </div>
        </div>
        <p class="text-muted analyze-snippet-meta">${findings.length} pattern hit(s) · ${critical} critical · ${high} high</p>
        ${findingsHtml}
        ${understandingHtml}
        ${
          result.cacheMeta
            ? ""
            : `
        <div class="analyze-snippet-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="analyze-snippet-understand-btn" ${snippetBusy ? "disabled" : ""}>
            ${understanding ? "Re-run server understanding" : "Run server understanding"}
          </button>
        </div>`
        }
      </div>
    `;
}
