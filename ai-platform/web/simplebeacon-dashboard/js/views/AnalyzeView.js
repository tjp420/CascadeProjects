import { escapeHtml, showToast, downloadJson, downloadBlob, downloadText, redactPathForDisplay, formatPathLabel, formatPathInputValue, formatAiSummarySkipMessage, isRedactedPathDisplay } from '../utils.js';
import {
  analyzePath,
  scanPath,
  summarizeReport,
  fetchAnalyzeProviders,
  fetchRepositoryInventory,
  fetchCodebaseAnalysis,
  enrichScanReport,
  fetchZscriptModReport,
  shouldFetchZscriptReport,
  isLegacyScanReport,
  buildMonorepoScopeNote,
  buildPathInventoryProvenance,
  renderInventoryProvenanceHtml,
  refreshPathInventory,
  liveInventoryForPath,
  renderScanScopePanel,
  isSimplebeaconReport,
  aiProviderSupportsSummary,
  getScanFileMetrics,
  resolveAutoAnalysisMode,
  buildScanConclusion,
  buildConsolidationConclusion,
  buildFictionDigestPayload,
  sanitizeFictionDigestExport,
  resolveCompleteScanTargetPath,
  normalizeProjectPath,
  filterIssuesByKind,
  preparePlatformResultsReport,
  fetchCompleteAuditReport,
  fetchAnalyzeExportBundleZip,
  fetchEuAiActAuditReport,
  openAuditReportPrintWindow,
  previewAuditExportTier,
  auditExportButtonLabel,
  fetchDataCleanupScan,
  ensureDashboardApiReady,
  assertCompleteScanComplianceFresh,
  assertCompleteScanFileReductionFresh,
  fetchUnderstandSnippet,
  isCodebaseReport,
  fetchComplianceChecklist,
  fetchProjectNpmAudit,
  exportAgencyCertificate,
  fetchAgencyBranding,
  prepareGithubRepo,
  fetchAnalyzeTestSources,
  isAnalyzeProviderConfigured
} from '../services/analyzeService.js?v=20260531pathfix1';
import { isRemoteRepoUrl, sourceChipTitle } from '../lib/analyzePathSources.js';
import { reportMatchesPagePath, resolvePageProjectPath, getPathInputDisplayValue } from '../lib/pageRepoScan.js';
import {
  collectPathSuggestions,
  refreshPathSuggestionsDatalist,
  pathInputListAttr,
  renderPathSuggestionsDatalistElement,
  saveRecentPath,
  removeRecentPath,
  loadRecentPaths
} from '../lib/analyzePathSuggestions.js';
import { validateProjectPathAllowlist } from '../lib/analyzePathAllowlist.js';
import { isBenchmarkCachePath } from '../utils/complete-scan-artifact-profile.browser.js';
import { runEuAiActSprint } from '../services/operatorService.js?v=20260531eupdf1';
import { renderModeFileScopePanel, extractRoadmapFileMetrics } from '../utils/analyze-mode-file-scope.browser.js?v=20260601roadmapscope1';
import { renderModeFileResultsPanel } from '../utils/analyze-mode-file-results.browser.js?v=20260601filereconcile1';
import { renderScanPaywall, buildPublicSummaryFromScan, isDeliverableLocked } from '../components/ScanPaywall.js';
import {
  AI_SYSTEM_ISSUES,
  ANALYZER_CATALOG,
  groupIssuesByCategory,
  buildAiSystemsIssueAnalysis
} from '../services/aiProblemAnalyzerSuite.mjs';
import { renderIssueList } from '../components/IssueCard.js';
import { renderConsolidationPanel } from '../components/ConsolidationReport.js';
import { renderDataCleanupPanel, buildDataCleanupConclusion } from '../components/DataCleanupReport.js?v=20260527exec5';
import {
  buildCompleteScanAnalysis,
  renderCompleteScanAnalysisPanel,
  formatCompleteScanBytes,
  sanitizeCompleteScanBundle,
  sanitizeConsolidationExport,
  sanitizeRoadmapExport
} from '../utils/completeScanAnalysis.js?v=20260601completescan1';
import { sanitizeNpmAuditExport } from '../utils/npm-audit-export.browser.js?v=20260601npmaudit5';
import { sanitizeComplianceBundleExport } from '../utils/compliance-export.browser.js?v=20260601complianceexport6';
import {
  buildCleanupAssistantBrief,
  buildCleanupBriefFromLastResult,
  buildCleanupAssistantConclusion,
  isCleanupBriefRunnable,
  resolveFileReductionPlan,
  loadCleanupPolicy,
  saveCleanupPolicy,
  readCleanupPolicyFromDom,
  renderCleanupAssistantPanel
} from '../utils/cleanupAssistant.js?v=20260601cleanupbrief9';
import { sanitizeCleanupBriefExport } from '../utils/cleanup-brief-export.browser.js?v=20260601cleanupbrief9';
import { sanitizeDataCleanupReportExport } from '../utils/data-cleanup-export.browser.js?v=20260601datacleanup8';
import { sanitizeCodebaseReportExport } from '../utils/codebase-export.browser.js?v=20260601codebase8';
import {
  sanitizeAiProblemAnalyzerExport,
  aiProblemAnalyzerExportFilename,
  buildAiProblemAnalyzerCsv
} from '../utils/ai-problem-analyzer-export.browser.js?v=20260531aianalyzerexport4';
import { renderCodebasePanel, buildCodebaseConclusion } from '../components/CodebaseReport.js';
import { renderUnderstandingPanel, buildUnderstandingConclusion } from '../components/UnderstandingReport.js';
import { renderZscriptReportPanel, buildZscriptConclusion } from '../components/ZscriptReport.js';
import { showLoginModal } from '../components/LoginModal.js';
import { authService } from '../services/authService.js';
import {
  MAX_SNIPPET_BYTES,
  isSupportedSourceFile,
  isAnalyzerCacheJson,
  isCleanupExportJson,
  isFictionDigestJson,
  isLockfileName,
  isMarkdownFileName,
  isScannerMetaFileName,
  filterSnippetFindingsForFile,
  scanSnippetText,
  computeThreatScore,
  redactMatch,
  severityLabel
} from '../utils/snippetDiagnostic.js?v=20260531analyzers1';

const SNIPPET_ACCEPT = '.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.env,.yaml,.yml,.txt,.md,.html,.css,.xml,.toml,.ini,.sh,.ps1,.bat';

function readHashQueryParam(name) {
  const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return '';
  return new URLSearchParams(hash.slice(qIndex + 1)).get(name) || '';
}

function formatCount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString();
}

function pathToFileSlug(projectPath) {
  return (projectPath || 'scan')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'scan';
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

const ANALYZE_PREFS_KEY = 'simplebeaconAnalyzePrefs';

function analysisTypeUsesAiNarrative(type) {
  return String(type || '').toLowerCase() !== 'roadmap';
}

function analysisTypeSupportsRoadmapInsights(type) {
  const t = String(type || '').toLowerCase();
  return t === 'roadmap' || t === 'complete';
}

function analysisTypeSupportsUnderstanding(type) {
  const t = String(type || '').toLowerCase();
  return t === 'codebase' || t === 'complete';
}

const COMPLETE_STEPS = [
  { id: 'simplebeacon', label: 'Simplebeacon gate' },
  { id: 'consolidation', label: 'Data consolidation' },
  { id: 'mock-scan', label: 'Fiction & KPI digest' },
  { id: 'roadmap', label: 'Roadmap generation' },
  { id: 'codebase', label: 'Codebase analysis' },
  { id: 'file-reduction', label: 'File reduction' },
  { id: 'data-quality', label: 'Data quality' },
  { id: 'cleanup-assistant', label: 'Cleanup assistant' },
  { id: 'npm-audit', label: 'npm audit' },
  { id: 'compliance', label: 'Compliance checklist' }
];

const OPTIONAL_COMPLETE_ENGINES = [
  { id: 'eu-ai-act', label: 'EU AI Act sprint', hint: 'Regulatory — not included in ZIP unless checked and completed' }
];

const COMPLETE_ENGINE_ORDER = [...COMPLETE_STEPS.map((step) => step.id), ...OPTIONAL_COMPLETE_ENGINES.map((step) => step.id)];

const ENGINE_DEPENDENCIES = {
  'mock-scan': ['simplebeacon'],
  compliance: ['simplebeacon']
};

/** Engines that fetch their own prerequisites — no separate queue rows on Complete. */
const SELF_CONTAINED_ENGINES = new Set(['cleanup-assistant', 'mock-scan', 'compliance']);

function isSelfContainedOnlySelection(selectedEngines) {
  const selected = normalizeSelectedEngines(selectedEngines, { allowEmpty: true });
  return selected.length === 1 && SELF_CONTAINED_ENGINES.has(selected[0]);
}

function defaultSelectedEngines() {
  return COMPLETE_STEPS.map((step) => step.id);
}

/** Client deliverable SKUs — scans preset per row; price is list/reference (checkout is separate). */
const CLIENT_DELIVERABLE_PLANS = [
  {
    sku: 'community',
    label: 'Community',
    price: '$0',
    category: 'Community',
    tagline: 'Simplebeacon gate only — free CLI + MCP on your machine',
    engines: ['simplebeacon'],
    analysisType: 'simplebeacon',
    scans: ['Simplebeacon gate only']
  },
  {
    sku: 'clearance499',
    label: 'Executive clearance PDF',
    price: '$499',
    category: 'Client deliverable',
    tagline: 'Gate, fiction digest, compliance checklist, executive PDF — 48-hour operator review',
    engines: ['simplebeacon', 'mock-scan', 'compliance'],
    analysisType: 'complete',
    scans: ['Gate', 'Fiction digest', 'Compliance', 'Executive PDF']
  },
  {
    sku: 'agency999',
    label: 'Agency Project Pack',
    price: '$999',
    category: 'Client deliverable',
    tagline: 'Full complete scan plus co-branded milestone certificates',
    engines: defaultSelectedEngines(),
    analysisType: 'complete',
    scans: ['Complete scan (10 engines)', 'Certificates']
  },
  {
    sku: 'agency1499',
    label: 'Agency Growth Pack',
    price: '$1,499',
    category: 'Client deliverable',
    tagline: 'Project pack plus priority review and included warranty re-scan',
    engines: defaultSelectedEngines(),
    analysisType: 'complete',
    scans: ['Complete scan', 'Certificates', 'Warranty re-scan']
  },
  {
    sku: 'euai2499',
    label: 'EU AI Act Readiness Sprint',
    price: '$2,499',
    category: 'EU regulatory',
    tagline: 'Technical readiness audit — not legal conformity certification',
    engines: ['simplebeacon', 'compliance', 'eu-ai-act'],
    analysisType: 'complete',
    scans: ['EU profile gate', 'EU patterns', 'Compliance', 'EU audit PDF']
  },
  {
    sku: 'warranty199',
    label: 'Post-handoff re-scan',
    price: '$199',
    category: 'Retention',
    tagline: 'Formal 30-day re-attestation after release',
    engines: ['simplebeacon', 'compliance'],
    analysisType: 'complete',
    scans: ['Gate re-run', 'Compliance', 'Executive PDF']
  },
  {
    sku: 'custom',
    label: 'Custom mix',
    price: 'Operator',
    category: 'Desk only',
    tagline: 'Check scans in the queue below (or on pills) — no fixed list price',
    engines: null,
    analysisType: 'complete',
    allowManual: true,
    scans: ['Manual engine toggles — no fixed price']
  }
];

const PRICING_DELIVERABLES_URL = 'https://simplebeacon.ai/pricing#client-deliverables';

function getClientDeliverablePlan(sku) {
  return CLIENT_DELIVERABLE_PLANS.find((plan) => plan.sku === sku) || null;
}

function getDeliverablePlanEngines(plan) {
  if (!plan || plan.allowManual) return null;
  return Array.isArray(plan.engines) ? plan.engines : null;
}

function inferDeliverableSku(selectedEngines) {
  const selected = new Set(normalizeSelectedEngines(selectedEngines, { allowEmpty: true }));
  for (const plan of CLIENT_DELIVERABLE_PLANS) {
    const expected = getDeliverablePlanEngines(plan);
    if (!expected) continue;
    const want = new Set(expected);
    if (want.size === selected.size && [...want].every((id) => selected.has(id))) {
      return plan.sku;
    }
  }
  return 'custom';
}

function normalizeSelectedEngines(raw, { allowEmpty = false } = {}) {
  const allowed = new Set(COMPLETE_ENGINE_ORDER);
  const selected = Array.isArray(raw)
    ? raw.filter((id) => allowed.has(id))
    : defaultSelectedEngines();
  if (!selected.length && allowEmpty) return [];
  return selected.length ? selected : defaultSelectedEngines();
}

function resolveEnginesForRun(selectedEngines) {
  const selected = new Set(normalizeSelectedEngines(selectedEngines));
  for (const [engineId, deps] of Object.entries(ENGINE_DEPENDENCIES)) {
    if (!selected.has(engineId)) continue;
    for (const dep of deps) selected.add(dep);
  }
  return COMPLETE_ENGINE_ORDER.filter((id) => selected.has(id));
}

/** Keep queue checkboxes aligned for explicit co-selection (Complete scan deps use resolveEnginesForRun). */
function applyEngineSelectionChange(selectedSet, engineId, checked) {
  if (!engineId || !selectedSet) return;
  if (checked) {
    selectedSet.add(engineId);
    return;
  }
  selectedSet.delete(engineId);
}

/** Standalone pill → only that engine in the queue (internal deps are not shown). */
function ensureStandaloneEngineSelection(modeValue) {
  const engineId = modeToEngineId(modeValue);
  return engineId ? [engineId] : [];
}

/** Always show the full engine list; selection state is separate from visibility. */
function queueEnginesForDisplay() {
  return COMPLETE_ENGINE_ORDER;
}

function queueSelectAllState(selectedEngines) {
  const queueEngineIds = queueEnginesForDisplay();
  const selected = new Set(selectedEngines || []);
  const allSelected = queueEngineIds.every((id) => selected.has(id));
  const someSelected = queueEngineIds.some((id) => selected.has(id));
  return { queueEngineIds, allSelected, someSelected };
}

function getCompleteEngineLabel(engineId) {
  return COMPLETE_STEPS.find((step) => step.id === engineId)?.label
    || OPTIONAL_COMPLETE_ENGINES.find((step) => step.id === engineId)?.label
    || engineId;
}

function getEngineModeMeta(engineId) {
  return ANALYSIS_MODES.find((m) => modeToEngineId(m.value) === engineId) || null;
}

function modeToEngineId(modeValue) {
  const value = String(modeValue || '');
  if (!value || value === 'complete' || value === 'auto') return null;
  return COMPLETE_ENGINE_ORDER.includes(value) ? value : null;
}

const SIMPLEBEACON_GATE_RULES = [
  { id: 'credentials', label: 'Credential & secret patterns in scan paths + production dirs' },
  { id: 'production-leak', label: 'Mock/sample JSON paths referenced from production code' },
  { id: 'json-schema', label: 'Registered page samples match schema specs' },
  { id: 'sample-consistency', label: 'Anchor sample consistency / fiction KPI drift' },
  { id: 'fiction-kpi-patterns', label: 'Fiction KPI placeholders across repository JSON' },
  { id: 'llm-slop-patterns', label: 'LLM slop — unresolved placeholders, code fences, filler metrics' },
  { id: 'agency-handoff-patterns', label: 'Agency handoff — localhost deploy leaks, auth misconfig, webhooks' },
  { id: 'roadmap', label: 'Roadmap completeness signal (standard profile)' }
];

const EU_AI_ACT_EXTRA_RULES = [
  { id: 'eu-ai-act-patterns', label: 'EU AI Act transparency, logging, and human-oversight markers' }
];

const DATA_QUALITY_SCANNERS = [
  'config-management',
  'dependency-health',
  'environment-variables',
  'data-freshness',
  'data-access-patterns',
  'data-privacy',
  'data-lineage',
  'data-consistency'
];

const FILE_REDUCTION_SCANNERS = ['build-artifacts', 'asset-consolidation', 'unused-files'];

const COMPLIANCE_CHECKLIST_RULES = [
  'GATE-001 — Merge gate passes on configured severities',
  'CRED-001 — No credential patterns in scanned paths',
  'LEAK-001 — No mock/sample JSON paths in production dirs',
  'DATA-001 — Page samples match schema specs',
  'DATA-002 — No fiction KPI drift in anchor samples',
  'SUPPLY-001 — No critical/high npm audit vulnerabilities',
  'SUPPLY-002 — Moderate npm vulnerabilities within policy',
  'AUTH-001 — Production profile has JWT auth enabled (REQUIRE_AUTH)'
];

function completeStepLabel(index, text, totalSteps = COMPLETE_ENGINE_ORDER.length) {
  return `${index + 1}/${totalSteps} ${text}`;
}

function resolveCompleteScanCounts(lastResult) {
  const steps = lastResult?.steps || [];
  const enginesRun = lastResult?.enginesRun?.length
    ? lastResult.enginesRun
    : lastResult?.analysisConfig?.enginesRun?.length
      ? lastResult.analysisConfig.enginesRun
      : steps.map((step) => step.id);
  const planned = enginesRun.length || steps.length || COMPLETE_STEPS.length;
  const succeeded = steps.length;
  return {
    enginesRun,
    planned,
    succeeded,
    failed: Math.max(0, planned - succeeded)
  };
}

function formatScanProgressDetails(sp, options = {}) {
  if (!sp || sp.active === false) return { counter: '', scopeNote: '' };
  const processed = sp.processed != null ? Number(sp.processed) : null;
  const total = sp.total != null ? Number(sp.total) : null;
  const phase = String(sp.phase || '');
  const label = String(sp.label || sp.fileKind || '');
  const folderLabel = options.scanPathLabel ? String(options.scanPathLabel).trim() : '';
  const fullTree = Boolean(options.fullDirectoryScan || phase === 'full-tree');

  let unit = 'files';
  let phaseLabel = label || 'Scanning';

  if (fullTree || sp.fileKind === 'full-tree' || (sp.fileKind === 'scan-scoped' && options.fullDirectoryScan)) {
    phaseLabel = 'Full-tree gate walk';
  } else if (sp.fileKind === 'scan-scoped') {
    phaseLabel = 'Gate walk';
  } else if (phase === 'codebase' || sp.fileKind === 'code') {
    phaseLabel = /eslint/i.test(label) ? 'ESLint' : 'Code analysis';
    unit = /eslint/i.test(label) ? 'lint targets' : 'code files';
  } else if (phase === 'gate') {
    phaseLabel = 'Simplebeacon gate';
  }

  let counter = '';
  if (processed != null && total != null) {
    counter = `${phaseLabel} · ${formatCount(processed)} / ${formatCount(total)} ${unit}`;
  } else if (phaseLabel) {
    counter = phaseLabel;
  }

  const scopeParts = [];
  if (folderLabel) {
    scopeParts.push(`Folder: ${folderLabel}.`);
  }

  const explorer = options.explorerInventory;

  if (fullTree && total != null) {
    const skipped = Array.isArray(sp.skipDirs) ? sp.skipDirs : [];
    const strictFullTree = Boolean(options.fullDirectoryScan && skipped.length <= 1);
    scopeParts.push(
      strictFullTree
        ? 'Every file under the selected path is included (node_modules, etc.) — skips .git, .github-sync CLI mirror, and github-cache benchmark clones only.'
        : `This step scans ${formatCount(total)} files after skipping ${skipped.length ? skipped.join(', ') : 'configured dirs'}.`
    );
    if (explorer?.totalFiles != null && Math.abs(explorer.totalFiles - total) > 50) {
      const folderPart = explorer.totalFolders != null
        ? ` / ${formatCount(explorer.totalFolders)} folders`
        : '';
      scopeParts.push(
        `Explorer-style inventory for the same path: ${formatCount(explorer.totalFiles)} files${folderPart}.`
      );
    }
  } else if (phase === 'codebase' || sp.fileKind === 'code') {
    scopeParts.push('Source-code extensions only (.js, .ts, .py, …) — not images, JSON, or other assets.');
    if (explorer?.totalFiles != null && total != null && explorer.totalFiles !== total) {
      scopeParts.push(
        `Folder holds ${formatCount(explorer.totalFiles)} files total; this step covers ${formatCount(total)} ${unit}.`
      );
    }
  } else if (explorer?.totalFiles != null && total != null && explorer.totalFiles !== total) {
    scopeParts.push(
      `Folder inventory: ${formatCount(explorer.totalFiles)} files${explorer.totalFolders != null ? `, ${formatCount(explorer.totalFolders)} folders` : ''}; active scan: ${formatCount(total)} ${unit}.`
    );
  } else if (sp.repositoryAuditFiles != null && total != null && sp.repositoryAuditFiles !== total) {
    scopeParts.push(
      `${formatCount(sp.repositoryAuditFiles)} audit-scoped repo files (skips node_modules, github-cache, etc.).`
    );
  }

  return { counter, scopeNote: scopeParts.join(' ').trim() };
}

function checklistRuleTotal(checklist) {
  const fromSummary = checklist?.summary?.total;
  if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary;
  const fromRules = (checklist?.rules || []).length;
  return fromRules > 0 ? fromRules : 0;
}

function normalizePathKey(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function renderComplianceChecklistPanel(checklist, options = {}) {
  const downloadId = options.downloadButtonId ?? 'download-compliance-json';
  if (!checklist) {
    return '<p class="text-muted mt-4">Compliance checklist did not run.</p>';
  }
  const ruleTotal = checklistRuleTotal(checklist);
  const profileLabel = options.profileLabel
    || (checklist.summary?.checklistProfile === 'eu-ai-act' ? 'EU AI Act technical (10 rules)' : 'Corporate safety (8 rules)');
  const notHandoff = checklist.summary?.benchmarkScan || checklist.summary?.hollowGate || checklist.summary?.handoffEligible === false;
  const passHandoff = options.handoffEligible === true || checklist.summary?.handoffEligible === true;
  const legalReady = checklist.summary?.legalHandoffEligible === true;
  const callout = notHandoff && checklist.summary?.headline
    ? `<div class="analyze-info-callout mb-4">${escapeHtml(checklist.summary.headline)}</div>`
    : legalReady
      ? '<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">Technical controls pass and legal classification is signed — ready for counsel-reviewed EU handoff pack.</div>'
      : passHandoff
        ? '<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">Technical checklist pass for this scan profile. Legal classification sign-off still required for EU conformity handoff.</div>'
        : '';
  const exportNotes = Array.isArray(options.exportNotes) && options.exportNotes.length
    ? `<ul class="text-muted mb-3" style="font-size: var(--font-size-sm);">${options.exportNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
    : '';
  return `
    <p class="text-muted mb-2" style="font-size: var(--font-size-xs);">Profile: <strong>${escapeHtml(profileLabel)}</strong> · static scan only — not legal conformity certification.</p>
    ${callout}
    ${exportNotes}
    <div class="metrics-row mb-4 mt-4">
      <div class="metric-chip gate-badge ${checklist.summary?.failed ? 'warn' : 'pass'}">
        ${checklist.summary?.passed ?? 0}/${ruleTotal} passed
      </div>
      <div class="metric-chip"><strong>${checklist.summary?.failed ?? 0}</strong> failed</div>
      ${checklist.summary?.skipped ? `<div class="metric-chip"><strong>${checklist.summary.skipped}</strong> skipped</div>` : ''}
      ${checklist.summary?.readyForAutomation === false ? '<div class="metric-chip"><strong>Not automation-ready</strong></div>' : ''}
    </div>
    <ul class="analyze-mode-steps">
      ${(checklist.rules || []).map((rule) => `
        <li><strong>${escapeHtml(rule.id)}</strong> — ${escapeHtml(rule.title || rule.name || '')}
          <span class="text-muted"> (${escapeHtml(rule.status || 'unknown')})</span></li>
      `).join('')}
    </ul>
    ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4 mt-4" id="${escapeHtml(downloadId)}">Download compliance JSON</button>` : ''}
  `;
}

function renderNpmAuditPanel(npmAudit, options = {}) {
  const downloadId = options.downloadButtonId ?? 'download-npm-audit-json';
  if (!npmAudit || npmAudit.error) {
    return `<p class="text-muted mt-4">${escapeHtml(npmAudit?.error || 'npm audit did not run.')}</p>`;
  }
  if (npmAudit.skipped) {
    return `
      <div class="analyze-info-callout mb-4">${escapeHtml(npmAudit.scopeNote || 'npm audit was not run for this scan path.')}</div>
      <p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        Scan profile: <code>${escapeHtml(npmAudit.scanTargetProfile || 'non-npm-project')}</code>
        ${npmAudit.handoffEligible === false ? ' · not valid for Simplebeacon platform handoff' : ''}
      </p>
      ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4" id="${escapeHtml(downloadId)}">Download npm audit JSON</button>` : ''}
    `;
  }
  const auditRootNote = npmAudit.auditRoot && npmAudit.projectPath
    && normalizePathKey(npmAudit.auditRoot) !== normalizePathKey(npmAudit.projectPath)
    ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        Audited <code>${escapeHtml(formatPathInputValue(npmAudit.auditRoot))}</code>
        (Node platform root for scan path <code>${escapeHtml(formatPathInputValue(npmAudit.projectPath))}</code>).
      </p>`
    : npmAudit.auditRoot
      ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
          Audited <code>${escapeHtml(redactPathForDisplay(npmAudit.auditRoot))}</code>.
        </p>`
      : '';
  const supplyStatus = npmAudit.supplyChainStatus
    || (npmAudit.summary?.critical === 0 && npmAudit.summary?.high === 0 ? 'pass' : 'review');
  const passCallout = supplyStatus === 'pass'
    ? `<div class="analyze-info-callout mb-4" style="border-color: var(--color-success, #22c55e);">
        Supply chain: <strong>pass</strong> — 0 critical and 0 high npm audit findings.
        ${npmAudit.handoffEligible ? ' Eligible for platform handoff supply-chain rules.' : ''}
      </div>`
    : '';
  const exportNotes = Array.isArray(npmAudit.exportNotes) && npmAudit.exportNotes.length
    ? `<ul class="text-muted mb-3" style="font-size: var(--font-size-sm);">
        ${npmAudit.exportNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
      </ul>`
    : '';
  return `
    ${passCallout}
    ${auditRootNote}
    ${exportNotes}
    <div class="metrics-row mb-4 mt-4">
      <div class="metric-chip"><strong>${npmAudit.summary?.dependencies ?? npmAudit.dependencies?.total ?? '—'}</strong> dependencies</div>
      <div class="metric-chip"><strong>${npmAudit.summary?.total ?? npmAudit.vulnerabilityTotal ?? 0}</strong> vulnerabilities</div>
      ${npmAudit.summary?.critical != null ? `<div class="metric-chip"><strong>${npmAudit.summary.critical}</strong> critical</div>` : ''}
      ${npmAudit.summary?.high != null ? `<div class="metric-chip"><strong>${npmAudit.summary.high}</strong> high</div>` : ''}
      ${npmAudit.summary?.moderate != null ? `<div class="metric-chip"><strong>${npmAudit.summary.moderate}</strong> moderate</div>` : ''}
    </div>
    ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4" id="${escapeHtml(downloadId)}">Download npm audit JSON</button>` : ''}
  `;
}

function renderEuAiActSprintPanel(sprint, options = {}) {
  if (!sprint) {
    return '<p class="text-muted mt-4">EU AI Act sprint did not run.</p>';
  }
  const s = sprint;
  const failedRules = s.compliance?.failedRules || [];
  const failedRulesHtml = failedRules.length
    ? `<ul class="analyze-mode-steps mb-4">${failedRules.map((rule) => `
        <li><strong>${escapeHtml(rule.id)}</strong> — ${escapeHtml(rule.title || '')}
          <span class="text-muted"> (${escapeHtml(rule.evidence || '')})</span></li>
      `).join('')}</ul>`
    : '';
  const downloadId = options.downloadButtonId ?? 'download-eu-compliance-json';
  const showIntro = options.showIntro !== false;
  const showActions = options.showActions !== false;
  return `
    ${showIntro ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
      <strong>Reference scan</strong> — not an active paid SKU. EU pattern hits flag AI integrations (usually MEDIUM warnings).
      Gate FAIL means ${s.gate?.blockingCount ?? '—'} HIGH-severity blocking issue(s) under <code>failOn: high</code>.
      Checklist uses <strong>10 rules</strong> (9 technical + EUAI-000 legal attestation) — separate from Complete bundle's 8-rule corporate checklist.
    </p>` : ''}
    <div class="metrics-row mb-4">
      <div class="metric-chip gate-badge ${s.gate?.pass ? 'pass' : 'warn'}">${s.gate?.pass ? 'PASS' : 'FAIL'}</div>
      <div class="metric-chip"><strong>${s.gate?.blockingCount ?? '—'}</strong> blocking (high)</div>
      <div class="metric-chip"><strong>${s.gate?.warningCount ?? s.euPatternHits ?? '—'}</strong> warnings (medium)</div>
      <div class="metric-chip"><strong>${s.compliance?.passed ?? 0}/${s.compliance?.total ?? 0}</strong> checklist</div>
      <div class="metric-chip"><strong>${s.compliance?.score ?? '—'}%</strong> readiness</div>
    </div>
    ${s.compliance?.headline ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">${escapeHtml(s.compliance.headline)}</p>` : ''}
    ${s.complianceChecklist ? renderComplianceChecklistPanel(s.complianceChecklist, {
      downloadButtonId: downloadId,
      profileLabel: 'EU AI Act technical + legal (10 rules)'
    }) : ''}
    ${!s.complianceChecklist && failedRules.length ? `<h3 class="mb-2" style="font-size: var(--font-size-base);">Failed checklist rules</h3>${failedRulesHtml}` : ''}
    ${s.relativeArtifacts ? `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Artifacts</h3>
      <ul class="analyze-mode-steps mb-4">
        ${Object.entries(s.relativeArtifacts).map(([key, rel]) => `<li><strong>${escapeHtml(key)}</strong> — <code>${escapeHtml(rel)}</code></li>`).join('')}
      </ul>
    ` : ''}
    <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">${escapeHtml(s.disclaimer || 'Static technical readiness — not legal conformity certification.')}</p>
    ${showActions ? `
      <div class="analyze-action-row mb-4">
        <a class="btn btn-primary btn-sm" href="#/eu-ai-act">Open EU AI Act results</a>
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-secondary btn-sm" href="/eu-ai-act-sample-report" target="_blank" rel="noopener">Sample report layout</a>
        <a class="btn btn-ghost btn-sm" href="#/results">Gate blocking issues</a>
      </div>
    ` : `
      <div class="analyze-action-row mb-4">
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-ghost btn-sm" href="#/eu-ai-act">Open EU AI Act page</a>
      </div>
    `}
  `;
}

const ANALYSIS_MODES = [
  {
    value: 'complete',
    group: 'bundle',
    label: 'Complete',
    desc: 'Ten core engines + optional EU AI Act sprint — gate through npm audit, with regulatory add-on when checked',
    icon: '⚡',
    tag: 'Bundle',
    steps: [
      'Simplebeacon gate — credentials, production-leak, schema, fiction KPI, LLM slop, agency handoff',
      'Consolidation — duplicate JSON groups and merge candidates',
      'Fiction digest — repository-wide JSON KPI patterns',
      'Roadmap — filesystem sprint phases from code-roadmap-generator',
      'Codebase — full-depth ESLint + understanding layers',
      'File reduction — build-artifacts, asset-consolidation, unused-files (dry-run)',
      'Data quality — 8 scanners (config, env, privacy, lineage, consistency)',
      'Cleanup assistant — tiered safe-delete brief for agent mode',
      'Live npm audit — supply-chain vulnerabilities',
      'Compliance checklist — 8 corporate safety rules on gate report',
      'EU AI Act sprint (optional) — eu-ai-act profile gate + 10-rule checklist + assessment artifacts'
    ],
    deliverable: 'Audit PDF + JSON bundle'
  },
  {
    value: 'simplebeacon',
    group: 'standalone',
    label: 'Simplebeacon',
    desc: 'Standard profile gate — credentials, production-leak, schema, fiction KPI, LLM slop, agency handoff',
    icon: '🛡️',
    tag: 'Gate',
    steps: SIMPLEBEACON_GATE_RULES.map((rule) => rule.label),
    deliverable: 'CI-ready pass/fail + .simplebeacon/report.json'
  },
  {
    value: 'roadmap',
    group: 'standalone',
    label: 'Roadmap',
    desc: 'Sprint phases, dependency graph, effort estimates',
    icon: '🗺️',
    tag: 'Planning',
    deliverable: 'Filesystem roadmap JSON'
  },
  {
    value: 'mock-scan',
    group: 'standalone',
    label: 'Mock data',
    desc: 'Fiction KPI patterns across repository JSON — runs Simplebeacon gate internally first',
    icon: '🔍',
    tag: 'Fiction',
    steps: [
      'Simplebeacon gate scan (automatic)',
      'Fiction & KPI digest from gate report'
    ],
    deliverable: 'Fiction issue digest'
  },
  {
    value: 'consolidation',
    group: 'standalone',
    label: 'Consolidation',
    desc: 'Duplicate JSON groups and merge candidates',
    icon: '🔀',
    tag: 'Ops',
    deliverable: 'Dedup savings report'
  },
  {
    value: 'codebase',
    group: 'standalone',
    label: 'Codebase',
    desc: 'Tech debt, debug artifacts, ESLint (full repo depth)',
    icon: '🧹',
    tag: 'Hygiene',
    deliverable: 'Health score + findings'
  },
  {
    value: 'file-reduction',
    group: 'standalone',
    label: 'File reduction',
    desc: 'Dry-run disk hygiene — build artifacts, duplicate assets, unused-file candidates',
    icon: '📦',
    tag: 'Reduce',
    steps: FILE_REDUCTION_SCANNERS.map((id) => id.replace(/-/g, ' ')),
    deliverable: 'Reclaimable space estimate + tier list'
  },
  {
    value: 'data-quality',
    group: 'standalone',
    label: 'Data quality',
    desc: 'Eight data-cleanup scanners — config sprawl, env keys, freshness, privacy, lineage, consistency',
    icon: '🧪',
    tag: 'Data',
    steps: DATA_QUALITY_SCANNERS.map((id) => id.replace(/-/g, ' ')),
    deliverable: 'Hygiene + privacy findings JSON'
  },
  {
    value: 'cleanup-assistant',
    group: 'standalone',
    label: 'Cleanup assistant',
    desc: 'Tier safe deletes, protect mock data, export agent brief — runs file reduction + data quality internally',
    icon: '🗂️',
    tag: 'Agent',
    steps: [
      'File reduction scan (automatic)',
      'Data quality scan (automatic)',
      'Tiered cleanup brief + export'
    ],
    deliverable: 'Cursor cleanup brief + prompt'
  },
  {
    value: 'compliance',
    group: 'standalone',
    label: 'Compliance',
    desc: 'Corporate safety checklist (8 rules) on a fresh gate report — runs Simplebeacon gate internally first',
    icon: '✅',
    tag: 'Compliance',
    steps: [
      'Simplebeacon gate scan (automatic)',
      ...COMPLIANCE_CHECKLIST_RULES
    ],
    deliverable: 'Rule-by-rule pass/fail JSON'
  },
  {
    value: 'eu-ai-act',
    group: 'regulatory',
    label: 'EU AI Act sprint',
    desc: 'eu-ai-act profile gate + EU pattern hits + checklist + assessment artifacts (operator vault)',
    icon: '🇪🇺',
    tag: 'Regulatory',
    steps: [
      ...SIMPLEBEACON_GATE_RULES.map((rule) => rule.label),
      ...EU_AI_ACT_EXTRA_RULES.map((rule) => rule.label),
      'EU compliance checklist profile + assessment report',
      'Writes .simplebeacon/eu-ai-act-*.json under platform root'
    ],
    deliverable: 'Reference sample + .simplebeacon/eu-ai-act-*.json (not a paid SKU)'
  },
  {
    value: 'npm-audit',
    group: 'standalone',
    label: 'npm audit',
    desc: 'Live npm audit for the project path on the server',
    icon: '📦',
    tag: 'Supply chain',
    deliverable: 'Vulnerability summary JSON'
  },
  {
    value: 'auto',
    group: 'standalone',
    label: 'Auto',
    desc: 'Mock-data path → Simplebeacon, else roadmap',
    icon: '🤖',
    tag: 'Smart pick',
    deliverable: 'Best-fit single scan'
  }
];

function getAnalysisMode(value) {
  return ANALYSIS_MODES.find((m) => m.value === value) || ANALYSIS_MODES[0];
}

function isPlausibleProjectPath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 280) return false;
  if (isRemoteRepoUrl(raw)) return true;
  if (/outside allowed analysis roots|projectPath is required|projectPath is outside/i.test(raw)) {
    return false;
  }
  if (/allowedAnalysisRoots|ANALYZE_ALLOWED_ROOTS|restart the server/i.test(raw)) {
    return false;
  }
  if (/\.(bat|cmd|exe|ps1|sh|js|json|html?|md|txt)$/i.test(raw)) return false;
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return true;
  if (raw.startsWith('\\\\') || raw.startsWith('/')) return true;
  if (/^[\w.-]+([\\/]|$)/.test(raw)) return true;
  return false;
}

function loadAnalyzePrefs() {
  try {
    const raw = localStorage.getItem(ANALYZE_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnalyzePrefs(prefs) {
  localStorage.setItem(ANALYZE_PREFS_KEY, JSON.stringify(prefs));
}

function basenamePath(projectPath) {
  if (!projectPath) return '';
  const parts = projectPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

function formatElapsed(ms) {
  if (!ms || ms < 1000) return '<1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/** EU AI Act Article 50: Users interact with an AI-assisted analysis system; responses may be AI-generated. */

export class AnalyzeView {
  constructor(app) {
    this.app = app;
    this.busy = false;
    const prefs = loadAnalyzePrefs();
    this.aiProvider = prefs.aiProvider || 'active';
    this.roadmapInsightsMode = prefs.roadmapInsightsMode || 'deterministic';
    this.understandingMode = prefs.understandingMode || 'deterministic';
    this.analysisType = app.state.analyzeResult?.kind === 'complete'
      ? 'complete'
      : app.state.analyzeResult?.kind === 'consolidation'
        ? 'consolidation'
        : app.state.analyzeResult?.kind === 'codebase'
          ? 'codebase'
          : app.state.analyzeResult?.kind === 'eu-ai-act'
            ? 'eu-ai-act'
            : (prefs.analysisType || app.state.analyzeResult?.data?.analysisType || 'complete');
    this.lastResult = app.state.analyzeResult || null;
    this.completeStep = '';
    this.completeProgress = null;
    this.scanStartedAt = null;
    this.scanProgress = null;
    this._progressPollTimer = null;
    this.providers = [];
    this.issueTaxonomyGroups = groupIssuesByCategory();
    this.selectedIssueIds = new Set(AI_SYSTEM_ISSUES.map((issue) => issue.id));
    this.aiIssueAnalysisResult = null;
    this.snippetResult = null;
    this.snippetBusy = false;
    this.certificateMilestone = 'release';
    this.certificateClientName = '';
    this.certificateProjectName = '';
    this.certificateOrgId = 'default';
    const urlProjectId = readHashQueryParam('project_id') || '';
    const storedProjectId = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('simplebeacon_agency_project_id') || '')
      : '';
    this.certificateProjectId = urlProjectId || storedProjectId || '';
    if (urlProjectId && typeof localStorage !== 'undefined') {
      localStorage.setItem('simplebeacon_agency_project_id', urlProjectId);
    }
    this.agencyBrandingLoaded = false;
    this.certificateExportBusy = false;
    this.fullDirectoryScan = typeof localStorage !== 'undefined'
      && localStorage.getItem('simplebeacon_full_directory_scan') === '1';
    this.selectedEngines = Array.isArray(prefs.selectedEngines)
      ? normalizeSelectedEngines(prefs.selectedEngines, { allowEmpty: true })
      : defaultSelectedEngines();
    this.selectedDeliverableSku = prefs.selectedDeliverableSku
      || inferDeliverableSku(this.selectedEngines);
    const savedPlan = getClientDeliverablePlan(this.selectedDeliverableSku);
    const savedPlanEngines = getDeliverablePlanEngines(savedPlan);
    if (!Array.isArray(prefs.selectedEngines) && savedPlanEngines) {
      this.selectedEngines = [...savedPlanEngines];
    }
    const standaloneEngine = modeToEngineId(this.analysisType);
    if (standaloneEngine) {
      this.selectedEngines = ensureStandaloneEngineSelection(this.analysisType);
      this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
    } else if (isSelfContainedOnlySelection(this.selectedEngines)) {
      this.analysisType = this.selectedEngines[0];
      this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
    }
    this.testSources = [];
    this._onAiKeysUpdated = () => {
      const select = this._root?.querySelector('#ai-provider-select');
      if (select) void this.loadProviders(select, { refresh: true });
    };
    this._pathUiTimer = null;
  }

  render() {
    const defaultPath = this.app.state.defaultProjectPath || '';
    const displayPath = this.getPathInputDisplayValue();

    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <h1 class="page-title">Analyze <span class="text-muted" style="font-size: var(--font-size-sm); font-weight: 500;">build ${escapeHtml(String(window.__SIMPLEBEACON_DASHBOARD_BUILD__ || '20260601-enginequeueonly'))}</span></h1>
      <p class="text-muted mb-6">Drop a single source file for a quick pattern check, import a JSON report, or scan a repo folder on the dashboard server. Engines match the current <code>simplebeacon-cli</code> standard profile (credentials, production-leak, LLM slop, agency handoff) plus eight data-quality scanners and an EU AI Act sprint mode. <strong>Complete</strong> runs all ten steps with audit PDF + certificate export.</p>

      ${this.renderFileDropCard()}

      <div class="card mb-6 analyze-path-card">
        <div class="card-header">
          <span class="card-title">Project path or repo URL</span>
          <div class="analyze-path-header-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="use-default-path-btn" ${defaultPath ? '' : 'disabled'}>Use server default</button>
            <button type="button" class="btn btn-ghost btn-sm" id="clear-path-btn">Clear</button>
          </div>
        </div>

        <p class="text-muted analyze-path-intro">Enter a <strong>folder path</strong> on the machine running <code>npm run dashboard</code>, or paste a public repo URL (<strong>HTTPS</strong>, <code>git@host:org/repo</code>, or <code>ssh://</code>) from GitHub, GitLab, Bitbucket, or Codeberg. Use <strong>Test sources</strong> below for one-click paths. Then click <strong>Run analysis</strong>.</p>

        <div class="analyze-path-input-wrap">
          <input type="text" id="project-path-input" class="analyze-path-input"
            placeholder="C:\\dev\\my-app · data/mock · git@github.com:org/repo · https://codeberg.org/org/repo"
            value="${escapeHtml(formatPathInputValue(displayPath))}"
            list="${pathInputListAttr()}"
            spellcheck="false"
            autocomplete="list"
            aria-label="Project path on server">
          ${renderPathSuggestionsDatalistElement(collectPathSuggestions(this.app, this.testSources))}
        </div>
        <div id="analyze-inventory-provenance" class="analyze-inventory-provenance-slot">
          ${this.renderInventoryProvenanceLine(displayPath)}
        </div>
        <label class="analyze-full-tree-toggle text-muted" style="display:flex;align-items:center;gap:0.5rem;font-size:var(--font-size-xs);margin:0 0 var(--space-3);">
          <input type="checkbox" id="analyze-full-directory" ${this.fullDirectoryScan ? 'checked' : ''}>
          Analyze <strong>every file</strong> in the selected folder (full tree — SHA-256 every file, content-scan all text files with no size cap, all gate rules on every text file; includes <code>node_modules</code>; skips <code>.github-sync</code> mirror and <code>github-cache</code> clones)
        </label>

        ${this.renderPathSourceSections(defaultPath, displayPath)}

        <p class="text-muted mb-2" style="font-size: var(--font-size-xs);">Select a <strong>client deliverable SKU</strong> — the table sets which scans run and which artifacts export. Use <strong>custom</strong> to toggle engines in the scan queue below. Checkout is separate from this page. <a href="${PRICING_DELIVERABLES_URL}" target="_blank" rel="noopener">Public pricing →</a></p>
        ${this.renderClientDeliverablePicker()}
        ${this.renderSelectedModeDetail()}

        <div class="analyze-action-row">
          <select id="analysis-type-select" class="analyze-select" aria-label="Analysis type" hidden>
            ${ANALYSIS_MODES.map((m) => `<option value="${m.value}" ${this.analysisType === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
          <div id="analyze-roadmap-insights-wrap" class="analyze-roadmap-insights-wrap${analysisTypeSupportsRoadmapInsights(this.analysisType) ? '' : ' is-hidden'}">
            <label for="roadmap-insights-select" class="text-muted" style="font-size: var(--font-size-xs);">Roadmap insights</label>
            <select id="roadmap-insights-select" class="analyze-select" aria-label="Roadmap insights mode">
              <option value="off" ${this.roadmapInsightsMode === 'off' ? 'selected' : ''}>Filesystem only</option>
              <option value="deterministic" ${this.roadmapInsightsMode === 'deterministic' ? 'selected' : ''}>Deterministic (no LLM)</option>
              <option value="llm" ${this.roadmapInsightsMode === 'llm' ? 'selected' : ''}>+ LLM strategic layer</option>
            </select>
          </div>
          <div id="analyze-understanding-wrap" class="analyze-roadmap-insights-wrap${analysisTypeSupportsUnderstanding(this.analysisType) ? '' : ' is-hidden'}">
            <label for="understanding-mode-select" class="text-muted" style="font-size: var(--font-size-xs);">Code understanding</label>
            <select id="understanding-mode-select" class="analyze-select" aria-label="Code understanding mode">
              <option value="off" ${this.understandingMode === 'off' ? 'selected' : ''}>Static scan only</option>
              <option value="deterministic" ${this.understandingMode === 'deterministic' ? 'selected' : ''}>Semantic + context</option>
              <option value="llm" ${this.understandingMode === 'llm' ? 'selected' : ''}>+ LLM explanation</option>
            </select>
          </div>
          <div id="analyze-ai-provider-wrap" class="analyze-ai-provider-wrap${this.showAiProviderSelect() ? '' : ' is-hidden'}">
            <label for="ai-provider-select" class="text-muted" style="font-size: var(--font-size-xs);">AI narrative (optional)</label>
            <select id="ai-provider-select" class="analyze-select" aria-label="AI provider">
              <option value="active">Active model</option>
              <option value="demo">Filesystem scan (no AI)</option>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
            <p id="analyze-ai-provider-note" class="text-muted analyze-roadmap-note" style="font-size: var(--font-size-xs); margin: 0.35rem 0 0; max-width: 42rem;">
              Gate findings are always deterministic. Optional <strong>AI narrative</strong> uses the provider you pick here — Ollama reads <strong>Settings → AI providers</strong> (base URL + model). Cloud keys go in the same Settings panel.
            </p>
            <button type="button" class="btn btn-ghost btn-sm" id="refresh-analyze-providers-btn" style="margin-top: 0.35rem;">Refresh provider status</button>
          </div>
          <p id="analyze-roadmap-no-ai-note" class="text-muted analyze-roadmap-note${this.showRoadmapInsightsNote() ? '' : ' is-hidden'}" style="font-size: var(--font-size-xs); margin: 0;">
            Roadmap data is always from <code>code-roadmap-generator</code>. Insights layer adds executive summary + risk — choose LLM only for narrative interpretation of aggregated metrics.
          </p>
          <button type="button" class="btn btn-primary" id="run-analyze-btn" ${this.busy ? 'disabled' : ''}>
            ${this.busy ? (this.completeStep || 'Running…') : this.renderRunAnalyzeButtonLabel()}
          </button>
          ${this.lastResult ? '<button type="button" class="btn btn-secondary" id="goto-results-quick-btn">View results →</button>' : ''}
        </div>

        ${this.busy ? this.renderProgress() : ''}

        <p class="text-muted mt-3" style="font-size: var(--font-size-xs);">
          Gate mock folders are configured in <a href="#/settings">Settings → Scan paths</a>, not here.
          <strong>Filesystem scan</strong> = deterministic gate (findings never depend on AI).
          <strong>Complete</strong> runs all ten steps with full codebase depth (every discovered code file, ESLint when available). Gate step uses the standard profile: credentials, production-leak, schema, fiction KPI, LLM slop, and agency-handoff rules. File reduction, data quality, cleanup assistant, compliance checklist, and npm audit run at the end. Large repos may take several minutes. Paid client workspaces: <a href="#/deliverables">Deliverables vault</a>.
        </p>
      </div>

      ${this.renderScanEnginesReferenceCard()}

      ${this.renderAiSystemsIssueAnalyzerCard()}

      <div id="analyze-results">${this.renderResults()}</div>
    `;

    this.bindEvents(el);
    this._root = el;
    refreshPathSuggestionsDatalist(el, this.app, this.testSources);
    this.syncAnalyzeModeUi(el);
    if (displayPath) {
      void this.refreshReportForActivePath(el);
    }
    return el;
  }

  renderFileDropCard() {
    const busy = this.snippetBusy;
    const result = this.snippetResult;
    return `
      <div class="card analyze-dropzone mb-6${busy ? ' busy' : ''}" id="analyze-file-dropzone">
        <div class="analyze-dropzone-inner">
          <div class="analyze-dropzone-icon" aria-hidden="true">📄</div>
          <p class="card-title" style="margin-bottom: 0.35rem;">Quick file check</p>
          <p class="text-muted analyze-file-drop-lead">
            Drag &amp; drop a single file here, or browse. In-browser pattern scan covers credentials, mock-path leaks, fiction KPIs, LLM slop placeholders, and common deploy-leak markers — same family as the CLI gate.
            Optional server pass adds language detection and semantic summary (file text is sent to the dashboard API only when you run understanding).
          </p>
          <p class="text-muted analyze-file-drop-hint">Supported: ${escapeHtml(SNIPPET_ACCEPT.replace(/\./g, ' .'))} · max ${Math.round(MAX_SNIPPET_BYTES / 1024)} KB · JSON scan exports can be imported</p>
          <div class="analyze-dropzone-actions">
            <button type="button" class="btn btn-primary btn-sm" id="analyze-file-browse-btn" ${busy ? 'disabled' : ''}>Choose file</button>
            <button type="button" class="btn btn-ghost btn-sm" id="analyze-file-clear-btn" ${result ? '' : 'disabled'}>Clear</button>
          </div>
          <input type="file" id="analyze-file-input" accept="${SNIPPET_ACCEPT}" hidden>
        </div>
        ${result ? this.renderSnippetResults(result) : ''}
      </div>
    `;
  }

  renderSnippetResults(result) {
    const findings = result.findings || [];
    const threatScore = result.threatScore ?? 0;
    const critical = findings.filter((f) => f.severity === 'critical').length;
    const high = findings.filter((f) => f.severity === 'high').length;
    const understanding = result.understanding;

    const findingsHtml = findings.length
      ? `<ul class="analyze-snippet-findings">
          ${findings.slice(0, 8).map((f) => `
            <li>
              <span class="analyze-snippet-sev analyze-snippet-sev--${escapeHtml(f.severity)}">${escapeHtml(severityLabel(f.severity))}</span>
              <strong>${escapeHtml(f.label)}</strong> line ${f.line}
              <code>${escapeHtml(redactMatch(f.match))}</code>
            </li>
          `).join('')}
          ${findings.length > 8 ? `<li class="text-muted">+ ${findings.length - 8} more — run a full repo scan for branch-wide coverage</li>` : ''}
        </ul>`
        : (result.cacheMeta
        ? `<p class="text-muted analyze-snippet-clean">${
          result.cacheMeta.documentation
            ? 'Documentation file — rule names like `-sample.json` describe scanner behavior, not production imports.'
            : result.cacheMeta.lockfile
            ? 'Dependency lockfile — npm/yarn bin entries are not production mock-path leaks.'
            : `Scanner cache index${
              result.cacheMeta.fileCount != null
                ? ` (${formatCount(result.cacheMeta.fileCount)} tracked path(s))`
                : ''
            } — path keys are not production leak findings. Run a full repo scan for gate coverage.`
        }</p>`
        : '<p class="text-muted analyze-snippet-clean">No credential, mock-path, or AI-fiction KPI patterns in this file.</p>');

    const understandingHtml = understanding
      ? `
        <div class="analyze-snippet-understanding">
          <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0 0 0.5rem;">
            Server understanding · ${escapeHtml(understanding.layers?.static?.languageLabel || understanding.layers?.static?.language || 'unknown')}
          </p>
          <p style="font-size: var(--font-size-sm); margin: 0;">${escapeHtml(understanding.summary || understanding.layers?.semantic?.purpose || 'Summary unavailable.')}</p>
        </div>
      `
      : (result.understandingSkipped
        ? `<p class="text-muted analyze-snippet-note">${escapeHtml(result.understandingSkipped)}</p>`
        : '');

    return `
      <div class="analyze-snippet-results" id="analyze-snippet-results">
        <div class="analyze-snippet-results-head">
          <div>
            <strong>${escapeHtml(result.fileName || 'File')}</strong>
            <span class="text-muted"> · ${formatCount(result.bytes)} bytes</span>
          </div>
          <div class="metric-chip ${threatScore >= 35 ? 'metric-chip-danger' : ''}">
            Threat score <strong>${threatScore}</strong>/100
          </div>
        </div>
        <p class="text-muted analyze-snippet-meta">${findings.length} pattern hit(s) · ${critical} critical · ${high} high</p>
        ${findingsHtml}
        ${understandingHtml}
        ${result.cacheMeta ? '' : `
        <div class="analyze-snippet-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="analyze-snippet-understand-btn" ${this.snippetBusy ? 'disabled' : ''}>
            ${understanding ? 'Re-run server understanding' : 'Run server understanding'}
          </button>
        </div>`}
      </div>
    `;
  }

  renderPathSourceSections(defaultPath, currentPath) {
    const presetHtml = this.renderSourceChips(this.testSources, currentPath, 'analyze-preset-paths');
    const recent = loadRecentPaths().filter((p) => p !== defaultPath);
    const recentChips = [];
    if (defaultPath) {
      recentChips.push({ path: defaultPath, label: `Server: ${basenamePath(defaultPath)}`, primary: true });
    }
    for (const p of recent) {
      recentChips.push({
        path: p,
        label: formatPathLabel(p) || basenamePath(p),
        primary: false
      });
    }
    const recentHtml = recentChips.length
      ? this.renderSourceChips(
        recentChips.map((c) => ({ id: c.path, kind: 'recent', label: c.label, value: c.path, primary: c.primary })),
        currentPath,
        'analyze-recent-paths',
        { dismissible: true }
      )
      : '';

    if (!presetHtml && !recentHtml) return '';

    return `
      ${presetHtml ? `
        <div class="analyze-path-sources">
          <span class="analyze-path-sources-label text-muted">Test sources</span>
          ${presetHtml}
        </div>
      ` : ''}
      ${recentHtml ? `
        <div class="analyze-path-sources">
          <span class="analyze-path-sources-label text-muted">Recent</span>
          ${recentHtml}
        </div>
      ` : ''}
    `;
  }

  renderSourceChips(sources, currentPath, containerId, options = {}) {
    if (!sources?.length) {
      return containerId === 'analyze-preset-paths'
        ? `<div class="analyze-quick-paths" id="${containerId}"><span class="text-muted" style="font-size:var(--font-size-xs)">Loading test sources…</span></div>`
        : '';
    }
    return `
      <div class="analyze-quick-paths" id="${containerId}">
        ${sources.map((source) => {
          const value = source.value || '';
          const kindClass = source.kind ? `analyze-path-chip--${source.kind}` : '';
          const active = value === currentPath;
          const dismissible = options.dismissible && !source.primary;
          return `
          <span class="analyze-path-chip-wrap ${source.primary ? 'primary' : ''} ${active ? 'active' : ''} ${kindClass}">
            <button type="button" class="analyze-path-chip ${source.primary ? 'primary' : ''} ${active ? 'active' : ''} ${kindClass}"
              data-path="${escapeHtml(value)}" title="${escapeHtml(sourceChipTitle(source))}">
              ${source.kind === 'remote' ? '🌐 ' : source.kind === 'cached' ? '📦 ' : '📁 '}${escapeHtml(source.label)}
            </button>
            ${dismissible ? `<button type="button" class="analyze-path-chip-dismiss" data-path="${escapeHtml(value)}" aria-label="Remove ${escapeHtml(source.label)} from quick paths" title="Remove">×</button>` : ''}
          </span>`;
        }).join('')}
      </div>
    `;
  }

  async loadTestSources(container) {
    if (this._testSourcesLoading) return this._testSourcesLoading;
    if (this.testSources?.length && this._testSourcesLoadedAt && Date.now() - this._testSourcesLoadedAt < 120000) {
      return;
    }
    this._testSourcesLoading = (async () => {
    try {
      const data = await fetchAnalyzeTestSources();
      this.testSources = data.sources || [];
      this._testSourcesLoadedAt = Date.now();
      const pathInput = container?.querySelector('#project-path-input');
      const displayPath = this.getActiveProjectPath(pathInput?.value);
      const preset = container?.querySelector('#analyze-preset-paths')?.parentElement;
      if (preset) {
        const section = this.renderSourceChips(this.testSources, displayPath, 'analyze-preset-paths');
        const wrap = document.createElement('div');
        wrap.className = 'analyze-path-sources';
        wrap.innerHTML = `
          <span class="analyze-path-sources-label text-muted">Test sources</span>
          ${section}
        `;
        preset.replaceWith(wrap);
      }
      refreshPathSuggestionsDatalist(container, this.app, this.testSources);
    } catch {
      const el = container?.querySelector('#analyze-preset-paths');
      if (el) {
        el.innerHTML = '<span class="text-muted" style="font-size:var(--font-size-xs)">Test sources unavailable — restart dashboard (npm run dashboard:kill-ports && npm run dashboard:v1-internal).</span>';
      }
    }
    })();
    try {
      await this._testSourcesLoading;
    } finally {
      this._testSourcesLoading = null;
    }
  }

  renderRunAnalyzeButtonLabel() {
    if (this.analysisType !== 'complete') return 'Run analysis';
    const count = this.selectedEngines.length;
    if (!count) return 'Select engines';
    return `Run complete (${count})`;
  }

  renderClientDeliverablePicker() {
    const activeSku = this.selectedDeliverableSku || inferDeliverableSku(this.selectedEngines);
    const activePlan = getClientDeliverablePlan(activeSku);
    const runCount = resolveEnginesForRun(this.selectedEngines).length;
    const rows = CLIENT_DELIVERABLE_PLANS.map((plan) => {
      const selected = plan.sku === activeSku;
      const scansIncluded = (plan.scans || []).join(' · ');
      return `
        <tr class="analyze-deliverable-row${selected ? ' is-selected' : ''}" data-sku="${escapeHtml(plan.sku)}">
          <td class="analyze-deliverable-cell-select">
            <input type="radio" class="analyze-deliverable-input" name="client-deliverable-sku" value="${escapeHtml(plan.sku)}" ${selected ? 'checked' : ''} aria-label="${escapeHtml(plan.sku)} ${escapeHtml(plan.price)}">
          </td>
          <td class="analyze-deliverable-cell-sku">
            <code class="analyze-deliverable-sku-code">${escapeHtml(plan.sku)}</code>
            <span class="analyze-deliverable-row-label">${escapeHtml(plan.label)}</span>
          </td>
          <td class="analyze-deliverable-cell-price">${escapeHtml(plan.price)}</td>
          <td class="analyze-deliverable-cell-scans">${escapeHtml(scansIncluded)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="analyze-deliverable-picker" id="analyze-deliverable-picker">
        <div class="analyze-deliverable-picker-head">
          <span class="analyze-deliverable-picker-label">Client deliverable SKU</span>
          <span class="analyze-deliverable-picker-meta text-muted" id="analyze-deliverable-picker-meta">
            ${escapeHtml(activePlan?.sku || 'custom')} · ${escapeHtml(activePlan?.label || 'Custom mix')} · ${runCount} engine${runCount === 1 ? '' : 's'} will run
          </span>
        </div>
        <div class="analyze-deliverable-table-wrap">
          <table class="analyze-deliverable-table" role="radiogroup" aria-label="Client deliverable SKU">
            <thead>
              <tr>
                <th scope="col" class="analyze-deliverable-th-select"><span class="sr-only">Select</span></th>
                <th scope="col">SKU</th>
                <th scope="col">Price</th>
                <th scope="col">Scans included (preset)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        ${activePlan?.tagline ? `<p class="analyze-deliverable-active-note text-muted">${escapeHtml(activePlan.tagline)}</p>` : ''}
      </div>
    `;
  }

  renderEngineSelectionPanel() {
    return '';
  }

  readSelectedEnginesFromDom(root = this._root) {
    if (!root) {
      return normalizeSelectedEngines(this.selectedEngines);
    }
    let inputs = root.querySelectorAll('.analyze-engine-queue-input');
    if (!inputs.length) {
      inputs = root.querySelectorAll('.analyze-engine-input');
    }
    if (!inputs.length) return normalizeSelectedEngines(this.selectedEngines, { allowEmpty: true });
    const selected = [];
    const seen = new Set();
    inputs.forEach((input) => {
      const engineId = input.dataset.engine;
      if (input.checked && engineId && !seen.has(engineId)) {
        seen.add(engineId);
        selected.push(engineId);
      }
    });
    return normalizeSelectedEngines(selected, { allowEmpty: true });
  }

  syncClientDeliverablePicker(root = this._root) {
    if (!root) return;
    const activeSku = this.selectedDeliverableSku || inferDeliverableSku(this.selectedEngines);
    const activePlan = getClientDeliverablePlan(activeSku);
    const runCount = resolveEnginesForRun(this.selectedEngines).length;
    root.querySelectorAll('.analyze-deliverable-input').forEach((input) => {
      const selected = input.value === activeSku;
      input.checked = selected;
      input.closest('.analyze-deliverable-row')?.classList.toggle('is-selected', selected);
    });
    const meta = root.querySelector('#analyze-deliverable-picker-meta');
    if (meta) {
      const skuLabel = activePlan?.sku || 'custom';
      meta.textContent = `${skuLabel} · ${activePlan?.label || 'Custom mix'} · ${runCount} engine${runCount === 1 ? '' : 's'} will run`;
    }
    const note = root.querySelector('.analyze-deliverable-active-note');
    if (note) {
      note.textContent = activePlan?.tagline || '';
      note.hidden = !activePlan?.tagline;
    }
  }

  syncEngineSelectionHighlights(root = this._root) {
    if (!root) return;
    root.querySelectorAll('.analyze-engine-input').forEach((input) => {
      const engineId = input.dataset.engine;
      if (engineId) input.checked = this.selectedEngines.includes(engineId);
    });
    this.syncClientDeliverablePicker(root);
  }

  applyClientDeliverable(sku, root = this._root) {
    const plan = getClientDeliverablePlan(sku);
    if (!plan) return;
    this.selectedDeliverableSku = sku;
    const engines = getDeliverablePlanEngines(plan);
    if (engines) {
      this.selectedEngines = normalizeSelectedEngines(engines);
    }
    saveAnalyzePrefs({
      analysisType: this.analysisType,
      aiProvider: this.aiProvider,
      roadmapInsightsMode: this.roadmapInsightsMode,
      understandingMode: this.understandingMode,
      selectedEngines: this.selectedEngines,
      selectedDeliverableSku: this.selectedDeliverableSku
    });
    if (plan.analysisType && plan.analysisType !== this.analysisType) {
      const typeSelect = root?.querySelector('#analysis-type-select');
      this.setAnalysisType(plan.analysisType, { typeSelect });
      return;
    }
    if (root) {
      this.syncAnalyzeModeUi(root);
    }
  }

  persistSelectedEngines(root = this._root, changedEngineId = null, checked = null) {
    let selected = this.readSelectedEnginesFromDom(root);
    if (changedEngineId) {
      const set = new Set(selected);
      applyEngineSelectionChange(set, changedEngineId, checked);
      selected = COMPLETE_ENGINE_ORDER.filter((id) => set.has(id));
    }
    this.selectedEngines = normalizeSelectedEngines(selected, { allowEmpty: true });
    this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
    const typeSelect = root?.querySelector('#analysis-type-select');
    if (this.selectedEngines.length > 1) {
      if (this.analysisType !== 'complete') {
        this.setAnalysisType('complete', { typeSelect });
        return;
      }
    } else if (this.selectedEngines.length === 1) {
      const only = this.selectedEngines[0];
      if (modeToEngineId(only) === only && this.analysisType !== only) {
        this.setAnalysisType(only, { typeSelect });
        return;
      }
    }
    saveAnalyzePrefs({
      analysisType: this.analysisType,
      aiProvider: this.aiProvider,
      roadmapInsightsMode: this.roadmapInsightsMode,
      understandingMode: this.understandingMode,
      selectedEngines: this.selectedEngines,
      selectedDeliverableSku: this.selectedDeliverableSku
    });
    if (root) {
      root.querySelectorAll('.analyze-engine-input').forEach((input) => {
        const engineId = input.dataset.engine;
        if (engineId) input.checked = this.selectedEngines.includes(engineId);
      });
    }
    this.syncEngineSelectionHighlights(root);
    this.syncRunAnalyzeButtonLabel(root);
    this.syncSelectedEnginesDetail(root);
    this.syncZipExportButtonLabel(root);
  }

  setSelectedEngines(engineIds, root = this._root, options = {}) {
    this.selectedEngines = normalizeSelectedEngines(engineIds, options);
    this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
    saveAnalyzePrefs({
      analysisType: this.analysisType,
      aiProvider: this.aiProvider,
      roadmapInsightsMode: this.roadmapInsightsMode,
      understandingMode: this.understandingMode,
      selectedEngines: this.selectedEngines,
      selectedDeliverableSku: this.selectedDeliverableSku
    });
    if (root) {
      root.querySelectorAll('.analyze-engine-input').forEach((input) => {
        input.checked = this.selectedEngines.includes(input.dataset.engine);
      });
      this.syncEngineSelectionHighlights(root);
      this.syncRunAnalyzeButtonLabel(root);
      this.syncSelectedEnginesDetail(root);
      this.syncZipExportButtonLabel(root);
    }
  }

  bindClientDeliverablePicker(root = this._root) {
    if (!root) return;
    root.querySelectorAll('.analyze-deliverable-input').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) this.applyClientDeliverable(input.value, root);
      });
    });
    root.querySelectorAll('.analyze-deliverable-row').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('.analyze-deliverable-input')) return;
        const input = row.querySelector('.analyze-deliverable-input');
        if (!input || input.checked) return;
        input.checked = true;
        this.applyClientDeliverable(input.value, root);
      });
    });
  }

  applyEngineQueueSelectAll(checked, root = this._root) {
    const { queueEngineIds } = queueSelectAllState(this.selectedEngines);
    if (!queueEngineIds.length) return;
    if (checked) {
      if (this.analysisType !== 'complete') {
        const typeSelect = root?.querySelector('#analysis-type-select');
        this.setAnalysisType('complete', { typeSelect });
      }
      this.setSelectedEngines(queueEngineIds, root, { allowEmpty: true });
      return;
    }
    this.setSelectedEngines([], root, { allowEmpty: true });
  }

  bindEngineSelectionEvents(root = this._root) {
    if (!root) return;
    root.querySelectorAll('.analyze-engine-input').forEach((input) => {
      input.addEventListener('change', () => {
        this.persistSelectedEngines(root, input.dataset.engine, input.checked);
      });
      input.addEventListener('click', (event) => event.stopPropagation());
    });
    const selectAll = root.querySelector('#analyze-engine-queue-select-all');
    if (selectAll) {
      const { allSelected, someSelected } = queueSelectAllState(this.selectedEngines);
      selectAll.indeterminate = someSelected && !allSelected;
      selectAll.addEventListener('change', () => {
        this.applyEngineQueueSelectAll(selectAll.checked, root);
      });
    }
  }

  bindModeGridEvents(root = this._root) {
    this.bindEngineSelectionEvents(root);
  }

  syncRunAnalyzeButtonLabel(root = this._root) {
    const runBtn = root?.querySelector('#run-analyze-btn');
    if (!runBtn || this.busy) return;
    runBtn.textContent = this.renderRunAnalyzeButtonLabel();
    runBtn.disabled = !this.selectedEngines.length;
  }

  syncSelectedEnginesDetail(root = this._root) {
    if (!root) return;
    const slot = root.querySelector('#analyze-engine-queue-panel');
    if (slot) {
      slot.outerHTML = this.renderSelectedEnginesQueuePanel().trim();
      this.bindEngineSelectionEvents(root);
    }
  }

  renderSelectedEnginesQueuePanel() {
    const selected = new Set(this.selectedEngines);
    const isCompleteMode = this.analysisType === 'complete';
    const runOrder = isCompleteMode
      ? resolveEnginesForRun(this.selectedEngines)
      : this.selectedEngines.filter((id) => selected.has(id));
    const runIndex = new Map(runOrder.map((engineId, index) => [engineId, index + 1]));
    const currentEngineId = modeToEngineId(this.analysisType);
    const count = this.selectedEngines.length;
    const deliverable = getClientDeliverablePlan(this.selectedDeliverableSku || inferDeliverableSku(this.selectedEngines));
    const deliverableLabel = deliverable
      ? `${deliverable.price} · ${deliverable.label}`
      : 'Custom mix';

    const rows = queueEnginesForDisplay().map((engineId) => {
      const mode = getEngineModeMeta(engineId);
      const label = mode?.label || getCompleteEngineLabel(engineId);
      const icon = mode?.icon || '•';
      const isSelected = selected.has(engineId);
      const inRun = isCompleteMode && runIndex.has(engineId);
      const isCurrent = engineId === currentEngineId;
      const optional = OPTIONAL_COMPLETE_ENGINES.some((step) => step.id === engineId);
      const step = isCompleteMode ? runIndex.get(engineId) : (isSelected ? runIndex.get(engineId) : undefined);
      const depOnly = inRun && !isSelected;
      return `
        <li class="analyze-engine-queue-item${isSelected ? ' is-checked' : ' is-unchecked'}${isCurrent ? ' is-current' : ''}${optional ? ' is-optional' : ''}${depOnly ? ' is-dependency is-in-run' : ''}">
          <span class="analyze-engine-queue-step">${step ?? '—'}</span>
          <label class="analyze-engine-queue-toggle">
            <input type="checkbox" class="analyze-engine-input analyze-engine-queue-input" data-engine="${escapeHtml(engineId)}" ${isSelected ? 'checked' : ''} aria-label="Include ${escapeHtml(label)} in Complete scan">
            <span class="analyze-engine-queue-label">${icon} ${escapeHtml(label)}${optional ? ' <span class="analyze-engine-queue-tag">optional</span>' : ''}${depOnly ? ' <span class="analyze-engine-queue-tag is-dependency">runs before selection (Complete only)</span>' : ''}${isCurrent ? ' <span class="analyze-engine-queue-tag is-current">previewing</span>' : ''}</span>
          </label>
        </li>
      `;
    }).join('');

    const runCountLabel = count
      ? isCompleteMode
        ? `${runOrder.length} will run${count !== runOrder.length ? ` (${count} checked + dependencies)` : ''}`
        : `${count} checked — click Run analysis for this mode only`
      : 'Check scans to include';

    const selectAll = queueSelectAllState(this.selectedEngines);
    const selectAllHtml = `
        <div class="analyze-engine-queue-select-all">
          <label class="analyze-engine-queue-toggle analyze-engine-queue-select-all-label">
            <input type="checkbox" id="analyze-engine-queue-select-all" class="analyze-engine-queue-select-all-input" ${selectAll.allSelected ? 'checked' : ''} aria-label="Select all scans in queue">
            <span class="analyze-engine-queue-label"><strong>Select all</strong> <span class="text-muted">(${selectAll.queueEngineIds.length} scans)</span></span>
          </label>
        </div>
    `;

    return `
      <div class="analyze-engine-queue-panel" id="analyze-engine-queue-panel">
        <div class="analyze-engine-queue-head">
          <strong class="analyze-engine-queue-title">Scans for ${escapeHtml(deliverableLabel)}</strong>
          <span class="analyze-engine-queue-count text-muted">${runCountLabel}</span>
        </div>
        <p class="text-muted analyze-engine-queue-intro">${this.analysisType === 'complete'
    ? 'Check the scans to run when you click <strong>Run complete</strong>. Dependencies run automatically even when unchecked — dashed row, not checked.'
    : this.analysisType === 'cleanup-assistant'
      ? 'Only <strong>Cleanup assistant</strong> needs to be checked — file reduction and data quality run automatically inside this pipeline. Click <strong>Run analysis</strong> (not Run complete).'
      : this.analysisType === 'mock-scan'
        ? 'Only <strong>Mock data</strong> needs to be checked — Simplebeacon gate runs automatically first. Click <strong>Run analysis</strong> (not Run complete).'
        : this.analysisType === 'compliance'
          ? 'Only <strong>Compliance</strong> needs to be checked — Simplebeacon gate runs automatically first. Click <strong>Run analysis</strong> (not Run complete).'
          : modeToEngineId(this.analysisType)
            ? `One scan checked — <strong>${escapeHtml(getAnalysisMode(this.analysisType).label)}</strong> runs on <strong>Run analysis</strong>. Check more rows to switch to Complete.`
            : 'Check scans to include. One checked row runs that engine alone; two or more runs Complete in queue order.'}</p>
        ${selectAllHtml}
        <ol class="analyze-engine-queue-list analyze-engine-queue-list--selectable">${rows}</ol>
      </div>
    `;
  }

  renderSelectedModeDetail() {
    const mode = getAnalysisMode(this.analysisType);
    const { projectPath, report, lastResult } = this.buildModeDetailContext();
    const stepsHtml = this.analysisType !== 'complete' && mode.steps?.length
      ? `<ol class="analyze-mode-steps">${mode.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
      : '';
    const alsoAvailable = this.analysisType === 'complete'
      ? `<p class="analyze-mode-also text-muted">Export ZIP includes only checked engines that completed successfully. EU AI Act artifacts require 🇪🇺 checked and a successful sprint step.</p>`
      : `<p class="analyze-mode-also text-muted">Check additional engines above for a <strong>Complete</strong> run, or use the deliverable SKU table to load a preset scan mix.</p>`;
    const fileScopeHtml = renderModeFileScopePanel(this.analysisType, {
      projectPath,
      config: this.app.state.config,
      report,
      lastResult
    });
    const fileResultsHtml = renderModeFileResultsPanel(this.analysisType, {
      lastResult,
      report
    });
    const engineQueueHtml = this.renderSelectedEnginesQueuePanel();

    return `
      <div class="analyze-mode-detail card" id="analyze-mode-detail">
        <div class="analyze-mode-detail-head">
          <span class="analyze-mode-detail-icon">${mode.icon}</span>
          <div>
            <strong>${escapeHtml(mode.label)}</strong>
            ${mode.deliverable ? `<span class="analyze-mode-deliverable">${escapeHtml(mode.deliverable)}</span>` : ''}
          </div>
        </div>
        <p class="text-muted analyze-mode-detail-desc">${escapeHtml(mode.desc)}</p>
        ${engineQueueHtml}
        ${stepsHtml}
        ${fileScopeHtml}
        ${fileResultsHtml}
        ${alsoAvailable}
      </div>
    `;
  }

  renderScanEnginesReferenceCard() {
    const gateList = SIMPLEBEACON_GATE_RULES.map((rule) => `<li><code>${escapeHtml(rule.id)}</code> — ${escapeHtml(rule.label)}</li>`).join('');
    const dataList = DATA_QUALITY_SCANNERS.map((id) => `<li>${escapeHtml(id.replace(/-/g, ' '))}</li>`).join('');
    const fileList = FILE_REDUCTION_SCANNERS.map((id) => `<li>${escapeHtml(id.replace(/-/g, ' '))}</li>`).join('');
    const complianceList = COMPLIANCE_CHECKLIST_RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('');
    const euList = EU_AI_ACT_EXTRA_RULES.map((rule) => `<li><code>${escapeHtml(rule.id)}</code> — ${escapeHtml(rule.label)}</li>`).join('');

    return `
      <div class="card mb-6 analyze-engines-reference">
        <div class="card-header">
          <span class="card-title">Scan engines (current codebase)</span>
          <span class="text-muted" style="font-size: var(--font-size-xs);">packages/simplebeacon-cli · standard profile</span>
        </div>
        <div class="analyze-engines-grid">
          <div class="analyze-engines-col">
            <h3 class="analyze-engines-col-title">Simplebeacon gate</h3>
            <ul class="analyze-mode-steps">${gateList}</ul>
          </div>
          <div class="analyze-engines-col">
            <h3 class="analyze-engines-col-title">Data quality (${DATA_QUALITY_SCANNERS.length})</h3>
            <ul class="analyze-mode-steps">${dataList}</ul>
          </div>
          <div class="analyze-engines-col">
            <h3 class="analyze-engines-col-title">File reduction (${FILE_REDUCTION_SCANNERS.length})</h3>
            <ul class="analyze-mode-steps">${fileList}</ul>
          </div>
          <div class="analyze-engines-col">
            <h3 class="analyze-engines-col-title">Compliance checklist (${COMPLIANCE_CHECKLIST_RULES.length})</h3>
            <ul class="analyze-mode-steps">${complianceList}</ul>
          </div>
          <div class="analyze-engines-col">
            <h3 class="analyze-engines-col-title">EU AI Act profile extras</h3>
            <ul class="analyze-mode-steps">${euList}</ul>
            <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0.5rem 0 0;">Reference only — <a href="/eu-ai-act-sample-report" target="_blank" rel="noopener">sample report layout</a>. Active offers: <a href="#/deliverables">$499 PDF</a> and agency packs.</p>
          </div>
        </div>
      </div>
    `;
  }

  renderAiSystemsIssueAnalyzerCard() {
    const selectedCount = this.selectedIssueIds.size;
    const allSelected = selectedCount === AI_SYSTEM_ISSUES.length;
    const noneSelected = selectedCount === 0;
    const implementedCount = ANALYZER_CATALOG.filter((analyzer) => analyzer.status === 'implemented').length;
    const stubCount = ANALYZER_CATALOG.length - implementedCount;
    return `
      <div class="card mb-6 analyze-issue-analyzer-card">
        <div class="card-header">
          <span class="card-title">AI Problem Analyzer Suite</span>
          <div class="analyze-path-header-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="issue-select-all-btn" ${allSelected ? 'disabled' : ''}>Select all</button>
            <button type="button" class="btn btn-ghost btn-sm" id="issue-clear-all-btn" ${noneSelected ? 'disabled' : ''}>Clear all</button>
          </div>
        </div>
        <p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
          Deterministic category framework over ${AI_SYSTEM_ISSUES.length} analyzers (${implementedCount} implemented${stubCount ? `, ${stubCount} contract stubs` : ''}) with architecture-aware report sections.
          Run a codebase or complete scan first to feed code understanding and ZScript diagnostics into analyzer context.
        </p>
        <div class="metrics-row mb-4">
          <div class="metric-chip"><strong>${selectedCount}</strong> selected analyzers</div>
          <div class="metric-chip"><strong>${this.issueTaxonomyGroups.length}</strong> categories</div>
          <div class="metric-chip"><strong>${AI_SYSTEM_ISSUES.length}</strong> total analyzers</div>
          <div class="metric-chip"><strong>${implementedCount}</strong> implemented</div>
          <div class="metric-chip"><strong>${stubCount}</strong> stubs</div>
        </div>
        <div class="analyze-issue-category-grid">
          ${this.issueTaxonomyGroups.map((group) => this.renderIssueCategoryGroup(group)).join('')}
        </div>
        <div class="analyze-action-row mt-4">
          <button type="button" class="btn btn-primary" id="run-issue-analysis-btn" ${noneSelected ? 'disabled' : ''}>Analyze selected analyzers</button>
          <span class="text-muted" style="font-size: var(--font-size-xs);">
            ${stubCount
    ? 'Implemented analyzers run deterministic local logic; remaining analyzers return safe contract-valid stubs.'
    : 'All catalog analyzers run deterministic local logic against scan/codebase context when available.'}
          </span>
        </div>
        <div id="ai-issue-analysis-results">
          ${this.renderAiIssueAnalysisResults()}
        </div>
      </div>
    `;
  }

  renderIssueCategoryGroup(group) {
    return `
      <div class="analyze-issue-category-group">
        <h3>${escapeHtml(group.categoryName)}</h3>
        <p class="text-muted" style="font-size: var(--font-size-xs); margin-top: 0;">
          Methods: ${group.methods.map((method) => escapeHtml(method.name)).join(' · ')}
        </p>
        <ul class="analyze-issue-checkbox-list">
          ${group.issues.map((issue) => `
            <li>
              <label class="analyze-issue-checkbox">
                <input type="checkbox" data-ai-issue-id="${escapeHtml(issue.id)}" ${this.selectedIssueIds.has(issue.id) ? 'checked' : ''}>
                <span>
                  <strong>${escapeHtml(issue.id)} · ${escapeHtml(issue.title)}</strong>
                  <small>${escapeHtml(issue.description)}</small>
                </span>
              </label>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderAiIssueAnalysisResults() {
    if (!this.aiIssueAnalysisResult) {
      return `
        <div class="card mt-4">
          <p class="text-muted" style="margin:0;">Run Analyze selected analyzers to generate a structured report.</p>
        </div>
      `;
    }
    const {
      summary,
      categoryDistribution,
      riskSummary,
      topPriorityIssues,
      coverageGaps,
      mitigationThemes,
      architecture,
      payload
    } = this.aiIssueAnalysisResult;
    const executionStatus = riskSummary.executionStatus || {
      measured: riskSummary.measuredAnalyzerCount || 0,
      insufficientData: 0,
      stub: summary.stubCount || 0
    };
    return `
      <div class="card mt-4">
        <div class="section-heading">
          <h2 style="margin-bottom: 0;">AI Problem Analyzer Suite Results</h2>
          <div class="roadmap-result-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="export-ai-analyzer-json-btn" title="Download sanitized analyzer suite JSON (summary, risk, per-analyzer results, machine-readable payload)">
              Export JSON
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="export-ai-analyzer-csv-btn" title="Download per-analyzer results as CSV">
              Export CSV
            </button>
          </div>
        </div>
        <div class="metrics-row mb-4">
          <div class="metric-chip"><strong>${summary.selectedIssueCount}</strong> selected analyzer count</div>
          <div class="metric-chip"><strong>${summary.implementedCount}</strong> implemented executed</div>
          <div class="metric-chip"><strong>${summary.stubCount}</strong> stubs executed</div>
          <div class="metric-chip"><strong>${riskSummary.overallRiskLevel}</strong> overall risk</div>
          <div class="metric-chip"><strong>${riskSummary.averageRiskScore}</strong> avg risk score</div>
          <div class="metric-chip"><strong>${riskSummary.totalRiskScore}</strong> total risk score</div>
        </div>
        <h3 class="card-subtitle">Execution coverage</h3>
        <div class="metrics-row mb-4">
          <div class="metric-chip"><strong>${executionStatus.measured}</strong> measured</div>
          <div class="metric-chip"><strong>${executionStatus.insufficientData}</strong> insufficient data</div>
          <div class="metric-chip"><strong>${executionStatus.stub}</strong> stub</div>
        </div>
        ${executionStatus.insufficientData > executionStatus.measured ? `
          <p class="text-muted mb-4" style="font-size: var(--font-size-sm); margin-top: 0;">
            Most analyzers need structured scan fields (subgroup outcomes, traces, benchmarks, transcripts).
            Run <strong>npm run simplebeacon</strong> first, then re-run analyzers — gate metrics are now mapped automatically when the report has zero issues.
          </p>
        ` : ''}
        <h3 class="card-subtitle">Category distribution</h3>
        <ul class="roadmap-phase-list mb-4">
          ${categoryDistribution.map((item) => `
            <li>
              <strong>${escapeHtml(item.categoryName)}</strong>
              <span class="text-muted"> — ${item.selectedCount} selected (${item.percentage}%)</span>
            </li>
          `).join('')}
        </ul>
        <h3 class="card-subtitle">Risk summary (measured analyzers only)</h3>
        <p class="text-muted mb-3" style="font-size: var(--font-size-sm); margin-top: 0;">
          Critical: <strong>${riskSummary.severityCounts.critical}</strong> ·
          High: <strong>${riskSummary.severityCounts.high}</strong> ·
          Medium: <strong>${riskSummary.severityCounts.medium}</strong> ·
          Low: <strong>${riskSummary.severityCounts.low}</strong>
          <span class="text-muted"> (${riskSummary.measuredAnalyzerCount} measured)</span>
        </p>
        <h3 class="card-subtitle">Top priority issues</h3>
        ${topPriorityIssues.length ? `
          <ul class="roadmap-phase-list mb-4">
            ${topPriorityIssues.map((issue) => `
              <li>
                <strong>${escapeHtml(issue.id)} · ${escapeHtml(issue.title)}</strong>
                <span class="text-muted"> — score ${issue.priorityScore}, ${escapeHtml(issue.severity)} severity (${escapeHtml(issue.riskBand)} band)</span>
              </li>
            `).join('')}
          </ul>
        ` : `
          <p class="text-muted mb-4" style="font-size: var(--font-size-sm); margin-top: 0;">
            No measured analyzers reported elevated risk. Review coverage gaps below to improve input completeness.
          </p>
        `}
        <h3 class="card-subtitle">Coverage gaps</h3>
        ${coverageGaps?.length ? `
          <ul class="roadmap-phase-list mb-4">
            ${coverageGaps.map((gap) => `
              <li>
                <strong>${escapeHtml(gap.id)} · ${escapeHtml(gap.title)}</strong>
                <span class="text-muted"> — missing ${escapeHtml(gap.missingInputPointer)}</span>
                <div class="text-muted" style="font-size: var(--font-size-sm); margin-top: var(--space-1);">${escapeHtml(gap.detail)}</div>
              </li>
            `).join('')}
          </ul>
        ` : `
          <p class="text-muted mb-4" style="font-size: var(--font-size-sm); margin-top: 0;">All implemented analyzers received sufficient input.</p>
        `}
        <h3 class="card-subtitle">Mitigation themes</h3>
        <ul class="roadmap-phase-list mb-4">
          ${mitigationThemes.map((item) => `
            <li>
              <strong>${escapeHtml(item.categoryName)}</strong>
              <div class="text-muted" style="font-size: var(--font-size-sm); margin-top: var(--space-1);">
                ${item.themes.map((theme) => escapeHtml(theme)).join(' · ')}
              </div>
            </li>
          `).join('')}
        </ul>
        <h3 class="card-subtitle">Architecture report</h3>
        <div class="analyze-architecture-grid mb-4">
          <div class="card">
            <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Data Collection Layer</p>
            <p style="margin:0; font-size: var(--font-size-sm);">
              ${architecture.dataCollectionLayer.selectedIssueCount} selected issues across ${architecture.dataCollectionLayer.selectedCategoryIds.length} categories.
            </p>
          </div>
          <div class="card">
            <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Analysis Engine</p>
            <p style="margin:0; font-size: var(--font-size-sm);">${escapeHtml(architecture.analysisEngine.deterministicRubric)}</p>
          </div>
          <div class="card">
            <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Alerting & Reporting</p>
            <p style="margin:0; font-size: var(--font-size-sm);">
              Alert level ${escapeHtml(architecture.alertingAndReporting.alertLevel)} · cadence ${escapeHtml(architecture.alertingAndReporting.recommendedCadence)}.
            </p>
          </div>
          <div class="card">
            <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Key Design Principles</p>
            <p style="margin:0; font-size: var(--font-size-sm);">${architecture.keyDesignPrinciples.map((value) => escapeHtml(value)).join(' · ')}</p>
          </div>
        </div>
        <details class="roadmap-json-details">
          <summary>Machine-readable JSON payload</summary>
          <pre class="audit-log roadmap-json-full">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
        </details>
      </div>
    `;
  }

  renderProgress() {
    const steps = this.completeProgress?.steps || [];
    const doneCount = steps.filter((s) => s.status === 'done').length;
    const total = steps.length || COMPLETE_STEPS.length;
    const sp = this.scanProgress;
    const projectPath = this.resolveProgressScanPath();
    const explorerInventory = this.progressExplorerInventory();
    const progressDetails = formatScanProgressDetails(sp, {
      explorerInventory,
      scanPathLabel: projectPath ? formatPathLabel(projectPath) : '',
      fullDirectoryScan: this.fullDirectoryScan
    });
    let pct = 0;
    if (this.analysisType === 'complete' && steps.length) {
      const stepPct = (doneCount / total) * 100;
      if (sp?.total && sp.processed != null) {
        const stepFraction = 1 / total;
        pct = Math.round(stepPct + (sp.processed / sp.total) * stepFraction * 100);
      } else {
        pct = Math.round(stepPct);
      }
    } else if (sp?.total && sp.processed != null) {
      pct = Math.round((sp.processed / sp.total) * 100);
    } else {
      pct = this.busy ? 35 : 0;
    }
    const elapsed = this.scanStartedAt ? formatElapsed(Date.now() - this.scanStartedAt) : '—';
    const label = this.completeStep || sp?.label || 'Running analysis…';
    const counter = progressDetails.counter;
    const scopeNote = progressDetails.scopeNote;
    const currentFile = sp?.currentFile ? formatPathInputValue(sp.currentFile) : '';

    if (this.analysisType !== 'complete' || !steps.length) {
      return `
        <div class="analyze-progress" id="analyze-progress">
          <div class="analyze-progress-header">
            <span class="analyze-progress-label">${escapeHtml(label)}</span>
            <span class="text-muted analyze-progress-elapsed">${elapsed}</span>
          </div>
          <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
          ${counter ? `<div class="analyze-progress-counter text-muted">${escapeHtml(counter)}</div>` : '<div class="analyze-progress-counter text-muted" hidden></div>'}
          ${scopeNote ? `<div class="analyze-progress-scope-note text-muted">${escapeHtml(scopeNote)}</div>` : '<div class="analyze-progress-scope-note text-muted" hidden></div>'}
          ${currentFile ? `<div class="analyze-progress-current-file" title="${escapeHtml(sp.currentFile)}">${escapeHtml(currentFile)}</div>` : '<div class="analyze-progress-current-file" hidden></div>'}
        </div>
      `;
    }

    return `
      <div class="analyze-progress" id="analyze-progress">
        <div class="analyze-progress-header">
          <span class="analyze-progress-label">Complete scan — ${doneCount}/${total} steps</span>
          <span class="text-muted analyze-progress-elapsed">${elapsed}</span>
        </div>
        <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
        ${counter ? `<div class="analyze-progress-counter text-muted">${escapeHtml(counter)}</div>` : '<div class="analyze-progress-counter text-muted" hidden></div>'}
        ${scopeNote ? `<div class="analyze-progress-scope-note text-muted">${escapeHtml(scopeNote)}</div>` : '<div class="analyze-progress-scope-note text-muted" hidden></div>'}
        ${currentFile ? `<div class="analyze-progress-current-file" title="${escapeHtml(sp.currentFile)}">${escapeHtml(currentFile)}</div>` : '<div class="analyze-progress-current-file" hidden></div>'}
        <div class="analyze-step-list">
          ${steps.map((step) => `
            <div class="analyze-step-item ${step.status}">
              <span>${step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : step.status === 'running' ? '◉' : '○'}</span>
              <span>${escapeHtml(step.label)}${step.error ? ` — ${escapeHtml(step.error)}` : ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  stopProgressPolling() {
    if (this._progressPollTimer) {
      clearInterval(this._progressPollTimer);
      this._progressPollTimer = null;
    }
    this.scanProgress = null;
    this._progressScanPath = null;
  }

  resolveProgressScanPath() {
    return this._progressScanPath
      || this.app.state.lastProjectPath
      || this.getActiveProjectPath(this._root?.querySelector('#project-path-input')?.value)
      || '';
  }

  progressExplorerInventory() {
    const projectPath = this.resolveProgressScanPath();
    if (!projectPath) return null;
    return liveInventoryForPath(this.app, projectPath)?.inventory || null;
  }

  startProgressPolling(projectPath) {
    this.stopProgressPolling();
    if (!projectPath) return;
    this._progressScanPath = projectPath;
    const cached = this.app.state.pathInventory;
    if (cached?.path && normalizeProjectPath(cached.path) !== normalizeProjectPath(projectPath)) {
      this.app.state.pathInventory = null;
    }
    void refreshPathInventory(this.app, projectPath, { profile: 'explorer' })
      .then(() => {
        if (this.busy) this.updateProgressDom();
      })
      .catch(() => null);
    this._progressPollInactive = 0;
    this._progressEndpointDown = false;

    const poll = async () => {
      if (!this.busy || this._progressEndpointDown) return;
      try {
        const progress = await this.app.scanService.fetchScanProgress(projectPath);
        if (progress?.endpointUnavailable) {
          this._progressPollInactive += 1;
          if (this._progressPollInactive >= 2) {
            this._progressEndpointDown = true;
            this.stopProgressPolling();
          }
          return;
        }
        if (progress?.active) {
          this._progressPollInactive = 0;
          this.scanProgress = progress;
          this.updateProgressDom();
          return;
        }
        if (this.scanProgress?.active) {
          this.scanProgress = null;
          this.updateProgressDom();
        }
        this._progressPollInactive += 1;
        if (this._progressPollInactive >= 8) {
          this.stopProgressPolling();
        }
      } catch {
        this._progressPollInactive += 1;
        if (this._progressPollInactive >= 3) {
          this.stopProgressPolling();
        }
      }
    };
    void poll();
    this._progressPollTimer = setInterval(poll, 1000);
  }

  updateProgressDom() {
    const root = this._root?.querySelector('#analyze-progress');
    if (!root || !this.busy) return;

    const sp = this.scanProgress;
    const steps = this.completeProgress?.steps || [];
    const doneCount = steps.filter((s) => s.status === 'done').length;
    const totalSteps = steps.length || COMPLETE_STEPS.length;
    const projectPath = this.resolveProgressScanPath();
    const explorerInventory = this.progressExplorerInventory();
    const progressDetails = formatScanProgressDetails(sp, {
      explorerInventory,
      scanPathLabel: projectPath ? formatPathLabel(projectPath) : '',
      fullDirectoryScan: this.fullDirectoryScan
    });

    let pct = 0;
    if (this.analysisType === 'complete' && steps.length) {
      const stepPct = (doneCount / totalSteps) * 100;
      if (sp?.total && sp.processed != null) {
        const stepFraction = 1 / totalSteps;
        pct = Math.round(stepPct + (sp.processed / sp.total) * stepFraction * 100);
      } else {
        pct = Math.round(stepPct);
      }
    } else if (sp?.total && sp.processed != null) {
      pct = Math.round((sp.processed / sp.total) * 100);
    } else {
      pct = 35;
    }

    const fill = root.querySelector('.analyze-progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    const headerLabel = root.querySelector('.analyze-progress-label');
    if (headerLabel) {
      headerLabel.textContent = this.analysisType === 'complete' && steps.length
        ? `Complete scan — ${doneCount}/${totalSteps} steps`
        : (this.completeStep || sp?.label || 'Running analysis…');
    }

    const counter = root.querySelector('.analyze-progress-counter');
    if (counter) {
      if (progressDetails.counter) {
        counter.hidden = false;
        counter.textContent = progressDetails.counter;
      } else {
        counter.hidden = true;
        counter.textContent = '';
      }
    }

    const scopeNoteEl = root.querySelector('.analyze-progress-scope-note');
    if (scopeNoteEl) {
      if (progressDetails.scopeNote) {
        scopeNoteEl.hidden = false;
        scopeNoteEl.textContent = progressDetails.scopeNote;
      } else {
        scopeNoteEl.hidden = true;
        scopeNoteEl.textContent = '';
      }
    }

    const fileEl = root.querySelector('.analyze-progress-current-file');
    if (fileEl) {
      const file = sp?.currentFile;
      if (file) {
        fileEl.hidden = false;
        fileEl.textContent = formatPathInputValue(file);
        fileEl.title = file;
      } else {
        fileEl.hidden = true;
        fileEl.textContent = '';
        fileEl.removeAttribute('title');
      }
    }

    const elapsedEl = root.querySelector('.analyze-progress-elapsed');
    if (elapsedEl && this.scanStartedAt) {
      elapsedEl.textContent = formatElapsed(Date.now() - this.scanStartedAt);
    }

    const runBtn = this._root?.querySelector('#run-analyze-btn');
    if (runBtn && this.busy) {
      runBtn.textContent = this.completeStep || sp?.label || 'Running…';
    }
  }

  renderEmptyState() {
    const report = this.app.state.report;
    const history = this.app.state.history || [];
    const lastEntry = history[0];
    const defaultPath = this.app.state.defaultProjectPath || this.app.state.lastProjectPath;

    if (report?.generatedAt || lastEntry) {
      const when = report?.generatedAt || lastEntry?.timestamp;
      const rel = when ? this.app.scanService.formatRelativeTime(when) : 'Recently';
      const issues = report?.issueCount ?? report?.rawIssues?.length ?? '—';
      const gate = report?.gate?.pass ? 'PASS' : 'REVIEW';
      return `
        <div class="card analyze-empty-state">
          <p class="text-muted" style="margin:0">Last scan ${escapeHtml(rel)} — <strong>${issues}</strong> issue groups, gate <strong>${gate}</strong></p>
          <div class="analyze-empty-actions">
            ${defaultPath ? `<button type="button" class="btn btn-primary btn-sm" id="quick-rescan-btn">Re-run complete scan</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" id="goto-results-empty-btn">Open Results →</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="card analyze-empty-state">
        <p class="text-muted" style="margin:0">No analysis yet — use quick file check above, pick a server path, or run a scan.</p>
        ${defaultPath ? `
          <div class="analyze-empty-actions">
            <button type="button" class="btn btn-primary btn-sm" id="quick-rescan-btn">Run complete scan on server default</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  setAnalysisType(type, { typeSelect } = {}) {
    this.analysisType = type;
    if (typeSelect) typeSelect.value = type;
    const engineId = modeToEngineId(type);
    if (engineId) {
      this.selectedEngines = ensureStandaloneEngineSelection(type);
      this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
    }
    saveAnalyzePrefs({
      analysisType: type,
      aiProvider: this.aiProvider,
      roadmapInsightsMode: this.roadmapInsightsMode,
      understandingMode: this.understandingMode,
      selectedEngines: this.selectedEngines,
      selectedDeliverableSku: this.selectedDeliverableSku
    });
    this.syncAnalyzeModeUi();
  }

  showAiProviderSelect() {
    if (analysisTypeUsesAiNarrative(this.analysisType)) return true;
    if (analysisTypeSupportsUnderstanding(this.analysisType) && this.understandingMode === 'llm') return true;
    return analysisTypeSupportsRoadmapInsights(this.analysisType) && this.roadmapInsightsMode === 'llm';
  }

  showRoadmapInsightsNote() {
    return analysisTypeSupportsRoadmapInsights(this.analysisType);
  }

  syncAnalyzeModeUi(root = this._root) {
    if (!root) return;
    const pathInput = root.querySelector('#project-path-input');
    const projectPath = this.getActiveProjectPath(pathInput?.value);
    const detail = root.querySelector('#analyze-mode-detail');
    if (detail) {
      detail.outerHTML = this.renderSelectedModeDetail().trim();
      this.bindEngineSelectionEvents(root);
    }
    this.bindModeGridEvents(root);
    this.syncRunAnalyzeButtonLabel(root);
    this.syncPathChipStates(root, projectPath);
    root.querySelector('#analyze-roadmap-insights-wrap')?.classList.toggle(
      'is-hidden',
      !analysisTypeSupportsRoadmapInsights(this.analysisType)
    );
    root.querySelector('#analyze-understanding-wrap')?.classList.toggle(
      'is-hidden',
      !analysisTypeSupportsUnderstanding(this.analysisType)
    );
    root.querySelector('#analyze-ai-provider-wrap')?.classList.toggle('is-hidden', !this.showAiProviderSelect());
    root.querySelector('#analyze-roadmap-no-ai-note')?.classList.toggle('is-hidden', !this.showRoadmapInsightsNote());
    this.syncAiProviderNote(root);
    const insightsSelect = root.querySelector('#roadmap-insights-select');
    if (insightsSelect && insightsSelect.value !== this.roadmapInsightsMode) {
      insightsSelect.value = this.roadmapInsightsMode;
    }
    const understandingSelect = root.querySelector('#understanding-mode-select');
    if (understandingSelect && understandingSelect.value !== this.understandingMode) {
      understandingSelect.value = this.understandingMode;
    }
    this.updateInventoryProvenanceDom(root);
  }

  providerConfiguredForSummary(providerId) {
    const id = String(providerId || 'demo').toLowerCase();
    if (id === 'demo') return false;
    const match = this.providers.find((p) => p.id === id);
    if (match) return isAnalyzeProviderConfigured(match);
    if (id === 'active') return false;
    return id !== 'demo';
  }

  syncAiProviderNote(root = this._root) {
    if (!root) return;
    const note = root.querySelector('#analyze-ai-provider-note');
    if (!note || !this.showAiProviderSelect()) return;
    const id = String(this.aiProvider || 'demo').toLowerCase();
    if (id === 'demo') {
      note.innerHTML = 'Deterministic scan only — no AI narrative will be added. Pick <strong>Ollama</strong> (with <code>ollama serve</code>) for an optional LLM summary after findings.';
      return;
    }
    const match = this.providers.find((p) => p.id === id);
    if (match && !isAnalyzeProviderConfigured(match)) {
      const settingsLink = id === 'ollama'
        ? ' Configure base URL and model under Settings → AI providers, then click Refresh provider status.'
        : id === 'openai' || id === 'anthropic'
          ? ' Add API keys under Settings → AI providers.'
          : '';
      note.textContent = `${match.statusMessage || match.description || `${match.label} is not configured.`}${settingsLink}`;
      return;
    }
    if (match?.statusMessage && id === 'ollama') {
      note.textContent = match.statusMessage;
      return;
    }
    note.innerHTML = 'Gate findings are always deterministic. This choice only adds an optional LLM summary after the scan.';
  }

  attachDeterministicSummary(target, note) {
    const narrative = buildScanConclusion(target, { focus: 'all' });
    if (!narrative) return target;
    target.aiSummary = narrative;
    target.aiSummaryProvider = 'Simplebeacon rules';
    if (note) target.aiSummaryNote = note;
    return target;
  }

  async attachOptionalAiSummary(target, projectPath, reportType, options = {}) {
    const type = reportType || target?.type || '';
    if (type === 'file-merger-reduction-report') {
      target.aiSummary = buildConsolidationConclusion(target);
      target.aiSummaryProvider = 'Simplebeacon rules';
      return target;
    }
    if (!target || !aiProviderSupportsSummary(this.aiProvider)) {
      if (target && String(this.aiProvider || '').toLowerCase() === 'demo') {
        target.aiSummaryNote = 'Deterministic scan only — select Ollama or a cloud provider for an optional AI narrative.';
      }
      return target;
    }
    if (!this.providerConfiguredForSummary(this.aiProvider)) {
      target.aiSummaryNote = formatAiSummarySkipMessage(
        `${this.aiProvider} is not configured — add API keys to server .env`
      );
      return this.attachDeterministicSummary(target);
    }
    const summaryFocus = options.summaryFocus
      || (this.analysisType === 'mock-scan' ? 'fiction' : 'all');
    try {
      const summary = await summarizeReport(target, {
        projectPath,
        reportType,
        aiProvider: this.aiProvider,
        summaryFocus
      });
      if (summary.enhanced && summary.summary) {
        target.aiSummary = summary.summary;
        target.aiSummaryProvider = summary.provider || this.aiProvider;
        if (summary.modelFallback) {
          target.aiSummaryNote = `Configured Ollama model "${summary.modelFallback.requested}" not installed — used "${summary.modelFallback.used}" instead (findings unchanged).`;
        }
      } else if (summary.message || summary.error) {
        const note = formatAiSummarySkipMessage(summary.message || summary.error);
        return this.attachDeterministicSummary(target, note);
      }
    } catch (err) {
      const note = formatAiSummarySkipMessage(err.message);
      return this.attachDeterministicSummary(target, note);
    }
    return target;
  }

  async attachRepositoryInventory(projectPath, report) {
    const inventory = report?.repositoryInventory
      || this.lastResult?.repositoryInventory
      || null;
    if (inventory?.totalFiles != null) {
      this.repositoryInventory = inventory;
      if (this.lastResult) this.lastResult.repositoryInventory = inventory;
      return inventory;
    }
    try {
      const fetched = await fetchRepositoryInventory(projectPath);
      this.repositoryInventory = fetched;
      if (this.lastResult) this.lastResult.repositoryInventory = fetched;
      return fetched;
    } catch {
      return null;
    }
  }

  renderScanFileMetrics(report) {
    const inventory = this.lastResult?.repositoryInventory || report?.repositoryInventory;
    const m = getScanFileMetrics(report, { repositoryInventory: inventory });
    const showMockBreakdown = m.mockSampleFiles != null;
    const showFictionJson = m.fictionJsonFilesScanned != null;

    if (m.repositoryFiles != null) {
      return `
        <div class="metric-chip" title="Filesystem inventory under ${escapeHtml(formatPathInputValue(m.repositoryRoot) || 'project path')} (${escapeHtml(report?.repositoryInventory?.profile || 'audit')} profile — skips node_modules, .git, github-cache)">
          <strong>${formatCount(m.repositoryFiles)}</strong> repo files · <strong>${formatCount(m.repositoryFolders)}</strong> folders
        </div>
        <div class="metric-chip" title="Files read by credential, mock-path, and production-leak rules">
          <strong>${formatCount(m.ruleScopedFilesAnalyzed ?? m.credentialScanned)}</strong> gate rules checked
        </div>
        ${showFictionJson ? `<div class="metric-chip" title="Repository JSON pattern-scanned for fictional KPI strings"><strong>${formatCount(m.fictionJsonFilesScanned)}</strong> JSON fiction-scanned</div>` : ''}
        ${showMockBreakdown ? `<div class="metric-chip" title="Mock/sample JSON in configured scan paths"><strong>${formatCount(m.mockSampleFiles)}</strong> mock/sample</div>` : ''}
      `;
    }

    const showRuleScoped = m.ruleScopedFilesAnalyzed != null
      && m.mockSampleFiles != null
      && m.mockSampleFiles !== m.ruleScopedFilesAnalyzed;
    return `
      <div class="metric-chip" title="Files read across mock/sample, credential, and production-leak rules">
        <strong>${formatCount(m.ruleScopedFilesAnalyzed ?? m.filesAnalyzed)}</strong> gate rules checked
      </div>
      ${showFictionJson ? `<div class="metric-chip"><strong>${formatCount(m.fictionJsonFilesScanned)}</strong> JSON fiction-scanned</div>` : ''}
      ${showMockBreakdown ? `<div class="metric-chip"><strong>${formatCount(m.mockSampleFiles)}</strong> mock/sample</div>` : ''}
      ${showRuleScoped ? '' : ''}
    `;
  }

  renderScanScopeBanner(report, projectPath) {
    if (!report || report.type === 'file-merger-reduction-report') return '';
    const stale = isLegacyScanReport(report, projectPath);
    const monorepoNote = buildMonorepoScopeNote(report);
    return `
      ${stale ? `
        <div class="card mb-4" style="border-color: var(--warning-color, #f59e0b);">
          <p style="margin: 0; font-size: var(--font-size-sm);">
            Stale or mismatched scan report — re-run the scan on <code>${escapeHtml(formatPathInputValue(projectPath) || 'this path')}</code>
            to attach full repository inventory and gate scope (reportVersion 2).
          </p>
        </div>
      ` : ''}
      ${monorepoNote ? `
        <div class="card mb-4 analyze-monorepo-scope">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Monorepo scan scope</p>
          <p style="margin: 0; font-size: var(--font-size-sm);">${escapeHtml(monorepoNote)}</p>
          <p class="text-muted mt-2 mb-0" style="font-size: var(--font-size-xs);">
            Requested: <code>${escapeHtml(formatPathInputValue(report.projectRoot))}</code>
            · Platform: <code>${escapeHtml(formatPathInputValue(report.platformRoot))}</code>
          </p>
        </div>
      ` : ''}
      ${renderScanScopePanel(report)}
    `;
  }

  renderRoadmapProvenance(roadmap) {
    if (!roadmap) return '';
    const generatedBy = roadmap.generatedBy || 'code-roadmap-generator';
    const dataSource = roadmap.dataSource || 'filesystem-scan';
    const inference = roadmap.inferenceMode || 'filesystem';
    const insights = roadmap.strategicInsights;
    const insightsLabel = !insights
      ? 'No strategic insights layer'
      : insights.mode === 'llm'
        ? `LLM strategic layer (${escapeHtml(insights.llmProvider || 'configured provider')})`
        : 'Deterministic strategic insights (rule-based)';
    return `
      <div class="card mb-4 analyze-roadmap-provenance">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Roadmap data is filesystem-derived — LLM never generates sprint metrics</p>
        <p style="margin: 0;">
          Built by <code>${escapeHtml(generatedBy)}</code> from <code>${escapeHtml(dataSource)}</code>.
          Inference: <code>${escapeHtml(inference)}</code>.
          Insights: ${insightsLabel}.
        </p>
      </div>
    `;
  }

  renderStrategicInsightsPanel(insights) {
    if (!insights) return '';
    const risk = insights.riskAssessment || {};
    const recs = insights.recommendations || [];
    return `
      <div class="card mb-4 analyze-strategic-insights">
        <div class="card-header">
          <span class="card-title">Strategic insights ${insights.mode === 'llm' ? '(LLM)' : '(deterministic)'}</span>
        </div>
        <p class="mb-3">${escapeHtml(insights.executiveSummary || '')}</p>
        ${risk.overallRisk ? `
          <p class="text-muted mb-2" style="font-size: var(--font-size-sm); margin-top: 0;">
            Overall risk: <strong>${escapeHtml(risk.overallRisk)}</strong>
            ${risk.riskCategories ? ` · Performance ${escapeHtml(risk.riskCategories.performance || '—')} · Maintainability ${escapeHtml(risk.riskCategories.maintainability || '—')}` : ''}
          </p>
        ` : ''}
        ${recs.length ? `
          <h3 class="card-subtitle">Top recommendations</h3>
          <ul class="roadmap-phase-list mb-3">
            ${recs.slice(0, 5).map((r) => `
              <li><strong>${escapeHtml(r.priority || '—')}</strong> — ${escapeHtml(r.action || r.description || '')}</li>
            `).join('')}
          </ul>
        ` : ''}
        ${insights.complianceNarrative ? `
          <details>
            <summary>Compliance narrative (draft)</summary>
            <p class="text-muted mt-2 mb-0" style="font-size: var(--font-size-sm);">${escapeHtml(insights.complianceNarrative)}</p>
          </details>
        ` : ''}
        ${insights.llmNote ? `<p class="text-muted mt-2 mb-0" style="font-size: var(--font-size-xs);">${escapeHtml(insights.llmNote)}</p>` : ''}
      </div>
    `;
  }

  renderConclusionBanner(conclusion, sourceLabel = 'Deterministic gate scan') {
    if (!conclusion) return '';
    return `
      <div class="card mb-4 analyze-conclusion-banner">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">${escapeHtml(sourceLabel)}</p>
        <p style="margin: 0;">${escapeHtml(conclusion)}</p>
      </div>
    `;
  }

  renderScanSummary(entity, conclusion, sourceLabel = 'Deterministic gate scan') {
    const gateLine = conclusion || (entity ? buildScanConclusion(entity) : null);
    if (entity?.type === 'simplebeacon-report') {
      return this.renderConclusionBanner(
        gateLine,
        'Deterministic gate scan (AI narrative hidden for compliance integrity)'
      );
    }
    if (entity?.aiSummary) {
      const provider = entity.aiSummaryProvider || this.aiProvider || 'AI';
      return `
        <div class="card mb-4 analyze-scan-summary">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">
            Optional narrative (${escapeHtml(provider)}) — gate findings unchanged
          </p>
          ${gateLine ? `<p class="text-muted text-sm mb-3" style="margin-top:0;"><strong>Gate:</strong> ${escapeHtml(gateLine)}</p>` : ''}
          <div class="analyze-ai-summary-body">${escapeHtml(entity.aiSummary).replace(/\n/g, '<br>')}</div>
          ${entity.aiSummaryNote ? `<p class="text-muted text-sm mt-2 mb-0">${escapeHtml(entity.aiSummaryNote)}</p>` : ''}
        </div>
      `;
    }
    return `${this.renderConclusionBanner(gateLine, sourceLabel)}${this.renderAiSummaryBlock(entity)}`;
  }

  renderAiSummaryBlock(entity) {
    if (!entity) return '';
    const noteBlock = entity.aiSummaryNote
      ? `<p class="text-muted text-sm mb-2">${escapeHtml(entity.aiSummaryNote)}</p>`
      : '';
    if (entity.aiSummary) {
      const provider = entity.aiSummaryProvider || this.aiProvider || 'AI';
      return `
        ${noteBlock}
        <div class="card mb-4 analyze-ai-summary">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Summary (${escapeHtml(provider)}) — findings unchanged</p>
          <div class="analyze-ai-summary-body">${escapeHtml(entity.aiSummary).replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }
    if (entity.aiSummaryNote) {
      return `<p class="text-muted text-sm mb-4">${escapeHtml(entity.aiSummaryNote)}</p>`;
    }
    if (entity.aiSummaryError) {
      return `
        <p class="text-muted text-sm mb-4">${escapeHtml(formatAiSummarySkipMessage(entity.aiSummaryError))}</p>
      `;
    }
    return '';
  }

  resolveProjectPath(inputValue = '') {
    return resolvePageProjectPath(inputValue, this.app, this.testSources);
  }

  getPathInputDisplayValue() {
    return getPathInputDisplayValue(this.app);
  }

  getActiveProjectPath(inputValue = '') {
    return this.resolveProjectPath(inputValue);
  }

  reportForProjectPath(projectPath) {
    const path = String(projectPath || '').trim();
    if (!path) return null;
    const stateReport = this.app.state.report;
    if (stateReport && reportMatchesPagePath(stateReport, path)) return stateReport;
    const resultReport = this.lastResult?.report;
    if (resultReport && reportMatchesPagePath(resultReport, path)) return resultReport;
    return null;
  }

  resolveInventoryReport(requestedPath) {
    const path = this.getActiveProjectPath(requestedPath);
    if (this.lastResult?.report && reportMatchesPagePath(this.lastResult.report, path)) {
      return this.lastResult.report;
    }
    const stateReport = this.reportForProjectPath(path);
    if (stateReport) return stateReport;
    const fallback = this.app.state.report;
    if (fallback?.generatedAt && reportMatchesPagePath(fallback, path)) {
      return fallback;
    }
    return null;
  }

  renderInventoryProvenanceLine(requestedPath = '') {
    const projectPath = this.getActiveProjectPath(requestedPath);
    const report = this.resolveInventoryReport(requestedPath);
    const provenance = buildPathInventoryProvenance(this.app, projectPath, report);
    return renderInventoryProvenanceHtml(provenance, { redactPath: formatPathInputValue });
  }

  updateInventoryProvenanceDom(root = this._root) {
    const slot = root?.querySelector('#analyze-inventory-provenance');
    if (!slot) return;
    const pathInput = root.querySelector('#project-path-input');
    slot.innerHTML = this.renderInventoryProvenanceLine(pathInput?.value);
  }

  buildModeDetailContext() {
    const pathInput = this._root?.querySelector('#project-path-input');
    const projectPath = this.getActiveProjectPath(pathInput?.value);
    const report = this.reportForProjectPath(projectPath);
    const lastResult = this.lastResult
      && reportMatchesPagePath({ projectRoot: this.lastResult.projectPath || this.lastResult.report?.projectRoot }, projectPath)
      ? this.lastResult
      : null;
    return { projectPath, report, lastResult };
  }

  syncPathChipStates(root, projectPath) {
    if (!root) return;
    const activeNorm = projectPath ? normalizeProjectPath(projectPath) : '';
    root.querySelectorAll('.analyze-path-chip-wrap').forEach((wrap) => {
      const chip = wrap.querySelector('.analyze-path-chip');
      const chipPath = chip?.dataset.path || '';
      const active = Boolean(activeNorm && chipPath && normalizeProjectPath(chipPath) === activeNorm);
      wrap.classList.toggle('active', active);
      chip?.classList.toggle('active', active);
    });
  }

  schedulePathDependentUi(root = this._root) {
    clearTimeout(this._pathUiTimer);
    this._pathUiTimer = setTimeout(() => {
      this.syncAnalyzeModeUi(root);
      void this.refreshReportForActivePath(root);
    }, 280);
  }

  async refreshReportForActivePath(root = this._root) {
    if (!root) return;
    const pathInput = root.querySelector('#project-path-input');
    const projectPath = this.getActiveProjectPath(pathInput?.value);
    if (!projectPath) {
      this.app.state.pathInventory = null;
      this.syncAnalyzeModeUi(root);
      return;
    }
    if (isRemoteRepoUrl(projectPath)) {
      this.syncAnalyzeModeUi(root);
      return;
    }
    try {
      const live = await this.app.scanService.fetchReport(projectPath);
      if (live && reportMatchesPagePath(live, projectPath)) {
        this.app.state.report = live;
      }
    } catch {
      // No report.json on disk for this path yet — scope panel still shows config defaults.
    }
    await refreshPathInventory(this.app, projectPath).catch(() => null);
    this.syncAnalyzeModeUi(root);
  }

  setPathInputDisplay(pathInput, fullPath) {
    if (!pathInput) return;
    pathInput.value = fullPath ? formatPathInputValue(fullPath) : '';
  }

  bindEvents(el) {
    const pathInput = el.querySelector('#project-path-input');
    const typeSelect = el.querySelector('#analysis-type-select');
    const providerSelect = el.querySelector('#ai-provider-select');

    el.querySelector('#analyze-full-directory')?.addEventListener('change', (event) => {
      this.fullDirectoryScan = Boolean(event.target.checked);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('simplebeacon_full_directory_scan', this.fullDirectoryScan ? '1' : '0');
      }
    });

    this.bindModeGridEvents(el);
    this.bindClientDeliverablePicker(el);

    typeSelect?.addEventListener('change', () => {
      this.setAnalysisType(typeSelect.value, { typeSelect });
    });
    providerSelect?.addEventListener('change', () => {
      this.aiProvider = providerSelect.value;
      saveAnalyzePrefs({
        analysisType: this.analysisType,
        aiProvider: this.aiProvider,
        roadmapInsightsMode: this.roadmapInsightsMode,
        understandingMode: this.understandingMode
      });
      this.syncAiProviderNote(el);
    });
    el.querySelector('#roadmap-insights-select')?.addEventListener('change', (e) => {
      this.roadmapInsightsMode = e.target.value;
      saveAnalyzePrefs({
        analysisType: this.analysisType,
        aiProvider: this.aiProvider,
        roadmapInsightsMode: this.roadmapInsightsMode,
        understandingMode: this.understandingMode
      });
      this.syncAnalyzeModeUi(el);
    });
    el.querySelector('#understanding-mode-select')?.addEventListener('change', (e) => {
      this.understandingMode = e.target.value;
      saveAnalyzePrefs({
        analysisType: this.analysisType,
        aiProvider: this.aiProvider,
        roadmapInsightsMode: this.roadmapInsightsMode,
        understandingMode: this.understandingMode
      });
      this.syncAnalyzeModeUi(el);
    });

    el.querySelector('#use-default-path-btn')?.addEventListener('click', () => {
      const path = this.app.state.defaultProjectPath;
      if (path && pathInput) {
        this.setPathInputDisplay(pathInput, path);
        this.app.state.lastProjectPath = path;
        this.syncAnalyzeModeUi(el);
        void this.refreshReportForActivePath(el);
      }
    });

    el.querySelector('#clear-path-btn')?.addEventListener('click', () => {
      if (pathInput) pathInput.value = '';
      this.app.state.lastProjectPath = '';
      this.syncAnalyzeModeUi(el);
    });

    el.querySelectorAll('.analyze-path-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const path = chip.dataset.path;
        if (pathInput) this.setPathInputDisplay(pathInput, path);
        this.app.state.pathInputDraft = '';
        this.app.state.lastProjectPath = path;
        this.syncAnalyzeModeUi(el);
        void this.refreshReportForActivePath(el);
      });
    });

    el.querySelectorAll('.analyze-path-chip-dismiss').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const path = btn.dataset.path;
        removeRecentPath(path);
        if (this.app.state.lastProjectPath === path) {
          this.app.state.lastProjectPath = '';
          if (pathInput) pathInput.value = '';
        }
        this.refresh();
      });
    });

    el.querySelector('#run-analyze-btn')?.addEventListener('click', () => {
      if (this.analysisType === 'complete') {
        this.persistSelectedEngines(el);
        const enginesToRun = resolveEnginesForRun(this.selectedEngines);
        if (!enginesToRun.length) {
          showToast('Select at least one engine on the mode pills', 'error');
          return;
        }
      }
      this.runPathAnalysis(this.resolveProjectPath(pathInput?.value));
    });
    el.querySelector('#issue-select-all-btn')?.addEventListener('click', () => {
      this.selectedIssueIds = new Set(AI_SYSTEM_ISSUES.map((issue) => issue.id));
      this.refresh();
    });
    el.querySelector('#issue-clear-all-btn')?.addEventListener('click', () => {
      this.selectedIssueIds = new Set();
      this.aiIssueAnalysisResult = null;
      this.refresh();
    });
    el.querySelector('#run-issue-analysis-btn')?.addEventListener('click', () => {
      this.aiIssueAnalysisResult = buildAiSystemsIssueAnalysis(
        Array.from(this.selectedIssueIds),
        { context: this.buildAnalyzerSuiteContext() }
      );
      this.refresh();
    });
    el.querySelector('#export-ai-analyzer-json-btn')?.addEventListener('click', () => {
      if (!this.aiIssueAnalysisResult) {
        showToast('Run analyzer suite first', 'info');
        return;
      }
      const pathInput = el.querySelector('#project-path-input');
      const projectPath = this.resolveProjectPath(pathInput?.value);
      const payload = sanitizeAiProblemAnalyzerExport(this.aiIssueAnalysisResult, {
        projectPath,
        context: this.buildAnalyzerSuiteContext()
      });
      if (!payload) {
        showToast('Nothing to export', 'info');
        return;
      }
      downloadJson(payload, aiProblemAnalyzerExportFilename(projectPath));
      showToast('Analyzer suite JSON exported', 'success');
    });
    el.querySelector('#export-ai-analyzer-csv-btn')?.addEventListener('click', () => {
      if (!this.aiIssueAnalysisResult) {
        showToast('Run analyzer suite first', 'info');
        return;
      }
      const pathInput = el.querySelector('#project-path-input');
      const projectPath = this.resolveProjectPath(pathInput?.value);
      const payload = sanitizeAiProblemAnalyzerExport(this.aiIssueAnalysisResult, {
        projectPath,
        context: this.buildAnalyzerSuiteContext()
      });
      if (!payload) {
        showToast('Nothing to export', 'info');
        return;
      }
      const slug = pathToFileSlug(projectPath);
      downloadText(
        buildAiProblemAnalyzerCsv(payload),
        `ai-problem-analyzer-${slug}-${dateStamp()}.csv`,
        'text/csv;charset=utf-8'
      );
      showToast('Analyzer suite CSV exported', 'success');
    });
    el.querySelectorAll('input[data-ai-issue-id]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const id = event.target.dataset.aiIssueId;
        if (!id) return;
        if (event.target.checked) {
          this.selectedIssueIds.add(id);
        } else {
          this.selectedIssueIds.delete(id);
        }
        this.aiIssueAnalysisResult = null;
        this.refresh();
      });
    });

    el.querySelector('#goto-results-quick-btn')?.addEventListener('click', () => {
      this.openResultsView();
    });

    pathInput?.addEventListener('input', () => {
      this.app.state.pathInputDraft = pathInput.value;
      this.app.state.lastProjectPath = '';
      this.schedulePathDependentUi(el);
    });

    pathInput?.addEventListener('blur', () => {
      clearTimeout(this._pathUiTimer);
      this.syncAnalyzeModeUi(el);
      void this.refreshReportForActivePath(el);
    });

    pathInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const resolved = this.resolveProjectPath(pathInput.value);
        if (!resolved) return;
        this.app.state.pathInputDraft = '';
        this.app.state.lastProjectPath = resolved;
        this.setPathInputDisplay(pathInput, resolved);
        void this.refreshReportForActivePath(el);
        void this.runPathAnalysis(resolved);
      }
    });

    el.querySelector('#refresh-analyze-providers-btn')?.addEventListener('click', async () => {
      const btn = el.querySelector('#refresh-analyze-providers-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Refreshing…';
      }
      try {
        await this.loadProviders(providerSelect, { refresh: true });
        showToast('Provider status updated', 'success');
      } catch (err) {
        showToast(err.message || 'Refresh failed', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Refresh provider status';
        }
      }
    });

    this.bindFileDropEvents(el);
    if (!this._aiKeysListenerBound && typeof window !== 'undefined') {
      window.addEventListener('simplebeacon:ai-keys-updated', this._onAiKeysUpdated);
      this._aiKeysListenerBound = true;
    }
    this.loadProviders(providerSelect, { refresh: true });
    this.loadTestSources(el);
  }

  bindFileDropEvents(el) {
    const dropzone = el.querySelector('#analyze-file-dropzone');
    const fileInput = el.querySelector('#analyze-file-input');
    if (!dropzone) return;

    dropzone.querySelector('#analyze-file-browse-btn')?.addEventListener('click', () => {
      fileInput?.click();
    });

    dropzone.querySelector('#analyze-file-clear-btn')?.addEventListener('click', () => {
      this.snippetResult = null;
      this.refresh();
    });

    dropzone.querySelector('#analyze-snippet-understand-btn')?.addEventListener('click', () => {
      void this.runSnippetUnderstanding();
    });

    fileInput?.addEventListener('change', () => {
      const files = fileInput.files;
      if (files?.length) {
        void this.handleAnalyzeFiles(files);
        fileInput.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (eventName === 'dragleave' && event.target !== dropzone && dropzone.contains(event.relatedTarget)) {
          return;
        }
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      const files = event.dataTransfer?.files;
      if (files?.length) {
        void this.handleAnalyzeFiles(files);
      }
    });
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsText(file);
    });
  }

  tryParseJsonReport(text) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  importCompleteScanExport(parsed, fileName) {
    const results = parsed.results || {};
    const gateReport = results.simplebeacon || null;
    const mockDigest = results.mockScan || null;
    const mockScanStep = mockDigest ? {
      id: 'mock-scan',
      report: mockDigest.sourceReport || gateReport,
      fictionIssues: mockDigest.fictionIssues || [],
      nonFictionIssues: mockDigest.nonFictionIssues || [],
      conclusion: mockDigest.conclusion || null
    } : null;
    const stepDefs = [
      { id: 'simplebeacon', report: gateReport },
      { id: 'consolidation', scan: results.consolidation },
      ...(mockScanStep ? [mockScanStep] : []),
      { id: 'roadmap', roadmap: results.roadmap, data: { roadmap: results.roadmap } },
      { id: 'codebase', scan: results.codebase },
      { id: 'file-reduction', scan: results.fileReduction },
      { id: 'data-quality', scan: results.dataQuality },
      {
        id: 'cleanup-assistant',
        brief: results.cleanupAssistant,
        fileReduction: results.fileReduction,
        dataQuality: results.dataQuality
      },
      { id: 'npm-audit', npmAudit: results.npmAudit },
      { id: 'compliance', checklist: results.compliance }
    ];
    const steps = stepDefs
      .filter((def) => def.report || def.scan || def.roadmap || def.brief || def.npmAudit || def.checklist)
      .map((def) => ({ ...def, status: 'done' }));

    this.lastResult = {
      kind: 'complete',
      projectPath: parsed.projectPath || '',
      label: `Imported: ${fileName}`,
      steps,
      errors: parsed.errors || []
    };
    this.app.state.analyzeResult = this.lastResult;
    if (results.simplebeacon) {
      this.app.state.report = results.simplebeacon;
      this.app.scanService.report = results.simplebeacon;
    }
    if (results.npmAudit) {
      this.app.state.npmAudit = results.npmAudit;
    }
    showToast(`Imported complete scan from ${fileName}`, 'success');
    this.refresh();
  }

  importJsonReport(parsed, fileName, meta = {}) {
    if (parsed.type === 'simplebeacon-complete-scan' && parsed.results) {
      this.importCompleteScanExport(parsed, fileName);
      return true;
    }
    if (isSimplebeaconReport(parsed)) {
      this.applyReport(parsed, `Imported scan: ${fileName}`, { conclusion: buildScanConclusion(parsed) });
      return true;
    }
    if (isCodebaseReport(parsed)) {
      this.lastResult = {
        kind: 'codebase',
        scan: parsed,
        projectPath: parsed.projectPath || parsed.projectRoot || '',
        label: `Imported codebase report: ${fileName}`,
        conclusion: buildCodebaseConclusion(parsed)
      };
      this.app.state.analyzeResult = this.lastResult;
      showToast(`Imported codebase report from ${fileName}`, 'success');
      this.refresh();
      return true;
    }
    if (parsed.type === 'file-merger-reduction-report') {
      if (!parsed.summary || typeof parsed.summary !== 'object') {
        showToast('Consolidation JSON is missing summary metrics', 'error');
        return true;
      }
      this.app.state.mergerReductionScan = parsed;
      this.lastResult = {
        kind: 'consolidation',
        scan: parsed,
        projectPath: parsed.projectRoot || parsed.projectPath || '',
        label: `Imported consolidation: ${fileName}`
      };
      this.app.state.analyzeResult = this.lastResult;
      const typeSelect = this._root?.querySelector('#analysis-type-select');
      this.setAnalysisType('consolidation', { typeSelect });
      showToast(`Imported consolidation report from ${fileName}`, 'success');
      this.refresh();
      return true;
    }
    if (parsed.type === 'data-cleanup-report') {
      const profile = parsed.scanProfile || 'file-reduction';
      this.lastResult = {
        kind: profile === 'data-quality' ? 'data-quality' : 'file-reduction',
        scan: parsed,
        projectPath: parsed.projectRoot || '',
        label: `Imported ${profile}: ${fileName}`,
        conclusion: buildDataCleanupConclusion(parsed, profile)
      };
      this.app.state.analyzeResult = this.lastResult;
      showToast(`Imported ${profile} report from ${fileName}`, 'success');
      this.refresh();
      return true;
    }
    if (isAnalyzerCacheJson(parsed)) {
      const fileCount = Object.keys(parsed.files).length;
      this.snippetResult = {
        fileName,
        bytes: meta.bytes ?? 0,
        text: '',
        findings: [],
        threatScore: 0,
        cacheMeta: { fileCount, lastScan: parsed.lastScan || null }
      };
      showToast(
        `Scanner cache index (${fileCount} path(s)) — not a production source file`,
        'info'
      );
      this.refresh();
      return true;
    }
    if (isCleanupExportJson(parsed)) {
      const unusedCount = parsed.brief?.unusedFiles?.length
        ?? parsed.unusedFiles?.length
        ?? parsed.brief?.tiers?.reviewFirst?.files
        ?? 0;
      this.snippetResult = {
        fileName,
        bytes: meta.bytes ?? 0,
        text: '',
        findings: [],
        threatScore: 0,
        cacheMeta: { cleanupExport: true, phase: parsed.phase || null, unusedCount }
      };
      showToast(
        `Cleanup export inventory (${unusedCount || 'path'} listing) — not a production source file`,
        'info'
      );
      this.refresh();
      return true;
    }
    if (parsed.type === 'dynamic-project-roadmap-analysis' || parsed.codeAnalysis?.structure) {
      const metrics = extractRoadmapFileMetrics(parsed);
      const scanTarget = parsed.scanTargetRoot
        || parsed.projectRoot
        || String(parsed.directoryStructure?.server?.path || '').replace(/[/\\]server$/i, '')
        || '';
      this.lastResult = {
        kind: 'roadmap',
        data: parsed,
        projectPath: scanTarget,
        label: `Imported roadmap: ${fileName}`,
        conclusion: metrics
          ? `Roadmap walk — ${Number(metrics.totalFiles).toLocaleString()} files (${Number(metrics.codeFiles).toLocaleString()} code).`
          : 'Imported filesystem roadmap analysis.'
      };
      this.app.state.analyzeResult = this.lastResult;
      const typeSelect = this._root?.querySelector('#analysis-type-select');
      this.setAnalysisType('roadmap', { typeSelect });
      showToast(`Imported roadmap analysis from ${fileName}`, 'success');
      this.refresh();
      return true;
    }
    if (isFictionDigestJson(parsed)) {
      const digest = sanitizeFictionDigestExport(parsed);
      const report = digest.sourceReport;
      const fictionCount = (digest.fictionIssues || []).reduce((sum, i) => sum + (i.count || 1), 0);
      this.lastResult = {
        kind: 'mock-scan',
        report,
        digest,
        fictionIssues: digest.fictionIssues || [],
        projectPath: report.projectRoot || report.projectPath || '',
        label: `Imported fiction digest: ${fileName}`,
        conclusion: digest.conclusion || buildScanConclusion(report, { focus: 'fiction' })
      };
      this.app.state.analyzeResult = this.lastResult;
      this.app.state.report = report;
      if (this.app.scanService) this.app.scanService.report = report;
      showToast(
        `Imported fiction digest (${fictionCount} KPI hit(s), trust: ${digest.digestTrust || 'unknown'})`,
        fictionCount ? 'info' : 'success'
      );
      this.refresh();
      return true;
    }
    return false;
  }

  async handleAnalyzeFiles(fileList) {
    const file = fileList[0];
    if (!file) return;
    if (fileList.length > 1) {
      showToast('Drop one file at a time', 'info');
    }
    if (file.size > MAX_SNIPPET_BYTES) {
      showToast(`File too large (max ${Math.round(MAX_SNIPPET_BYTES / 1024)} KB for quick check)`, 'error');
      return;
    }

    this.snippetBusy = true;
    this.refresh();

    try {
      const text = await this.readFileAsText(file);
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = this.tryParseJsonReport(text);
        if (parsed && this.importJsonReport(parsed, file.name, { bytes: file.size })) {
          this.snippetBusy = false;
          return;
        }
      }

      if (!isSupportedSourceFile(file.name)) {
        showToast('Unsupported file type for quick check', 'error');
        return;
      }

      if (isScannerMetaFileName(file.name)) {
        this.snippetResult = {
          fileName: file.name,
          bytes: file.size,
          text,
          findings: [],
          threatScore: 0,
          cacheMeta: { scannerMeta: true },
          understanding: null,
          understandingSkipped: null
        };
        showToast(`${file.name} is scanner metadata — skipped pattern scan`, 'info');
        return;
      }

      if (isLockfileName(file.name)) {
        this.snippetResult = {
          fileName: file.name,
          bytes: file.size,
          text,
          findings: [],
          threatScore: 0,
          cacheMeta: { lockfile: true },
          understanding: null,
          understandingSkipped: null
        };
        showToast(`${file.name} is a dependency lockfile — skipped mock-path quick check`, 'info');
        return;
      }

      const rawFindings = scanSnippetText(text, { fileName: file.name });
      const findings = filterSnippetFindingsForFile(rawFindings, file.name);
      const isDocumentation = isMarkdownFileName(file.name);
      this.snippetResult = {
        fileName: file.name,
        bytes: file.size,
        text,
        findings,
        threatScore: computeThreatScore(findings),
        cacheMeta: isDocumentation && findings.length === 0 ? { documentation: true } : null,
        understanding: null,
        understandingSkipped: null
      };
      showToast(
        isDocumentation && rawFindings.length !== findings.length
          ? `${file.name} — documentation; mock-path rule tokens skipped`
          : `Scanned ${file.name} locally (${findings.length} hit(s))`,
        findings.length ? 'info' : 'success'
      );
    } catch (error) {
      showToast(error.message || 'File read failed', 'error');
    } finally {
      this.snippetBusy = false;
      this.refresh();
    }
  }

  async runSnippetUnderstanding() {
    if (this.snippetResult?.cacheMeta) {
      showToast('Scanner cache or export inventory — server understanding applies to source files only', 'info');
      return;
    }
    if (!this.snippetResult?.text) {
      showToast('Drop a source file first', 'error');
      return;
    }

    this.snippetBusy = true;
    this.refresh();

    try {
      await ensureDashboardApiReady();
      const projectPath = this.resolveProjectPath(document.getElementById('project-path-input')?.value) || undefined;
      const data = await fetchUnderstandSnippet(this.snippetResult.text, {
        filePath: this.snippetResult.fileName,
        projectPath: projectPath || undefined,
        understandingMode: this.understandingMode === 'off' ? 'deterministic' : this.understandingMode,
        aiProvider: this.aiProvider || 'demo'
      });
      this.snippetResult = {
        ...this.snippetResult,
        understanding: data.report,
        understandingSkipped: null
      };
      showToast('Server understanding complete', 'success');
    } catch (error) {
      this.snippetResult = {
        ...this.snippetResult,
        understandingSkipped: error.message || 'Server understanding failed'
      };
      showToast(error.message || 'Server understanding failed', 'error');
    } finally {
      this.snippetBusy = false;
      this.refresh();
    }
  }

  async loadProviders(select, options = {}) {
    try {
      const data = await fetchAnalyzeProviders(options);
      if (!data.providers) return;
      this.providers = data.providers;
      if (!select) return;

      const order = ['demo', 'ollama', 'openai', 'anthropic', 'active'];
      const sorted = [...data.providers].sort(
        (a, b) => (order.indexOf(a.id) === -1 ? 99 : order.indexOf(a.id))
          - (order.indexOf(b.id) === -1 ? 99 : order.indexOf(b.id))
      );
      select.innerHTML = sorted.map((p) => {
        const configured = isAnalyzeProviderConfigured(p);
        const suffix = configured ? '' : ' (not configured)';
        const title = [p.description, p.statusMessage].filter(Boolean).join(' · ');
        const disabled = configured ? '' : 'disabled';
        return `<option value="${escapeHtml(p.id)}" ${disabled} title="${escapeHtml(title)}">${escapeHtml(p.label || p.id)}${suffix}</option>`;
      }).join('');

      const preferred = this.aiProvider;
      const preferredOk = data.providers.some(
        (p) => p.id === preferred && isAnalyzeProviderConfigured(p)
      );
      const ollama = data.providers.find((p) => p.id === 'ollama' && isAnalyzeProviderConfigured(p));
      const activeLlm = data.providers.find((p) => p.id === 'active' && isAnalyzeProviderConfigured(p));
      if (preferredOk) {
        select.value = preferred;
      } else if (ollama) {
        this.aiProvider = 'ollama';
        select.value = 'ollama';
        saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
      } else if (activeLlm) {
        this.aiProvider = 'active';
        select.value = 'active';
        saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
      } else {
        const fallback = data.providers.find((p) => p.id === 'demo' && isAnalyzeProviderConfigured(p))
          || data.providers.find((p) => isAnalyzeProviderConfigured(p));
        if (fallback) {
          this.aiProvider = fallback.id;
          select.value = fallback.id;
          saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
        }
      }
      this.syncAiProviderNote(this._root);
    } catch (err) {
      if (select) {
        select.innerHTML = `
          <option value="demo">Filesystem scan (no AI narrative)</option>
          <option value="ollama" disabled>Ollama — reload providers</option>
        `;
      }
      showToast(
        err?.message || 'Could not load AI providers — restart dashboard (npm run dashboard:kill-ports && npm run dashboard:v1-internal)',
        'error'
      );
    }
  }

  async attachCodeInsights(scan, projectPath) {
    if (!scan || !projectPath) return scan;
    let enriched = { ...scan };
    if (shouldFetchZscriptReport(projectPath, scan)) {
      try {
        const zscriptReport = await fetchZscriptModReport(projectPath);
        enriched = { ...enriched, zscriptReport };
      } catch (error) {
        enriched = { ...enriched, zscriptReportError: error.message || String(error) };
      }
    }
    return enriched;
  }

  renderCodeInsightsPanels(scan) {
    if (!scan) return '';
    return [
      renderUnderstandingPanel(scan.codeUnderstanding),
      renderZscriptReportPanel(scan.zscriptReport, { error: scan.zscriptReportError })
    ].join('');
  }

  buildCodeInsightsConclusion(scan) {
    return [
      buildUnderstandingConclusion(scan?.codeUnderstanding),
      buildZscriptConclusion(scan?.zscriptReport)
    ].filter(Boolean).join(' ');
  }

  async runPathAnalysis(inputPath) {
    let projectPath = String(inputPath || '').trim();
    if (!projectPath) {
      showToast('Enter a project path or public repo URL', 'error');
      return;
    }
    if (!isPlausibleProjectPath(projectPath)) {
      showToast('Enter a folder path (not a file like .bat or .json) or a supported public repo URL', 'error');
      if (this.app.state.lastProjectPath === projectPath) {
        this.app.state.lastProjectPath = '';
      }
      return;
    }
    if (!isRemoteRepoUrl(projectPath)) {
      const allowlist = await validateProjectPathAllowlist(projectPath, this.app);
      if (!allowlist.allowed) {
        showToast(allowlist.message, 'error');
        return;
      }
    }

    const sourceRepoUrl = isRemoteRepoUrl(projectPath) ? projectPath : null;
    if (sourceRepoUrl) {
      this.busy = true;
      this.scanStartedAt = Date.now();
      this.refresh();
      showToast('Cloning repository…', 'info');
      try {
        await ensureDashboardApiReady();
        const cloned = await prepareGithubRepo(sourceRepoUrl);
        projectPath = cloned.projectPath;
        showToast(cloned.cached ? 'Using cached clone — starting scan…' : 'Clone complete — starting scan…', 'info');
      } catch (err) {
        this.busy = false;
        this.refresh();
        showToast(err.message || 'GitHub clone failed', 'error');
        return;
      }
    }

    this.busy = true;
    this.scanStartedAt = Date.now();
    this.app.state.pathInputDraft = '';
    this.app.state.lastProjectPath = projectPath;
    if (sourceRepoUrl) {
      this.app.state.lastRepoUrl = sourceRepoUrl;
    }
    saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, understandingMode: this.understandingMode });
    this.startProgressPolling(projectPath);
    this.refresh();

    await authService.fetchPlatformStatus();
    if (authService.authRequired && !(await authService.ensureAuthenticated())) {
      this.stopProgressPolling();
      this.busy = false;
      this.refresh();
      showToast('Session expired — sign in again before running analysis', 'error');
      window.location.hash = '#/signin';
      return;
    }

    try {
      await ensureDashboardApiReady();
    } catch (err) {
      this.stopProgressPolling();
      this.busy = false;
      this.refresh();
      showToast(err.message, 'error');
      return;
    }

    showToast('Analyzing…', 'info');

    let analysisSucceeded = false;
    try {
      let effectiveType = this.analysisType;
      if (effectiveType === 'auto') {
        effectiveType = resolveAutoAnalysisMode(projectPath);
        showToast(`Auto selected: ${effectiveType}`, 'info');
      }

      if (effectiveType === 'complete') {
        this.persistSelectedEngines(this._root);
        const enginesToRun = resolveEnginesForRun(this.selectedEngines);
        if (!enginesToRun.length) {
          throw new Error('Select at least one analysis engine before running Complete scan.');
        }
        await this.runCompleteScan(projectPath, enginesToRun);
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'simplebeacon') {
        const data = await scanPath(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
        let report = data.report;
        if (!report) {
          throw new Error('Scan completed but returned no report — check server logs');
        }
        report = await enrichScanReport(report, projectPath);
      this.repositoryInventory = report.repositoryInventory || null;
      const conclusion = buildScanConclusion(report);
        this.lastResult = {
          kind: 'simplebeacon-report',
          report,
          projectPath,
          repositoryInventory: report.repositoryInventory || null,
          label: `Simplebeacon scan: ${formatPathLabel(projectPath)}`,
          conclusion
        };
        this.applyReport(report, this.lastResult.label, { conclusion });
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'mock-scan') {
        const data = await scanPath(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
        let report = data.report;
        const digest = report ? buildFictionDigestPayload(report) : null;
        this.lastResult = {
          kind: 'mock-scan',
          report,
          projectPath,
          fictionIssues: digest?.fictionIssues || [],
          nonFictionIssues: digest?.nonFictionIssues || [],
          label: `Mock & fiction KPIs: ${formatPathLabel(projectPath)}`,
          conclusion: digest?.conclusion || null
        };
        await this.attachRepositoryInventory(projectPath, report);
        this.app.state.analyzeResult = this.lastResult;
        this.app.state.report = report;
        this.app.scanService.report = report;
        this.refresh();
        showToast('Mock/fiction scan complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'consolidation') {
        let scan = await this.app.platformService.fetchMergerReductionScan(projectPath);
        await this.attachRepositoryInventory(projectPath, scan);
        scan = await this.attachOptionalAiSummary(scan, projectPath, scan?.type);
        this.app.state.mergerReductionScan = scan;
        this.lastResult = {
          kind: 'consolidation',
          scan,
          projectPath,
          label: `Data consolidation: ${formatPathLabel(projectPath)}`
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('Consolidation scan complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'codebase') {
        let scan = await fetchCodebaseAnalysis(projectPath, {
          context: 'complete',
          includeEslint: true,
          understandingMode: this.understandingMode,
          timeoutMs: 900000
        });
        scan = await this.attachCodeInsights(scan, projectPath);
        scan = await this.attachOptionalAiSummary(scan, projectPath, scan?.type);
        const insightNote = this.buildCodeInsightsConclusion(scan);
        this.lastResult = {
          kind: 'codebase',
          scan,
          projectPath,
          label: `Codebase analysis: ${formatPathLabel(projectPath)}`,
          conclusion: [buildCodebaseConclusion(scan), insightNote].filter(Boolean).join(' ')
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('Codebase analysis complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'file-reduction' || effectiveType === 'data-quality') {
        let scan = await fetchDataCleanupScan(projectPath, { profile: effectiveType });
        await this.attachRepositoryInventory(projectPath, scan);
        scan = await this.attachOptionalAiSummary(scan, projectPath, effectiveType);
        this.lastResult = {
          kind: effectiveType,
          scan,
          projectPath,
          profile: effectiveType,
          label: `${effectiveType === 'file-reduction' ? 'File reduction' : 'Data quality'}: ${formatPathLabel(projectPath)}`,
          conclusion: buildDataCleanupConclusion(scan, effectiveType)
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast(`${effectiveType === 'file-reduction' ? 'File reduction' : 'Data quality'} scan complete`, 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'cleanup-assistant') {
        this.completeStep = '1/3 File reduction…';
        this.refresh();
        const fileReduction = await fetchDataCleanupScan(projectPath, {
          profile: 'file-reduction',
          refresh: true,
          requireFindings: false,
          timeoutMs: 300000
        });
        this.completeStep = '2/3 Data quality…';
        this.refresh();
        const dataQuality = await fetchDataCleanupScan(projectPath, {
          profile: 'data-quality',
          refresh: true,
          requireFindings: false,
          timeoutMs: 300000
        });
        this.completeStep = '3/3 Cleanup brief…';
        this.refresh();
        await this.attachRepositoryInventory(projectPath, fileReduction);
        const repositoryInventory = this.repositoryInventory
          || this.lastResult?.repositoryInventory
          || fileReduction?.inventory
          || null;
        const policy = loadCleanupPolicy();
        const brief = buildCleanupAssistantBrief({
          projectPath,
          fileReduction,
          dataQuality,
          repositoryInventory,
          policy
        });
        if (!isCleanupBriefRunnable({ brief, fileReduction, dataQuality })) {
          throw new Error('Cleanup assistant could not build a brief — scans returned no inventory or quality signals. Restart the dashboard server and retry.');
        }
        this.lastResult = {
          kind: 'cleanup-assistant',
          projectPath,
          fileReduction,
          dataQuality,
          repositoryInventory,
          brief,
          policy,
          label: `Cleanup assistant: ${formatPathLabel(projectPath)}`,
          conclusion: buildCleanupAssistantConclusion(brief)
        };
        this.app.state.analyzeResult = this.lastResult;
        this.completeStep = '';
        this.refresh();
        showToast('Cleanup assistant scan complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'compliance') {
        this.completeStep = '1/2 Simplebeacon gate…';
        this.refresh();
        const data = await scanPath(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
        let report = data.report;
        if (!report) {
          throw new Error('Gate scan completed but returned no report');
        }
        report = await enrichScanReport(report, projectPath);
        this.repositoryInventory = report.repositoryInventory || null;
        this.completeStep = '2/2 Compliance checklist…';
        this.refresh();
        const npmAudit = await fetchProjectNpmAudit(projectPath);
        const complianceData = await fetchComplianceChecklist(report, projectPath, {
          npmAudit,
          checklistProfile: 'default'
        });
        const checklist = complianceData.complianceChecklist;
        const complianceExport = complianceData.complianceExport || null;
        this.lastResult = {
          kind: 'compliance',
          report,
          checklist,
          complianceExport,
          npmAudit,
          projectPath,
          label: `Compliance checklist: ${formatPathLabel(projectPath)}`,
          conclusion: checklist?.summary
            ? `${checklist.summary.passed ?? 0}/${checklistRuleTotal(checklist)} rules passed${checklist.summary.failed ? ` — ${checklist.summary.failed} failed` : ''}.`
            : 'Compliance checklist complete.'
        };
        this.app.state.analyzeResult = this.lastResult;
        this.app.state.report = report;
        this.app.scanService.report = report;
        this.refresh();
        showToast('Compliance checklist complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'npm-audit') {
        this.completeStep = 'Running npm audit…';
        this.refresh();
        const npmAudit = await fetchProjectNpmAudit(projectPath);
        this.app.state.npmAudit = npmAudit;
        this.lastResult = {
          kind: 'npm-audit',
          npmAudit,
          projectPath,
          label: `npm audit: ${formatPathLabel(projectPath)}`,
          conclusion: npmAudit?.summary
            ? `${npmAudit.summary.total ?? npmAudit.vulnerabilityTotal ?? 0} vulnerabilities across ${npmAudit.summary.dependencies ?? npmAudit.dependencies?.total ?? '—'} dependencies.`
            : 'npm audit complete.'
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('npm audit complete', 'success');
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'eu-ai-act') {
        this.completeStep = 'EU AI Act sprint (eu-ai-act profile)…';
        this.refresh();
        const { resolveProductCompliancePath } = await import('../lib/pageRepoScan.js');
        const euPath = resolveProductCompliancePath(projectPath, this.app);
        if (euPath && euPath !== projectPath) {
          showToast(`Benchmark clone — EU sprint runs on ${formatPathLabel(euPath)}`, 'warning');
          projectPath = euPath;
          this.app.state.lastProjectPath = euPath;
        }
        if (isBenchmarkCachePath(projectPath)) {
          throw new Error('EU AI Act sprint requires the product root (ai-platform), not github-cache benchmark clones.');
        }
        const sprint = await runEuAiActSprint({ projectPath, initProfile: true, forceInit: true });
        const checklist = sprint.compliance || {};
        this.lastResult = {
          kind: 'eu-ai-act',
          sprint,
          projectPath,
          label: `EU AI Act sprint: ${formatPathLabel(projectPath)}`,
          conclusion: [
            sprint.gate?.pass ? 'Gate PASS' : 'Gate FAIL',
            `${sprint.euPatternHits ?? 0} EU pattern hits`,
            `${checklist.passed ?? 0}/${checklist.total ?? 0} checklist rules passed`
          ].join(' · ')
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('EU AI Act sprint complete', sprint.gate?.pass ? 'success' : 'warning');
        analysisSucceeded = true;
        return;
      }

      const data = await analyzePath(projectPath, {
        aiProvider: this.aiProvider,
        analysisType: effectiveType,
        roadmapInsightsMode: this.roadmapInsightsMode,
        understandingMode: this.understandingMode
      });

      this.lastResult = { kind: data.analysisType, data, projectPath };
      this.app.state.analyzeResult = this.lastResult;

      if (data.roadmap) {
        this.lastResult = {
          kind: 'roadmap',
          data,
          projectPath,
          label: `Roadmap: ${formatPathLabel(projectPath)}`,
          conclusion: 'Filesystem roadmap scan — sprint metrics from directory structure, not Simplebeacon gate rules.'
        };
        await this.attachRepositoryInventory(projectPath);
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('Roadmap generated from filesystem scan (no LLM)', 'success');
      } else if (data.report) {
        let scan = data.report;
        scan = await this.attachCodeInsights(scan, projectPath);
        this.lastResult = {
          kind: 'codebase',
          scan,
          projectPath,
          label: `Codebase analysis: ${formatPathLabel(projectPath)}`,
          conclusion: [
            buildCodebaseConclusion(scan),
            this.buildCodeInsightsConclusion(scan)
          ].filter(Boolean).join(' ')
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('Codebase analysis complete', 'success');
      } else {
        await this.attachRepositoryInventory(projectPath);
        this.refresh();
        showToast('Analysis complete', 'success');
      }
      analysisSucceeded = true;
    } catch (err) {
      removeRecentPath(projectPath);
      if (err.code === 'auth_required') {
        showToast('Session expired — sign in again', 'error');
        showLoginModal({ onSuccess: () => this.runPathAnalysis(projectPath) });
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      if (analysisSucceeded) {
        saveRecentPath(projectPath);
      }
      this.stopProgressPolling();
      this.busy = false;
      this.completeStep = '';
      this.completeProgress = null;
      this.scanStartedAt = null;
      this.refresh();
    }
  }

  async runCompleteScan(projectPath, enginesToRun = resolveEnginesForRun(this.selectedEngines)) {
    await ensureDashboardApiReady();

    const steps = [];
    const errors = [];
    const totalSteps = enginesToRun.length;

    this.completeProgress = {
      active: true,
      steps: enginesToRun.map((id) => ({
        id,
        label: getCompleteEngineLabel(id),
        status: 'pending',
        error: null
      }))
    };

    const runStep = async (index, engineId, label, fn) => {
      this.completeProgress.steps[index].status = 'running';
      this.completeStep = label;
      this.refresh();
      try {
        const result = await fn();
        this.completeProgress.steps[index].status = 'done';
        steps.push(result);
        this.refresh();
        return result;
      } catch (err) {
        this.completeProgress.steps[index].status = 'error';
        this.completeProgress.steps[index].error = err.message;
        errors.push({ step: label, message: err.message });
        this.refresh();
        return null;
      }
    };

    const stepRunners = {
      simplebeacon: async () => {
        const data = await scanPath(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
        let report = data.report;
        if (!report) {
          throw new Error('Scan completed but returned no report');
        }
        report = await enrichScanReport(report, projectPath);
        this.repositoryInventory = report.repositoryInventory || null;
        this.app.state.report = report;
        this.app.scanService.report = report;
        if (data.history) this.app.state.history = data.history;
        return {
          id: 'simplebeacon',
          report,
          gateFailed: Boolean(data.gateFailed),
          gatePass: report.gate?.pass ?? null,
          publicGateLocked: Boolean(data.publicGateLocked),
          publicSummary: data.publicSummary || null
        };
      },
      consolidation: async () => {
        let scan = await this.app.platformService.fetchMergerReductionScan(projectPath);
        if (!scan?.summary) {
          throw new Error('Consolidation scan returned no summary metrics — restart the dashboard server and retry.');
        }
        const inventory = this.repositoryInventory
          || this.lastResult?.repositoryInventory
          || await fetchRepositoryInventory(projectPath).catch(() => null);
        if (inventory?.totalFiles && scan?.summary) {
          scan = {
            ...scan,
            reportVersion: scan.reportVersion || 2,
            repositoryInventory: scan.repositoryInventory?.totalFiles != null
              ? scan.repositoryInventory
              : inventory,
            summary: {
              ...scan.summary,
              repositoryFilesTotal: scan.summary.repositoryFilesTotal ?? inventory.totalFiles,
              repositoryFoldersTotal: scan.summary.repositoryFoldersTotal ?? inventory.totalFolders,
              filesAnalyzed: scan.summary.repositoryFilesTotal ?? scan.summary.filesAnalyzed ?? inventory.totalFiles
            }
          };
        }
        scan = await this.attachOptionalAiSummary(scan, projectPath, scan?.type);
        this.app.state.mergerReductionScan = scan;
        return { id: 'consolidation', scan };
      },
      'mock-scan': async () => {
        const simplebeaconStep = steps.find((s) => s.id === 'simplebeacon');
        const report = simplebeaconStep?.report ?? null;
        if (!report) {
          throw new Error('Simplebeacon gate must complete before fiction digest');
        }
        const fictionIssues = filterIssuesByKind(report, 'fiction');
        const digest = buildFictionDigestPayload(report);
        return {
          id: 'mock-scan',
          report,
          fictionIssues,
          nonFictionIssues: digest?.nonFictionIssues || [],
          conclusion: digest?.conclusion || null
        };
      },
      roadmap: async () => {
        const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
        const data = await analyzePath(analysisPath, {
          aiProvider: this.aiProvider,
          analysisType: 'roadmap',
          roadmapInsightsMode: this.roadmapInsightsMode || 'off',
          timeoutMs: 180000,
          requestedScanRoot: projectPath
        });
        if (!data.roadmap) {
          throw new Error('Roadmap analysis returned no roadmap payload');
        }
        return { id: 'roadmap', data, roadmap: data.roadmap, analysisPath };
      },
      codebase: async () => {
        const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
        let scan = await fetchCodebaseAnalysis(analysisPath, {
          context: 'complete',
          includeEslint: true,
          understandingMode: 'off',
          timeoutMs: 900000,
          requestedScanRoot: projectPath
        });
        scan = await this.attachCodeInsights(scan, analysisPath);
        scan = await this.attachOptionalAiSummary(scan, analysisPath, scan?.type);
        return {
          id: 'codebase',
          scan,
          analysisPath,
          publicGateLocked: Boolean(scan?.publicGateLocked),
          publicSummary: scan?.publicSummary || null
        };
      },
      'file-reduction': async () => {
        const scan = await fetchDataCleanupScan(projectPath, {
          profile: 'file-reduction',
          refresh: true,
          timeoutMs: 300000
        });
        assertCompleteScanFileReductionFresh(scan);
        return { id: 'file-reduction', scan, profile: 'file-reduction' };
      },
      'data-quality': async () => {
        const scan = await fetchDataCleanupScan(projectPath, {
          profile: 'data-quality',
          refresh: true,
          timeoutMs: 300000
        });
        return { id: 'data-quality', scan, profile: 'data-quality' };
      },
      'cleanup-assistant': async () => {
        let fileReduction = steps.find((s) => s.id === 'file-reduction')?.scan ?? null;
        let dataQuality = steps.find((s) => s.id === 'data-quality')?.scan ?? null;
        if (!fileReduction) {
          fileReduction = await fetchDataCleanupScan(projectPath, {
            profile: 'file-reduction',
            refresh: true,
            requireFindings: false,
            timeoutMs: 300000
          });
        }
        if (!dataQuality) {
          dataQuality = await fetchDataCleanupScan(projectPath, {
            profile: 'data-quality',
            refresh: true,
            requireFindings: false,
            timeoutMs: 300000
          });
        }
        await this.attachRepositoryInventory(projectPath, fileReduction || dataQuality);
        const repositoryInventory = this.repositoryInventory
          || this.lastResult?.repositoryInventory
          || fileReduction?.inventory
          || null;
        const policy = loadCleanupPolicy();
        const brief = buildCleanupAssistantBrief({
          projectPath,
          fileReduction,
          dataQuality,
          repositoryInventory,
          policy
        });
        if (!isCleanupBriefRunnable({ brief, fileReduction, dataQuality })) {
          throw new Error('Cleanup assistant could not build a brief — scans returned no inventory or quality signals. Restart the dashboard server and retry.');
        }
        return {
          id: 'cleanup-assistant',
          brief,
          fileReduction,
          dataQuality,
          repositoryInventory,
          policy
        };
      },
      'npm-audit': async () => {
        const npmAudit = await fetchProjectNpmAudit(projectPath);
        this.app.state.npmAudit = npmAudit;
        return { id: 'npm-audit', npmAudit };
      },
      compliance: async () => {
        const simplebeaconStep = steps.find((s) => s.id === 'simplebeacon');
        const report = simplebeaconStep?.report;
        if (!report) {
          throw new Error('Simplebeacon gate must complete before compliance checklist');
        }
        const npmAuditStep = steps.find((s) => s.id === 'npm-audit');
        const npmAudit = npmAuditStep?.npmAudit || null;
        const data = await fetchComplianceChecklist(report, projectPath, {
          npmAudit,
          checklistProfile: 'default'
        });
        assertCompleteScanComplianceFresh(report, data.complianceChecklist);
        return {
          id: 'compliance',
          checklist: data.complianceChecklist,
          complianceExport: data.complianceExport || null,
          npmAudit
        };
      },
      'eu-ai-act': async () => {
        const { resolveProductCompliancePath } = await import('../lib/pageRepoScan.js');
        let euScanPath = resolveProductCompliancePath(projectPath, this.app) || projectPath;
        if (euScanPath !== projectPath) {
          showToast(`Benchmark clone — EU sprint runs on ${formatPathLabel(euScanPath)}`, 'warning');
        }
        if (isBenchmarkCachePath(euScanPath)) {
          throw new Error('EU AI Act sprint requires the product root (ai-platform), not github-cache benchmark clones.');
        }
        const sprint = await runEuAiActSprint({ projectPath: euScanPath, initProfile: true, forceInit: true });
        return { id: 'eu-ai-act', sprint, projectPath: euScanPath };
      }
    };

    for (let index = 0; index < enginesToRun.length; index += 1) {
      const engineId = enginesToRun[index];
      const runner = stepRunners[engineId];
      if (!runner) continue;
      const label = completeStepLabel(index, `${getCompleteEngineLabel(engineId)}…`, totalSteps);
      await runStep(index, engineId, label, runner);
    }

    const enginesRun = steps.map((step) => step.id);
    const euAiActStep = steps.find((step) => step.id === 'eu-ai-act');

    this.lastResult = {
      kind: 'complete',
      projectPath: euAiActStep?.projectPath || projectPath,
      label: `Complete scan: ${formatPathLabel(euAiActStep?.projectPath || projectPath)}`,
      steps,
      enginesRun,
      analysisConfig: {
        selectedEngines: [...this.selectedEngines],
        enginesRun
      },
      errors,
      publicGateLocked: steps.some((step) => step.publicGateLocked || step.report?.publicGateLocked || step.scan?.publicGateLocked),
      publicSummary: steps.find((step) => step.publicSummary)?.publicSummary
        || steps.find((step) => step.scan?.publicSummary)?.scan?.publicSummary
        || null
    };
    const simplebeaconReport = steps.find((s) => s.id === 'simplebeacon')?.report;
    await this.attachRepositoryInventory(this.lastResult.projectPath, simplebeaconReport);
    this.lastResult.repositoryInventory = simplebeaconReport?.repositoryInventory
      || this.repositoryInventory
      || null;
    this.app.state.analyzeResult = this.lastResult;

    if (errors.length) {
      showToast(`Complete scan finished with ${errors.length} step error(s)`, 'info');
    } else {
      showToast('Complete scan finished', 'success');
    }
    this.refresh();
  }

  getCompleteStep(id) {
    return this.lastResult?.steps?.find((s) => s.id === id) ?? null;
  }

  /** Checked queue engines that completed in the current Complete scan (for ZIP export). */
  resolveExportEngineSelection(root = this._root) {
    const selected = this.readSelectedEnginesFromDom(root);
    const completed = new Set((this.lastResult?.steps || []).map((step) => step.id));
    return selected.filter((engineId) => completed.has(engineId));
  }

  resolveZipExportButtonMeta() {
    const completedSteps = (this.lastResult?.steps || []).map((step) => step.id);
    const selectedForExport = this.resolveExportEngineSelection();
    const allSelected = completedSteps.length > 0
      && selectedForExport.length === completedSteps.length;
    const count = selectedForExport.length;
    return {
      count,
      allSelected,
      label: allSelected || !count
        ? 'Download all reports (ZIP)'
        : `Download selected reports (${count}) ZIP`,
      title: allSelected || !count
        ? 'ZIP with every step JSON plus audit PDF sources'
        : `ZIP with JSON and PDF sources for ${count} checked scan${count === 1 ? '' : 's'} in the queue`
    };
  }

  syncZipExportButtonLabel(root = this._root) {
    if (!root || this.lastResult?.kind !== 'complete') return;
    const btn = root.querySelector('#download-export-bundle-zip');
    if (!btn) return;
    const meta = this.resolveZipExportButtonMeta();
    btn.textContent = meta.label;
    btn.title = meta.title;
  }

  resolveEuAiActExportPath() {
    const euStep = this.getCompleteStep('eu-ai-act');
    const fromStep = euStep?.projectPath || euStep?.sprint?.projectPath || euStep?.sprint?.platformRoot;
    if (fromStep && !isRedactedPathDisplay(fromStep)) return fromStep;
    if (this.lastResult?.kind === 'eu-ai-act') {
      return this.lastResult.projectPath || this.lastResult.sprint?.projectPath || null;
    }
    return this.lastResult?.projectPath || this.getActiveProjectPath() || null;
  }

  buildEuAiActSprintArtifacts() {
    const sprint = this.lastResult?.kind === 'complete'
      ? this.getCompleteStep('eu-ai-act')?.sprint
      : this.lastResult?.sprint;
    if (!sprint) return null;
    return {
      projectPath: sprint.projectPath || this.resolveEuAiActExportPath(),
      platformRoot: sprint.platformRoot || null,
      report: sprint.report || null,
      complianceChecklist: sprint.complianceChecklist || null,
      assessment: sprint.assessment || null
    };
  }

  hasEuAiActSprintResult() {
    const artifacts = this.buildEuAiActSprintArtifacts();
    return Boolean(artifacts?.report || artifacts?.complianceChecklist);
  }

  async downloadEuAiActAuditPdf() {
    const projectPath = this.resolveEuAiActExportPath();
    const sprintArtifacts = this.buildEuAiActSprintArtifacts();
    if (!projectPath && !sprintArtifacts) {
      throw new Error('EU AI Act sprint did not run — enable the EU engine and re-run Complete scan.');
    }
    const data = await fetchEuAiActAuditReport({
      projectPath: projectPath || sprintArtifacts?.projectPath,
      client: formatPathLabel(projectPath || sprintArtifacts?.projectPath) || undefined,
      sprintArtifacts
    });
    openAuditReportPrintWindow(data.html, data.filename);
    return data;
  }

  buildCompleteScanExport(options = {}) {
    const { projectPath, steps = [], errors = [], enginesRun = steps.map((step) => step.id) } = this.lastResult || {};
    const euAiActStep = this.getCompleteStep('eu-ai-act');
    const simplebeacon = this.getCompleteStep('simplebeacon')?.report ?? null;
    const consolidation = this.getCompleteStep('consolidation')?.scan ?? null;
    const mockStep = this.getCompleteStep('mock-scan');
    const mockScan = mockStep?.report
      ? buildFictionDigestPayload(mockStep.report, {
        generatedAt: mockStep.report.generatedAt || new Date().toISOString(),
        projectPath: projectPath || mockStep.report.projectRoot
      })
      : null;
    const roadmapStep = this.getCompleteStep('roadmap');
    const roadmap = roadmapStep?.roadmap ?? roadmapStep?.data?.roadmap ?? null;
    const codebase = this.getCompleteStep('codebase')?.scan ?? null;
    const fileReduction = this.getCompleteStep('file-reduction')?.scan ?? null;
    const dataQuality = this.getCompleteStep('data-quality')?.scan ?? null;
    const cleanupStep = this.getCompleteStep('cleanup-assistant');
    const cleanupAssistant = buildCleanupBriefFromLastResult(this.lastResult, cleanupStep?.policy)
      ?? cleanupStep?.brief
      ?? null;
    const enrichedFileReduction = fileReduction?.fileReductionPlan
      ? fileReduction
      : (() => {
        const plan = resolveFileReductionPlan(fileReduction);
        return plan?.safeToDelete?.topDirectories?.length || plan?.totals?.safeToDeleteBytes
          ? { ...fileReduction, fileReductionPlan: plan }
          : fileReduction;
      })();
    const completeScanAnalysis = buildCompleteScanAnalysis({
      fileReduction: enrichedFileReduction,
      dataQuality,
      projectPath
    });

    const scanDurationMs = this.scanStartedAt ? Date.now() - this.scanStartedAt : null;

    const bundle = {
      type: 'simplebeacon-complete-scan',
      version: '1.3.0',
      generatedAt: new Date().toISOString(),
      projectPath,
      scanDurationMs,
      errors,
      enginesRun,
      analysisConfig: this.lastResult?.analysisConfig || {
        selectedEngines: this.selectedEngines,
        enginesRun
      },
      complianceNote: enginesRun.includes('eu-ai-act')
        ? 'Includes EU AI Act sprint artifacts when that engine completed successfully.'
        : 'Corporate 8-rule checklist only — EU AI Act sprint (10 rules + legal attestation) is excluded unless that engine was selected and completed.',
      summary: {
        stepCount: enginesRun.length,
        stepsCompleted: steps.length,
        enginesRun,
        scanDurationMs,
        simplebeaconGatePass: simplebeacon?.gate?.pass ?? null,
        simplebeaconIssues: simplebeacon?.issueCount ?? simplebeacon?.rawIssues?.length ?? null,
        consolidationDuplicateGroups: consolidation?.summary?.exactDuplicateGroups ?? null,
        fictionKpiHits: mockScan?.fictionIssues?.reduce((sum, i) => sum + (i.count || 1), 0) ?? null,
        roadmapFiles: roadmap?.codeAnalysis?.structure?.totalFiles ?? null,
        codebaseHealthScore: codebase?.summary?.healthScore ?? null,
        codebaseFindings: codebase?.summary?.findingsTotal ?? null,
        fileReductionFindings: fileReduction?.summary?.totalFindings ?? null,
        fileReductionReclaimableBytes: fileReduction?.summary?.reclaimableBytes ?? null,
        fileReductionSafeToDeleteBytes: fileReduction?.fileReductionPlan?.totals?.safeToDeleteBytes
          ?? fileReduction?.scanners?.['build-artifacts']?.safeToDeleteBytes
          ?? null,
        fileReductionImmediateSavingsBytes: fileReduction?.fileReductionPlan?.totals?.estimatedImmediateSavingsBytes ?? null,
        fileReductionUnusedCandidates: fileReduction?.fileReductionPlan?.unusedFiles?.candidates
          ?? fileReduction?.summary?.unusedFileCandidates
          ?? null,
        dataQualityFindings: dataQuality?.summary?.totalFindings ?? null,
        dataQualityWorkspacePackages: dataQuality?.executiveSummary?.workspace?.packageJsonFiles ?? null,
        dataQualityUnusedDependencies: dataQuality?.executiveSummary?.workspace?.unusedDependencies ?? null,
        dataQualityCredentialsNeedingReview: dataQuality?.executiveSummary?.security?.credentialsNeedingReview ?? null,
        dataQualityPiiNeedingReview: dataQuality?.executiveSummary?.security?.piiNeedingReview ?? null,
        fileReductionReviewBytes: fileReduction?.fileReductionPlan?.totals?.reviewBeforeDeleteBytes ?? null,
        cleanupSafeFiles: cleanupAssistant?.estimatedReduction?.files ?? null,
        cleanupSafeBytes: cleanupAssistant?.estimatedReduction?.bytes ?? null,
        cleanupProjectedFiles: cleanupAssistant?.projectedInventory?.totalFiles ?? null,
        llmSlopHits: simplebeacon?.llmSlopPatternHits ?? null,
        compliancePassed: this.getCompleteStep('compliance')?.checklist?.summary?.passed ?? null,
        complianceFailed: this.getCompleteStep('compliance')?.checklist?.summary?.failed ?? null,
        npmVulnerabilities: this.getCompleteStep('npm-audit')?.npmAudit?.summary?.total ?? null,
        euAiActIncluded: enginesRun.includes('eu-ai-act'),
        euAiActGatePass: euAiActStep?.sprint?.gate?.pass ?? null,
        euAiActReadinessScore: euAiActStep?.sprint?.compliance?.score ?? null,
        euAiActChecklistPassed: euAiActStep?.sprint?.compliance?.passed ?? null,
        euAiActChecklistTotal: euAiActStep?.sprint?.compliance?.total ?? null
      },
      completeScanAnalysis,
      enrichedAt: new Date().toISOString(),
      results: {
        simplebeacon,
        consolidation,
        mockScan,
        roadmap,
        codebase,
        fileReduction,
        dataQuality,
        cleanupAssistant,
        compliance: this.getCompleteStep('compliance')?.checklist ?? null,
        npmAudit: this.getCompleteStep('npm-audit')?.npmAudit ?? null,
        sprint: euAiActStep?.sprint ?? null
      }
    };

    return sanitizeCompleteScanBundle(bundle, {
      preparePlatformResultsReport,
      sanitizeConsolidationExport,
      sanitizeRoadmapExport,
      sanitizeFictionDigestExport,
      exportFilename: options.exportFilename
    });
  }

  renderResultsExportBar() {
    if (!this.lastResult) return '';
    const { kind } = this.lastResult;
    const isComplete = kind === 'complete';
    const showGotoResults = kind === 'complete' || kind === 'simplebeacon-report' || kind === 'mock-scan';
    const gotoLabel = kind === 'complete' ? 'Open Simplebeacon Results →' : 'Open in Results →';
    const extraButtons = kind === 'roadmap'
      ? '<button type="button" class="btn btn-secondary btn-sm" id="copy-roadmap-json">Copy JSON</button>'
      : '';

    return `
      <div class="scan-results-export-bar card mb-4">
        ${this.renderAuditExportCallout()}
        <div class="section-heading" style="margin-bottom: 0;">
          <span class="card-title" style="font-size: var(--font-size-sm);">Export</span>
          ${this.renderScanDownloadActions({
            isComplete,
            showGotoResults,
            gotoLabel,
            extraButtons,
            auditButtonLabel: this.getAuditExportButtonLabel()
          })}
        </div>
      </div>
    `;
  }

  getAuditExportPreview() {
    if (this.lastResult?.kind === 'eu-ai-act') {
      return { tier: 'eu-ai-act', label: 'EU AI Act readiness (reference)', exportBlocked: false };
    }
    const payload = this.buildAuditExportPayload();
    if (!this.scanExportHasPayload(payload)) return null;
    return previewAuditExportTier(payload);
  }

  getAuditExportButtonLabel() {
    return auditExportButtonLabel(this.getAuditExportPreview());
  }

  renderAuditExportCallout() {
    if (this.lastResult?.kind === 'eu-ai-act') {
      return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>Reference EU layout.</strong> PDF is built from <code>.simplebeacon/eu-ai-act-*.json</code> sprint artifacts — not the $499 pre-launch security handoff. Active offers: <a href="#/deliverables">$499 PDF</a> and agency packs.</p>`;
    }
    if (this.lastResult?.kind === 'complete' && this.hasEuAiActSprintResult()) {
      return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>EU AI Act sprint included.</strong> Use <strong>Download EU PDF</strong> for the regulatory readiness report (step 11). <strong>Download audit PDF</strong> is the corporate executive / gate handoff — not the EU layout.</p>`;
    }
    const preview = this.getAuditExportPreview();
    if (!preview || preview.exportBlocked || preview.tier === 'handoff') return '';
    const gateNote = preview.tier === 'gate-only' || preview.tier === 'codebase-only'
      ? 'Gate attestation is not combined with codebase in this export.'
      : 'This PDF covers this step only — gate attestation is not included unless you run Simplebeacon gate or Complete scan.';
    const missing = preview.tier === 'gate-only' || preview.tier === 'codebase-only'
      ? 'For vendor handoff, also export the complementary gate or codebase PDF, or run Complete scan.'
      : 'For vendor handoff, run Analyze → Complete (all steps).';
    return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>Supplementary deliverable (${escapeHtml(preview.label)}).</strong> ${escapeHtml(gateNote)} ${escapeHtml(missing)}</p>`;
  }

  wrapAnalyzeResults(content) {
    return `${this.renderResultsExportBar()}${content || ''}`;
  }

  renderScanDownloadActions({
    isComplete = false,
    showGotoResults = false,
    gotoLabel = 'Open Simplebeacon Results →',
    extraButtons = '',
    auditButtonLabel = 'Download audit PDF'
  } = {}) {
    const locked = this.isResultsLocked();
    const checkoutUrl = this.app.billingService?.getAuditCheckoutUrl?.() || null;
    const priceLabel = this.app.billingService?.plan?.auditPriceLabel || '$499';
    const downloadLabel = isComplete ? 'Download all results' : 'Download result';
    const showEuPdf = this.hasEuAiActSprintResult();
    const zipMeta = isComplete ? this.resolveZipExportButtonMeta() : null;

    return `
      <div class="roadmap-result-actions">
        <button type="button" class="btn btn-primary btn-sm" id="download-scan-result">${downloadLabel}</button>
        ${isComplete
          ? `<button type="button" class="btn btn-secondary btn-sm" id="download-export-bundle-zip" title="${escapeHtml(zipMeta?.title || 'ZIP with step JSON plus audit PDF sources')}">${escapeHtml(zipMeta?.label || 'Download all reports (ZIP)')}</button>`
          : ''}
        ${showEuPdf && !locked
          ? `<button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf" title="EU AI Act readiness HTML — Print → Save as PDF">Download EU PDF</button>`
          : ''}
        ${locked
          ? `<a class="btn btn-accent btn-sm cta-pay-button" href="${escapeHtml(checkoutUrl || '#')}" target="_blank" rel="noopener noreferrer">Unlock audit PDF (${escapeHtml(priceLabel)})</a>`
          : `<button type="button" class="btn btn-accent btn-sm" id="download-audit-pdf" title="Professional audit PDF — print to save">${escapeHtml(auditButtonLabel)}</button>`}
        ${showGotoResults
          ? `<button type="button" class="btn btn-secondary btn-sm" id="goto-results-btn">${escapeHtml(gotoLabel)}</button>`
          : ''}
        ${extraButtons}
      </div>
    `;
  }

  resolveScanExportFilename() {
    const slug = pathToFileSlug(this.lastResult?.projectPath);
    const kind = this.lastResult?.kind || 'scan';
    const stamp = dateStamp();
    if (kind === 'complete') return `complete-scan-${slug}-${stamp}.json`;
    if (kind === 'cleanup-assistant') return `cleanup-export-${slug}-${stamp}.json`;
    if (kind === 'mock-scan') return `fiction-digest-${slug}-${stamp}.json`;
    if (kind === 'simplebeacon-report') return `simplebeacon-${slug}-${stamp}.json`;
    if (kind === 'roadmap') return `${slug || 'roadmap'}-${stamp}.json`;
    return `${kind}-${slug}-${stamp}.json`;
  }

  buildScanResultExport() {
    if (this.lastResult?.kind === 'complete') {
      const exportFilename = this.resolveScanExportFilename();
      return this.buildCompleteScanExport({ exportFilename });
    }

    const { kind, projectPath, report, scan, data, _brief, fileReduction, dataQuality, profile, policy } = this.lastResult || {};
    const generatedAt = new Date().toISOString();
    const scanDurationMs = this.scanStartedAt ? Date.now() - this.scanStartedAt : null;

    switch (kind) {
      case 'simplebeacon-report':
        return report ? this.prepareReportForResults(report) : null;
      case 'mock-scan':
        return report
          ? buildFictionDigestPayload(report, {
            generatedAt: report.generatedAt || generatedAt,
            projectPath: this.lastResult?.projectPath || report.projectRoot
          })
          : null;
      case 'consolidation':
      case 'codebase':
        return scan || null;
      case 'file-reduction':
      case 'data-quality':
        return scan
          ? { ...scan, scanProfile: profile || kind }
          : null;
      case 'cleanup-assistant': {
        const rebuiltBrief = buildCleanupBriefFromLastResult(this.lastResult, policy);
        if (!rebuiltBrief) return null;
        return {
          type: 'simplebeacon-cleanup-export',
          version: '1.0.0',
          generatedAt,
          projectPath,
          scanDurationMs,
          brief: rebuiltBrief,
          fileReduction,
          dataQuality,
          repositoryInventory: this.lastResult.repositoryInventory || null,
          policy: policy || null
        };
      }
      case 'roadmap':
        return data?.roadmap || null;
      case 'compliance': {
        const npmAudit = this.lastResult?.kind === 'complete'
          ? this.getCompleteStep('npm-audit')?.npmAudit
          : this.lastResult?.npmAudit;
        if (this.lastResult?.complianceExport) {
          return {
            ...this.lastResult.complianceExport,
            generatedAt,
            scanDurationMs
          };
        }
        return this.lastResult?.checklist
          ? sanitizeComplianceBundleExport({
            type: 'simplebeacon-compliance-checklist',
            generatedAt,
            projectPath,
            scanDurationMs,
            gateReport: report || null,
            checklist: this.lastResult.checklist,
            npmAudit: npmAudit || null
          })
          : null;
      }
      case 'npm-audit':
        return this.lastResult?.npmAudit
          ? sanitizeNpmAuditExport({
            type: 'simplebeacon-npm-audit',
            generatedAt,
            projectPath,
            scanDurationMs,
            ...this.lastResult.npmAudit
          }, projectPath)
          : null;
      case 'eu-ai-act':
        return this.lastResult?.sprint
          ? {
            type: 'simplebeacon-eu-ai-act-sprint',
            generatedAt,
            projectPath,
            scanDurationMs,
            sprint: this.lastResult.sprint
          }
          : null;
      default:
        return this.lastResult || null;
    }
  }

  buildAuditExportPayload() {
    if (this.lastResult?.kind === 'complete') {
      const exportFilename = this.resolveScanExportFilename();
      return this.buildCompleteScanExport({ exportFilename });
    }

    const { kind, projectPath, report, scan, data, fileReduction, dataQuality } = this.lastResult || {};
    const results = {
      simplebeacon: null,
      consolidation: null,
      mockScan: null,
      roadmap: null,
      codebase: null,
      fileReduction: null,
      dataQuality: null,
      cleanupAssistant: null
    };

    switch (kind) {
      case 'simplebeacon-report':
        results.simplebeacon = report || null;
        break;
      case 'mock-scan':
        results.simplebeacon = report || null;
        results.mockScan = report
          ? buildFictionDigestPayload(report, { generatedAt: report.generatedAt || new Date().toISOString() })
          : null;
        break;
      case 'consolidation':
        results.consolidation = scan || null;
        break;
      case 'codebase':
        results.codebase = scan || null;
        break;
      case 'file-reduction':
        results.fileReduction = scan || null;
        break;
      case 'data-quality':
        results.dataQuality = scan || null;
        break;
      case 'cleanup-assistant': {
        const rebuiltBrief = buildCleanupBriefFromLastResult(this.lastResult, this.lastResult?.policy || loadCleanupPolicy());
        results.cleanupAssistant = rebuiltBrief ?? this.lastResult?.brief ?? null;
        results.fileReduction = fileReduction || null;
        results.dataQuality = dataQuality || null;
        break;
      }
      case 'roadmap':
        results.roadmap = data?.roadmap || null;
        break;
      case 'compliance':
        results.simplebeacon = report || null;
        results.compliance = this.lastResult?.checklist || null;
        break;
      case 'npm-audit':
        results.npmAudit = this.lastResult?.npmAudit || null;
        break;
      case 'eu-ai-act': {
        const sprint = this.lastResult?.sprint || {};
        results.simplebeacon = sprint.report || null;
        results.compliance = sprint.complianceChecklist || null;
        break;
      }
      default:
        break;
    }

    const completeScanAnalysis = buildCompleteScanAnalysis({
      fileReduction: results.fileReduction,
      dataQuality: results.dataQuality,
      projectPath
    });

    const payload = {
      type: 'simplebeacon-complete-scan',
      version: '1.3.0',
      generatedAt: new Date().toISOString(),
      projectPath,
      scanDurationMs: this.scanStartedAt ? Date.now() - this.scanStartedAt : null,
      errors: [],
      summary: {
        scanKind: kind,
        simplebeaconGatePass: results.simplebeacon?.gate?.pass ?? null,
        simplebeaconIssues: results.simplebeacon?.issueCount ?? results.simplebeacon?.rawIssues?.length ?? null,
        consolidationDuplicateGroups: results.consolidation?.summary?.exactDuplicateGroups ?? null,
        fictionKpiHits: results.mockScan?.fictionIssues?.reduce((sum, i) => sum + (i.count || 1), 0) ?? null,
        roadmapFiles: results.roadmap?.codeAnalysis?.structure?.totalFiles ?? null,
        codebaseHealthScore: results.codebase?.summary?.healthScore ?? null,
        codebaseFindings: results.codebase?.summary?.findingsTotal ?? null,
        fileReductionFindings: results.fileReduction?.summary?.totalFindings ?? null,
        fileReductionReclaimableBytes: results.fileReduction?.summary?.reclaimableBytes ?? null,
        dataQualityFindings: results.dataQuality?.summary?.totalFindings ?? null
      },
      completeScanAnalysis,
      enrichedAt: new Date().toISOString(),
      results
    };

    if (this.scanExportHasPayload(payload)) return payload;

    const fallbackReport = this.resolveGateReportForExport();
    if (fallbackReport) {
      return this.buildGateOnlyAuditPayload(fallbackReport, {
        projectPath: projectPath || fallbackReport.projectRoot,
        scanKind: kind || 'simplebeacon-report',
        compliance: results.compliance
      });
    }

    return payload;
  }

  resolveGateReportForExport() {
    const sprint = this.lastResult?.sprint;
    if (sprint?.report) return sprint.report;
    if (this.lastResult?.report) return this.lastResult.report;
    if (this.lastResult?.kind === 'simplebeacon-report') {
      return this.lastResult.report ?? null;
    }
    if (this.lastResult?.kind === 'complete') {
      return this.getCompleteStep('simplebeacon')?.report ?? null;
    }
    return this.app.scanService?.report || this.app.state?.report || null;
  }

  buildGateOnlyAuditPayload(report, { projectPath, scanKind = 'simplebeacon-report', compliance = null } = {}) {
    if (!report || typeof report !== 'object') return null;
    const results = {
      simplebeacon: report,
      consolidation: null,
      mockScan: null,
      roadmap: null,
      codebase: null,
      fileReduction: null,
      dataQuality: null,
      cleanupAssistant: null,
      compliance: compliance || null
    };
    return {
      type: 'simplebeacon-complete-scan',
      version: '1.3.0',
      generatedAt: report.generatedAt || new Date().toISOString(),
      projectPath: projectPath || report.projectRoot || null,
      scanDurationMs: this.scanStartedAt ? Date.now() - this.scanStartedAt : null,
      errors: [],
      summary: {
        scanKind,
        simplebeaconGatePass: report.gate?.pass ?? null,
        simplebeaconIssues: report.issueCount ?? report.rawIssues?.length ?? null
      },
      completeScanAnalysis: buildCompleteScanAnalysis({ projectPath: projectPath || report.projectRoot }),
      enrichedAt: new Date().toISOString(),
      results
    };
  }

  async ensureAuditExportPayload() {
    let payload = this.buildAuditExportPayload();
    if (this.scanExportHasPayload(payload)) return payload;

    try {
      const projectPath = this.getActiveProjectPath() || this.lastResult?.projectPath || null;
      const report = await this.app.scanService.fetchReport(projectPath || undefined);
      payload = this.buildGateOnlyAuditPayload(report, {
        projectPath: projectPath || report?.projectRoot || this.lastResult?.projectPath,
        scanKind: this.lastResult?.kind || 'simplebeacon-report'
      });
    } catch {
      /* ignore */
    }

    return payload;
  }

  scanExportHasPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.results) {
      return Object.values(payload.results).some(Boolean);
    }
    return Object.keys(payload).length > 0;
  }

  applyReport(report, label, options = {}) {
    this.app.state.report = report;
    this.app.scanService.report = report;
    this.lastResult = {
      kind: 'simplebeacon-report',
      report,
      label,
      conclusion: options.conclusion || buildScanConclusion(report)
    };
    this.app.state.analyzeResult = this.lastResult;
    showToast(label, 'success');
    if (!options.skipRefresh) {
      this.refresh();
    }
  }

  resolveResultsReport() {
    if (this.lastResult?.kind === 'complete') {
      return this.getCompleteStep('simplebeacon')?.report ?? this.app.state.report;
    }
    if (this.lastResult?.report) {
      return this.lastResult.report;
    }
    if (this.lastResult?.kind === 'simplebeacon-report') {
      return this.lastResult.report ?? this.app.state.report;
    }
    return this.app.state.report;
  }

  buildAnalyzerSuiteContext() {
    const report = this.resolveResultsReport();
    const lr = this.lastResult || {};
    const scan = lr.scan || this.getCompleteStep('codebase')?.scan || this.getCompleteStep('consolidation')?.scan;
    const rawIssues = (report?.rawIssues ?? report?.detectedIssues ?? []).slice(0, 50);
    const aiSummary = String(
      report?.aiSummary
      || scan?.aiSummary
      || lr.conclusion
      || report?.summary?.headline
      || ''
    ).trim();
    const backlogSnippet = rawIssues
      .slice(0, 8)
      .map((issue) => String(issue.description || issue.message || issue.type || '').trim())
      .filter(Boolean)
      .join('. ');
    const codeFindings = (scan?.findings || [])
      .filter((finding) => finding?.snippet || finding?.message || finding?.path)
      .slice(0, 6);
    const codeText = [
      lr.uploadedCodeText,
      ...codeFindings.map((finding) => String(finding.snippet || finding.message || finding.path || ''))
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join('\n');
    const logLines = rawIssues
      .map((issue) => `${issue.severity || 'info'} ${issue.type || 'issue'}: ${issue.description || issue.message || ''}`)
      .filter(Boolean);
    if (scan?.eslintSummary?.totalIssues) {
      logLines.push(`ESLint total issues: ${scan.eslintSummary.totalIssues}`);
    }
    const logs = logLines.join('\n');
    const fileReduction = lr.fileReduction || this.getCompleteStep('file-reduction')?.scan || null;
    const dataQuality = lr.dataQuality || this.getCompleteStep('data-quality')?.scan || null;
    const scalabilityNotes = [];
    if (fileReduction?.durationMs) {
      scalabilityNotes.push(
        `File reduction dry-run benchmark completed in ${fileReduction.durationMs}ms across ${fileReduction.inventory?.totalFiles ?? 'unknown'} files.`
      );
    }
    if (dataQuality?.durationMs) {
      scalabilityNotes.push(`Data quality scan completed in ${dataQuality.durationMs}ms.`);
    }
    if (fileReduction?.cacheHit || dataQuality?.cacheHit) {
      scalabilityNotes.push('Repeat cleanup scans served from caching layer.');
    }
    scalabilityNotes.push('Dashboard data-cleanup API uses TTL caching for repeat scan profiles.');

    const responseText = [
      aiSummary || backlogSnippet,
      ...scalabilityNotes,
      String(lr.conclusion || '').trim()
    ].filter(Boolean).join(' ');

    const metrics = {
      ...(scan?.summary?.throughputRps ? { throughputRps: scan.summary.throughputRps } : {}),
      ...(scan?.summary?.p95LatencyMs ? { p95LatencyMs: scan.summary.p95LatencyMs } : {}),
      ...(fileReduction?.durationMs ? { scanDurationMs: fileReduction.durationMs } : {}),
      ...(dataQuality?.durationMs ? { dataQualityScanDurationMs: dataQuality.durationMs } : {})
    };

    return {
      inputKind: 'scan-report',
      scanReportContext: true,
      report,
      healthScore: report?.qualityScore,
      scannedAt: report?.generatedAt,
      responseText,
      aiSummary,
      backlogSnippet,
      conclusion: String(lr.conclusion || '').trim(),
      scanSummary: String(report?.summary?.headline || '').trim(),
      prompt: String(lr.prompt || report?.prompt || '').trim(),
      codeText,
      logs,
      rawIssues,
      scanIssues: rawIssues,
      scan,
      fileReduction,
      dataQuality,
      codeUnderstanding: scan?.codeUnderstanding,
      zscriptReport: scan?.zscriptReport,
      benchmarks: lr.data?.benchmarks || report?.benchmarks,
      metrics: Object.keys(metrics).length ? metrics : undefined,
      traces: lr.traces,
      datasetSamples: lr.datasetSamples,
      errorCases: lr.errorCases,
      subgroupOutcomes: lr.subgroupOutcomes,
      claims: lr.claims
    };
  }

  prepareReportForResults(report, options = {}) {
    return preparePlatformResultsReport(
      report,
      options.projectPath || this.lastResult?.projectPath || report?.projectRoot,
      options
    );
  }

  openResultsView(params = {}) {
    const report = this.prepareReportForResults(this.resolveResultsReport());
    if (!report) {
      showToast('No Simplebeacon report available — run a scan first', 'error');
      return;
    }
    this.app.state.report = report;
    this.app.scanService.report = report;
    this.app.navigate('results', params);
  }

  renderResults() {
    if (!this.lastResult) {
      return this.renderEmptyState();
    }

    const pathInput = this._root?.querySelector('#project-path-input');
    const activePath = this.getActiveProjectPath(pathInput?.value);
    const resultReport = this.lastResult.report || { projectRoot: this.lastResult.projectPath };
    if (activePath && resultReport?.projectRoot && !reportMatchesPagePath(resultReport, activePath)) {
      return `
        <div class="empty-state card">
          <p class="text-muted" style="margin:0;">Results below are for a different folder than the path above. Run analysis again to scan <code>${escapeHtml(formatPathInputValue(activePath))}</code>.</p>
        </div>
      `;
    }

    const { kind, report, data, label, projectPath, conclusion } = this.lastResult;

    if (kind === 'complete') {
      return this.wrapAnalyzeResults(this.renderCompleteResults());
    }

    if (kind === 'mock-scan' && report) {
      const fictionCount = (this.lastResult.fictionIssues || filterIssuesByKind(report, 'fiction'))
        .reduce((sum, i) => sum + (i.count || 1), 0);
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Mock & fiction KPIs')}</h2>
          </div>
          ${this.renderScanSummary(report, conclusion || buildScanConclusion(report, { focus: 'fiction' }), 'Fiction/KPI scan — all repository JSON files (not source code)')}
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${fictionCount}</strong> fiction/KPI hits</div>
            ${report.fictionJsonFilesScanned != null ? `<div class="metric-chip" title="JSON files pattern-scanned for fictional KPIs"><strong>${formatCount(report.fictionJsonFilesScanned)}</strong> JSON scanned</div>` : ''}
            ${report.fictionSampleFilesScanned != null ? `<div class="metric-chip"><strong>${formatCount(report.fictionSampleFilesScanned)}</strong> *-sample.json</div>` : ''}
            ${this.renderScanFileMetrics(report)}
            <div class="metric-chip gate-badge ${report.gate?.pass ? 'pass' : 'warn'}">${report.gate?.pass ? 'PASS' : 'REVIEW'}</div>
          </div>
          <div id="inline-issue-list"></div>
        </div>
      `);
    }

    if (kind === 'simplebeacon-report' || isSimplebeaconReport(report)) {
      const r = report || this.lastResult.report;
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Scan results')}</h2>
          </div>
          ${this.renderScanScopeBanner(r, projectPath)}
          ${this.renderScanSummary(r, conclusion || buildScanConclusion(r))}
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${r.qualityScore ?? '—'}%</strong> quality</div>
            ${this.renderScanFileMetrics(r)}
            <div class="metric-chip gate-badge ${r.gate?.pass ? 'pass' : 'warn'}">${r.gate?.pass ? 'PASS' : 'REVIEW'}</div>
          </div>
          <div id="inline-issue-list"></div>
          ${this.renderCertificateExportPanel(r, projectPath)}
        </div>
      `);
    }

    if (kind === 'consolidation' && this.lastResult.scan) {
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Data consolidation')}</h2>
          </div>
          ${renderConsolidationPanel({ scan: this.lastResult.scan })}
          ${this.renderScanSummary(this.lastResult.scan, buildConsolidationConclusion(this.lastResult.scan), 'Data consolidation — not a compliance gate')}
        </div>
      `);
    }

    if ((kind === 'file-reduction' || kind === 'data-quality') && this.lastResult.scan) {
      const title = kind === 'file-reduction' ? 'File reduction' : 'Data quality';
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || title)}</h2>
          </div>
          ${renderDataCleanupPanel({ scan: this.lastResult.scan, profile: this.lastResult.profile || kind })}
          ${this.renderScanSummary(
            this.lastResult.scan,
            conclusion || buildDataCleanupConclusion(this.lastResult.scan, kind),
            `${title} — dry-run scanners, not a compliance gate`
          )}
        </div>
      `);
    }

    if (kind === 'cleanup-assistant' && this.lastResult.brief) {
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Cleanup assistant')}</h2>
          </div>
          ${renderCleanupAssistantPanel(this.lastResult.brief, { policy: this.lastResult.policy || loadCleanupPolicy() })}
          ${renderDataCleanupPanel({ scan: this.lastResult.fileReduction, profile: 'file-reduction' })}
          ${this.renderScanSummary(
            this.lastResult.fileReduction,
            conclusion || this.lastResult.conclusion,
            'Cleanup assistant — phase 1 deletes safe directories only; attach JSON for Cursor agent mode'
          )}
        </div>
      `);
    }

    if (kind === 'codebase' && this.lastResult.scan) {
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Codebase analysis')}</h2>
          </div>
          ${renderCodebasePanel({ scan: this.lastResult.scan })}
          ${this.renderCodeInsightsPanels(this.lastResult.scan)}
          ${this.renderScanSummary(
            this.lastResult.scan,
            conclusion || buildCodebaseConclusion(this.lastResult.scan),
            'Codebase analysis — technical debt, broken files, placeholders'
          )}
        </div>
      `);
    }

    if (kind === 'compliance' && this.lastResult.checklist) {
      const r = this.lastResult.report;
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Compliance checklist')}</h2>
          </div>
          <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">
            Evaluated against the Simplebeacon gate report for this path. Gate:
            <strong>${r?.gate?.pass ? 'PASS' : 'REVIEW'}</strong>
            · ${r?.issueCount ?? 0} issue groups
          </p>
          ${renderComplianceChecklistPanel(this.lastResult.checklist)}
          ${r ? this.renderCertificateExportPanel(r, projectPath) : ''}
        </div>
      `);
    }

    if (kind === 'npm-audit' && this.lastResult.npmAudit) {
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'npm audit')}</h2>
          </div>
          <p class="text-muted mb-4" style="font-size: var(--font-size-sm);">
            Live <code>npm audit --json</code> for <code>${escapeHtml(formatPathInputValue(projectPath || ''))}</code> on the dashboard server.
          </p>
          ${renderNpmAuditPanel(this.lastResult.npmAudit)}
          ${this.renderScanSummary(
            this.lastResult.npmAudit,
            conclusion || this.lastResult.conclusion,
            'Supply-chain audit — not a Simplebeacon gate substitute'
          )}
        </div>
      `);
    }

    if (kind === 'eu-ai-act' && this.lastResult.sprint) {
      const s = this.lastResult.sprint;
      return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'EU AI Act sprint')}</h2>
          </div>
          ${renderEuAiActSprintPanel(s, { downloadButtonId: 'download-eu-compliance-json' })}
          ${this.renderScanSummary(s, conclusion || this.lastResult.conclusion, 'EU AI Act sprint — eu-ai-act CLI profile')}
        </div>
      `);
    }

    if (kind === 'roadmap' && data?.roadmap) {
      const roadmap = data.roadmap;
      const phases = roadmap.developmentPhases || roadmap.phases || roadmap.sprintPhases || [];
      const summary = roadmap.executiveSummary || roadmap.projectOverview || {};
      const jsonPretty = JSON.stringify(roadmap, null, 2);
      return this.wrapAnalyzeResults(`
        <div class="card mb-4">
          <div class="card-header roadmap-result-header">
            <span class="card-title">Roadmap — ${escapeHtml(formatPathLabel(projectPath) || roadmap.projectName || '')}</span>
          </div>
          ${this.renderRoadmapProvenance(roadmap)}
          ${this.renderStrategicInsightsPanel(roadmap.strategicInsights)}
          <p class="mb-4 text-muted">${escapeHtml(roadmap.executiveSummary?.notes || roadmap.summary || roadmap.title || 'Generated from filesystem scan')}</p>
          ${roadmap.platformRoot && roadmap.sourceProjectPath && roadmap.platformRoot !== roadmap.sourceProjectPath ? `
            <p class="roadmap-path-hint mb-4 text-muted">
              Scanned <code>${escapeHtml(formatPathInputValue(roadmap.sourceProjectPath))}</code> —
              sprint metrics use platform root <code>${escapeHtml(formatPathInputValue(roadmap.platformRoot))}</code>.
              For a tighter scan, set the path to the platform folder.
            </p>
          ` : ''}
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${summary.totalFeatures ?? '—'}</strong> sprints</div>
            <div class="metric-chip"><strong>${summary.completionRate ?? '—'}%</strong> complete</div>
            <div class="metric-chip"><strong>${escapeHtml(summary.projectHealth || '—')}</strong> health</div>
            <div class="metric-chip"><strong>${roadmap.codeAnalysis?.structure?.totalFiles ?? '—'}</strong> files scanned</div>
          </div>
          ${phases.length ? `
            <h3 class="card-subtitle">Development phases</h3>
            <ul class="roadmap-phase-list mb-4">
              ${phases.map((p) => `
                <li>
                  <strong>${escapeHtml(p.phase || p.name || p.title || 'Phase')}</strong>
                  <span class="text-muted"> — ${escapeHtml(p.status || '')}${p.progress != null ? ` (${p.progress}%)` : ''}</span>
                  ${p.description ? `<div class="text-muted" style="font-size:var(--font-size-sm);margin-top:var(--space-1)">${escapeHtml(p.description)}</div>` : ''}
                </li>
              `).join('')}
            </ul>
          ` : ''}
          <details class="roadmap-json-details" open>
            <summary>Full roadmap JSON (${jsonPretty.length.toLocaleString()} characters)</summary>
            <pre class="audit-log roadmap-json-full">${escapeHtml(jsonPretty)}</pre>
          </details>
        </div>
      `);
    }

    return this.wrapAnalyzeResults(`<pre class="audit-log card">${escapeHtml(JSON.stringify(this.lastResult, null, 2))}</pre>`);
  }

  isResultsLocked() {
    return isDeliverableLocked(this.app.state.entitlements, this.lastResult);
  }

  renderCertificateExportPanel(report) {
    if (!report) return '';
    const slopHits = report.llmSlopPatternHits ?? report.scanScope?.llmSlopPatternHits ?? 0;
    return `
      <div class="card mb-6" id="certificate-export-panel">
        <div class="card-header">
          <span class="card-title">Code Hygiene Certificate</span>
        </div>
        <p class="text-muted" style="font-size: var(--font-size-sm);">
          Co-branded client deliverable for agency milestone handoffs. Uses the Simplebeacon gate report above
          ${slopHits ? `(includes <strong>${slopHits}</strong> LLM slop pattern hit${slopHits === 1 ? '' : 's'})` : ''}.
        </p>
        <div class="analyze-action-row" style="flex-wrap: wrap; gap: var(--space-3); align-items: flex-end;">
          <label class="audit-booking-field" style="min-width: 140px;">
            <span>Milestone</span>
            <select id="certificate-milestone-select" class="analyze-select">
              ${['alpha', 'beta', 'release', 'hotfix', 'warranty'].map((m) => `
                <option value="${m}" ${this.certificateMilestone === m ? 'selected' : ''}>${m}</option>
              `).join('')}
            </select>
          </label>
          <label class="audit-booking-field" style="min-width: 180px;">
            <span>Client name</span>
            <input type="text" id="certificate-client-name" class="analyze-path-input" value="${escapeHtml(this.certificateClientName)}" placeholder="Northwind Retail">
          </label>
          <label class="audit-booking-field" style="min-width: 180px;">
            <span>Project name</span>
            <input type="text" id="certificate-project-name" class="analyze-path-input" value="${escapeHtml(this.certificateProjectName)}" placeholder="Customer Portal Rebuild">
          </label>
          <label class="audit-booking-field" style="min-width: 160px;">
            <span>Project pack ID</span>
            <input type="text" id="certificate-project-id" class="analyze-path-input" value="${escapeHtml(this.certificateProjectId)}" placeholder="proj_…">
          </label>
          <button type="button" class="btn btn-primary" id="export-certificate-btn" ${this.certificateExportBusy ? 'disabled' : ''}>
            ${this.certificateExportBusy ? 'Generating…' : 'Generate certificate'}
          </button>
        </div>
        <p class="text-muted" style="font-size: var(--font-size-xs); margin-top: var(--space-2);">
          Branding: <code>PUT /api/simplebeacon/agency/branding</code> · Optional project pack token burn when <code>project_id</code> is set.
        </p>
      </div>
    `;
  }

  renderCompleteResults() {
    const { projectPath, steps = [], errors = [] } = this.lastResult;
    const simplebeacon = steps.find((s) => s.id === 'simplebeacon')?.report;
    const consolidation = steps.find((s) => s.id === 'consolidation')?.scan;
    const mockScan = steps.find((s) => s.id === 'mock-scan');
    const roadmapStep = steps.find((s) => s.id === 'roadmap');
    const roadmap = roadmapStep?.roadmap || roadmapStep?.data?.roadmap;
    const codebaseStep = steps.find((s) => s.id === 'codebase');
    const codebase = codebaseStep?.scan;
    const fileReduction = steps.find((s) => s.id === 'file-reduction')?.scan;
    const dataQuality = steps.find((s) => s.id === 'data-quality')?.scan;
    const cleanupStep = steps.find((s) => s.id === 'cleanup-assistant');
    const cleanupBrief = cleanupStep?.brief ?? null;
    const complianceStep = steps.find((s) => s.id === 'compliance');
    const complianceChecklist = complianceStep?.checklist ?? null;
    const npmAuditStep = steps.find((s) => s.id === 'npm-audit');
    const npmAudit = npmAuditStep?.npmAudit ?? null;
    const euAiActStep = steps.find((s) => s.id === 'eu-ai-act');
    const euSprint = euAiActStep?.sprint ?? null;
    const { enginesRun, planned: stepTotal, succeeded: succeededCount, failed: failedCount } =
      resolveCompleteScanCounts(this.lastResult);

    const completeScanAnalysis = buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath });

    const stepOk = (id) => steps.some((s) => s.id === id);
    const stepFailureMessage = (id, labelHint) => {
      const progressErr = this.completeProgress?.steps?.find((s) => s.id === id)?.error;
      if (progressErr) return progressErr;
      const match = errors.find((e) => e.step?.includes(labelHint));
      return match?.message || '';
    };
    const renderStepFailure = (id, labelHint) => {
      const message = stepFailureMessage(id, labelHint);
      if (message) {
        return `<p class="text-muted mt-4" style="color: var(--warning-color, #f59e0b);">${escapeHtml(message)}</p>`;
      }
      return '<p class="text-muted mt-4">Step did not complete.</p>';
    };

    const locked = this.isResultsLocked();
    const checkoutUrl = this.app.billingService?.getAuditCheckoutUrl?.() || null;
    const priceLabel = this.app.billingService?.plan?.auditPriceLabel || '$499';

    return `
      <div class="section-block">
        <div class="section-heading">
          <h2>Complete scan — ${escapeHtml(formatPathLabel(projectPath) || '')}</h2>
        </div>
        ${errors.length ? `
          <div class="card mb-4" style="border-color: var(--warning);">
            <p class="text-muted" style="font-size: var(--font-size-sm); margin:0;">
              ${errors.map((e) => `<strong>${escapeHtml(e.step)}:</strong> ${escapeHtml(e.message)}`).join('<br>')}
            </p>
          </div>
        ` : ''}
        <div class="metrics-row mb-6">
          <div class="metric-chip"><strong>${stepTotal}</strong> analyses</div>
          <div class="metric-chip"><strong>${succeededCount}</strong> succeeded</div>
          ${failedCount ? `<div class="metric-chip gate-badge warn"><strong>${failedCount}</strong> failed/skipped</div>` : ''}
          <div class="metric-chip gate-badge ${simplebeacon?.gate?.pass ? 'pass' : 'warn'}">${simplebeacon?.gate?.pass ? 'GATE PASS' : 'GATE REVIEW'}</div>
          ${simplebeacon?.gate?.pass && codebase?.summary?.codeFilesAnalyzed
            ? '<div class="metric-chip gate-badge pass">READY FOR SIGN-OFF</div>'
            : ''}
          <div class="metric-chip"><strong>${codebase?.summary?.codeFilesAnalyzed ?? '—'}/${codebase?.summary?.codeFilesDiscovered ?? '—'}</strong> code files</div>
          <div class="metric-chip"><strong>${codebase?.summary?.healthScore ?? '—'}%</strong> code health</div>
          <div class="metric-chip"><strong>${consolidation?.summary?.exactDuplicateGroups ?? '—'}</strong> dup groups</div>
          <div class="metric-chip"><strong>${fileReduction?.fileReductionPlan?.totals?.estimatedImmediateSavingsBytes != null ? formatCompleteScanBytes(fileReduction.fileReductionPlan.totals.estimatedImmediateSavingsBytes) : formatCount(fileReduction?.summary?.totalFindings)}</strong> ${fileReduction?.fileReductionPlan ? 'immediate savings' : 'file reduction'}</div>
          <div class="metric-chip"><strong>${formatCount(dataQuality?.executiveSummary?.security?.piiNeedingReview ?? dataQuality?.summary?.totalFindings)}</strong> ${dataQuality?.executiveSummary ? 'PII review' : 'data quality'}</div>
          ${cleanupBrief ? `<div class="metric-chip"><strong>${formatCount(cleanupBrief.estimatedReduction?.files)}</strong> safe cleanup files</div>` : ''}
          ${complianceChecklist?.summary ? `<div class="metric-chip gate-badge ${complianceChecklist.summary.failed ? 'warn' : 'pass'}">${complianceChecklist.summary.passed ?? 0}/${checklistRuleTotal(complianceChecklist)} compliance</div>` : ''}
          ${npmAudit && !npmAudit.error ? `<div class="metric-chip"><strong>${npmAudit.summary?.total ?? npmAudit.vulnerabilityTotal ?? 0}</strong> npm vulns</div>` : ''}
          ${euSprint ? `<div class="metric-chip gate-badge ${euSprint.gate?.pass ? 'pass' : 'warn'}">EU ${euSprint.compliance?.score ?? '—'}% readiness</div>` : ''}
        </div>

        ${renderCompleteScanAnalysisPanel(completeScanAnalysis)}

        ${!locked && simplebeacon ? this.renderCertificateExportPanel(simplebeacon, projectPath) : ''}

        ${locked ? renderScanPaywall(
          this.lastResult.publicSummary || buildPublicSummaryFromScan(this.lastResult),
          { checkoutUrl, auditPriceLabel: priceLabel }
        ) : `
        <details class="card mb-4" open>
          <summary><strong>1. Simplebeacon</strong> ${stepOk('simplebeacon') ? '✅' : '⚠️'}</summary>
          ${simplebeacon ? `
            ${this.renderScanScopeBanner(simplebeacon, projectPath)}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${simplebeacon.qualityScore ?? '—'}%</strong> quality</div>
              ${this.renderScanFileMetrics(simplebeacon)}
              <div class="metric-chip"><strong>${simplebeacon.issueCount ?? 0}</strong> issues</div>
              ${simplebeacon.llmSlopPatternHits != null ? `<div class="metric-chip"><strong>${simplebeacon.llmSlopPatternHits}</strong> LLM slop hits</div>` : ''}
            </div>
            ${(getScanFileMetrics(simplebeacon).mockSampleFiles ?? 0) === 0 ? `
              <p class="text-muted text-sm mb-4">
                No mock/sample files found. Try scanning <code>…\\ai-platform</code> or add
                <code>.simplebeacon/config.json</code> with <code>scanPaths</code> for this project.
              </p>
            ` : ''}
            ${this.renderScanSummary(simplebeacon, buildScanConclusion(simplebeacon))}
            <button type="button" class="btn btn-secondary btn-sm mb-4" id="download-simplebeacon-json">Download Simplebeacon JSON</button>
            <div id="inline-issue-list"></div>
          ` : '<p class="text-muted mt-4">Step did not complete.</p>'}
        </details>

        <details class="card mb-4" open>
          <summary><strong>2. Data consolidation</strong> ${stepOk('consolidation') ? '✅' : '⚠️'}</summary>
          <div class="mt-4">
            ${consolidation ? `
              <button type="button" class="btn btn-secondary btn-sm mb-4" id="download-consolidation-json">Download consolidation JSON</button>
              ${renderConsolidationPanel({ scan: consolidation })}
              ${this.renderScanSummary(consolidation, buildConsolidationConclusion(consolidation), 'Data consolidation — not a compliance gate')}
            ` : '<p class="text-muted">Step did not complete.</p>'}
          </div>
        </details>

        <details class="card mb-4">
          <summary><strong>3. Fiction & KPI digest</strong> ${stepOk('mock-scan') ? '✅' : '⚠️'}</summary>
          ${mockScan?.report ? `
            ${this.renderConclusionBanner(
              mockScan.conclusion || buildScanConclusion(mockScan.report, { focus: 'fiction' }),
              mockScan.report.fictionScope === 'repository-json'
                ? `Derived from step 1 — ${formatCount(mockScan.report.fictionJsonFilesScanned ?? mockScan.report.consistencyChecked ?? '—')} repository JSON files fiction-scanned`
                : 'Derived from step 1 Simplebeacon scan — *-sample.json only'
            )}
            ${(mockScan.nonFictionIssues || []).length ? `
              <p class="text-muted text-sm mb-4">
                ${formatCount((mockScan.nonFictionIssues || []).reduce((s, i) => s + (i.count || 1), 0))} non-fiction gate finding(s) in step 1
                (${(mockScan.nonFictionIssues || []).map((i) => i.type).slice(0, 3).join(', ')}) — see Simplebeacon section above.
              </p>
            ` : ''}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${(mockScan.fictionIssues || []).reduce((s, i) => s + (i.count || 1), 0)}</strong> fiction/KPI hits</div>
              ${this.renderScanFileMetrics(mockScan.report)}
            </div>
            <button type="button" class="btn btn-secondary btn-sm mb-4" id="download-mock-scan-json">Download fiction digest JSON</button>
          ` : '<p class="text-muted mt-4">Step did not complete.</p>'}
        </details>

        <details class="card mb-4">
          <summary><strong>4. Roadmap</strong> ${stepOk('roadmap') ? '✅' : '⚠️'}</summary>
          ${roadmap ? `
            ${roadmapStep?.analysisPath && normalizeProjectPath(roadmapStep.analysisPath) !== normalizeProjectPath(projectPath) ? `
              <p class="text-muted text-sm mt-4 mb-0">Scoped to platform root <code>${escapeHtml(formatPathInputValue(roadmapStep.analysisPath))}</code> (monorepo parent scan).</p>
            ` : ''}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${roadmap.codeAnalysis?.structure?.totalFiles ?? '—'}</strong> files</div>
              <div class="metric-chip"><strong>${(roadmap.developmentPhases || roadmap.phases || []).length}</strong> phases</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm mb-4" id="download-roadmap-json">Download roadmap JSON</button>
            <details>
              <summary>Preview roadmap JSON</summary>
              <pre class="audit-log roadmap-json-full mt-2">${escapeHtml(JSON.stringify(roadmap, null, 2).slice(0, 12000))}${JSON.stringify(roadmap).length > 12000 ? '\n… (truncated — download for full file)' : ''}</pre>
            </details>
          ` : renderStepFailure('roadmap', 'Roadmap')}
        </details>

        <details class="card mb-4">
          <summary><strong>5. Codebase analysis</strong> ${stepOk('codebase') ? '✅' : '⚠️'}</summary>
          ${codebase ? `
            ${codebaseStep?.analysisPath && normalizeProjectPath(codebaseStep.analysisPath) !== normalizeProjectPath(projectPath) ? `
              <p class="text-muted text-sm mt-4 mb-0">Scoped to platform root <code>${escapeHtml(formatPathInputValue(codebaseStep.analysisPath))}</code> (monorepo parent scan).</p>
            ` : ''}
            <button type="button" class="btn btn-secondary btn-sm mb-4 mt-4" id="download-codebase-json">Download codebase JSON</button>
            ${renderCodebasePanel({ scan: codebase })}
            ${this.renderCodeInsightsPanels(codebase)}
            ${this.renderScanSummary(codebase, buildCodebaseConclusion(codebase), 'Codebase analysis — technical debt and broken files')}
          ` : renderStepFailure('codebase', 'Codebase')}
        </details>

        <details class="card mb-4">
          <summary><strong>6. File reduction</strong> ${stepOk('file-reduction') ? '✅' : '⚠️'}</summary>
          ${fileReduction ? `
            <button type="button" class="btn btn-secondary btn-sm mb-4 mt-4" id="download-file-reduction-json">Export report</button>
            ${renderDataCleanupPanel({ scan: fileReduction, profile: 'file-reduction' })}
            ${this.renderScanSummary(fileReduction, buildDataCleanupConclusion(fileReduction, 'file-reduction'), 'File reduction — dry-run reclaim estimate')}
          ` : renderStepFailure('file-reduction', 'File reduction')}
        </details>

        <details class="card mb-4">
          <summary><strong>7. Data quality</strong> ${stepOk('data-quality') ? '✅' : '⚠️'}</summary>
          ${dataQuality ? `
            <button type="button" class="btn btn-secondary btn-sm mb-4 mt-4" id="download-data-quality-json">Export report</button>
            ${renderDataCleanupPanel({ scan: dataQuality, profile: 'data-quality' })}
            ${this.renderScanSummary(dataQuality, buildDataCleanupConclusion(dataQuality, 'data-quality'), 'Data quality — config, privacy, lineage, shape drift')}
          ` : renderStepFailure('data-quality', 'Data quality')}
        </details>

        <details class="card mb-4">
          <summary><strong>8. Cleanup assistant</strong> ${stepOk('cleanup-assistant') ? '✅' : '⚠️'}</summary>
          ${cleanupBrief ? `
            ${renderCleanupAssistantPanel(cleanupBrief, { policy: cleanupStep?.policy || loadCleanupPolicy() })}
            ${this.renderScanSummary(
              cleanupStep?.fileReduction || fileReduction,
              `Tiered cleanup — ${Number(cleanupBrief.estimatedReduction?.files || 0).toLocaleString()} files safe now (${formatCompleteScanBytes(cleanupBrief.estimatedReduction?.bytes)}), ${Number(cleanupBrief.projectedInventory?.totalFiles || 0).toLocaleString()} projected after phase 1.`,
              'Cleanup assistant — export agent brief for Cursor; phase 1 deletes safe directories only'
            )}
          ` : renderStepFailure('cleanup-assistant', 'Cleanup assistant')}
        </details>

        <details class="card mb-4">
          <summary><strong>9. npm audit</strong> ${stepOk('npm-audit') ? '✅' : '⚠️'}</summary>
          ${npmAudit && !npmAudit.error ? renderNpmAuditPanel(npmAudit) : renderStepFailure('npm-audit', 'npm audit')}
        </details>

        <details class="card mb-4">
          <summary><strong>10. Compliance checklist</strong> ${stepOk('compliance') ? '✅' : '⚠️'} <span class="text-muted" style="font-weight:400;">(8-rule corporate — not EU 9/10 legal sprint)</span></summary>
          ${complianceChecklist ? renderComplianceChecklistPanel(complianceChecklist, { profileLabel: 'Corporate safety (8 rules)' }) : renderStepFailure('compliance', 'Compliance')}
        </details>

        ${enginesRun.includes('eu-ai-act') || stepOk('eu-ai-act') ? `
        <details class="card mb-4">
          <summary><strong>11. EU AI Act sprint</strong> ${stepOk('eu-ai-act') ? '✅' : '⚠️'} <span class="text-muted" style="font-weight:400;">(10 rules + legal attestation — optional regulatory engine)</span></summary>
          <div class="mt-4">
            ${euSprint
    ? renderEuAiActSprintPanel(euSprint, { downloadButtonId: 'download-eu-compliance-json', showActions: false })
    : renderStepFailure('eu-ai-act', 'EU AI Act')}
          </div>
        </details>
        ` : ''}
        `}
      </div>
    `;
  }

  refresh() {
    const main = document.getElementById('app-main');
    if (this.app.currentView === this) this.mount(main);
  }

  async ensureDefaultProjectPath() {
    if (this.app.state.lastProjectPath || this.app.state.defaultProjectPath) return;
    try {
      const info = await fetchAnalyzeProviders();
      if (info.defaultProjectPath) {
        this.app.state.defaultProjectPath = info.defaultProjectPath;
      }
    } catch {
      /* optional prefill */
    }
  }

  mount(container) {
    const mode = this.app.state.routeParams?.mode;
    if (mode) {
      this.analysisType = mode;
    }
    if (this.app.state.lastProjectPath && !isPlausibleProjectPath(this.app.state.lastProjectPath)) {
      this.app.state.lastProjectPath = '';
    }

    void this.ensureDefaultProjectPath();

    container.innerHTML = '';
    const view = this.render();
    container.appendChild(view);

    if (view.querySelector('#certificate-export-panel') && !this.agencyBrandingLoaded) {
      this.agencyBrandingLoaded = true;
      fetchAgencyBranding(this.certificateOrgId)
        .then((data) => {
          const branding = data?.branding;
          if (branding?.agency_name && !this.certificateClientName) {
            this.certificateClientName = branding.agency_name;
            const clientField = view.querySelector('#certificate-client-name');
            if (clientField && !clientField.value) clientField.value = branding.agency_name;
          }
        })
        .catch(() => { /* optional branding prefill */ });
    }

    view.querySelector('#goto-results-btn')?.addEventListener('click', () => {
      this.openResultsView();
    });

    view.querySelector('#goto-results-empty-btn')?.addEventListener('click', () => {
      this.openResultsView();
    });

    view.querySelector('#quick-rescan-btn')?.addEventListener('click', () => {
      const path = this.resolveProjectPath(document.getElementById('project-path-input')?.value)
        || this.app.state.defaultProjectPath;
      if (!path) {
        showToast('No project path available', 'error');
        return;
      }
      this.analysisType = 'complete';
      saveAnalyzePrefs({ analysisType: 'complete', aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
      this.runPathAnalysis(path);
    });

    const slug = pathToFileSlug(this.lastResult?.projectPath);
    const roadmap = this.lastResult?.kind === 'roadmap'
      ? this.lastResult.data?.roadmap
      : this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('roadmap')?.roadmap
          || this.getCompleteStep('roadmap')?.data?.roadmap
        : null;

    const simplebeaconReport = this.lastResult?.kind === 'complete'
      ? this.getCompleteStep('simplebeacon')?.report
      : this.lastResult?.kind === 'mock-scan'
        ? this.lastResult.report
        : this.lastResult?.report;

    view.querySelector('#download-scan-result')?.addEventListener('click', () => {
      const payload = this.buildScanResultExport();
      if (!this.scanExportHasPayload(payload)) {
        showToast('No scan results to download yet', 'error');
        return;
      }
      downloadJson(payload, this.resolveScanExportFilename());
      showToast(
        this.lastResult?.kind === 'complete' ? 'Complete scan bundle downloaded' : 'Scan result downloaded',
        'success'
      );
    });

    view.querySelector('#download-export-bundle-zip')?.addEventListener('click', async () => {
      const btn = view.querySelector('#download-export-bundle-zip');
      const priorLabel = btn?.textContent;
      if (this.lastResult?.kind !== 'complete') {
        showToast('Run Complete scan to download reports as ZIP', 'error');
        return;
      }
      const exportEngines = this.resolveExportEngineSelection(view);
      if (!exportEngines.length) {
        showToast('Check at least one completed scan in the queue to include in the ZIP', 'error');
        return;
      }
      const payload = this.buildScanResultExport();
      if (!this.scanExportHasPayload(payload)) {
        showToast('No complete scan results to export yet', 'error');
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Building ZIP…';
      }
      try {
        const internal = Boolean(this.app.billingService?.plan?.internalDashboard);
        const { blob, filename, tierId, warnings } = await fetchAnalyzeExportBundleZip(payload, {
          deliverableSku: internal ? 'operator' : undefined,
          client: formatPathLabel(payload.projectPath) || redactPathForDisplay(payload.projectPath) || undefined,
          aiProvider: this.aiProvider || 'demo',
          selectedEngines: exportEngines,
          enginesRun: exportEngines
        });
        downloadBlob(blob, filename);
        const engineNote = exportEngines.length === (this.lastResult?.steps?.length || exportEngines.length)
          ? ''
          : ` · ${exportEngines.length} scan${exportEngines.length === 1 ? '' : 's'}`;
        const warnNote = warnings.length ? ` (${warnings.length} note(s) in manifest)` : '';
        showToast(`Export bundle downloaded (${tierId || 'bundle'}${engineNote})${warnNote}`, 'success');
      } catch (err) {
        if (err.code === 'export_paywall' && err.checkoutUrl) {
          window.open(err.checkoutUrl, '_blank', 'noopener,noreferrer');
        }
        showToast(err.message || 'ZIP export failed', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = priorLabel || this.resolveZipExportButtonMeta().label;
        }
      }
    });

    view.querySelectorAll('#download-eu-ai-act-pdf').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const priorLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Building EU report…';
        try {
          const data = await this.downloadEuAiActAuditPdf();
          showToast(
            `EU compliance report saved as ${data.filename}. Open the HTML file, then Print → Save as PDF.`,
            'success'
          );
        } catch (err) {
          showToast(err.message || 'EU compliance PDF failed', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = priorLabel || 'Download EU PDF';
        }
      });
    });

    view.querySelector('#download-audit-pdf')?.addEventListener('click', async () => {
      const btn = view.querySelector('#download-audit-pdf');
      const priorLabel = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Building report…';
      }
      try {
        if (this.lastResult?.kind === 'eu-ai-act') {
          const data = await fetchEuAiActAuditReport({
            projectPath: this.lastResult.projectPath,
            client: formatPathLabel(this.lastResult.projectPath) || redactPathForDisplay(this.lastResult.projectPath) || undefined
          });
          openAuditReportPrintWindow(data.html, data.filename);
          showToast(
            `EU compliance report saved as ${data.filename}. Open the HTML file, then Print → Save as PDF.`,
            'success'
          );
          return;
        }

        const payload = await this.ensureAuditExportPayload();
        if (!this.scanExportHasPayload(payload)) {
          showToast('No scan results available for audit PDF', 'error');
          return;
        }
        const data = await fetchCompleteAuditReport(payload, {
          aiProvider: this.aiProvider || 'demo',
          client: formatPathLabel(payload.projectPath) || redactPathForDisplay(payload.projectPath) || undefined
        });
        openAuditReportPrintWindow(data.html, data.filename);
        const tierLabel = data.exportTierLabel || data.tier || 'audit';
        showToast(
          `${tierLabel} report saved to Downloads as ${data.filename}. Open the HTML file, scroll through all sections, then Print → Save as PDF.`,
          'success'
        );
      } catch (err) {
        if (err.code === 'audit_paywall' && err.checkoutUrl) {
          window.open(err.checkoutUrl, '_blank', 'noopener,noreferrer');
        }
        showToast(err.message || 'Audit PDF failed', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = priorLabel || 'Download audit PDF';
        }
      }
    });

    view.querySelector('#download-simplebeacon-json')?.addEventListener('click', () => {
      const report = this.getCompleteStep('simplebeacon')?.report;
      if (!report) {
        showToast('Simplebeacon step has no report', 'error');
        return;
      }
      const filename = `simplebeacon-${slug}-${dateStamp()}.json`;
      downloadJson(
        this.prepareReportForResults(report, {
          projectPath: this.lastResult?.projectPath || report.projectRoot,
          exportFilename: filename
        }),
        filename
      );
      showToast('Simplebeacon report downloaded', 'success');
    });

    view.querySelector('#certificate-milestone-select')?.addEventListener('change', (e) => {
      this.certificateMilestone = e.target.value;
    });
    view.querySelector('#certificate-client-name')?.addEventListener('input', (e) => {
      this.certificateClientName = e.target.value;
    });
    view.querySelector('#certificate-project-name')?.addEventListener('input', (e) => {
      this.certificateProjectName = e.target.value;
    });
    view.querySelector('#certificate-project-id')?.addEventListener('input', (e) => {
      this.certificateProjectId = e.target.value.trim();
      if (this.certificateProjectId) {
        localStorage.setItem('simplebeacon_agency_project_id', this.certificateProjectId);
      }
    });
    view.querySelector('#export-certificate-btn')?.addEventListener('click', async () => {
      const report = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('simplebeacon')?.report
        : this.lastResult?.kind === 'compliance'
          ? this.lastResult.report
          : (this.lastResult?.report || this.lastResult?.data?.report);
      if (!report) {
        showToast('Run a Simplebeacon gate scan first', 'error');
        return;
      }
      this.certificateMilestone = view.querySelector('#certificate-milestone-select')?.value || this.certificateMilestone;
      this.certificateClientName = view.querySelector('#certificate-client-name')?.value?.trim() || '';
      this.certificateProjectName = view.querySelector('#certificate-project-name')?.value?.trim() || '';
      this.certificateProjectId = view.querySelector('#certificate-project-id')?.value?.trim() || '';
      if (this.certificateProjectId) {
        localStorage.setItem('simplebeacon_agency_project_id', this.certificateProjectId);
      }
      this.certificateExportBusy = true;
      this.refresh();
      try {
        const data = await exportAgencyCertificate({
          report,
          milestone: this.certificateMilestone,
          client_name: this.certificateClientName || undefined,
          project_name: this.certificateProjectName || undefined,
          project_id: this.certificateProjectId || undefined,
          org_id: this.certificateOrgId
        });
        if (data.html) {
          const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener,noreferrer');
          showToast(`Certificate ${data.certificate_id || ''} opened — Print → Save as PDF`, 'success');
        } else {
          showToast('Certificate export returned no HTML', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Certificate export failed', 'error');
      } finally {
        this.certificateExportBusy = false;
        this.refresh();
      }
    });

    view.querySelector('#download-consolidation-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('consolidation')?.scan;
      if (!scan) {
        showToast('Consolidation step has no report', 'error');
        return;
      }
      const consolidationFilename = `consolidation-${slug}-${dateStamp()}.json`;
      downloadJson(
        sanitizeConsolidationExport(scan, {
          projectPath: this.lastResult?.projectPath || scan.projectRoot,
          exportFilename: consolidationFilename
        }),
        consolidationFilename
      );
      showToast('Consolidation report downloaded', 'success');
    });

    view.querySelector('#download-codebase-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('codebase')?.scan;
      if (!scan) {
        showToast('Codebase step has no report', 'error');
        return;
      }
      const codebaseFilename = `codebase-${slug}-${dateStamp()}.json`;
      downloadJson(
        sanitizeCodebaseReportExport(scan, {
          requestedProjectPath: this.lastResult?.projectPath,
          exportFilename: codebaseFilename
        }),
        codebaseFilename
      );
      showToast('Codebase report downloaded', 'success');
    });

    const exportBrief = () => {
      const brief = sanitizeCleanupBriefExport(
        buildCleanupBriefFromLastResult(this.lastResult, this.lastResult?.policy || loadCleanupPolicy())
      );
      if (!brief) {
        showToast('Run Cleanup assistant first', 'error');
        return;
      }
      this.lastResult.brief = brief;
      downloadJson(brief, `cleanup-brief-${slug}-${dateStamp()}.json`);
      showToast('Agent brief exported — attach in Cursor agent mode', 'success');
    };

    view.querySelector('#cleanup-brief-export-btn')?.addEventListener('click', exportBrief);

    const copyPrompt = async () => {
      const brief = buildCleanupBriefFromLastResult(this.lastResult, this.lastResult?.policy || loadCleanupPolicy())
        || this.lastResult?.brief
        || null;
      const prompt = brief?.agentPrompt;
      if (!prompt) {
        showToast('Run Cleanup assistant first', 'error');
        return;
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(prompt);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = prompt;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast('Cursor prompt copied', 'success');
      } catch {
        showToast('Could not copy prompt — use Export agent brief instead', 'error');
      }
    };

    view.querySelector('#copy-cleanup-agent-prompt')?.addEventListener('click', copyPrompt);
    view.querySelector('#cleanup-prompt-copy-btn')?.addEventListener('click', copyPrompt);

    view.querySelector('#cleanup-reapply-policy')?.addEventListener('click', () => {
      if (this.lastResult?.kind !== 'cleanup-assistant') return;
      const policy = readCleanupPolicyFromDom(view);
      saveCleanupPolicy(policy);
      this.lastResult.policy = policy;
      this.lastResult.brief = buildCleanupAssistantBrief({
        projectPath: this.lastResult.projectPath,
        fileReduction: this.lastResult.fileReduction,
        dataQuality: this.lastResult.dataQuality,
        repositoryInventory: this.lastResult.repositoryInventory,
        policy
      });
      this.lastResult.conclusion = `Tiered cleanup plan — ${Number(this.lastResult.brief.estimatedReduction.files || 0).toLocaleString()} files safe now (${formatCompleteScanBytes(this.lastResult.brief.estimatedReduction.bytes)}), ${Number(this.lastResult.brief.projectedInventory.totalFiles || 0).toLocaleString()} projected after phase 1.`;
      this.app.state.analyzeResult = this.lastResult;
      this.refresh();
      showToast('Policy applied — tiers updated', 'success');
    });

    view.querySelector('#download-file-reduction-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('file-reduction')?.scan;
      if (!scan) {
        showToast('File reduction step has no report', 'error');
        return;
      }
      downloadJson(sanitizeDataCleanupReportExport(scan), `file-reduction-${slug}-${dateStamp()}.json`);
      showToast('File reduction report exported', 'success');
    });

    view.querySelector('#download-data-quality-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('data-quality')?.scan;
      if (!scan) {
        showToast('Data quality step has no report', 'error');
        return;
      }
      downloadJson(sanitizeDataCleanupReportExport(scan), `data-quality-${slug}-${dateStamp()}.json`);
      showToast('Data quality report exported', 'success');
    });

    view.querySelector('#download-mock-scan-json')?.addEventListener('click', () => {
      const mockStep = this.getCompleteStep('mock-scan');
      const payload = mockStep?.report
        ? buildFictionDigestPayload(mockStep.report, {
          projectPath: this.lastResult?.projectPath || mockStep.report.projectRoot
        })
        : mockStep?.fictionIssues
          ? {
            type: 'simplebeacon-fiction-digest',
            generatedAt: new Date().toISOString(),
            conclusion: mockStep.conclusion,
            fictionIssues: mockStep.fictionIssues,
            nonFictionIssues: mockStep.nonFictionIssues || [],
            sourceReport: mockStep.report
          }
          : mockStep?.report ?? mockStep?.data?.report ?? mockStep?.data;
      if (!payload) {
        showToast('Fiction digest step has no report', 'error');
        return;
      }
      const fictionFilename = `fiction-digest-${slug}-${dateStamp()}.json`;
      downloadJson(
        sanitizeFictionDigestExport(payload, {
          projectPath: this.lastResult?.projectPath || mockStep?.projectPath,
          exportFilename: fictionFilename
        }),
        fictionFilename
      );
      showToast('Fiction digest downloaded', 'success');
    });

    view.querySelector('#download-roadmap-json')?.addEventListener('click', () => {
      if (!roadmap) {
        showToast('Roadmap step has no report', 'error');
        return;
      }
      const roadmapSlug = pathToFileSlug(this.lastResult?.projectPath || roadmap.projectName);
      const roadmapFilename = `${roadmapSlug || 'roadmap'}-${dateStamp()}.json`;
      downloadJson(
        sanitizeRoadmapExport(roadmap, {
          requestedProjectPath: this.lastResult?.projectPath,
          exportFilename: roadmapFilename
        }),
        roadmapFilename
      );
      showToast('Full roadmap downloaded', 'success');
    });

    view.querySelector('#download-eu-compliance-json')?.addEventListener('click', () => {
      const checklist = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('eu-ai-act')?.sprint?.complianceChecklist
        : this.lastResult?.sprint?.complianceChecklist;
      if (!checklist) {
        showToast('EU compliance checklist has no report', 'error');
        return;
      }
      downloadJson(checklist, `eu-ai-act-compliance-${dateStamp()}.json`);
      showToast('EU compliance checklist downloaded', 'success');
    });

    view.querySelector('#download-compliance-json')?.addEventListener('click', () => {
      const complianceStep = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('compliance')
        : this.lastResult;
      const checklist = complianceStep?.checklist;
      if (!checklist) {
        showToast('Compliance checklist has no report', 'error');
        return;
      }
      const gateReport = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('simplebeacon')?.report
        : this.lastResult?.report;
      const npmAudit = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('npm-audit')?.npmAudit
        : complianceStep?.npmAudit;
      const payload = complianceStep?.complianceExport
        ? { ...complianceStep.complianceExport, generatedAt: new Date().toISOString() }
        : sanitizeComplianceBundleExport({
          type: 'simplebeacon-compliance-checklist',
          generatedAt: new Date().toISOString(),
          projectPath: this.lastResult?.projectPath,
          gateReport: gateReport || null,
          checklist,
          npmAudit: npmAudit || null
        });
      downloadJson(payload, `compliance-${slug}-${dateStamp()}.json`);
      showToast('Compliance checklist downloaded', 'success');
    });

    view.querySelector('#download-npm-audit-json')?.addEventListener('click', () => {
      const npmAudit = this.lastResult?.kind === 'complete'
        ? this.getCompleteStep('npm-audit')?.npmAudit
        : this.lastResult?.npmAudit;
      if (!npmAudit) {
        showToast('npm audit has no report', 'error');
        return;
      }
      const projectPath = this.lastResult?.projectPath;
      downloadJson(
        sanitizeNpmAuditExport({
          type: 'simplebeacon-npm-audit',
          generatedAt: new Date().toISOString(),
          projectPath,
          ...npmAudit
        }, projectPath),
        `npm-audit-${slug}-${dateStamp()}.json`
      );
      showToast('npm audit downloaded', 'success');
    });

    view.querySelector('#copy-roadmap-json')?.addEventListener('click', async () => {
      if (!roadmap) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(
          sanitizeRoadmapExport(roadmap, { requestedProjectPath: this.lastResult?.projectPath }),
          null,
          2
        ));
        showToast('Roadmap JSON copied', 'success');
      } catch (err) {
        showToast(err.message || 'Copy failed', 'error');
      }
    });

    const issueSlot = view.querySelector('#inline-issue-list');
    if (issueSlot && simplebeaconReport && !this.isResultsLocked()) {
      const categories = this.app.scanService.getIssueCategories(simplebeaconReport);
      const displayCategories = this.lastResult?.kind === 'mock-scan'
        ? categories.filter((cat) => cat.id === 'consistency')
        : categories;
      issueSlot.appendChild(renderIssueList(displayCategories.length ? displayCategories : categories, {
        onSelect: (cat) => this.openResultsView({ filter: cat })
      }));
    }
  }
}

