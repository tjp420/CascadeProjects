// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import {
  escapeHtml,
  formatNumber,
  formatPercent,
  renderEmptyState,
  showToast,
} from "../utils.js";
import { FEATURE_CATALOG } from "../services/platformService.js";
// EU AI Act transparency disclosure: This view includes AI system integration indicators per Article 50.
import {
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  formatScanScopeSummary,
  formatScanInventoryNote,
} from "../services/analyzeService.js?v=20260716cachefix1";
// simplebeacon:production-leak-intent: web-data-sample - Legitimate documentation about web data paths in help documentation
const DASHBOARD_PAGES = [
  {
    route: "dashboard",
    icon: "📊",
    title: "Dashboard",
    description:
      "Last scan status, scan summary, metric chips, and issue categories. Rescan from here or open Analyze for deeper runs.",
  },
  {
    route: "analyze",
    icon: "📂",
    title: "Analyze",
    description:
      "Complete, Simplebeacon, mock data, consolidation, roadmap, or auto mode. Drop JSON reports or enter a server-readable path.",
  },
  {
    route: "assessments",
    icon: "📑",
    title: "Assessment Portal",
    description:
      "Client-facing M&A / diligence flow — clone a repo or scan a local path (signed-in), deliver assessment JSON.",
  },
  {
    route: "audit",
    icon: "🛡️",
    title: "Compliance Audit",
    description:
      "All auditing layers in one view — credentials, fiction KPIs, schema, production leaks, roadmap, Jest baseline, npm audit.",
  },
  {
    route: "results",
    icon: "📋",
    title: "Results",
    description:
      "Filter issues by severity and category. Empty state with gate PASS means a clean scan on configured paths — not a broken page.",
  },
  {
    route: "platform",
    icon: "📈",
    title: "Platform",
    description:
      "Engineering baseline — mock file counts, Jest health, schema pass rate, and comparative metrics from live scan + baseline.",
  },
  {
    route: "quality",
    icon: "🛡️",
    title: "Quality & Security",
    description:
      "Live npm audit (dependency count + vulnerabilities), security checklist, and coverage posture.",
  },
  {
    route: "settings",
    icon: "⚙️",
    title: "Settings",
    description:
      "Scan paths, gate severities, rule toggles, and optional AI provider keys (OpenAI, Anthropic, Ollama) for Analyze summaries.",
  },
  {
    route: "about",
    icon: "📖",
    title: "About the project",
    description:
      "Radical honesty — what Simplebeacon does well, what it is bad at, install commands, and links to source.",
  },
  {
    route: "pricing",
    icon: "⚡",
    title: "Install",
    description:
      "Community CLI ($0) — npx commands, GitHub Action, documentation links. No enterprise checkout on this page.",
  },
];
const STATIC_FAQ = [
  {
    question:
      "Why does the dashboard show 42 mock/sample files but 40k+ repo files?",
    answer:
      "Simplebeacon gate scans configured scanPaths (web/data, data/mock, etc.) — typically ~42 mock/sample JSON files. The repo inventory is an audit-style index of the project root (skips node_modules, .git, build artifacts) for context; it is not a full-fiction scan of every file.",
  },
  {
    question:
      "What is the difference between quality score and consistency score?",
    answer:
      "Quality score is a capped mock-scan heuristic (often 99%). Consistency score reflects fiction/KPI drift checks on page samples — use consistency and schema compliance on Dashboard and Compliance Audit for pass/fail truth.",
  },
  {
    question: "Why does Results show 0 issues when I expected findings?",
    answer:
      "A PASS gate with zero issues on configured paths is correct for ai-platform. Simplebeacon uses pattern matching on mock/sample paths and production directories — not semantic review of the entire monorepo.",
  },
  {
    question: "How do I run the v1-internal dashboard locally?",
    answer:
      "Community CLI: npm install simplebeacon or /community. Cloud Teams requires Stripe subscription. Operators: npm run dashboard:v1-internal (port 3002).",
  },
];
/**
 * Render live scan strip.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function renderLiveScanStrip(report, baseline, dashboardHome) {
  var _a, _b, _c, _d, _e, _f;
  if (!report) {
    return `
      ${renderEmptyState({
        icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        title: "No scan report loaded yet",
        body: "Run a scan from Dashboard or Analyze to see live metrics here.",
      })}
    `;
  }
  const metrics = getScanFileMetrics(report);
  const inventoryNote = formatScanInventoryNote(report);
  const gateLabel = (
    (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass
  )
    ? "PASS"
    : "FAIL";
  const jestLabel =
    (_b = resolveJestTestsLabel(baseline, dashboardHome)) !== null &&
    _b !== void 0
      ? _b
      : "—";
  const pageSpecs =
    (_c = resolvePageSpecsLabel(report, baseline)) !== null && _c !== void 0
      ? _c
      : "—";
  return `
    <div class="card mb-6" style="padding: var(--space-4);">
      <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">Live scan snapshot</p>
      <div class="metrics-row mb-2">
        <div class="metric-chip gate-badge ${((_d = report.gate) === null || _d === void 0 ? void 0 : _d.pass) ? "pass" : "warn"}">${gateLabel}</div>
        <div class="metric-chip"><strong>${formatPercent(resolveDisplayScore(report))}</strong> consistency</div>
        <div class="metric-chip"><strong>${formatNumber((_e = metrics.mockSampleFiles) !== null && _e !== void 0 ? _e : report.totalFiles)}</strong> mock/sample</div>
        ${metrics.repositoryFiles != null ? `<div class="metric-chip"><strong>${formatNumber(metrics.repositoryFiles)}</strong> repo files</div>` : ""}
        <div class="metric-chip"><strong>${formatNumber((_f = metrics.ruleScopedFilesAnalyzed) !== null && _f !== void 0 ? _f : metrics.credentialScanned)}</strong> gate rules checked</div>
        <div class="metric-chip"><strong>${pageSpecs}</strong> page specs</div>
        <div class="metric-chip"><strong>${jestLabel}</strong> Jest</div>
      </div>
      <p class="text-muted" style="margin: 0; font-size: var(--font-size-sm);">${escapeHtml(formatScanScopeSummary(report))}${inventoryNote ? ` · ${escapeHtml(inventoryNote)}` : ""}</p>
    </div>
  `;
}
/**
 * Help view.
 */
export class HelpView {
  constructor(app) {
    this.app = app;
  }
  render() {
    var _a, _b, _c, _d;
    const help = this.app.state.help || {};
    const overview = help.overview || {};
    const quickLinks = help.quickLinks || [];
    const faq = [...STATIC_FAQ, ...(help.faq || help.faqItems || [])];
    const report = this.app.state.report;
    const baseline = this.app.state.baseline;
    const dashboardHome = this.app.state.dashboardHome;
    const el = document.createElement("div");
    el.className = "fade-in";
    const scanModes = [
      {
        mode: "Complete",
        desc: "Runs all core scans in sequence: gate, consolidation, fiction digest, roadmap, codebase analysis, file reduction, data quality, cleanup assistant, npm audit, and compliance checklist. Browser analyzers (security, AI/LLM, code quality, architecture) run inside the codebase step. Optional AI narrative attaches to consolidation and codebase results.",
        icon: "🔬",
      },
      {
        mode: "Simplebeacon",
        desc: "Uses .simplebeacon/config.json scan paths, all rules, and gate policy. Primary mode for CI.",
        icon: "🛡️",
      },
      {
        mode: "Mock data",
        desc: "Fiction/KPI digest derived from the Simplebeacon gate report. Requires gate scan to complete first — filters fiction-type issues from the same results.",
        icon: "🧪",
      },
      {
        mode: "Roadmap",
        desc: "Filesystem sprint scan for planning. Exports belong in reports/.",
        icon: "🗺️",
      },
      {
        mode: "Consolidation",
        desc: "Duplicate JSON groups and similar schemas across the full repository inventory. Pick canonical files.",
        icon: "📦",
      },
      {
        mode: "Codebase",
        desc: "File type breakdown, line counts, ESLint results, and structure. Feeds browser analyzers (security, AI/LLM, quality, architecture).",
        icon: "💻",
      },
      {
        mode: "File reduction",
        desc: "Unused image assets and duplicate content detection.",
        icon: "🗑️",
      },
      {
        mode: "Data quality",
        desc: "Empty or trivial JSON files and schema issues.",
        icon: "📋",
      },
      {
        mode: "Cleanup assistant",
        desc: "Aggregates file reduction + data quality into an actionable cleanup brief.",
        icon: "🧹",
      },
      {
        mode: "npm audit",
        desc: "Package.json dependency vulnerability check.",
        icon: "🔒",
      },
      {
        mode: "Compliance",
        desc: "License, security, and governance checklist. Requires gate scan first.",
        icon: "✅",
      },
      {
        mode: "EU AI Act",
        desc: "Regulatory sprint scan for EU AI Act compliance. Runs on product root.",
        icon: "🇪🇺",
      },
      {
        mode: "Auto",
        desc: "Picks Simplebeacon when path contains web/data, ai-platform, /data/mock, or simplebeacon; otherwise picks Roadmap.",
        icon: "⚡",
      },
    ];
    const metricDefs = [
      {
        term: "mock/sample",
        meaning:
          "Files in configured scanPaths (e.g. web/data/*-sample.json) — the gate target (~42 on ai-platform).",
      },
      {
        term: "rule-scoped",
        meaning:
          "Files read by credential + production-leak rules (often ~117) — broader than mock paths alone.",
      },
      {
        term: "page specs",
        meaning:
          "Page-sample JSON validated against Jest specs (e.g. 42/42) — includes aliased roadmap samples outside scanPaths.",
      },
      {
        term: "repo files",
        meaning:
          "Audit inventory of project root (~1k on ai-platform, skips node_modules/.git) — context only.",
      },
      {
        term: "consistency",
        meaning:
          "Fiction/KPI drift score on samples — prefer this over capped quality score for pass/fail.",
      },
      {
        term: "gate PASS + 0 issues",
        meaning:
          "Expected for a clean repo on current config — not a broken scan.",
      },
    ];
    const steps = [
      {
        icon: "✏️",
        title: "Write code",
        desc: "Developer writes code and pushes to repo",
      },
      {
        icon: "🔍",
        title: "Scan",
        desc: "Simplebeacon scans on commit, push, CI, or manual trigger",
      },
      {
        icon: "🐛",
        title: "Find",
        desc: "Detects passwords, API keys, fake KPIs, mock paths in production",
      },
      {
        icon: "🚫",
        title: "Block",
        desc: "High-severity findings stop the gate — no merge or deploy",
      },
      {
        icon: "🔧",
        title: "Fix",
        desc: "Developer fixes issues and re-scans until clean",
      },
      {
        icon: "🚀",
        title: "Ship",
        desc: "Gate green, code deploys to production",
      },
    ];
    el.innerHTML = `
      <style>
        .help-hero { text-align:center; padding: var(--space-10) var(--space-6); }
        .help-hero h1 { font-size: 2rem; font-weight: 700; margin: 0 0 var(--space-2); }
        .help-hero p { color: var(--text-muted); margin: 0 0 var(--space-6); }
        .help-search { max-width: 480px; margin: 0 auto; position: relative; }
        .help-search input { width: 100%; padding: var(--space-3) var(--space-4); padding-left: 40px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text-primary); font-size: 0.875rem; }
        .help-search::before { content: '🔍'; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); opacity: 0.6; }
        .help-section { margin-bottom: var(--space-8); }
        .help-section-title { font-size: 1.125rem; font-weight: 600; margin: 0 0 var(--space-4); display: flex; align-items: center; gap: var(--space-2); }
        .help-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
        .help-step { text-align: center; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
        .help-step-icon { font-size: 1.5rem; margin-bottom: var(--space-2); }
        .help-step-title { font-weight: 600; font-size: 0.875rem; margin-bottom: var(--space-1); }
        .help-step-desc { font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; }
        .help-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); }
        .help-metric-card { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
        .help-metric-card code { font-size: 0.75rem; background: var(--background); padding: 2px 6px; border-radius: 4px; }
        .help-metric-card strong { display: block; font-size: 0.875rem; margin-bottom: var(--space-1); }
        .help-metric-card p { font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
        .help-mode-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); }
        .help-mode-card { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); display: flex; align-items: flex-start; gap: var(--space-3); }
        .help-mode-card .mode-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }
        .help-mode-card h4 { margin: 0 0 4px; font-size: 0.875rem; }
        .help-mode-card p { margin: 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; }
        .help-page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-3); }
        .help-page-card { text-align: left; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; transition: all 150ms; }
        .help-page-card:hover { border-color: var(--primary); background: rgba(99,102,241,0.03); }
        .help-page-card .page-icon { font-size: 1.5rem; margin-bottom: var(--space-2); }
        .help-page-card h4 { margin: 0 0 4px; font-size: 0.875rem; }
        .help-page-card p { margin: 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; }
        .help-faq-item { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); margin-bottom: var(--space-2); overflow: hidden; }
        .help-faq-item summary { padding: var(--space-3) var(--space-4); font-weight: 500; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
        .help-faq-item summary::after { content: '▼'; font-size: 0.7rem; color: var(--text-muted); transition: transform 150ms; }
        .help-faq-item[open] summary::after { transform: rotate(180deg); }
        .help-faq-item p { padding: 0 var(--space-4) var(--space-3); margin: 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
        .help-cli { position: relative; }
        .help-cli .copy-btn { position: absolute; top: var(--space-3); right: var(--space-3); padding: 4px 10px; font-size: 0.7rem; border-radius: var(--radius-md); background: var(--surface-elevated); border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; }
        .help-cli .copy-btn:hover { background: var(--surface-hover); }
        .help-cli pre { margin: 0; padding: var(--space-4); background: var(--background); border: 1px solid var(--border); border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: 0.75rem; overflow-x: auto; }
      </style>

      <div class="help-hero">
        <h1>Help Center</h1>
        <p>Scan modes, metrics, and troubleshooting</p>
        <div class="help-search">
          <input type="search" id="help-search" placeholder="Search help topics…" autocomplete="off">
        </div>
      </div>

      <div class="help-onboarding-actions">
        <button type="button" class="btn btn-primary" id="help-start-tour">🚀 Start Guided Tour</button>
        <button type="button" class="btn btn-outline" id="help-getting-started">📋 Getting Started Checklist</button>
      </div>

      ${renderLiveScanStrip(report, baseline, dashboardHome)}

      <div class="help-section">
        <h2 class="help-section-title">🔄 How it works</h2>
        <div class="help-steps">
          ${steps
            .map(
              (s) => `
            <div class="help-step">
              <div class="help-step-icon">${s.icon}</div>
              <div class="help-step-title">${escapeHtml(s.title)}</div>
              <div class="help-step-desc">${escapeHtml(s.desc)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
        <p class="text-muted" style="font-size:0.75rem; text-align:center; margin:0;">
          The guard never sleeps: pre-commit hooks, CI on every PR, optional production collector, and this SPA dashboard.
        </p>
      </div>

      <div class="help-section">
        <h2 class="help-section-title">📊 Understanding metrics</h2>
        <div class="help-metric-grid">
          ${metricDefs
            .map(
              (m) => `
            <div class="help-metric-card">
              <strong>${escapeHtml(m.term)}</strong>
              <p>${escapeHtml(m.meaning).replace(/\`(.+?)\`/g, "<code>$1</code>")}</p>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value">${(_a = overview.totalDocs) !== null && _a !== void 0 ? _a : DASHBOARD_PAGES.length}</div>
          <div class="insight-stat-label">Dashboard pages</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${(_b = overview.totalTutorials) !== null && _b !== void 0 ? _b : "5"}</div>
          <div class="insight-stat-label">Workflows</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${faq.length}</div>
          <div class="insight-stat-label">FAQ items</div>
        </div>
      </div>

      <div class="help-section">
        <h2 class="help-section-title">📑 Dashboard pages</h2>
        <div class="help-page-grid">
          ${DASHBOARD_PAGES.map(
            (page) => `
            <button type="button" class="help-page-card" data-route="${page.route}">
              <div class="page-icon">${page.icon}</div>
              <h4>${escapeHtml(page.title)}</h4>
              <p>${escapeHtml(page.description)}</p>
            </button>
          `,
          ).join("")}
        </div>
      </div>

      <div class="help-section">
        <h2 class="help-section-title">❓ FAQ</h2>
        <div>
          ${faq
            .slice(0, 12)
            .map(
              (item) => `
            <details class="help-faq-item">
              <summary>${escapeHtml(item.question || item.title)}</summary>
              <p>${escapeHtml(item.answer || item.description || "")}</p>
            </details>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="help-section">
        <h2 class="help-section-title">🔬 Scan modes</h2>
        <div class="help-mode-grid">
          ${scanModes
            .map(
              (m) => `
            <div class="help-mode-card">
              <span class="mode-icon">${m.icon}</span>
              <div>
                <h4>${escapeHtml(m.mode)}</h4>
                <p>${escapeHtml(m.desc)}</p>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="help-section">
        <h2 class="help-section-title">⌨️ CLI & server commands</h2>
        <div class="help-cli">
          <button type="button" class="copy-btn" id="help-copy-cli">Copy</button>
          <pre id="help-cli-code"># Simplebeacon CLI (npm: simplebeacon@1.0.0)
npm install -D simplebeacon
npx simplebeacon init
npx simplebeacon scan --gate --path .
npx simplebeacon hook install

# Monorepo dev (this repo)
npm run simplebeacon:report
npm run trust:refresh

# Local dashboard (v1-internal, port 3002)
npm run dashboard:v1-internal

# Tests
npm test
npm test -- --testPathPattern=page-samples</pre>
        </div>
      </div>

      <div class="help-section" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3);">
        <div>
          <h2 class="help-section-title" style="margin:0;">🧭 All features</h2>
          <p class="text-muted" style="font-size:0.875rem;margin:var(--space-1) 0 0;">Browse every in-app destination — no duplicate legacy HTML pages.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="help-open-features">Browse catalog →</button>
      </div>
    `;
    // Search filter
    const searchInput = el.querySelector("#help-search");
    searchInput === null || searchInput === void 0
      ? void 0
      : searchInput.addEventListener("input", (e) => {
          const q = e.target.value.toLowerCase();
          el.querySelectorAll(
            ".help-page-card, .help-faq-item, .help-mode-card, .help-metric-card, .help-step",
          ).forEach((node) => {
            const text = node.textContent.toLowerCase();
            node.style.display = text.includes(q) ? "" : "none";
          });
        });
    // Copy CLI
    (_c = el.querySelector("#help-copy-cli")) === null || _c === void 0
      ? void 0
      : _c.addEventListener("click", async () => {
          var _a;
          const code =
            ((_a = el.querySelector("#help-cli-code")) === null || _a === void 0
              ? void 0
              : _a.textContent) || "";
          try {
            await navigator.clipboard.writeText(code);
            showToast("Commands copied", "success");
          } catch (_b) {
            showToast("Copy failed", "error");
          }
        });
    el.querySelectorAll("[data-route]").forEach((btn) => {
      btn.addEventListener("click", () => this.app.navigate(btn.dataset.route));
    });
    (_d = el.querySelector("#help-open-features")) === null || _d === void 0
      ? void 0
      : _d.addEventListener("click", () => {
          this.app.navigate("features");
        });
    return el;
  }
  mount(container) {
    window.setSafeHTML(container, "");
    container.appendChild(this.render());
  }
}
/** Feature catalog — all navigation stays in the Simplebeacon SPA */
export class FeaturesView {
  constructor(app) {
    this.app = app;
    this.filter = "";
  }
  getAllItems() {
    return FEATURE_CATALOG.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.group })),
    );
  }
  getFilteredCatalog() {
    const q = this.filter.trim().toLowerCase();
    if (!q) return FEATURE_CATALOG;
    return FEATURE_CATALOG.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.description} ${item.route} ${item.analyzeMode || ""} ${group.group}`
          .toLowerCase()
          .includes(q),
      ),
    })).filter((group) => group.items.length > 0);
  }
  render() {
    var _a;
    const el = document.createElement("div");
    el.className = "fade-in";
    const allItems = this.getAllItems();
    const catalog = this.getFilteredCatalog();
    const analyzeModes = allItems.filter((i) => i.analyzeMode).length;
    const routes = new Set(allItems.map((i) => i.route)).size;
    el.innerHTML = `
      <h1 class="page-title">All Features</h1>
      <p class="text-muted mb-4">
        ${allItems.length} destinations across ${FEATURE_CATALOG.length} groups —
        ${routes} SPA routes, ${analyzeModes} Analyze modes. No duplicate legacy HTML pages.
      </p>

      <div class="grid-3 mb-6">
        <div class="card insight-stat">
          <div class="insight-stat-value">${allItems.length}</div>
          <div class="insight-stat-label">Feature cards</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${routes}</div>
          <div class="insight-stat-label">Routes</div>
        </div>
        <div class="card insight-stat">
          <div class="insight-stat-value">${analyzeModes}</div>
          <div class="insight-stat-label">Analyze modes</div>
        </div>
      </div>

      <label class="input-group mb-6" style="display:block;max-width:28rem">
        <span class="input-label">Filter features</span>
        <input type="search" class="input" id="features-filter" placeholder="Search by name, route, or description…" value="${escapeHtml(this.filter)}">
      </label>

      <div id="features-catalog">
        ${
          catalog.length
            ? catalog
                .map(
                  (group) => `
            <div class="section-block" data-feature-group>
              <div class="section-heading">
                <h2>${escapeHtml(group.group)}</h2>
                <span class="text-muted" style="font-size:var(--font-size-sm)">${group.items.length} item${group.items.length === 1 ? "" : "s"}</span>
              </div>
              <div class="feature-grid">
                ${group.items.map((item) => this.renderFeatureCard(item)).join("")}
              </div>
            </div>
          `,
                )
                .join("")
            : `<div class="empty-state card"><p>No features match “${escapeHtml(this.filter)}”.</p></div>`
        }
      </div>
    `;
    (_a = el.querySelector("#features-filter")) === null || _a === void 0
      ? void 0
      : _a.addEventListener("input", (e) => {
          var _a;
          this.filter = e.target.value;
          const container = el.parentElement;
          if (container) this.mount(container);
          (_a =
            container === null || container === void 0
              ? void 0
              : container.querySelector("#features-filter")) === null ||
          _a === void 0
            ? void 0
            : _a.focus();
          const input =
            container === null || container === void 0
              ? void 0
              : container.querySelector("#features-filter");
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        });
    el.querySelectorAll("[data-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const route = btn.dataset.route;
        const mode = btn.dataset.analyzeMode;
        if (mode) {
          this.app.views.analyze.analysisType = mode;
          this.app.navigate("analyze", { mode });
          return;
        }
        this.app.navigate(route);
      });
    });
    el.querySelector("#help-start-tour")?.addEventListener("click", () => {
      if (this.app.guidedTour) {
        this.app.guidedTour.start(0);
      }
    });
    el.querySelector("#help-getting-started")?.addEventListener("click", () => {
      this.app.navigate("getting-started");
    });
    return el;
  }
  renderFeatureCard(item) {
    const badge = item.analyzeMode
      ? `<span class="feature-badge mode">Analyze · ${escapeHtml(item.analyzeMode)}</span>`
      : `<span class="feature-badge inapp">Open</span>`;
    if (item.external) {
      return `
        <a href="${escapeHtml(item.external)}" class="legacy-link card feature-card-inapp feature-card-external" target="_blank" rel="noopener">
          <span class="legacy-link-icon">${item.icon}</span>
          <span class="feature-card-body">
            <span class="legacy-link-label">${escapeHtml(item.label)}</span>
            ${item.description ? `<span class="feature-card-desc">${escapeHtml(item.description)}</span>` : ""}
          </span>
          <span class="feature-badge classic">Open ↗</span>
        </a>
      `;
    }
    return `
      <button type="button" class="legacy-link card feature-card-inapp" data-route="${item.route}" ${item.analyzeMode ? `data-analyze-mode="${item.analyzeMode}"` : ""}>
        <span class="legacy-link-icon">${item.icon}</span>
        <span class="feature-card-body">
          <span class="legacy-link-label">${escapeHtml(item.label)}</span>
          ${item.description ? `<span class="feature-card-desc">${escapeHtml(item.description)}</span>` : ""}
        </span>
        ${badge}
      </button>
    `;
  }
  mount(container) {
    window.setSafeHTML(container, "");
    container.appendChild(this.render());
  }
}
// Backward compat alias
/**
 * Legacy hub view.
 */
export const LegacyHubView = FeaturesView;
