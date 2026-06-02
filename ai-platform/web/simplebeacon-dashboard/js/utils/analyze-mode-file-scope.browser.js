/**
 * Per-mode file/path scope for Analyze page mode pills — mirrors SimpleBeacon config + scanScope.
 * simplebeacon:production-leak-intent: web-data-sample - Legitimate web data path configuration for analysis mode file scope
 */

import { escapeHtml, formatNumber } from '../utils.js';
import { isBenchmarkCachePath } from './complete-scan-artifact-profile.browser.js';

const DEFAULT_SCAN_PATHS = ['web/data', 'data/mock', 'tests/fixtures', 'data'];
const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/'];
const FILE_REDUCTION_SKIP = [
  'node_modules/',
  'coverage/',
  'dist/',
  'build/',
  '.git/',
  'github-cache/',
  'deliverables/'
];
const DATA_QUALITY_SCANNERS = [
  'config-sprawl',
  'env-key-hygiene',
  'data-freshness',
  'privacy-exposure',
  'lineage-gaps',
  'schema-drift',
  'duplicate-config',
  'consistency-anchors'
];
const FILE_REDUCTION_SCANNERS = ['build-artifacts', 'asset-consolidation', 'unused-files'];

/** Normalize roadmap payload from analyze API, complete step, or imported export JSON. */
export function normalizeRoadmapRoot(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.roadmap && typeof payload.roadmap === 'object') return payload.roadmap;
  if (payload.type === 'dynamic-project-roadmap-analysis' || payload.codeAnalysis) return payload;
  if (payload.data?.roadmap) return payload.data.roadmap;
  if (payload.data?.codeAnalysis) return payload.data;
  return null;
}

export function extractRoadmapFileMetrics(payload) {
  const root = normalizeRoadmapRoot(payload);
  if (!root) return null;
  const structure = root.codeAnalysis?.structure;
  const sourceMetrics = root.strategicInsights?.sourceMetrics;
  const totalFiles = structure?.totalFiles ?? sourceMetrics?.totalFiles ?? null;
  const codeFiles = structure?.codeFiles ?? sourceMetrics?.codeFiles ?? null;
  const apiRoutes = root.aiIntegration?.apiRouteCount ?? sourceMetrics?.apiRoutes ?? null;
  const generatedAt = root.generatedAt ?? root.timestamp ?? null;
  if (totalFiles == null && codeFiles == null) return null;
  return {
    totalFiles,
    codeFiles,
    apiRoutes,
    generatedAt,
    dataSource: root.dataSource || sourceMetrics?.dataSource || 'filesystem-scan'
  };
}

function resolveScopeContext(context = {}) {
  const { config, report, projectPath, lastResult } = context;
  const scope = report?.scanScope || {};
  const roadmapMetrics = (() => {
    if (!lastResult) return null;
    if (lastResult.kind === 'roadmap') return extractRoadmapFileMetrics(lastResult.data);
    if (lastResult.kind === 'complete') {
      const step = lastResult.steps?.find((s) => s.id === 'roadmap');
      return extractRoadmapFileMetrics(step?.data);
    }
    return null;
  })();
  const scanPaths = Array.isArray(report?.scanPaths) && report.scanPaths.length
    ? report.scanPaths
    : (Array.isArray(config?.scanPaths) && config.scanPaths.length ? config.scanPaths : DEFAULT_SCAN_PATHS);
  const productionPaths = scope.productionPaths?.length
    ? scope.productionPaths
    : (config?.productionPaths?.length ? config.productionPaths : DEFAULT_PRODUCTION_PATHS);
  const sourceCodeScanPaths = scope.sourceCodeScanPaths?.length
    ? scope.sourceCodeScanPaths
    : (config?.sourceCodeScanPaths?.length
      ? config.sourceCodeScanPaths
      : productionPaths);
  return {
    scanPaths,
    productionPaths,
    sourceCodeScanPaths,
    profile: scope.profile || config?.profile || 'standard',
    ignore: config?.ignore || [],
    benchmarkScan: Boolean(report?.benchmarkScan || isBenchmarkCachePath(projectPath)),
    counts: {
      repositoryFiles: scope.repositoryFilesTotal ?? report?.repositoryFilesTotal ?? null,
      ruleScoped: scope.ruleScopedFilesAnalyzed ?? report?.ruleScopedFilesAnalyzed ?? null,
      fictionJson: scope.fictionJsonFilesScanned ?? report?.fictionJsonFilesScanned ?? null,
      productionDirs: scope.productionDirsScanned ?? report?.productionLeakScanned ?? null,
      mockSample: scope.mockSampleFilesInScanPaths ?? report?.mockSampleFiles ?? null,
      euAiAct: scope.euAiActFilesScanned ?? report?.euAiActScanned ?? null,
      llmSlop: scope.llmSlopFilesScanned ?? report?.llmSlopFilesScanned ?? null,
      sourceCode: scope.sourceCodeFilesScanned ?? report?.sourceCodeFilesScanned ?? null
    },
    reportFresh: Boolean(report?.generatedAt),
    roadmapMetrics
  };
}

function gateFileSections(ctx) {
  return [
    {
      label: 'Mock / sample JSON (scanPaths)',
      paths: ctx.scanPaths,
      count: ctx.counts.mockSample,
      countLabel: 'sample files in paths',
      note: 'Schema, sample-consistency, roadmap page specs, mock fiction KPI rules.'
    },
    {
      label: 'Production code (credentials + production-leak)',
      paths: ctx.productionPaths,
      count: ctx.counts.productionDirs,
      countLabel: 'files under production dirs',
      // simplebeacon:production-leak-intent - legitimate sample path reference for file scope analysis
      note: 'Credential patterns and hardcoded *-sample.json references from prod directories.'
    },
    {
      label: 'Source code pattern rules',
      paths: ctx.sourceCodeScanPaths.length ? ctx.sourceCodeScanPaths : ctx.productionPaths,
      count: ctx.counts.sourceCode ?? ctx.counts.llmSlop,
      countLabel: 'source files scanned',
      note: 'Fiction KPI in code, LLM slop markers, agency handoff patterns.'
    },
    {
      label: 'Repository fiction JSON',
      paths: ['**/*.json (repo-wide, respects ignore)'],
      count: ctx.counts.fictionJson,
      countLabel: 'JSON files',
      note: 'Fiction KPI / consistency patterns across repository JSON (not just scanPaths).'
    }
  ];
}

function modeSections(modeValue, ctx) {
  const gate = gateFileSections(ctx);

  switch (modeValue) {
    case 'simplebeacon':
      return gate;

    case 'eu-ai-act':
      return [
        ...gate,
        {
          label: 'EU AI Act patterns (eu-ai-act profile)',
          paths: ctx.sourceCodeScanPaths.length ? ctx.sourceCodeScanPaths : ctx.productionPaths,
          count: ctx.counts.euAiAct,
          countLabel: 'files scanned for EU markers',
          note: 'Transparency, documentation, human oversight, logging — plus checklist on gate report.'
        },
        {
          label: 'Artifacts written',
          paths: ['.simplebeacon/eu-ai-act-compliance.json', '.simplebeacon/eu-ai-act-assessment.json', '.simplebeacon/eu-ai-act-report.json'],
          note: 'Product root only — github-cache benchmark clones are blocked.'
        }
      ];

    case 'mock-scan':
      return [{
        label: 'Fiction KPI digest',
        paths: ['**/*.json (repository-wide)'],
        count: ctx.counts.fictionJson,
        countLabel: 'JSON files',
        note: 'Filters to fiction / KPI / consistency issue types from the gate fiction rules.'
      }];

    case 'roadmap': {
      const live = ctx.roadmapMetrics;
      const sections = [{
        label: 'Filesystem roadmap generator',
        paths: ['**/* (project tree)'],
        count: live?.totalFiles ?? ctx.counts.repositoryFiles,
        countLabel: live ? 'files in roadmap walk' : 'repo files indexed (gate cache)',
        note: live
          ? `Sprint phases, dependency graph, effort — ${formatNumber(live.codeFiles) ?? '—'} code files · ${formatNumber(live.apiRoutes) ?? '—'} API routes · ${live.dataSource || 'filesystem-scan'}.`
          : 'Sprint phases, dependency graph, effort — respects .simplebeacon ignore patterns. Run Roadmap analysis for a live walk count.'
      }];
      if (live?.totalFiles != null && ctx.counts.repositoryFiles != null
        && Number(live.totalFiles) !== Number(ctx.counts.repositoryFiles)) {
        sections.push({
          label: 'Gate inventory (reference)',
          paths: ['from .simplebeacon/report.json repositoryInventory'],
          count: ctx.counts.repositoryFiles,
          countLabel: 'repo files (gate audit profile)',
          note: 'Different walker than roadmap — gate uses Simplebeacon scan profile; roadmap uses code-roadmap-generator ignore rules.'
        });
      }
      return sections;
    }

    case 'consolidation':
      return [
        {
          label: 'Sample JSON (scanPaths)',
          paths: ctx.scanPaths,
          count: ctx.counts.mockSample,
          countLabel: 'sample JSON in paths',
          note: 'Structure similarity and merge candidates among configured mock/sample folders.'
        },
        {
          label: 'Duplicate detection',
          paths: ['**/*.json (repository-wide hash)'],
          count: ctx.counts.fictionJson,
          countLabel: 'JSON hashed',
          note: 'Exact duplicate groups across all repo JSON, not only scanPaths.'
        }
      ];

    case 'codebase':
      return [{
        label: 'Full codebase depth',
        paths: ['**/*.{js,mjs,cjs,ts,tsx,jsx,py,...}', 'ESLint when available'],
        count: ctx.counts.repositoryFiles,
        countLabel: 'repo files indexed',
        note: 'Tech debt, debug artifacts, understanding layers — every discovered code file.'
      }];

    case 'file-reduction':
      return [
        {
          label: 'Repo walk (skips regenerable dirs)',
          paths: FILE_REDUCTION_SKIP.map((p) => `skip ${p}`),
          note: 'Walks project tree excluding regenerable / vendor directories.'
        },
        {
          label: 'Scanners',
          paths: FILE_REDUCTION_SCANNERS.map((id) => id.replace(/-/g, ' ')),
          note: 'Dry-run only — build artifacts, duplicate assets, unused-file candidates.'
        }
      ];

    case 'data-quality':
      return [
        {
          label: 'Repo walk',
          paths: ['**/* (excludes node_modules, coverage, dist, build, .git)'],
          count: ctx.counts.repositoryFiles,
          countLabel: 'repo files indexed',
          note: 'Eight data-cleanup scanners run over discovered files.'
        },
        {
          label: 'Scanners',
          paths: DATA_QUALITY_SCANNERS.map((id) => id.replace(/-/g, ' '))
        }
      ];

    case 'cleanup-assistant':
      return [
        ...modeSections('file-reduction', ctx),
        ...modeSections('data-quality', ctx),
        {
          label: 'Agent brief output',
          paths: ['tiered safe-delete list', 'protected mock paths from scanPaths'],
          note: 'Combines file-reduction + data-quality; exports Cursor cleanup brief.'
        }
      ];

    case 'compliance':
      return [
        ...gate,
        {
          label: 'Checklist evaluation',
          paths: ['Uses fresh gate report.json — no extra file walk'],
          note: 'Corporate safety / EU checklist rules evaluated on the gate scan above.'
        }
      ];

    case 'npm-audit':
      return [{
        label: 'npm dependency tree',
        paths: ['package.json', 'package-lock.json (or npm-shrinkwrap.json)'],
        note: 'Live npm audit at the project path on the dashboard server.'
      }];

    case 'auto':
      return [
        {
          label: 'Smart pick (at run time)',
          paths: [
            'web/data · data/mock · *ai-platform* → Simplebeacon gate',
            'other paths → Roadmap filesystem scan'
          ],
          note: 'See Simplebeacon or Roadmap rows for full path lists.'
        }
      ];

    case 'complete':
      return [
        { label: 'Step 1 — Simplebeacon gate', paths: gate.flatMap((s) => s.paths).slice(0, 6), note: 'Standard profile — see Simplebeacon mode.' },
        { label: 'Step 2 — Consolidation', paths: ['scanPaths sample JSON', '**/*.json repo hash'], note: 'Duplicate groups + merge candidates.' },
        { label: 'Step 3 — Fiction digest', paths: ['**/*.json (repository-wide)'] },
        { label: 'Step 4 — Roadmap', paths: ['**/* project tree'] },
        { label: 'Step 5 — Codebase', paths: ['All discovered code files (full depth)'] },
        { label: 'Steps 6–8 — File reduction · Data quality · Cleanup', paths: ['Repo walk (see those modes)'] },
        { label: 'Step 9 — Compliance', paths: ['Gate report + 8-rule checklist'] },
        { label: 'Step 10 — npm audit', paths: ['package.json + lockfile'] }
      ];

    default:
      return [];
  }
}

function renderSection(section) {
  const paths = (section.paths || []).filter(Boolean);
  const countNote = section.count != null && section.countLabel
    ? `<span class="analyze-mode-scope-count">${formatNumber(section.count)} ${escapeHtml(section.countLabel)}</span>`
    : '';
  return `
    <div class="analyze-mode-scope-block">
      <div class="analyze-mode-scope-head">
        <strong>${escapeHtml(section.label)}</strong>
        ${countNote}
      </div>
      <ul class="analyze-mode-scope-paths">
        ${paths.map((p) => `<li><code>${escapeHtml(String(p))}</code></li>`).join('')}
      </ul>
      ${section.note ? `<p class="text-muted analyze-mode-scope-note">${escapeHtml(section.note)}</p>` : ''}
    </div>
  `;
}

/**
 * @param {string} modeValue
 * @param {{ projectPath?: string, config?: object, report?: object }} context
 */
export function renderModeFileScopePanel(modeValue, context = {}) {
  const ctx = resolveScopeContext(context);
  const sections = modeSections(modeValue, ctx);
  if (!sections.length) return '';

  const profileLine = `Profile: <code>${escapeHtml(ctx.profile)}</code>`;
  const roadmapLive = modeValue === 'roadmap' && ctx.roadmapMetrics;
  const liveLine = roadmapLive
    ? `Last roadmap walk: ${formatNumber(ctx.roadmapMetrics.totalFiles)} files (${formatNumber(ctx.roadmapMetrics.codeFiles)} code) · ${ctx.roadmapMetrics.generatedAt ? new Date(ctx.roadmapMetrics.generatedAt).toLocaleString() : 'just now'}.`
    : ctx.reportFresh && ctx.counts.ruleScoped != null
      ? `Last gate scan: ${formatNumber(ctx.counts.ruleScoped)} rule-scoped files · ${formatNumber(ctx.counts.repositoryFiles)} repo inventory.`
      : 'Run analysis to attach live file counts from report.json scanScope.';
  const benchmarkLine = ctx.benchmarkScan
    ? 'Benchmark clone under github-cache/ — product scanPaths and production rules are not walked. Use ai-platform root for handoff evidence.'
    : null;

  return `
    <div class="analyze-mode-file-scope">
      <h3 class="analyze-mode-scope-title">Files analyzed by this mode</h3>
      <p class="text-muted analyze-mode-scope-intro">${profileLine} · ${escapeHtml(liveLine)}</p>
      ${benchmarkLine ? `<p class="text-warning analyze-mode-scope-warning" style="font-size:var(--font-size-xs);">${escapeHtml(benchmarkLine)}</p>` : ''}
      <div class="analyze-mode-scope-grid">
        ${sections.map(renderSection).join('')}
      </div>
      <p class="text-muted analyze-mode-scope-footer" style="font-size:var(--font-size-xs);margin:0.75rem 0 0;">
        Paths from <code>.simplebeacon/config.json</code> when present — edit in <a href="#/settings">Settings → Scan paths</a>.
      </p>
    </div>
  `;
}
