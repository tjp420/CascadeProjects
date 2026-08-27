// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Per-mode file/path scope for Analyze page mode pills — mirrors SimpleBeacon config + scanScope.
 * simplebeacon:production-leak-intent: web-data-sample - Legitimate web data path configuration for analysis mode file scope
 */

import { escapeHtml, formatNumber } from "../utils.js";
import { isBenchmarkCachePath } from "./complete-scan-artifact-profile.browser.js";

// simplebeacon:production-leak-intent: web-data-sample - Scan path configuration reference for analysis mode
const DEFAULT_SCAN_PATHS = ["web/data", "data/mock", "tests/fixtures", "data"];
const DEFAULT_PRODUCTION_PATHS = ["server/", "src/", "app/", "lib/"];
const FILE_REDUCTION_SKIP = [
  "node_modules/",
  "coverage/",
  "dist/",
  "build/",
  ".git/",
  "github-cache/",
  "deliverables/",
];
const DATA_QUALITY_SCANNERS = [
  "config-sprawl",
  "env-key-hygiene",
  "data-freshness",
  "privacy-exposure",
  "lineage-gaps",
  "schema-drift",
  "duplicate-config",
  "consistency-anchors",
];
const FILE_REDUCTION_SCANNERS = [
  "build-artifacts",
  "asset-consolidation",
  "unused-files",
  "directory-bloat",
];

/** Normalize roadmap payload from analyze API, complete step, or imported export JSON. */
export function normalizeRoadmapRoot(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.roadmap && typeof payload.roadmap === "object")
    return payload.roadmap;
  if (
    payload.type === "dynamic-project-roadmap-analysis" ||
    payload.codeAnalysis
  )
    return payload;
  if (payload.data?.roadmap) return payload.data.roadmap;
  if (payload.data?.codeAnalysis) return payload.data;
  return null;
}

/**
 * Extract roadmap file metrics.
 * @param {any} payload
 * @returns {any}
 */
export function extractRoadmapFileMetrics(payload) {
  const root = normalizeRoadmapRoot(payload);
  if (!root) return null;
  const structure = root.codeAnalysis?.structure;
  const sourceMetrics = root.strategicInsights?.sourceMetrics;
  const totalFiles = structure?.totalFiles ?? sourceMetrics?.totalFiles ?? null;
  const codeFiles = structure?.codeFiles ?? sourceMetrics?.codeFiles ?? null;
  const apiRoutes =
    root.aiIntegration?.apiRouteCount ?? sourceMetrics?.apiRoutes ?? null;
  const generatedAt = root.generatedAt ?? root.timestamp ?? null;
  if (totalFiles == null && codeFiles == null) return null;
  return {
    totalFiles,
    codeFiles,
    apiRoutes,
    generatedAt,
    dataSource:
      root.dataSource || sourceMetrics?.dataSource || "filesystem-scan",
  };
}

/**
 * Resolve scope context.
 * @param {string} context
 * @returns {any}
 */
function resolveScopeContext(context = {}) {
  const { config, report, projectPath, lastResult } = context;
  const scope = report?.scanScope || {};
  /**
   * Roadmap metrics.
   * @param {any} (
   * @returns {any}
   */
  const roadmapMetrics = (() => {
    if (!lastResult) return null;
    if (lastResult.kind === "roadmap")
      return extractRoadmapFileMetrics(lastResult.data);
    if (lastResult.kind === "complete") {
      const step = lastResult.steps?.find((s) => s.id === "roadmap");
      return extractRoadmapFileMetrics(step?.data);
    }
    return null;
  })();
  const scanPaths =
    Array.isArray(report?.scanPaths) && report.scanPaths.length
      ? report.scanPaths
      : Array.isArray(config?.scanPaths) && config.scanPaths.length
        ? config.scanPaths
        : DEFAULT_SCAN_PATHS;
  const productionPaths = scope.productionPaths?.length
    ? scope.productionPaths
    : config?.productionPaths?.length
      ? config.productionPaths
      : DEFAULT_PRODUCTION_PATHS;
  const sourceCodeScanPaths = scope.sourceCodeScanPaths?.length
    ? scope.sourceCodeScanPaths
    : config?.sourceCodeScanPaths?.length
      ? config.sourceCodeScanPaths
      : productionPaths;
  return {
    scanPaths,
    productionPaths,
    sourceCodeScanPaths,
    profile: scope.profile || config?.profile || "standard",
    ignore: config?.ignore || [],
    benchmarkScan: Boolean(
      report?.benchmarkScan || isBenchmarkCachePath(projectPath),
    ),
    counts: {
      repositoryFiles:
        scope.repositoryFilesTotal ?? report?.repositoryFilesTotal ?? null,
      ruleScoped:
        scope.ruleScopedFilesAnalyzed ??
        report?.ruleScopedFilesAnalyzed ??
        null,
      fictionJson:
        scope.fictionJsonFilesScanned ??
        report?.fictionJsonFilesScanned ??
        null,
      productionDirs:
        scope.productionDirsScanned ?? report?.productionLeakScanned ?? null,
      mockSample:
        scope.mockSampleFilesInScanPaths ?? report?.mockSampleFiles ?? null,
      euAiAct: scope.euAiActFilesScanned ?? report?.euAiActScanned ?? null,
      llmSlop: scope.llmSlopFilesScanned ?? report?.llmSlopFilesScanned ?? null,
      sourceCode:
        scope.sourceCodeFilesScanned ?? report?.sourceCodeFilesScanned ?? null,
    },
    reportFresh: Boolean(report?.generatedAt),
    roadmapMetrics,
  };
}

/**
 * Gate file sections.
 * @param {any} ctx
 * @returns {any}
 */
function gateFileSections(ctx) {
  return [
    {
      label: "Mock / sample JSON (scanPaths)",
      paths: ctx.scanPaths,
      count: ctx.counts.mockSample,
      countLabel: "sample files in paths",
      note: "Schema, sample-consistency, roadmap page specs, mock fiction KPI rules.",
    },
    {
      label: "Production code (credentials + production-leak)",
      paths: ctx.productionPaths,
      count: ctx.counts.productionDirs,
      countLabel: "files under production dirs",
      // simplebeacon:production-leak-intent - legitimate sample path reference for file scope analysis
      note: "Credential patterns and hardcoded *-sample.json references from prod directories.",
    },
    {
      label: "Source code pattern rules",
      paths: ctx.sourceCodeScanPaths.length
        ? ctx.sourceCodeScanPaths
        : ctx.productionPaths,
      count: ctx.counts.sourceCode ?? ctx.counts.llmSlop,
      countLabel: "source files scanned",
      note: "Fiction KPI in code, LLM slop markers, agency handoff patterns.",
    },
    {
      label: "Repository fiction JSON",
      paths: ["**/*.json (repo-wide, respects ignore)"],
      count: ctx.counts.fictionJson,
      countLabel: "JSON files",
      note: "Fiction KPI / consistency patterns across repository JSON (not just scanPaths).",
    },
  ];
}

/**
 * Mode sections.
 * @param {any} modeValue
 * @param {any} ctx
 * @returns {any}
 */
function modeSections(modeValue, ctx) {
  const gate = gateFileSections(ctx);

  switch (modeValue) {
    case "simplebeacon":
      return gate;

    case "eu-ai-act":
      return [
        ...gate,
        {
          label: "EU AI Act patterns (eu-ai-act profile)",
          paths: ctx.sourceCodeScanPaths.length
            ? ctx.sourceCodeScanPaths
            : ctx.productionPaths,
          count: ctx.counts.euAiAct,
          countLabel: "files scanned for EU markers",
          note: "Transparency, documentation, human oversight, logging — plus checklist on gate report.",
        },
        {
          label: "Artifacts written",
          paths: [
            ".simplebeacon/eu-ai-act-compliance.json",
            ".simplebeacon/eu-ai-act-assessment.json",
            ".simplebeacon/eu-ai-act-report.json",
          ],
          note: "Product root only — github-cache benchmark clones are blocked.",
        },
      ];

    case "mock-scan":
      return [
        {
          label: "Fiction KPI digest",
          paths: ["**/*.json (repository-wide)"],
          count: ctx.counts.fictionJson,
          countLabel: "JSON files",
          note: "Filters to fiction / KPI / consistency issue types from the gate fiction rules.",
        },
      ];

    case "roadmap": {
      const live = ctx.roadmapMetrics;
      const sections = [
        {
          label: "Filesystem roadmap generator",
          paths: ["**/* (project tree)"],
          count: live?.totalFiles ?? ctx.counts.repositoryFiles,
          countLabel: live
            ? "files in roadmap walk"
            : "repo files indexed (gate cache)",
          note: live
            ? `Sprint phases, dependency graph, effort — ${formatNumber(live.codeFiles) ?? "—"} code files · ${formatNumber(live.apiRoutes) ?? "—"} API routes · ${live.dataSource || "filesystem-scan"}.`
            : "Sprint phases, dependency graph, effort — respects .simplebeacon ignore patterns. Run Roadmap analysis for a live walk count.",
        },
      ];
      if (
        live?.totalFiles != null &&
        ctx.counts.repositoryFiles != null &&
        Number(live.totalFiles) !== Number(ctx.counts.repositoryFiles)
      ) {
        sections.push({
          label: "Gate inventory (reference)",
          paths: ["from .simplebeacon/report.json repositoryInventory"],
          count: ctx.counts.repositoryFiles,
          countLabel: "repo files (gate audit profile)",
          note: "Different walker than roadmap — gate uses Simplebeacon scan profile; roadmap uses code-roadmap-generator ignore rules.",
        });
      }
      return sections;
    }

    case "consolidation":
      return [
        {
          label: "Sample JSON (scanPaths)",
          paths: ctx.scanPaths,
          count: ctx.counts.mockSample,
          countLabel: "sample JSON in paths",
          note: "Structure similarity and merge candidates among configured mock/sample folders.",
        },
        {
          label: "Duplicate detection",
          paths: ["**/*.json (repository-wide hash)"],
          count: ctx.counts.fictionJson,
          countLabel: "JSON hashed",
          note: "Exact duplicate groups across all repo JSON, not only scanPaths.",
        },
      ];

    case "codebase":
      return [
        {
          label: "Full codebase depth",
          paths: [
            "**/*.{js,mjs,cjs,ts,tsx,jsx,py,...}",
            "ESLint when available",
          ],
          count: ctx.counts.repositoryFiles,
          countLabel: "repo files indexed",
          note: "Tech debt, debug artifacts, understanding layers — every discovered code file.",
        },
      ];

    case "file-reduction":
      return [
        {
          label: "Repo walk (skips regenerable dirs)",
          // simplebeacon:production-leak-intent: template-sample - File scope analysis scanner configuration
          paths: FILE_REDUCTION_SKIP.map((p) => `skip ${p}`),
          note: "Walks project tree excluding regenerable / vendor directories.",
        },
        {
          label: "Scanners",
          paths: FILE_REDUCTION_SCANNERS.map((id) => id.replace(/-/g, " ")),
          note: "Dry-run only — build artifacts, duplicate assets, unused-file candidates.",
        },
      ];

    case "data-quality":
      return [
        {
          label: "Repo walk",
          paths: ["**/* (excludes node_modules, coverage, dist, build, .git)"],
          count: ctx.counts.repositoryFiles,
          countLabel: "repo files indexed",
          note: "Eight data-cleanup scanners run over discovered files.",
        },
        {
          label: "Scanners",
          paths: DATA_QUALITY_SCANNERS.map((id) => id.replace(/-/g, " ")),
        },
      ];

    case "cleanup-assistant":
      return [
        ...modeSections("file-reduction", ctx),
        ...modeSections("data-quality", ctx),
        {
          label: "Agent brief output",
          paths: [
            "tiered safe-delete list",
            "protected mock paths from scanPaths",
          ],
          note: "Combines file-reduction + data-quality; exports Cursor cleanup brief.",
        },
      ];

    case "compliance":
      return [
        ...gate,
        {
          label: "Checklist evaluation",
          paths: ["Uses fresh gate report.json — no extra file walk"],
          note: "Corporate safety / EU checklist rules evaluated on the gate scan above.",
        },
      ];

    case "npm-audit":
      return [
        {
          label: "npm dependency tree",
          paths: ["package.json", "package-lock.json (or npm-shrinkwrap.json)"],
          note: "Live npm audit at the project path on the dashboard server.",
        },
      ];

    case "auto":
      return [
        {
          label: "Smart pick (at run time)",
          // simplebeacon:production-leak-intent: web-data-sample - Auto-mode path configuration reference
          paths: [
            "web/data · data/mock · *ai-platform* → Simplebeacon gate",
            "other paths → Roadmap filesystem scan",
          ],
          note: "See Simplebeacon or Roadmap rows for full path lists.",
        },
      ];

    case "complete": {
      const uniquePaths = Array.from(new Set(gate.flatMap((s) => s.paths)));
      return [
        {
          label: "Step 1 — Simplebeacon gate",
          paths: uniquePaths.slice(0, 6),
          note: "Credentials, production-leak, schema, fiction KPI, LLM slop, agency handoff.",
        },
        {
          label: "Step 2 — Consolidation",
          paths: ["scanPaths sample JSON", "**/*.json repo hash"],
          note: "Duplicate groups + merge candidates.",
        },
        {
          label: "Step 3 — Fiction digest",
          paths: ["**/*.json (repository-wide)"],
          note: "KPI consistency patterns across all repo JSON.",
        },
        {
          label: "Step 4 — Roadmap",
          paths: ["**/* project tree"],
          note: "Sprint phases, dependency graph, effort estimates.",
        },
        {
          label: "Step 5 — Codebase",
          paths: ["All discovered code files (full depth)"],
          note: "Tech debt, debug artifacts, ESLint, understanding layers.",
        },
        {
          label: "Steps 6–8 — File reduction · Data quality · Cleanup",
          paths: ["Repo walk (see those modes)"],
          note: "Dry-run disk hygiene + data-cleanup scanners + tiered safe-delete brief.",
        },
        {
          label: "Step 9 — Compliance",
          paths: ["Gate report + 8-rule checklist"],
          note: "Corporate safety / EU checklist rules evaluated on gate results.",
        },
        {
          label: "Step 10 — npm audit",
          paths: ["package.json + lockfile"],
          note: "Live npm audit for supply-chain vulnerabilities.",
        },
      ];
    }

    default:
      return [];
  }
}

/**
 * Render section.
 * @param {any} section
 * @param {number} index
 * @returns {any}
 */
function renderSection(section, index) {
  const paths = (section.paths || []).filter(Boolean);
  const hasCount = section.count != null && section.countLabel;
  const stepNum = section.step
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border-radius:50%;background:var(--primary);color:#fff;font-size:0.7rem;font-weight:700;margin-right:0.5rem;flex-shrink:0;">${section.step}</span>`
    : "";
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:0.75rem 1rem;display:flex;flex-direction:column;gap:0.5rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        ${stepNum}
        <strong style="font-size:0.85rem;color:var(--text-primary);flex:1;">${escapeHtml(section.label)}</strong>
        ${hasCount ? `<span style="font-size:0.75rem;color:var(--success);background:rgba(var(--success-rgb),0.1);padding:0.15rem 0.5rem;border-radius:999px;font-weight:600;white-space:nowrap;">${formatNumber(section.count)} ${escapeHtml(section.countLabel)}</span>` : ""}
      </div>
      ${
        paths.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
        ${paths.map((p) => `<span style="font-size:0.75rem;background:var(--bg);color:var(--text-secondary);padding:0.2rem 0.5rem;border-radius:var(--radius-sm);border:1px solid var(--border);font-family:var(--font-mono,monospace);">${escapeHtml(String(p))}</span>`).join("")}
      </div>`
          : ""
      }
      ${section.note ? `<p style="font-size:0.75rem;color:var(--text-muted);margin:0;line-height:1.4;">${escapeHtml(section.note)}</p>` : ""}
    </div>
  `;
}

/**
 * @param {string} modeValue
 * @param {{ projectPath?: string, config?: object, report?: object }} context
 */
/**
 * Render mode file scope panel.
 * @param {any} modeValue
 * @param {string} context
 * @returns {any}
 */
export function renderModeFileScopePanel(modeValue, context = {}) {
  const ctx = resolveScopeContext(context);
  const sections = modeSections(modeValue, ctx);
  if (!sections.length) return "";

  const profileLine = `<span style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.75rem;background:var(--bg);color:var(--text-secondary);padding:0.25rem 0.6rem;border-radius:999px;border:1px solid var(--border);">
    <span style="width:0.5rem;height:0.5rem;border-radius:50%;background:var(--success);display:inline-block;"></span>
    ${escapeHtml(ctx.profile)}
  </span>`;
  const roadmapLive = modeValue === "roadmap" && ctx.roadmapMetrics;
  const liveLine = roadmapLive
    ? `<strong>${formatNumber(ctx.roadmapMetrics.totalFiles)}</strong> files · <strong>${formatNumber(ctx.roadmapMetrics.codeFiles)}</strong> code · ${ctx.roadmapMetrics.generatedAt ? new Date(ctx.roadmapMetrics.generatedAt).toLocaleDateString() : "just now"}`
    : ctx.reportFresh && ctx.counts.ruleScoped != null
      ? `<strong>${formatNumber(ctx.counts.ruleScoped)}</strong> rule-scoped · <strong>${formatNumber(ctx.counts.repositoryFiles)}</strong> repo inventory`
      : "Run analysis to attach live file counts";
  const benchmarkLine = ctx.benchmarkScan
    ? "Benchmark clone under github-cache/ — product scanPaths and production rules are not walked. Use ai-platform root for handoff evidence."
    : null;

  return `
    <div class="analyze-mode-file-scope" style="margin-top:1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
        <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;display:flex;align-items:center;gap:0.5rem;">
          <span style="font-size:1rem;">📁</span> Files analyzed by this mode
        </h3>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          ${profileLine}
          <span style="font-size:0.75rem;color:var(--text-muted);">${liveLine}</span>
        </div>
      </div>
      ${
        benchmarkLine
          ? `<div style="font-size:0.75rem;color:var(--warning);background:rgba(var(--warning-rgb),0.08);border:1px solid var(--warning-border, var(--border));border-radius:var(--radius-sm);padding:0.5rem 0.75rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;">
        <span>⚠️</span> ${escapeHtml(benchmarkLine)}
      </div>`
          : ""
      }
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:0.75rem;">
        ${sections.map(renderSection).join("")}
      </div>
      <p style="font-size:0.7rem;color:var(--text-muted);margin:0.75rem 0 0;text-align:right;">
        Config: <code style="font-size:0.7rem;">.simplebeacon/config.json</code> · <a href="/dashboard/settings" style="color:var(--primary);">Edit paths</a>
      </p>
    </div>
  `;
}
