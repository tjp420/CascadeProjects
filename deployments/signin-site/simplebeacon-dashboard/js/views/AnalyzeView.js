import { escapeHtml, showToast, downloadJson, redactPathForDisplay, formatPathLabel, formatAiSummarySkipMessage } from '../utils.js';
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
  renderScanScopePanel,
  isSimplebeaconReport,
  aiProviderSupportsSummary,
  getScanFileMetrics,
  resolveAutoAnalysisMode,
  buildScanConclusion,
  buildConsolidationConclusion,
  buildFictionDigestPayload,
  resolveCompleteScanTargetPath,
  normalizeProjectPath,
  filterIssuesByKind,
  fetchCompleteAuditReport,
  openAuditReportPrintWindow,
  fetchDataCleanupScan,
  ensureDashboardApiReady
} from '../services/analyzeService.js?v=20260527preflight1';
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
import { buildCompleteScanAnalysis, renderCompleteScanAnalysisPanel, formatCompleteScanBytes } from '../utils/completeScanAnalysis.js?v=20260527cleanup1';
import {
  buildCleanupAssistantBrief,
  buildCleanupBriefFromLastResult,
  resolveFileReductionPlan,
  loadCleanupPolicy,
  saveCleanupPolicy,
  readCleanupPolicyFromDom,
  renderCleanupAssistantPanel
} from '../utils/cleanupAssistant.js?v=20260527copyprompt1';
import { renderCodebasePanel, buildCodebaseConclusion } from '../components/CodebaseReport.js';
import { renderUnderstandingPanel, buildUnderstandingConclusion } from '../components/UnderstandingReport.js';
import { renderZscriptReportPanel, buildZscriptConclusion } from '../components/ZscriptReport.js';
import { showLoginModal } from '../components/LoginModal.js';
import { authService } from '../services/authService.js';

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

const RECENT_PATHS_KEY = 'simplebeaconRecentPaths';
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
  { id: 'cleanup-assistant', label: 'Cleanup assistant' }
];

function completeStepLabel(index, text) {
  return `${index + 1}/${COMPLETE_STEPS.length} ${text}`;
}

const ANALYSIS_MODE_GROUPS = [
  {
    id: 'bundle',
    label: 'Full deliverable',
    hint: 'All eight scans in one run · includes audit PDF export'
  },
  {
    id: 'standalone',
    label: 'Individual analyses',
    hint: 'Run one engine — faster, scoped to a single job'
  }
];

const ANALYSIS_MODES = [
  {
    value: 'complete',
    group: 'bundle',
    label: 'Complete',
    desc: 'Gate + consolidation + fiction + roadmap + codebase + file reduction + data quality + cleanup assistant',
    icon: '⚡',
    tag: 'Bundle',
    steps: [
      'Simplebeacon gate',
      'Consolidation',
      'Fiction digest',
      'Roadmap',
      'Codebase (full depth)',
      'File reduction (dry-run)',
      'Data quality (config, privacy, lineage)',
      'Cleanup assistant (tiered agent brief)'
    ],
    deliverable: 'Audit PDF + JSON bundle'
  },
  {
    value: 'simplebeacon',
    group: 'standalone',
    label: 'Simplebeacon',
    desc: 'Credentials, mock paths, fiction KPIs, schema gate',
    icon: '🛡️',
    tag: 'Gate',
    deliverable: 'CI-ready pass/fail'
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
    desc: 'Fiction KPI patterns across repository JSON',
    icon: '🔍',
    tag: 'Fiction',
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
    desc: 'Build artifacts, duplicate assets, unused files (dry-run)',
    icon: '📦',
    tag: 'Reduce',
    deliverable: 'Reclaimable space estimate'
  },
  {
    value: 'data-quality',
    group: 'standalone',
    label: 'Data quality',
    desc: 'Config sprawl, env keys, stale data, privacy, lineage',
    icon: '🧪',
    tag: 'Data',
    deliverable: 'Hygiene + privacy findings'
  },
  {
    value: 'cleanup-assistant',
    group: 'standalone',
    label: 'Cleanup assistant',
    desc: 'Tier safe deletes, protect mock data, export agent brief',
    icon: '🗂️',
    tag: 'Agent',
    deliverable: 'Cursor cleanup brief + prompt'
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

function loadRecentPaths() {
  try {
    const raw = localStorage.getItem(RECENT_PATHS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed.filter(isPlausibleProjectPath);
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function isPlausibleProjectPath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 280) return false;
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

function saveRecentPath(path) {
  if (!isPlausibleProjectPath(path)) return;
  const recent = [path, ...loadRecentPaths().filter((p) => p !== path)].slice(0, 6);
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(recent));
}

function removeRecentPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return;
  const recent = loadRecentPaths().filter((p) => p !== raw);
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(recent));
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
          : (prefs.analysisType || app.state.analyzeResult?.data?.analysisType || 'complete');
    this.lastResult = app.state.analyzeResult || null;
    this.completeStep = '';
    this.completeProgress = null;
    this.scanStartedAt = null;
    this.providers = [];
    this.issueTaxonomyGroups = groupIssuesByCategory();
    this.selectedIssueIds = new Set(AI_SYSTEM_ISSUES.map((issue) => issue.id));
    this.aiIssueAnalysisResult = null;
  }

  render() {
    const defaultPath = this.app.state.defaultProjectPath || '';
    const displayPath = this.app.state.lastProjectPath || '';

    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <h1 class="page-title">Analyze</h1>
      <p class="text-muted mb-6">Scan a repo folder on the dashboard server, or import JSON reports from your computer.</p>

      <div class="card mb-6 analyze-path-card">
        <div class="card-header">
          <span class="card-title">Project path (server scan)</span>
          <div class="analyze-path-header-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="use-default-path-btn" ${defaultPath ? '' : 'disabled'}>Use server default</button>
            <button type="button" class="btn btn-ghost btn-sm" id="clear-path-btn">Clear</button>
          </div>
        </div>

        <p class="text-muted analyze-path-intro">Enter a folder path on the machine running <code>npm run dashboard</code>, then click <strong>Run analysis</strong>. This is how Dashboard <strong>Rescan</strong> targets a different repo.</p>

        <div class="analyze-path-input-wrap">
          <input type="text" id="project-path-input" class="analyze-path-input"
            placeholder="e.g. C:\\dev\\my-app or /home/you/your-repo"
            value="${escapeHtml(redactPathForDisplay(displayPath))}"
            spellcheck="false"
            autocomplete="off"
            aria-label="Project path on server">
        </div>

        ${this.renderQuickPaths(defaultPath, displayPath)}

        <p class="text-muted mb-2" style="font-size: var(--font-size-xs);">Analysis mode — <strong>Complete</strong> runs all eight engines; <strong>Cleanup assistant</strong> also runs standalone to tier safe deletes and export a Cursor agent brief; pick any row below for a single focused scan.</p>
        <div class="analyze-mode-grid" id="analyze-mode-grid">
          ${this.renderModePills()}
        </div>
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
            <select id="ai-provider-select" class="analyze-select" aria-label="AI provider">
              <option value="active">Active model</option>
              <option value="demo">Demo</option>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <p id="analyze-roadmap-no-ai-note" class="text-muted analyze-roadmap-note${this.showRoadmapInsightsNote() ? '' : ' is-hidden'}" style="font-size: var(--font-size-xs); margin: 0;">
            Roadmap data is always from <code>code-roadmap-generator</code>. Insights layer adds executive summary + risk — choose LLM only for narrative interpretation of aggregated metrics.
          </p>
          <button type="button" class="btn btn-primary" id="run-analyze-btn" ${this.busy ? 'disabled' : ''}>
            ${this.busy ? (this.completeStep || 'Running…') : 'Run analysis'}
          </button>
          ${this.lastResult ? '<button type="button" class="btn btn-secondary" id="goto-results-quick-btn">View results →</button>' : ''}
        </div>

        ${this.busy ? this.renderProgress() : ''}

        <p class="text-muted mt-3" style="font-size: var(--font-size-xs);">
          Gate mock folders are configured in <a href="#/settings">Settings → Scan paths</a>, not here.
          <strong>Filesystem scan</strong> = deterministic gate (findings never depend on AI).
          <strong>Complete</strong> runs all eight steps with full codebase depth (every discovered code file, ESLint when available). File reduction, data quality, and cleanup assistant run as dry-run scanners at the end. Large repos may take several minutes. Standalone <strong>Codebase</strong> runs the same full-depth codebase engine without the other seven scans.
        </p>
      </div>

      ${this.renderAiSystemsIssueAnalyzerCard()}

      <div id="analyze-results">${this.renderResults()}</div>
    `;

    this.bindEvents(el);
    this._root = el;
    this.syncAnalyzeModeUi(el);
    return el;
  }

  renderQuickPaths(defaultPath, currentPath) {
    const recent = loadRecentPaths().filter((p) => p !== defaultPath);
    const chips = [];

    if (defaultPath) {
      chips.push({ path: defaultPath, label: `Server: ${basenamePath(defaultPath)}`, primary: true });
    }
    for (const path of recent) {
      chips.push({
        path,
        label: formatPathLabel(path) || basenamePath(path),
        primary: false
      });
    }

    if (!chips.length) return '';

    return `
      <div class="analyze-quick-paths" id="analyze-quick-paths">
        ${chips.map((chip) => `
          <span class="analyze-path-chip-wrap ${chip.primary ? 'primary' : ''} ${chip.path === currentPath ? 'active' : ''}">
            <button type="button" class="analyze-path-chip ${chip.primary ? 'primary' : ''} ${chip.path === currentPath ? 'active' : ''}"
              data-path="${escapeHtml(chip.path)}" title="${escapeHtml(redactPathForDisplay(chip.path))}">
              ${escapeHtml(chip.label)}
            </button>
            ${chip.primary ? '' : `<button type="button" class="analyze-path-chip-dismiss" data-path="${escapeHtml(chip.path)}" aria-label="Remove ${escapeHtml(chip.label)} from quick paths" title="Remove">×</button>`}
          </span>
        `).join('')}
      </div>
    `;
  }

  renderModePills() {
    return ANALYSIS_MODE_GROUPS.map((group) => {
      const modes = ANALYSIS_MODES.filter((m) => m.group === group.id);
      return `
        <div class="analyze-mode-group ${group.id === 'bundle' ? 'analyze-mode-group-bundle' : ''}">
          <div class="analyze-mode-group-head">
            <span class="analyze-mode-group-label">${escapeHtml(group.label)}</span>
            <span class="analyze-mode-group-hint">${escapeHtml(group.hint)}</span>
          </div>
          <div class="analyze-mode-group-grid">
            ${modes.map((mode) => `
              <button type="button" class="analyze-mode-pill ${this.analysisType === mode.value ? 'active' : ''}"
                data-mode="${mode.value}" aria-pressed="${this.analysisType === mode.value}">
                <span class="analyze-mode-pill-top">
                  <strong>${mode.icon} ${escapeHtml(mode.label)}</strong>
                  ${mode.tag ? `<span class="analyze-mode-tag">${escapeHtml(mode.tag)}</span>` : ''}
                </span>
                <span class="analyze-mode-pill-desc">${escapeHtml(mode.desc)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderSelectedModeDetail() {
    const mode = getAnalysisMode(this.analysisType);
    const stepsHtml = mode.steps?.length
      ? `<ol class="analyze-mode-steps">${mode.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
      : '';
    const alsoAvailable = this.analysisType === 'complete'
      ? ''
      : `<p class="analyze-mode-also text-muted">Also available individually: ${ANALYSIS_MODES.filter((m) => m.group === 'standalone' && m.value !== mode.value).map((m) => `${m.icon} ${m.label}`).join(' · ')} — or run <strong>Complete</strong> for all eight + audit PDF.</p>`;

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
        ${stepsHtml}
        ${alsoAvailable}
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
          Deterministic category framework over the final 48-analyzer taxonomy with architecture-aware report sections.
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
            Implemented analyzers run deterministic local logic; remaining analyzers return safe contract-valid stubs.
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
    const pct = this.analysisType === 'complete' && steps.length
      ? Math.round((doneCount / total) * 100)
      : (this.busy ? 35 : 0);
    const elapsed = this.scanStartedAt ? formatElapsed(Date.now() - this.scanStartedAt) : '—';

    if (this.analysisType !== 'complete' || !steps.length) {
      return `
        <div class="analyze-progress" id="analyze-progress">
          <div class="analyze-progress-header">
            <span>${escapeHtml(this.completeStep || 'Running analysis…')}</span>
            <span class="text-muted">${elapsed}</span>
          </div>
          <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }

    return `
      <div class="analyze-progress" id="analyze-progress">
        <div class="analyze-progress-header">
          <span>Complete scan — ${doneCount}/${total} steps</span>
          <span class="text-muted">${elapsed}</span>
        </div>
        <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
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
        <p class="text-muted" style="margin:0">No analysis yet — drop a JSON report, pick a quick path above, or run a scan.</p>
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
    saveAnalyzePrefs({
      analysisType: type,
      aiProvider: this.aiProvider,
      roadmapInsightsMode: this.roadmapInsightsMode,
      understandingMode: this.understandingMode
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
    const detail = root.querySelector('#analyze-mode-detail');
    if (detail) {
      detail.outerHTML = this.renderSelectedModeDetail().trim();
    }
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
    const insightsSelect = root.querySelector('#roadmap-insights-select');
    if (insightsSelect && insightsSelect.value !== this.roadmapInsightsMode) {
      insightsSelect.value = this.roadmapInsightsMode;
    }
    const understandingSelect = root.querySelector('#understanding-mode-select');
    if (understandingSelect && understandingSelect.value !== this.understandingMode) {
      understandingSelect.value = this.understandingMode;
    }
  }

  providerConfiguredForSummary(providerId) {
    const id = String(providerId || 'demo').toLowerCase();
    if (id === 'demo') return false;
    // Ollama model/env resolution happens server-side (Settings, .env, or /api/tags).
    if (id === 'ollama') return true;
    const match = this.providers.find((p) => p.id === id);
    if (!match) return id !== 'demo';
    return Boolean(match.configured || match.available);
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
    if (!target || !aiProviderSupportsSummary(this.aiProvider)) return target;
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
        <div class="metric-chip" title="Full filesystem under ${escapeHtml(redactPathForDisplay(m.repositoryRoot) || 'project path')} — explorer count includes node_modules">
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
            Stale or mismatched scan report — re-run the scan on <code>${escapeHtml(redactPathForDisplay(projectPath) || 'this path')}</code>
            to attach full repository inventory and gate scope (reportVersion 2).
          </p>
        </div>
      ` : ''}
      ${monorepoNote ? `
        <div class="card mb-4 analyze-monorepo-scope">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">Monorepo scan scope</p>
          <p style="margin: 0; font-size: var(--font-size-sm);">${escapeHtml(monorepoNote)}</p>
          <p class="text-muted mt-2 mb-0" style="font-size: var(--font-size-xs);">
            Requested: <code>${escapeHtml(redactPathForDisplay(report.projectRoot))}</code>
            · Platform: <code>${escapeHtml(redactPathForDisplay(report.platformRoot))}</code>
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
    const trimmed = String(inputValue || '').trim();
    if (trimmed && !trimmed.startsWith('…') && isPlausibleProjectPath(trimmed)) {
      return trimmed;
    }
    if (this.app.state.lastProjectPath && isPlausibleProjectPath(this.app.state.lastProjectPath)) {
      return this.app.state.lastProjectPath;
    }
    if (trimmed.startsWith('…')) {
      return this.app.state.defaultProjectPath || '';
    }
    return trimmed || this.app.state.defaultProjectPath || '';
  }

  setPathInputDisplay(pathInput, fullPath) {
    if (!pathInput) return;
    pathInput.value = fullPath ? redactPathForDisplay(fullPath) : '';
  }

  bindEvents(el) {
    const pathInput = el.querySelector('#project-path-input');
    const typeSelect = el.querySelector('#analysis-type-select');
    const providerSelect = el.querySelector('#ai-provider-select');

    el.querySelectorAll('.analyze-mode-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.setAnalysisType(pill.dataset.mode, { typeSelect });
        el.querySelectorAll('.analyze-mode-pill').forEach((p) => {
          p.classList.toggle('active', p.dataset.mode === this.analysisType);
          p.setAttribute('aria-pressed', p.dataset.mode === this.analysisType);
        });
        this.syncAnalyzeModeUi(el);
      });
    });

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
      }
    });

    el.querySelector('#clear-path-btn')?.addEventListener('click', () => {
      if (pathInput) pathInput.value = '';
      this.app.state.lastProjectPath = '';
    });

    el.querySelectorAll('.analyze-path-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const path = chip.dataset.path;
        if (pathInput) this.setPathInputDisplay(pathInput, path);
        this.app.state.lastProjectPath = path;
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
      this.app.state.lastProjectPath = '';
    });

    pathInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.runPathAnalysis(this.resolveProjectPath(pathInput.value));
      }
    });

    this.loadProviders(providerSelect);
  }

  async loadProviders(select) {
    try {
      const data = await fetchAnalyzeProviders();
      if (!data.providers) return;
      this.providers = data.providers;
      if (!select) return;

      select.innerHTML = data.providers.map((p) => {
        const configured = Boolean(p.configured || p.available);
        const suffix = configured ? '' : ' (not configured)';
        return `<option value="${escapeHtml(p.id)}" ${configured ? '' : 'disabled'}>${escapeHtml(p.label || p.id)}${suffix}</option>`;
      }).join('');

      const preferred = this.aiProvider;
      const preferredOk = data.providers.some(
        (p) => p.id === preferred && (p.configured || p.available)
      );
      const ollama = data.providers.find((p) => p.id === 'ollama' && (p.configured || p.available));
      if (preferredOk) {
        select.value = preferred;
      } else if (ollama && (preferred === 'active' || preferred === 'demo')) {
        this.aiProvider = 'ollama';
        select.value = 'ollama';
        saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
      } else {
        const fallback = data.providers.find((p) => p.id === 'demo')
          || data.providers.find((p) => p.configured || p.available);
        if (fallback) {
          this.aiProvider = fallback.id;
          select.value = fallback.id;
          saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
        }
      }
    } catch {
      /* keep defaults */
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

  async runPathAnalysis(projectPath) {
    if (!projectPath) {
      showToast('Enter a project path on the server machine', 'error');
      return;
    }
    if (!isPlausibleProjectPath(projectPath)) {
      showToast('Enter a folder path (not a file like .bat or .json)', 'error');
      if (this.app.state.lastProjectPath === projectPath) {
        this.app.state.lastProjectPath = '';
      }
      return;
    }

    this.busy = true;
    this.scanStartedAt = Date.now();
    this.app.state.lastProjectPath = projectPath;
    saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, understandingMode: this.understandingMode });
    this.refresh();

    await authService.fetchPlatformStatus();
    if (authService.authRequired && !(await authService.ensureAuthenticated())) {
      this.busy = false;
      this.refresh();
      showToast('Session expired — sign in again before running analysis', 'error');
      window.location.hash = '#/signin';
      return;
    }

    try {
      await ensureDashboardApiReady();
    } catch (err) {
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
        await this.runCompleteScan(projectPath);
        analysisSucceeded = true;
        return;
      }

      if (effectiveType === 'simplebeacon') {
        const data = await scanPath(projectPath);
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
        const data = await scanPath(projectPath);
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
        const fileReduction = await fetchDataCleanupScan(projectPath, {
          profile: 'file-reduction',
          timeoutMs: 300000
        });
        const dataQuality = await fetchDataCleanupScan(projectPath, {
          profile: 'data-quality',
          timeoutMs: 300000
        });
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
        if (!brief.scanAnalysis?.fileReduction && !brief.estimatedReduction?.files && !brief.tiers.investigate.files) {
          throw new Error('Cleanup assistant could not derive reduction tiers — file reduction scan may be stale. Restart the dashboard server and retry.');
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
          conclusion: `Tiered cleanup plan — ${Number(brief.estimatedReduction.files || 0).toLocaleString()} files safe now (${formatCompleteScanBytes(brief.estimatedReduction.bytes)}), ${Number(brief.projectedInventory.totalFiles || 0).toLocaleString()} projected after phase 1.`
        };
        this.app.state.analyzeResult = this.lastResult;
        this.refresh();
        showToast('Cleanup assistant scan complete', 'success');
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
      this.busy = false;
      this.completeStep = '';
      this.completeProgress = null;
      this.scanStartedAt = null;
      this.refresh();
    }
  }

  async runCompleteScan(projectPath) {
    await ensureDashboardApiReady();

    const steps = [];
    const errors = [];

    this.completeProgress = {
      active: true,
      steps: COMPLETE_STEPS.map((s) => ({ ...s, status: 'pending', error: null }))
    };

    const runStep = async (index, label, fn) => {
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

    await runStep(0, completeStepLabel(0, 'Simplebeacon…'), async () => {
      const data = await scanPath(projectPath);
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
    });

    await runStep(1, completeStepLabel(1, 'Consolidation…'), async () => {
      let scan = await this.app.platformService.fetchMergerReductionScan(projectPath);
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
    });

    await runStep(2, completeStepLabel(2, 'Fiction digest…'), async () => {
      const simplebeaconStep = steps.find((s) => s.id === 'simplebeacon');
      const report = simplebeaconStep?.report ?? null;
      const fictionIssues = report ? filterIssuesByKind(report, 'fiction') : [];
      const digest = report ? buildFictionDigestPayload(report) : null;
      return {
        id: 'mock-scan',
        report,
        fictionIssues,
        nonFictionIssues: digest?.nonFictionIssues || [],
        conclusion: digest?.conclusion || null
      };
    });

    await runStep(3, completeStepLabel(3, 'Roadmap…'), async () => {
      const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
      const data = await analyzePath(analysisPath, {
        aiProvider: this.aiProvider,
        analysisType: 'roadmap',
        roadmapInsightsMode: 'off',
        timeoutMs: 180000
      });
      if (!data.roadmap) {
        throw new Error('Roadmap analysis returned no roadmap payload');
      }
      return { id: 'roadmap', data, roadmap: data.roadmap, analysisPath };
    });

    await runStep(4, completeStepLabel(4, 'Codebase (full)…'), async () => {
      const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
      let scan = await fetchCodebaseAnalysis(analysisPath, {
        context: 'complete',
        includeEslint: true,
        understandingMode: 'off',
        timeoutMs: 900000
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
    });

    await runStep(5, completeStepLabel(5, 'File reduction…'), async () => {
      const scan = await fetchDataCleanupScan(projectPath, {
        profile: 'file-reduction',
        timeoutMs: 300000
      });
      return { id: 'file-reduction', scan, profile: 'file-reduction' };
    });

    await runStep(6, completeStepLabel(6, 'Data quality…'), async () => {
      const scan = await fetchDataCleanupScan(projectPath, {
        profile: 'data-quality',
        timeoutMs: 300000
      });
      return { id: 'data-quality', scan, profile: 'data-quality' };
    });

    await runStep(7, completeStepLabel(7, 'Cleanup assistant…'), async () => {
      const fileReduction = steps.find((s) => s.id === 'file-reduction')?.scan ?? null;
      const dataQuality = steps.find((s) => s.id === 'data-quality')?.scan ?? null;
      if (!fileReduction && !dataQuality) {
        throw new Error('File reduction and data quality must complete before cleanup assistant');
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
      if (!brief.scanAnalysis?.fileReduction && !brief.estimatedReduction?.files && !brief.tiers.investigate.files) {
        throw new Error('Cleanup assistant could not derive reduction tiers — file reduction scan may be stale. Restart the dashboard server and retry.');
      }
      return {
        id: 'cleanup-assistant',
        brief,
        fileReduction,
        dataQuality,
        repositoryInventory,
        policy
      };
    });

    this.lastResult = {
      kind: 'complete',
      projectPath,
      label: `Complete scan: ${formatPathLabel(projectPath)}`,
      steps,
      errors,
      publicGateLocked: steps.some((step) => step.publicGateLocked || step.report?.publicGateLocked || step.scan?.publicGateLocked),
      publicSummary: steps.find((step) => step.publicSummary)?.publicSummary
        || steps.find((step) => step.scan?.publicSummary)?.scan?.publicSummary
        || null
    };
    const simplebeaconReport = steps.find((s) => s.id === 'simplebeacon')?.report;
    await this.attachRepositoryInventory(projectPath, simplebeaconReport);
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

  buildCompleteScanExport() {
    const { projectPath, steps = [], errors = [] } = this.lastResult || {};
    const simplebeacon = this.getCompleteStep('simplebeacon')?.report ?? null;
    const consolidation = this.getCompleteStep('consolidation')?.scan ?? null;
    const mockStep = this.getCompleteStep('mock-scan');
    const mockScan = mockStep?.report
      ? buildFictionDigestPayload(mockStep.report, {
        generatedAt: mockStep.report.generatedAt || new Date().toISOString()
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

    return {
      type: 'simplebeacon-complete-scan',
      version: '1.3.0',
      generatedAt: new Date().toISOString(),
      projectPath,
      scanDurationMs,
      errors,
      summary: {
        stepCount: COMPLETE_STEPS.length,
        stepsCompleted: steps.length,
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
        cleanupProjectedFiles: cleanupAssistant?.projectedInventory?.totalFiles ?? null
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
        cleanupAssistant
      }
    };
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
        <div class="section-heading" style="margin-bottom: 0;">
          <span class="card-title" style="font-size: var(--font-size-sm);">Export</span>
          ${this.renderScanDownloadActions({ isComplete, showGotoResults, gotoLabel, extraButtons })}
        </div>
      </div>
    `;
  }

  wrapAnalyzeResults(content) {
    return `${this.renderResultsExportBar()}${content || ''}`;
  }

  renderScanDownloadActions({
    isComplete = false,
    showGotoResults = false,
    gotoLabel = 'Open Simplebeacon Results →',
    extraButtons = ''
  } = {}) {
    const locked = this.isResultsLocked();
    const checkoutUrl = this.app.billingService?.getAuditCheckoutUrl?.() || null;
    const priceLabel = this.app.billingService?.plan?.auditPriceLabel || '$499';
    const downloadLabel = isComplete ? 'Download all results' : 'Download result';

    return `
      <div class="roadmap-result-actions">
        <button type="button" class="btn btn-primary btn-sm" id="download-scan-result">${downloadLabel}</button>
        ${locked
          ? `<a class="btn btn-accent btn-sm cta-pay-button" href="${escapeHtml(checkoutUrl || '#')}" target="_blank" rel="noopener noreferrer">Unlock audit PDF (${escapeHtml(priceLabel)})</a>`
          : '<button type="button" class="btn btn-accent btn-sm" id="download-audit-pdf" title="Professional audit PDF — print to save">Download audit PDF</button>'}
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
      return this.buildCompleteScanExport();
    }

    const { kind, projectPath, report, scan, data, _brief, fileReduction, dataQuality, profile, policy } = this.lastResult || {};
    const generatedAt = new Date().toISOString();
    const scanDurationMs = this.scanStartedAt ? Date.now() - this.scanStartedAt : null;

    switch (kind) {
      case 'simplebeacon-report':
        return report || null;
      case 'mock-scan':
        return report
          ? buildFictionDigestPayload(report, { generatedAt: report.generatedAt || generatedAt })
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
      default:
        return this.lastResult || null;
    }
  }

  buildAuditExportPayload() {
    if (this.lastResult?.kind === 'complete') {
      return this.buildCompleteScanExport();
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
      default:
        break;
    }

    const completeScanAnalysis = buildCompleteScanAnalysis({
      fileReduction: results.fileReduction,
      dataQuality: results.dataQuality,
      projectPath
    });

    return {
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
    this.refresh();
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

  prepareReportForResults(report) {
    if (!report) return null;
    const source = report.rawIssues ?? report.detectedIssues ?? [];
    const rawIssues = source.map((issue, index) => ({
      ...issue,
      id: issue.id || `${issue.severity}|${issue.type}|${issue.description}|${index}`,
      filePath: issue.filePath || issue.filePaths?.[0] || issue.affectedFiles?.[0]
    }));
    return {
      ...report,
      rawIssues,
      detectedIssues: report.detectedIssues ?? rawIssues,
      issueCount: report.issueCount ?? rawIssues.reduce((sum, i) => sum + (i.count || 1), 0)
    };
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
              Scanned <code>${escapeHtml(redactPathForDisplay(roadmap.sourceProjectPath))}</code> —
              sprint metrics use platform root <code>${escapeHtml(redactPathForDisplay(roadmap.platformRoot))}</code>.
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
    const stepTotal = COMPLETE_STEPS.length;

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
          <div class="metric-chip"><strong>${steps.length}</strong> succeeded</div>
          <div class="metric-chip gate-badge ${simplebeacon?.gate?.pass ? 'pass' : 'warn'}">${simplebeacon?.gate?.pass ? 'GATE PASS' : 'GATE REVIEW'}</div>
          <div class="metric-chip"><strong>${codebase?.summary?.codeFilesAnalyzed ?? '—'}/${codebase?.summary?.codeFilesDiscovered ?? '—'}</strong> code files</div>
          <div class="metric-chip"><strong>${codebase?.summary?.healthScore ?? '—'}%</strong> code health</div>
          <div class="metric-chip"><strong>${consolidation?.summary?.exactDuplicateGroups ?? '—'}</strong> dup groups</div>
          <div class="metric-chip"><strong>${fileReduction?.fileReductionPlan?.totals?.estimatedImmediateSavingsBytes != null ? formatCompleteScanBytes(fileReduction.fileReductionPlan.totals.estimatedImmediateSavingsBytes) : formatCount(fileReduction?.summary?.totalFindings)}</strong> ${fileReduction?.fileReductionPlan ? 'immediate savings' : 'file reduction'}</div>
          <div class="metric-chip"><strong>${formatCount(dataQuality?.executiveSummary?.security?.piiNeedingReview ?? dataQuality?.summary?.totalFindings)}</strong> ${dataQuality?.executiveSummary ? 'PII review' : 'data quality'}</div>
          ${cleanupBrief ? `<div class="metric-chip"><strong>${formatCount(cleanupBrief.estimatedReduction?.files)}</strong> safe cleanup files</div>` : ''}
        </div>

        ${renderCompleteScanAnalysisPanel(completeScanAnalysis)}

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
              <p class="text-muted text-sm mt-4 mb-0">Scoped to platform root <code>${escapeHtml(redactPathForDisplay(roadmapStep.analysisPath))}</code> (monorepo parent scan).</p>
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
              <p class="text-muted text-sm mt-4 mb-0">Scoped to platform root <code>${escapeHtml(redactPathForDisplay(codebaseStep.analysisPath))}</code> (monorepo parent scan).</p>
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

    view.querySelector('#download-audit-pdf')?.addEventListener('click', async () => {
      const payload = this.buildAuditExportPayload();
      if (!this.scanExportHasPayload(payload)) {
        showToast('No scan results available for audit PDF', 'error');
        return;
      }
      const btn = view.querySelector('#download-audit-pdf');
      const priorLabel = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Building report…';
      }
      try {
        const data = await fetchCompleteAuditReport(payload, {
          aiProvider: 'demo',
          client: formatPathLabel(payload.projectPath) || 'Client project'
        });
        openAuditReportPrintWindow(data.html, data.filename);
        showToast(
          `Audit report saved to Downloads as ${data.filename}. Open the HTML file, scroll through all sections, then Print → Save as PDF.`,
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
      downloadJson(report, `simplebeacon-${slug}-${dateStamp()}.json`);
      showToast('Simplebeacon report downloaded', 'success');
    });

    view.querySelector('#download-consolidation-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('consolidation')?.scan;
      if (!scan) {
        showToast('Consolidation step has no report', 'error');
        return;
      }
      downloadJson(scan, `consolidation-${slug}-${dateStamp()}.json`);
      showToast('Consolidation report downloaded', 'success');
    });

    view.querySelector('#download-codebase-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('codebase')?.scan;
      if (!scan) {
        showToast('Codebase step has no report', 'error');
        return;
      }
      downloadJson(scan, `codebase-${slug}-${dateStamp()}.json`);
      showToast('Codebase report downloaded', 'success');
    });

    const exportBrief = () => {
      const brief = buildCleanupBriefFromLastResult(this.lastResult, this.lastResult?.policy || loadCleanupPolicy());
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
      downloadJson(scan, `file-reduction-${slug}-${dateStamp()}.json`);
      showToast('File reduction report exported', 'success');
    });

    view.querySelector('#download-data-quality-json')?.addEventListener('click', () => {
      const scan = this.getCompleteStep('data-quality')?.scan;
      if (!scan) {
        showToast('Data quality step has no report', 'error');
        return;
      }
      downloadJson(scan, `data-quality-${slug}-${dateStamp()}.json`);
      showToast('Data quality report exported', 'success');
    });

    view.querySelector('#download-mock-scan-json')?.addEventListener('click', () => {
      const mockStep = this.getCompleteStep('mock-scan');
      const payload = mockStep?.report
        ? buildFictionDigestPayload(mockStep.report)
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
      downloadJson(payload, `fiction-digest-${slug}-${dateStamp()}.json`);
      showToast('Fiction digest downloaded', 'success');
    });

    view.querySelector('#download-roadmap-json')?.addEventListener('click', () => {
      if (!roadmap) {
        showToast('Roadmap step has no report', 'error');
        return;
      }
      const roadmapSlug = pathToFileSlug(this.lastResult?.projectPath || roadmap.projectName);
      downloadJson(roadmap, `${roadmapSlug || 'roadmap'}-${dateStamp()}.json`);
      showToast('Full roadmap downloaded', 'success');
    });
    view.querySelector('#copy-roadmap-json')?.addEventListener('click', async () => {
      if (!roadmap) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(roadmap, null, 2));
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

