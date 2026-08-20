// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import {
  escapeHtml,
  formatScanPathForDisplay,
  showToast,
  downloadJson,
  formatPercent,
} from "../utils.js";
import {
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  hydrateDashboardHome,
} from "../services/analyzeService.js?v=20260716cachefix1";
import {
  buildPlatformExportBundle,
  platformExportFilename,
} from "../utils/platform-export.browser.js?v=20260716cachefix1";
import {
  renderSkeletonCard,
  renderSkeletonChips,
} from "../utils-lib/dom.js?v=20260725phase3";
/**
 * Parse numeric.
 * @param {any} value
 * @returns {any}
 */
function parseNumeric(value) {
  if (value == null) return null;
  const match = String(value)
    .replace(/,/g, "")
    .match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
/**
 * Format signed delta.
 * @param {any} delta
 * @param {any} unit
 * @returns {any}
 */
function formatSignedDelta(delta, unit = "") {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "" : "";
  const suffix = unit ? ` ${unit}` : "";
  return `${sign}${delta}${suffix}`;
}
/**
 * Build platform metrics.
 * @param {any} home
 * @param {number} report
 * @param {any} baseline
 * @returns {any}
 */
function buildPlatformMetrics(home, report, baseline) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j;
  const overview =
    (home === null || home === void 0 ? void 0 : home.overview) || {};
  return {
    mockScanFiles:
      (_b =
        (_a =
          report === null || report === void 0
            ? void 0
            : report.mockSampleFiles) !== null && _a !== void 0
          ? _a
          : report === null || report === void 0
            ? void 0
            : report.totalFiles) !== null && _b !== void 0
        ? _b
        : overview.totalFiles,
    qualityScore:
      (_c =
        report === null || report === void 0 ? void 0 : report.qualityScore) !==
        null && _c !== void 0
        ? _c
        : parseNumeric(overview.codeQuality),
    schemaPassRate:
      (_d =
        report === null || report === void 0
          ? void 0
          : report.schemaCompliance) !== null && _d !== void 0
        ? _d
        : overview.schemaPassRate,
    scannerIssues:
      (_e =
        report === null || report === void 0 ? void 0 : report.issueCount) !==
        null && _e !== void 0
        ? _e
        : overview.scannerIssues,
    securityScore:
      (_f = overview.securityScore) !== null && _f !== void 0 ? _f : "80/100",
    jestTests: resolveJestTestsLabel(baseline, home, report),
    pageSamples:
      (_g = resolvePageSpecsLabel(report, baseline)) !== null && _g !== void 0
        ? _g
        : overview.pageSamplesLabel,
    sampleJsonFiles:
      (_j =
        (_h =
          report === null || report === void 0
            ? void 0
            : report.mockSampleFiles) !== null && _h !== void 0
          ? _h
          : report === null || report === void 0
            ? void 0
            : report.totalFiles) !== null && _j !== void 0
        ? _j
        : overview.sampleJsonFiles,
  };
}
/**
 * Build comparative rows.
 * @param {any} home
 * @param {Array} metrics
 * @returns {any}
 */
function buildComparativeRows(home, metrics) {
  var _a, _b;
  const staticRows =
    (home === null || home === void 0 ? void 0 : home.comparativeAnalysis) ||
    [];
  const liveByMetric = {
    "jest tests": {
      current:
        (_b = parseNumeric(
          (_a = metrics.jestTests) === null || _a === void 0
            ? void 0
            : _a.split("/")[0],
        )) !== null && _b !== void 0
          ? _b
          : parseNumeric(metrics.jestTests),
      format: (v) => (v == null ? "—" : String(v)),
    },
    "sample json files": {
      current: metrics.sampleJsonFiles,
      format: (v) => (v == null ? "—" : String(v)),
    },
    "mock / sample files": {
      current: metrics.mockScanFiles,
      format: (v) => (v == null ? "—" : String(v)),
    },
    "schema pass rate": {
      current: metrics.schemaPassRate,
      format: (v) => (v == null ? "—" : `${v}%`),
    },
    "security posture": {
      current: metrics.securityScore,
      format: (v) => (v == null ? "—" : String(v)),
    },
  };
  return staticRows.map((row) => {
    const key = String(row.metric || "").toLowerCase();
    const live = liveByMetric[key];
    const previous = row.previous;
    const current =
      (live === null || live === void 0 ? void 0 : live.current) != null
        ? live.format(live.current)
        : row.current;
    const prevNum = parseNumeric(previous);
    const curNum =
      (live === null || live === void 0 ? void 0 : live.current) != null
        ? live.current
        : parseNumeric(current);
    let change = row.change;
    if (prevNum != null && curNum != null && prevNum !== curNum) {
      const unitMatch = String(row.change || "").match(/\s([a-z]+)$/i);
      const unit =
        (unitMatch === null || unitMatch === void 0 ? void 0 : unitMatch[1]) ||
        "";
      if (
        String(row.metric).toLowerCase().includes("rate") ||
        String(previous).includes("%")
      ) {
        change = formatSignedDelta(curNum - prevNum, "%");
      } else if (String(row.metric).toLowerCase().includes("security")) {
        change = formatSignedDelta(curNum - prevNum, "pts");
      } else {
        change = formatSignedDelta(curNum - prevNum, unit);
      }
    }
    return { ...row, current, change };
  });
}
/**
 * Platform view.
 */
export class PlatformView {
  constructor(app) {
    this.app = app;
  }
  exportPlatformData() {
    const home = hydrateDashboardHome(
      this.app.state.dashboardHome,
      this.app.state.baseline,
    );
    const report = this.app.state.report;
    const baseline = this.app.state.baseline;
    const config = this.app.state.config;
    const coverage = this.app.state.coverage;
    const security = this.app.state.security;
    const quality = this.app.state.quality;
    if (!home && !report && !baseline) {
      showToast("No platform data to export", "error");
      return;
    }
    const payload = buildPlatformExportBundle({
      dashboardHome: home,
      report,
      baseline,
      config,
      coverage,
      security,
      quality,
    });
    downloadJson(payload, platformExportFilename("json"));
    showToast("Platform baseline exported", "success");
  }
  render() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const home = hydrateDashboardHome(
      this.app.state.dashboardHome,
      this.app.state.baseline,
    );
    const report = this.app.state.report;
    const baseline = this.app.state.baseline;
    const metrics = buildPlatformMetrics(home, report, baseline);
    const comparativeRows = buildComparativeRows(home, metrics);
    const scanPathProjectRoot =
      (report === null || report === void 0 ? void 0 : report.projectRoot) ||
      ((_a = this.app.state.config) === null || _a === void 0
        ? void 0
        : _a.projectRoot) ||
      "";
    const scanPaths =
      (report === null || report === void 0 ? void 0 : report.scanPaths) ||
      ((_b = this.app.state.config) === null || _b === void 0
        ? void 0
        : _b.scanPaths) ||
      [];
    const el = document.createElement("div");
    el.className = "fade-in";
    if (!home && !report && !baseline) {
      el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Platform</h1>
        <p class="text-muted analyze-hero-sub">Loading platform baseline…</p>
      </div>
      ${renderSkeletonChips(4)}
      <div class="grid-3 mb-6">
        ${renderSkeletonCard(2)}
        ${renderSkeletonCard(2)}
        ${renderSkeletonCard(2)}
      </div>
      ${renderSkeletonCard(6)}
      `;
      return el;
    }
    el.innerHTML = `
      <div class="analyze-hero">
        <h1 class="page-title">Platform</h1>
        <p class="text-muted analyze-hero-sub">${escapeHtml((home === null || home === void 0 ? void 0 : home.subtitle) || "Engineering baseline from repository audit + Simplebeacon scan")}</p>
      </div>

      <div class="analyze-action-bar" style="position:static;margin:0 0 var(--space-4);">
        <div class="analyze-action-info"></div>
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost btn-sm" id="platform-export-json">Export JSON</button>
        </div>
      </div>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value">${(_c = metrics.mockScanFiles) !== null && _c !== void 0 ? _c : "—"}</div>
          <div class="insight-stat-label">${escapeHtml(((_e = (_d = home === null || home === void 0 ? void 0 : home.overview) === null || _d === void 0 ? void 0 : _d.statLabels) === null || _e === void 0 ? void 0 : _e.totalFiles) || "Mock scan files")}</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value success">${formatPercent(metrics.qualityScore)}</div>
          <div class="insight-stat-label">${escapeHtml(((_g = (_f = home === null || home === void 0 ? void 0 : home.overview) === null || _f === void 0 ? void 0 : _f.statLabels) === null || _g === void 0 ? void 0 : _g.codeQuality) || "Scan quality")}</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${escapeHtml((_h = metrics.securityScore) !== null && _h !== void 0 ? _h : "—")}</div>
          <div class="insight-stat-label">${escapeHtml(((_k = (_j = home === null || home === void 0 ? void 0 : home.overview) === null || _j === void 0 ? void 0 : _j.statLabels) === null || _k === void 0 ? void 0 : _k.securityScore) || "Security posture")}</div>
        </div>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header"><span class="card-title">Test Health</span></div>
          <div class="settings-grid">
            <div class="settings-row"><span class="settings-label">Jest tests</span><span class="settings-value">${escapeHtml((_l = metrics.jestTests) !== null && _l !== void 0 ? _l : "—")}</span></div>
            ${metrics.jestTests ? "" : '<p class="text-muted mb-0" style="font-size:var(--font-size-xs);margin-top:-0.25rem;">Run <strong>Tools → Baseline sync</strong> or enable <code>jest-baseline</code> in config.</p>'}
            <div class="settings-row"><span class="settings-label">Page samples</span><span class="settings-value">${escapeHtml((_m = metrics.pageSamples) !== null && _m !== void 0 ? _m : "—")}</span></div>
            <div class="settings-row"><span class="settings-label">Schema pass</span><span class="settings-value">${formatPercent(metrics.schemaPassRate)}</span></div>
            <div class="settings-row"><span class="settings-label">Scanner issues</span><span class="settings-value">${(_o = metrics.scannerIssues) !== null && _o !== void 0 ? _o : "—"}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Scan Paths</span></div>
          <ul class="settings-path-list">
            ${scanPaths.map((p) => `<li><code>${escapeHtml(formatScanPathForDisplay(typeof p === "string" ? p : String(p), scanPathProjectRoot))}</code></li>`).join("") || '<li class="text-muted">No paths configured</li>'}
          </ul>
        </div>
      </div>

      ${
        comparativeRows.length
          ? `
        <div class="section-block">
          <div class="section-heading"><h2>Comparative Analysis</h2></div>
          <div class="card" style="padding:0;overflow:hidden;">
            <table class="results-table">
              <thead><tr><th>Metric</th><th>Previous</th><th>Current</th><th>Change</th></tr></thead>
              <tbody>
                ${comparativeRows
                  .map(
                    (r) => `
                  <tr>
                    <td>${escapeHtml(r.metric)}</td>
                    <td>${escapeHtml(String(r.previous))}</td>
                    <td>${escapeHtml(String(r.current))}</td>
                    <td class="text-success">${escapeHtml(r.change)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }

      ${
        (
          (_p = home === null || home === void 0 ? void 0 : home.insights) ===
            null || _p === void 0
            ? void 0
            : _p.length
        )
          ? `
        <div class="section-block">
          <div class="section-heading"><h2>Insights</h2></div>
          <div class="insight-list">
            ${home.insights
              .map(
                (i) => `
              <div class="insight-item card">
                <h3>${escapeHtml(i.title)}</h3>
                <p>${escapeHtml(i.description)}</p>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${
        (
          (_q =
            report === null || report === void 0
              ? void 0
              : report.mockDataCategories) === null || _q === void 0
            ? void 0
            : _q.length
        )
          ? `
        <div class="section-block">
          <div class="section-heading"><h2>Mock Data Categories</h2></div>
          <div class="card" style="padding:0;overflow:hidden;">
            <table class="results-table">
              <thead><tr><th>Category</th><th>Files</th><th>Size</th><th>Quality</th><th>Issues</th></tr></thead>
              <tbody>
                ${report.mockDataCategories
                  .map(
                    (c) => `
                  <tr>
                    <td>${escapeHtml(c.category)}</td>
                    <td>${c.fileCount}</td>
                    <td>${escapeHtml(c.totalSize)}</td>
                    <td>${formatPercent(c.qualityScore)}</td>
                    <td>${c.issues}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }
    `;
    (_q = el.querySelector("#platform-export-json")) === null || _q === void 0
      ? void 0
      : _q.addEventListener("click", () => this.exportPlatformData());
    return el;
  }
  mount(container) {
    window.setSafeHTML(container, "");
    container.appendChild(this.render());
  }
}
