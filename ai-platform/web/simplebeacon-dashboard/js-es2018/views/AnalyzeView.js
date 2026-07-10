import { escapeHtml, showToast, downloadJson, downloadBlob, downloadText, redactPathForDisplay, formatPathLabel, formatPathInputValue, formatAiSummarySkipMessage, isRedactedPathDisplay, formatNumber, renderEmptyState } from '../utils.js';
import { evaluateFunnelMetrics, getFunnelCopy } from '../utils/funnelTrigger.js';
import { LocalScanService } from '../services/localScanService.js?v=20260709noise3';
import { fingerprintDirectory, formatFingerprint } from '../services/fingerprintService.js';
import { probeAgent, scanViaAgent, shouldUseAgent, isLocalPath, formatAgentStatus, getAgentDownloadUrl, detectPlatform, getPlatformLabel, getInstallInstructions, getAgentFallbackMessage, probeAgent4000, scanViaAgent4000, renderAgentCertificate } from '../services/localAgentService.js?v=20260710agentcache1';
import { runSandboxedDirectoryScan } from '../services/browserSandboxScanService.js?v=20260710sandbox1';
// simplebeacon:production-leak-intent: sample-json - Legitimate documentation about sample file patterns in analysis results
import { analyzePath, scanPath, summarizeReport, fetchAnalyzeProviders, fetchRepositoryInventory, fetchCodebaseAnalysis, enrichScanReport, fetchZscriptModReport, shouldFetchZscriptReport, isLegacyScanReport, buildMonorepoScopeNote, buildPathInventoryProvenance, renderInventoryProvenanceHtml, refreshPathInventory, liveInventoryForPath, renderScanScopePanel, isSimplebeaconReport, aiProviderSupportsSummary, getScanFileMetrics, resolveAutoAnalysisMode, buildScanConclusion, buildConsolidationConclusion, buildFictionDigestPayload, sanitizeFictionDigestExport, resolveCompleteScanTargetPath, normalizeProjectPath, filterIssuesByKind, preparePlatformResultsReport, fetchCompleteAuditReport, fetchAnalyzeExportBundleZip, fetchEuAiActAuditReport, openAuditReportPrintWindow, previewAuditExportTier, auditExportButtonLabel, fetchDataCleanupScan, ensureDashboardApiReady, assertCompleteScanComplianceFresh, assertCompleteScanFileReductionFresh, fetchUnderstandSnippet, isCodebaseReport, fetchComplianceChecklist, fetchProjectNpmAudit, prepareGithubRepo, fetchAnalyzeTestSources, isAnalyzeProviderConfigured, uploadDirectoryAndAnalyze } from '../services/analyzeService.js?v=20260710reportnorm1';
import { isRemoteRepoUrl, sourceChipTitle } from '../lib/analyzePathSources.js';
import { reportMatchesPagePath, resolvePageProjectPath, getPathInputDisplayValue } from '../lib/pageRepoScan.js';
import { collectPathSuggestions, refreshPathSuggestionsDatalist, pathInputListAttr, renderPathSuggestionsDatalistElement, saveRecentPath, removeRecentPath, loadRecentPaths } from '../lib/analyzePathSuggestions.js';
import { validateProjectPathAllowlist, ensureAllowedAnalysisRoots } from '../lib/analyzePathAllowlist.js';
import { isBenchmarkCachePath } from '../utils/complete-scan-artifact-profile.browser.js';
import { runEuAiActSprint } from '../services/operatorService.js?v=20260531eupdf1';
import { renderModeFileScopePanel, extractRoadmapFileMetrics } from '../utils/analyze-mode-file-scope.browser.js?v=20260601roadmapscope1';
import { renderModeFileResultsPanel } from '../utils/analyze-mode-file-results.browser.js?v=20260601filereconcile1';
import { renderScanPaywall, buildPublicSummaryFromScan, isDeliverableLocked } from '../components/ScanPaywall.js';
import { AI_SYSTEM_ISSUES, ANALYZER_CATALOG, groupIssuesByCategory, buildAiSystemsIssueAnalysis } from '../services/aiProblemAnalyzerSuite.mjs';
import { renderIssueList } from '../components/IssueCard.js';
import { showDownloadCredentialsModal } from '../components/DownloadCredentialsModal.js';
import { renderConsolidationPanel } from '../components/ConsolidationReport.js';
import { renderDataCleanupPanel, buildDataCleanupConclusion } from '../components/DataCleanupReport.js?v=20260527exec5';
import { buildCompleteScanAnalysis, renderCompleteScanAnalysisPanel, formatCompleteScanBytes, sanitizeCompleteScanBundle, sanitizeConsolidationExport, sanitizeRoadmapExport } from '../utils/completeScanAnalysis.js?v=20260601completescan1';
import { sanitizeNpmAuditExport } from '../utils/npm-audit-export.browser.js?v=20260601npmaudit5';
import { sanitizeComplianceBundleExport, reconcileComplianceWithGate, pickFreshGateReport } from '../utils/compliance-export.browser.js?v=20260601complianceexport7';
import { buildCleanupAssistantBrief, buildCleanupBriefFromLastResult, buildCleanupAssistantConclusion, isCleanupBriefRunnable, resolveFileReductionPlan, loadCleanupPolicy, saveCleanupPolicy, readCleanupPolicyFromDom, renderCleanupAssistantPanel } from '../utils/cleanupAssistant.js?v=20260601cleanupbrief9';
import { sanitizeCleanupBriefExport } from '../utils/cleanup-brief-export.browser.js?v=20260601cleanupbrief9';
import { sanitizeDataCleanupReportExport } from '../utils/data-cleanup-export.browser.js?v=20260601datacleanup8';
import { sanitizeCodebaseReportExport } from '../utils/codebase-export.browser.js?v=20260601codebase8';
import { sanitizeAiProblemAnalyzerExport, aiProblemAnalyzerExportFilename, buildAiProblemAnalyzerCsv } from '../utils/ai-problem-analyzer-export.browser.js?v=20260531aianalyzerexport4';
import { renderCodebasePanel, buildCodebaseConclusion } from '../components/CodebaseReport.js';
import { renderUnderstandingPanel, buildUnderstandingConclusion } from '../components/UnderstandingReport.js';
import { renderZscriptReportPanel, buildZscriptConclusion } from '../components/ZscriptReport.js';
import { showLoginModal } from '../components/LoginModal.js';
import { authService } from '../services/authService.js';
import { MAX_SNIPPET_BYTES, isSupportedSourceFile, isAnalyzerCacheJson, isCleanupExportJson, isFictionDigestJson, isLockfileName, isMarkdownFileName, isScannerMetaFileName, filterSnippetFindingsForFile, scanSnippetText, computeThreatScore, redactMatch, severityLabel } from '../utils/snippetDiagnostic.js?v=20260531analyzers1';
const SNIPPET_ACCEPT = '.json,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.env,.yaml,.yml,.txt,.md,.html,.css,.xml,.toml,.ini,.sh,.ps1,.bat';
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB — server-side directory upload limit
/**
 * Read hash query param.
 * @param {string} name
 * @returns {any}
 */
function readHashQueryParam(name) {
    const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1)
        return '';
    return new URLSearchParams(hash.slice(qIndex + 1)).get(name) || '';
}
/**
 * Path to file slug.
 * @param {string} projectPath
 * @returns {any}
 */
function pathToFileSlug(projectPath) {
    const slug = (projectPath || 'scan')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    return slug || 'scan';
}
/**
 * Date stamp.
 * @returns {any}
 */
function dateStamp() {
    return new Date().toISOString().slice(0, 10);
}
const ANALYZE_PREFS_KEY = 'simplebeaconAnalyzePrefs';
const PREFERRED_PROJECT_BASE_KEY = 'simplebeaconPreferredProjectBase';
/**
 * Analysis type uses ai narrative.
 * @param {any} type
 * @returns {any}
 */
function analysisTypeUsesAiNarrative(type) {
    return String(type || '').toLowerCase() !== 'roadmap';
}
/**
 * Analysis type supports roadmap insights.
 * @param {any} type
 * @returns {any}
 */
function analysisTypeSupportsRoadmapInsights(type) {
    const t = String(type || '').toLowerCase();
    return t === 'roadmap' || t === 'complete';
}
/**
 * Analysis type supports understanding.
 * @param {any} type
 * @returns {any}
 */
function analysisTypeSupportsUnderstanding(type) {
    const t = String(type || '').toLowerCase();
    return t === 'codebase' || t === 'complete';
}
// Canonical analyzer list — single source of truth for engine IDs, labels, categories, and descriptions.
// Add new analyzers here only. The reference card and queue panel both derive from this array.
// File location: ai-platform/web/simplebeacon-dashboard/js/views/AnalyzeView.js
const COMPLETE_STEPS = [
    // Core scans
    { id: 'simplebeacon', label: 'Simplebeacon gate', category: 'Core Scans', desc: 'Credential patterns, AI/LLM imports, hardcoded secrets.' },
    { id: 'consolidation', label: 'Data consolidation', category: 'Core Scans', desc: 'Duplicate file groups && monorepo markers.' },
    { id: 'mock-scan', label: 'Fiction & KPI digest', category: 'Core Scans', desc: 'Fixture, sample, && test-data files.' },
    { id: 'roadmap', label: 'Roadmap generation', category: 'Core Scans', desc: 'Task, fix, workaround, && bug markers in code.' },
    { id: 'codebase', label: 'Codebase analysis', category: 'Core Scans', desc: 'File type breakdown, line counts, && structure.' },
    { id: 'file-reduction', label: 'File reduction', category: 'Core Scans', desc: 'Unused image assets, duplicate content, && directory bloat.' },
    { id: 'data-quality', label: 'Data quality', category: 'Core Scans', desc: 'Empty || trivial JSON files.' },
    { id: 'cleanup-assistant', label: 'Cleanup assistant', category: 'Core Scans', desc: 'Debug artifacts: console.log, debugger, open items.' },
    { id: 'npm-audit', label: 'npm audit', category: 'Core Scans', desc: 'Package.json files && dependency counts.' },
    { id: 'compliance', label: 'Compliance checklist', category: 'Core Scans', desc: 'License, security, && governance files.' },
    // Security
    { id: 'dependency-vulns', label: 'Dependency Vulns', category: 'Security', desc: 'CVE && outdated dependency audit.' },
    { id: 'sensitive-data', label: 'Sensitive Data', category: 'Security', desc: 'PII patterns, email/phone/SSN in source.' },
    { id: 'security-headers', label: 'Security Headers', category: 'Security', desc: 'Missing CSP, X-Frame-Options, HSTS, or Referrer-Policy in server configs.' },
    { id: 'config-drift', label: 'Config Drift', category: 'Security', desc: 'Committed .env files, hardcoded URLs, secrets in config, inconsistent env naming.' },
    { id: 'eval-danger', label: 'Eval Danger', category: 'Security', desc: 'ev' + 'al(), new Function(), dynamic code execution risks.' },
    { id: 'inner-html-xss', label: 'innerHTML XSS', category: 'Security', desc: 'Unsanitized innerHTML assignments.' },
    { id: 'prototype-pollution', label: 'Prototype Pollution', category: 'Security', desc: 'Object.prototype or __proto__ modification risks.' },
    { id: 'unvalidated-redirect', label: 'Unvalidated Redirect', category: 'Security', desc: 'Open redirect vulnerabilities.' },
    { id: 'missing-rate-limit', label: 'Missing Rate Limit', category: 'Security', desc: 'API endpoints without rate limiting.' },
    { id: 'insecure-random', label: 'Insecure Random', category: 'Security', desc: 'Math.random() used for security purposes.' },
    { id: 'logging-secrets', label: 'Logging Secrets', category: 'Security', desc: 'Passwords, tokens, or secrets written to logs.' },
    // AI & LLM
    { id: 'ai-indicators', label: 'AI System Indicators', category: 'AI & LLM', desc: 'AI/LLM SDK imports && model inference patterns.' },
    { id: 'ai-residue', label: 'AI Residue', category: 'AI & LLM', desc: 'Hallucinated imports, stub implementations, error swallowing.' },
    { id: 'llm-slop', label: 'LLM Slop', category: 'AI & LLM', desc: 'Placeholder debris, markdown code fences leaked into source.' },
    { id: 'token-bleed', label: 'Token Bleed', category: 'AI & LLM', desc: 'LLM API calls without max_tokens limits.' },
    { id: 'ai-placeholder-comment', label: 'AI Placeholder', category: 'AI & LLM', desc: 'Placeholder comments generated by AI.' },
    { id: 'ai-placeholder-block', label: 'AI Placeholder Block', category: 'AI & LLM', desc: 'Block comments with AI placeholder text.' },
    { id: 'markdown-fence-leak', label: 'Markdown Fence Leak', category: 'AI & LLM', desc: 'Markdown code fences (```) leaked into source files.' },
    { id: 'empty-stub-function', label: 'Empty Stub', category: 'AI & LLM', desc: 'Empty function bodies — likely AI-generated stubs.' },
    { id: 'arrow-stub', label: 'Arrow Stub', category: 'AI & LLM', desc: 'Arrow functions returning empty objects.' },
    { id: 'fiction-kpi', label: 'Fiction KPI', category: 'AI & LLM', desc: 'Hardcoded metrics, completion rates, fabricated scores.' },
    { id: 'hardcoded-confidence', label: 'Hardcoded Confidence', category: 'AI & LLM', desc: 'Static confidence scores that should be dynamic.' },
    { id: 'hardcoded-completion', label: 'Hardcoded Completion', category: 'AI & LLM', desc: 'Static completion rates that should be real metrics.' },
    // Code Quality
    { id: 'performance', label: 'Performance', category: 'Code Quality', desc: 'Nested loops, memory leaks, event listener leaks.' },
    { id: 'type-safety', label: 'Type Safety', category: 'Code Quality', desc: 'any types, missing PropTypes, runtime typeof checks.' },
    { id: 'documentation', label: 'Documentation', category: 'Code Quality', desc: 'Missing JSDoc, undocumented public functions.' },
    { id: 'test-coverage', label: 'Test Coverage', category: 'Code Quality', desc: 'Source files without tests, empty test files.' },
    { id: 'complexity', label: 'Complexity Metrics', category: 'Code Quality', desc: 'Over-long functions, bloated files, deep nesting.' },
    { id: 'magic-number', label: 'Magic Numbers', category: 'Code Quality', desc: 'Hardcoded numeric literals that should be constants.' },
    { id: 'missing-strict-mode', label: 'Missing Strict Mode', category: 'Code Quality', desc: "Files without 'use strict' — implicit globals risk." },
    { id: 'uninitialized-read', label: 'Uninitialized Read', category: 'Code Quality', desc: 'Variables used before assignment.' },
    { id: 'unhandled-promise', label: 'Unhandled Promise', category: 'Code Quality', desc: 'Promise chains missing .catch() error handlers.' },
    { id: 'sync-io', label: 'Sync I/O', category: 'Code Quality', desc: 'Synchronous fs operations that block the event loop.' },
    // Architecture
    { id: 'build-readiness', label: 'Build Readiness', category: 'Architecture', desc: 'Missing files, configs, scripts, deploy blockers.' },
    { id: 'governance', label: 'License & Governance', category: 'Architecture', desc: 'License headers, copyright notices, governance markers.' },
    { id: 'junk-files', label: 'Junk & Temp Files', category: 'Architecture', desc: 'OS/editor artifacts, backup files, caches.' },
    { id: 'removable-files', label: 'Removable Files', category: 'Architecture', desc: 'node_modules, build artifacts (dist, build, .next), caches, logs, and temp files that can be safely deleted.' },
    { id: 'database-patterns', label: 'Database Patterns', category: 'Architecture', desc: 'Raw SQL concatenation, missing limits, unindexed queries.' },
    { id: 'framework-practices', label: 'Framework Practices', category: 'Architecture', desc: 'React hook misuse, Vue Options API in Vue 3.' },
    { id: 'workspace-health', label: 'Workspace Health', category: 'Architecture', desc: 'Circular imports, mismatched dependency versions.' },
    { id: 'unused-deps', label: 'Unused Dependencies', category: 'Architecture', desc: 'Packages in package.json with no import references.' },
    { id: 'api-contract', label: 'API Contract', category: 'Architecture', desc: 'REST endpoints with no frontend call, GraphQL types without resolvers, stale OpenAPI specs.' },
    { id: 'production-leak', label: 'Production Leak', category: 'Architecture', desc: 'Mock/fixture/sample data paths in production code.' },
    { id: 'mock-path-leak', label: 'Mock Path Leak', category: 'Architecture', desc: 'Mock/fixture paths referenced in production code.' },
    { id: 'sample-json-ref', label: 'Sample JSON Ref', category: 'Architecture', desc: 'Sample JSON files referenced in production code.' },
    { id: 'architecture-drift', label: 'Architecture Drift', category: 'Architecture', desc: 'Hybrid/SSM model identifiers without schema validators.' },
    { id: 'roadmap-marker', label: 'Roadmap Marker', category: 'Architecture', desc: 'Unresolved HACK/XXX/WORKAROUND markers.' },
    { id: 'fix-preview', label: 'Fix Preview', category: 'Architecture', desc: 'Before/after code diffs with copyable patches.' },
    // UX & Accessibility
    { id: 'accessibility', label: 'Accessibility', category: 'UX & Accessibility', desc: 'Missing alt text, unlabeled inputs, color-only indicators.' },
    { id: 'i18n', label: 'i18n Readiness', category: 'UX & Accessibility', desc: 'Hardcoded UI strings, locale-ignorant formatting.' },
    { id: 'governance-marker', label: 'Governance Marker', category: 'UX & Accessibility', desc: 'License and copyright markers for open-source compliance.' }
];
const OPTIONAL_COMPLETE_ENGINES = [
    { id: 'eu-ai-act', label: 'EU AI Act sprint', hint: 'Regulatory — not included in ZIP unless checked and completed' }
];
const COMPLETE_ENGINE_ORDER = [...COMPLETE_STEPS.map((step) => step.id), ...OPTIONAL_COMPLETE_ENGINES.map((step) => step.id)];
const CORE_ENGINE_IDS = new Set([
    'simplebeacon', 'consolidation', 'mock-scan', 'roadmap', 'codebase',
    'file-reduction', 'data-quality', 'cleanup-assistant', 'npm-audit',
    'compliance', 'eu-ai-act'
]);
const BROWSER_ANALYZER_IDS = COMPLETE_STEPS
    .map((step) => step.id)
    .filter((id) => !CORE_ENGINE_IDS.has(id));
const ENGINE_DEPENDENCIES = {
    'mock-scan': ['simplebeacon'],
    compliance: ['simplebeacon']
};
/** Scan preset definitions for quick-selection buttons */
const SCAN_PRESETS = [
    { id: 'essential', label: 'Essential', icon: '⚡', engines: ['simplebeacon', 'consolidation', 'mock-scan', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup-assistant', 'npm-audit', 'compliance'] },
    { id: 'security', label: 'Security', icon: '🔒', engines: ['simplebeacon', 'consolidation', 'mock-scan', 'roadmap', 'codebase', 'file-reduction', 'data-quality', 'cleanup-assistant', 'npm-audit', 'compliance', 'dependency-vulns', 'sensitive-data', 'security-headers', 'config-drift', 'eval-danger', 'inner-html-xss', 'prototype-pollution', 'unvalidated-redirect', 'missing-rate-limit', 'insecure-random', 'logging-secrets'] },
    { id: 'full', label: 'Full', icon: '🔬', engines: [...COMPLETE_ENGINE_ORDER] },
    { id: 'custom', label: 'Custom', icon: '🔧', engines: [] }
];
/** Group engines by their category field */
function groupEnginesByCategory(engineIds) {
    const groups = new Map();
    for (const id of engineIds) {
        const step = COMPLETE_STEPS.find((s) => s.id === id);
        const opt = OPTIONAL_COMPLETE_ENGINES.find((s) => s.id === id);
        const category = (step === null || step === void 0 ? void 0 : step.category) || (opt === null || opt === void 0 ? void 0 : opt.category) || 'Other';
        if (!groups.has(category))
            groups.set(category, []);
        groups.get(category).push({ id, label: (step === null || step === void 0 ? void 0 : step.label) || (opt === null || opt === void 0 ? void 0 : opt.label) || id, desc: (step === null || step === void 0 ? void 0 : step.desc) || (opt === null || opt === void 0 ? void 0 : opt.hint) || '', optional: !!opt });
    }
    return groups;
}
/** Engines that fetch their own prerequisites — no separate queue rows on Complete. */
const SELF_CONTAINED_ENGINES = new Set(['cleanup-assistant', 'mock-scan', 'compliance']);
/**
 * Is self contained only selection.
 * @param {Array} selectedEngines
 * @returns {any}
 */
function isSelfContainedOnlySelection(selectedEngines) {
    const selected = normalizeSelectedEngines(selectedEngines, { allowEmpty: true });
    return selected.length === 1 && SELF_CONTAINED_ENGINES.has(selected[0]);
}
/**
 * Default selected engines.
 * @returns {any}
 */
function defaultSelectedEngines() {
    return COMPLETE_STEPS.map((step) => step.id);
}
/** Client deliverable SKUs — scans preset per row; price is list/reference (checkout is separate). */
const CLIENT_DELIVERABLE_PLANS = [
    {
        sku: 'moneyPrinter19',
        label: 'Money Printer Tier',
        price: '$19',
        category: 'Instant audit',
        tagline: 'Website Security Report — instant audit · zero-retention · delivered in 60 seconds',
        engines: ['simplebeacon'],
        analysisType: 'simplebeacon',
        scans: ['SEO', 'SSL', 'Mobile responsiveness', 'Speed', 'Accessibility', 'Headers']
    },
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
        scans: ['Manual engine toggles — no fixed list price']
    }
];
const PRICING_DELIVERABLES_URL = 'https://simplebeacon.ai/pricing#client-deliverables';
/**
 * Get client deliverable plan.
 * @param {any} sku
 * @returns {any}
 */
function getClientDeliverablePlan(sku) {
    return CLIENT_DELIVERABLE_PLANS.find((plan) => plan.sku === sku) || null;
}
/**
 * Get deliverable plan engines.
 * @param {any} plan
 * @returns {any}
 */
function getDeliverablePlanEngines(plan) {
    if (!plan || plan.allowManual)
        return null;
    return Array.isArray(plan.engines) ? plan.engines : null;
}
/**
 * Infer deliverable sku.
 * @param {Array} selectedEngines
 * @returns {any}
 */
function inferDeliverableSku(selectedEngines) {
    const selected = new Set(normalizeSelectedEngines(selectedEngines, { allowEmpty: true }));
    for (const plan of CLIENT_DELIVERABLE_PLANS) {
        const expected = getDeliverablePlanEngines(plan);
        if (!expected)
            continue;
        const want = new Set(expected);
        if (want.size === selected.size && [...want].every((id) => selected.has(id))) {
            return plan.sku;
        }
    }
    return 'custom';
}
/**
 * Normalize selected engines.
 * @param {any} raw
 * @param {Object} options
 * @returns {any}
 */
function normalizeSelectedEngines(raw, { allowEmpty = false } = {}) {
    const allowed = new Set(COMPLETE_ENGINE_ORDER);
    const selected = Array.isArray(raw)
        ? raw.filter((id) => allowed.has(id))
        : defaultSelectedEngines();
    if (!selected.length && allowEmpty)
        return [];
    return selected.length ? selected : defaultSelectedEngines();
}
/**
 * Resolve engines for run.
 * @param {Array} selectedEngines
 * @returns {any}
 */
function resolveEnginesForRun(selectedEngines) {
    const selected = new Set(normalizeSelectedEngines(selectedEngines));
    for (const [engineId, deps] of Object.entries(ENGINE_DEPENDENCIES)) {
        if (!selected.has(engineId))
            continue;
        for (const dep of deps)
            selected.add(dep);
    }
    return COMPLETE_ENGINE_ORDER.filter((id) => selected.has(id));
}
/** Keep queue checkboxes aligned for explicit co-selection (Complete scan deps use resolveEnginesForRun). */
function applyEngineSelectionChange(selectedSet, engineId, checked) {
    if (!engineId || !selectedSet)
        return;
    if (checked) {
        selectedSet.add(engineId);
        // Auto-select dependencies so the UI reflects what will actually run
        const deps = ENGINE_DEPENDENCIES[engineId];
        if (deps) {
            for (const dep of deps)
                selectedSet.add(dep);
        }
        return;
    }
    selectedSet.delete(engineId);
    // When codebase is unchecked, also uncheck every engine that depends on it
    if (engineId === 'codebase') {
        for (const [id, deps] of Object.entries(ENGINE_DEPENDENCIES)) {
            if (deps.includes('codebase'))
                selectedSet.delete(id);
        }
    }
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
/**
 * Queue select all state.
 * @param {Array} selectedEngines
 * @returns {any}
 */
function queueSelectAllState(selectedEngines) {
    const queueEngineIds = queueEnginesForDisplay();
    const selected = new Set(selectedEngines || []);
    const allSelected = queueEngineIds.every((id) => selected.has(id));
    const someSelected = queueEngineIds.some((id) => selected.has(id));
    return { queueEngineIds, allSelected, someSelected };
}
/**
 * Get complete engine label.
 * @param {string} engineId
 * @returns {any}
 */
function getCompleteEngineLabel(engineId) {
    var _a, _b;
    return ((_a = COMPLETE_STEPS.find((step) => step.id === engineId)) === null || _a === void 0 ? void 0 : _a.label)
        || ((_b = OPTIONAL_COMPLETE_ENGINES.find((step) => step.id === engineId)) === null || _b === void 0 ? void 0 : _b.label)
        || engineId;
}
/**
 * Get engine mode meta.
 * @param {string} engineId
 * @returns {any}
 */
function getEngineModeMeta(engineId) {
    return ANALYSIS_MODES.find((m) => modeToEngineId(m.value) === engineId) || null;
}
/**
 * Mode to engine id.
 * @param {any} modeValue
 * @returns {any}
 */
function modeToEngineId(modeValue) {
    const normalizedMode = String(modeValue || '');
    if (!normalizedMode || normalizedMode === 'complete' || normalizedMode === 'auto')
        return null;
    return COMPLETE_ENGINE_ORDER.includes(normalizedMode) ? normalizedMode : null;
}
const SIMPLEBEACON_GATE_RULES = [
    { id: 'credentials', label: 'Credential & secret patterns in scan paths + production dirs' },
    { id: 'production-leak', label: 'Mock/sample JSON paths referenced from production code' },
    { id: 'json-schema', label: 'Registered page samples match schema specs' },
    { id: 'sample-consistency', label: 'Anchor sample consistency / fiction KPI drift' },
    { id: 'fiction-kpi-patterns', label: 'Fiction KPI placeholders across repository JSON' },
    { id: 'llm-slop-patterns', label: 'LLM slop — unresolved placeholders, code fences, filler metrics' },
    { id: 'agency-handoff-patterns', label: 'Agency handoff — localhost deploy leaks, auth misconfig, webhooks' }, // simplebeacon-ignore hardcoded-url — rule label text, not a URL
    { id: 'file-naming-patterns', label: 'File naming — AI-generated or low-quality file names that degrade code readability' },
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
const FILE_REDUCTION_SCANNERS = ['build-artifacts', 'asset-consolidation', 'unused-files', 'directory-bloat'];
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
/**
 * Complete step label.
 * @param {number} index
 * @param {string} text
 * @param {Array} totalSteps
 * @returns {any}
 */
function completeStepLabel(index, text, totalSteps = COMPLETE_ENGINE_ORDER.length) {
    return `${index + 1}/${totalSteps} ${text}`;
}
/**
 * Resolve complete scan counts.
 * @param {string} lastResult
 * @returns {any}
 */
function resolveCompleteScanCounts(lastResult) {
    var _a, _b, _c;
    const steps = (lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) || [];
    const enginesRun = ((_a = lastResult === null || lastResult === void 0 ? void 0 : lastResult.enginesRun) === null || _a === void 0 ? void 0 : _a.length)
        ? lastResult.enginesRun
        : ((_c = (_b = lastResult === null || lastResult === void 0 ? void 0 : lastResult.analysisConfig) === null || _b === void 0 ? void 0 : _b.enginesRun) === null || _c === void 0 ? void 0 : _c.length)
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
/**
 * Format scan progress details.
 * @param {any} sp
 * @param {Object} options
 * @returns {any}
 */
function formatScanProgressDetails(sp, options = {}) {
    if (!sp || sp.active === false)
        return { counter: '', scopeNote: '' };
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
    }
    else if (sp.fileKind === 'scan-scoped') {
        phaseLabel = 'Gate walk';
    }
    else if (phase === 'codebase' || sp.fileKind === 'code') {
        phaseLabel = /eslint/i.test(label) ? 'ESLint' : 'Code analysis';
        unit = /eslint/i.test(label) ? 'lint targets' : 'code files';
    }
    else if (phase === 'gate') {
        phaseLabel = 'Simplebeacon gate';
    }
    let counter = '';
    if (processed != null && total != null) {
        counter = `${phaseLabel} · ${formatNumber(processed)} / ${formatNumber(total)} ${unit}`;
    }
    else if (phaseLabel) {
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
        scopeParts.push(strictFullTree
            ? 'Every file under the selected path is included (node_modules, etc.) — skips .git, .github-sync CLI mirror, and github-cache benchmark clones only.'
            : `This step scans ${formatNumber(total)} files after skipping ${skipped.length ? skipped.join(', ') : 'configured dirs'}.`);
        if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && Math.abs(explorer.totalFiles - total) > 50) {
            const folderPart = explorer.totalFolders != null
                ? ` / ${formatNumber(explorer.totalFolders)} folders`
                : '';
            scopeParts.push(`Repository inventory for the same path: ${formatNumber(explorer.totalFiles)} files${folderPart}.`);
        }
    }
    else if (phase === 'codebase' || sp.fileKind === 'code') {
        scopeParts.push('Source-code extensions only (.js, .ts, .py, …) — not images, JSON, or other assets.');
        if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && total != null && explorer.totalFiles !== total) {
            scopeParts.push(`Folder holds ${formatNumber(explorer.totalFiles)} files total; this step covers ${formatNumber(total)} ${unit}.`);
        }
    }
    else if ((explorer === null || explorer === void 0 ? void 0 : explorer.totalFiles) != null && total != null && explorer.totalFiles !== total) {
        scopeParts.push(`Folder inventory: ${formatNumber(explorer.totalFiles)} files${explorer.totalFolders != null ? `, ${formatNumber(explorer.totalFolders)} folders` : ''}; active scan: ${formatNumber(total)} ${unit}.`);
    }
    else if (sp.repositoryAuditFiles != null && total != null && sp.repositoryAuditFiles !== total) {
        scopeParts.push(`${formatNumber(sp.repositoryAuditFiles)} audit-scoped repo files (skips node_modules, github-cache, etc.).`);
    }
    return { counter, scopeNote: scopeParts.join(' ').trim() };
}
/**
 * Summarize complete step metric.
 * @param {string} engineId
 * @param {any} result
 * @param {number} canonicalCount
 * @returns {any}
 */
function summarizeCompleteStepMetric(engineId, result, canonicalCount = null) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34;
    if (!result)
        return '';
    switch (engineId) {
        case 'simplebeacon': {
            const m = getScanFileMetrics(result.report);
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : m.repositoryFiles;
            const parts = [];
            if (m.ruleScopedFilesAnalyzed != null) {
                parts.push(`${formatNumber(m.ruleScopedFilesAnalyzed)} analyzed`);
            }
            if (count != null && count !== m.ruleScopedFilesAnalyzed) {
                parts.push(`${formatNumber(count)} total`);
            }
            return parts.join(' · ');
        }
        case 'consolidation': {
            const count = (_f = (_c = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_b = (_a = result.scan) === null || _a === void 0 ? void 0 : _a.summary) === null || _b === void 0 ? void 0 : _b.repositoryFilesTotal) !== null && _c !== void 0 ? _c : (_e = (_d = result.scan) === null || _d === void 0 ? void 0 : _d.repositoryInventory) === null || _e === void 0 ? void 0 : _e.totalFiles) !== null && _f !== void 0 ? _f : (_h = (_g = result.scan) === null || _g === void 0 ? void 0 : _g.summary) === null || _h === void 0 ? void 0 : _h.filesAnalyzed;
            return count != null ? `${formatNumber(count)} files` : '';
        }
        case 'mock-scan': {
            /**
             * Hits.
             * @param {any} result.fictionIssues || []
             * @returns {any}
             */
            const hits = (result.fictionIssues || []).reduce((sum, item) => sum + (item.count || 1), 0);
            const m = getScanFileMetrics(result.report);
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : m.mockSampleFiles;
            if (count != null && hits) {
                return `${formatNumber(count)} sample files · ${formatNumber(hits)} KPI hits`;
            }
            if (count != null)
                return `${formatNumber(count)} sample files`;
            return hits ? `${formatNumber(hits)} KPI hits` : '';
        }
        case 'roadmap': {
            const count = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_l = (_k = (_j = result.roadmap) === null || _j === void 0 ? void 0 : _j.codeAnalysis) === null || _k === void 0 ? void 0 : _k.structure) === null || _l === void 0 ? void 0 : _l.totalFiles;
            return count != null ? `${formatNumber(count)} files scanned` : '';
        }
        case 'codebase': {
            const count = (_s = (_p = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_o = (_m = result.report) === null || _m === void 0 ? void 0 : _m.summary) === null || _o === void 0 ? void 0 : _o.codeFilesAnalyzed) !== null && _p !== void 0 ? _p : (_r = (_q = result.report) === null || _q === void 0 ? void 0 : _q.summary) === null || _r === void 0 ? void 0 : _r.filesAnalyzed) !== null && _s !== void 0 ? _s : (_t = result.report) === null || _t === void 0 ? void 0 : _t.filesAnalyzed;
            return count != null ? `${formatNumber(count)} code files` : '';
        }
        case 'file-reduction': {
            const findings = (_x = (_v = (_u = result.summary) === null || _u === void 0 ? void 0 : _u.totalFindings) !== null && _v !== void 0 ? _v : (_w = result.summary) === null || _w === void 0 ? void 0 : _w.mergeCandidates) !== null && _x !== void 0 ? _x : null;
            const count = (_2 = (_z = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_y = result.inventory) === null || _y === void 0 ? void 0 : _y.totalFiles) !== null && _z !== void 0 ? _z : (_1 = (_0 = result.scan) === null || _0 === void 0 ? void 0 : _0.inventory) === null || _1 === void 0 ? void 0 : _1.totalFiles) !== null && _2 !== void 0 ? _2 : (_4 = (_3 = result.scan) === null || _3 === void 0 ? void 0 : _3.repositoryInventory) === null || _4 === void 0 ? void 0 : _4.totalFiles;
            if (findings != null && count != null) {
                return `${formatNumber(findings)} finding${findings === 1 ? '' : 's'} · ${formatNumber(count)} files inventoried`;
            }
            return count != null ? `${formatNumber(count)} files inventoried` : '';
        }
        case 'data-quality': {
            const count = (_9 = (_6 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_5 = result.inventory) === null || _5 === void 0 ? void 0 : _5.totalFiles) !== null && _6 !== void 0 ? _6 : (_8 = (_7 = result.scan) === null || _7 === void 0 ? void 0 : _7.inventory) === null || _8 === void 0 ? void 0 : _8.totalFiles) !== null && _9 !== void 0 ? _9 : (_11 = (_10 = result.scan) === null || _10 === void 0 ? void 0 : _10.repositoryInventory) === null || _11 === void 0 ? void 0 : _11.totalFiles;
            return count != null ? `${formatNumber(count)} files inventoried` : '';
        }
        case 'cleanup-assistant': {
            const count = (_13 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_12 = result.repositoryInventory) === null || _12 === void 0 ? void 0 : _12.totalFiles) !== null && _13 !== void 0 ? _13 : (_15 = (_14 = result.brief) === null || _14 === void 0 ? void 0 : _14.projectedInventory) === null || _15 === void 0 ? void 0 : _15.totalFiles;
            return count != null ? `${formatNumber(count)} files in brief` : '';
        }
        case 'npm-audit': {
            const n = (_18 = (_17 = (_16 = result.npmAudit) === null || _16 === void 0 ? void 0 : _16.summary) === null || _17 === void 0 ? void 0 : _17.total) !== null && _18 !== void 0 ? _18 : (_20 = (_19 = result.npmAudit) === null || _19 === void 0 ? void 0 : _19.vulnerabilities) === null || _20 === void 0 ? void 0 : _20.length;
            return n != null ? `${formatNumber(n)} vulnerabilities` : '';
        }
        case 'compliance': {
            const total = checklistRuleTotal(result.checklist);
            const passed = (_22 = (_21 = result.checklist) === null || _21 === void 0 ? void 0 : _21.summary) === null || _22 === void 0 ? void 0 : _22.passed;
            return passed != null && total ? `${passed}/${total} rules passed` : '';
        }
        case 'eu-ai-act': {
            const count = (_25 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_24 = (_23 = result.sprint) === null || _23 === void 0 ? void 0 : _23.report) === null || _24 === void 0 ? void 0 : _24.repositoryFilesTotal) !== null && _25 !== void 0 ? _25 : (_28 = (_27 = (_26 = result.sprint) === null || _26 === void 0 ? void 0 : _26.report) === null || _27 === void 0 ? void 0 : _27.repositoryInventory) === null || _28 === void 0 ? void 0 : _28.totalFiles;
            return count != null ? `${formatNumber(count)} files audited` : '';
        }
        default: {
            const findings = (_31 = (_29 = result === null || result === void 0 ? void 0 : result.findingsCount) !== null && _29 !== void 0 ? _29 : (_30 = result === null || result === void 0 ? void 0 : result.category) === null || _30 === void 0 ? void 0 : _30.count) !== null && _31 !== void 0 ? _31 : null;
            const files = (_34 = (_32 = result === null || result === void 0 ? void 0 : result.fileCount) !== null && _32 !== void 0 ? _32 : (_33 = result === null || result === void 0 ? void 0 : result.category) === null || _33 === void 0 ? void 0 : _33.fileCount) !== null && _34 !== void 0 ? _34 : 0;
            if (findings != null) {
                return `${findings} finding${findings === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}`;
            }
            return '';
        }
    }
}
/**
 * Format complete step line.
 * @param {any} step
 * @returns {any}
 */
function formatCompleteStepLine(step) {
    const metric = step.metric ? ` · ${step.metric}` : '';
    const err = step.error ? ` — ${step.error}` : '';
    return `${step.label}${metric}${err}`;
}
/**
 * Render browser analyzer result.
 * @param {any} step
 * @param {Array} errors
 * @returns {any}
 */
function renderBrowserAnalyzerResult(step, errors = []) {
    var _a, _b, _c, _d, _e, _f, _g;
    const label = getCompleteEngineLabel(step.id);
    const metric = summarizeCompleteStepMetric(step.id, step);
    const error = ((_a = errors.find((e) => { var _a; return (_a = e.step) === null || _a === void 0 ? void 0 : _a.includes(label); })) === null || _a === void 0 ? void 0 : _a.message) || '';
    const findingsCount = (_d = (_b = step.findingsCount) !== null && _b !== void 0 ? _b : (_c = step.category) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0;
    const fileCount = (_g = (_e = step.fileCount) !== null && _e !== void 0 ? _e : (_f = step.category) === null || _f === void 0 ? void 0 : _f.fileCount) !== null && _g !== void 0 ? _g : 0;
    const hasFindings = findingsCount > 0;
    const findings = step.findings || [];
    const findingsTable = findings.length
        ? `<table class="results-table mt-3">
        <thead>
          <tr><th>Severity</th><th>File</th><th>Line</th><th>Description</th><th>Recommended Action</th></tr>
        </thead>
        <tbody>
          ${findings.map((f) => {
            var _a;
            return `
            <tr>
              <td><span class="severity-pill ${escapeHtml(f.severity || 'low')}">${escapeHtml(f.severity || 'low')}</span></td>
              <td><code>${escapeHtml(f.filePath ? f.filePath.split('/').pop().split('\\').pop() : '—')}</code></td>
              <td>${(_a = f.line) !== null && _a !== void 0 ? _a : '—'}</td>
              <td>${escapeHtml(f.description || f.type || '—')}</td>
              <td>${escapeHtml(f.recommendedAction || 'Review and fix manually')}</td>
            </tr>
          `;
        }).join('')}
        </tbody>
      </table>
      <div class="flex gap-2 mt-3">
        <button type="button" class="btn btn-secondary btn-sm analyze-download-step-json" data-step-id="${escapeHtml(step.id)}" title="Download raw JSON for this category">Download JSON</button>
      </div>
      ${findingsCount > findings.length ? `<p class="text-muted mt-2">+ ${findingsCount - findings.length} more finding(s) in JSON download.</p>` : ''}`
        : '';
    return `
    <details class="card mb-4">
      <summary><strong>${escapeHtml(label)}</strong> ${error ? '⚠️' : '✅'} <span class="text-muted" style="font-weight:400;">${escapeHtml(metric || 'No findings')}</span></summary>
      <div class="mt-4">
        ${error ? `<p class="text-muted" style="color: var(--warning-color, #f59e0b);">${escapeHtml(error)}</p>` : ''}
        ${hasFindings
        ? `<p class="text-muted">${formatNumber(findingsCount)} finding${findingsCount === 1 ? '' : 's'} in ${formatNumber(fileCount)} file${fileCount === 1 ? '' : 's'}</p>${findingsTable}`
        : '<p class="text-muted">No findings detected.</p>'}
      </div>
    </details>
  `;
}
/**
 * Checklist rule total.
 * @param {any} checklist
 * @returns {any}
 */
function checklistRuleTotal(checklist) {
    var _a;
    const fromSummary = (_a = checklist === null || checklist === void 0 ? void 0 : checklist.summary) === null || _a === void 0 ? void 0 : _a.total;
    if (Number.isFinite(fromSummary) && fromSummary > 0)
        return fromSummary;
    const fromRules = ((checklist === null || checklist === void 0 ? void 0 : checklist.rules) || []).length;
    return fromRules > 0 ? fromRules : 0;
}
/**
 * Normalize path key.
 * @param {any} value
 * @returns {any}
 */
function normalizePathKey(value) {
    return String(value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}
/**
 * Render compliance checklist panel.
 * @param {any} checklist
 * @param {Object} options
 * @returns {any}
 */
function renderComplianceChecklistPanel(checklist, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const downloadId = (_a = options.downloadButtonId) !== null && _a !== void 0 ? _a : 'download-compliance-json';
    if (!checklist) {
        return '<p class="text-muted mt-4">Compliance checklist did not run.</p>';
    }
    const ruleTotal = checklistRuleTotal(checklist);
    const profileLabel = options.profileLabel
        || (((_b = checklist.summary) === null || _b === void 0 ? void 0 : _b.checklistProfile) === 'eu-ai-act' ? 'EU AI Act technical (10 rules)' : 'Corporate safety (8 rules)');
    const notHandoff = ((_c = checklist.summary) === null || _c === void 0 ? void 0 : _c.benchmarkScan) || ((_d = checklist.summary) === null || _d === void 0 ? void 0 : _d.hollowGate) || ((_e = checklist.summary) === null || _e === void 0 ? void 0 : _e.handoffEligible) === false;
    const passHandoff = options.handoffEligible === true || ((_f = checklist.summary) === null || _f === void 0 ? void 0 : _f.handoffEligible) === true;
    const legalReady = ((_g = checklist.summary) === null || _g === void 0 ? void 0 : _g.legalHandoffEligible) === true;
    const callout = notHandoff && ((_h = checklist.summary) === null || _h === void 0 ? void 0 : _h.headline)
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
      <div class="metric-chip gate-badge ${((_j = checklist.summary) === null || _j === void 0 ? void 0 : _j.failed) ? 'warn' : 'pass'}">
        ${(_l = (_k = checklist.summary) === null || _k === void 0 ? void 0 : _k.passed) !== null && _l !== void 0 ? _l : 0}/${ruleTotal} passed
      </div>
      <div class="metric-chip"><strong>${(_o = (_m = checklist.summary) === null || _m === void 0 ? void 0 : _m.failed) !== null && _o !== void 0 ? _o : 0}</strong> failed</div>
      ${((_p = checklist.summary) === null || _p === void 0 ? void 0 : _p.skipped) ? `<div class="metric-chip"><strong>${checklist.summary.skipped}</strong> skipped</div>` : ''}
      ${((_q = checklist.summary) === null || _q === void 0 ? void 0 : _q.readyForAutomation) === false ? '<div class="metric-chip"><strong>Not automation-ready</strong></div>' : ''}
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
/**
 * Render npm audit panel.
 * @param {any} npmAudit
 * @param {Object} options
 * @returns {any}
 */
function renderNpmAuditPanel(npmAudit, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const downloadId = (_a = options.downloadButtonId) !== null && _a !== void 0 ? _a : 'download-npm-audit-json';
    if (!npmAudit || npmAudit.error) {
        return `<p class="text-muted mt-4">${escapeHtml((npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.error) || 'npm audit did not run.')}</p>`;
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
        || (((_b = npmAudit.summary) === null || _b === void 0 ? void 0 : _b.critical) === 0 && ((_c = npmAudit.summary) === null || _c === void 0 ? void 0 : _c.high) === 0 ? 'pass' : 'review');
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
      <div class="metric-chip"><strong>${(_g = (_e = (_d = npmAudit.summary) === null || _d === void 0 ? void 0 : _d.dependencies) !== null && _e !== void 0 ? _e : (_f = npmAudit.dependencies) === null || _f === void 0 ? void 0 : _f.total) !== null && _g !== void 0 ? _g : '—'}</strong> dependencies</div>
      <div class="metric-chip"><strong>${(_k = (_j = (_h = npmAudit.summary) === null || _h === void 0 ? void 0 : _h.total) !== null && _j !== void 0 ? _j : npmAudit.vulnerabilityTotal) !== null && _k !== void 0 ? _k : 0}</strong> vulnerabilities</div>
      ${((_l = npmAudit.summary) === null || _l === void 0 ? void 0 : _l.critical) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.critical}</strong> critical</div>` : ''}
      ${((_m = npmAudit.summary) === null || _m === void 0 ? void 0 : _m.high) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.high}</strong> high</div>` : ''}
      ${((_o = npmAudit.summary) === null || _o === void 0 ? void 0 : _o.moderate) != null ? `<div class="metric-chip"><strong>${npmAudit.summary.moderate}</strong> moderate</div>` : ''}
    </div>
    ${downloadId ? `<button type="button" class="btn btn-secondary btn-sm mb-4" id="${escapeHtml(downloadId)}">Download npm audit JSON</button>` : ''}
  `;
}
/**
 * Render eu ai act sprint panel.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
function renderEuAiActSprintPanel(sprint, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
    if (!sprint) {
        return '<p class="text-muted mt-4">EU AI Act sprint did not run.</p>';
    }
    const s = sprint;
    const failedRules = ((_a = s.compliance) === null || _a === void 0 ? void 0 : _a.failedRules) || [];
    const failedRulesHtml = failedRules.length
        ? `<ul class="analyze-mode-steps mb-4">${failedRules.map((rule) => `
        <li><strong>${escapeHtml(rule.id)}</strong> — ${escapeHtml(rule.title || '')}
          <span class="text-muted"> (${escapeHtml(rule.evidence || '')})</span></li>
      `).join('')}</ul>`
        : '';
    const downloadId = (_b = options.downloadButtonId) !== null && _b !== void 0 ? _b : 'download-eu-compliance-json';
    const showIntro = options.showIntro !== false;
    const showActions = options.showActions !== false;
    // Categorize rules by EU AI Act article
    const rules = ((_c = s.complianceChecklist) === null || _c === void 0 ? void 0 : _c.rules) || ((_d = s.compliance) === null || _d === void 0 ? void 0 : _d.rules) || [];
    const art5Rules = rules.filter(r => /ART-5|prohibited|banned|subliminal|manipulation|social scoring|biometric.*mass/i.test((r.id || '') + ' ' + (r.title || '')));
    const art50Rules = rules.filter(r => /T50|transparency|disclosure|article.*50/i.test((r.id || '') + ' ' + (r.title || '')));
    const otherRules = rules.filter(r => !art5Rules.includes(r) && !art50Rules.includes(r));
    const art5Status = art5Rules.length ? (art5Rules.every(r => r.status === 'pass') ? 'pass' : 'warn') : 'pass';
    const art50Status = art50Rules.length ? (art50Rules.every(r => r.status === 'pass') ? 'pass' : 'warn') : 'info';
    const highRiskStatus = ((_e = s.summary) === null || _e === void 0 ? void 0 : _e.highRiskIndicators) > 0 ? 'warn' : 'pass';
    const aiSystemStatus = ((_f = s.summary) === null || _f === void 0 ? void 0 : _f.aiSystemIndicators) > 0 ? 'info' : 'pass';
    /**
     * Render article card.
     * @param {any} title
     * @param {any} article
     * @param {Array} status
     * @param {any} rulesList
     * @param {any} description
     * @returns {any}
     */
    const renderArticleCard = (title, article, status, rulesList, description) => {
        const badgeClass = status === 'pass' ? 'pass' : status === 'warn' ? 'warn' : 'info';
        const badgeText = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'INFO';
        return `
      <div class="card mb-3" style="border-left: 4px solid var(--${badgeClass === 'pass' ? 'color-success' : badgeClass === 'warn' ? 'warning-color' : 'accent-color'}, ${badgeClass === 'pass' ? '#22c55e' : badgeClass === 'warn' ? '#f59e0b' : '#3b82f6'});">
        <div style="padding: 16px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <h4 style="margin:0;font-size:0.95rem;font-weight:600;">${escapeHtml(title)}</h4>
            <span class="metric-chip gate-badge ${badgeClass}" style="font-size:0.75rem;">${badgeText}</span>
          </div>
          <p style="margin:0 0 8px;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(article)}</p>
          ${description ? `<p style="margin:0 0 12px;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(description)}</p>` : ''}
          ${rulesList.length ? `
            <ul style="margin:0;padding-left:18px;font-size:0.8rem;color:var(--text-muted);">
              ${rulesList.map(r => `<li><strong>${escapeHtml(r.id)}</strong> — ${escapeHtml(r.title || '')} <span style="color:${r.status === 'pass' ? 'var(--color-success,#22c55e)' : 'var(--warning-color,#f59e0b)'};">(${escapeHtml(r.status || 'unknown')})</span></li>`).join('')}
            </ul>
          ` : `<p style="margin:0;font-size:0.8rem;color:var(--text-muted);">No specific rules triggered.</p>`}
        </div>
      </div>
    `;
    };
    return `
    ${showIntro ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">
      <strong>Reference scan</strong> — not an active paid SKU. EU pattern hits flag AI integrations (usually MEDIUM warnings).
      Gate FAIL means ${(_h = (_g = s.gate) === null || _g === void 0 ? void 0 : _g.blockingCount) !== null && _h !== void 0 ? _h : '—'} HIGH-severity blocking issue(s) under <code>failOn: high</code>.
    </p>` : ''}

    <div class="metrics-row mb-4">
      <div class="metric-chip gate-badge ${((_j = s.gate) === null || _j === void 0 ? void 0 : _j.pass) ? 'pass' : 'warn'}">${((_k = s.gate) === null || _k === void 0 ? void 0 : _k.pass) ? 'PASS' : 'FAIL'}</div>
      <div class="metric-chip"><strong>${(_m = (_l = s.gate) === null || _l === void 0 ? void 0 : _l.blockingCount) !== null && _m !== void 0 ? _m : '—'}</strong> blocking (high)</div>
      <div class="metric-chip"><strong>${(_q = (_p = (_o = s.gate) === null || _o === void 0 ? void 0 : _o.warningCount) !== null && _p !== void 0 ? _p : s.euPatternHits) !== null && _q !== void 0 ? _q : '—'}</strong> warnings (medium)</div>
      <div class="metric-chip"><strong>${(_s = (_r = s.compliance) === null || _r === void 0 ? void 0 : _r.passed) !== null && _s !== void 0 ? _s : 0}/${(_u = (_t = s.compliance) === null || _t === void 0 ? void 0 : _t.total) !== null && _u !== void 0 ? _u : 0}</strong> checklist</div>
      <div class="metric-chip"><strong>${(_w = (_v = s.compliance) === null || _v === void 0 ? void 0 : _v.score) !== null && _w !== void 0 ? _w : '—'}%</strong> readiness</div>
      ${s.scannedAt || s.timestamp ? `<div class="metric-chip" style="font-size:0.75rem;color:var(--text-muted);">Scanned: ${escapeHtml(new Date(s.scannedAt || s.timestamp).toLocaleString())}</div>` : ''}
    </div>

    ${renderArticleCard('Prohibited AI Practices', 'Article 5 — Subliminal manipulation, social scoring, biometric mass surveillance', art5Status, art5Rules, art5Status === 'pass' ? 'No prohibited practices detected.' : 'Review required: potential high-risk indicators found.')}

    ${renderArticleCard('Transparency Obligations', 'Article 50 — AI disclosure to users, content labeling, system documentation', art50Status, art50Rules, 'Ensure AI-generated content is disclosed to end users.')}

    ${renderArticleCard('High-Risk System Indicators', 'Annex III — Employment, credit, biometric, education, insurance, law enforcement', highRiskStatus, [], ((_x = s.summary) === null || _x === void 0 ? void 0 : _x.highRiskIndicators) > 0 ? `${s.summary.highRiskIndicators} high-risk pattern(s) detected.` : 'No Annex III high-risk patterns detected.')}

    ${renderArticleCard('AI System Detection', 'System inventory — LLM integrations, model inference, generative AI usage', aiSystemStatus, [], ((_y = s.summary) === null || _y === void 0 ? void 0 : _y.aiSystemIndicators) > 0 ? `${s.summary.aiSystemIndicators} AI system(s) detected in codebase.` : 'No AI systems detected.')}

    ${((_z = s.compliance) === null || _z === void 0 ? void 0 : _z.headline) ? `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);">${escapeHtml(s.compliance.headline)}</p>` : ''}
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
        <a class="btn btn-primary btn-sm" href="/dashboard/eu-ai-act">Open EU AI Act results</a>
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-secondary btn-sm" href="/eu-ai-act-sample-report" target="_blank" rel="noopener">Sample report layout</a>
        <a class="btn btn-ghost btn-sm" href="/dashboard/results">Gate blocking issues</a>
      </div>
    ` : `
      <div class="analyze-action-row mb-4">
        <button type="button" class="btn btn-accent btn-sm" id="download-eu-ai-act-pdf">Download EU PDF</button>
        <a class="btn btn-ghost btn-sm" href="/dashboard/eu-ai-act">Open EU AI Act page</a>
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
            'File reduction — build-artifacts, asset-consolidation, unused-files, directory-bloat (dry-run)',
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
        value: 'removable-files',
        group: 'standalone',
        label: 'Removable files',
        desc: 'node_modules, build artifacts, caches, logs, and temp files that can be safely deleted',
        icon: '🗑️',
        tag: 'Cleanup',
        steps: [
            'Scan for node_modules directories',
            'Detect build artifacts (dist, build, .next, out)',
            'Find cache directories (.cache, .turbo)',
            'Identify log and temp files',
            'List OS metadata files (.DS_Store, Thumbs.db)',
            'Calculate total reclaimable space'
        ],
        deliverable: 'Removable files report with reclaimable space'
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
        value: 'workspace-health',
        group: 'standalone',
        label: 'Workspace Health',
        desc: 'Circular imports, mismatched dependency versions, and barrel-file anti-patterns',
        icon: '⚙️',
        tag: 'Architecture',
        deliverable: 'Workspace health findings JSON'
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
/**
 * Get analysis mode.
 * @param {any} value
 * @returns {any}
 */
function getAnalysisMode(value) {
    return ANALYSIS_MODES.find((m) => m.value === value) || ANALYSIS_MODES[0];
}
/**
 * Is plausible project path.
 * @param {any} value
 * @returns {any}
 */
function isPlausibleProjectPath(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 280)
        return false;
    if (isRemoteRepoUrl(raw))
        return true;
    if (/outside allowed analysis roots|projectPath is required|projectPath is outside/i.test(raw)) {
        return false;
    }
    if (/allowedAnalysisRoots|ANALYZE_ALLOWED_ROOTS|restart the server/i.test(raw)) {
        return false;
    }
    if (/\.(bat|cmd|exe|ps1|sh|js|json|html?|md|txt)$/i.test(raw))
        return false;
    if (/^[a-zA-Z]:[\\/]/.test(raw))
        return true;
    if (raw.startsWith('\\\\') || raw.startsWith('/'))
        return true;
    if (/^[\w.-]+([\\/]|$)/.test(raw))
        return true;
    return false;
}
/**
 * Load analyze prefs.
 * @returns {any}
 */
function loadAnalyzePrefs() {
    try {
        const raw = localStorage.getItem(ANALYZE_PREFS_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch (_a) {
        return {};
    }
}
/**
 * Save analyze prefs.
 * @param {Array} prefs
 * @returns {any}
 */
function saveAnalyzePrefs(prefs) {
    const existing = loadAnalyzePrefs();
    localStorage.setItem(ANALYZE_PREFS_KEY, JSON.stringify({ ...existing, ...prefs }));
}
/**
 * Basename path.
 * @param {string} projectPath
 * @returns {any}
 */
function basenamePath(projectPath) {
    if (!projectPath)
        return '';
    const parts = projectPath.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || projectPath;
}
/**
 * Format elapsed.
 * @param {Array} ms
 * @returns {any}
 */
function formatElapsed(ms) {
    if (!ms || ms < 1000)
        return '<1s';
    const secs = Math.floor(ms / 1000);
    if (secs < 60)
        return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}
/**
 * Recursively walk a FileSystemEntry tree and collect all files.
 * @param {any} entry - FileSystemFileEntry or FileSystemDirectoryEntry
 * @param {string} relativePath
 * @param {{ file: File, path: string }[]} results
 */
async function traverseDirectoryEntry(entry, relativePath = '', results = []) {
    const currentPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file((file) => {
                results.push({ file, path: currentPath });
                resolve();
            }, () => resolve());
        });
    }
    if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise((resolve) => {
            reader.readEntries((items) => resolve(items || []), () => resolve([]));
        });
        for (const child of entries) {
            await traverseDirectoryEntry(child, currentPath, results);
        }
    }
}
/** EU AI Act Article 50: Users interact with an AI-assisted analysis system; responses may be AI-generated. */
export class AnalyzeView {
    constructor(app) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.app = app;
        this.busy = false;
        const prefs = loadAnalyzePrefs();
        this.aiProvider = prefs.aiProvider || 'demo';
        this.roadmapInsightsMode = prefs.roadmapInsightsMode || 'deterministic';
        this.understandingMode = prefs.understandingMode || 'deterministic';
        this.analysisType = ((_a = app.state.analyzeResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete'
            ? 'complete'
            : ((_b = app.state.analyzeResult) === null || _b === void 0 ? void 0 : _b.kind) === 'consolidation'
                ? 'consolidation'
                : ((_c = app.state.analyzeResult) === null || _c === void 0 ? void 0 : _c.kind) === 'codebase'
                    ? 'codebase'
                    : ((_d = app.state.analyzeResult) === null || _d === void 0 ? void 0 : _d.kind) === 'workspace-health'
                        ? 'workspace-health'
                        : ((_e = app.state.analyzeResult) === null || _e === void 0 ? void 0 : _e.kind) === 'eu-ai-act'
                            ? 'eu-ai-act'
                            : (prefs.analysisType || ((_g = (_f = app.state.analyzeResult) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.analysisType) || 'complete');
        this.lastResult = app.state.analyzeResult || null;
        // Auto-clear stale cached results that don't match current path input
        this.clearStaleResultIfPathMismatch();
        this.completeStep = '';
        this.completeProgress = null;
        this.scanStartedAt = null;
        this.scanProgress = null;
        this._progressPollTimer = null;
        this._terminalLogLines = [];
        this.providers = [];
        this.issueTaxonomyGroups = groupIssuesByCategory();
        this.selectedIssueIds = new Set(AI_SYSTEM_ISSUES.map((issue) => issue.id));
        this.aiIssueAnalysisResult = null;
        this.snippetResult = null;
        this.snippetBusy = false;
        this._euAiActRefreshTimer = null;
        this._lastEuAiActScanAt = null;
        this.fullDirectoryScan = true;
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
        }
        else if (isSelfContainedOnlySelection(this.selectedEngines)) {
            this.analysisType = this.selectedEngines[0];
            this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
        }
        this.scanNotes = '';
        this.testSources = [];
        this._onAiKeysUpdated = () => {
            var _a;
            const select = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#ai-provider-select');
            if (select)
                void this.loadProviders(select, { refresh: true });
        };
        this._pathUiTimer = null;
        this._queueExpanded = false;
        this.websiteMode = false;
        this.realtimeMonitorEnabled = false;
        this.localMode = prefs.localMode || false;
        this._vscodeApiCached = null;
        this.agentStatus = { available: false, scannerAvailable: false };
    }
    get vscodeEnhanced() {
        if (this._vscodeApiCached !== null)
            return !!this._vscodeApiCached;
        if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function') {
            this._vscodeApiCached = false;
            return false;
        }
        try {
            this._vscodeApiCached = !!window.acquireVsCodeApi();
            return this._vscodeApiCached;
        }
        catch (_a) {
            this._vscodeApiCached = false;
            return false;
        }
    }
    _getVscodeApi() {
        if (this._vscodeApiCached === true) {
            try {
                return window.acquireVsCodeApi();
            }
            catch (_a) {
                return null;
            }
        }
        if (this._vscodeApiCached === false)
            return null;
        if (typeof window === 'undefined' || typeof window.acquireVsCodeApi !== 'function') {
            this._vscodeApiCached = false;
            return null;
        }
        try {
            const api = window.acquireVsCodeApi();
            this._vscodeApiCached = true;
            return api;
        }
        catch (_b) {
            this._vscodeApiCached = false;
            return null;
        }
    }
    _notifyVscodeSidebar(report) {
        var _a, _b, _c;
        const vscode = this._getVscodeApi();
        if (!vscode || !report)
            return;
        try {
            const allIssues = report.rawIssues || report.detectedIssues || [];
            const sev = report.severityCounts || {};
            const score = (_c = (_a = report.qualityScore) !== null && _a !== void 0 ? _a : (_b = report.gate) === null || _b === void 0 ? void 0 : _b.score) !== null && _c !== void 0 ? _c : 0;
            vscode.postMessage({
                command: 'scanComplete',
                stats: {
                    issues: allIssues.length,
                    critical: sev.critical || 0,
                    high: sev.high || 0,
                    medium: sev.medium || 0,
                    low: sev.low || 0,
                    score: score
                }
            });
        }
        catch (err) {
            console.warn('[Sidebar-Notify] vscode.postMessage failed:', err);
        }
    }
    render() {
        const defaultPath = this.app.state.defaultProjectPath || '';
        const displayPath = this.getPathInputDisplayValue();
        const el = document.createElement('div');
        el.className = 'fade-in';
        el.innerHTML = `
      <!-- Hero header -->
      <div class="analyze-hero">
        <div class="analyze-hero-main">
          <h1 class="page-title">Analyze</h1>
          <span class="analyze-build-badge">${escapeHtml(String(window.__SIMPLEBEACON_DASHBOARD_BUILD__ || 'dev'))}</span>
        </div>
        <p class="text-muted analyze-hero-sub">Scan a repo folder, drop a file, or paste a URL. Pick your scan mix and run.</p>
      </div>

      <!-- Two-column layout: Target + Scan Config -->
      <div class="grid-2 analyze-main-grid">
        <!-- Left: Target -->
        <div class="analyze-col">
          ${this.renderTargetCard(defaultPath, displayPath)}

          <!-- Quick Actions -->
          ${this.renderQuickActionsCard()}

          <!-- VS Code Extension Integration -->
          ${this.renderVscodeExtensionCard()}

          <!-- Advanced Options -->
          <div class="card analyze-options-card">
            <details class="analyze-options-details" ${this.showAiProviderSelect() || this.analysisType === 'complete' ? 'open' : ''}>
              <summary class="analyze-options-summary">
                <span class="analyze-options-summary-label">Advanced options</span>
                <span class="text-muted" style="font-size:var(--font-size-xs);">AI provider, understanding mode, roadmap insights</span>
              </summary>
              <div class="analyze-options-body">
                <div class="analyze-options-grid">
                  <div id="analyze-ai-provider-wrap" class="analyze-ai-provider-wrap${this.showAiProviderSelect() ? '' : ' is-hidden'}">
                    <label for="ai-provider-select" class="text-muted" style="font-size: var(--font-size-xs);">AI narrative</label>
                    <select id="ai-provider-select" class="analyze-select" aria-label="AI provider">
                      <option value="demo">Filesystem scan (no AI)</option>
                      <option value="active">Active model</option>
                      <option value="ollama">Ollama</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <p id="analyze-ai-provider-note" class="text-muted analyze-roadmap-note" style="font-size: var(--font-size-xs); margin: 0.25rem 0 0;"></p>
                    <button type="button" class="btn btn-ghost btn-sm" id="refresh-analyze-providers-btn" style="margin-top: 0.25rem;">Refresh providers</button>
                  </div>
                  <div id="analyze-understanding-wrap" class="analyze-roadmap-insights-wrap${analysisTypeSupportsUnderstanding(this.analysisType) ? '' : ' is-hidden'}">
                    <label for="understanding-mode-select" class="text-muted" style="font-size: var(--font-size-xs);">Code understanding</label>
                    <select id="understanding-mode-select" class="analyze-select" aria-label="Code understanding mode">
                      <option value="off" ${this.understandingMode === 'off' ? 'selected' : ''}>Static scan only</option>
                      <option value="deterministic" ${this.understandingMode === 'deterministic' ? 'selected' : ''}>Semantic + context</option>
                      <option value="llm" ${this.understandingMode === 'llm' ? 'selected' : ''}>+ LLM explanation</option>
                    </select>
                  </div>
                  <div id="analyze-roadmap-insights-wrap" class="analyze-roadmap-insights-wrap${analysisTypeSupportsRoadmapInsights(this.analysisType) ? '' : ' is-hidden'}">
                    <label for="roadmap-insights-select" class="text-muted" style="font-size: var(--font-size-xs);">Roadmap insights</label>
                    <select id="roadmap-insights-select" class="analyze-select" aria-label="Roadmap insights mode">
                      <option value="off" ${this.roadmapInsightsMode === 'off' ? 'selected' : ''}>Filesystem only</option>
                      <option value="deterministic" ${this.roadmapInsightsMode === 'deterministic' ? 'selected' : ''}>Deterministic (no LLM)</option>
                      <option value="llm" ${this.roadmapInsightsMode === 'llm' ? 'selected' : ''}>+ LLM strategic layer</option>
                    </select>
                  </div>
                  <div class="analyze-realtime-monitor-wrap">
                    <label class="text-muted" style="font-size: var(--font-size-xs);">Real-time monitoring</label>
                    <label style="display:flex;align-items:center;gap:0.5rem;font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;margin-top:0.25rem;">
                      <input type="checkbox" id="analyze-realtime-monitor" aria-label="Enable real-time file monitoring" ${this.realtimeMonitorEnabled ? 'checked' : ''}>
                      <span>Watch filesystem changes and auto-rescan (requires VS Code extension or server watcher)</span>
                    </label>
                  </div>
                  <div class="analyze-local-mode-wrap">
                    <label class="text-muted" style="font-size: var(--font-size-xs);">Privacy mode</label>
                    <label style="display:flex;align-items:center;gap:0.5rem;font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;margin-top:0.25rem;">
                      <input type="checkbox" id="analyze-local-mode" aria-label="Scan locally in browser" ${this.localMode ? 'checked' : ''}>
                      <span>Scan locally in browser — no file data sent to server</span>
                    </label>
                  </div>
                </div>
                <p id="analyze-roadmap-no-ai-note" class="text-muted analyze-roadmap-note${this.showRoadmapInsightsNote() ? '' : ' is-hidden'}" style="font-size: var(--font-size-xs); margin: var(--space-2) 0 0;">
                  Roadmap data is always from <code>code-roadmap-generator</code>. Insights layer adds executive summary + risk.
                </p>
              </div>
            </details>
          </div>
        </div>

        <!-- Right: Scan Configuration -->
        <div class="analyze-col">
          ${this.renderSelectedModeDetail()}
        </div>
      </div>

      ${this.busy ? this.renderProgress() : ''}

      <!-- Per-file Results -->
      ${this.renderFileResultsSection()}

      <!-- Results -->
      <div id="analyze-results">${this.renderResults()}</div>

      <!-- Directory browser modal -->
      <div class="modal-overlay hidden" id="dir-browser-modal" aria-hidden="true">
        <div class="modal-card dir-browser-modal">
          <div class="modal-header">
            <h2><i data-lucide="folder-open" class="icon-18" style="vertical-align:middle;margin-right:0.25rem;"></i> Browse server directories</h2>
          </div>
          <div class="modal-body">
            <div class="dir-browser-path" id="dir-browser-current-path"></div>
            <div class="dir-browser-list" id="dir-browser-list">
              <div class="dir-browser-empty">Loading directories…</div>
            </div>
            <div class="dir-browser-actions">
              <button type="button" class="btn btn-ghost btn-sm" id="dir-browser-up-btn">Up</button>
              <button type="button" class="btn btn-primary btn-sm" id="dir-browser-select-btn">Select folder</button>
              <button type="button" class="btn btn-secondary btn-sm" id="dir-browser-close-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
        this.bindEvents(el);
        this._root = el;
        refreshPathSuggestionsDatalist(el, this.app, this.testSources);
        this.syncAnalyzeModeUi(el);
        this.syncZipExportButtonLabel(el);
        this.syncAuditButtonLabel(el);
        // Browser form-state restoration can re-apply disabled after initial render;
        // re-clear once the browser has finished its restoration pass.
        requestAnimationFrame(() => {
            this.syncZipExportButtonLabel(el);
            this.syncAuditButtonLabel(el);
        });
        if (displayPath) {
            void this.refreshReportForActivePath(el);
        }
        return el;
    }
    renderQuickActionsCard() {
        var _a;
        const hasResult = Boolean(this.lastResult);
        const pathInput = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
        const projectPath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        const canRun = Boolean(projectPath) && !this.busy;
        return `
      <div class="card analyze-quick-actions-card" style="margin-top:var(--space-3);padding:var(--space-3);">
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center;">
          <button type="button" class="btn btn-primary btn-sm" id="quick-action-run-btn" ${canRun ? '' : 'disabled'} title="Run analysis on the current path">
            <i data-lucide="play" class="icon-16" style="margin-right:4px;"></i> Run Scan
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="quick-action-results-btn" ${hasResult ? '' : 'disabled'} title="Open results view">
            <i data-lucide="bar-chart-2" class="icon-16" style="margin-right:4px;"></i> Results
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="quick-action-export-btn" ${hasResult ? '' : 'disabled'} title="Export scan report">
            <i data-lucide="download" class="icon-16" style="margin-right:4px;"></i> Export
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="quick-action-remediation-btn" ${hasResult ? '' : 'disabled'} title="Open remediation roadmap">
            <i data-lucide="map" class="icon-16" style="margin-right:4px;"></i> Remediate
          </button>
        </div>
      </div>
    `;
    }
    renderVscodeExtensionCard() {
        const hasVsCodeApi = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
        const inVsCodeHost = typeof window !== 'undefined' && (/vscode|electron/i.test(navigator.userAgent) ||
            /vscode-webview/i.test(navigator.userAgent));
        const inVsCode = hasVsCodeApi || inVsCodeHost;
        const badge = inVsCode
            ? `<span class="ti-badge" style="background:rgba(16,185,129,0.15);color:var(--success);font-size:0.75rem;">● Active</span>`
            : `<a href="https://marketplace.visualstudio.com/items?itemName=SimpleBeacon.simplebeacon-vscode" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="flex-shrink:0;">Install</a>`;
        const subtitle = inVsCode
            ? (hasVsCodeApi
                ? 'Extension is running in this editor. Enhanced analysis active: full-directory scan, real-time monitoring, and deep code insights.'
                : 'Extension is running in this editor. Real-time monitoring, AI analysis, code map, and remediation guide are active.')
            : 'Real-time file monitoring, enhanced AI analysis, code map, and remediation guide — directly in your editor.';
        const sendToVscodeBtn = (!inVsCode && this.projectPath)
            ? `<a href="vscode://simplebeacon.fix?projectPath=${encodeURIComponent(this.projectPath)}&scanId=${encodeURIComponent(this.lastScanId || '')}" class="btn btn-primary btn-sm" style="flex-shrink:0;margin-left:8px;">Open in VS Code</a>`
            : '';
        // Only show sync button when acquireVsCodeApi is available (true webview panel)
        // Simple Browser has no API access, so sync is not available there
        const syncBtn = hasVsCodeApi
            ? `<button type="button" class="btn btn-ghost btn-sm" id="vscode-sync-report-btn" style="flex-shrink:0;margin-left:8px;font-size:0.75rem;" title="Push current scan report to the sidebar">🔄 Sync</button>`
            : '';
        return `
      <div class="card analyze-vscode-card" style="margin-top:var(--space-3);padding:var(--space-3);background:linear-gradient(135deg,rgba(99,102,241,0.06) 0%,rgba(139,92,246,0.04) 100%);border-color:rgba(99,102,241,0.15);">
        <div style="display:flex;align-items:flex-start;gap:var(--space-3);">
          <div style="flex-shrink:0;width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.25rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 16 16"/><path d="m20 4-16 16"/></svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
              <p class="card-title" style="margin:0;font-size:0.95rem;">VS Code Extension</p>
              <div style="display:flex;align-items:center;">${badge}${syncBtn}${sendToVscodeBtn}</div>
            </div>
            <p class="text-muted" style="font-size:var(--font-size-xs);margin:var(--space-1) 0 0;">
              ${escapeHtml(subtitle)}
            </p>
          </div>
        </div>
      </div>
    `;
    }
    renderTargetCard(defaultPath, displayPath) {
        const isWeb = this.websiteMode;
        const useDefaultHidden = defaultPath && !isWeb ? '' : 'hidden';
        const pathPlaceholder = isWeb
            ? 'https://example.com'
            : 'C:\\\\dev\\\\my-app · git@github.com:org/repo · https://codeberg.org/org/repo';
        const pathAria = isWeb ? 'Website URL' : 'Project path on server';
        const pathList = isWeb ? '' : pathInputListAttr();
        const datalist = isWeb ? '' : renderPathSuggestionsDatalistElement(collectPathSuggestions(this.app, this.testSources));
        const pathSources = isWeb ? '' : this.renderPathSourceSections(defaultPath, displayPath);
        return `
      <style>
        .analyze-target-redesign { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-elevated); overflow: hidden; }
        .analyze-target-redesign .target-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
        .analyze-target-redesign .target-title { font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .analyze-target-redesign .target-body { padding: 20px; }
        .analyze-target-redesign .drop-zone { border: 2px dashed var(--border); border-radius: var(--radius-lg); background: var(--surface); padding: 28px 24px; text-align: center; transition: all .2s; position: relative; }
        .analyze-target-redesign .drop-zone.drag-active { border-color: var(--primary); background: rgba(99,102,241,0.06); }
        .analyze-target-redesign .drop-zone-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(99,102,241,0.1); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .analyze-target-redesign .drop-zone-title { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
        .analyze-target-redesign .drop-zone-sub { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px; }
        .analyze-target-redesign .drop-zone-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .analyze-target-redesign .path-row { display: flex; gap: 8px; align-items: center; max-width: 560px; margin: 18px auto 0; }
        .analyze-target-redesign .path-row input { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; color: var(--text-primary); font-size: 0.85rem; }
        .analyze-target-redesign .path-row button { flex-shrink: 0; }
        .analyze-target-redesign .hint { text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 8px; }
        .analyze-target-redesign .options-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
        .analyze-target-redesign .quick-file { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); padding: 14px; margin-top: 14px; }
        .analyze-target-redesign .quick-file-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .analyze-target-redesign .quick-file-title { font-size: 0.9rem; font-weight: 600; }
        .analyze-target-redesign .quick-file-sub { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px; }
        .analyze-target-redesign .quick-file-actions { display: flex; gap: 8px; }
        .analyze-target-redesign .scanning-state { display: none; padding: 24px; text-align: center; }
        .analyze-target-redesign .scanning-state.active { display: block; }
        .analyze-target-redesign .scanning-state h3 { margin-bottom: 8px; }
        .analyze-target-redesign .scanning-state p { color: var(--text-muted); font-size: 0.85rem; }
        .an-tgt-drop { border: 2px dashed var(--border); border-radius: var(--radius-lg); background: var(--surface); padding: 28px 24px; text-align: center; transition: all .2s; }
        .an-tgt-drop.drag-active { border-color: var(--primary); background: rgba(99,102,241,0.06); }
        .fingerprint-status { min-height: 1.2em; margin-top: 8px; font-size: 0.85rem; color: var(--primary); font-weight: 500; text-align: center; }
        .agent-status { min-height: 1.2em; margin-top: 4px; font-size: 0.8rem; color: var(--text-muted); text-align: center; }
        .agent-status.available { color: var(--success); }
        .agent-status.unavailable { color: var(--text-muted); }
        .agent-download-cta { min-height: 1.2em; margin-top: 4px; font-size: 0.85rem; text-align: center; }
        .agent-download-cta a { color: var(--primary); text-decoration: underline; }
        .agent-install-wizard { display: inline-flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border: 1px dashed var(--border); border-radius: var(--radius-lg); background: var(--surface); max-width: 420px; margin: 0 auto; }
        .agent-wizard-title { font-weight: 600; margin: 0; }
        .agent-wizard-subtitle { color: var(--text-muted); margin: 0; font-size: 0.8rem; }
        .agent-wizard-step { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .agent-wizard-instructions { color: var(--text); margin: 0; max-width: 380px; }
        .agent-wizard-polling { color: var(--text-muted); font-size: 0.8rem; }
        .agent-wizard-polling.hidden { display: none; }
        .an-tgt-drop-icon { font-size: 2.5rem; margin-bottom: 12px; }
        .an-tgt-drop h4 { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
        .an-tgt-drop p { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px; }
        .an-tgt-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
      </style>

      <div class="analyze-target-redesign" id="analyze-target-card">
        <div class="target-header">
          <span class="target-title"><span>🎯</span> Target</span>
          <div class="analyze-path-header-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="use-default-path-btn" ${useDefaultHidden}>Use default</button>
            <button type="button" class="btn btn-ghost btn-sm" id="clear-path-btn">Clear</button>
          </div>
        </div>

        <div class="target-body">
          <div class="drop-zone ${this.busy ? 'scanning' : ''}" id="analyze-path-dropzone">
            <div class="drop-zone-idle" ${this.busy ? 'hidden' : ''}>
              <div class="drop-zone-icon"><i data-lucide="folder-up" class="icon-24"></i></div>
              <div class="drop-zone-title">Drop a project folder here</div>
              <div class="drop-zone-sub">Or type a path, browse, or drop a file / JSON report</div>
              <div class="drop-zone-actions">
                <button type="button" class="btn btn-primary btn-sm" id="browse-dir-btn"><i data-lucide="folder-open" class="icon-16"></i> Browse Folder</button>
                <button type="button" class="btn btn-secondary btn-sm" id="analyze-file-browse-btn-main" ${this.snippetBusy ? 'disabled' : ''}><i data-lucide="file-up" class="icon-16"></i> Browse File</button>
              </div>
              <div class="path-row">
                <input type="text" id="project-path-input" class="analyze-path-input"
                  placeholder="${pathPlaceholder}"
                  value="${escapeHtml(formatPathInputValue(displayPath))}"
                  list="${pathList}"
                  spellcheck="false"
                  autocomplete="list"
                  aria-label="${pathAria}">
                <button type="button" class="btn btn-primary" id="dropzone-path-analyze-btn">Analyze</button>
              </div>

              ${datalist}
              <p class="hint">${isWeb ? 'Enter a public URL to scan a website.' : 'Browser drag-and-drop cannot reveal full paths — use Browse Folder or the Local Scan Agent for the correct path.'}</p>
              <p id="fingerprint-status" class="fingerprint-status"></p>
              <p id="agent-status" class="agent-status"></p>
              <p id="agent-4000-status" class="agent-status"></p>
              <div id="agent-4000-results"></div>
              <div id="sandbox-scanner" class="sandbox-scanner" style="margin-top: 16px; padding: 16px; border: 1px solid #30363d; border-radius: 8px; background: #161b22; color: #c9d1d9;">
                <h4 style="margin-top: 0; color: #f0f6fc;">Secure Local Directory Scanner</h4>
                <p style="margin-bottom: 12px; color: #8b949e;">Select a local drive or folder. Scanning runs privately inside your browser using the File System Access API (Chrome/Edge/Brave).</p>
                <button type="button" id="trigger-native-picker" class="btn btn-primary" style="margin-bottom: 12px;">Select Drive Target</button>
                <pre id="sandbox-scan-terminal" style="background: #0d1117; color: #abb2bf; font-family: monospace; padding: 12px; border-radius: 4px; max-height: 240px; overflow-y: auto; margin: 0; border: 1px solid #30363d;">Awaiting drive selection...</pre>
              </div>
              <p id="agent-download-cta" class="agent-download-cta"></p>
            </div>
            <div class="scanning-state ${this.busy ? 'active' : ''}">
              <div class="drop-zone-icon"><i data-lucide="loader-2" class="icon-24" style="animation:spin 1s linear infinite;"></i></div>
              <h3>Scanning…</h3>
              <p id="dropzone-terminal-body">${this._terminalLogLines.map((line) => `<div class="terminal-line">${line}</div>`).join('')}</p>
            </div>
          </div>

          <div class="an-tgt-drop" id="analyze-drop-zone">
            <div class="an-tgt-drop-icon">📁</div>
            <h4>Drop a scan report or source file</h4>
            <p>JSON reports, ZIP bundles, or individual source files</p>
            <div class="an-tgt-actions">
              <button type="button" class="btn btn-primary btn-sm" id="analyze-select-file-btn">Select File</button>
              <button type="button" class="btn btn-secondary btn-sm" id="quick-file-scan-btn">Quick Scan</button>
            </div>
          </div>

          <div class="options-row">
            ${isWeb ? '' : `
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="analyze-full-directory" aria-label="Analyze every file in the selected folder" ${this.fullDirectoryScan ? 'checked' : ''}>
              <strong>Full tree</strong> — SHA-256 every file, content-scan all text
            </label>`}
            <div id="analyze-inventory-provenance" style="margin-left:auto;">
              ${this.renderInventoryProvenanceLine(displayPath)}
            </div>
          </div>

          ${isWeb ? '' : `
          <div class="quick-file" id="analyze-file-dropzone">
            <div class="quick-file-head">
              <i data-lucide="file-up" class="icon-18"></i>
              <span class="quick-file-title">Quick file check</span>
            </div>
            <p class="quick-file-sub">Drop a source file or JSON report for instant in-browser analysis. Supports ${escapeHtml(SNIPPET_ACCEPT.replace(/\./g, ' .'))} · max ${Math.round(MAX_SNIPPET_BYTES / 1024)} KB.</p>
            <div class="quick-file-actions">
              <button type="button" class="btn btn-primary btn-sm" id="analyze-file-browse-btn-dropzone" ${this.snippetBusy ? 'disabled' : ''}><i data-lucide="upload" class="icon-16" style="margin-right:4px;"></i>Choose File</button>
              <button type="button" class="btn btn-ghost btn-sm" id="analyze-file-clear-btn" ${this.snippetResult ? '' : 'disabled'}>Clear</button>
            </div>
            <input type="file" id="analyze-file-input" accept="${SNIPPET_ACCEPT}" hidden>
            ${this.snippetResult ? this.renderSnippetResults(this.snippetResult) : ''}
          </div>`}

          ${pathSources}
        </div>

        <input type="file" id="browse-dir-input" webkitdirectory directory hidden>
      </div>
    `;
    }
    renderSnippetResults(result) {
        var _a, _b, _c, _d, _e, _f, _g;
        const findings = result.findings || [];
        const threatScore = (_a = result.threatScore) !== null && _a !== void 0 ? _a : 0;
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
                ? `<p class="text-muted analyze-snippet-clean">${result.cacheMeta.documentation
                    // simplebeacon:production-leak-intent - legitimate sample path reference for documentation
                    ? 'Documentation file — rule names like `-sample.json` describe scanner behavior, not production imports.'
                    : result.cacheMeta.lockfile
                        ? 'Dependency lockfile — npm/yarn bin entries are not production mock-path leaks.'
                        : `Scanner cache index${result.cacheMeta.fileCount != null
                            ? ` (${formatNumber(result.cacheMeta.fileCount)} tracked path(s))`
                            : ''} — path keys are not production leak findings. Run a full repo scan for gate coverage.`}</p>`
                : '<p class="text-muted analyze-snippet-clean">No credential, mock-path, or AI-fiction KPI patterns in this file.</p>');
        const understandingHtml = understanding
            ? `
        <div class="analyze-snippet-understanding">
          <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0 0 0.5rem;">
            Server understanding · ${escapeHtml(((_c = (_b = understanding.layers) === null || _b === void 0 ? void 0 : _b.static) === null || _c === void 0 ? void 0 : _c.languageLabel) || ((_e = (_d = understanding.layers) === null || _d === void 0 ? void 0 : _d.static) === null || _e === void 0 ? void 0 : _e.language) || 'unknown')}
          </p>
          <p style="font-size: var(--font-size-sm); margin: 0;">${escapeHtml(understanding.summary || ((_g = (_f = understanding.layers) === null || _f === void 0 ? void 0 : _f.semantic) === null || _g === void 0 ? void 0 : _g.purpose) || 'Summary unavailable.')}</p>
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
            <span class="text-muted"> · ${formatNumber(result.bytes)} bytes</span>
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
        const recent = loadRecentPaths().filter((p) => p !== defaultPath);
        const recentChips = recent.map((p) => ({
            path: p,
            label: formatPathLabel(p) || basenamePath(p),
            primary: false
        }));
        if (defaultPath) {
            recentChips.unshift({ path: defaultPath, label: `Server: ${basenamePath(defaultPath)}`, primary: true });
        }
        const recentHtml = recentChips.length
            ? this.renderSourceChips(recentChips.map((c) => ({ id: c.path, kind: 'recent', label: c.label, value: c.path, primary: c.primary })), currentPath, 'analyze-recent-paths', { dismissible: true })
            : '';
        if (!recentHtml)
            return '';
        return `
      ${recentHtml ? `
        <div class="analyze-path-sources">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
            <span class="analyze-path-sources-label text-muted">Recent</span>
            <button type="button" class="btn btn-ghost btn-xs" id="clear-recent-paths-btn">Clear all</button>
          </div>
          ${recentHtml}
        </div>
      ` : ''}
    `;
    }
    renderSourceChips(sources, currentPath, containerId, options = {}) {
        if (!(sources === null || sources === void 0 ? void 0 : sources.length)) {
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
        var _a;
        if (this._testSourcesLoading)
            return this._testSourcesLoading;
        if (((_a = this.testSources) === null || _a === void 0 ? void 0 : _a.length) && this._testSourcesLoadedAt && Date.now() - this._testSourcesLoadedAt < 120000) {
            return;
        }
        if (this._testSourcesFailedAt && Date.now() - this._testSourcesFailedAt < 60000) {
            return;
        }
        this._testSourcesLoading = (async () => {
            try {
                const data = await fetchAnalyzeTestSources();
                this.testSources = data.sources || [];
                this._testSourcesLoadedAt = Date.now();
                this._testSourcesFailedAt = null;
                const pathInput = container === null || container === void 0 ? void 0 : container.querySelector('#project-path-input');
                const displayPath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
                refreshPathSuggestionsDatalist(container, this.app, this.testSources);
            }
            catch (_a) {
                this._testSourcesFailedAt = Date.now();
                const el = container === null || container === void 0 ? void 0 : container.querySelector('#analyze-preset-paths');
                if (el) {
                    el.innerHTML = '<span class="text-muted" style="font-size:var(--font-size-xs)">Test sources unavailable — restart dashboard (npm run dashboard:kill-ports && npm run dashboard:v1-internal).</span>';
                }
            }
        })();
        try {
            await this._testSourcesLoading;
        }
        finally {
            this._testSourcesLoading = null;
        }
    }
    renderRunAnalyzeButtonLabel() {
        if (this.analysisType !== 'complete')
            return 'Run analysis';
        const count = this.selectedEngines.length;
        if (!count)
            return 'Select engines';
        return `Run complete (${count})`;
    }
    renderClientDeliverablePicker() {
        return '';
    }
    _renderClientDeliverablePicker() {
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
            ${escapeHtml((activePlan === null || activePlan === void 0 ? void 0 : activePlan.sku) || 'custom')} · ${escapeHtml((activePlan === null || activePlan === void 0 ? void 0 : activePlan.label) || 'Custom mix')} · ${runCount} engine${runCount === 1 ? '' : 's'} will run
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
        ${(activePlan === null || activePlan === void 0 ? void 0 : activePlan.tagline) ? `<p class="analyze-deliverable-active-note text-muted">${escapeHtml(activePlan.tagline)}</p>` : ''}
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
        // Queue panel caps initial render to 10 items for performance — if truncated, read from main grid instead
        if (!inputs.length || inputs.length < COMPLETE_ENGINE_ORDER.length) {
            inputs = root.querySelectorAll('.analyze-engine-input');
        }
        if (!inputs.length)
            return normalizeSelectedEngines(this.selectedEngines, { allowEmpty: true });
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
        if (!root)
            return;
        const activeSku = this.selectedDeliverableSku || inferDeliverableSku(this.selectedEngines);
        const activePlan = getClientDeliverablePlan(activeSku);
        const runCount = resolveEnginesForRun(this.selectedEngines).length;
        root.querySelectorAll('.analyze-deliverable-input').forEach((input) => {
            var _a;
            const selected = input.value === activeSku;
            input.checked = selected;
            (_a = input.closest('.analyze-deliverable-row')) === null || _a === void 0 ? void 0 : _a.classList.toggle('is-selected', selected);
        });
        const meta = root.querySelector('#analyze-deliverable-picker-meta');
        if (meta) {
            const skuLabel = (activePlan === null || activePlan === void 0 ? void 0 : activePlan.sku) || 'custom';
            meta.textContent = `${skuLabel} · ${(activePlan === null || activePlan === void 0 ? void 0 : activePlan.label) || 'Custom mix'} · ${runCount} engine${runCount === 1 ? '' : 's'} will run`;
        }
        const note = root.querySelector('.analyze-deliverable-active-note');
        if (note) {
            note.textContent = (activePlan === null || activePlan === void 0 ? void 0 : activePlan.tagline) || '';
            note.hidden = !(activePlan === null || activePlan === void 0 ? void 0 : activePlan.tagline);
        }
    }
    syncEngineSelectionHighlights(root = this._root) {
        if (!root)
            return;
        root.querySelectorAll('.analyze-engine-input').forEach((input) => {
            const engineId = input.dataset.engine;
            if (engineId)
                input.checked = this.selectedEngines.includes(engineId);
        });
        this.syncClientDeliverablePicker(root);
    }
    applyClientDeliverable(sku, root = this._root) {
        const plan = getClientDeliverablePlan(sku);
        if (!plan)
            return;
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
            const typeSelect = root === null || root === void 0 ? void 0 : root.querySelector('#analysis-type-select');
            this.setAnalysisType(plan.analysisType, { typeSelect });
            return;
        }
        if (root) {
            this.syncAnalyzeModeUi(root);
        }
    }
    persistSelectedEngines(root = this._root, changedEngineId = null, checked = null) {
        // When called without changedEngineId it's a pre-run snapshot — don't overwrite from truncated DOM.
        // Only read from DOM when a specific engine was toggled by user interaction.
        let selected = changedEngineId
            ? this.readSelectedEnginesFromDom(root)
            : this.selectedEngines;
        if (changedEngineId) {
            const set = new Set(selected);
            applyEngineSelectionChange(set, changedEngineId, checked);
            selected = COMPLETE_ENGINE_ORDER.filter((id) => set.has(id));
        }
        this.selectedEngines = normalizeSelectedEngines(selected, { allowEmpty: true });
        this.selectedDeliverableSku = inferDeliverableSku(this.selectedEngines);
        const typeSelect = root === null || root === void 0 ? void 0 : root.querySelector('#analysis-type-select');
        if (this.selectedEngines.length > 1) {
            if (this.analysisType !== 'complete') {
                this.setAnalysisType('complete', { typeSelect });
                return;
            }
        }
        else if (this.selectedEngines.length === 1) {
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
                if (engineId)
                    input.checked = this.selectedEngines.includes(engineId);
            });
        }
        this.syncEngineSelectionHighlights(root);
        this.syncRunAnalyzeButtonLabel(root);
        this.syncSelectedEnginesDetail(root);
        this.syncZipExportButtonLabel(root);
        this.syncAuditButtonLabel(root);
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
            this.syncAuditButtonLabel(root);
        }
    }
    bindClientDeliverablePicker(root = this._root) {
        if (!root)
            return;
        root.querySelectorAll('.analyze-deliverable-input').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked)
                    this.applyClientDeliverable(input.value, root);
            });
        });
        root.querySelectorAll('.analyze-deliverable-row').forEach((row) => {
            row.addEventListener('click', (event) => {
                if (event.target.closest('.analyze-deliverable-input'))
                    return;
                const input = row.querySelector('.analyze-deliverable-input');
                if (!input || input.checked)
                    return;
                input.checked = true;
                this.applyClientDeliverable(input.value, root);
            });
        });
    }
    bindCodebaseSectionEvents(root = this._root) {
        var _a;
        if (!root)
            return;
        const section = root.querySelector('#codebase-health-section');
        if (!section)
            return;
        const table = section.querySelector('#codebase-findings-table tbody');
        if (!table)
            return;
        const allRows = Array.from(table.querySelectorAll('tr'));
        /**
         * Apply filter.
         * @returns {any}
         */
        function applyFilter() {
            var _a, _b, _c, _d;
            const activeCat = ((_b = (_a = section.querySelector('.codebase-cat-filter.btn-primary')) === null || _a === void 0 ? void 0 : _a.dataset) === null || _b === void 0 ? void 0 : _b.cat) || 'all';
            const includeNode = (_d = (_c = section.querySelector('#codebase-include-node')) === null || _c === void 0 ? void 0 : _c.checked) !== null && _d !== void 0 ? _d : false;
            let visibleCount = 0;
            allRows.forEach((row) => {
                const cat = row.dataset.cat || '';
                const path = row.dataset.path || '';
                const isNode = path.includes('node_modules');
                const catMatch = activeCat === 'all' || cat === activeCat;
                const nodeMatch = includeNode || !isNode;
                const show = catMatch && nodeMatch;
                row.style.display = show ? '' : 'none';
                if (show)
                    visibleCount++;
            });
            const note = section.querySelector('p.text-muted');
            if (note) {
                const total = allRows.length;
                const hidden = total - visibleCount;
                note.textContent = `${visibleCount} shown${hidden > 0 ? ` · ${hidden} filtered out` : ''}`;
            }
        }
        section.querySelectorAll('.codebase-cat-filter').forEach((btn) => {
            btn.addEventListener('click', () => {
                section.querySelectorAll('.codebase-cat-filter').forEach((b) => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-ghost');
                });
                btn.classList.remove('btn-ghost');
                btn.classList.add('btn-primary');
                applyFilter();
            });
        });
        (_a = section.querySelector('#codebase-include-node')) === null || _a === void 0 ? void 0 : _a.addEventListener('change', applyFilter);
    }
    bindFileReductionSectionEvents(root = this._root) {
        var _a;
        if (!root)
            return;
        const section = root.querySelector('#file-reduction-health-section');
        if (!section)
            return;
        const table = section.querySelector('#fr-findings-table tbody');
        if (!table)
            return;
        const allRows = Array.from(table.querySelectorAll('tr'));
        /**
         * Apply filter.
         * @returns {any}
         */
        function applyFilter() {
            var _a, _b, _c, _d;
            const activeCat = ((_b = (_a = section.querySelector('.fr-cat-filter.btn-primary')) === null || _a === void 0 ? void 0 : _a.dataset) === null || _b === void 0 ? void 0 : _b.cat) || 'all';
            const includeNode = (_d = (_c = section.querySelector('#fr-include-node')) === null || _c === void 0 ? void 0 : _c.checked) !== null && _d !== void 0 ? _d : false;
            let visibleCount = 0;
            allRows.forEach((row) => {
                const cat = row.dataset.cat || '';
                const path = row.dataset.path || '';
                const isNode = path.includes('node_modules');
                const catMatch = activeCat === 'all' || cat === activeCat;
                const nodeMatch = includeNode || !isNode;
                const show = catMatch && nodeMatch;
                row.style.display = show ? '' : 'none';
                if (show)
                    visibleCount++;
            });
            const note = section.querySelector('p.text-muted');
            if (note) {
                const total = allRows.length;
                const hidden = total - visibleCount;
                note.textContent = `${visibleCount} shown${hidden > 0 ? ` · ${hidden} filtered out` : ''}`;
            }
        }
        section.querySelectorAll('.fr-cat-filter').forEach((btn) => {
            btn.addEventListener('click', () => {
                section.querySelectorAll('.fr-cat-filter').forEach((b) => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-ghost');
                });
                btn.classList.remove('btn-ghost');
                btn.classList.add('btn-primary');
                applyFilter();
            });
        });
        (_a = section.querySelector('#fr-include-node')) === null || _a === void 0 ? void 0 : _a.addEventListener('change', applyFilter);
    }
    applyEngineQueueSelectAll(checked, root = this._root) {
        const { queueEngineIds } = queueSelectAllState(this.selectedEngines);
        if (!queueEngineIds.length)
            return;
        if (checked) {
            if (this.analysisType !== 'complete') {
                const typeSelect = root === null || root === void 0 ? void 0 : root.querySelector('#analysis-type-select');
                this.setAnalysisType('complete', { typeSelect });
            }
            this.setSelectedEngines(queueEngineIds, root, { allowEmpty: true });
            return;
        }
        this.setSelectedEngines([], root, { allowEmpty: true });
    }
    bindEngineSelectionEvents(root = this._root) {
        if (!root)
            return;
        // Individual engine checkboxes
        root.querySelectorAll('.analyze-engine-input').forEach((input) => {
            input.addEventListener('change', () => {
                this.persistSelectedEngines(root, input.dataset.engine, input.checked);
            });
            input.addEventListener('click', (event) => event.stopPropagation());
        });
        // Group category toggles
        root.querySelectorAll('.analyze-engine-group-input').forEach((input) => {
            input.addEventListener('change', () => {
                this.applyGroupToggle(input.dataset.category, input.checked, root);
            });
            input.addEventListener('click', (event) => event.stopPropagation());
        });
        // Preset buttons
        root.querySelectorAll('.analyze-engine-preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.applyScanPreset(btn.dataset.preset, root);
            });
        });
        // Group expander buttons
        root.querySelectorAll('.analyze-engine-group-expander').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const group = btn.closest('.analyze-engine-group');
                if (group)
                    group.classList.toggle('is-expanded');
            });
        });
        // Group head click to expand (but not when clicking checkbox)
        root.querySelectorAll('.analyze-engine-group-head').forEach((head) => {
            head.addEventListener('click', (event) => {
                if (event.target.closest('.analyze-engine-group-input') || event.target.closest('.analyze-engine-group-expander'))
                    return;
                const group = head.closest('.analyze-engine-group');
                if (group)
                    group.classList.toggle('is-expanded');
            });
        });
        // Show-all expander
        root.querySelectorAll('.analyze-engine-queue-expander').forEach((btn) => {
            btn.addEventListener('click', () => {
                this._queueExpanded = true;
                this.syncSelectedEnginesDetail(root);
            });
        });
    }
    applyScanPreset(presetId, root = this._root) {
        const preset = SCAN_PRESETS.find((p) => p.id === presetId);
        if (!preset) {
            return;
        }
        if (preset.id === 'custom') {
            this.setSelectedEngines([], root, { allowEmpty: true });
        }
        else {
            if (this.analysisType !== 'complete') {
                const typeSelect = root === null || root === void 0 ? void 0 : root.querySelector('#analysis-type-select');
                this.setAnalysisType('complete', { typeSelect });
            }
            this.setSelectedEngines(preset.engines, root, { allowEmpty: true });
        }
    }
    applyGroupToggle(category, checked, root = this._root) {
        const groups = groupEnginesByCategory(COMPLETE_ENGINE_ORDER);
        const engines = groups.get(category) || [];
        const ids = engines.map((e) => e.id);
        const selected = new Set(this.selectedEngines);
        if (checked) {
            ids.forEach((id) => selected.add(id));
        }
        else {
            ids.forEach((id) => selected.delete(id));
        }
        this.setSelectedEngines(Array.from(selected), root, { allowEmpty: true });
    }
    bindModeGridEvents(root = this._root) {
        this.bindEngineSelectionEvents(root);
    }
    syncRunAnalyzeButtonLabel(root = this._root) {
        const runBtn = root === null || root === void 0 ? void 0 : root.querySelector('#run-analyze-btn');
        if (!runBtn || this.busy)
            return;
        runBtn.textContent = this.renderRunAnalyzeButtonLabel();
        runBtn.disabled = !this.selectedEngines.length;
    }
    syncSelectedEnginesDetail(root = this._root) {
        var _a;
        if (!root)
            return;
        const scrollContainer = document.querySelector('.app-main') || document.documentElement;
        const savedScrollTop = scrollContainer.scrollTop;
        const slot = root.querySelector('#analyze-engine-queue-panel');
        const savedQueueScroll = slot ? slot.scrollTop : 0;
        const savedActive = document.activeElement;
        const savedActiveEngine = ((_a = savedActive === null || savedActive === void 0 ? void 0 : savedActive.dataset) === null || _a === void 0 ? void 0 : _a.engine) || null;
        if (slot) {
            slot.outerHTML = this.renderSelectedEnginesQueuePanel().trim();
            this.bindEngineSelectionEvents(root);
        }
        // Restore scroll synchronously to prevent visual jump
        scrollContainer.scrollTop = savedScrollTop;
        const newSlot = root.querySelector('#analyze-engine-queue-panel');
        if (newSlot)
            newSlot.scrollTop = savedQueueScroll;
        requestAnimationFrame(() => {
            if (savedActiveEngine) {
                const newInput = root.querySelector(`.analyze-engine-input[data-engine="${savedActiveEngine}"]`);
                if (newInput)
                    newInput.focus();
            }
            else if (savedActive && savedActive.id) {
                const newEl = document.getElementById(savedActive.id);
                if (newEl)
                    newEl.focus();
            }
        });
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
        // Preset buttons
        const activePreset = SCAN_PRESETS.find((p) => {
            if (p.id === 'custom')
                return false;
            const pSet = new Set(p.engines);
            return this.selectedEngines.length === p.engines.length && this.selectedEngines.every((id) => pSet.has(id));
        });
        const presetButtons = SCAN_PRESETS.map((p) => {
            const active = (activePreset === null || activePreset === void 0 ? void 0 : activePreset.id) === p.id || (p.id === 'custom' && !activePreset);
            return `<button type="button" class="analyze-engine-preset-btn${active ? ' is-active' : ''}" data-preset="${escapeHtml(p.id)}" title="${escapeHtml(p.label)}">${escapeHtml(p.icon)} ${escapeHtml(p.label)}</button>`;
        }).join('');
        // Grouped engine rows by category — cap initial render to 10 items for performance
        const groups = groupEnginesByCategory(COMPLETE_ENGINE_ORDER);
        let renderedCount = 0;
        const maxInitial = 10;
        const expanded = this._queueExpanded || false;
        const groupHtml = Array.from(groups.entries()).map(([category, engines]) => {
            const groupSelectedCount = engines.filter((e) => selected.has(e.id)).length;
            const groupAllSelected = groupSelectedCount === engines.length;
            const groupSomeSelected = groupSelectedCount > 0 && !groupAllSelected;
            const slot = expanded ? engines.length : Math.max(0, maxInitial - renderedCount);
            const visibleEngines = engines.slice(0, slot);
            renderedCount += visibleEngines.length;
            if (!visibleEngines.length)
                return '';
            const rows = visibleEngines.map((engine) => {
                const engineId = engine.id;
                const isSelected = selected.has(engineId);
                const inRun = isCompleteMode && runIndex.has(engineId);
                const isCurrent = engineId === currentEngineId;
                const depOnly = inRun && !isSelected;
                const depNote = ENGINE_DEPENDENCIES[engineId] ? ` <span class="analyze-engine-queue-tag is-dependency">needs ${ENGINE_DEPENDENCIES[engineId].map((d) => getCompleteEngineLabel(d)).join(', ')}</span>` : '';
                return `
          <li class="analyze-engine-queue-item${isSelected ? ' is-checked' : ' is-unchecked'}${isCurrent ? ' is-current' : ''}${engine.optional ? ' is-optional' : ''}${depOnly ? ' is-dependency is-in-run' : ''}">
            <label class="analyze-engine-queue-toggle">
              <input type="checkbox" class="analyze-engine-input analyze-engine-queue-input" data-engine="${escapeHtml(engineId)}" ${isSelected ? 'checked' : ''} aria-label="Include ${escapeHtml(engine.label)} in scan">
              <span class="analyze-engine-queue-label">${escapeHtml(engine.label)}${engine.optional ? ' <span class="analyze-engine-queue-tag">optional</span>' : ''}${depNote}${depOnly ? ' <span class="analyze-engine-queue-tag is-dependency">auto-runs</span>' : ''}${isCurrent ? ' <span class="analyze-engine-queue-tag is-current">previewing</span>' : ''}</span>
            </label>
            <span class="analyze-engine-queue-desc">${escapeHtml(engine.desc)}</span>
          </li>
        `;
            }).join('');
            const isExpanded = groupSelectedCount > 0 || expanded;
            return `
        <div class="analyze-engine-group${isExpanded ? ' is-expanded' : ''}" data-category="${escapeHtml(category)}">
          <div class="analyze-engine-group-head">
            <label class="analyze-engine-group-toggle">
              <input type="checkbox" class="analyze-engine-group-input" data-category="${escapeHtml(category)}" ${groupAllSelected ? 'checked' : ''}${groupSomeSelected ? ' data-indeterminate="true"' : ''} aria-label="Toggle all ${escapeHtml(category)} scans">
              <strong>${escapeHtml(category)}</strong>
            </label>
            <div style="display:flex;align-items:center;gap:var(--space-1);">
              <span class="analyze-engine-group-count text-muted">${groupSelectedCount}/${engines.length}</span>
              <button type="button" class="analyze-engine-group-expander" aria-label="Toggle ${escapeHtml(category)}" title="Expand/collapse">
                <i data-lucide="chevron-down" class="icon-16"></i>
              </button>
            </div>
          </div>
          <div class="analyze-engine-group-body">
            <ol class="analyze-engine-queue-list analyze-engine-queue-list--selectable">${rows}</ol>
          </div>
        </div>
      `;
        }).filter(Boolean).join('');
        const expander = !expanded && renderedCount < COMPLETE_ENGINE_ORDER.length
            ? `<div class="analyze-engine-queue-expander-wrap" style="padding:var(--space-2) 0;"><button type="button" class="btn btn-ghost btn-sm analyze-engine-queue-expander">Show all ${COMPLETE_ENGINE_ORDER.length} modules</button></div>`
            : '';
        const runCountLabel = count
            ? isCompleteMode
                ? `${runOrder.length} will run${count !== runOrder.length ? ` (${count} selected + dependencies)` : ''}`
                : `${count} selected`
            : 'Select a preset or choose scans below';
        return `
      <div class="analyze-engine-queue-panel" id="analyze-engine-queue-panel">
        <div class="analyze-engine-queue-head">
          <strong class="analyze-engine-queue-title">Scan Selection</strong>
          <span class="analyze-engine-queue-count text-muted">${runCountLabel}</span>
        </div>
        <div class="analyze-engine-presets">${presetButtons}</div>
        <p class="analyze-engine-queue-intro">${this.analysisType === 'complete'
            ? 'Pick a preset or expand groups. Dependencies auto-select.'
            : this.analysisType === 'cleanup-assistant'
                ? 'Only <strong>Cleanup assistant</strong> runs in this mode.'
                : this.analysisType === 'mock-scan'
                    ? 'Only <strong>Mock data</strong> runs in this mode.'
                    : this.analysisType === 'compliance'
                        ? 'Only <strong>Compliance</strong> runs in this mode.'
                        : modeToEngineId(this.analysisType)
                            ? `<strong>${escapeHtml(getAnalysisMode(this.analysisType).label)}</strong> runs as a single scan. Switch to <strong>Complete</strong> to use the queue.`
                            : 'Pick a preset or expand groups to customize which scans run.'}</p>
        ${groupHtml}
        ${expander}
      </div>
    `;
    }
    renderSelectedModeDetail() {
        var _a;
        const mode = getAnalysisMode(this.analysisType);
        const { projectPath, report, lastResult } = this.buildModeDetailContext();
        const stepsHtml = this.analysisType !== 'complete' && ((_a = mode.steps) === null || _a === void 0 ? void 0 : _a.length)
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
        const engineQueueHtml = this.renderSelectedEnginesQueuePanel();
        const isCompleteMode = this.analysisType === 'complete';
        const selectedCount = this.selectedEngines.length;
        const estimatedTime = selectedCount
            ? isCompleteMode
                ? `~${Math.max(1, Math.round(selectedCount * 0.15))} min`
                : '~30 sec'
            : '';
        return `
      <div class="analyze-mode-detail card" id="analyze-mode-detail">
        <div class="analyze-mode-hero">
          <div class="analyze-mode-hero-main">
            <span class="analyze-mode-hero-icon">${mode.icon}</span>
            <div class="analyze-mode-hero-meta">
              <div class="analyze-mode-hero-label">${escapeHtml(mode.label)}</div>
              ${mode.deliverable ? `<div class="analyze-mode-hero-deliverable">${escapeHtml(mode.deliverable)}</div>` : ''}
            </div>
          </div>
          <div class="analyze-mode-hero-stats">
            <div class="analyze-mode-stat">
              <span class="analyze-mode-stat-value">${selectedCount}</span>
              <span class="analyze-mode-stat-label">engines</span>
            </div>
            ${estimatedTime ? `<div class="analyze-mode-stat"><span class="analyze-mode-stat-value">${estimatedTime}</span><span class="analyze-mode-stat-label">est.</span></div>` : ''}
          </div>
        </div>
        <p class="analyze-mode-desc">${escapeHtml(mode.desc)}</p>
        ${engineQueueHtml}
        ${stepsHtml}
        ${fileScopeHtml}
        ${alsoAvailable}
      </div>
    `;
    }
    renderFileResultsSection() {
        const { report, lastResult } = this.buildModeDetailContext();
        const fileResultsHtml = renderModeFileResultsPanel(this.analysisType, {
            lastResult,
            report
        });
        return `
      <div class="analyze-file-results-section" id="analyze-file-results-section" style="margin-top:var(--space-6);">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-lg);">
            <span style="font-size:1.25rem;">📋</span> Per-file Results
          </h2>
        </div>
        <div class="card" style="padding:var(--space-4);overflow:hidden;">
          ${fileResultsHtml}
        </div>
      </div>
    `;
    }
    renderScanEnginesReferenceCard() {
        return '';
    }
    /**
     * Get user's subscription tier from auth service.
     * @returns {string} 'starter' | 'pro' | 'enterprise'
     */
    getUserTier() {
        const user = authService.getUser();
        const plan = (user === null || user === void 0 ? void 0 : user.plan) || (user === null || user === void 0 ? void 0 : user.tier) || 'starter';
        if (plan === 'free')
            return 'starter';
        if (['pro', 'enterprise', 'team'].includes(plan))
            return plan;
        return 'starter';
    }
    renderCodebaseHealthSection() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const scan = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.scan;
        if (!(scan === null || scan === void 0 ? void 0 : scan.summary))
            return '';
        const s = scan.summary;
        const userTier = this.getUserTier();
        const isStarter = userTier === 'starter';
        const maxFindings = isStarter ? 5 : Infinity;
        let findings = scan.findings || [];
        const totalFindings = findings.length;
        if (isStarter && findings.length > maxFindings) {
            findings = findings.slice(0, maxFindings);
        }
        const categories = scan.categories || [];
        const critical = (_c = (_b = s.severityCounts) === null || _b === void 0 ? void 0 : _b.critical) !== null && _c !== void 0 ? _c : 0;
        const high = (_e = (_d = s.severityCounts) === null || _d === void 0 ? void 0 : _d.high) !== null && _e !== void 0 ? _e : 0;
        const medium = (_g = (_f = s.severityCounts) === null || _f === void 0 ? void 0 : _f.medium) !== null && _g !== void 0 ? _g : 0;
        const low = (_j = (_h = s.severityCounts) === null || _h === void 0 ? void 0 : _h.low) !== null && _j !== void 0 ? _j : 0;
        const total = (_k = s.findingsTotal) !== null && _k !== void 0 ? _k : totalFindings;
        const nonNode = findings.filter((f) => !String(f.filePath || '').includes('node_modules'));
        const nonNodeCount = nonNode.length;
        const catPills = categories.map((cat) => `
      <button type="button" class="btn btn-ghost btn-sm codebase-cat-filter" data-cat="${escapeHtml(cat.category)}" style="margin:2px;border-radius:999px;">
        ${escapeHtml(cat.label || cat.category)}
        <span class="gate-badge ${cat.severity === 'high' ? 'warn' : 'pass'}" style="margin-left:4px;font-size:0.7rem;padding:1px 6px;">${cat.count}</span>
      </button>
    `).join('');
        const severityBar = total > 0 ? `
      <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:var(--space-2);background:var(--border);">
        ${critical > 0 ? `<div style="width:${(critical / total * 100).toFixed(1)}%;background:var(--danger);"></div>` : ''}
        ${high > 0 ? `<div style="width:${(high / total * 100).toFixed(1)}%;background:#f59e0b;"></div>` : ''}
        ${medium > 0 ? `<div style="width:${(medium / total * 100).toFixed(1)}%;background:#3b82f6;"></div>` : ''}
        ${low > 0 ? `<div style="width:${(low / total * 100).toFixed(1)}%;background:var(--success);"></div>` : ''}
      </div>
    ` : '';
        /**
         * Row html.
         * @param {any} row
         * @returns {any}
         */
        const rowHtml = (row) => `
      <tr data-cat="${escapeHtml(row.category || '')}" data-path="${escapeHtml(row.filePath || '')}">
        <td><span class="gate-badge ${row.severity === 'critical' || row.severity === 'high' ? 'warn' : row.severity === 'medium' ? '' : 'pass'}">${escapeHtml(row.severity || '—')}</span></td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.category || '—')}</td>
        <td><code style="font-size:var(--font-size-xs);">${escapeHtml(row.filePath || '—')}</code></td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.description || '—')}</td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.recommendedAction || '—')}</td>
      </tr>
    `;
        const upgradePrompt = isStarter && totalFindings > maxFindings
            ? `<div class="mb-4" style="padding:var(--space-3);background:var(--warning-bg, #fffbeb);border:1px solid var(--warning-border, #f59e0b);border-radius:8px;color:var(--warning-text, #92400e);font-size:var(--font-size-sm);">
          <strong>🔒 Pro feature</strong> — ${totalFindings} findings detected. Upgrade to Pro to see all findings and the quality score.
          <a href="/pricing" style="color:var(--link-color, #2563eb);text-decoration:underline;font-weight:600;">Upgrade</a>
         </div>`
            : '';
        return `
      <div class="section-block" id="codebase-health-section" style="margin-top:var(--space-6);">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-lg);">
            <span style="font-size:1.25rem;">🏥</span> Codebase Health
          </h2>
          ${isStarter
            ? '<span class="text-muted" style="font-size:var(--font-size-sm);">Health score: <strong>🔒 Pro</strong></span>'
            : `<span class="text-muted" style="font-size:var(--font-size-sm);">Health score: <strong>${(_l = s.healthScore) !== null && _l !== void 0 ? _l : '—'}%</strong></span>`}
        </div>
        ${upgradePrompt}

        <div class="card" style="padding:var(--space-4);overflow:hidden;">
          <!-- Summary chips -->
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${formatNumber(s.codeFilesAnalyzed)}</strong> code files</div>
            <div class="metric-chip"><strong>${formatNumber(total)}</strong> findings</div>
            <div class="metric-chip gate-badge ${critical > 0 ? 'warn' : 'pass'}"><strong>${critical}</strong> critical</div>
            <div class="metric-chip gate-badge ${high > 0 ? 'warn' : 'pass'}"><strong>${high}</strong> high</div>
            <div class="metric-chip"><strong>${medium}</strong> medium</div>
            <div class="metric-chip"><strong>${low}</strong> low</div>
            <div class="metric-chip"><strong>${categories.length}</strong> categories</div>
          </div>

          <!-- Severity bar -->
          ${severityBar}
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);flex-wrap:wrap;font-size:var(--font-size-xs);color:var(--text-muted);">
            ${critical > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--danger);margin-right:4px;"></span>Critical ${critical}</span>` : ''}
            ${high > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:4px;"></span>High ${high}</span>` : ''}
            ${medium > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;margin-right:4px;"></span>Medium ${medium}</span>` : ''}
            ${low > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:4px;"></span>Low ${low}</span>` : ''}
          </div>

          <!-- Category filters -->
          <div style="margin-bottom:var(--space-3);">
            <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-2);">
              <span class="text-muted" style="font-size:var(--font-size-xs);font-weight:600;">Filter:</span>
              <button type="button" class="btn btn-primary btn-sm codebase-cat-filter codebase-cat-all" data-cat="all" style="border-radius:999px;margin:2px;">All</button>
              ${catPills}
            </div>
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="codebase-include-node" style="accent-color:var(--primary);">
              Include <code>node_modules</code> findings (${formatNumber(findings.length - nonNodeCount)} hidden)
            </label>
          </div>

          <!-- Findings table -->
          <div class="table-scroll" style="max-height:60vh;overflow:auto;">
            <table class="data-table" id="codebase-findings-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>File</th>
                  <th>Detail</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${nonNode.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-muted" style="font-size:var(--font-size-xs);margin-top:var(--space-2);">
            ${formatNumber(nonNodeCount)} shown · ${formatNumber(findings.length - nonNodeCount)} node_modules hidden
            ${s.eslintSkipped ? ` · ESLint: ${escapeHtml(s.eslintSkipped)}` : ''}
          </p>
        </div>
      </div>
    `;
    }
    renderFileReductionHealthSection() {
        var _a, _b;
        const scan = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.scan;
        if (!(scan === null || scan === void 0 ? void 0 : scan.summary))
            return '';
        const s = scan.summary;
        const inv = scan.inventory || {};
        const sev = ((_b = scan.aggregation) === null || _b === void 0 ? void 0 : _b.bySeverity) || {};
        const findings = scan.allFindings || scan.findings || scan.issues || [];
        const plan = scan.fileReductionPlan || {};
        const totals = plan.totals || {};
        const critical = sev.critical || 0;
        const high = sev.high || 0;
        const medium = sev.medium || 0;
        const low = sev.low || 0;
        const total = s.totalFindings || findings.length;
        const nonNode = findings.filter((f) => !String(f.path || f.filePath || '').includes('node_modules'));
        const nonNodeCount = nonNode.length;
        /**
         * Format bytes.
         * @param {Array} bytes
         * @returns {any}
         */
        const formatBytes = (bytes) => {
            const n = Number(bytes) || 0;
            if (n < 1024)
                return `${n} B`;
            if (n < 1024 * 1024)
                return `${(n / 1024).toFixed(1)} KB`;
            if (n < 1024 * 1024 * 1024)
                return `${(n / (1024 * 1024)).toFixed(1)} MB`;
            return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        };
        const scannerCategories = [
            { key: 'build-artifacts', label: 'Build artifacts', count: s.buildArtifactFindings },
            { key: 'asset-consolidation', label: 'Duplicate assets', count: s.duplicateAssetGroups },
            { key: 'unused-files', label: 'Unused files', count: s.unusedFileCandidates },
            { key: 'directory-bloat', label: 'Directory bloat', count: s.directoryBloatFindings || 0 }
        ].filter((c) => c.count > 0);
        const catPills = scannerCategories.map((cat) => `
      <button type="button" class="btn btn-ghost btn-sm fr-cat-filter" data-cat="${escapeHtml(cat.key)}" style="margin:2px;border-radius:999px;">
        ${escapeHtml(cat.label)}
        <span class="gate-badge pass" style="margin-left:4px;font-size:0.7rem;padding:1px 6px;">${cat.count}</span>
      </button>
    `).join('');
        const severityBar = total > 0 ? `
      <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:var(--space-2);background:var(--border);">
        ${critical > 0 ? `<div style="width:${(critical / total * 100).toFixed(1)}%;background:var(--danger);"></div>` : ''}
        ${high > 0 ? `<div style="width:${(high / total * 100).toFixed(1)}%;background:#f59e0b;"></div>` : ''}
        ${medium > 0 ? `<div style="width:${(medium / total * 100).toFixed(1)}%;background:#3b82f6;"></div>` : ''}
        ${low > 0 ? `<div style="width:${(low / total * 100).toFixed(1)}%;background:var(--success);"></div>` : ''}
      </div>
    ` : '';
        /**
         * Row html.
         * @param {any} row
         * @returns {any}
         */
        const rowHtml = (row) => `
      <tr data-cat="${escapeHtml(row.type || row.category || '')}" data-path="${escapeHtml(row.path || row.filePath || '')}">
        <td><span class="gate-badge ${row.severity === 'critical' || row.severity === 'high' ? 'warn' : row.severity === 'medium' ? '' : 'pass'}">${escapeHtml(row.severity || '—')}</span></td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.type || row.category || '—')}</td>
        <td><code style="font-size:var(--font-size-xs);">${escapeHtml(row.path || row.filePath || '—')}</code></td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.message || row.description || '—')}</td>
        <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(row.action || row.recommendation || 'Review')}</td>
      </tr>
    `;
        return `
      <div class="section-block" id="file-reduction-health-section" style="margin-top:var(--space-6);">
        <div class="section-heading" style="margin-bottom:var(--space-3);">
          <h2 style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-lg);">
            <span style="font-size:1.25rem;">📦</span> File Reduction Health
          </h2>
          <span class="text-muted" style="font-size:var(--font-size-sm);">Dry-run reclaim: <strong>${formatBytes(s.reclaimableBytes)}</strong></span>
        </div>

        <div class="card" style="padding:var(--space-4);overflow:hidden;">
          <!-- Summary chips -->
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${formatNumber(inv.totalFiles)}</strong> files scanned</div>
            <div class="metric-chip"><strong>${formatNumber(total)}</strong> findings</div>
            <div class="metric-chip"><strong>${formatBytes(s.reclaimableBytes)}</strong> reclaimable</div>
            <div class="metric-chip"><strong>${formatBytes(totals.estimatedImmediateSavingsBytes || 0)}</strong> immediate savings</div>
            <div class="metric-chip"><strong>${formatNumber(s.buildArtifactFindings)}</strong> build artifacts</div>
            <div class="metric-chip"><strong>${formatNumber(s.duplicateAssetGroups)}</strong> duplicate groups</div>
            <div class="metric-chip"><strong>${formatNumber(s.unusedFileCandidates)}</strong> unused files</div>
            <div class="metric-chip"><strong>${formatNumber(s.directoryBloatFindings || 0)}</strong> directory bloat</div>
          </div>

          <!-- Severity bar -->
          ${severityBar}
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);flex-wrap:wrap;font-size:var(--font-size-xs);color:var(--text-muted);">
            ${critical > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--danger);margin-right:4px;"></span>Critical ${critical}</span>` : ''}
            ${high > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:4px;"></span>High ${high}</span>` : ''}
            ${medium > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;margin-right:4px;"></span>Medium ${medium}</span>` : ''}
            ${low > 0 ? `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:4px;"></span>Low ${low}</span>` : ''}
          </div>

          <!-- Category filters -->
          <div style="margin-bottom:var(--space-3);">
            <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-2);">
              <span class="text-muted" style="font-size:var(--font-size-xs);font-weight:600;">Filter:</span>
              <button type="button" class="btn btn-primary btn-sm fr-cat-filter fr-cat-all" data-cat="all" style="border-radius:999px;margin:2px;">All</button>
              ${catPills}
            </div>
            <label style="display:flex;align-items:center;gap:0.5rem;font-size:var(--font-size-xs);color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="fr-include-node" style="accent-color:var(--primary);">
              Include <code>node_modules</code> findings (${formatNumber(findings.length - nonNodeCount)} hidden)
            </label>
          </div>

          <!-- Findings table -->
          <div class="table-scroll" style="max-height:60vh;overflow:auto;">
            <table class="data-table" id="fr-findings-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>File</th>
                  <th>Detail</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${nonNode.map(rowHtml).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-muted" style="font-size:var(--font-size-xs);margin-top:var(--space-2);">
            ${formatNumber(nonNodeCount)} shown · ${formatNumber(findings.length - nonNodeCount)} node_modules hidden
            ${scan.durationMs != null ? ` · ${Math.round(scan.durationMs / 1000)}s runtime` : ''}
          </p>
        </div>
      </div>
    `;
    }
    _renderScanEnginesReferenceCard() {
        const gateList = SIMPLEBEACON_GATE_RULES.map((rule) => `<li><code>${escapeHtml(rule.id)}</code> — ${escapeHtml(rule.label)}</li>`).join('');
        const dataList = DATA_QUALITY_SCANNERS.map((id) => `<li>${escapeHtml(id.replace(/-/g, ' '))}</li>`).join('');
        const fileList = FILE_REDUCTION_SCANNERS.map((id) => `<li>${escapeHtml(id.replace(/-/g, ' '))}</li>`).join('');
        const complianceList = COMPLIANCE_CHECKLIST_RULES.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('');
        const euList = EU_AI_ACT_EXTRA_RULES.map((rule) => `<li><code>${escapeHtml(rule.id)}</code> — ${escapeHtml(rule.label)}</li>`).join('');
        const aiAnalyzerGroups = this.issueTaxonomyGroups.map((group) => {
            const issueList = group.issues.map((issue) => `<li><code>${escapeHtml(issue.id)}</code> — ${escapeHtml(issue.title)}</li>`).join('');
            return `<div class="analyze-engines-col">
        <h3 class="analyze-engines-col-title">${escapeHtml(group.categoryName)} (${group.issues.length})</h3>
        <ul class="analyze-mode-steps">${issueList}</ul>
      </div>`;
        }).join('');
        // Derive browser analyzer reference grid from canonical COMPLETE_STEPS (single source of truth)
        const browserGroups = new Map();
        for (const step of COMPLETE_STEPS) {
            if (!browserGroups.has(step.category))
                browserGroups.set(step.category, []);
            browserGroups.get(step.category).push(step);
        }
        const browserAnalyzerHtml = [...browserGroups.entries()].map(([cat, items]) => {
            const itemList = items.map((item) => `<li><code>${escapeHtml(item.id)}</code> — ${escapeHtml(item.label)}${item.desc ? ` <span class="text-muted" style="font-size:0.75rem;">— ${escapeHtml(item.desc)}</span>` : ''}</li>`).join('');
            return `<div class="analyze-engines-col">
        <h3 class="analyze-engines-col-title">${escapeHtml(cat)} (${items.length})</h3>
        <ul class="analyze-mode-steps">${itemList}</ul>
      </div>`;
        }).join('');
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
            <p class="text-muted" style="font-size: var(--font-size-xs); margin: 0.5rem 0 0;">Reference only — <a href="/eu-ai-act-sample-report" target="_blank" rel="noopener">sample report layout</a>. Active offers: <a href="/dashboard/deliverables">$499 PDF</a> and agency packs.</p>
          </div>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
        <div class="card-header">
          <span class="card-title">AI Problem Analyzer Suite (${AI_SYSTEM_ISSUES.length} analyzers)</span>
          <span class="text-muted" style="font-size: var(--font-size-xs);">${ANALYZER_CATALOG.filter((a) => a.status === 'implemented').length} implemented · ${ANALYZER_CATALOG.filter((a) => a.status !== 'implemented').length} contract stubs</span>
        </div>
        <div class="analyze-engines-grid">
          ${aiAnalyzerGroups}
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">
        <div class="card-header">
          <span class="card-title">Browser Sandbox Analyzers (61 modules)</span>
          <span class="text-muted" style="font-size: var(--font-size-xs);">coming-soon/upload.html · heuristic engine</span>
        </div>
        <div class="analyze-engines-grid">
          ${browserAnalyzerHtml}
        </div>
      </div>
    `;
    }
    renderAiSystemsIssueAnalyzerCard() {
        return '';
    }
    _renderAiSystemsIssueAnalyzerCard() {
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
        const { summary, categoryDistribution, riskSummary, topPriorityIssues, coverageGaps, mitigationThemes, architecture, payload } = this.aiIssueAnalysisResult;
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
        ${(coverageGaps === null || coverageGaps === void 0 ? void 0 : coverageGaps.length) ? `
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const steps = ((_a = this.completeProgress) === null || _a === void 0 ? void 0 : _a.steps) || [];
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
            if ((sp === null || sp === void 0 ? void 0 : sp.total) && sp.processed != null) {
                const stepFraction = 1 / total;
                pct = Math.round(stepPct + (sp.processed / sp.total) * stepFraction * 100);
            }
            else {
                pct = Math.round(stepPct);
            }
        }
        else if ((sp === null || sp === void 0 ? void 0 : sp.total) && sp.processed != null) {
            pct = Math.round((sp.processed / sp.total) * 100);
        }
        else {
            pct = this.busy ? 35 : 0;
        }
        const elapsed = this.scanStartedAt ? formatElapsed(Date.now() - this.scanStartedAt) : '—';
        const label = this.completeStep || (sp === null || sp === void 0 ? void 0 : sp.label) || 'Running analysis…';
        let counter = progressDetails.counter;
        if (!counter && (explorerInventory === null || explorerInventory === void 0 ? void 0 : explorerInventory.totalFiles) != null) {
            counter = `Folder inventory · ${formatNumber(explorerInventory.totalFiles)} files${explorerInventory.totalFolders != null
                ? `, ${formatNumber(explorerInventory.totalFolders)} folders`
                : ''}`;
        }
        if (!counter && steps.length && steps.some((s) => s.status === 'done' || s.status === 'running')) {
            const repoInv = (_k = (_f = (_b = this.repositoryInventory) !== null && _b !== void 0 ? _b : (_e = (_d = (_c = this.app) === null || _c === void 0 ? void 0 : _c.state) === null || _d === void 0 ? void 0 : _d.report) === null || _e === void 0 ? void 0 : _e.repositoryInventory) !== null && _f !== void 0 ? _f : (_j = (_h = (_g = this.app) === null || _g === void 0 ? void 0 : _g.scanService) === null || _h === void 0 ? void 0 : _h.report) === null || _j === void 0 ? void 0 : _j.repositoryInventory) !== null && _k !== void 0 ? _k : (_l = this.lastResult) === null || _l === void 0 ? void 0 : _l.repositoryInventory;
            if ((repoInv === null || repoInv === void 0 ? void 0 : repoInv.totalFiles) != null) {
                const folderPart = repoInv.totalFolders != null
                    ? `, ${formatNumber(repoInv.totalFolders)} folders`
                    : '';
                counter = `Repository scope · ${formatNumber(repoInv.totalFiles)} files${folderPart}`;
            }
        }
        const scopeNote = progressDetails.scopeNote;
        const runningStep = steps.find((s) => s.status === 'running');
        const currentFile = (sp === null || sp === void 0 ? void 0 : sp.currentFile)
            ? formatPathInputValue(sp.currentFile)
            : runningStep
                ? `Analyzing: ${formatCompleteStepLine(runningStep)}`
                : '';
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
          ${currentFile ? `<div class="analyze-progress-current-file" title="${escapeHtml((sp === null || sp === void 0 ? void 0 : sp.currentFile) || '')}">${escapeHtml(currentFile)}</div>` : '<div class="analyze-progress-current-file" hidden></div>'}
        </div>
      `;
        }
        return `
      <div class="analyze-progress" id="analyze-progress">
        <div class="analyze-progress-header">
          <span class="analyze-progress-label">${runningStep ? `Step ${doneCount + 1}/${total}: ${runningStep.label}…` : `Complete scan — ${doneCount}/${total} steps`}</span>
          <span class="text-muted analyze-progress-elapsed">${elapsed}</span>
        </div>
        <div class="analyze-progress-bar"><div class="analyze-progress-fill" style="width:${pct}%"></div></div>
        ${counter ? `<div class="analyze-progress-counter text-muted">${escapeHtml(counter)}</div>` : '<div class="analyze-progress-counter text-muted" hidden></div>'}
        ${scopeNote ? `<div class="analyze-progress-scope-note text-muted">${escapeHtml(scopeNote)}</div>` : '<div class="analyze-progress-scope-note text-muted" hidden></div>'}
        ${currentFile ? `<div class="analyze-progress-current-file" title="${escapeHtml((sp === null || sp === void 0 ? void 0 : sp.currentFile) || '')}">${escapeHtml(currentFile)}</div>` : '<div class="analyze-progress-current-file" hidden></div>'}
        <div class="analyze-step-list">
          ${steps.map((step) => `
            <div class="analyze-step-item ${step.status}">
              <span>${step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : step.status === 'running' ? '◉' : step.status === 'skipped' ? '—' : '○'}</span>
              <span>${escapeHtml(formatCompleteStepLine(step))}</span>
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
    startEuAiActAutoRefresh(intervalMs = 30000) {
        this.stopEuAiActAutoRefresh();
        this._euAiActRefreshTimer = setInterval(() => {
            var _a;
            const sprint = (_a = this.app.state.analyzeResult) === null || _a === void 0 ? void 0 : _a.sprint;
            if (sprint && sprint.scannedAt) {
                const age = Date.now() - new Date(sprint.scannedAt).getTime();
                if (age > 5 * 60 * 1000) {
                    this.refresh();
                }
            }
        }, intervalMs);
    }
    stopEuAiActAutoRefresh() {
        if (this._euAiActRefreshTimer) {
            clearInterval(this._euAiActRefreshTimer);
            this._euAiActRefreshTimer = null;
        }
    }
    resolveProgressScanPath() {
        var _a, _b;
        return this._progressScanPath
            || this.app.state.lastProjectPath
            || this.getActiveProjectPath((_b = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input')) === null || _b === void 0 ? void 0 : _b.value)
            || '';
    }
    progressExplorerInventory() {
        var _a;
        const projectPath = this.resolveProgressScanPath();
        if (!projectPath)
            return null;
        return ((_a = liveInventoryForPath(this.app, projectPath)) === null || _a === void 0 ? void 0 : _a.inventory) || null;
    }
    startProgressPolling(projectPath) {
        this.stopProgressPolling();
        if (!projectPath)
            return;
        this._progressScanPath = projectPath;
        const cached = this.app.state.pathInventory;
        if ((cached === null || cached === void 0 ? void 0 : cached.path) && normalizeProjectPath(cached.path) !== normalizeProjectPath(projectPath)) {
            this.app.state.pathInventory = null;
        }
        void refreshPathInventory(this.app, projectPath, { profile: 'universal', fullDirectoryScan: this.fullDirectoryScan })
            .then(() => {
            if (this.busy)
                this.updateProgressDom();
        })
            .catch(() => null);
        this._progressPollInactive = 0;
        this._progressEndpointDown = false;
        /**
         * Poll.
         * @returns {any}
         */
        const poll = async () => {
            var _a;
            if (!this.busy || this._progressEndpointDown)
                return;
            try {
                const progress = await this.app.scanService.fetchScanProgress(projectPath);
                if (progress === null || progress === void 0 ? void 0 : progress.endpointUnavailable) {
                    this._progressPollInactive += 1;
                    if (this._progressPollInactive >= 2) {
                        this._progressEndpointDown = true;
                        this.stopProgressPolling();
                    }
                    return;
                }
                if (progress === null || progress === void 0 ? void 0 : progress.active) {
                    this._progressPollInactive = 0;
                    this.scanProgress = progress;
                    this.updateProgressDom();
                    return;
                }
                if ((_a = this.scanProgress) === null || _a === void 0 ? void 0 : _a.active) {
                    this.scanProgress = null;
                    this.updateProgressDom();
                }
                this._progressPollInactive += 1;
                if (this._progressPollInactive >= 8) {
                    this.stopProgressPolling();
                }
            }
            catch (_b) {
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const root = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#analyze-progress');
        if (!root || !this.busy) {
            // If busy but the progress panel is missing, force a full mount so it renders
            if (this.busy) {
                this._progressEndpointDown = false;
                this._progressPollInactive = 0;
                this.refresh();
            }
            return;
        }
        const sp = this.scanProgress;
        const steps = ((_b = this.completeProgress) === null || _b === void 0 ? void 0 : _b.steps) || [];
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
            if ((sp === null || sp === void 0 ? void 0 : sp.total) && sp.processed != null) {
                const stepFraction = 1 / totalSteps;
                pct = Math.round(stepPct + (sp.processed / sp.total) * stepFraction * 100);
            }
            else {
                pct = Math.round(stepPct);
            }
        }
        else if ((sp === null || sp === void 0 ? void 0 : sp.total) && sp.processed != null) {
            pct = Math.round((sp.processed / sp.total) * 100);
        }
        else {
            pct = 35;
        }
        let counter = progressDetails.counter;
        if (!counter && (explorerInventory === null || explorerInventory === void 0 ? void 0 : explorerInventory.totalFiles) != null) {
            counter = `Folder inventory · ${formatNumber(explorerInventory.totalFiles)} files${explorerInventory.totalFolders != null
                ? `, ${formatNumber(explorerInventory.totalFolders)} folders`
                : ''}`;
        }
        if (!counter && steps.length && steps.some((s) => s.status === 'done' || s.status === 'running')) {
            const repoInv = (_l = (_g = (_c = this.repositoryInventory) !== null && _c !== void 0 ? _c : (_f = (_e = (_d = this.app) === null || _d === void 0 ? void 0 : _d.state) === null || _e === void 0 ? void 0 : _e.report) === null || _f === void 0 ? void 0 : _f.repositoryInventory) !== null && _g !== void 0 ? _g : (_k = (_j = (_h = this.app) === null || _h === void 0 ? void 0 : _h.scanService) === null || _j === void 0 ? void 0 : _j.report) === null || _k === void 0 ? void 0 : _k.repositoryInventory) !== null && _l !== void 0 ? _l : (_m = this.lastResult) === null || _m === void 0 ? void 0 : _m.repositoryInventory;
            if ((repoInv === null || repoInv === void 0 ? void 0 : repoInv.totalFiles) != null) {
                const folderPart = repoInv.totalFolders != null
                    ? `, ${formatNumber(repoInv.totalFolders)} folders`
                    : '';
                counter = `Repository scope · ${formatNumber(repoInv.totalFiles)} files${folderPart}`;
            }
        }
        // Batch all DOM reads/writes in a single frame to avoid layout thrash
        requestAnimationFrame(() => {
            var _a, _b, _c, _d, _e, _f, _g;
            const fill = root.querySelector('.analyze-progress-fill');
            if (fill) {
                const w = `${pct}%`;
                if (fill.style.width !== w)
                    fill.style.width = w;
            }
            const headerLabel = root.querySelector('.analyze-progress-label');
            if (headerLabel) {
                const runningStep = steps.find((s) => s.status === 'running');
                const t = this.analysisType === 'complete' && steps.length
                    ? (runningStep
                        ? `Step ${doneCount + 1}/${totalSteps}: ${runningStep.label}…`
                        : `Complete scan — ${doneCount}/${totalSteps} steps`)
                    : (this.completeStep || (sp === null || sp === void 0 ? void 0 : sp.label) || 'Running analysis…');
                if (headerLabel.textContent !== t)
                    headerLabel.textContent = t;
            }
            const counterEl = root.querySelector('.analyze-progress-counter');
            if (counterEl) {
                const shouldShow = Boolean(counter);
                if (counterEl.hidden === shouldShow)
                    counterEl.hidden = !shouldShow;
                if (shouldShow && counterEl.textContent !== counter)
                    counterEl.textContent = counter;
                if (!shouldShow && counterEl.textContent !== '')
                    counterEl.textContent = '';
            }
            const scopeNoteEl = root.querySelector('.analyze-progress-scope-note');
            if (scopeNoteEl) {
                let note = progressDetails.scopeNote || '';
                const runningStep = steps.find((s) => s.status === 'running');
                if ((runningStep === null || runningStep === void 0 ? void 0 : runningStep.id) === 'codebase') {
                    const repoFiles = (_e = (_b = (_a = this.repositoryInventory) === null || _a === void 0 ? void 0 : _a.totalFiles) !== null && _b !== void 0 ? _b : (_d = (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.repositoryInventory) === null || _d === void 0 ? void 0 : _d.totalFiles) !== null && _e !== void 0 ? _e : 0;
                    if (repoFiles > 5000) {
                        note += (note ? ' ' : '') + `Analyzing ${formatNumber(repoFiles)} files across the full repository tree — this may take several minutes for large codebases.`;
                    }
                    else {
                        note += (note ? ' ' : '') + 'Analyzing all source files for type safety, security, and quality patterns.';
                    }
                }
                const shouldShow = Boolean(note);
                if (scopeNoteEl.hidden === shouldShow)
                    scopeNoteEl.hidden = !shouldShow;
                if (shouldShow && scopeNoteEl.textContent !== note)
                    scopeNoteEl.textContent = note;
                if (!shouldShow && scopeNoteEl.textContent !== '')
                    scopeNoteEl.textContent = '';
            }
            const fileEl = root.querySelector('.analyze-progress-current-file');
            if (fileEl) {
                const runningStep = steps.find((s) => s.status === 'running');
                const file = (sp === null || sp === void 0 ? void 0 : sp.currentFile) || (runningStep ? `Analyzing: ${formatCompleteStepLine(runningStep)}` : '');
                const shouldShow = Boolean(file);
                if (fileEl.hidden === shouldShow)
                    fileEl.hidden = !shouldShow;
                if (shouldShow) {
                    const formatted = (sp === null || sp === void 0 ? void 0 : sp.currentFile) ? formatPathInputValue(file) : file;
                    if (fileEl.textContent !== formatted)
                        fileEl.textContent = formatted;
                    if (fileEl.title !== ((sp === null || sp === void 0 ? void 0 : sp.currentFile) || ''))
                        fileEl.title = (sp === null || sp === void 0 ? void 0 : sp.currentFile) || '';
                }
                else if (fileEl.textContent !== '') {
                    fileEl.textContent = '';
                    fileEl.removeAttribute('title');
                }
            }
            // Update dropzone terminal with current file or step progress
            const runningStep = steps.find((s) => s.status === 'running');
            const terminalLabel = (sp === null || sp === void 0 ? void 0 : sp.currentFile) || (runningStep ? `Step: ${runningStep.label}` : (sp === null || sp === void 0 ? void 0 : sp.label) || '');
            if (terminalLabel) {
                const lastRaw = this._terminalLogLines.length > 0
                    ? this._terminalLogLines[this._terminalLogLines.length - 1].replace(/.*terminal-file">/, '').replace(/<\/span>.*/, '')
                    : '';
                if (terminalLabel !== lastRaw) {
                    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const html = `<span class="terminal-time">[${time}]</span><span class="terminal-prompt">❯</span><span class="terminal-file">${escapeHtml(terminalLabel)}</span>`;
                    this._terminalLogLines.push(html);
                    if (this._terminalLogLines.length > 50) {
                        this._terminalLogLines.shift();
                    }
                    // Re-render terminal body content
                    const dropzoneTerminal = (_f = this._root) === null || _f === void 0 ? void 0 : _f.querySelector('#dropzone-terminal-body');
                    if (dropzoneTerminal) {
                        dropzoneTerminal.innerHTML = this._terminalLogLines.map((ln) => `<div class="terminal-line">${ln}</div>`).join('');
                        dropzoneTerminal.scrollTop = dropzoneTerminal.scrollHeight;
                    }
                }
            }
            const elapsedEl = root.querySelector('.analyze-progress-elapsed');
            if (elapsedEl && this.scanStartedAt) {
                const t = formatElapsed(Date.now() - this.scanStartedAt);
                if (elapsedEl.textContent !== t)
                    elapsedEl.textContent = t;
            }
            const runBtn = (_g = this._root) === null || _g === void 0 ? void 0 : _g.querySelector('#run-analyze-btn');
            if (runBtn && this.busy) {
                const t = this.completeStep || (sp === null || sp === void 0 ? void 0 : sp.label) || 'Running…';
                if (runBtn.textContent !== t)
                    runBtn.textContent = t;
            }
            let stepItems = root.querySelectorAll('.analyze-step-item');
            if (steps.length) {
                if (!stepItems.length) {
                    // Step list was not rendered initially (steps were empty at mount).
                    // Create the list container and populate it now.
                    const listEl = document.createElement('div');
                    listEl.className = 'analyze-step-list';
                    listEl.innerHTML = steps.map((step) => `
            <div class="analyze-step-item ${step.status}">
              <span>${step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : step.status === 'running' ? '◉' : step.status === 'skipped' ? '—' : '○'}</span>
              <span>${escapeHtml(formatCompleteStepLine(step))}</span>
            </div>
          `).join('');
                    root.appendChild(listEl);
                }
                else {
                    steps.forEach((step, index) => {
                        const item = stepItems[index];
                        if (!item)
                            return;
                        const cls = `analyze-step-item ${step.status}`;
                        if (item.className !== cls)
                            item.className = cls;
                        const spans = item.querySelectorAll('span');
                        if (spans[0]) {
                            const icon = step.status === 'done' ? '✓'
                                : step.status === 'error' ? '✕'
                                    : step.status === 'running' ? '◉'
                                        : step.status === 'skipped' ? '—' : '○';
                            if (spans[0].textContent !== icon)
                                spans[0].textContent = icon;
                        }
                        if (spans[1]) {
                            const line = formatCompleteStepLine(step);
                            if (spans[1].textContent !== line)
                                spans[1].textContent = line;
                        }
                    });
                }
            }
        });
    }
    renderEmptyState() {
        var _a, _b, _c, _d, _e;
        const report = this.app.state.report;
        const history = this.app.state.history || [];
        const lastEntry = history[0];
        const defaultPath = this.app.state.defaultProjectPath || this.app.state.lastProjectPath;
        if ((report === null || report === void 0 ? void 0 : report.generatedAt) || lastEntry) {
            const when = (report === null || report === void 0 ? void 0 : report.generatedAt) || (lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.timestamp);
            const rel = when ? this.app.scanService.formatRelativeTime(when) : 'Recently';
            const issues = (_c = (_a = report === null || report === void 0 ? void 0 : report.issueCount) !== null && _a !== void 0 ? _a : (_b = report === null || report === void 0 ? void 0 : report.rawIssues) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : '—';
            const gate = ((_d = report === null || report === void 0 ? void 0 : report.gate) === null || _d === void 0 ? void 0 : _d.pass) ? 'PASS' : 'REVIEW';
            const gateClass = ((_e = report === null || report === void 0 ? void 0 : report.gate) === null || _e === void 0 ? void 0 : _e.pass) ? 'pass' : 'review';
            return `
        <div class="card analyze-empty-state">
          <div class="analyze-empty-icon"><i data-lucide="activity" class="icon-20"></i></div>
          <div class="analyze-empty-body">
            <p class="analyze-empty-title">Last scan ${escapeHtml(rel)}</p>
            <p class="analyze-empty-meta"><strong>${issues}</strong> issue groups · gate <span class="pill ${gateClass}">${gate}</span></p>
          </div>
          <div class="analyze-empty-actions">
            ${defaultPath ? `<button type="button" class="btn btn-primary btn-sm" id="quick-rescan-btn"><i data-lucide="refresh-cw" class="icon-16"></i> Re-run</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" id="goto-results-empty-btn">Results →</button>
          </div>
        </div>
      `;
        }
        return `
      <div class="card analyze-empty-state">
        <div class="analyze-empty-icon"><i data-lucide="scan-line" class="icon-20"></i></div>
        <div class="analyze-empty-body">
          <p class="analyze-empty-title">Ready to scan</p>
          <p class="analyze-empty-meta text-muted">Pick a path above and hit Run, or drop a file for quick check</p>
          <div class="analyze-empty-tips" style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-color);">
            <p class="text-muted" style="font-size:var(--font-size-xs);font-weight:600;margin-bottom:var(--space-2);">Quick start tips</p>
            <ul style="font-size:var(--font-size-xs);color:var(--text-muted);margin:0;padding-left:1.25rem;line-height:1.6;">
              <li>Type a folder path or click <strong>Browse</strong> to select a directory</li>
              <li>Switch to <strong>Complete</strong> mode to run all analysis engines</li>
              <li>Drop a source file on the Quick File Check area for instant in-browser analysis</li>
              <li>Install the <a href="https://marketplace.visualstudio.com/items?itemName=SimpleBeacon.simplebeacon-vscode" target="_blank" rel="noopener">VS Code Extension</a> for real-time monitoring</li>
            </ul>
          </div>
        </div>
        ${defaultPath ? `
          <div class="analyze-empty-actions">
            <button type="button" class="btn btn-primary btn-sm" id="quick-rescan-btn"><i data-lucide="play" class="icon-16"></i> Run default scan</button>
          </div>
        ` : ''}
      </div>
    `;
    }
    setAnalysisType(type, { typeSelect } = {}) {
        this.analysisType = type;
        if (typeSelect)
            typeSelect.value = type;
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
        if (analysisTypeUsesAiNarrative(this.analysisType))
            return true;
        if (analysisTypeSupportsUnderstanding(this.analysisType) && this.understandingMode === 'llm')
            return true;
        return analysisTypeSupportsRoadmapInsights(this.analysisType) && this.roadmapInsightsMode === 'llm';
    }
    showRoadmapInsightsNote() {
        return analysisTypeSupportsRoadmapInsights(this.analysisType);
    }
    syncAnalyzeModeUi(root = this._root) {
        var _a, _b, _c, _d, _e;
        if (!root)
            return;
        const pathInput = root.querySelector('#project-path-input');
        const projectPath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        const scrollContainer = document.querySelector('.app-main') || document.documentElement;
        const savedScrollTop = scrollContainer.scrollTop;
        const queuePanel = root.querySelector('#analyze-engine-queue-panel');
        const savedQueueScroll = queuePanel ? queuePanel.scrollTop : 0;
        const savedActive = document.activeElement;
        const savedActiveEngine = ((_a = savedActive === null || savedActive === void 0 ? void 0 : savedActive.dataset) === null || _a === void 0 ? void 0 : _a.engine) || null;
        const detail = root.querySelector('#analyze-mode-detail');
        if (detail) {
            detail.outerHTML = this.renderSelectedModeDetail().trim();
        }
        const fileResultsSection = root.querySelector('#analyze-file-results-section');
        if (fileResultsSection) {
            fileResultsSection.outerHTML = this.renderFileResultsSection().trim();
        }
        this.bindModeGridEvents(root);
        // Restore scroll synchronously to prevent visual jump
        scrollContainer.scrollTop = savedScrollTop;
        const newQueuePanel = root.querySelector('#analyze-engine-queue-panel');
        if (newQueuePanel)
            newQueuePanel.scrollTop = savedQueueScroll;
        requestAnimationFrame(() => {
            if (savedActiveEngine) {
                const newInput = root.querySelector(`.analyze-engine-input[data-engine="${savedActiveEngine}"]`);
                if (newInput)
                    newInput.focus();
            }
            else if (savedActive && savedActive.id) {
                const newEl = document.getElementById(savedActive.id);
                if (newEl)
                    newEl.focus();
            }
        });
        this.syncRunAnalyzeButtonLabel(root);
        this.syncPathChipStates(root, projectPath);
        (_b = root.querySelector('#analyze-roadmap-insights-wrap')) === null || _b === void 0 ? void 0 : _b.classList.toggle('is-hidden', !analysisTypeSupportsRoadmapInsights(this.analysisType));
        (_c = root.querySelector('#analyze-understanding-wrap')) === null || _c === void 0 ? void 0 : _c.classList.toggle('is-hidden', !analysisTypeSupportsUnderstanding(this.analysisType));
        (_d = root.querySelector('#analyze-ai-provider-wrap')) === null || _d === void 0 ? void 0 : _d.classList.toggle('is-hidden', !this.showAiProviderSelect());
        (_e = root.querySelector('#analyze-roadmap-no-ai-note')) === null || _e === void 0 ? void 0 : _e.classList.toggle('is-hidden', !this.showRoadmapInsightsNote());
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
        if (id === 'demo')
            return false;
        const match = this.providers.find((p) => p.id === id);
        if (match)
            return isAnalyzeProviderConfigured(match);
        if (id === 'active')
            return false;
        return id !== 'demo';
    }
    syncAiProviderNote(root = this._root) {
        if (!root)
            return;
        const note = root.querySelector('#analyze-ai-provider-note');
        if (!note || !this.showAiProviderSelect())
            return;
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
        if ((match === null || match === void 0 ? void 0 : match.statusMessage) && id === 'ollama') {
            note.textContent = match.statusMessage;
            return;
        }
        note.innerHTML = 'Gate findings are always deterministic. This choice only adds an optional LLM summary after the scan.';
    }
    attachDeterministicSummary(target, note) {
        const narrative = buildScanConclusion(target, { focus: 'all' });
        if (!narrative)
            return target;
        target.aiSummary = narrative;
        target.aiSummaryProvider = 'Simplebeacon rules';
        if (note)
            target.aiSummaryNote = note;
        return target;
    }
    async attachOptionalAiSummary(target, projectPath, reportType, options = {}) {
        const type = reportType || (target === null || target === void 0 ? void 0 : target.type) || '';
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
            target.aiSummaryNote = formatAiSummarySkipMessage(`${this.aiProvider} is not configured — add API keys to server .env`);
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
            }
            else if (summary.message || summary.error) {
                const note = formatAiSummarySkipMessage(summary.message || summary.error);
                return this.attachDeterministicSummary(target, note);
            }
        }
        catch (err) {
            const note = formatAiSummarySkipMessage(err.message);
            return this.attachDeterministicSummary(target, note);
        }
        return target;
    }
    async attachRepositoryInventory(projectPath, report) {
        var _a;
        const inventory = (report === null || report === void 0 ? void 0 : report.repositoryInventory)
            || ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.repositoryInventory)
            || null;
        if ((inventory === null || inventory === void 0 ? void 0 : inventory.totalFiles) != null) {
            this.repositoryInventory = inventory;
            if (this.lastResult)
                this.lastResult.repositoryInventory = inventory;
            return inventory;
        }
        try {
            const fetched = await fetchRepositoryInventory(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
            this.repositoryInventory = fetched;
            if (this.lastResult)
                this.lastResult.repositoryInventory = fetched;
            return fetched;
        }
        catch (_b) {
            return null;
        }
    }
    renderIssueFilterToolbar(issues = []) {
        if (!issues.length)
            return '';
        const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const i of issues) {
            const sev = (i.severity || 'low').toLowerCase();
            counts[sev] = (counts[sev] || 0) + 1;
        }
        return `
      <div class="analyze-issue-toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;" data-issue-toolbar>
        <input type="text" class="analyze-path-input" id="issue-search-input"
          placeholder="Search issues..."
          style="flex:1;min-width:200px;font-size:0.8rem;padding:6px 10px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${['critical', 'high', 'medium', 'low', 'info'].map(sev => `<button type="button" class="severity-chip ${sev} active"
              data-sev="${sev}"
              style="padding:4px 10px;border-radius:999px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--surface-elevated);color:var(--text-secondary);transition:all 150ms;">
              ${sev} ${counts[sev] || 0}
            </button>`).join('')}
        </div>
      </div>
    `;
    }
    renderScanFileMetrics(report, canonicalCount = null) {
        var _a, _b, _c, _d;
        const inventory = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.repositoryInventory) || (report === null || report === void 0 ? void 0 : report.repositoryInventory);
        const m = getScanFileMetrics(report, { repositoryInventory: inventory });
        const showMockBreakdown = m.mockSampleFiles != null;
        const showFictionJson = m.fictionJsonFilesScanned != null;
        const repoFiles = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : m.repositoryFiles;
        // Severity breakdown from severityCounts
        const sev = (report === null || report === void 0 ? void 0 : report.severityCounts) || {};
        const severityMetrics = (sev.critical || sev.high || sev.medium || sev.low || sev.info)
            ? `<div class="metric-chip" style="display:flex;gap:4px;align-items:center;" title="Issue severity breakdown">
          ${sev.critical ? `<span style="color:var(--color-danger, #ef4444);font-weight:700;">${sev.critical}C</span>` : ''}
          ${sev.high ? `<span style="color:var(--color-danger, #ef4444);font-weight:700;">${sev.high}H</span>` : ''}
          ${sev.medium ? `<span style="color:var(--color-warning, #f59e0b);font-weight:700;">${sev.medium}M</span>` : ''}
          ${sev.low ? `<span style="color:var(--color-info, #3b82f6);font-weight:700;">${sev.low}L</span>` : ''}
          ${sev.info ? `<span style="color:var(--text-muted, #737373);font-weight:700;">${sev.info}I</span>` : ''}
        </div>`
            : '';
        if (repoFiles != null) {
            return `
        ${severityMetrics}
        <div class="metric-chip" title="Filesystem inventory under ${escapeHtml(formatPathInputValue(m.repositoryRoot) || 'project path')} (${escapeHtml(((_b = report === null || report === void 0 ? void 0 : report.repositoryInventory) === null || _b === void 0 ? void 0 : _b.profile) || 'audit')} profile — ${this.fullDirectoryScan ? 'includes node_modules; skips' : 'skips node_modules,'} .git, github-cache)">
          <strong>${formatNumber(repoFiles)}</strong> repo files · <strong>${formatNumber(m.repositoryFolders)}</strong> folders
        </div>
        <div class="metric-chip" title="Files read by credential, mock-path, and production-leak rules">
          <strong>${formatNumber((_c = m.ruleScopedFilesAnalyzed) !== null && _c !== void 0 ? _c : m.credentialScanned)}</strong> gate rules checked
        </div>
        ${showFictionJson ? `<div class="metric-chip" title="Repository JSON pattern-scanned for fictional KPI strings"><strong>${formatNumber(m.fictionJsonFilesScanned)}</strong> JSON fiction-scanned</div>` : ''}
        ${showMockBreakdown ? `<div class="metric-chip" title="Mock/sample JSON in configured scan paths"><strong>${formatNumber(m.mockSampleFiles)}</strong> mock/sample</div>` : ''}
      `;
        }
        const showRuleScoped = m.ruleScopedFilesAnalyzed != null
            && m.mockSampleFiles != null
            && m.mockSampleFiles !== m.ruleScopedFilesAnalyzed;
        return `
      ${severityMetrics}
      <div class="metric-chip" title="Files read across mock/sample, credential, and production-leak rules">
        <strong>${formatNumber((_d = m.ruleScopedFilesAnalyzed) !== null && _d !== void 0 ? _d : m.filesAnalyzed)}</strong> gate rules checked
      </div>
      ${showFictionJson ? `<div class="metric-chip"><strong>${formatNumber(m.fictionJsonFilesScanned)}</strong> JSON fiction-scanned</div>` : ''}
      ${showMockBreakdown ? `<div class="metric-chip"><strong>${formatNumber(m.mockSampleFiles)}</strong> mock/sample</div>` : ''}
      ${showRuleScoped ? '' : ''}
    `;
    }
    renderScanScopeBanner(report, projectPath) {
        if (!report || report.type === 'file-merger-reduction-report')
            return '';
        const stale = isLegacyScanReport(report, projectPath);
        const monorepoNote = buildMonorepoScopeNote(report);
        // Project metadata header
        const projectName = report.projectRoot || report.projectPath || projectPath || 'Unknown project';
        const version = report.version || report.schemaVersion || report.scannerVersion || '';
        const engine = report.engine || report.scanner || 'SimpleBeacon';
        const generatedAt = report.generatedAt || report.scannedAt || report.exportedAt;
        const ageHours = generatedAt ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60)) : null;
        const ageText = ageHours != null ? `${ageHours}h ago` : '';
        // Cross-reference integrity checks
        const integrityWarnings = [];
        const sev = report.severityCounts || {};
        const issues = report.detectedIssues || report.rawIssues || [];
        const counted = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0) + (sev.info || 0);
        if (counted !== issues.length) {
            integrityWarnings.push(`severityCounts sum (${counted}) ≠ issues.length (${issues.length})`);
        }
        if (report.summary && typeof report.summary.totalIssues === 'number' && report.summary.totalIssues !== issues.length) {
            integrityWarnings.push(`summary.totalIssues (${report.summary.totalIssues}) ≠ issues.length (${issues.length})`);
        }
        return `
      ${stale || integrityWarnings.length > 0 ? `
        <div class="card mb-4" style="border-color: ${integrityWarnings.length ? 'var(--color-danger, #ef4444)' : 'var(--warning-color, #f59e0b)'};">
          ${stale ? `<p style="margin: 0 0 8px; font-size: var(--font-size-sm);">
            Stale or mismatched scan report — re-run the scan on <code>${escapeHtml(formatPathInputValue(projectPath) || 'this path')}</code>
            to attach full repository inventory and gate scope (reportVersion 2).
          </p>` : ''}
          ${integrityWarnings.length ? `<p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-danger, #ef4444);">
            ⚠️ Integrity warning: ${escapeHtml(integrityWarnings.join(' · '))}
          </p>` : ''}
        </div>
      ` : ''}

      <div class="card mb-4 analyze-project-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:1.05rem;">${escapeHtml(String(projectName).split(/[\\/]/).pop())}</div>
          <div class="text-muted" style="font-size:var(--font-size-xs);margin-top:2px;">
            ${escapeHtml(engine)}${version ? ' v' + escapeHtml(version) : ''}
            ${generatedAt ? ' · ' + new Date(generatedAt).toLocaleString() : ''}
            ${ageText ? ' · ' + escapeHtml(ageText) : ''}
            ${report.type ? ' · ' + escapeHtml(report.type) : ''}
          </div>
        </div>
        ${ageHours != null && ageHours > 1 ? `<span class="badge badge-danger" style="font-size:0.65rem;">STALE</span>` : ''}
      </div>

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
        if (!roadmap)
            return '';
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
        if (!insights)
            return '';
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
        if (!conclusion)
            return '';
        return `
      <div class="card mb-4 analyze-conclusion-banner">
        <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">${escapeHtml(sourceLabel)}</p>
        <p style="margin: 0;">${escapeHtml(conclusion)}</p>
      </div>
    `;
    }
    renderScanSummary(entity, conclusion, sourceLabel = 'Deterministic gate scan') {
        const gateLine = conclusion || (entity ? buildScanConclusion(entity) : null);
        if ((entity === null || entity === void 0 ? void 0 : entity.type) === 'simplebeacon-report') {
            return this.renderConclusionBanner(gateLine, 'Deterministic gate scan (AI narrative hidden for compliance integrity)');
        }
        if (entity === null || entity === void 0 ? void 0 : entity.aiSummary) {
            const provider = entity.aiSummaryProvider || this.aiProvider || 'AI';
            return `
        <div class="card mb-4 analyze-scan-summary">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;">
            <span style="opacity:0.7;">🤖 AI-generated summary (${escapeHtml(provider)}) — findings unchanged. Content may contain inaccuracies; verify against scan results.</span>
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
        if (!entity)
            return '';
        const noteBlock = entity.aiSummaryNote
            ? `<p class="text-muted text-sm mb-2">${escapeHtml(entity.aiSummaryNote)}</p>`
            : '';
        if (entity.aiSummary) {
            const provider = entity.aiSummaryProvider || this.aiProvider || 'AI';
            return `
        ${noteBlock}
        <div class="card mb-4 analyze-ai-summary">
          <p class="text-muted mb-2" style="font-size: var(--font-size-xs); margin-top: 0;"><span style="opacity:0.7;">🤖 AI-generated summary (${escapeHtml(provider)}) — findings unchanged. Content may contain inaccuracies; verify against scan results.</span></p>
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
        var _a;
        const path = String(projectPath || '').trim();
        if (!path)
            return null;
        const stateReport = this.app.state.report;
        if (stateReport && reportMatchesPagePath(stateReport, path))
            return stateReport;
        const resultReport = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.report;
        if (resultReport && reportMatchesPagePath(resultReport, path))
            return resultReport;
        return null;
    }
    resolveInventoryReport(requestedPath) {
        var _a;
        const path = this.getActiveProjectPath(requestedPath);
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.report) && reportMatchesPagePath(this.lastResult.report, path)) {
            return this.lastResult.report;
        }
        const stateReport = this.reportForProjectPath(path);
        if (stateReport)
            return stateReport;
        const fallback = this.app.state.report;
        if ((fallback === null || fallback === void 0 ? void 0 : fallback.generatedAt) && reportMatchesPagePath(fallback, path)) {
            return fallback;
        }
        return null;
    }
    renderInventoryProvenanceLine(requestedPath = '') {
        const projectPath = this.getActiveProjectPath(requestedPath);
        const report = this.resolveInventoryReport(requestedPath);
        const provenance = buildPathInventoryProvenance(this.app, projectPath, report);
        return renderInventoryProvenanceHtml(provenance, { redactPath: redactPathForDisplay });
    }
    updateInventoryProvenanceDom(root = this._root) {
        const slot = root === null || root === void 0 ? void 0 : root.querySelector('#analyze-inventory-provenance');
        if (!slot)
            return;
        const pathInput = root.querySelector('#project-path-input');
        slot.innerHTML = this.renderInventoryProvenanceLine(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
    }
    buildModeDetailContext() {
        var _a, _b, _c, _d;
        const pathInput = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
        const projectPath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        const report = this.reportForProjectPath(projectPath);
        // Prefer a path-matched result, but fall back to any recent result so the
        // per-file results panel doesn't vanish immediately after a scan completes.
        const resultPath = ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath) || ((_d = (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.report) === null || _d === void 0 ? void 0 : _d.projectRoot) || '';
        const pathMatched = this.lastResult && reportMatchesPagePath({ projectRoot: resultPath }, projectPath);
        const recentFallback = this.lastResult && !pathMatched
            ? (() => {
                const completedAt = this.lastResult.scanCompletedAt || this.scanStartedAt;
                const ageMs = completedAt ? Date.now() - completedAt : Infinity;
                return ageMs < 60000;
            })()
            : false;
        const lastResult = pathMatched || recentFallback ? this.lastResult : null;
        return { projectPath, report, lastResult };
    }
    syncPathChipStates(root, projectPath) {
        if (!root)
            return;
        const activeNorm = projectPath ? normalizeProjectPath(projectPath) : '';
        root.querySelectorAll('.analyze-path-chip-wrap').forEach((wrap) => {
            const chip = wrap.querySelector('.analyze-path-chip');
            const chipPath = (chip === null || chip === void 0 ? void 0 : chip.dataset.path) || '';
            const active = Boolean(activeNorm && chipPath && normalizeProjectPath(chipPath) === activeNorm);
            wrap.classList.toggle('active', active);
            chip === null || chip === void 0 ? void 0 : chip.classList.toggle('active', active);
        });
    }
    schedulePathDependentUi(root = this._root) {
        clearTimeout(this._pathUiTimer);
        this._pathUiTimer = setTimeout(() => {
            this.syncAnalyzeModeUi(root);
            void this.refreshReportForActivePath(root);
        }, 280);
    }
    clearStaleResultIfPathMismatch() {
        var _a, _b;
        const pathInput = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
        const activePath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        if (!activePath || !this.lastResult)
            return;
        const resultPath = this.lastResult.projectPath || ((_b = this.lastResult.report) === null || _b === void 0 ? void 0 : _b.projectRoot) || '';
        if (resultPath && !reportMatchesPagePath({ projectRoot: resultPath }, activePath)) {
            // Guard against race conditions: don't clear a scan that just finished
            const scanCompletedAt = this.lastResult.scanCompletedAt || this.scanStartedAt;
            const ageMs = scanCompletedAt ? Date.now() - scanCompletedAt : Infinity;
            if (ageMs < 60000)
                return;
            this.lastResult = null;
            this.app.state.analyzeResult = null;
            this.app.state.report = null;
        }
    }
    async refreshReportForActivePath(root = this._root) {
        if (!root)
            return;
        const pathInput = root.querySelector('#project-path-input');
        const projectPath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        this.clearStaleResultIfPathMismatch();
        if (!projectPath) {
            this.app.state.pathInventory = null;
            this.syncAnalyzeModeUi(root);
            return;
        }
        if (isRemoteRepoUrl(projectPath)) {
            this.syncAnalyzeModeUi(root);
            return;
        }
        if (/^https?:\/\//i.test(projectPath)) {
            this.syncAnalyzeModeUi(root);
            return;
        }
        const isRemoteDeployment = typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        const isLocalWindowsPath = /^[a-zA-Z]:[\\/]/i.test(String(projectPath || ''));
        if (isRemoteDeployment && isLocalWindowsPath) {
            // A typed local Windows path can never be resolved by the remote server.
            // Don't poll report/inventory endpoints for it.
            this.app.state.pathInventory = null;
            this.syncAnalyzeModeUi(root);
            return;
        }
        try {
            const live = await this.app.scanService.fetchReport(projectPath);
            if (live && reportMatchesPagePath(live, projectPath)) {
                this.app.state.report = live;
            }
        }
        catch (_a) {
            // No report.json on disk for this path yet — scope panel still shows config defaults.
        }
        await refreshPathInventory(this.app, projectPath, { fullDirectoryScan: this.fullDirectoryScan }).catch(() => null);
        this.syncAnalyzeModeUi(root);
    }
    setPathInputDisplay(pathInput, fullPath) {
        if (!pathInput)
            return;
        pathInput.value = fullPath ? formatPathInputValue(fullPath) : '';
    }
    updateAgentStatusUI(root, text = '', available = false) {
        var _a;
        const status = root === null || root === void 0 ? void 0 : root.querySelector('#agent-status');
        if (!status)
            return;
        status.textContent = text;
        status.classList.remove('available', 'unavailable');
        status.classList.add(available ? 'available' : 'unavailable');
        const cta = root === null || root === void 0 ? void 0 : root.querySelector('#agent-download-cta');
        if (!cta)
            return;
        if (available) {
            cta.textContent = '';
            this._stopAgentWizardPolling();
            return;
        }
        this._renderAgentWizard(cta);
    }
    _getWizardPlatform() {
        if (this._agentWizardPlatform)
            return this._agentWizardPlatform;
        const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('sb-agent-platform') : null;
        if (saved)
            return saved;
        return detectPlatform();
    }
    _setWizardPlatform(platform) {
        this._agentWizardPlatform = platform;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sb-agent-platform', platform);
        }
    }
    _renderAgentWizard(cta) {
        var _a, _b, _c;
        const platform = this._getWizardPlatform();
        cta.textContent = '';
        const wizard = document.createElement('div');
        wizard.className = 'agent-install-wizard';
        const title = document.createElement('p');
        title.className = 'agent-wizard-title';
        title.textContent = 'Local Scan Agent required';
        wizard.appendChild(title);
        const subtitle = document.createElement('p');
        subtitle.className = 'agent-wizard-subtitle';
        subtitle.textContent = 'This program runs on your computer so paths and source code never leave it.';
        wizard.appendChild(subtitle);
        const step1 = document.createElement('div');
        step1.className = 'agent-wizard-step';
        const downloadLink = document.createElement('a');
        downloadLink.className = 'btn btn-primary agent-download-btn';
        downloadLink.href = getAgentDownloadUrl(platform);
        downloadLink.target = '_blank';
        downloadLink.rel = 'noopener';
        downloadLink.textContent = 'Download for ' + getPlatformLabel(platform);
        downloadLink.addEventListener('click', () => this._startAgentWizardPolling());
        step1.appendChild(downloadLink);
        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'btn btn-ghost agent-platform-switch';
        switchBtn.title = 'Wrong platform?';
        switchBtn.textContent = 'Not your platform?';
        switchBtn.addEventListener('click', () => {
            const platforms = ['windows', 'linux', 'macos'];
            const current = this._getWizardPlatform();
            const next = platforms[(platforms.indexOf(current) + 1) % platforms.length] || 'windows';
            this._setWizardPlatform(next);
            this._renderAgentWizard(cta);
        });
        step1.appendChild(switchBtn);
        wizard.appendChild(step1);
        const step2 = document.createElement('div');
        step2.className = 'agent-wizard-step';
        const instructions = document.createElement('p');
        instructions.className = 'agent-wizard-instructions';
        instructions.textContent = getInstallInstructions(platform);
        step2.appendChild(instructions);
        wizard.appendChild(step2);
        const step3 = document.createElement('div');
        step3.className = 'agent-wizard-step';
        const verifyBtn = document.createElement('button');
        verifyBtn.type = 'button';
        verifyBtn.className = 'btn btn-secondary agent-verify-btn';
        verifyBtn.textContent = 'I have installed and started the agent';
        verifyBtn.addEventListener('click', async () => {
            var _a;
            const polling = cta.querySelector('.agent-wizard-polling');
            if (polling)
                polling.classList.remove('hidden');
            await this.probeAndUpdateAgentStatus(this._root);
            if (polling)
                polling.classList.add('hidden');
        });
        step3.appendChild(verifyBtn);
        const polling = document.createElement('span');
        polling.className = 'agent-wizard-polling hidden';
        polling.textContent = 'Waiting for agent…';
        step3.appendChild(polling);
        wizard.appendChild(step3);
        cta.appendChild(wizard);
    }
    _startAgentWizardPolling() {
        this._stopAgentWizardPolling();
        var _a;
        const cta = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#agent-download-cta');
        const polling = cta === null || cta === void 0 ? void 0 : cta.querySelector('.agent-wizard-polling');
        if (polling)
            polling.classList.remove('hidden');
        const start = Date.now();
        const max = 120000;
        const tick = async () => {
            var _a, _b;
            if ((this.agentStatus || {}).available)
                return;
            if (Date.now() - start > max) {
                this._stopAgentWizardPolling();
                if (polling)
                    polling.textContent = 'Still not detected. Try clicking the button above.';
                return;
            }
            await this.probeAndUpdateAgentStatus(this._root);
            if ((this.agentStatus || {}).available) {
                this._stopAgentWizardPolling();
                return;
            }
            this._agentWizardTimer = setTimeout(tick, 3000);
            if (polling)
                (_a = polling.textContent) !== null && _a !== void 0 ? _a : (polling.textContent = 'Waiting for agent…');
        };
        this._agentWizardTimer = setTimeout(tick, 3000);
    }
    _stopAgentWizardPolling() {
        if (this._agentWizardTimer) {
            clearTimeout(this._agentWizardTimer);
            this._agentWizardTimer = null;
        }
    }
    async probeAndUpdateAgentStatus(root = this._root) {
        if (!root)
            return;
        try {
            this.agentStatus = await probeAgent();
        }
        catch (_a) {
            this.agentStatus = { available: false, scannerAvailable: false };
        }
        this.updateAgentStatusUI(root, formatAgentStatus(this.agentStatus), this.agentStatus.available && this.agentStatus.scannerAvailable);
    }
    bindEvents(el) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        void this.probeAndUpdateAgentStatus(el);
        const status4000 = el.querySelector('#agent-4000-status');
        if (status4000) {
            const update4000 = async () => {
                try {
                    const s = await probeAgent4000();
                    if (s.available) {
                        status4000.textContent = 'Localhost:4000 agent connected — typed local paths will be scanned locally';
                        status4000.classList.remove('unavailable');
                        status4000.classList.add('available');
                    }
                    else {
                        status4000.textContent = 'Localhost:4000 agent offline (run node agent.js to enable local path scans)';
                        status4000.classList.remove('available');
                        status4000.classList.add('unavailable');
                    }
                }
                catch (_a) {
                    status4000.textContent = 'Localhost:4000 agent offline (run node agent.js to enable local path scans)';
                    status4000.classList.remove('available');
                    status4000.classList.add('unavailable');
                }
            };
            void update4000();
            this._agent4000Timer = window.setInterval(update4000, 5000);
        }
        const pathInput = el.querySelector('#project-path-input');
        const typeSelect = el.querySelector('#analysis-type-select');
        const providerSelect = el.querySelector('#ai-provider-select');
        (_a = el.querySelector('#analyze-full-directory')) === null || _a === void 0 ? void 0 : _a.addEventListener('change', (event) => {
            // Full-tree scanning is now the enforced default so analyzed-file counts match repository inventory.
            this.fullDirectoryScan = true;
            if (event.target && !event.target.checked) {
                event.target.checked = true;
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('simplebeacon_full_directory_scan', '1');
            }
        });
        (_b = el.querySelector('#analyze-local-mode')) === null || _b === void 0 ? void 0 : _b.addEventListener('change', (event) => {
            this.localMode = Boolean(event.target.checked);
            saveAnalyzePrefs({
                analysisType: this.analysisType,
                aiProvider: this.aiProvider,
                roadmapInsightsMode: this.roadmapInsightsMode,
                understandingMode: this.understandingMode,
                localMode: this.localMode
            });
            this.syncAnalyzeModeUi(el);
        });
        this.bindModeGridEvents(el);
        this.bindClientDeliverablePicker(el);
        this.bindCodebaseSectionEvents(el);
        this.bindFileReductionSectionEvents(el);
        typeSelect === null || typeSelect === void 0 ? void 0 : typeSelect.addEventListener('change', () => {
            this.setAnalysisType(typeSelect.value, { typeSelect });
        });
        providerSelect === null || providerSelect === void 0 ? void 0 : providerSelect.addEventListener('change', () => {
            this.aiProvider = providerSelect.value;
            saveAnalyzePrefs({
                analysisType: this.analysisType,
                aiProvider: this.aiProvider,
                roadmapInsightsMode: this.roadmapInsightsMode,
                understandingMode: this.understandingMode
            });
            this.syncAiProviderNote(el);
        });
        (_c = el.querySelector('#roadmap-insights-select')) === null || _c === void 0 ? void 0 : _c.addEventListener('change', (e) => {
            this.roadmapInsightsMode = e.target.value;
            saveAnalyzePrefs({
                analysisType: this.analysisType,
                aiProvider: this.aiProvider,
                roadmapInsightsMode: this.roadmapInsightsMode,
                understandingMode: this.understandingMode
            });
            this.syncAnalyzeModeUi(el);
        });
        (_d = el.querySelector('#understanding-mode-select')) === null || _d === void 0 ? void 0 : _d.addEventListener('change', (e) => {
            this.understandingMode = e.target.value;
            saveAnalyzePrefs({
                analysisType: this.analysisType,
                aiProvider: this.aiProvider,
                roadmapInsightsMode: this.roadmapInsightsMode,
                understandingMode: this.understandingMode
            });
            this.syncAnalyzeModeUi(el);
        });
        (_e = el.querySelector('#use-default-path-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
            const path = this.app.state.defaultProjectPath;
            if (path && pathInput) {
                this.setPathInputDisplay(pathInput, path);
                this.app.state.lastProjectPath = path;
                this.syncAnalyzeModeUi(el);
                void this.refreshReportForActivePath(el);
            }
        });
        (_f = el.querySelector('#clear-path-btn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', () => {
            if (pathInput)
                pathInput.value = '';
            this.app.state.lastProjectPath = '';
            localStorage.removeItem('simplebeaconRecentPaths');
            const pathSourcesEl = el.querySelector('.analyze-path-sources');
            if (pathSourcesEl) {
                const defaultPath = this.app.state.defaultProjectPath || '';
                pathSourcesEl.outerHTML = this.renderPathSourceSections(defaultPath, '');
            }
            this.syncAnalyzeModeUi(el);
        });
        // Quick action buttons
        (_g = el.querySelector('#quick-action-run-btn')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', () => {
            const pathInput = el.querySelector('#project-path-input');
            const resolvedPath = this.resolveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
            if (resolvedPath) {
                void this.runPathAnalysis(resolvedPath);
            }
            else {
                showToast('Enter a project path first', 'error');
            }
        });
        (_h = el.querySelector('#quick-action-results-btn')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', () => {
            this.openResultsView();
        });
        (_j = el.querySelector('#quick-action-export-btn')) === null || _j === void 0 ? void 0 : _j.addEventListener('click', () => {
            const payload = this.buildScanResultExport();
            if (!payload) {
                showToast('No scan results to export', 'error');
                return;
            }
            downloadJson(payload, this.resolveScanExportFilename());
            showToast('Scan report exported', 'success');
        });
        (_k = el.querySelector('#quick-action-remediation-btn')) === null || _k === void 0 ? void 0 : _k.addEventListener('click', () => {
            const payload = this.buildRemediationExport();
            if (!payload) {
                showToast('No remediation data available — run a scan first', 'error');
                return;
            }
            this.app.state.remediationPayload = payload;
            this.app.navigate('remediation');
        });
        // VS Code Extension card — sync report to sidebar
        (_l = el.querySelector('#vscode-sync-report-btn')) === null || _l === void 0 ? void 0 : _l.addEventListener('click', () => {
            var _a, _b, _c, _d;
            const report = this.resolveResultsReport();
            if (!report) {
                showToast('No scan report to sync — run a scan first', 'error');
                return;
            }
            const hasVsCodeApi = typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
            if (!hasVsCodeApi) {
                showToast('Not running inside a VS Code-family editor', 'error');
                return;
            }
            try {
                const vscode = this._getVscodeApi();
                if (!vscode) {
                    showToast('VS Code API unavailable', 'error');
                    return;
                }
                const allIssues = report.rawIssues || report.detectedIssues || [];
                const sev = report.severityCounts || {};
                vscode.postMessage({
                    command: 'updateReport',
                    report: {
                        totalFiles: report.repositoryFilesTotal || report.totalFiles || 0,
                        ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed || report.filesAnalyzed || 0,
                        issueCount: allIssues.length,
                        qualityScore: (_c = (_a = report.qualityScore) !== null && _a !== void 0 ? _a : (_b = report.gate) === null || _b === void 0 ? void 0 : _b.score) !== null && _c !== void 0 ? _c : 0,
                        gate: report.gate || { pass: false },
                        issues: allIssues.slice(0, 200),
                        projectPath: report.projectRoot || report.projectPath || ((_d = this.lastResult) === null || _d === void 0 ? void 0 : _d.projectPath) || '',
                        severityCounts: sev
                    }
                });
                showToast('Scan report synced to sidebar', 'success');
            }
            catch (err) {
                showToast('Failed to sync: ' + err.message, 'error');
            }
        });
        // Real-time monitoring toggle
        (_m = el.querySelector('#analyze-realtime-monitor')) === null || _m === void 0 ? void 0 : _m.addEventListener('change', (event) => {
            this.realtimeMonitorEnabled = Boolean(event.target.checked);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('simplebeacon_realtime_monitor', this.realtimeMonitorEnabled ? '1' : '0');
            }
            showToast(this.realtimeMonitorEnabled ? 'Real-time monitoring enabled' : 'Real-time monitoring disabled', 'info');
        });
        (_o = el.querySelector('#browse-dir-btn')) === null || _o === void 0 ? void 0 : _o.addEventListener('click', async () => {
            const isRemoteDeployment = typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
            const agentAvailable = !!(this.agentStatus && this.agentStatus.available);
            if (!isRemoteDeployment || agentAvailable) {
                // Local/standalone mode or local agent connected: prefer the native directory picker (Chrome/Edge).
                if (window.showDirectoryPicker && !this.isElectronLike()) {
                    const picked = await this.pickFolderViaBrowser(el);
                    if (picked)
                        return;
                }
                const input = el.querySelector('#browse-dir-input');
                if (input) {
                    input.value = '';
                    input.click();
                    return;
                }
            }
            // Remote deployment without a local agent: open the server directory browser so the user can pick the
            // actual server project path (e.g., /opt/render/project/src/ai-platform/CascadeProjects).
            this.openDirBrowser(el);
        });
        // Analyze drop zone — drag-and-drop for scan reports / source files
        const analyzeDropZone = el.querySelector('#analyze-drop-zone');
        if (analyzeDropZone) {
            let dropDragDepth = 0;
            ['dragenter', 'dragover'].forEach((eventName) => {
                analyzeDropZone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dropDragDepth++;
                    analyzeDropZone.classList.add('drag-active');
                });
            });
            analyzeDropZone.addEventListener('dragleave', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dropDragDepth--;
                if (dropDragDepth <= 0) {
                    analyzeDropZone.classList.remove('drag-active');
                    dropDragDepth = 0;
                }
            });
            analyzeDropZone.addEventListener('drop', async (event) => {
                var _a, _b;
                event.preventDefault();
                event.stopPropagation();
                dropDragDepth = 0;
                analyzeDropZone.classList.remove('drag-active');
                const dt = event.dataTransfer;
                const files = dt === null || dt === void 0 ? void 0 : dt.files;
                // Directory drop detection via File System Access API
                if ((dt === null || dt === void 0 ? void 0 : dt.items) && dt.items.length > 0) {
                    const entry = (_b = (_a = dt.items[0]).webkitGetAsEntry) === null || _b === void 0 ? void 0 : _b.call(_a);
                    if (entry === null || entry === void 0 ? void 0 : entry.isDirectory) {
                        const folderName = entry.name || '';
                        const resolvedPath = this.resolveFolderPathFromFiles(files, folderName);
                        if (resolvedPath) {
                            const pathInput = el.querySelector('#project-path-input');
                            if (pathInput) {
                                this.setPathInputDisplay(pathInput, resolvedPath);
                                this.app.state.lastProjectPath = resolvedPath;
                                this.app.state.pathInputDraft = '';
                                this.syncAnalyzeModeUi(el);
                                void this.refreshReportForActivePath(el);
                            }
                            void this.runPathAnalysis(resolvedPath);
                            showToast(`Analyzing dropped folder "${folderName}"…`, 'info');
                        } else if (files && files.length > 0) {
                            // Absolute path is unavailable (e.g., Firefox Privacy mode). Use the local-scan fallback.
                            const updateFingerprintStatus = (text) => {
                                const fp = el.querySelector('#fingerprint-status');
                                if (fp)
                                    fp.textContent = text || '';
                            };
                            void this.handleDroppedFolderFallback(files, folderName, event, null, updateFingerprintStatus);
                        } else {
                            showToast(`Directory "${folderName}" dropped but absolute path could not be read. Use Browse Folder or type the path.`, 'warning');
                        }
                        return;
                    }
                }
                if (!(files === null || files === void 0 ? void 0 : files.length))
                    return;
                const file = files[0];
                const isJson = file.name.endsWith('.json');
                const isZip = file.name.endsWith('.zip');
                if (isJson) {
                    // Scan report import
                    try {
                        const text = await file.text();
                        const parsed = JSON.parse(text);
                        if (await this.importJsonReport(parsed, file.name, { bytes: file.size })) {
                            return;
                        }
                        showToast(`${file.name} parsed as JSON but report type was not recognized`, 'info');
                    }
                    catch (_c) {
                        showToast('Failed to parse report JSON', 'error');
                    }
                    return;
                }
                if (isZip) {
                    // Complete-scan ZIP bundle — currently loaded client-side only
                    try {
                        const text = await file.text();
                        const report = JSON.parse(text);
                        this.lastResult = report;
                        this.lastScanId = report.scanId || report.id || Date.now().toString();
                        this.projectPath = report.projectPath || report.projectRoot || '';
                        showToast(`Report "${file.name}" loaded`, 'success');
                        this.refresh();
                    }
                    catch (_c) {
                        showToast('Failed to parse report JSON', 'error');
                    }
                    return;
                }
                // Single source file scan
                void this.handleAnalyzeFiles(files);
            });
        }
        // Select File button triggers hidden file input
        (_q = el.querySelector('#analyze-select-file-btn')) === null || _q === void 0 ? void 0 : _q.addEventListener('click', () => {
            let input = el.querySelector('#analyze-file-input');
            if (!input) {
                input = document.createElement('input');
                input.type = 'file';
                input.id = 'analyze-file-input-fallback';
                input.accept = SNIPPET_ACCEPT;
                input.hidden = true;
                el.appendChild(input);
            }
            input.click();
        });
        // Quick Scan button triggers a quick scan on the current path
        (_r = el.querySelector('#quick-file-scan-btn')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', () => {
            var _a;
            const raw = (_a = pathInput === null || pathInput === void 0 ? void 0 : pathInput.value) === null || _a === void 0 ? void 0 : _a.trim();
            if (!raw) {
                showToast('Enter a project path first', 'error');
                return;
            }
            const resolvedPath = this.resolveProjectPath(raw);
            if (!resolvedPath) {
                showToast('Invalid path', 'error');
                return;
            }
            this.analysisType = 'quick';
            this.app.state.pathInputDraft = '';
            this.app.state.lastProjectPath = resolvedPath;
            this.setPathInputDisplay(pathInput, resolvedPath);
            this.savePreferredProjectBase(resolvedPath);
            void this.runPathAnalysis(resolvedPath);
        });
        // Dropzone Analyze button triggers the same analysis as Enter on project-path-input
        const dropzoneAnalyzeBtn = el.querySelector('#dropzone-path-analyze-btn');
        dropzoneAnalyzeBtn === null || dropzoneAnalyzeBtn === void 0 ? void 0 : dropzoneAnalyzeBtn.addEventListener('click', () => {
            var _a;
            const raw = (_a = pathInput === null || pathInput === void 0 ? void 0 : pathInput.value) === null || _a === void 0 ? void 0 : _a.trim();
            if (!raw)
                return;
            const resolvedPath = this.resolveProjectPath(raw);
            if (!resolvedPath)
                return;
            this.app.state.pathInputDraft = '';
            this.app.state.lastProjectPath = resolvedPath;
            this.setPathInputDisplay(pathInput, resolvedPath);
            this.savePreferredProjectBase(resolvedPath);
            void this.refreshReportForActivePath(el);
            void this.runPathAnalysis(resolvedPath);
        });
        // Browser-native sandbox directory picker (File System Access API)
        const sandboxPickerBtn = el.querySelector('#trigger-native-picker');
        sandboxPickerBtn === null || sandboxPickerBtn === void 0 ? void 0 : sandboxPickerBtn.addEventListener('click', () => {
            void this.runSandboxedDirectoryScan();
        });
        // Handle folder selection from the hidden directory input
        (_s = el.querySelector('#browse-dir-input')) === null || _s === void 0 ? void 0 : _s.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files === null || files === void 0 ? void 0 : files.length) {
                const firstFile = files[0];
                const relPath = firstFile.webkitRelativePath || '';
                const filePath = firstFile.path;
                // In Electron / Tauri the file objects expose the absolute filesystem path.
                if (filePath && relPath) {
                    const normalizedFull = filePath.replace(/\\/g, '/');
                    const normalizedRel = relPath.replace(/\\/g, '/');
                    if (normalizedFull.endsWith(normalizedRel)) {
                        const baseDir = normalizedFull.slice(0, -normalizedRel.length).replace(/\/$/, '');
                        const folderName = normalizedRel.split('/')[0] || '';
                        let resolvedPath = baseDir ? `${baseDir}/${folderName}` : folderName;
                        // If the browser didn't expose an absolute path, fall back to a sensible
                        // guess from typed/last/default paths rather than inventing C:/Users.
                        if (!resolvedPath.match(/^[a-zA-Z]:/) && !resolvedPath.startsWith('/')) {
                            resolvedPath = this.resolveFallbackFolderPath(folderName) || folderName;
                        }
                        const pathInput = el.querySelector('#project-path-input');
                        if (pathInput) {
                            this.setPathInputDisplay(pathInput, resolvedPath);
                            this.app.state.lastProjectPath = resolvedPath;
                            this.app.state.pathInputDraft = '';
                            this.syncAnalyzeModeUi(el);
                            void this.refreshReportForActivePath(el);
                            void this.runPathAnalysis(resolvedPath);
                        }
                        e.target.value = '';
                        return;
                    }
                }
                const folderName = relPath.split('/')[0] || firstFile.name || '';
                // webkitdirectory only gives relative paths in regular browsers; scan locally instead of uploading.
                showToast('Scanning selected folder locally — no upload…', 'info');
                void this.runLocalScan(null, files);
                // Keep the path input set to a best-guess location for reference.
                const pathInput = el.querySelector('#project-path-input');
                if (pathInput && folderName) {
                    const fallback = this.resolveFallbackFolderPath(folderName);
                    this.setPathInputDisplay(pathInput, fallback);
                    this.app.state.lastProjectPath = fallback;
                    this.app.state.pathInputDraft = '';
                    this.syncAnalyzeModeUi(el);
                }
            }
            e.target.value = '';
        });
        (_t = el.querySelector('#dir-browser-close-btn')) === null || _t === void 0 ? void 0 : _t.addEventListener('click', () => {
            this.closeDirBrowser(el);
        });
        (_u = el.querySelector('#dir-browser-up-btn')) === null || _u === void 0 ? void 0 : _u.addEventListener('click', () => {
            this.dirBrowserGoUp(el);
        });
        (_v = el.querySelector('#dir-browser-select-btn')) === null || _v === void 0 ? void 0 : _v.addEventListener('click', () => {
            this.selectDirBrowserPath(el);
        });
        (_w = el.querySelector('#dir-browser-list')) === null || _w === void 0 ? void 0 : _w.addEventListener('click', (event) => {
            const item = event.target.closest('.dir-browser-item');
            if (!item)
                return;
            const dirPath = item.dataset.path;
            if (dirPath)
                this.loadDirBrowser(el, dirPath);
        });
        (_x = el.querySelector('#dir-browser-list')) === null || _x === void 0 ? void 0 : _x.addEventListener('dblclick', (event) => {
            const item = event.target.closest('.dir-browser-item');
            if (!item)
                return;
            const dirPath = item.dataset.path;
            if (dirPath) {
                this._dirBrowserPath = dirPath;
                this.selectDirBrowserPath(el);
            }
        });
        el.addEventListener('click', (event) => {
            const chip = event.target.closest('.analyze-path-chip');
            if (chip) {
                const path = chip.dataset.path;
                if (pathInput)
                    this.setPathInputDisplay(pathInput, path);
                this.app.state.pathInputDraft = '';
                this.app.state.lastProjectPath = path;
                this.syncAnalyzeModeUi(el);
                void this.refreshReportForActivePath(el);
                return;
            }
            const dismissBtn = event.target.closest('.analyze-path-chip-dismiss');
            if (dismissBtn) {
                event.preventDefault();
                event.stopPropagation();
                const path = dismissBtn.dataset.path;
                removeRecentPath(path);
                if (this.app.state.lastProjectPath === path) {
                    this.app.state.lastProjectPath = '';
                    if (pathInput)
                        pathInput.value = '';
                }
                this.refresh();
                return;
            }
            const clearAllBtn = event.target.closest('#clear-recent-paths-btn');
            if (clearAllBtn) {
                event.preventDefault();
                event.stopPropagation();
                localStorage.removeItem('simplebeaconRecentPaths');
                this.refresh();
                showToast('Recent paths cleared', 'info');
            }
        });
        (_y = el.querySelector('#run-analyze-btn')) === null || _y === void 0 ? void 0 : _y.addEventListener('click', () => {
            if (this.analysisType === 'complete') {
                this.persistSelectedEngines(el);
                const enginesToRun = resolveEnginesForRun(this.selectedEngines);
                if (!enginesToRun.length) {
                    showToast('Select at least one engine on the mode pills', 'error');
                    return;
                }
            }
            this.runPathAnalysis(this.resolveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value));
        });
        (_z = el.querySelector('#issue-select-all-btn')) === null || _z === void 0 ? void 0 : _z.addEventListener('click', () => {
            this.selectedIssueIds = new Set(AI_SYSTEM_ISSUES.map((issue) => issue.id));
            this.refresh();
        });
        (_0 = el.querySelector('#issue-clear-all-btn')) === null || _0 === void 0 ? void 0 : _0.addEventListener('click', () => {
            this.selectedIssueIds = new Set();
            this.aiIssueAnalysisResult = null;
            this.refresh();
        });
        (_1 = el.querySelector('#run-issue-analysis-btn')) === null || _1 === void 0 ? void 0 : _1.addEventListener('click', () => {
            this.aiIssueAnalysisResult = buildAiSystemsIssueAnalysis(Array.from(this.selectedIssueIds), { context: this.buildAnalyzerSuiteContext() });
            this.refresh();
        });
        (_2 = el.querySelector('#export-ai-analyzer-json-btn')) === null || _2 === void 0 ? void 0 : _2.addEventListener('click', () => {
            if (!this.aiIssueAnalysisResult) {
                showToast('Run analyzer suite first', 'info');
                return;
            }
            const pathInput = el.querySelector('#project-path-input');
            const projectPath = this.resolveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
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
        (_3 = el.querySelector('#export-ai-analyzer-csv-btn')) === null || _3 === void 0 ? void 0 : _3.addEventListener('click', () => {
            if (!this.aiIssueAnalysisResult) {
                showToast('Run analyzer suite first', 'info');
                return;
            }
            const pathInput = el.querySelector('#project-path-input');
            const projectPath = this.resolveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
            const payload = sanitizeAiProblemAnalyzerExport(this.aiIssueAnalysisResult, {
                projectPath,
                context: this.buildAnalyzerSuiteContext()
            });
            if (!payload) {
                showToast('Nothing to export', 'info');
                return;
            }
            const slug = pathToFileSlug(projectPath);
            downloadText(buildAiProblemAnalyzerCsv(payload), `ai-problem-analyzer-${slug}-${dateStamp()}.csv`, 'text/csv;charset=utf-8');
            showToast('Analyzer suite CSV exported', 'success');
        });
        el.querySelectorAll('input[data-ai-issue-id]').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                const id = event.target.dataset.aiIssueId;
                if (!id)
                    return;
                if (event.target.checked) {
                    this.selectedIssueIds.add(id);
                }
                else {
                    this.selectedIssueIds.delete(id);
                }
                this.aiIssueAnalysisResult = null;
                this.refresh();
            });
        });
        (_4 = el.querySelector('#goto-results-quick-btn')) === null || _4 === void 0 ? void 0 : _4.addEventListener('click', () => {
            this.openResultsView();
        });
        pathInput === null || pathInput === void 0 ? void 0 : pathInput.addEventListener('input', () => {
            this.app.state.pathInputDraft = pathInput.value;
            this.app.state.lastProjectPath = '';
            // Auto-detect website URL mode based on input prefix
            const raw = String(pathInput.value || '').trim();
            const looksLikeUrl = /^https?:\/\//i.test(raw) || /^git@/i.test(raw) || /^ssh:\/\//i.test(raw);
            if (looksLikeUrl && !this.websiteMode) {
                this.websiteMode = true;
                this.refresh();
            }
            else if (!looksLikeUrl && this.websiteMode) {
                this.websiteMode = false;
                this.refresh();
            }
            this.schedulePathDependentUi(el);
        });
        pathInput === null || pathInput === void 0 ? void 0 : pathInput.addEventListener('blur', () => {
            clearTimeout(this._pathUiTimer);
            this.syncAnalyzeModeUi(el);
            void this.refreshReportForActivePath(el);
        });
        pathInput === null || pathInput === void 0 ? void 0 : pathInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const resolved = this.resolveProjectPath(pathInput.value);
                if (!resolved)
                    return;
                this.app.state.pathInputDraft = '';
                this.app.state.lastProjectPath = resolved;
                this.setPathInputDisplay(pathInput, resolved);
                this.savePreferredProjectBase(resolved);
                void this.refreshReportForActivePath(el);
                void this.runPathAnalysis(resolved);
            }
        });
        (_5 = el.querySelector('#refresh-analyze-providers-btn')) === null || _5 === void 0 ? void 0 : _5.addEventListener('click', async () => {
            const btn = el.querySelector('#refresh-analyze-providers-btn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Refreshing…';
            }
            try {
                await this.loadProviders(providerSelect, { refresh: true });
                showToast('Provider status updated', 'success');
            }
            catch (err) {
                showToast(err.message || 'Refresh failed', 'error');
            }
            finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Refresh provider status';
                }
            }
        });
        // Path area drag/drop — uses file.path in desktop/Electron, otherwise uploads folder
        const updateFingerprintStatus = (text) => {
            const status = el.querySelector('#fingerprint-status');
            if (status)
                status.textContent = text || '';
        };
        const pathDropzone = el.querySelector('#analyze-path-dropzone');
        if (pathDropzone) {
            let pathDragDepth = 0;
            ['dragenter', 'dragover'].forEach((eventName) => {
                pathDropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (eventName === 'dragenter') {
                        pathDragDepth++;
                    }
                    pathDropzone.classList.add('drag-active');
                    if (event.dataTransfer)
                        event.dataTransfer.dropEffect = 'copy';
                });
            });
            pathDropzone.addEventListener('dragleave', (event) => {
                event.preventDefault();
                event.stopPropagation();
                pathDragDepth--;
                if (pathDragDepth <= 0) {
                    pathDropzone.classList.remove('drag-active');
                    pathDragDepth = 0;
                }
            });
            pathDropzone.addEventListener('drop', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                pathDragDepth = 0;
                pathDropzone.classList.remove('drag-active');

                const items = event.dataTransfer && event.dataTransfer.items;
                const dtFiles = event.dataTransfer && event.dataTransfer.files;
                let entry = null;
                let folderName = '';

                if (items && items.length) {
                    try {
                        entry = items[0].webkitGetAsEntry && items[0].webkitGetAsEntry();
                    } catch (_a) {
                        entry = null;
                    }
                    if (!entry && dtFiles && dtFiles.length && dtFiles[0].webkitRelativePath) {
                        folderName = String(dtFiles[0].webkitRelativePath).split('/')[0];
                    }
                    if (entry) {
                        folderName = entry.name || folderName;
                    }
                }

                if (!folderName && dtFiles && dtFiles.length) {
                    folderName = dtFiles[0].name || 'folder';
                }

                // Single file drop -> use the existing file analyzer.
                if (entry && entry.isFile && dtFiles && dtFiles.length) {
                    void this.handleAnalyzeFiles(dtFiles);
                    return;
                }

                const collected = [];
                if (entry && entry.isDirectory) {
                    await traverseDirectoryEntry(entry, '', collected);
                } else if (dtFiles && dtFiles.length) {
                    for (const f of Array.from(dtFiles)) {
                        const rel = f.webkitRelativePath || f.name;
                        collected.push({ file: f, path: rel });
                    }
                }

                if (collected.length) {
                    const pathInput = el.querySelector('#project-path-input');
                    const rawFallback = this.resolveFallbackFolderPath(folderName) || folderName;
                    const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
                    const isLinuxPath = (p) => /^\//.test(p) && !/^[a-zA-Z]:/.test(p);
                    const displayPath = (isWindowsClient && isLinuxPath(rawFallback.replace(/\\/g, '/')))
                        ? folderName
                        : rawFallback;
                    if (pathInput) {
                        pathInput.value = displayPath;
                        this.app.state.pathInputDraft = '';
                        this.app.state.lastProjectPath = displayPath;
                        this.setPathInputDisplay(pathInput, displayPath);
                        this.syncAnalyzeModeUi(el);
                    }
                    showToast(`Scanning "${folderName}" locally in your browser…`, 'info');
                    await this.runLocalScan(null, collected.map((item) => item.file), displayPath);
                    return;
                }

                if (dtFiles && dtFiles.length) {
                    void this.handleAnalyzeFiles(dtFiles);
                    return;
                }

                showToast('Nothing detected. Drop a folder or file, or type a path manually.', 'warning');
            });
        }
        this.bindFileDropEvents(el);
        if (!this._aiKeysListenerBound && typeof window !== 'undefined') {
            window.addEventListener('simplebeacon:ai-keys-updated', this._onAiKeysUpdated);
            this._aiKeysListenerBound = true;
        }
        this.loadProviders(providerSelect, { refresh: true });
        this.loadTestSources(el);
    }
    _deriveFallbackBase() {
        // Prefer a real previously-used or configured path as a fallback base.
        // Never fabricate C:/Users because it is almost always the wrong location
        // on multi-drive Windows installs, and never use the server's Linux default
        // path as a fallback base for a Windows client.
        const isAbs = (p) => /^[a-zA-Z]:\//.test(p) || /^\//.test(p);
        const isLinuxPath = (p) => /^\//.test(p) && !/^[a-zA-Z]:/.test(p);
        const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
        const lastPath = String(this.app.state.lastProjectPath || '');
        if (lastPath && isAbs(lastPath.replace(/\\/g, '/'))) {
            const norm = lastPath.replace(/\\/g, '/').replace(/\/+$/, '');
            if (!isWindowsClient || !isLinuxPath(norm))
                return norm;
        }
        const defaultPath = String(this.app.state.defaultProjectPath || '');
        if (defaultPath && isAbs(defaultPath.replace(/\\/g, '/'))) {
            const norm = defaultPath.replace(/\\/g, '/').replace(/\/+$/, '');
            if (!isWindowsClient || !isLinuxPath(norm))
                return norm;
        }
        return '';
    }
    openDirBrowser(el) {
        const modal = el.querySelector('#dir-browser-modal');
        if (!modal)
            return;
        const pathInput = el.querySelector('#project-path-input');
        const isRemoteDeployment = typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        let currentPath = this.resolveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value) || this.app.state.defaultProjectPath || '';
        // On a remote deployment, local Windows paths or bare folder names cannot be browsed
        // by the server. Start from the server's default project path instead.
        if (isRemoteDeployment && (isLocalPath(currentPath) || (currentPath && !currentPath.startsWith('/') && !/^[a-zA-Z]:[\\/]/i.test(currentPath)))) {
            currentPath = this.app.state.defaultProjectPath || '';
        }
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        // Start from the current path if it is a valid directory; otherwise show the drives/root list.
        this._dirBrowserPath = currentPath;
        this.loadDirBrowser(el, currentPath);
    }
    closeDirBrowser(el) {
        const modal = el.querySelector('#dir-browser-modal');
        if (!modal)
            return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        this._dirBrowserPath = null;
    }
    async loadDirBrowser(el, dirPath) {
        const listEl = el.querySelector('#dir-browser-list');
        const pathEl = el.querySelector('#dir-browser-current-path');
        if (!listEl || !pathEl)
            return;
        listEl.innerHTML = '<div class="dir-browser-empty">Loading directories…</div>';
        const displayPath = dirPath || 'Computer';
        pathEl.textContent = displayPath;
        this._dirBrowserPath = dirPath;
        // Local paths cannot be browsed by the remote server; type them directly into the path input.
        if (isLocalPath(dirPath)) {
            listEl.innerHTML = '<div class="dir-browser-empty">Local folders cannot be browsed from the server. Type the path above or run the Local Scan Agent.</div>';
            return;
        }
        try {
            const res = await fetch(`/api/analyze/list-directories?path=${encodeURIComponent(dirPath)}`, { cache: 'no-store' });
            const data = await res.json();
            if (!data.success) {
                listEl.innerHTML = `<div class="dir-browser-empty">Error: ${escapeHtml(data.error || 'Failed to load directories')}</div>`;
                return;
            }
            const current = data.current || dirPath;
            pathEl.textContent = current || 'Computer';
            this._dirBrowserPath = current;
            if (!data.directories || data.directories.length === 0) {
                listEl.innerHTML = '<div class="dir-browser-empty">No subdirectories</div>';
                return;
            }
            const parentItem = data.parent
                ? `<div class="dir-browser-item" data-path="${escapeHtml(data.parent)}"><span class="dir-icon">⬆️</span> <strong>..</strong></div>`
                : '';
            const isDriveList = !current;
            const icon = isDriveList ? '💾' : '📁';
            const items = data.directories.map((dir) => `<div class="dir-browser-item" data-path="${escapeHtml(dir.path)}"><span class="dir-icon">${icon}</span> ${escapeHtml(dir.name)}</div>`).join('');
            listEl.innerHTML = parentItem + items;
        }
        catch (err) {
            listEl.innerHTML = `<div class="dir-browser-empty">Error: ${escapeHtml(err.message)}</div>`;
        }
    }
    dirBrowserGoUp(el) {
        if (!this._dirBrowserPath)
            return;
        const normalized = this._dirBrowserPath.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0)
            return;
        if (parts.length === 1 && /^[a-zA-Z]:$/.test(parts[0])) {
            // At a Windows drive root (e.g. D:/). Show the drives list.
            this.loadDirBrowser(el, '');
            return;
        }
        parts.pop();
        const parent = parts.join('/');
        const parentPath = normalized.startsWith('/') ? '/' + parent : parent;
        this.loadDirBrowser(el, parentPath);
    }
    selectDirBrowserPath(el) {
        const pathInput = el.querySelector('#project-path-input');
        if (pathInput && this._dirBrowserPath) {
            this.setPathInputDisplay(pathInput, this._dirBrowserPath);
            this.app.state.lastProjectPath = this._dirBrowserPath;
            this.app.state.pathInputDraft = '';
            this.syncAnalyzeModeUi(el);
            void this.refreshReportForActivePath(el);
        }
        this.closeDirBrowser(el);
    }
    isElectronLike() {
        var _a, _b;
        return Boolean(typeof window !== 'undefined' &&
            (((_b = (_a = window.process) === null || _a === void 0 ? void 0 : _a.versions) === null || _b === void 0 ? void 0 : _b.electron) || /Electron/.test(navigator.userAgent)));
    }
    /** Try native directory picker; returns true if a folder was chosen. */
    async pickFolderViaBrowser(el) {
        var _a, _b, _c;
        // In Electron-like environments skip showDirectoryPicker because it cannot
        // reveal absolute paths; the webkitdirectory fallback gives files with .path.
        if (!window.showDirectoryPicker || this.isElectronLike())
            return false;
        try {
            const dirHandle = await window.showDirectoryPicker();
            const folderName = dirHandle.name || '';
            const currentInput = this.resolveProjectPath((_c = el.querySelector('#project-path-input')) === null || _c === void 0 ? void 0 : _c.value);
            const rawDefault = String(currentInput || this.app.state.defaultProjectPath || this._deriveFallbackBase())
                .replace(/\\/g, '/')
                .replace(/\/+$/, '');
            // Use the parent directory of the current path as the base, not stripped to user home
            const lastSlash = rawDefault.lastIndexOf('/');
            const basePath = (lastSlash > 2) ? rawDefault.substring(0, lastSlash) : rawDefault;
            const resolvedPath = `${basePath}/${folderName}`;
            const pathInput = el.querySelector('#project-path-input');
            const fingerprintStatus = el.querySelector('#fingerprint-status');
            if (fingerprintStatus)
                fingerprintStatus.textContent = '';
            if (pathInput) {
                this.setPathInputDisplay(pathInput, resolvedPath);
                this.app.state.lastProjectPath = resolvedPath;
                this.app.state.pathInputDraft = '';
                this.syncAnalyzeModeUi(el);
                void this.refreshReportForActivePath(el);
                showToast(`Folder "${folderName}" selected — path set to ${resolvedPath}. Press Enter or click Run Scan to start.`, 'info');
            }
            return true;
        }
        catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Directory picker failed:', err);
            }
            return false;
        }
    }
    /**
     * Resolve a dropped/browsed folder's absolute path from the first File object.
     * Works in Electron and Chromium-derived environments where file.path is exposed.
     * Falls back to defaultProjectPath + folder name if no OS path is available.
     */
    resolveFolderPathFromFiles(files, folderName) {
        if (!files || !files.length)
            return null;
        const firstFile = files[0];
        const relPath = firstFile.webkitRelativePath || '';
        const filePath = firstFile.path;
        const fName = folderName || firstFile.name || '';
        if (filePath && relPath) {
            const normalizedFull = filePath.replace(/\\/g, '/');
            const normalizedRel = relPath.replace(/\\/g, '/');
            if (normalizedFull.endsWith(normalizedRel)) {
                const baseDir = normalizedFull.slice(0, -normalizedRel.length).replace(/\/$/, '');
                const relFolderName = normalizedRel.split('/')[0] || fName;
                let resolvedPath = baseDir ? `${baseDir}/${relFolderName}` : relFolderName;
                if (!resolvedPath.match(/^[a-zA-Z]:/) && !resolvedPath.startsWith('/')) {
                    const fallbackBase = String(this._deriveFallbackBase()).replace(/\\/g, '/').replace(/\/+$/, '');
                    resolvedPath = `${fallbackBase}/${relFolderName}`;
                }
                return resolvedPath;
            }
        }
        if (filePath) {
            const norm = filePath.replace(/\\/g, '/');
            if (fName && (norm.endsWith(`/${fName}`) || norm === fName)) {
                return filePath;
            }
            const lastSlash = norm.lastIndexOf('/');
            if (lastSlash > 0) {
                const winSep = filePath.lastIndexOf('\\');
                return filePath.slice(0, winSep > 0 ? winSep : lastSlash);
            }
            return filePath;
        }
        return null;
    }
    /**
     * Build a best-guess folder path when the browser cannot reveal the absolute OS path.
     * Prefers a recently-used path that ends with the same folder name, then the current
     * path-input value as the base (so a typed J:\StarCraft is not overwritten by a stale
     * C:/Users preference), then a base that matches the client's OS.
     */
    resolveFallbackFolderPath(folderName) {
        const fName = folderName.replace(/\\/g, '/');
        const isWindowsClient = /Windows/i.test(navigator.userAgent);
        const isLinuxPath = (p) => /^\//.test(p) && !/^[a-zA-Z]:/.test(p);
        // 1. Prefer a recently-used path that ends with the same folder name.
        const recent = loadRecentPaths();
        for (const p of recent) {
            const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
            if (isWindowsClient && isLinuxPath(norm))
                continue;
            if (norm.endsWith(`/${fName}`) || norm === fName) {
                return p;
            }
        }
        // 2. If the last/default project path already ends with this folder name, use it verbatim
        // — but only if it matches the client OS (never use a Linux server path on Windows).
        const knownPaths = [this.app.state.lastProjectPath, this.app.state.defaultProjectPath].filter(Boolean);
        for (const known of knownPaths) {
            const norm = String(known).replace(/\\/g, '/').replace(/\/+$/, '');
            if (isWindowsClient && isLinuxPath(norm))
                continue;
            if (norm.endsWith(`/${fName}`) || norm === fName) {
                return norm;
            }
        }
        // 3. Determine a base directory that matches the client OS.
        const pathInput = this._root?.querySelector('#project-path-input');
        const currentInput = String(pathInput?.value || '').trim();
        const normalizedCurrent = currentInput.replace(/\\/g, '/').replace(/\/+$/, '');
        const isAbsCurrent = /^[a-zA-Z]:\//.test(normalizedCurrent) || /^\//.test(normalizedCurrent);
        if (isAbsCurrent) {
            // On Windows, never append a dropped folder to a Linux server path.
            if (isWindowsClient && isLinuxPath(normalizedCurrent)) {
                // fall through to candidates/bare folder name
            }
            else if (normalizedCurrent.endsWith(`/${fName}`) || normalizedCurrent === fName) {
                return currentInput;
            }
            else {
                return `${normalizedCurrent}/${folderName}`;
            }
        }
        const currentBase = currentInput
            ? currentInput.replace(/\\/g, '/').replace(/\/+$/, '').split('/').slice(0, -1).join('/')
            : '';
        const rawDefault = String(this.app.state.defaultProjectPath || '')
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');
        const fallbackBase = String(this._deriveFallbackBase())
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');
        const preferredBase = String(this.loadPreferredProjectBase() || '')
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');
        const candidates = [currentBase, preferredBase, rawDefault, fallbackBase].filter(Boolean);
        // On Windows, only accept a Windows-style base. Avoid fabricating a C:/Users path
        // when the actual folder may be on a different drive or directory.
        const base = isWindowsClient
            ? (candidates.find((p) => !isLinuxPath(p)) || '')
            : (candidates[0] || fallbackBase);
        return base ? `${base}/${folderName}` : folderName;
    }
    savePreferredProjectBase(path) {
        const norm = String(path || '').replace(/\\/g, '/').replace(/\/+$/, '');
        const lastSlash = norm.lastIndexOf('/');
        const base = lastSlash > 0 ? norm.slice(0, lastSlash) : norm;
        if (base && base.length > 2) {
            try {
                localStorage.setItem(PREFERRED_PROJECT_BASE_KEY, base);
            }
            catch { /* ignore quota / privacy errors */ }
        }
    }
    loadPreferredProjectBase() {
        try {
            return localStorage.getItem(PREFERRED_PROJECT_BASE_KEY) || '';
        }
        catch {
            return '';
        }
    }
    bindFileDropEvents(el) {
        var _a, _b;
        const dropzone = el.querySelector('#analyze-file-dropzone');
        const fileInput = el.querySelector('#analyze-file-input');
        // Both "Browse File" (in #path-dropzone-visual) and "Choose File" (in #analyze-file-dropzone)
        // trigger the hidden file input. Use event delegation so re-renders do not unbind.
        // Bind these even when the file dropzone isn't rendered, because the button can appear
        // in the path dropzone as well.
        el.addEventListener('click', (event) => {
            const browseBtn = event.target.closest('#analyze-file-browse-btn-main, #analyze-file-browse-btn-dropzone');
            if (!browseBtn)
                return;
            let input = el.querySelector('#analyze-file-input');
            if (!input) {
                // Fallback: create a hidden input if the dropzone wasn't rendered
                input = document.createElement('input');
                input.type = 'file';
                input.id = 'analyze-file-input-fallback';
                input.accept = SNIPPET_ACCEPT;
                input.hidden = true;
                el.appendChild(input);
                // Bind the change listener to the fallback input
                input.addEventListener('change', () => {
                    const files = input.files;
                    if (files === null || files === void 0 ? void 0 : files.length) {
                        void this.handleAnalyzeFiles(files);
                        input.value = '';
                    }
                });
            }
            // Ensure the input is treated as a file picker, not a folder picker
            input.removeAttribute('webkitdirectory');
            input.removeAttribute('directory');
            input.click();
        });
        fileInput === null || fileInput === void 0 ? void 0 : fileInput.addEventListener('change', () => {
            const files = fileInput.files;
            if (files === null || files === void 0 ? void 0 : files.length) {
                void this.handleAnalyzeFiles(files);
                fileInput.value = '';
            }
        });
        if (!dropzone)
            return;
        (_a = dropzone.querySelector('#analyze-file-clear-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
            this.snippetResult = null;
            this.refresh();
        });
        (_b = dropzone.querySelector('#analyze-snippet-understand-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            void this.runSnippetUnderstanding();
        });
        // Robust dragleave with depth counter to prevent flicker over child elements
        let fileDragDepth = 0;
        ['dragenter', 'dragover'].forEach((eventName) => {
            dropzone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (eventName === 'dragenter')
                    fileDragDepth++;
                dropzone.classList.add('drag-active');
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = 'copy';
            });
        });
        dropzone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            event.stopPropagation();
            fileDragDepth--;
            if (fileDragDepth <= 0) {
                dropzone.classList.remove('drag-active');
                fileDragDepth = 0;
            }
        });
        dropzone.addEventListener('drop', async (event) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            event.preventDefault();
            event.stopPropagation();
            fileDragDepth = 0;
            dropzone.classList.remove('drag-active');
            const items = (_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.items;
            const files = (_b = event.dataTransfer) === null || _b === void 0 ? void 0 : _b.files;
            // Handle folder drops on file dropzone -> route to path dropzone logic
            if ((items === null || items === void 0 ? void 0 : items.length) && items[0].kind === 'file') {
                try {
                    const handle = await ((_d = (_c = items[0]).getAsFileSystemHandle) === null || _d === void 0 ? void 0 : _d.call(_c));
                    if (handle && handle.kind === 'directory') {
                        showToast('Directory drop detected. Use Browse Folder or type the full path for best results.', 'warning');
                        return;
                    }
                }
                catch (_l) {
                    // getAsFileSystemHandle not supported — fall through to legacy logic
                }
                const entry = (_f = (_e = items[0]).webkitGetAsEntry) === null || _f === void 0 ? void 0 : _f.call(_e);
                if (entry === null || entry === void 0 ? void 0 : entry.isDirectory) {
                    const pathInput = el.querySelector('#project-path-input');
                    const name = entry.name || '';
                    // Try to extract the real absolute path from OS dataTransfer (same logic as path dropzone)
                    const dt = event.dataTransfer;
                    const tryGetData = (type) => { try {
                        return dt.getData(type) || '';
                    }
                    catch (_a) {
                        return '';
                    } };
                    let actualPath = '';
                    const uriList = tryGetData('text/uri-list');
                    if (uriList) {
                        const uri = (_g = uriList.trim().split('\n')[0]) === null || _g === void 0 ? void 0 : _g.trim();
                        if (uri && uri.startsWith('file:///')) {
                            let p = uri.slice(8).replace(/\/$/, '');
                            try {
                                p = decodeURIComponent(p);
                            }
                            catch ( /* ignore */_m) { /* ignore */ }
                            actualPath = p.replace(/\//g, '\\');
                        }
                    }
                    if (!actualPath) {
                        const plain = tryGetData('text/plain');
                        if (plain) {
                            let trimmed = (_h = plain.trim().split('\n')[0]) === null || _h === void 0 ? void 0 : _h.trim().replace(/^["']|["']$/g, '');
                            if (trimmed && /^[a-zA-Z]:[\\\/]/.test(trimmed)) {
                                actualPath = trimmed.replace(/[\\\/]+$/, '');
                            }
                        }
                    }
                    if (!actualPath) {
                        const mozUrl = tryGetData('text/x-moz-url');
                        if (mozUrl) {
                            const url = (_j = mozUrl.trim().split('\n')[0]) === null || _j === void 0 ? void 0 : _j.trim();
                            if (url && url.startsWith('file:///')) {
                                let p = url.slice(8).replace(/\/$/, '');
                                try {
                                    p = decodeURIComponent(p);
                                }
                                catch ( /* ignore */_o) { /* ignore */ }
                                actualPath = p.replace(/\//g, '\\');
                            }
                        }
                    }
                    if (!actualPath && ((_k = files === null || files === void 0 ? void 0 : files[0]) === null || _k === void 0 ? void 0 : _k.path)) {
                        const filePath = String(files[0].path);
                        const norm = filePath.replace(/\\/g, '/');
                        // Use entry.name (actual folder name) to find correct boundary, not first file name
                        if (name) {
                            const idx = norm.indexOf(`/${name}/`);
                            if (idx >= 0) {
                                actualPath = norm.slice(0, idx + name.length + 1);
                            }
                            else {
                                const endIdx = norm.lastIndexOf(`/${name}`);
                                if (endIdx >= 0) {
                                    actualPath = norm.slice(0, endIdx + name.length + 1);
                                }
                            }
                        }
                        if (!actualPath) {
                            // Last resort: parent of first file (likely a subfolder — will show for review)
                            const lastSlash = norm.lastIndexOf('/');
                            actualPath = lastSlash > 0 ? filePath.slice(0, filePath.lastIndexOf('\\') > 0 ? filePath.lastIndexOf('\\') : lastSlash) : filePath;
                        }
                    }
                    // Fallback to defaultProjectPath / current input / fallback base if no OS path
                    const resolvedPath = actualPath || this.resolveFallbackFolderPath(name);
                    if (pathInput) {
                        pathInput.value = resolvedPath;
                        this.app.state.pathInputDraft = '';
                        this.app.state.lastProjectPath = resolvedPath;
                        this.setPathInputDisplay(pathInput, resolvedPath);
                        this.syncAnalyzeModeUi(el);
                        void this.refreshReportForActivePath(el);
                    }
                    showToast(`Folder "${name}" dropped — path set to ${resolvedPath}. Press Enter or click Analyze to start.`, 'info');
                    return;
                }
            }
            if (files === null || files === void 0 ? void 0 : files.length) {
                void this.handleAnalyzeFiles(files);
            }
            else {
                showToast('No file detected. Try dropping a source file or JSON report.', 'warning');
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
        }
        catch (err) {
            const m = err.message.match(/position (\d+)/);
            if (m) {
                const pos = parseInt(m[1], 10);
                let line = 1, col = 1;
                for (let i = 0; i < pos && i < text.length; i++) {
                    if (text[i] === '\n') {
                        line++;
                        col = 0;
                    }
                    col++;
                }
                console.error(`JSON parse error at line ${line}, col ${col}: ${err.message}`);
            }
            else {
                console.error('JSON parse error:', err.message);
            }
            return null;
        }
    }
    computeReportFingerprint(parsed) {
        const payload = {
            type: parsed.type || '',
            projectPath: parsed.projectPath || parsed.projectRoot || '',
            generatedAt: parsed.generatedAt || parsed.exportedAt || parsed.scannedAt || '',
            issueCount: Array.isArray(parsed.detectedIssues) ? parsed.detectedIssues.length
                : Array.isArray(parsed.rawIssues) ? parsed.rawIssues.length
                    : Array.isArray(parsed.issues) ? parsed.issues.length : 0,
            checksumSample: JSON.stringify(parsed).slice(0, 200)
        };
        let hash = 0;
        const str = JSON.stringify(payload);
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return String(hash);
    }
    isDuplicateReport(parsed) {
        const fp = this.computeReportFingerprint(parsed);
        const seen = JSON.parse(localStorage.getItem('sb-analyze-imported-fingerprints') || '[]');
        if (seen.includes(fp))
            return true;
        seen.push(fp);
        while (seen.length > 50)
            seen.shift();
        localStorage.setItem('sb-analyze-imported-fingerprints', JSON.stringify(seen));
        return false;
    }
    validateReportIntegrity(parsed, fileName) {
        var _a, _b;
        const issues = [];
        /**
         * Warn.
         * @param {number} msg
         * @returns {any}
         */
        const warn = (msg) => issues.push({ level: 'warn', msg });
        /**
         * Err.
         * @param {number} msg
         * @returns {any}
         */
        const err = (msg) => issues.push({ level: 'error', msg });
        if (!parsed || typeof parsed !== 'object') {
            err('Top-level value is not an object');
            return issues;
        }
        const type = parsed.type || '';
        const sev = parsed.severityCounts || {};
        const detected = parsed.detectedIssues || parsed.rawIssues || [];
        if (isSimplebeaconReport(parsed) || type === 'simplebeacon-complete-scan') {
            if (!parsed.projectRoot && !parsed.projectPath) {
                warn('Missing projectRoot / projectPath');
            }
            if (typeof sev !== 'object') {
                warn('severityCounts is not an object');
            }
            else {
                const counted = (sev.critical || 0) + (sev.high || 0) + (sev.medium || 0) + (sev.low || 0) + (sev.info || 0);
                if (Array.isArray(detected) && counted !== detected.length) {
                    warn(`severityCounts sum (${counted}) != issues.length (${detected.length})`);
                }
            }
            if (Array.isArray(detected)) {
                const bad = detected.filter(i => !i.severity || !i.type).length;
                if (bad > 0)
                    warn(`${bad}/${detected.length} issues missing severity or type`);
            }
        }
        if (type === 'simplebeacon-complete-scan' && parsed.results) {
            const r = parsed.results;
            if (r.roadmap && Array.isArray(r.roadmap.phases)) {
                const computedTasks = r.roadmap.phases.reduce((s, p) => s + (p.tasks || []).length, 0);
                const declared = (_b = (_a = r.roadmap.summary) === null || _a === void 0 ? void 0 : _a.tasks) === null || _b === void 0 ? void 0 : _b.total;
                if (declared !== undefined && declared !== computedTasks) {
                    warn(`Roadmap summary.tasks.total (${declared}) != computed (${computedTasks})`);
                }
            }
            if (r.consolidation && r.consolidation.summary) {
                const g = r.consolidation.groups || [];
                const sg = r.consolidation.summary.fileGroups || 0;
                if (g.length !== sg)
                    warn(`Consolidation groups.length (${g.length}) != summary.fileGroups (${sg})`);
            }
        }
        if (type === 'file-merger-reduction-report') {
            if (!parsed.summary)
                err('Missing summary');
            else {
                const g = parsed.groups || [];
                const sg = parsed.summary.fileGroups || 0;
                if (g.length !== sg)
                    warn(`groups.length (${g.length}) != summary.fileGroups (${sg})`);
            }
        }
        if (type === 'data-cleanup-report') {
            if (!parsed.scanProfile)
                warn('Missing scanProfile');
        }
        return issues;
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
    async importJsonReport(parsed, fileName, meta = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        // Validate structural integrity before import
        const integrity = this.validateReportIntegrity(parsed, fileName);
        const errors = integrity.filter(i => i.level === 'error');
        const warnings = integrity.filter(i => i.level === 'warn');
        if (errors.length > 0) {
            showToast(`Import blocked: ${errors[0].msg}`, 'error');
            return true; // handled (rejected)
        }
        if (warnings.length > 0) {
            console.warn(`[AnalyzeView] Import warnings for ${fileName}:`, warnings.map(w => w.msg));
        }
        // Duplicate detection
        if (this.isDuplicateReport(parsed)) {
            showToast(`${fileName} appears to be a duplicate import — skipped`, 'info');
            return true;
        }
        if (parsed.type === 'simplebeacon-complete-scan' && parsed.results) {
            this.importCompleteScanExport(parsed, fileName);
            if (warnings.length)
                showToast(`Imported with ${warnings.length} warning(s) — see console`, 'info');
            return true;
        }
        if (isSimplebeaconReport(parsed)) {
            const reportProjectPath = parsed.projectRoot || parsed.projectPath || parsed.platformRoot || '';
            try {
                const imported = await this.app.scanService.importReport(parsed, reportProjectPath || undefined);
                const loadedReport = imported.report || parsed;
                const resolvedProjectPath = imported.response?.projectPath || reportProjectPath;
                if (resolvedProjectPath) {
                    this.app.state.lastProjectPath = resolvedProjectPath;
                    this.app.state.pathInputDraft = '';
                }
                this.applyReport(loadedReport, `Imported scan: ${fileName}`, { conclusion: buildScanConclusion(loadedReport) });
            }
            catch (err) {
                console.warn('[AnalyzeView] Server report import failed; applying locally:', err);
                this.applyReport(parsed, `Imported scan: ${fileName}`, { conclusion: buildScanConclusion(parsed) });
                showToast(`Saved locally — server import failed: ${err.message}`, 'warning');
            }
            if (warnings.length)
                showToast(`Imported with ${warnings.length} warning(s) — see console`, 'info');
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
            const typeSelect = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#analysis-type-select');
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
                bytes: (_b = meta.bytes) !== null && _b !== void 0 ? _b : 0,
                text: '',
                findings: [],
                threatScore: 0,
                cacheMeta: { fileCount, lastScan: parsed.lastScan || null }
            };
            showToast(`Scanner cache index (${fileCount} path(s)) — not a production source file`, 'info');
            this.refresh();
            return true;
        }
        if (isCleanupExportJson(parsed)) {
            const unusedCount = (_l = (_g = (_e = (_d = (_c = parsed.brief) === null || _c === void 0 ? void 0 : _c.unusedFiles) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : (_f = parsed.unusedFiles) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : (_k = (_j = (_h = parsed.brief) === null || _h === void 0 ? void 0 : _h.tiers) === null || _j === void 0 ? void 0 : _j.reviewFirst) === null || _k === void 0 ? void 0 : _k.files) !== null && _l !== void 0 ? _l : 0;
            this.snippetResult = {
                fileName,
                bytes: (_m = meta.bytes) !== null && _m !== void 0 ? _m : 0,
                text: '',
                findings: [],
                threatScore: 0,
                cacheMeta: { cleanupExport: true, phase: parsed.phase || null, unusedCount }
            };
            showToast(`Cleanup export inventory (${unusedCount || 'path'} listing) — not a production source file`, 'info');
            this.refresh();
            return true;
        }
        if (parsed.type === 'dynamic-project-roadmap-analysis' || ((_o = parsed.codeAnalysis) === null || _o === void 0 ? void 0 : _o.structure)) {
            const metrics = extractRoadmapFileMetrics(parsed);
            const scanTarget = parsed.scanTargetRoot
                || parsed.projectRoot
                || String(((_q = (_p = parsed.directoryStructure) === null || _p === void 0 ? void 0 : _p.server) === null || _q === void 0 ? void 0 : _q.path) || '').replace(/[/\\]server$/i, '')
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
            const typeSelect = (_r = this._root) === null || _r === void 0 ? void 0 : _r.querySelector('#analysis-type-select');
            this.setAnalysisType('roadmap', { typeSelect });
            showToast(`Imported roadmap analysis from ${fileName}`, 'success');
            this.refresh();
            return true;
        }
        if (isFictionDigestJson(parsed)) {
            const digest = sanitizeFictionDigestExport(parsed);
            const report = digest.sourceReport;
            /**
             * Fiction count.
             * @param {any} digest.fictionIssues || []
             * @returns {any}
             */
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
            if (this.app.scanService)
                this.app.scanService.report = report;
            showToast(`Imported fiction digest (${fictionCount} KPI hit(s), trust: ${digest.digestTrust || 'unknown'})`, fictionCount ? 'info' : 'success');
            this.refresh();
            return true;
        }
        return false;
    }
    async uploadFolderFiles(fileList, folderName) {
        var _a, _b;
        if (!fileList || fileList.length === 0) {
            showToast('No files to upload', 'warning');
            return;
        }
        const totalBytes = Array.from(fileList).reduce((sum, f) => sum + (f.size || 0), 0);
        if (totalBytes > MAX_UPLOAD_BYTES) {
            const sizeMb = Math.round(totalBytes / (1024 * 1024));
            showToast(`Directory is too large to upload (${sizeMb} MB). Use Chrome/Edge local scan, type the server path, or install the local agent.`, 'error');
            return;
        }
        this.busy = true;
        this._terminalLogLines.push(`Uploading ${fileList.length} files from "${folderName || 'folder'}"…`);
        this.refresh();
        try {
            const data = await uploadDirectoryAndAnalyze(fileList, {
                analysisType: this.analysisType || 'simplebeacon',
                timeoutMs: 600000
            });
            const report = ((_a = data.results) === null || _a === void 0 ? void 0 : _a.simplebeacon) || data.simplebeacon || data;
            const projectPath = (report === null || report === void 0 ? void 0 : report.projectPath) || (report === null || report === void 0 ? void 0 : report.projectRoot) || `upload://${folderName || 'folder'}`;
            const pathInput = (_b = this._root) === null || _b === void 0 ? void 0 : _b.querySelector('#project-path-input');
            if (pathInput) {
                this.setPathInputDisplay(pathInput, projectPath);
                this.app.state.lastProjectPath = projectPath;
                this.app.state.pathInputDraft = '';
            }
            this.lastResult = {
                projectPath,
                report,
                analysisType: this.analysisType || 'simplebeacon',
                generatedAt: (report === null || report === void 0 ? void 0 : report.generatedAt) || new Date().toISOString()
            };
            this.lastScanId = (report === null || report === void 0 ? void 0 : report.scanId) || (report === null || report === void 0 ? void 0 : report.id) || Date.now().toString();
            showToast(`Uploaded "${folderName || 'folder'}" and scanned ${(report === null || report === void 0 ? void 0 : report.ruleScopedFilesAnalyzed) || (report === null || report === void 0 ? void 0 : report.filesAnalyzed) || fileList.length} files`, 'success');
            this.refresh();
        }
        catch (error) {
            showToast(error.message || 'Folder upload scan failed', 'error');
        }
        finally {
            this.busy = false;
            this.refresh();
        }
    }
    /**
     * Try to extract an absolute OS path from a drop event's dataTransfer.
     * Browsers like Firefox/Safari expose file:/// URIs for dragged folders.
     * @param {DragEvent} event
     * @param {string} [folderName]
     * @returns {string}
     */
    extractAbsoluteDroppedPath(event, folderName) {
        var _a, _b;
        const dt = event.dataTransfer;
        if (!dt) return '';
        const tryGetData = (type) => {
            try { return dt.getData(type) || ''; } catch { return ''; }
        };
        const decodeFileUri = (uri) => {
            if (!uri || !uri.startsWith('file:///')) return '';
            let p = uri.slice(8).replace(/\/$/, '');
            try { p = decodeURIComponent(p); } catch { /* ignore */ }
            return p.replace(/\//g, '\\');
        };
        const uriList = tryGetData('text/uri-list');
        if (uriList) {
            const uri = uriList.trim().split('\n')[0]?.trim();
            const decoded = decodeFileUri(uri);
            if (decoded) return decoded;
        }
        const plain = tryGetData('text/plain');
        if (plain) {
            const trimmed = plain.trim().split('\n')[0]?.trim().replace(/^["']|["']$/g, '');
            if (trimmed && /^[a-zA-Z]:[\\\/]/.test(trimmed)) {
                return trimmed.replace(/[\\\/]+$/, '');
            }
        }
        const mozUrl = tryGetData('text/x-moz-url');
        if (mozUrl) {
            const url = mozUrl.trim().split('\n')[0]?.trim();
            const decoded = decodeFileUri(url);
            if (decoded) return decoded;
        }
        const files = dt.files;
        if (files?.[0]?.path) {
            const filePath = String(files[0].path).replace(/\\/g, '/');
            if (folderName) {
                const idx = filePath.indexOf(`/${folderName}/`);
                if (idx >= 0) return filePath.slice(0, idx + folderName.length + 1).replace(/\//g, '\\');
                const endIdx = filePath.lastIndexOf(`/${folderName}`);
                if (endIdx >= 0) return filePath.slice(0, endIdx + folderName.length + 1).replace(/\//g, '\\');
            }
            const lastSlash = filePath.lastIndexOf('/');
            return lastSlash > 0 ? filePath.slice(0, lastSlash).replace(/\//g, '\\') : '';
        }
        return '';
    }
    /**
     * Handle a dropped folder when the browser cannot directly reveal the full path.
     * Prefer routing to the local agent if an absolute path can be recovered;
     * otherwise show guidance instead of leaking the folder to the server.
     * @param {FileList} files
     * @param {string} folderName
     * @param {DragEvent} event
     * @param {FileSystemDirectoryHandle|FileSystemDirectoryEntry} [directoryHandle]
     * @param {(text:string)=>void} [updateFingerprintStatus]
     */
    async handleDroppedFolderFallback(files, folderName, event, directoryHandle = null, updateFingerprintStatus = null) {
        var _a, _b;
        const absolutePath = this.extractAbsoluteDroppedPath(event, folderName);
        if (absolutePath) {
            const pathInput = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
            if (pathInput) {
                pathInput.value = absolutePath;
                this.app.state.pathInputDraft = '';
                this.app.state.lastProjectPath = absolutePath;
                this.setPathInputDisplay(pathInput, absolutePath);
                this.syncAnalyzeModeUi(this._root);
            }
            void this.runPathAnalysis(absolutePath);
            return;
        }
        // No absolute path available. Browsers hide the full OS path for security,
        // so we cannot safely guess it. Prefer the typed path as the base if the user
        // already supplied one, otherwise leave the bare folder name as a label.
        const pathInput = (_b = this._root) === null || _b === void 0 ? void 0 : _b.querySelector('#project-path-input');
        const rawFallback = this.resolveFallbackFolderPath(folderName) || folderName;
        const isWindowsClient = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
        const isLinuxPath = (p) => /^\//.test(p) && !/^[a-zA-Z]:/.test(p);
        const fallbackPath = (isWindowsClient && isLinuxPath(rawFallback.replace(/\\/g, '/')))
            ? folderName
            : rawFallback;
        if (pathInput) {
            pathInput.value = fallbackPath;
            this.app.state.pathInputDraft = '';
            this.app.state.lastProjectPath = fallbackPath;
            this.setPathInputDisplay(pathInput, fallbackPath);
            this.syncAnalyzeModeUi(this._root);
        }
        if (directoryHandle && directoryHandle.kind === 'directory') {
            showToast('Scanning dropped folder locally — no upload…', 'info');
            await this.runLocalScan(directoryHandle, null, fallbackPath);
            return;
        }
        if (directoryHandle && directoryHandle.isDirectory) {
            // Legacy webkit entry: scan locally without uploading.
            showToast('Scanning dropped folder locally — no upload…', 'info');
            await this.runLocalScan(null, files, fallbackPath);
            return;
        }
        if (files?.length) {
            showToast('Scanning dropped folder locally — no upload…', 'info');
            await this.runLocalScan(null, files, fallbackPath);
            return;
        }
        if (window.showDirectoryPicker) {
            showToast(`Dropped folder "${folderName}" — browser cannot reveal its full path. Select it in the folder picker to scan locally.`, 'info');
            await this.runLocalScan(null, null, fallbackPath);
            return;
        }
        showToast(`Dropped folder "${folderName}" — browser cannot reveal its full path. Type the full path (e.g., C:/path/to/${folderName}) to scan with the Local Agent.`, 'warning');
    }
    async handleAnalyzeFiles(fileList) {
        const file = fileList[0];
        if (!file)
            return;
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
                if (!parsed) {
                    showToast(`Could not parse ${file.name} as JSON — see browser console for line/col details`, 'error');
                    this.snippetBusy = false;
                    this.refresh();
                    return;
                }
                if (await this.importJsonReport(parsed, file.name, { bytes: file.size })) {
                    this.snippetBusy = false;
                    return;
                }
                showToast(`${file.name} parsed as JSON but report type was not recognized`, 'info');
                this.snippetBusy = false;
                this.refresh();
                return;
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
            showToast(isDocumentation && rawFindings.length !== findings.length
                ? `${file.name} — documentation; mock-path rule tokens skipped`
                : `Scanned ${file.name} locally (${findings.length} hit(s))`, findings.length ? 'info' : 'success');
        }
        catch (error) {
            showToast(error.message || 'File read failed', 'error');
        }
        finally {
            this.snippetBusy = false;
            this.refresh();
        }
    }
    async runSnippetUnderstanding() {
        var _a, _b, _c;
        if ((_a = this.snippetResult) === null || _a === void 0 ? void 0 : _a.cacheMeta) {
            showToast('Scanner cache or export inventory — server understanding applies to source files only', 'info');
            return;
        }
        if (!((_b = this.snippetResult) === null || _b === void 0 ? void 0 : _b.text)) {
            showToast('Drop a source file first', 'error');
            return;
        }
        this.snippetBusy = true;
        this.refresh();
        try {
            await ensureDashboardApiReady();
            const projectPath = this.resolveProjectPath((_c = document.getElementById('project-path-input')) === null || _c === void 0 ? void 0 : _c.value) || undefined;
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
        }
        catch (error) {
            this.snippetResult = {
                ...this.snippetResult,
                understandingSkipped: error.message || 'Server understanding failed'
            };
            showToast(error.message || 'Server understanding failed', 'error');
        }
        finally {
            this.snippetBusy = false;
            this.refresh();
        }
    }
    async loadProviders(select, options = {}) {
        try {
            const data = await fetchAnalyzeProviders(options);
            if (!data.providers)
                return;
            this.providers = data.providers;
            if (!select)
                return;
            const order = ['demo', 'ollama', 'openai', 'anthropic', 'active'];
            const sorted = [...data.providers].sort((a, b) => (order.indexOf(a.id) === -1 ? 99 : order.indexOf(a.id))
                - (order.indexOf(b.id) === -1 ? 99 : order.indexOf(b.id)));
            select.innerHTML = sorted.map((p) => {
                const configured = isAnalyzeProviderConfigured(p);
                const suffix = configured ? '' : ' (not configured)';
                const title = [p.description, p.statusMessage].filter(Boolean).join(' · ');
                const disabled = configured ? '' : 'disabled';
                return `<option value="${escapeHtml(p.id)}" ${disabled} title="${escapeHtml(title)}">${escapeHtml(p.label || p.id)}${suffix}</option>`;
            }).join('');
            const preferred = this.aiProvider;
            const preferredOk = data.providers.some((p) => p.id === preferred && isAnalyzeProviderConfigured(p));
            const ollama = data.providers.find((p) => p.id === 'ollama' && isAnalyzeProviderConfigured(p));
            const activeLlm = data.providers.find((p) => p.id === 'active' && isAnalyzeProviderConfigured(p));
            if (preferredOk) {
                select.value = preferred;
            }
            else {
                const fallback = data.providers.find((p) => p.id === 'demo' && isAnalyzeProviderConfigured(p))
                    || data.providers.find((p) => isAnalyzeProviderConfigured(p));
                if (fallback) {
                    this.aiProvider = fallback.id;
                    select.value = fallback.id;
                    saveAnalyzePrefs({ analysisType: this.analysisType, aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
                }
            }
            this.syncAiProviderNote(this._root);
        }
        catch (err) {
            if (select) {
                select.innerHTML = `
          <option value="demo">Filesystem scan (no AI narrative)</option>
          <option value="ollama" disabled>Ollama — reload providers</option>
        `;
            }
            showToast((err === null || err === void 0 ? void 0 : err.message) || 'Could not load AI providers — restart dashboard (npm run dashboard:kill-ports && npm run dashboard:v1-internal)', 'error');
        }
    }
    async attachCodeInsights(scan, projectPath) {
        if (!scan || !projectPath)
            return scan;
        let enriched = { ...scan };
        if (shouldFetchZscriptReport(projectPath, scan)) {
            try {
                const zscriptReport = await fetchZscriptModReport(projectPath);
                enriched = { ...enriched, zscriptReport };
            }
            catch (error) {
                enriched = { ...enriched, zscriptReportError: error.message || String(error) };
            }
        }
        return enriched;
    }
    renderCodeInsightsPanels(scan) {
        if (!scan)
            return '';
        return [
            renderUnderstandingPanel(scan.codeUnderstanding),
            renderZscriptReportPanel(scan.zscriptReport, { error: scan.zscriptReportError })
        ].join('');
    }
    buildCodeInsightsConclusion(scan) {
        return [
            buildUnderstandingConclusion(scan === null || scan === void 0 ? void 0 : scan.codeUnderstanding),
            buildZscriptConclusion(scan === null || scan === void 0 ? void 0 : scan.zscriptReport)
        ].filter(Boolean).join(' ');
    }
    /**
     * Open a legacy webkitdirectory file picker and return the selected FileList.
     * Useful for browsers that do not support window.showDirectoryPicker.
     * @returns {Promise<FileList|null>}
     */
    promptLegacyDirectoryPicker() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.setAttribute('webkitdirectory', 'true');
            input.setAttribute('directory', 'true');
            input.style.display = 'none';
            let settled = false;
            function cleanup() {
                if (!settled) {
                    settled = true;
                    if (input.parentNode)
                        input.parentNode.removeChild(input);
                }
            }
            input.addEventListener('change', () => {
                resolve(input.files || null);
                cleanup();
            });
            input.addEventListener('cancel', () => {
                resolve(null);
                cleanup();
            });
            document.body.appendChild(input);
            input.click();
            setTimeout(cleanup, 300000);
        });
    }
    async runLocalScan(dirHandle = null, files = null, projectPath = '') {
        if (!files && !window.showDirectoryPicker && !dirHandle) {
            showToast('Local scan requires a browser that supports directory selection (Chrome/Edge).', 'error');
            return;
        }
        this.busy = true;
        this.scanStartedAt = Date.now();
        this._terminalLogLines = [];
        this.app.state.analyzeResult = null;
        this.app.state.report = null;
        this.refresh();
        if (!dirHandle && !files) {
            showToast('Select a local folder to scan privately…', 'info');
        }
        try {
            const service = new LocalScanService();
            const report = await service.runScan({
                dirHandle,
                files,
                projectPath: projectPath && projectPath.trim() ? projectPath.trim() : undefined,
                onProgress: (processed, total) => {
                    this.scanProgress = { processed, total, percent: Math.round((processed / Math.max(1, total)) * 100) };
                    this.refresh();
                }
            });
            const conclusion = buildScanConclusion(report);
            const resolvedPath = projectPath && projectPath.trim() ? projectPath.trim() : report.projectPath;
            this.repositoryInventory = report.inventory || null;
            this.lastResult = {
                kind: 'simplebeacon-report',
                report,
                projectPath: resolvedPath,
                repositoryInventory: report.inventory || null,
                label: `Local scan: ${resolvedPath}`,
                conclusion
            };
            this.applyReport(report, this.lastResult.label, { conclusion });
            this.app.state.analyzeResult = this.lastResult;
            this.app.state.report = report;
            this.app.scanService.report = report;
            showToast('Local scan complete — no data sent to server', 'success');
        }
        catch (err) {
            showToast(err.message || 'Local scan failed', 'error');
        }
        finally {
            this.busy = false;
            this.scanProgress = null;
            this.refresh();
        }
    }
    async runAgentScan(projectPath) {
        this.busy = true;
        this.scanStartedAt = Date.now();
        this._terminalLogLines = [];
        const startTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this._terminalLogLines.push(`<span class="terminal-time">[${startTime}]</span><span class="terminal-prompt">❯</span><span class="terminal-file">Initializing local agent scan…</span>`);
        this.refresh();
        try {
            const report = await scanViaAgent(projectPath);
            if (!report)
                throw new Error('Agent scan returned no report');
            const conclusion = buildScanConclusion(report);
            this.repositoryInventory = report.repositoryInventory || null;
            this.lastResult = {
                kind: 'simplebeacon-report',
                report,
                projectPath: report.projectPath || projectPath,
                repositoryInventory: report.repositoryInventory || null,
                label: `Agent scan: ${report.projectPath || projectPath}`,
                conclusion
            };
            this.applyReport(report, this.lastResult.label, { conclusion });
            this.app.state.analyzeResult = this.lastResult;
            this.app.state.report = report;
            this.app.scanService.report = report;
            showToast('Local agent scan complete', 'success');
        }
        catch (err) {
            showToast(err.message || 'Local agent scan failed', 'error');
        }
        finally {
            this.busy = false;
            this.scanProgress = null;
            this.refresh();
        }
    }
    async runAgent4000Scan(projectPath) {
        this.busy = true;
        this.scanStartedAt = Date.now();
        this.refresh();
        try {
            const result = await scanViaAgent4000(projectPath);
            const cert = result && result.certificate;
            const fileCount = (result.files || []).length;
            const message = cert
                ? `Localhost:4000 scan complete — Grade ${cert.letterGrade} | ${fileCount} files | Liability ${cert.liabilityStr}`
                : `Localhost:4000 scan complete — ${fileCount} files`;
            showToast(message, 'success');
            const statusEl = this._root && this._root.querySelector('#agent-4000-status');
            if (statusEl) {
                statusEl.textContent = message;
                statusEl.classList.remove('unavailable');
                statusEl.classList.add('available');
            }
            const resultsEl = this._root && this._root.querySelector('#agent-4000-results');
            renderAgentCertificate(result, resultsEl);
        }
        catch (err) {
            showToast(err.message || 'Localhost:4000 scan failed', 'error');
        }
        finally {
            this.busy = false;
            this.scanProgress = null;
            this.refresh();
        }
    }
    async runSandboxedDirectoryScan() {
        const terminal = this._root && this._root.querySelector('#sandbox-scan-terminal');
        const resultsEl = this._root && this._root.querySelector('#agent-4000-results');
        if (terminal) terminal.textContent = 'Opening native OS system access window...';
        try {
            const report = await runSandboxedDirectoryScan({
                onLog: (entry) => {
                    if (terminal) {
                        terminal.textContent += `\n[${entry.level.toUpperCase()}] ${entry.message}`;
                        terminal.scrollTop = terminal.scrollHeight;
                    }
                },
                onProgress: ({ processed, total }) => {
                    if (terminal) {
                        terminal.textContent += `\n...${processed}/${total} files analyzed`;
                        terminal.scrollTop = terminal.scrollHeight;
                    }
                }
            });
            const cert = report && report.certificate;
            const message = cert
                ? `Sandbox scan complete — Grade ${cert.letterGrade} | ${report.files.length} files | Liability ${cert.liabilityStr}`
                : `Sandbox scan complete — ${report.files.length} files`;
            showToast(message, 'success');
            renderAgentCertificate(report, resultsEl);
        }
        catch (err) {
            const msg = err.message || 'Sandbox scan failed';
            showToast(msg, 'error');
            if (terminal) terminal.textContent = `❌ ${msg}`;
        }
    }
    async runPathAnalysis(inputPath) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const typedPath = String(inputPath || '').trim();
        // Lightweight localhost:4000 bridge from the provided agent.js template.
        if (isLocalPath(typedPath)) {
            try {
                const status4000 = await probeAgent4000();
                if (status4000.available) {
                    await this.runAgent4000Scan(typedPath);
                    return;
                }
            }
            catch (_r) { /* fall through to existing agent/server flow */ }
        }
        const isRemoteDeployment = typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        const isLocalWindowsPath = /^[a-zA-Z]:[\\/]/i.test(typedPath);
        // Remote deployments can never access the user's local filesystem. Switch to the server's
        // default project path and server-scan mode instead of showing the Privacy mode error.
        if (isRemoteDeployment && isLocalWindowsPath) {
            // Re-probe the agent in case it was started after the page loaded.
            if (!shouldUseAgent(typedPath, this.agentStatus)) {
                try {
                    this.agentStatus = await probeAgent();
                }
                catch (_r) {
                    this.agentStatus = { available: false, scannerAvailable: false };
                }
                this.updateAgentStatusUI(this._root, formatAgentStatus(this.agentStatus), this.agentStatus.available && this.agentStatus.scannerAvailable);
            }
            if (shouldUseAgent(typedPath, this.agentStatus)) {
                await this.runAgentScan(typedPath);
                return;
            }
            const fallbackPath = this.app.state.defaultProjectPath || this.app.state.lastProjectPath || '';
            if (fallbackPath && !/^[a-zA-Z]:[\\/]/i.test(fallbackPath)) {
                showToast('Local agent is not available. Switching to the server project path.', 'info');
                this.localMode = false;
                saveAnalyzePrefs({ localMode: false, analysisType: this.analysisType, aiProvider: this.aiProvider, understandingMode: this.understandingMode });
                this.syncAnalyzeModeUi(this._root);
                return this.runPathAnalysis(fallbackPath);
            }
            showToast('Cannot scan a local path from the remote dashboard. Install/Start the Local Scan Agent or run SimpleBeacon locally.', 'error', { duration: 8000 });
            return;
        }
        if (this.localMode) {
            if (!window.showDirectoryPicker) {
                const typedPath = String(inputPath || '').trim();
                if (isLocalPath(typedPath) && shouldUseAgent(typedPath, this.agentStatus)) {
                    showToast('Privacy mode requires Chrome/Edge for directory picker. Falling back to local agent scan.', 'info');
                    await this.runAgentScan(typedPath);
                    return;
                }
                // Modern picker unavailable: Firefox cannot read a typed local path from a web page.
                // Explain the limitation instead of silently replacing the typed path with a guessed one.
                if (typedPath && isLocalPath(typedPath)) {
                    showToast('Firefox Privacy mode cannot read a typed local path. Use Browse Folder to select the folder, or turn off Privacy mode to use the Local Scan Agent.', 'error', { duration: 8000 });
                    return;
                }
                // No path entered yet: open the legacy folder picker so the user can choose.
                const browseInput = this._root?.querySelector('#browse-dir-input');
                if (browseInput) {
                    showToast('Opening folder picker for privacy mode…', 'info');
                    browseInput.value = '';
                    browseInput.click();
                    return;
                }
                showToast('Privacy mode requires a browser that supports directory selection (Chrome/Edge).', 'error');
                return;
            }
            await this.runLocalScan(null, null, inputPath);
            return;
        }
        let projectPath = String(inputPath || '').trim();
        const isLocal = isLocalPath(projectPath);
        if (isLocal) {
            // Re-probe in case the agent was started after the page loaded.
            try {
                this.agentStatus = await probeAgent();
            }
            catch (_q) {
                this.agentStatus = { available: false, scannerAvailable: false };
            }
            this.updateAgentStatusUI(this._root, formatAgentStatus(this.agentStatus), ((_a = this.agentStatus) === null || _a === void 0 ? void 0 : _a.available) && ((_b = this.agentStatus) === null || _b === void 0 ? void 0 : _b.scannerAvailable));
            if (shouldUseAgent(projectPath, this.agentStatus)) {
                await this.runAgentScan(projectPath);
                return;
            }
            showToast(getAgentFallbackMessage(this.agentStatus), 'error');
            return;
        }
        if (shouldUseAgent(projectPath, this.agentStatus)) {
            await this.runAgentScan(projectPath);
            return;
        }
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
            }
            catch (err) {
                this.busy = false;
                this.refresh();
                showToast(err.message || 'GitHub clone failed', 'error');
                return;
            }
        }
        this.stopEuAiActAutoRefresh();
        this.repositoryInventory = null;
        this.lastResult = null;
        this.app.state.analyzeResult = null;
        this.app.state.report = null;
        this.busy = true;
        this.scanStartedAt = Date.now();
        this._terminalLogLines = [];
        const startTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this._terminalLogLines.push(`<span class="terminal-time">[${startTime}]</span><span class="terminal-prompt">❯</span><span class="terminal-file">Initializing scan…</span>`);
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
        // Refresh to a long-lived 4-hour token for server-side scans so the session
        // does not expire mid-flight during long-running complete analyses.
        if (!this.localMode && !isLocalPath(projectPath) && !isRemoteRepoUrl(projectPath)) {
            try {
                await authService.refreshToken(true);
            }
            catch (refreshErr) {
                console.warn('Token refresh before scan failed:', refreshErr);
            }
        }
        try {
            await ensureDashboardApiReady();
        }
        catch (err) {
            this.stopProgressPolling();
            this.busy = false;
            this.refresh();
            showToast(err.message, 'error');
            return;
        }
        // VS Code Extension enhancement: when AI Slop Cop is present, enable enhanced analysis
        if (this.vscodeEnhanced) {
            this.fullDirectoryScan = true;
            if (!this.understandingMode) {
                this.understandingMode = 'detailed';
            }
            const vscode = this._getVscodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({ command: 'toggleRealtimeMonitoring', enabled: true });
                }
                catch ( /* ignore */_r) { /* ignore */ }
            }
            showToast('VS Code AI Slop Cop enabled — enhanced analysis active', 'success');
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
                    fictionIssues: (digest === null || digest === void 0 ? void 0 : digest.fictionIssues) || [],
                    nonFictionIssues: (digest === null || digest === void 0 ? void 0 : digest.nonFictionIssues) || [],
                    label: `Mock & fiction KPIs: ${formatPathLabel(projectPath)}`,
                    conclusion: (digest === null || digest === void 0 ? void 0 : digest.conclusion) || null
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
                scan = await this.attachOptionalAiSummary(scan, projectPath, scan === null || scan === void 0 ? void 0 : scan.type);
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
                    includeAllFiles: true,
                    understandingMode: this.understandingMode,
                    timeoutMs: 900000
                });
                scan = await this.attachCodeInsights(scan, projectPath);
                scan = await this.attachOptionalAiSummary(scan, projectPath, scan === null || scan === void 0 ? void 0 : scan.type);
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
                    || ((_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.repositoryInventory)
                    || (fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.inventory)
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
                    conclusion: (checklist === null || checklist === void 0 ? void 0 : checklist.summary)
                        ? `${(_d = checklist.summary.passed) !== null && _d !== void 0 ? _d : 0}/${checklistRuleTotal(checklist)} rules passed${checklist.summary.failed ? ` — ${checklist.summary.failed} failed` : ''}.`
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
                    conclusion: (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.summary)
                        ? `${(_f = (_e = npmAudit.summary.total) !== null && _e !== void 0 ? _e : npmAudit.vulnerabilityTotal) !== null && _f !== void 0 ? _f : 0} vulnerabilities across ${(_j = (_g = npmAudit.summary.dependencies) !== null && _g !== void 0 ? _g : (_h = npmAudit.dependencies) === null || _h === void 0 ? void 0 : _h.total) !== null && _j !== void 0 ? _j : '—'} dependencies.`
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
                        ((_k = sprint.gate) === null || _k === void 0 ? void 0 : _k.pass) ? 'Gate PASS' : 'Gate FAIL',
                        `${(_l = sprint.euPatternHits) !== null && _l !== void 0 ? _l : 0} EU pattern hits`,
                        `${(_m = checklist.passed) !== null && _m !== void 0 ? _m : 0}/${(_o = checklist.total) !== null && _o !== void 0 ? _o : 0} checklist rules passed`
                    ].join(' · ')
                };
                this.app.state.analyzeResult = this.lastResult;
                this._lastEuAiActScanAt = Date.now();
                this.startEuAiActAutoRefresh();
                this.refresh();
                showToast('EU AI Act sprint complete', ((_p = sprint.gate) === null || _p === void 0 ? void 0 : _p.pass) ? 'success' : 'warning');
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
            }
            else if (data.analysisType === 'workspace-health' && data.report) {
                const scan = data.report;
                this.lastResult = {
                    kind: 'workspace-health',
                    scan,
                    projectPath,
                    label: `Workspace health: ${formatPathLabel(projectPath)}`,
                    conclusion: `Workspace health scan complete — ${(scan.findings || []).length} finding(s).`
                };
                this.app.state.analyzeResult = this.lastResult;
                this.refresh();
                showToast('Workspace health scan complete', 'success');
            }
            else if (data.report) {
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
            }
            else {
                await this.attachRepositoryInventory(projectPath);
                this.refresh();
                showToast('Analysis complete', 'success');
            }
            analysisSucceeded = true;
        }
        catch (err) {
            removeRecentPath(projectPath);
            if (err.code === 'auth_required') {
                showToast('Session expired — sign in again', 'error');
                showLoginModal({ onSuccess: () => this.runPathAnalysis(projectPath) });
            }
            else {
                showToast(err.message, 'error');
            }
        }
        finally {
            if (analysisSucceeded) {
                saveRecentPath(projectPath);
                this.savePreferredProjectBase(projectPath);
            }
            this.stopProgressPolling();
            this.busy = false;
            this.completeStep = '';
            this.completeProgress = null;
            this.scanStartedAt = null;
            this.refresh();
            if (analysisSucceeded) {
                this._notifyVscodeSidebar(this.resolveResultsReport());
            }
        }
    }
    async runCompleteScan(projectPath, enginesToRun = resolveEnginesForRun(this.selectedEngines)) {
        var _a, _b, _c, _d;
        await ensureDashboardApiReady();
        this.repositoryInventory = null;
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
        /**
         * Run step.
         * @param {number} index
         * @param {string} engineId
         * @param {any} label
         * @param {Function} fn
         * @returns {any}
         */
        const runStep = async (index, engineId, label, fn) => {
            var _a, _b, _c;
            this.completeProgress.steps[index].status = 'running';
            this.completeStep = label;
            this.updateProgressDom();
            try {
                const result = await fn();
                this.completeProgress.steps[index].status = 'done';
                const canonicalReport = (_c = (_b = (_a = steps.find((s) => s.id === 'simplebeacon')) === null || _a === void 0 ? void 0 : _a.report) !== null && _b !== void 0 ? _b : result === null || result === void 0 ? void 0 : result.report) !== null && _c !== void 0 ? _c : null;
                const canonicalCount = canonicalReport ? getScanFileMetrics(canonicalReport).repositoryFiles : null;
                this.completeProgress.steps[index].metric = summarizeCompleteStepMetric(engineId, result, canonicalCount);
                const enriched = { ...result, status: 'done', metric: this.completeProgress.steps[index].metric };
                steps.push(enriched);
                this.updateProgressDom();
                return enriched;
            }
            catch (err) {
                this.completeProgress.steps[index].status = 'error';
                this.completeProgress.steps[index].error = err.message;
                errors.push({ step: label, message: err.message });
                steps.push({ id: engineId, status: 'error', error: err.message, metric: null });
                this.updateProgressDom();
                return null;
            }
        };
        const stepRunners = {
            simplebeacon: async () => {
                var _a, _b;
                const data = await scanPath(projectPath, { fullDirectoryScan: this.fullDirectoryScan });
                let report = data.report;
                if (!report) {
                    throw new Error('Scan completed but returned no report');
                }
                report = await enrichScanReport(report, projectPath);
                this.repositoryInventory = report.repositoryInventory || null;
                this.app.state.report = report;
                this.app.scanService.report = report;
                if (data.history)
                    this.app.state.history = data.history;
                return {
                    id: 'simplebeacon',
                    report,
                    gateFailed: Boolean(data.gateFailed),
                    gatePass: (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : null,
                    publicGateLocked: Boolean(data.publicGateLocked),
                    publicSummary: data.publicSummary || null
                };
            },
            consolidation: async () => {
                var _a, _b, _c, _d, _e, _f;
                let scan = await this.app.platformService.fetchMergerReductionScan(projectPath);
                if (!(scan === null || scan === void 0 ? void 0 : scan.summary)) {
                    throw new Error('Consolidation scan returned no summary metrics — restart the dashboard server and retry.');
                }
                const inventory = this.repositoryInventory
                    || ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.repositoryInventory)
                    || await fetchRepositoryInventory(projectPath, { fullDirectoryScan: this.fullDirectoryScan }).catch(() => null);
                if ((inventory === null || inventory === void 0 ? void 0 : inventory.totalFiles) && (scan === null || scan === void 0 ? void 0 : scan.summary)) {
                    scan = {
                        ...scan,
                        reportVersion: scan.reportVersion || 2,
                        repositoryInventory: ((_b = scan.repositoryInventory) === null || _b === void 0 ? void 0 : _b.totalFiles) != null
                            ? scan.repositoryInventory
                            : inventory,
                        summary: {
                            ...scan.summary,
                            repositoryFilesTotal: (_c = scan.summary.repositoryFilesTotal) !== null && _c !== void 0 ? _c : inventory.totalFiles,
                            repositoryFoldersTotal: (_d = scan.summary.repositoryFoldersTotal) !== null && _d !== void 0 ? _d : inventory.totalFolders,
                            filesAnalyzed: (_f = (_e = scan.summary.repositoryFilesTotal) !== null && _e !== void 0 ? _e : scan.summary.filesAnalyzed) !== null && _f !== void 0 ? _f : inventory.totalFiles
                        }
                    };
                }
                scan = await this.attachOptionalAiSummary(scan, projectPath, scan === null || scan === void 0 ? void 0 : scan.type);
                this.app.state.mergerReductionScan = scan;
                return { id: 'consolidation', scan };
            },
            'mock-scan': async () => {
                var _a;
                const simplebeaconStep = steps.find((s) => s.id === 'simplebeacon');
                const report = (_a = simplebeaconStep === null || simplebeaconStep === void 0 ? void 0 : simplebeaconStep.report) !== null && _a !== void 0 ? _a : null;
                if (!report) {
                    throw new Error('Simplebeacon gate must complete before fiction digest');
                }
                const fictionIssues = filterIssuesByKind(report, 'fiction');
                const digest = buildFictionDigestPayload(report);
                return {
                    id: 'mock-scan',
                    report,
                    fictionIssues,
                    nonFictionIssues: (digest === null || digest === void 0 ? void 0 : digest.nonFictionIssues) || [],
                    conclusion: (digest === null || digest === void 0 ? void 0 : digest.conclusion) || null
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
                const hasBrowserAnalyzer = enginesToRun.some((id) => BROWSER_ANALYZER_IDS.includes(id));
                let scan = await fetchCodebaseAnalysis(analysisPath, {
                    context: 'complete',
                    includeEslint: true,
                    includeAllFiles: true,
                    understandingMode: 'off',
                    timeoutMs: 900000,
                    requestedScanRoot: projectPath,
                    includeBrowserAnalyzers: hasBrowserAnalyzer
                });
                scan = await this.attachCodeInsights(scan, analysisPath);
                scan = await this.attachOptionalAiSummary(scan, analysisPath, scan === null || scan === void 0 ? void 0 : scan.type);
                return {
                    id: 'codebase',
                    scan,
                    analysisPath,
                    publicGateLocked: Boolean(scan === null || scan === void 0 ? void 0 : scan.publicGateLocked),
                    publicSummary: (scan === null || scan === void 0 ? void 0 : scan.publicSummary) || null
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
            'removable-files': async () => {
                const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
                const data = await analyzePath(analysisPath, {
                    aiProvider: this.aiProvider,
                    analysisType: 'removable-files',
                    fullDirectoryScan: this.fullDirectoryScan
                });
                return { id: 'removable-files', scan: data.removableFiles || data.report || data };
            },
            'cleanup-assistant': async () => {
                var _a, _b, _c, _d, _e;
                let fileReduction = (_b = (_a = steps.find((s) => s.id === 'file-reduction')) === null || _a === void 0 ? void 0 : _a.scan) !== null && _b !== void 0 ? _b : null;
                let dataQuality = (_d = (_c = steps.find((s) => s.id === 'data-quality')) === null || _c === void 0 ? void 0 : _c.scan) !== null && _d !== void 0 ? _d : null;
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
                    || ((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.repositoryInventory)
                    || (fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.inventory)
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
                const report = simplebeaconStep === null || simplebeaconStep === void 0 ? void 0 : simplebeaconStep.report;
                if (!report) {
                    throw new Error('Simplebeacon gate must complete before compliance checklist');
                }
                const npmAuditStep = steps.find((s) => s.id === 'npm-audit');
                const npmAudit = (npmAuditStep === null || npmAuditStep === void 0 ? void 0 : npmAuditStep.npmAudit) || null;
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
        // Hidden codebase prerequisite: if browser analyzers are selected but codebase is not,
        // run codebase analysis invisibly so browser analyzers have data to display.
        let hiddenCodebaseResult = null;
        const needsCodebase = enginesToRun.some((id) => BROWSER_ANALYZER_IDS.includes(id));
        const hasCodebase = enginesToRun.includes('codebase');
        if (needsCodebase && !hasCodebase) {
            try {
                const analysisPath = resolveCompleteScanTargetPath(projectPath, steps);
                hiddenCodebaseResult = await fetchCodebaseAnalysis(analysisPath, {
                    context: 'audit',
                    includeEslint: false,
                    includeAllFiles: true,
                    understandingMode: 'off',
                    timeoutMs: 300000,
                    requestedScanRoot: projectPath,
                    includeBrowserAnalyzers: true
                });
                hiddenCodebaseResult = await this.attachCodeInsights(hiddenCodebaseResult, analysisPath);
                hiddenCodebaseResult = await this.attachOptionalAiSummary(hiddenCodebaseResult, analysisPath, hiddenCodebaseResult === null || hiddenCodebaseResult === void 0 ? void 0 : hiddenCodebaseResult.type);
            }
            catch (err) {
                // hidden codebase failure is non-fatal; browser analyzers will skip gracefully
            }
        }
        // Generate runners for every browser analyzer so they appear as completed steps
        for (const analyzerId of BROWSER_ANALYZER_IDS) {
            if (!stepRunners[analyzerId]) {
                stepRunners[analyzerId] = async () => {
                    var _a;
                    const codebaseStep = steps.find((s) => s.id === 'codebase');
                    const scan = (codebaseStep === null || codebaseStep === void 0 ? void 0 : codebaseStep.scan) || hiddenCodebaseResult;
                    if (!(scan === null || scan === void 0 ? void 0 : scan.findings)) {
                        throw new Error('Codebase analysis must complete before this analyzer');
                    }
                    // codebase-analyzer stores pattern hits under f.category matching the analyzerId
                    /**
                     * Step findings.
                     * @param {any} scan.findings || []
                     * @returns {any}
                     */
                    const stepFindings = (scan.findings || []).filter((f) => f.category === analyzerId).slice(0, 200);
                    // Derive categoryData from findings when scan.categories is empty (common in complete scans)
                    let categoryData = ((_a = scan.categories) === null || _a === void 0 ? void 0 : _a.find((c) => c.category === analyzerId)) || null;
                    if (!categoryData && stepFindings.length) {
                        const filePaths = stepFindings.map((f) => f.filePath);
                        categoryData = {
                            category: analyzerId,
                            count: stepFindings.length,
                            fileCount: new Set(filePaths).size,
                            severity: stepFindings.some((f) => f.severity === 'high') ? 'high'
                                : stepFindings.some((f) => f.severity === 'medium') ? 'medium' : 'low'
                        };
                    }
                    return {
                        id: analyzerId,
                        category: categoryData,
                        findingsCount: (categoryData === null || categoryData === void 0 ? void 0 : categoryData.count) || 0,
                        fileCount: (categoryData === null || categoryData === void 0 ? void 0 : categoryData.fileCount) || 0,
                        severity: (categoryData === null || categoryData === void 0 ? void 0 : categoryData.severity) || 'low',
                        findings: stepFindings
                    };
                };
            }
        }
        for (let index = 0; index < enginesToRun.length; index += 1) {
            const engineId = enginesToRun[index];
            const runner = stepRunners[engineId];
            if (!runner) {
                this.completeProgress.steps[index].status = 'skipped';
                this.completeProgress.steps[index].error = 'No runner available for this analyzer — results are included in the codebase step';
                this.updateProgressDom();
                continue;
            }
            const label = completeStepLabel(index, `${getCompleteEngineLabel(engineId)}…`, totalSteps);
            await runStep(index, engineId, label, runner);
        }
        const enginesRun = steps.map((step) => step.id);
        const euAiActStep = steps.find((step) => step.id === 'eu-ai-act');
        this.lastResult = {
            kind: 'complete',
            projectPath: (euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.projectPath) || projectPath,
            label: `Complete scan: ${formatPathLabel((euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.projectPath) || projectPath)}`,
            steps,
            enginesRun,
            analysisConfig: {
                selectedEngines: [...this.selectedEngines],
                enginesRun
            },
            errors,
            scanCompletedAt: Date.now(),
            publicGateLocked: steps.some((step) => { var _a, _b; return step.publicGateLocked || ((_a = step.report) === null || _a === void 0 ? void 0 : _a.publicGateLocked) || ((_b = step.scan) === null || _b === void 0 ? void 0 : _b.publicGateLocked); }),
            publicSummary: ((_a = steps.find((step) => step.publicSummary)) === null || _a === void 0 ? void 0 : _a.publicSummary)
                || ((_c = (_b = steps.find((step) => { var _a; return (_a = step.scan) === null || _a === void 0 ? void 0 : _a.publicSummary; })) === null || _b === void 0 ? void 0 : _b.scan) === null || _c === void 0 ? void 0 : _c.publicSummary)
                || null
        };
        const simplebeaconReport = (_d = steps.find((s) => s.id === 'simplebeacon')) === null || _d === void 0 ? void 0 : _d.report;
        await this.attachRepositoryInventory(this.lastResult.projectPath, simplebeaconReport);
        this.lastResult.repositoryInventory = (simplebeaconReport === null || simplebeaconReport === void 0 ? void 0 : simplebeaconReport.repositoryInventory)
            || this.repositoryInventory
            || null;
        this.app.state.analyzeResult = this.lastResult;
        if (errors.length) {
            showToast(`Complete scan finished with ${errors.length} step error(s)`, 'info');
        }
        else {
            showToast('Complete scan finished', 'success');
        }
        this.refresh();
        this._notifyVscodeSidebar(this.resolveResultsReport());
        // Auto-generate PDF if enabled in settings
        void this.maybeAutoGeneratePdf();
    }
    getCompleteStep(id) {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.steps) === null || _b === void 0 ? void 0 : _b.find((s) => s.id === id)) !== null && _c !== void 0 ? _c : null;
    }
    /** Engines selected in memory that completed in the current Complete scan (for ZIP export).
     *  Uses this.selectedEngines directly — the queue panel may only render 10 checkboxes
     *  in the DOM, so readSelectedEnginesFromDom would under-count.
     */
    resolveExportEngineSelection() {
        var _a;
        const selected = new Set(this.selectedEngines);
        const completed = new Set((((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.steps) || []).map((step) => step.id));
        return COMPLETE_ENGINE_ORDER.filter((id) => selected.has(id) && completed.has(id));
    }
    resolveZipExportButtonMeta() {
        var _a;
        /**
         * Completed steps.
         * @param {string} this.lastResult?.steps || []
         * @returns {any}
         */
        const completedSteps = (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.steps) || []).map((step) => step.id);
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
        var _a;
        if (!root || ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) !== 'complete')
            return;
        const btn = root.querySelector('#download-export-bundle-zip');
        if (!btn)
            return;
        const meta = this.resolveZipExportButtonMeta();
        btn.textContent = meta.label;
        btn.title = meta.title;
        btn.disabled = false;
    }
    resolveEuAiActExportPath() {
        var _a, _b, _c, _d, _e;
        const euStep = this.getCompleteStep('eu-ai-act');
        const fromStep = (euStep === null || euStep === void 0 ? void 0 : euStep.projectPath) || ((_a = euStep === null || euStep === void 0 ? void 0 : euStep.sprint) === null || _a === void 0 ? void 0 : _a.projectPath) || ((_b = euStep === null || euStep === void 0 ? void 0 : euStep.sprint) === null || _b === void 0 ? void 0 : _b.platformRoot);
        if (fromStep && !isRedactedPathDisplay(fromStep))
            return fromStep;
        if (((_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.kind) === 'eu-ai-act') {
            return this.lastResult.projectPath || ((_d = this.lastResult.sprint) === null || _d === void 0 ? void 0 : _d.projectPath) || null;
        }
        return ((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.projectPath) || this.getActiveProjectPath() || null;
    }
    buildEuAiActSprintArtifacts() {
        var _a, _b, _c;
        const sprint = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete'
            ? (_b = this.getCompleteStep('eu-ai-act')) === null || _b === void 0 ? void 0 : _b.sprint
            : (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.sprint;
        if (!sprint)
            return null;
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
        return Boolean((artifacts === null || artifacts === void 0 ? void 0 : artifacts.report) || (artifacts === null || artifacts === void 0 ? void 0 : artifacts.complianceChecklist));
    }
    async downloadEuAiActAuditPdf() {
        const projectPath = this.resolveEuAiActExportPath();
        const sprintArtifacts = this.buildEuAiActSprintArtifacts();
        if (!projectPath && !sprintArtifacts) {
            throw new Error('EU AI Act sprint did not run — enable the EU engine and re-run Complete scan.');
        }
        const data = await fetchEuAiActAuditReport({
            projectPath: projectPath || (sprintArtifacts === null || sprintArtifacts === void 0 ? void 0 : sprintArtifacts.projectPath),
            client: formatPathLabel(projectPath || (sprintArtifacts === null || sprintArtifacts === void 0 ? void 0 : sprintArtifacts.projectPath)) || undefined,
            sprintArtifacts
        });
        openAuditReportPrintWindow(data.html, data.filename);
        return data;
    }
    slimResultsForExport(results) {
        var _a, _b, _c, _d;
        if (!results || typeof results !== 'object')
            return results;
        const out = {};
        for (const key of Object.keys(results)) {
            const val = results[key];
            if (!val || typeof val !== 'object') {
                out[key] = val;
                continue;
            }
            if (key === 'simplebeacon') {
                out[key] = { ...val, rawIssues: (_a = val.rawIssues) === null || _a === void 0 ? void 0 : _a.slice(0, 20), detectedIssues: (_b = val.detectedIssues) === null || _b === void 0 ? void 0 : _b.slice(0, 20), exportNotes: undefined, disclaimers: undefined, limitations: undefined, mockDataCategories: undefined, hygieneSummary: undefined, scanScope: val.scanScope ? { ...val.scanScope, limitations: undefined } : val.scanScope };
            }
            else if (key === 'codebase') {
                out[key] = { ...val, findings: (_c = val.findings) === null || _c === void 0 ? void 0 : _c.slice(0, 10), categories: undefined, exportNotes: undefined, hygieneSummary: undefined, scanScope: val.scanScope ? { ...val.scanScope, limitations: undefined } : val.scanScope };
            }
            else if (key === 'consolidation') {
                out[key] = { ...val, duplicatePairs: (_d = val.duplicatePairs) === null || _d === void 0 ? void 0 : _d.slice(0, 10), scanScope: val.scanScope ? { ...val.scanScope, limitations: undefined } : val.scanScope };
            }
            else if (key === 'fileReduction') {
                out[key] = { ...val, scanners: undefined, executiveSummary: undefined };
            }
            else if (key === 'dataQuality') {
                out[key] = { ...val, inventory: val.inventory ? { ...val.inventory, files: undefined, fileList: undefined } : val.inventory };
            }
            else if (key === 'roadmap') {
                out[key] = { ...val, developmentPhases: undefined, implementationPhases: undefined, featureCategories: undefined, recommendations: undefined, progressMetrics: undefined, resourceEstimate: undefined, exportNotes: undefined, hygieneSummary: undefined };
            }
            else {
                out[key] = val;
            }
        }
        return out;
    }
    buildCompleteScanExport(options = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78;
        const { projectPath, steps: rawSteps = [], errors = [], enginesRun = rawSteps.map((step) => step.id) } = this.lastResult || {};
        // Slim engine steps to lightweight metadata — browser analyzers carry their own findings
        const steps = rawSteps.map((s) => {
            var _a, _b;
            if (!s)
                return null;
            const isBrowserAnalyzer = !CORE_ENGINE_IDS.has(s.id) && s.id !== 'eu-ai-act';
            if (isBrowserAnalyzer) {
                // Preserve browser analyzer findings; they are not duplicated in results/
                return {
                    id: s.id,
                    status: s.status,
                    error: s.error || null,
                    metric: s.metric || null,
                    findingsCount: (_a = s.findingsCount) !== null && _a !== void 0 ? _a : null,
                    fileCount: (_b = s.fileCount) !== null && _b !== void 0 ? _b : null,
                    severity: s.severity || null,
                    findings: s.findings || null,
                    category: s.category || null
                };
            }
            return { id: s.id, status: s.status, error: s.error || null, metric: s.metric || null };
        }).filter(Boolean);
        const euAiActStep = this.getCompleteStep('eu-ai-act');
        const simplebeacon = (_b = (_a = this.getCompleteStep('simplebeacon')) === null || _a === void 0 ? void 0 : _a.report) !== null && _b !== void 0 ? _b : null;
        const consolidation = (_d = (_c = this.getCompleteStep('consolidation')) === null || _c === void 0 ? void 0 : _c.scan) !== null && _d !== void 0 ? _d : null;
        const mockStep = this.getCompleteStep('mock-scan');
        const mockScan = (mockStep === null || mockStep === void 0 ? void 0 : mockStep.report)
            ? buildFictionDigestPayload(mockStep.report, {
                generatedAt: mockStep.report.generatedAt || new Date().toISOString(),
                projectPath: projectPath || mockStep.report.projectRoot
            })
            : null;
        const roadmapStep = this.getCompleteStep('roadmap');
        const roadmap = (_g = (_e = roadmapStep === null || roadmapStep === void 0 ? void 0 : roadmapStep.roadmap) !== null && _e !== void 0 ? _e : (_f = roadmapStep === null || roadmapStep === void 0 ? void 0 : roadmapStep.data) === null || _f === void 0 ? void 0 : _f.roadmap) !== null && _g !== void 0 ? _g : null;
        const codebase = (_j = (_h = this.getCompleteStep('codebase')) === null || _h === void 0 ? void 0 : _h.scan) !== null && _j !== void 0 ? _j : null;
        const fileReduction = (_l = (_k = this.getCompleteStep('file-reduction')) === null || _k === void 0 ? void 0 : _k.scan) !== null && _l !== void 0 ? _l : null;
        const dataQuality = (_o = (_m = this.getCompleteStep('data-quality')) === null || _m === void 0 ? void 0 : _m.scan) !== null && _o !== void 0 ? _o : null;
        const cleanupStep = this.getCompleteStep('cleanup-assistant');
        const cleanupAssistant = (_q = (_p = buildCleanupBriefFromLastResult(this.lastResult, cleanupStep === null || cleanupStep === void 0 ? void 0 : cleanupStep.policy)) !== null && _p !== void 0 ? _p : cleanupStep === null || cleanupStep === void 0 ? void 0 : cleanupStep.brief) !== null && _q !== void 0 ? _q : null;
        const enrichedFileReduction = (fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan)
            ? fileReduction
            : (() => {
                var _a, _b, _c;
                const plan = resolveFileReductionPlan(fileReduction);
                return ((_b = (_a = plan === null || plan === void 0 ? void 0 : plan.safeToDelete) === null || _a === void 0 ? void 0 : _a.topDirectories) === null || _b === void 0 ? void 0 : _b.length) || ((_c = plan === null || plan === void 0 ? void 0 : plan.totals) === null || _c === void 0 ? void 0 : _c.safeToDeleteBytes)
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
            steps,
            errors,
            enginesRun,
            analysisConfig: ((_r = this.lastResult) === null || _r === void 0 ? void 0 : _r.analysisConfig) || {
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
                simplebeaconGatePass: (_t = (_s = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.gate) === null || _s === void 0 ? void 0 : _s.pass) !== null && _t !== void 0 ? _t : null,
                simplebeaconIssues: (_w = (_u = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.issueCount) !== null && _u !== void 0 ? _u : (_v = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.rawIssues) === null || _v === void 0 ? void 0 : _v.length) !== null && _w !== void 0 ? _w : null,
                consolidationDuplicateGroups: (_y = (_x = consolidation === null || consolidation === void 0 ? void 0 : consolidation.summary) === null || _x === void 0 ? void 0 : _x.exactDuplicateGroups) !== null && _y !== void 0 ? _y : null,
                fictionKpiHits: (_0 = (_z = mockScan === null || mockScan === void 0 ? void 0 : mockScan.fictionIssues) === null || _z === void 0 ? void 0 : _z.reduce((sum, i) => sum + (i.count || 1), 0)) !== null && _0 !== void 0 ? _0 : null,
                roadmapFiles: (_3 = (_2 = (_1 = roadmap === null || roadmap === void 0 ? void 0 : roadmap.codeAnalysis) === null || _1 === void 0 ? void 0 : _1.structure) === null || _2 === void 0 ? void 0 : _2.totalFiles) !== null && _3 !== void 0 ? _3 : null,
                codebaseHealthScore: (_5 = (_4 = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _4 === void 0 ? void 0 : _4.healthScore) !== null && _5 !== void 0 ? _5 : null,
                codebaseFindings: (_7 = (_6 = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _6 === void 0 ? void 0 : _6.findingsTotal) !== null && _7 !== void 0 ? _7 : null,
                fileReductionFindings: (_9 = (_8 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.summary) === null || _8 === void 0 ? void 0 : _8.totalFindings) !== null && _9 !== void 0 ? _9 : null,
                fileReductionReclaimableBytes: (_11 = (_10 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.summary) === null || _10 === void 0 ? void 0 : _10.reclaimableBytes) !== null && _11 !== void 0 ? _11 : null,
                fileReductionSafeToDeleteBytes: (_17 = (_14 = (_13 = (_12 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) === null || _12 === void 0 ? void 0 : _12.totals) === null || _13 === void 0 ? void 0 : _13.safeToDeleteBytes) !== null && _14 !== void 0 ? _14 : (_16 = (_15 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.scanners) === null || _15 === void 0 ? void 0 : _15['build-artifacts']) === null || _16 === void 0 ? void 0 : _16.safeToDeleteBytes) !== null && _17 !== void 0 ? _17 : null,
                fileReductionImmediateSavingsBytes: (_20 = (_19 = (_18 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) === null || _18 === void 0 ? void 0 : _18.totals) === null || _19 === void 0 ? void 0 : _19.estimatedImmediateSavingsBytes) !== null && _20 !== void 0 ? _20 : null,
                fileReductionUnusedCandidates: (_25 = (_23 = (_22 = (_21 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) === null || _21 === void 0 ? void 0 : _21.unusedFiles) === null || _22 === void 0 ? void 0 : _22.candidates) !== null && _23 !== void 0 ? _23 : (_24 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.summary) === null || _24 === void 0 ? void 0 : _24.unusedFileCandidates) !== null && _25 !== void 0 ? _25 : null,
                dataQualityFindings: (_27 = (_26 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.summary) === null || _26 === void 0 ? void 0 : _26.totalFindings) !== null && _27 !== void 0 ? _27 : null,
                dataQualityWorkspacePackages: (_30 = (_29 = (_28 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) === null || _28 === void 0 ? void 0 : _28.workspace) === null || _29 === void 0 ? void 0 : _29.packageJsonFiles) !== null && _30 !== void 0 ? _30 : null,
                dataQualityUnusedDependencies: (_33 = (_32 = (_31 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) === null || _31 === void 0 ? void 0 : _31.workspace) === null || _32 === void 0 ? void 0 : _32.unusedDependencies) !== null && _33 !== void 0 ? _33 : null,
                dataQualityCredentialsNeedingReview: (_36 = (_35 = (_34 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) === null || _34 === void 0 ? void 0 : _34.security) === null || _35 === void 0 ? void 0 : _35.credentialsNeedingReview) !== null && _36 !== void 0 ? _36 : null,
                dataQualityPiiNeedingReview: (_39 = (_38 = (_37 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) === null || _37 === void 0 ? void 0 : _37.security) === null || _38 === void 0 ? void 0 : _38.piiNeedingReview) !== null && _39 !== void 0 ? _39 : null,
                fileReductionReviewBytes: (_42 = (_41 = (_40 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) === null || _40 === void 0 ? void 0 : _40.totals) === null || _41 === void 0 ? void 0 : _41.reviewBeforeDeleteBytes) !== null && _42 !== void 0 ? _42 : null,
                cleanupSafeFiles: (_44 = (_43 = cleanupAssistant === null || cleanupAssistant === void 0 ? void 0 : cleanupAssistant.estimatedReduction) === null || _43 === void 0 ? void 0 : _43.files) !== null && _44 !== void 0 ? _44 : null,
                cleanupSafeBytes: (_46 = (_45 = cleanupAssistant === null || cleanupAssistant === void 0 ? void 0 : cleanupAssistant.estimatedReduction) === null || _45 === void 0 ? void 0 : _45.bytes) !== null && _46 !== void 0 ? _46 : null,
                cleanupProjectedFiles: (_48 = (_47 = cleanupAssistant === null || cleanupAssistant === void 0 ? void 0 : cleanupAssistant.projectedInventory) === null || _47 === void 0 ? void 0 : _47.totalFiles) !== null && _48 !== void 0 ? _48 : null,
                llmSlopHits: (_49 = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.llmSlopPatternHits) !== null && _49 !== void 0 ? _49 : null,
                compliancePassed: (_53 = (_52 = (_51 = (_50 = this.getCompleteStep('compliance')) === null || _50 === void 0 ? void 0 : _50.checklist) === null || _51 === void 0 ? void 0 : _51.summary) === null || _52 === void 0 ? void 0 : _52.passed) !== null && _53 !== void 0 ? _53 : null,
                complianceFailed: (_57 = (_56 = (_55 = (_54 = this.getCompleteStep('compliance')) === null || _54 === void 0 ? void 0 : _54.checklist) === null || _55 === void 0 ? void 0 : _55.summary) === null || _56 === void 0 ? void 0 : _56.failed) !== null && _57 !== void 0 ? _57 : null,
                npmVulnerabilities: (_61 = (_60 = (_59 = (_58 = this.getCompleteStep('npm-audit')) === null || _58 === void 0 ? void 0 : _58.npmAudit) === null || _59 === void 0 ? void 0 : _59.summary) === null || _60 === void 0 ? void 0 : _60.total) !== null && _61 !== void 0 ? _61 : null,
                euAiActIncluded: enginesRun.includes('eu-ai-act'),
                euAiActGatePass: (_64 = (_63 = (_62 = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) === null || _62 === void 0 ? void 0 : _62.gate) === null || _63 === void 0 ? void 0 : _63.pass) !== null && _64 !== void 0 ? _64 : null,
                euAiActReadinessScore: (_67 = (_66 = (_65 = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) === null || _65 === void 0 ? void 0 : _65.compliance) === null || _66 === void 0 ? void 0 : _66.score) !== null && _67 !== void 0 ? _67 : null,
                euAiActChecklistPassed: (_70 = (_69 = (_68 = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) === null || _68 === void 0 ? void 0 : _68.compliance) === null || _69 === void 0 ? void 0 : _69.passed) !== null && _70 !== void 0 ? _70 : null,
                euAiActChecklistTotal: (_73 = (_72 = (_71 = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) === null || _71 === void 0 ? void 0 : _71.compliance) === null || _72 === void 0 ? void 0 : _72.total) !== null && _73 !== void 0 ? _73 : null
            },
            completeScanAnalysis,
            enrichedAt: new Date().toISOString(),
            results: this.slimResultsForExport({
                simplebeacon,
                consolidation,
                mockScan,
                roadmap,
                codebase,
                fileReduction,
                dataQuality,
                cleanupAssistant,
                compliance: (_75 = (_74 = this.getCompleteStep('compliance')) === null || _74 === void 0 ? void 0 : _74.checklist) !== null && _75 !== void 0 ? _75 : null,
                npmAudit: (_77 = (_76 = this.getCompleteStep('npm-audit')) === null || _76 === void 0 ? void 0 : _76.npmAudit) !== null && _77 !== void 0 ? _77 : null,
                sprint: (_78 = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) !== null && _78 !== void 0 ? _78 : null
            })
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
        if (!this.lastResult)
            return '';
        const { kind } = this.lastResult;
        const isComplete = kind === 'complete';
        const showGotoResults = kind === 'complete' || kind === 'simplebeacon-report' || kind === 'mock-scan';
        const gotoLabel = kind === 'complete' ? 'Open Simplebeacon Results →' : 'Open in Results →';
        const extraButtons = kind === 'roadmap'
            ? '<button type="button" class="btn btn-secondary btn-sm" id="copy-roadmap-json">Copy JSON</button>'
            : '<button type="button" class="btn btn-primary btn-sm" id="analyze-send-ai-btn" title="Send scan data to AI coding agent">🤖 Send to AI Agent</button>';
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
        <div id="analyze-ai-panel" class="card mt-3" style="display:none;padding:var(--space-3);background:rgba(99,102,241,0.06);border-color:rgba(99,102,241,0.2);">
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px;">Add notes for the AI agent (optional):</p>
          <textarea id="analyze-ai-notes" rows="2" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px;background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.8rem;resize:vertical;" placeholder="e.g., 'Focus on critical credential leaks first, ignore test files...'"></textarea>
          <div class="flex gap-2 mt-2">
            <button class="btn btn-primary btn-sm" id="analyze-ai-confirm" type="button">Confirm Send</button>
            <button class="btn btn-ghost btn-sm" id="analyze-ai-cancel" type="button">Cancel</button>
          </div>
          <div id="analyze-ai-status" style="margin-top:8px;font-size:0.8rem;display:none;"></div>
        </div>
      </div>
    `;
    }
    getAuditExportPreview() {
        var _a;
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'eu-ai-act') {
            return { tier: 'eu-ai-act', label: 'EU AI Act readiness (reference)', exportBlocked: false };
        }
        const payload = this.buildAuditExportPayload();
        if (!this.scanExportHasPayload(payload))
            return null;
        return previewAuditExportTier(payload);
    }
    getAuditExportButtonLabel() {
        return auditExportButtonLabel(this.getAuditExportPreview());
    }
    syncAuditButtonLabel(root = this._root) {
        if (!root)
            return;
        const btn = root.querySelector('#download-audit-pdf');
        if (!btn)
            return;
        const label = this.getAuditExportButtonLabel();
        btn.textContent = label;
        btn.disabled = false;
    }
    renderAuditExportCallout() {
        var _a, _b;
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'eu-ai-act') {
            return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>Reference EU layout.</strong> PDF is built from <code>.simplebeacon/eu-ai-act-*.json</code> sprint artifacts — not the $499 pre-launch security handoff. Active offers: <a href="/dashboard/deliverables">$499 PDF</a> and agency packs.</p>`;
        }
        if (((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.kind) === 'complete' && this.hasEuAiActSprintResult()) {
            return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>EU AI Act sprint included.</strong> Use <strong>Download EU PDF</strong> for the regulatory readiness report (step 11). <strong>Download audit PDF</strong> is the corporate executive / gate handoff — not the EU layout.</p>`;
        }
        const preview = this.getAuditExportPreview();
        if (!preview || preview.exportBlocked || preview.tier === 'handoff')
            return '';
        const gateNote = preview.tier === 'gate-only' || preview.tier === 'codebase-only'
            ? 'Gate attestation is not combined with codebase in this export.'
            : 'This PDF covers this step only — gate attestation is not included unless you run Simplebeacon gate or Complete scan.';
        const missing = preview.tier === 'gate-only' || preview.tier === 'codebase-only'
            ? 'For vendor handoff, also export the complementary gate or codebase PDF, or run Complete scan.'
            : 'For vendor handoff, run Analyze → Complete (all steps).';
        return `<p class="text-muted mb-3" style="font-size: var(--font-size-sm);"><strong>Supplementary deliverable (${escapeHtml(preview.label)}).</strong> ${escapeHtml(gateNote)} ${escapeHtml(missing)}</p>`;
    }
    wrapAnalyzeResults(content) {
        const funnelHtml = this.renderFunnelTrigger();
        return `${this.renderResultsExportBar()}${content || ''}${funnelHtml}`;
    }
    renderFunnelTrigger() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const report = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.report) || ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.scan);
        if (!report)
            return '';
        const metrics = {
            files_scanned: (_d = (_c = report.filesScanned) !== null && _c !== void 0 ? _c : report.fictionJsonFilesScanned) !== null && _d !== void 0 ? _d : 0,
            total_files: (_g = (_f = (_e = this.repositoryInventory) === null || _e === void 0 ? void 0 : _e.totalFiles) !== null && _f !== void 0 ? _f : report.totalFiles) !== null && _g !== void 0 ? _g : 0,
            quality_score: (_k = (_h = report.qualityScore) !== null && _h !== void 0 ? _h : (_j = report.gate) === null || _j === void 0 ? void 0 : _j.score) !== null && _k !== void 0 ? _k : 0,
            findings: report.rawIssues || report.detectedIssues || []
        };
        const funnel = evaluateFunnelMetrics(metrics);
        if (!funnel.shouldPromptUpgrade)
            return '';
        const copy = getFunnelCopy(funnel.reason);
        return `
      <div class="card mb-4" style="border-left: 4px solid var(--accent-primary);">
        <div class="section-heading">
          <h3>${escapeHtml(copy.title)}</h3>
        </div>
        <p class="text-muted">${escapeHtml(copy.body)}</p>
        <button class="btn btn-primary" onclick="window.open('https://simplebeacon.ai/pricing','_blank')">
          ${escapeHtml(copy.cta)}
        </button>
      </div>
    `;
    }
    renderScanDownloadActions({ isComplete = false, showGotoResults = false, gotoLabel = 'Open Simplebeacon Results →', extraButtons = '', auditButtonLabel = 'Download audit PDF' } = {}) {
        var _a, _b, _c, _d;
        const locked = this.isResultsLocked();
        const checkoutUrl = ((_b = (_a = this.app.billingService) === null || _a === void 0 ? void 0 : _a.getAuditCheckoutUrl) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
        const priceLabel = ((_d = (_c = this.app.billingService) === null || _c === void 0 ? void 0 : _c.plan) === null || _d === void 0 ? void 0 : _d.auditPriceLabel) || '$499';
        const downloadLabel = isComplete ? 'Download all results' : 'Download result';
        const showEuPdf = this.hasEuAiActSprintResult();
        const zipMeta = isComplete ? this.resolveZipExportButtonMeta() : null;
        return `
      <div class="roadmap-result-actions">
        <button type="button" class="btn btn-primary btn-sm" id="download-scan-result">${downloadLabel}</button>
        ${isComplete
            ? `<button type="button" class="btn btn-secondary btn-sm" id="download-export-bundle-zip" title="${escapeHtml((zipMeta === null || zipMeta === void 0 ? void 0 : zipMeta.title) || 'ZIP with step JSON plus audit PDF sources')}">${escapeHtml((zipMeta === null || zipMeta === void 0 ? void 0 : zipMeta.label) || 'Download all reports (ZIP)')}</button>`
            : ''}
        <button type="button" class="btn btn-secondary btn-sm" id="export-for-remediation" title="Download JSON ready for the Remediation Roadmap page">Export for Remediation</button>
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
        var _a, _b;
        const slug = pathToFileSlug((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath);
        const kind = ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.kind) || 'scan';
        const stamp = dateStamp();
        if (kind === 'complete')
            return `complete-scan-${slug}-${stamp}.json`;
        if (kind === 'cleanup-assistant')
            return `cleanup-export-${slug}-${stamp}.json`;
        if (kind === 'mock-scan')
            return `fiction-digest-${slug}-${stamp}.json`;
        if (kind === 'simplebeacon-report')
            return `simplebeacon-${slug}-${stamp}.json`;
        if (kind === 'roadmap')
            return `${slug || 'roadmap'}-${stamp}.json`;
        return `${kind}-${slug}-${stamp}.json`;
    }
    buildScanResultExport() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete') {
            const exportFilename = this.resolveScanExportFilename();
            console.log('[buildScanResultExport] kind=complete, calling buildCompleteScanExport');
            try {
                const result = this.buildCompleteScanExport({ exportFilename });
                console.log('[buildScanResultExport] buildCompleteScanExport returned:', result);
                return result;
            }
            catch (err) {
                console.error('[buildScanResultExport] buildCompleteScanExport threw:', err);
                return null;
            }
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
                        projectPath: ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath) || report.projectRoot
                    })
                    : null;
            case 'consolidation':
            case 'codebase':
            case 'workspace-health':
                return scan || null;
            case 'file-reduction':
            case 'data-quality':
                return scan
                    ? { ...scan, scanProfile: profile || kind }
                    : null;
            case 'cleanup-assistant': {
                const rebuiltBrief = buildCleanupBriefFromLastResult(this.lastResult, policy);
                if (!rebuiltBrief)
                    return null;
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
                return (data === null || data === void 0 ? void 0 : data.roadmap) || null;
            case 'compliance': {
                const npmAudit = ((_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.kind) === 'complete'
                    ? (_d = this.getCompleteStep('npm-audit')) === null || _d === void 0 ? void 0 : _d.npmAudit
                    : (_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.npmAudit;
                if ((_f = this.lastResult) === null || _f === void 0 ? void 0 : _f.complianceExport) {
                    return {
                        ...this.lastResult.complianceExport,
                        generatedAt,
                        scanDurationMs
                    };
                }
                return ((_g = this.lastResult) === null || _g === void 0 ? void 0 : _g.checklist)
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
                return ((_h = this.lastResult) === null || _h === void 0 ? void 0 : _h.npmAudit)
                    ? sanitizeNpmAuditExport({
                        type: 'simplebeacon-npm-audit',
                        generatedAt,
                        projectPath,
                        scanDurationMs,
                        ...this.lastResult.npmAudit
                    }, projectPath)
                    : null;
            case 'eu-ai-act':
                return ((_j = this.lastResult) === null || _j === void 0 ? void 0 : _j.sprint)
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
    loadDownloadSettings() {
        var _a, _b, _c, _d;
        try {
            const raw = localStorage.getItem('sb-download-settings');
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                autoGeneratePdf: parsed.autoGeneratePdf === true,
                promptForCredentials: parsed.promptForCredentials !== false,
                credentials: {
                    projectName: ((_a = parsed.credentials) === null || _a === void 0 ? void 0 : _a.projectName) || '',
                    signatoryName: ((_b = parsed.credentials) === null || _b === void 0 ? void 0 : _b.signatoryName) || '',
                    signatoryTitle: ((_c = parsed.credentials) === null || _c === void 0 ? void 0 : _c.signatoryTitle) || '',
                    contactEmail: ((_d = parsed.credentials) === null || _d === void 0 ? void 0 : _d.contactEmail) || ''
                }
            };
        }
        catch (_e) {
            return { autoGeneratePdf: false, promptForCredentials: true, credentials: {} };
        }
    }
    saveDownloadSettings(settings) {
        localStorage.setItem('sb-download-settings', JSON.stringify(settings));
    }
    async maybeAutoGeneratePdf() {
        const settings = this.loadDownloadSettings();
        if (!settings.autoGeneratePdf)
            return;
        showToast('Auto-generating audit PDF report…', 'info');
        try {
            const payload = await this.ensureAuditExportPayload();
            if (!this.scanExportHasPayload(payload)) {
                showToast('Auto PDF: no scan results available', 'warning');
                return;
            }
            const data = await fetchCompleteAuditReport(payload, {
                aiProvider: this.aiProvider || 'demo',
                client: formatPathLabel(payload.projectPath) || redactPathForDisplay(payload.projectPath) || undefined,
                credentials: settings.credentials
            });
            openAuditReportPrintWindow(data.html, data.filename);
            const tierLabel = data.exportTierLabel || data.tier || 'audit';
            showToast(`Auto-generated ${tierLabel} report saved as ${data.filename}. Open the HTML file, then Print → Save as PDF.`, 'success');
        }
        catch (err) {
            if (err.code === 'audit_paywall' && err.checkoutUrl) {
                window.open(err.checkoutUrl, '_blank', 'noopener,noreferrer');
            }
            else {
                showToast('Auto PDF failed: ' + (err.message || 'Unknown error'), 'error');
            }
        }
    }
    async _doPdfDownload(btn, priorLabel, credentials) {
        var _a;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Building report…';
        }
        try {
            if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'eu-ai-act') {
                const data = await fetchEuAiActAuditReport({
                    projectPath: this.lastResult.projectPath,
                    client: formatPathLabel(this.lastResult.projectPath) || redactPathForDisplay(this.lastResult.projectPath) || undefined,
                    credentials
                });
                openAuditReportPrintWindow(data.html, data.filename);
                showToast(`EU compliance report saved as ${data.filename}. Open the HTML file, then Print → Save as PDF.`, 'success');
                return;
            }
            const payload = await this.ensureAuditExportPayload();
            if (!this.scanExportHasPayload(payload)) {
                showToast('No scan results available for audit PDF', 'error');
                return;
            }
            const data = await fetchCompleteAuditReport(payload, {
                aiProvider: this.aiProvider || 'demo',
                client: formatPathLabel(payload.projectPath) || redactPathForDisplay(payload.projectPath) || undefined,
                credentials
            });
            openAuditReportPrintWindow(data.html, data.filename);
            const tierLabel = data.exportTierLabel || data.tier || 'audit';
            showToast(`${tierLabel} report saved to Downloads as ${data.filename}. Open the HTML file, scroll through all sections, then Print → Save as PDF.`, 'success');
        }
        catch (err) {
            if (err.code === 'audit_paywall' && err.checkoutUrl) {
                window.open(err.checkoutUrl, '_blank', 'noopener,noreferrer');
            }
            showToast(err.message || 'Audit PDF failed', 'error');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = priorLabel || 'Download audit PDF';
            }
        }
    }
    async _doZipDownload(btn, priorLabel, payload, exportEngines, credentials) {
        var _a, _b, _c, _d;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Building ZIP…';
        }
        try {
            const internal = Boolean((_b = (_a = this.app.billingService) === null || _a === void 0 ? void 0 : _a.plan) === null || _b === void 0 ? void 0 : _b.internalDashboard);
            const { blob, filename, tierId, warnings } = await fetchAnalyzeExportBundleZip(payload, {
                deliverableSku: internal ? 'operator' : undefined,
                internalDashboard: internal,
                client: formatPathLabel(payload.projectPath) || redactPathForDisplay(payload.projectPath) || undefined,
                aiProvider: this.aiProvider || 'demo',
                selectedEngines: exportEngines,
                enginesRun: exportEngines,
                credentials
            });
            downloadBlob(blob, filename);
            const engineNote = exportEngines.length === (((_d = (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.steps) === null || _d === void 0 ? void 0 : _d.length) || exportEngines.length)
                ? ''
                : ` · ${exportEngines.length} scan${exportEngines.length === 1 ? '' : 's'}`;
            const warnNote = warnings.length ? ` (${warnings.length} note(s) in manifest)` : '';
            showToast(`Export bundle downloaded (${tierId || 'bundle'}${engineNote})${warnNote}`, 'success');
        }
        catch (err) {
            if (err.code === 'export_paywall' && err.checkoutUrl) {
                window.open(err.checkoutUrl, '_blank', 'noopener,noreferrer');
            }
            showToast(err.message || 'ZIP export failed', 'error');
        }
        finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = priorLabel || this.resolveZipExportButtonMeta().label;
            }
        }
    }
    buildRemediationExport() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const payload = this.buildScanResultExport();
        console.log('[buildRemediationExport] raw payload:', payload);
        console.log('[buildRemediationExport] scanExportHasPayload:', this.scanExportHasPayload(payload));
        if (!this.scanExportHasPayload(payload))
            return null;
        const issues = [];
        /**
         * Add issues.
         * @param {any} source
         * @param {Array} defaults
         * @returns {any}
         */
        const addIssues = (source, defaults = {}) => {
            var _a, _b;
            if (!Array.isArray(source))
                return;
            for (const item of source) {
                issues.push({
                    id: item.id || `${item.severity || 'info'}|${item.type || 'Issue'}|${item.description || ''}|${issues.length}`,
                    severity: ['critical', 'high', 'medium', 'low', 'info'].includes(item.severity) ? item.severity : 'info',
                    type: item.type || 'Issue',
                    category: item.category || defaults.category || 'General',
                    description: item.description || item.message || item.detail || '',
                    filePath: item.filePath || ((_a = item.filePaths) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = item.affectedFiles) === null || _b === void 0 ? void 0 : _b[0]) || item.location || '—',
                    action: item.recommendedAction || item.action || defaults.action || 'Review && remediate',
                    effort: item.effort || defaults.effort || '20 min',
                    completed: item.completed || false
                });
            }
        };
        if (payload.type === 'simplebeacon-complete-scan') {
            const results = payload.results || {};
            if ((_a = results.simplebeacon) === null || _a === void 0 ? void 0 : _a.rawIssues)
                addIssues(results.simplebeacon.rawIssues, { category: 'Security' });
            else if ((_b = results.simplebeacon) === null || _b === void 0 ? void 0 : _b.detectedIssues)
                addIssues(results.simplebeacon.detectedIssues, { category: 'Security' });
            else if ((_c = results.simplebeacon) === null || _c === void 0 ? void 0 : _c.findings)
                addIssues(results.simplebeacon.findings, { category: 'Security' });
            if ((_d = results.codebase) === null || _d === void 0 ? void 0 : _d.findings)
                addIssues(results.codebase.findings, { category: 'Codebase' });
            if ((_e = results.roadmap) === null || _e === void 0 ? void 0 : _e.phases) {
                const converted = this._convertRoadmapPhases(results.roadmap.phases);
                addIssues(converted);
            }
            if ((_f = results.fileReduction) === null || _f === void 0 ? void 0 : _f.findings)
                addIssues(results.fileReduction.findings, { category: 'Cleanup', effort: '10 min' });
            if ((_g = results.dataQuality) === null || _g === void 0 ? void 0 : _g.findings)
                addIssues(results.dataQuality.findings, { category: 'Quality', effort: '10 min' });
            else if ((_h = results.dataCleanup) === null || _h === void 0 ? void 0 : _h.findings)
                addIssues(results.dataCleanup.findings, { category: 'Quality', effort: '10 min' });
            if ((_j = results.npmAudit) === null || _j === void 0 ? void 0 : _j.vulnerabilities) {
                const validVulns = results.npmAudit.vulnerabilities.filter(v => v && v.name && v.name !== 'undefined');
                if (validVulns.length) {
                    addIssues(validVulns.map(v => {
                        var _a, _b, _c, _d, _e, _f;
                        return ({
                            id: `npm-${v.name}-${((_b = (_a = v.via) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.title) || ((_c = v.via) === null || _c === void 0 ? void 0 : _c[0]) || 'audit'}`,
                            severity: v.severity === 'critical' ? 'critical' : v.severity === 'high' ? 'high' : v.severity === 'moderate' ? 'medium' : 'low',
                            type: `npm audit: ${v.name}`,
                            description: `${((_e = (_d = v.via) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.title) || ((_f = v.via) === null || _f === void 0 ? void 0 : _f[0]) || 'Vulnerability'} — range: ${v.range || 'unknown'}`,
                            filePath: v.filePath || 'package.json',
                            action: `Update ${v.name} to a patched version`,
                            effort: '20 min'
                        });
                    }), { category: 'Security' });
                }
            }
            if ((_k = results.cleanupAssistant) === null || _k === void 0 ? void 0 : _k.items)
                addIssues(results.cleanupAssistant.items, { category: 'Cleanup', effort: '5 min' });
            if ((_l = results.compliance) === null || _l === void 0 ? void 0 : _l.rules) {
                const failedRules = results.compliance.rules.filter(r => r.status === 'fail');
                if (failedRules.length) {
                    addIssues(failedRules.map(r => ({
                        id: r.id || r.rule || 'compliance-rule',
                        severity: r.severity || 'medium',
                        type: r.title || r.name || 'Compliance Rule',
                        description: r.impact || r.description || '',
                        filePath: '—',
                        action: r.fix || 'Review compliance requirement',
                        effort: '20 min'
                    })), { category: 'Compliance' });
                }
            }
        }
        else if (payload.type === 'simplebeacon-report') {
            const source = payload.rawIssues || payload.detectedIssues || [];
            addIssues(source, { category: 'Security' });
            // Fallback: if standard arrays are empty, look in gate.blockingFindings and aiContext.suggestedFixes
            if (!source.length) {
                if (Array.isArray((_m = payload.gate) === null || _m === void 0 ? void 0 : _m.blockingFindings)) {
                    addIssues(payload.gate.blockingFindings.map(f => ({
                        id: f.rule || f.type,
                        severity: f.severity || 'high',
                        type: f.type || 'Blocking Finding',
                        category: 'Security',
                        description: f.impact || f.fix || '',
                        filePath: f.filePath || '—',
                        action: f.fix || 'Review && remediate',
                        effort: '20 min',
                        completed: false
                    })), { category: 'Security' });
                }
                if (Array.isArray((_o = payload.aiContext) === null || _o === void 0 ? void 0 : _o.suggestedFixes)) {
                    addIssues(payload.aiContext.suggestedFixes.map(f => ({
                        id: `${f.type || 'issue'}|${f.file || '—'}:${f.line || 0}`,
                        severity: f.severity || 'medium',
                        type: f.type || 'Issue',
                        category: f.type || 'General',
                        description: `${f.action || 'Review'} — ${f.file || '—'}:${f.line || 0} — ${f.snippet || ''}`,
                        filePath: f.file || '—',
                        action: f.action || 'Review && remediate',
                        effort: '20 min',
                        completed: false
                    })));
                }
            }
        }
        else if (Array.isArray(payload.issues)) {
            addIssues(payload.issues);
        }
        else if (Array.isArray(payload.phases)) {
            const converted = this._convertRoadmapPhases(payload.phases);
            addIssues(converted);
        }
        else if (payload.rawIssues || payload.detectedIssues) {
            addIssues(payload.rawIssues || payload.detectedIssues || []);
        }
        if (!issues.length)
            return null;
        return {
            exportedAt: new Date().toISOString(),
            totalIssues: issues.length,
            issues
        };
    }
    _convertRoadmapPhases(phases) {
        const out = [];
        let idx = 0;
        for (const phase of phases || []) {
            if (Array.isArray(phase.tasks) && phase.tasks.length) {
                for (const task of phase.tasks) {
                    out.push({
                        id: 'roadmap-' + (phase.id || idx) + '-' + idx++,
                        severity: ['critical', 'high', 'medium', 'low', 'info'].includes(phase.severity) ? phase.severity : 'medium',
                        type: phase.id || phase.phase || 'phase',
                        category: (phase.title || '').replace(/^Phase \d+:\s*/, '') || phase.id || 'Phase',
                        description: task.description,
                        filePath: task.location || '-',
                        action: task.type === 'fix' ? 'Fix required' : task.type === 'verify' ? 'Verify' : task.type === 'audit' ? 'Audit' : task.type === 'doc' ? 'Document' : 'Review',
                        effort: phase.effort || '20 min',
                        completed: task.done || false
                    });
                }
            }
            else {
                out.push({
                    id: 'roadmap-' + (phase.id || idx) + '-' + idx++,
                    severity: phase.status === 'completed' ? 'info' : phase.status === 'in-progress' ? 'medium' : phase.progress >= 50 ? 'medium' : 'low',
                    type: phase.phase || phase.name || phase.title || 'Phase',
                    category: (phase.title || '').replace(/^Phase \d+:\s*/, '') || phase.phase || 'Phase',
                    description: [phase.description].filter(Boolean).concat(Array.isArray(phase.features) ? ['Features: ' + phase.features.join('; ')] : [], Array.isArray(phase.milestones) ? ['Milestones: ' + phase.milestones.join('; ')] : []).join(' — '),
                    filePath: '-',
                    action: phase.status === 'completed' ? 'Completed' : phase.status === 'in-progress' ? 'In progress' : 'Planned',
                    effort: '—',
                    completed: phase.status === 'completed' || phase.progress >= 100
                });
            }
        }
        return out;
    }
    buildAuditExportPayload() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15;
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete') {
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
            case 'workspace-health':
                results.codebase = scan || null;
                break;
            case 'file-reduction':
                results.fileReduction = scan || null;
                break;
            case 'data-quality':
                results.dataQuality = scan || null;
                break;
            case 'cleanup-assistant': {
                const rebuiltBrief = buildCleanupBriefFromLastResult(this.lastResult, ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.policy) || loadCleanupPolicy());
                results.cleanupAssistant = (_d = rebuiltBrief !== null && rebuiltBrief !== void 0 ? rebuiltBrief : (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.brief) !== null && _d !== void 0 ? _d : null;
                results.fileReduction = fileReduction || null;
                results.dataQuality = dataQuality || null;
                break;
            }
            case 'roadmap':
                results.roadmap = (data === null || data === void 0 ? void 0 : data.roadmap) || null;
                break;
            case 'compliance':
                results.simplebeacon = report || null;
                results.compliance = ((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.checklist) || null;
                break;
            case 'npm-audit':
                results.npmAudit = ((_f = this.lastResult) === null || _f === void 0 ? void 0 : _f.npmAudit) || null;
                break;
            case 'eu-ai-act': {
                const sprint = ((_g = this.lastResult) === null || _g === void 0 ? void 0 : _g.sprint) || {};
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
                simplebeaconGatePass: (_k = (_j = (_h = results.simplebeacon) === null || _h === void 0 ? void 0 : _h.gate) === null || _j === void 0 ? void 0 : _j.pass) !== null && _k !== void 0 ? _k : null,
                simplebeaconIssues: (_q = (_m = (_l = results.simplebeacon) === null || _l === void 0 ? void 0 : _l.issueCount) !== null && _m !== void 0 ? _m : (_p = (_o = results.simplebeacon) === null || _o === void 0 ? void 0 : _o.rawIssues) === null || _p === void 0 ? void 0 : _p.length) !== null && _q !== void 0 ? _q : null,
                consolidationDuplicateGroups: (_t = (_s = (_r = results.consolidation) === null || _r === void 0 ? void 0 : _r.summary) === null || _s === void 0 ? void 0 : _s.exactDuplicateGroups) !== null && _t !== void 0 ? _t : null,
                fictionKpiHits: (_w = (_v = (_u = results.mockScan) === null || _u === void 0 ? void 0 : _u.fictionIssues) === null || _v === void 0 ? void 0 : _v.reduce((sum, i) => sum + (i.count || 1), 0)) !== null && _w !== void 0 ? _w : null,
                roadmapFiles: (_0 = (_z = (_y = (_x = results.roadmap) === null || _x === void 0 ? void 0 : _x.codeAnalysis) === null || _y === void 0 ? void 0 : _y.structure) === null || _z === void 0 ? void 0 : _z.totalFiles) !== null && _0 !== void 0 ? _0 : null,
                codebaseHealthScore: (_3 = (_2 = (_1 = results.codebase) === null || _1 === void 0 ? void 0 : _1.summary) === null || _2 === void 0 ? void 0 : _2.healthScore) !== null && _3 !== void 0 ? _3 : null,
                codebaseFindings: (_6 = (_5 = (_4 = results.codebase) === null || _4 === void 0 ? void 0 : _4.summary) === null || _5 === void 0 ? void 0 : _5.findingsTotal) !== null && _6 !== void 0 ? _6 : null,
                fileReductionFindings: (_9 = (_8 = (_7 = results.fileReduction) === null || _7 === void 0 ? void 0 : _7.summary) === null || _8 === void 0 ? void 0 : _8.totalFindings) !== null && _9 !== void 0 ? _9 : null,
                fileReductionReclaimableBytes: (_12 = (_11 = (_10 = results.fileReduction) === null || _10 === void 0 ? void 0 : _10.summary) === null || _11 === void 0 ? void 0 : _11.reclaimableBytes) !== null && _12 !== void 0 ? _12 : null,
                dataQualityFindings: (_15 = (_14 = (_13 = results.dataQuality) === null || _13 === void 0 ? void 0 : _13.summary) === null || _14 === void 0 ? void 0 : _14.totalFindings) !== null && _15 !== void 0 ? _15 : null
            },
            completeScanAnalysis,
            enrichedAt: new Date().toISOString(),
            results
        };
        if (this.scanExportHasPayload(payload))
            return payload;
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const sprint = (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.sprint;
        if (sprint === null || sprint === void 0 ? void 0 : sprint.report)
            return sprint.report;
        if ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.report)
            return this.lastResult.report;
        if (((_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.kind) === 'simplebeacon-report') {
            return (_d = this.lastResult.report) !== null && _d !== void 0 ? _d : null;
        }
        if (((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.kind) === 'complete') {
            return (_g = (_f = this.getCompleteStep('simplebeacon')) === null || _f === void 0 ? void 0 : _f.report) !== null && _g !== void 0 ? _g : null;
        }
        return ((_h = this.app.scanService) === null || _h === void 0 ? void 0 : _h.report) || ((_j = this.app.state) === null || _j === void 0 ? void 0 : _j.report) || null;
    }
    buildGateOnlyAuditPayload(report, { projectPath, scanKind = 'simplebeacon-report', compliance = null } = {}) {
        var _a, _b, _c, _d, _e;
        if (!report || typeof report !== 'object')
            return null;
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
                simplebeaconGatePass: (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : null,
                simplebeaconIssues: (_e = (_c = report.issueCount) !== null && _c !== void 0 ? _c : (_d = report.rawIssues) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : null
            },
            completeScanAnalysis: buildCompleteScanAnalysis({ projectPath: projectPath || report.projectRoot }),
            enrichedAt: new Date().toISOString(),
            results
        };
    }
    async ensureAuditExportPayload() {
        var _a, _b, _c;
        let payload = this.buildAuditExportPayload();
        if (this.scanExportHasPayload(payload))
            return payload;
        try {
            const projectPath = this.getActiveProjectPath() || ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath) || null;
            const report = await this.app.scanService.fetchReport(projectPath || undefined);
            payload = this.buildGateOnlyAuditPayload(report, {
                projectPath: projectPath || (report === null || report === void 0 ? void 0 : report.projectRoot) || ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath),
                scanKind: ((_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.kind) || 'simplebeacon-report'
            });
        }
        catch (_d) {
            /* ignore */
        }
        return payload;
    }
    scanExportHasPayload(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        if (payload.results && Object.values(payload.results).some(Boolean))
            return true;
        if (Array.isArray(payload.steps) && payload.steps.length > 0)
            return true;
        if (payload.summary && Object.keys(payload.summary).length > 0)
            return true;
        return Object.keys(payload).length > 0;
    }
    applyReport(report, label, options = {}) {
        this.app.state.report = report;
        this.app.scanService.report = report;
        const projectPath = options.projectPath || this.app.state.lastProjectPath || report.projectPath || report.projectRoot || report.platformRoot || '';
        this.lastResult = {
            kind: 'simplebeacon-report',
            report,
            projectPath,
            label,
            conclusion: options.conclusion || buildScanConclusion(report)
        };
        this.app.state.analyzeResult = this.lastResult;
        showToast(label, 'success');
        this._notifyVscodeSidebar(report);
        if (!options.skipRefresh) {
            this.refresh();
        }
    }
    resolveResultsReport() {
        var _a, _b, _c, _d, _e, _f;
        if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete') {
            return (_c = (_b = this.getCompleteStep('simplebeacon')) === null || _b === void 0 ? void 0 : _b.report) !== null && _c !== void 0 ? _c : this.app.state.report;
        }
        if ((_d = this.lastResult) === null || _d === void 0 ? void 0 : _d.report) {
            return this.lastResult.report;
        }
        if (((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.kind) === 'simplebeacon-report') {
            return (_f = this.lastResult.report) !== null && _f !== void 0 ? _f : this.app.state.report;
        }
        return this.app.state.report;
    }
    buildAnalyzerSuiteContext() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const report = this.resolveResultsReport();
        const lr = this.lastResult || {};
        const scan = lr.scan || ((_a = this.getCompleteStep('codebase')) === null || _a === void 0 ? void 0 : _a.scan) || ((_b = this.getCompleteStep('consolidation')) === null || _b === void 0 ? void 0 : _b.scan);
        const rawIssues = ((_d = (_c = report === null || report === void 0 ? void 0 : report.rawIssues) !== null && _c !== void 0 ? _c : report === null || report === void 0 ? void 0 : report.detectedIssues) !== null && _d !== void 0 ? _d : []).slice(0, 50);
        const aiSummary = String((report === null || report === void 0 ? void 0 : report.aiSummary)
            || (scan === null || scan === void 0 ? void 0 : scan.aiSummary)
            || lr.conclusion
            || ((_e = report === null || report === void 0 ? void 0 : report.summary) === null || _e === void 0 ? void 0 : _e.headline)
            || '').trim();
        const backlogSnippet = rawIssues
            .slice(0, 8)
            .map((issue) => String(issue.description || issue.message || issue.type || '').trim())
            .filter(Boolean)
            .join('. ');
        const codeFindings = ((scan === null || scan === void 0 ? void 0 : scan.findings) || [])
            .filter((finding) => (finding === null || finding === void 0 ? void 0 : finding.snippet) || (finding === null || finding === void 0 ? void 0 : finding.message) || (finding === null || finding === void 0 ? void 0 : finding.path))
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
        if ((_f = scan === null || scan === void 0 ? void 0 : scan.eslintSummary) === null || _f === void 0 ? void 0 : _f.totalIssues) {
            logLines.push(`ESLint total issues: ${scan.eslintSummary.totalIssues}`);
        }
        const logs = logLines.join('\n');
        const fileReduction = lr.fileReduction || ((_g = this.getCompleteStep('file-reduction')) === null || _g === void 0 ? void 0 : _g.scan) || null;
        const dataQuality = lr.dataQuality || ((_h = this.getCompleteStep('data-quality')) === null || _h === void 0 ? void 0 : _h.scan) || null;
        const scalabilityNotes = [];
        if (fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.durationMs) {
            scalabilityNotes.push(`File reduction dry-run benchmark completed in ${fileReduction.durationMs}ms across ${(_k = (_j = fileReduction.inventory) === null || _j === void 0 ? void 0 : _j.totalFiles) !== null && _k !== void 0 ? _k : 'unknown'} files.`);
        }
        if (dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.durationMs) {
            scalabilityNotes.push(`Data quality scan completed in ${dataQuality.durationMs}ms.`);
        }
        if ((fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.cacheHit) || (dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.cacheHit)) {
            scalabilityNotes.push('Repeat cleanup scans served from caching layer.');
        }
        scalabilityNotes.push('Dashboard data-cleanup API uses TTL caching for repeat scan profiles.');
        const responseText = [
            aiSummary || backlogSnippet,
            ...scalabilityNotes,
            String(lr.conclusion || '').trim()
        ].filter(Boolean).join(' ');
        const metrics = {
            ...(((_l = scan === null || scan === void 0 ? void 0 : scan.summary) === null || _l === void 0 ? void 0 : _l.throughputRps) ? { throughputRps: scan.summary.throughputRps } : {}),
            ...(((_m = scan === null || scan === void 0 ? void 0 : scan.summary) === null || _m === void 0 ? void 0 : _m.p95LatencyMs) ? { p95LatencyMs: scan.summary.p95LatencyMs } : {}),
            ...((fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.durationMs) ? { scanDurationMs: fileReduction.durationMs } : {}),
            ...((dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.durationMs) ? { dataQualityScanDurationMs: dataQuality.durationMs } : {})
        };
        return {
            inputKind: 'scan-report',
            scanReportContext: true,
            report,
            healthScore: report === null || report === void 0 ? void 0 : report.qualityScore,
            scannedAt: report === null || report === void 0 ? void 0 : report.generatedAt,
            responseText,
            aiSummary,
            backlogSnippet,
            conclusion: String(lr.conclusion || '').trim(),
            scanSummary: String(((_o = report === null || report === void 0 ? void 0 : report.summary) === null || _o === void 0 ? void 0 : _o.headline) || '').trim(),
            prompt: String(lr.prompt || (report === null || report === void 0 ? void 0 : report.prompt) || '').trim(),
            codeText,
            logs,
            rawIssues,
            scanIssues: rawIssues,
            scan,
            fileReduction,
            dataQuality,
            codeUnderstanding: scan === null || scan === void 0 ? void 0 : scan.codeUnderstanding,
            zscriptReport: scan === null || scan === void 0 ? void 0 : scan.zscriptReport,
            benchmarks: ((_p = lr.data) === null || _p === void 0 ? void 0 : _p.benchmarks) || (report === null || report === void 0 ? void 0 : report.benchmarks),
            metrics: Object.keys(metrics).length ? metrics : undefined,
            traces: lr.traces,
            datasetSamples: lr.datasetSamples,
            errorCases: lr.errorCases,
            subgroupOutcomes: lr.subgroupOutcomes,
            claims: lr.claims
        };
    }
    prepareReportForResults(report, options = {}) {
        var _a;
        return preparePlatformResultsReport(report, options.projectPath || ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath) || (report === null || report === void 0 ? void 0 : report.projectRoot), options);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        if (!this.lastResult && this.app.state.analyzeResult) {
            this.lastResult = this.app.state.analyzeResult;
        }
        if (!this.lastResult) {
            return this.renderEmptyState();
        }
        const pathInput = (_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#project-path-input');
        const activePath = this.getActiveProjectPath(pathInput === null || pathInput === void 0 ? void 0 : pathInput.value);
        // Local scans only know the folder basename, but lastResult.projectPath can hold the full
        // path the user typed/browsed. Prefer that for the mismatch check.
        const scannedRoot = this.lastResult.projectPath || ((this.lastResult.report) === null || this.lastResult.report === void 0 ? void 0 : this.lastResult.report.projectRoot) || '';
        if (activePath && scannedRoot && !reportMatchesPagePath({ projectRoot: scannedRoot }, activePath)) {
            return `
        ${renderEmptyState({
                icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
                title: 'Path mismatch',
                body: `Results below are for a different folder than the path above. Run analysis again to scan <code>${escapeHtml(formatPathInputValue(activePath))}</code>.`
            })}
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
            ${report.fictionJsonFilesScanned != null ? `<div class="metric-chip" title="JSON files pattern-scanned for fictional KPIs"><strong>${formatNumber(report.fictionJsonFilesScanned)}</strong> JSON scanned</div>` : ''}
            ${report.fictionSampleFilesScanned != null ? `<div class="metric-chip"><strong>${formatNumber(report.fictionSampleFilesScanned)}</strong> *-sample.json</div>` : ''}
            ${this.renderScanFileMetrics(report)}
            <div class="metric-chip gate-badge ${((_b = report.gate) === null || _b === void 0 ? void 0 : _b.pass) ? 'pass' : 'warn'}">${((_c = report.gate) === null || _c === void 0 ? void 0 : _c.pass) ? 'PASS' : 'REVIEW'}</div>
          </div>
          <div id="inline-issue-list"></div>
        </div>
      `);
        }
        if (kind === 'simplebeacon-report' || isSimplebeaconReport(report)) {
            const r = report || this.lastResult.report;
            const rawIssues = r.rawIssues || r.detectedIssues || [];
            return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Scan results')}</h2>
          </div>
          ${this.renderScanScopeBanner(r, projectPath)}
          ${this.renderScanSummary(r, conclusion || buildScanConclusion(r))}
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${(_d = r.qualityScore) !== null && _d !== void 0 ? _d : '—'}%</strong> quality</div>
            ${this.renderScanFileMetrics(r)}
            <div class="metric-chip gate-badge ${((_e = r.gate) === null || _e === void 0 ? void 0 : _e.pass) ? 'pass' : 'warn'}">${((_f = r.gate) === null || _f === void 0 ? void 0 : _f.pass) ? 'PASS' : 'REVIEW'}</div>
          </div>
          ${this.renderIssueFilterToolbar(rawIssues)}
          <div id="inline-issue-list"></div>
          ${r.fileNaming ? `
            <div class="card mb-4">
              <div class="section-heading"><h3>File Naming Analysis</h3></div>
              ${this.renderFileNamingPanel(r.fileNaming)}
            </div>
          ` : ''}
          ${r.removableFiles ? `
            <div class="card mb-4">
              <div class="section-heading"><h3>Removable Files Analysis</h3></div>
              ${this.renderRemovableFilesPanel(r.removableFiles)}
            </div>
          ` : ''}
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
            const healthSection = kind === 'file-reduction' ? this.renderFileReductionHealthSection() : '';
            return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || title)}</h2>
          </div>
          ${renderDataCleanupPanel({ scan: this.lastResult.scan, profile: this.lastResult.profile || kind })}
          ${this.renderScanSummary(this.lastResult.scan, conclusion || buildDataCleanupConclusion(this.lastResult.scan, kind), `${title} — dry-run scanners, not a compliance gate`)}
        </div>
        ${healthSection}
      `);
        }
        if (kind === 'removable-files' && this.lastResult.scan) {
            return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Removable files')}</h2>
          </div>
          ${this.renderRemovableFilesPanel(this.lastResult.scan)}
          ${this.renderScanSummary(this.lastResult.scan, conclusion || this.lastResult.scan.summary || '', 'Removable files — safe-to-delete directories and files')}
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
          ${this.renderScanSummary(this.lastResult.fileReduction, conclusion || this.lastResult.conclusion, 'Cleanup assistant — phase 1 deletes safe directories only; attach JSON for Cursor agent mode')}
        </div>
      `);
        }
        if (kind === 'workspace-health' && this.lastResult.scan) {
            return this.wrapAnalyzeResults(`
        <div class="section-block">
          <div class="section-heading">
            <h2>${escapeHtml(label || 'Workspace health')}</h2>
          </div>
          ${renderCodebasePanel({ scan: this.lastResult.scan })}
          ${this.renderScanSummary(this.lastResult.scan, conclusion || `Workspace health scan complete — ${(this.lastResult.scan.findings || []).length} finding(s).`, 'Workspace health — circular imports, mismatched dependency versions, barrel-file anti-patterns')}
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
          ${this.renderScanSummary(this.lastResult.scan, conclusion || buildCodebaseConclusion(this.lastResult.scan), 'Codebase analysis — technical debt, broken files, placeholders')}
        </div>
        ${this.renderCodebaseHealthSection()}
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
            <strong>${((_g = r === null || r === void 0 ? void 0 : r.gate) === null || _g === void 0 ? void 0 : _g.pass) ? 'PASS' : 'REVIEW'}</strong>
            · ${(_h = r === null || r === void 0 ? void 0 : r.issueCount) !== null && _h !== void 0 ? _h : 0} issue groups
          </p>
          ${renderComplianceChecklistPanel(this.lastResult.checklist)}
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
          ${this.renderScanSummary(this.lastResult.npmAudit, conclusion || this.lastResult.conclusion, 'Supply-chain audit — not a Simplebeacon gate substitute')}
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
        if (kind === 'roadmap' && (data === null || data === void 0 ? void 0 : data.roadmap)) {
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
          <p class="mb-4 text-muted">${escapeHtml(((_j = roadmap.executiveSummary) === null || _j === void 0 ? void 0 : _j.notes) || roadmap.summary || roadmap.title || 'Generated from filesystem scan')}</p>
          ${roadmap.platformRoot && roadmap.sourceProjectPath && roadmap.platformRoot !== roadmap.sourceProjectPath ? `
            <p class="roadmap-path-hint mb-4 text-muted">
              Scanned <code>${escapeHtml(formatPathInputValue(roadmap.sourceProjectPath))}</code> —
              sprint metrics use platform root <code>${escapeHtml(formatPathInputValue(roadmap.platformRoot))}</code>.
              For a tighter scan, set the path to the platform folder.
            </p>
          ` : ''}
          <div class="metrics-row mb-4">
            <div class="metric-chip"><strong>${(_k = summary.totalFeatures) !== null && _k !== void 0 ? _k : '—'}</strong> sprints</div>
            <div class="metric-chip"><strong>${(_l = summary.completionRate) !== null && _l !== void 0 ? _l : '—'}%</strong> complete</div>
            <div class="metric-chip"><strong>${escapeHtml(summary.projectHealth || '—')}</strong> health</div>
            <div class="metric-chip"><strong>${(_p = (_o = (_m = roadmap.codeAnalysis) === null || _m === void 0 ? void 0 : _m.structure) === null || _o === void 0 ? void 0 : _o.totalFiles) !== null && _p !== void 0 ? _p : '—'}</strong> files scanned</div>
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28;
        const { projectPath, steps = [], errors = [] } = this.lastResult;
        const simplebeacon = (_a = steps.find((s) => s.id === 'simplebeacon')) === null || _a === void 0 ? void 0 : _a.report;
        const canonicalCount = simplebeacon ? getScanFileMetrics(simplebeacon).repositoryFiles : null;
        const consolidation = (_b = steps.find((s) => s.id === 'consolidation')) === null || _b === void 0 ? void 0 : _b.scan;
        const mockScan = steps.find((s) => s.id === 'mock-scan');
        const roadmapStep = steps.find((s) => s.id === 'roadmap');
        const roadmap = (roadmapStep === null || roadmapStep === void 0 ? void 0 : roadmapStep.roadmap) || ((_c = roadmapStep === null || roadmapStep === void 0 ? void 0 : roadmapStep.data) === null || _c === void 0 ? void 0 : _c.roadmap);
        const codebaseStep = steps.find((s) => s.id === 'codebase');
        const codebase = codebaseStep === null || codebaseStep === void 0 ? void 0 : codebaseStep.scan;
        const fileReduction = (_d = steps.find((s) => s.id === 'file-reduction')) === null || _d === void 0 ? void 0 : _d.scan;
        const dataQuality = (_e = steps.find((s) => s.id === 'data-quality')) === null || _e === void 0 ? void 0 : _e.scan;
        const removableFiles = (_f = steps.find((s) => s.id === 'removable-files')) === null || _f === void 0 ? void 0 : _f.scan;
        const cleanupStep = steps.find((s) => s.id === 'cleanup-assistant');
        const cleanupBrief = (_g = cleanupStep === null || cleanupStep === void 0 ? void 0 : cleanupStep.brief) !== null && _g !== void 0 ? _g : null;
        const complianceStep = steps.find((s) => s.id === 'compliance');
        const gateForChecklist = pickFreshGateReport(simplebeacon, this.app.state.report);
        const complianceChecklist = reconcileComplianceWithGate((_h = complianceStep === null || complianceStep === void 0 ? void 0 : complianceStep.checklist) !== null && _h !== void 0 ? _h : null, gateForChecklist);
        const npmAuditStep = steps.find((s) => s.id === 'npm-audit');
        const npmAudit = (_j = npmAuditStep === null || npmAuditStep === void 0 ? void 0 : npmAuditStep.npmAudit) !== null && _j !== void 0 ? _j : null;
        const euAiActStep = steps.find((s) => s.id === 'eu-ai-act');
        const euSprint = (_k = euAiActStep === null || euAiActStep === void 0 ? void 0 : euAiActStep.sprint) !== null && _k !== void 0 ? _k : null;
        const { enginesRun, planned: stepTotal, succeeded: succeededCount, failed: failedCount } = resolveCompleteScanCounts(this.lastResult);
        const completeScanAnalysis = buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath });
        /**
         * Step ok.
         * @param {string} id
         * @returns {any}
         */
        const stepOk = (id) => steps.some((s) => s.id === id);
        /**
         * Step failure message.
         * @param {string} id
         * @param {any} labelHint
         * @returns {any}
         */
        const stepFailureMessage = (id, labelHint) => {
            var _a, _b, _c;
            const progressErr = (_c = (_b = (_a = this.completeProgress) === null || _a === void 0 ? void 0 : _a.steps) === null || _b === void 0 ? void 0 : _b.find((s) => s.id === id)) === null || _c === void 0 ? void 0 : _c.error;
            if (progressErr)
                return progressErr;
            const match = errors.find((e) => { var _a; return (_a = e.step) === null || _a === void 0 ? void 0 : _a.includes(labelHint); });
            return (match === null || match === void 0 ? void 0 : match.message) || '';
        };
        /**
         * Render step failure.
         * @param {string} id
         * @param {any} labelHint
         * @returns {any}
         */
        const renderStepFailure = (id, labelHint) => {
            const message = stepFailureMessage(id, labelHint);
            if (message) {
                return `<p class="text-muted mt-4" style="color: var(--warning-color, #f59e0b);">${escapeHtml(message)}</p>`;
            }
            return '<p class="text-muted mt-4">Step did not complete.</p>';
        };
        const locked = this.isResultsLocked();
        const checkoutUrl = ((_m = (_l = this.app.billingService) === null || _l === void 0 ? void 0 : _l.getAuditCheckoutUrl) === null || _m === void 0 ? void 0 : _m.call(_l)) || null;
        const priceLabel = ((_p = (_o = this.app.billingService) === null || _o === void 0 ? void 0 : _o.plan) === null || _p === void 0 ? void 0 : _p.auditPriceLabel) || '$499';
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
          <div class="metric-chip gate-badge ${((_q = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.gate) === null || _q === void 0 ? void 0 : _q.pass) ? 'pass' : 'warn'}">${((_r = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.gate) === null || _r === void 0 ? void 0 : _r.pass) ? 'GATE PASS' : 'GATE REVIEW'}</div>
          ${((_s = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.gate) === null || _s === void 0 ? void 0 : _s.pass) && ((_t = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _t === void 0 ? void 0 : _t.codeFilesAnalyzed)
            ? '<div class="metric-chip gate-badge pass">READY FOR SIGN-OFF</div>'
            : ''}
          <div class="metric-chip"><strong>${(_v = (_u = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _u === void 0 ? void 0 : _u.codeFilesAnalyzed) !== null && _v !== void 0 ? _v : '—'}/${(_x = (_w = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _w === void 0 ? void 0 : _w.codeFilesDiscovered) !== null && _x !== void 0 ? _x : '—'}</strong> code files</div>
          <div class="metric-chip"><strong>${(_z = (_y = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _y === void 0 ? void 0 : _y.healthScore) !== null && _z !== void 0 ? _z : '—'}%</strong> code health</div>
          <div class="metric-chip"><strong>${(_1 = (_0 = consolidation === null || consolidation === void 0 ? void 0 : consolidation.summary) === null || _0 === void 0 ? void 0 : _0.exactDuplicateGroups) !== null && _1 !== void 0 ? _1 : '—'}</strong> dup groups</div>
          <div class="metric-chip"><strong>${((_3 = (_2 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) === null || _2 === void 0 ? void 0 : _2.totals) === null || _3 === void 0 ? void 0 : _3.estimatedImmediateSavingsBytes) != null ? formatCompleteScanBytes(fileReduction.fileReductionPlan.totals.estimatedImmediateSavingsBytes) : formatNumber((_4 = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.summary) === null || _4 === void 0 ? void 0 : _4.totalFindings)}</strong> ${(fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan) ? 'immediate savings' : 'file reduction'}</div>
          <div class="metric-chip"><strong>${formatNumber((_7 = (_6 = (_5 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) === null || _5 === void 0 ? void 0 : _5.security) === null || _6 === void 0 ? void 0 : _6.piiNeedingReview) !== null && _7 !== void 0 ? _7 : (_8 = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.summary) === null || _8 === void 0 ? void 0 : _8.totalFindings)}</strong> ${(dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary) ? 'PII review' : 'data quality'}</div>
          ${cleanupBrief ? `<div class="metric-chip"><strong>${formatNumber((_9 = cleanupBrief.estimatedReduction) === null || _9 === void 0 ? void 0 : _9.files)}</strong> safe cleanup files</div>` : ''}
          ${(complianceChecklist === null || complianceChecklist === void 0 ? void 0 : complianceChecklist.summary) ? `<div class="metric-chip gate-badge ${complianceChecklist.summary.failed ? 'warn' : 'pass'}">${(_10 = complianceChecklist.summary.passed) !== null && _10 !== void 0 ? _10 : 0}/${checklistRuleTotal(complianceChecklist)} compliance</div>` : ''}
          ${npmAudit && !npmAudit.error ? `<div class="metric-chip"><strong>${(_13 = (_12 = (_11 = npmAudit.summary) === null || _11 === void 0 ? void 0 : _11.total) !== null && _12 !== void 0 ? _12 : npmAudit.vulnerabilityTotal) !== null && _13 !== void 0 ? _13 : 0}</strong> npm vulns</div>` : ''}
          ${euSprint ? `<div class="metric-chip gate-badge ${((_14 = euSprint.gate) === null || _14 === void 0 ? void 0 : _14.pass) ? 'pass' : 'warn'}">EU ${(_16 = (_15 = euSprint.compliance) === null || _15 === void 0 ? void 0 : _15.score) !== null && _16 !== void 0 ? _16 : '—'}% readiness</div>` : ''}
          ${((_17 = removableFiles === null || removableFiles === void 0 ? void 0 : removableFiles.categories) === null || _17 === void 0 ? void 0 : _17.length) ? `<div class="metric-chip"><strong>${escapeHtml(removableFiles.totalRemovableFormatted || '0 B')}</strong> reclaimable</div>` : ''}
        </div>

        ${renderCompleteScanAnalysisPanel(completeScanAnalysis)}

        ${locked ? renderScanPaywall(this.lastResult.publicSummary || buildPublicSummaryFromScan(this.lastResult), { checkoutUrl, auditPriceLabel: priceLabel }) : `
        <details class="card mb-4" open>
          <summary><strong>1. Simplebeacon</strong> ${stepOk('simplebeacon') ? '✅' : '⚠️'}</summary>
          ${simplebeacon ? `
            ${this.renderScanScopeBanner(simplebeacon, projectPath)}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${(_18 = simplebeacon.qualityScore) !== null && _18 !== void 0 ? _18 : '—'}%</strong> quality</div>
              ${this.renderScanFileMetrics(simplebeacon, canonicalCount)}
              <div class="metric-chip"><strong>${(_19 = simplebeacon.issueCount) !== null && _19 !== void 0 ? _19 : 0}</strong> issues</div>
              ${simplebeacon.llmSlopPatternHits != null ? `<div class="metric-chip"><strong>${simplebeacon.llmSlopPatternHits}</strong> LLM slop hits</div>` : ''}
            </div>
            ${((_20 = getScanFileMetrics(simplebeacon).mockSampleFiles) !== null && _20 !== void 0 ? _20 : 0) === 0 ? `
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
          ${(mockScan === null || mockScan === void 0 ? void 0 : mockScan.report) ? `
            ${this.renderConclusionBanner(mockScan.conclusion || buildScanConclusion(mockScan.report, { focus: 'fiction' }), mockScan.report.fictionScope === 'repository-json'
            ? `Derived from step 1 — ${formatNumber((_22 = (_21 = mockScan.report.fictionJsonFilesScanned) !== null && _21 !== void 0 ? _21 : mockScan.report.consistencyChecked) !== null && _22 !== void 0 ? _22 : '—')} repository JSON files fiction-scanned`
            : 'Derived from step 1 Simplebeacon scan — *-sample.json only')}
            ${(mockScan.nonFictionIssues || []).length ? `
              <p class="text-muted text-sm mb-4">
                ${formatNumber((mockScan.nonFictionIssues || []).reduce((s, i) => s + (i.count || 1), 0))} non-fiction gate finding(s) in step 1
                (${(mockScan.nonFictionIssues || []).map((i) => i.type).slice(0, 3).join(', ')}) — see Simplebeacon section above.
              </p>
            ` : ''}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${(mockScan.fictionIssues || []).reduce((s, i) => s + (i.count || 1), 0)}</strong> fiction/KPI hits</div>
              ${this.renderScanFileMetrics(mockScan.report, canonicalCount)}
            </div>
            <button type="button" class="btn btn-secondary btn-sm mb-4" id="download-mock-scan-json">Download fiction digest JSON</button>
          ` : '<p class="text-muted mt-4">Step did not complete.</p>'}
        </details>

        <details class="card mb-4">
          <summary><strong>4. Roadmap</strong> ${stepOk('roadmap') ? '✅' : '⚠️'}</summary>
          ${roadmap ? `
            ${(roadmapStep === null || roadmapStep === void 0 ? void 0 : roadmapStep.analysisPath) && normalizeProjectPath(roadmapStep.analysisPath) !== normalizeProjectPath(projectPath) ? `
              <p class="text-muted text-sm mt-4 mb-0">Scoped to platform root <code>${escapeHtml(formatPathInputValue(roadmapStep.analysisPath))}</code> (monorepo parent scan).</p>
            ` : ''}
            <div class="metrics-row mb-4 mt-4">
              <div class="metric-chip"><strong>${(_25 = canonicalCount !== null && canonicalCount !== void 0 ? canonicalCount : (_24 = (_23 = roadmap.codeAnalysis) === null || _23 === void 0 ? void 0 : _23.structure) === null || _24 === void 0 ? void 0 : _24.totalFiles) !== null && _25 !== void 0 ? _25 : '—'}</strong> files</div>
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
            ${(codebaseStep === null || codebaseStep === void 0 ? void 0 : codebaseStep.analysisPath) && normalizeProjectPath(codebaseStep.analysisPath) !== normalizeProjectPath(projectPath) ? `
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
            ${renderCleanupAssistantPanel(cleanupBrief, { policy: (cleanupStep === null || cleanupStep === void 0 ? void 0 : cleanupStep.policy) || loadCleanupPolicy() })}
            ${this.renderScanSummary((cleanupStep === null || cleanupStep === void 0 ? void 0 : cleanupStep.fileReduction) || fileReduction, `Tiered cleanup — ${Number(((_26 = cleanupBrief.estimatedReduction) === null || _26 === void 0 ? void 0 : _26.files) || 0).toLocaleString()} files safe now (${formatCompleteScanBytes((_27 = cleanupBrief.estimatedReduction) === null || _27 === void 0 ? void 0 : _27.bytes)}), ${Number(((_28 = cleanupBrief.projectedInventory) === null || _28 === void 0 ? void 0 : _28.totalFiles) || 0).toLocaleString()} projected after phase 1.`, 'Cleanup assistant — export agent brief for Cursor; phase 1 deletes safe directories only')}
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

        ${(simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.fileNaming) ? `
        <details class="card mb-4">
          <summary><strong>File Naming Analysis</strong></summary>
          <div class="mt-4">
            ${this.renderFileNamingPanel(simplebeacon.fileNaming)}
          </div>
        </details>
        ` : ''}

        ${removableFiles ? `
        <details class="card mb-4">
          <summary><strong>Removable Files</strong> ${stepOk('removable-files') ? '✅' : '⚠️'}</summary>
          <div class="mt-4">
            ${this.renderRemovableFilesPanel(removableFiles)}
          </div>
        </details>
        ` : ''}

        ${steps.filter((s) => BROWSER_ANALYZER_IDS.includes(s.id)).map((s) => renderBrowserAnalyzerResult(s, errors)).join('')}

        `}
      </div>
    `;
    }
    renderFileNamingPanel(fileNaming) {
        if (!fileNaming || !fileNaming.findings || fileNaming.findings.length === 0) {
            return '<p class="text-muted">No file naming issues detected.</p>';
        }
        const items = fileNaming.findings.slice(0, 10).map((f) => `
      <div class="issue-row" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="badge badge-${f.severity === 'medium' ? 'warn' : 'info'}">${escapeHtml(f.severity)}</span>
          <strong>${escapeHtml(f.type)}</strong>
        </div>
        <div class="text-muted text-sm mt-1">${escapeHtml(f.file)}</div>
        ${f.detail ? `<div class="text-sm mt-1">${escapeHtml(f.detail)}</div>` : ''}
        ${f.suggestion ? `<div class="text-sm mt-1" style="color:var(--success);">Suggestion: ${escapeHtml(typeof f.suggestion === 'string' ? f.suggestion : JSON.stringify(f.suggestion))}</div>` : ''}
      </div>
    `).join('');
        const styleStats = fileNaming.styleStats || {};
        const statsHtml = Object.entries(styleStats).filter(([, v]) => v > 0).map(([k, v]) => `<span class="metric-chip"><strong>${v}</strong> ${escapeHtml(k)}</span>`).join('');
        return `
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${fileNaming.hits}</strong> naming issues</div>
        ${statsHtml}
      </div>
      <div class="issue-list">${items}</div>
    `;
    }
    renderRemovableFilesPanel(removableFiles) {
        if (!removableFiles || !removableFiles.categories || removableFiles.categories.length === 0) {
            return '<p class="text-muted">No removable files detected.</p>';
        }
        const cats = removableFiles.categories;
        const items = cats.slice(0, 10).map((c) => `
      <div class="issue-row" style="padding:0.5rem 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span class="badge badge-warn">removable</span>
          <strong>${escapeHtml(c.label || c.category)}</strong>
        </div>
        <div class="text-muted text-sm mt-1">${(c.count || 0).toLocaleString()} items${c.sizeLabel ? ' (' + escapeHtml(c.sizeLabel) + ')' : c.bytes ? ' (' + this._fmtBytes(c.bytes) + ')' : ''}</div>
        <div class="text-sm mt-1">${escapeHtml(c.action || 'Review before deleting')}</div>
        ${c.examples && c.examples.length ? `<div class="text-sm mt-1 text-muted">Examples: ${escapeHtml(c.examples.slice(0, 3).join(', '))}</div>` : ''}
      </div>
    `).join('');
        return `
      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${cats.length}</strong> categories</div>
        <div class="metric-chip"><strong>${removableFiles.totalFiles || 0}</strong> files</div>
        <div class="metric-chip"><strong>${escapeHtml(removableFiles.totalRemovableFormatted || '0 B')}</strong> reclaimable</div>
      </div>
      <div class="issue-list">${items}</div>
    `;
    }
    _fmtBytes(bytes) {
        if (!bytes || bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    refresh() {
        var _a;
        if (this.app.currentView !== this)
            return;
        // During active scanning, avoid full mount flicker by surgically updating
        // the progress DOM — but only if the progress panel already exists.
        // The first refresh while busy still does a full mount so the progress UI renders.
        if (this.busy && ((_a = this._root) === null || _a === void 0 ? void 0 : _a.querySelector('#analyze-progress'))) {
            this.updateProgressDom();
            return;
        }
        const main = document.getElementById('app-main');
        const savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        try {
            this.mount(main);
        }
        catch (err) {
            console.error('AnalyzeView mount error:', err);
            showToast('Scan UI failed to update. See console.', 'error');
            return;
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScrollY);
            });
        });
    }
    async ensureDefaultProjectPath() {
        if (this.app.state.lastProjectPath || this.app.state.defaultProjectPath)
            return;
        try {
            const info = await fetchAnalyzeProviders();
            if (info.defaultProjectPath) {
                this.app.state.defaultProjectPath = info.defaultProjectPath;
            }
        }
        catch (_a) {
            /* optional prefill */
        }
    }
    mount(container) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
        const mode = (_a = this.app.state.routeParams) === null || _a === void 0 ? void 0 : _a.mode;
        if (mode) {
            this.analysisType = mode;
        }
        if (this.app.state.lastProjectPath && !isPlausibleProjectPath(this.app.state.lastProjectPath)) {
            this.app.state.lastProjectPath = '';
        }
        void this.ensureDefaultProjectPath();
        // If lastProjectPath is the parent directory of defaultProjectPath (monorepo root),
        // clear it so the user picks a specific project instead of scanning everything.
        const defaultPath = this.app.state.defaultProjectPath || '';
        const lastPath = this.app.state.lastProjectPath || '';
        if (defaultPath && lastPath) {
            const defaultParent = defaultPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
            const normalizedLast = lastPath.replace(/\\/g, '/');
            if (normalizedLast === defaultParent) {
                this.app.state.lastProjectPath = '';
            }
        }
        // Auto-load saved complete scan if no result is present
        if (!this.lastResult && !this.app.state.analyzeResult) {
            void this.tryAutoLoadCompleteScan();
        }
        container.innerHTML = '';
        const view = this.render();
        const el = view;
        container.appendChild(view);
        (_b = view.querySelector('#goto-results-btn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', () => {
            this.openResultsView();
        });
        (_c = view.querySelector('#goto-results-empty-btn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', () => {
            this.openResultsView();
        });
        (_d = view.querySelector('#quick-rescan-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
            var _a;
            const path = this.resolveProjectPath((_a = document.getElementById('project-path-input')) === null || _a === void 0 ? void 0 : _a.value)
                || this.app.state.defaultProjectPath;
            if (!path) {
                showToast('No project path available', 'error');
                return;
            }
            this.analysisType = 'complete';
            saveAnalyzePrefs({ analysisType: 'complete', aiProvider: this.aiProvider, roadmapInsightsMode: this.roadmapInsightsMode });
            this.runPathAnalysis(path);
        });
        const slug = pathToFileSlug((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.projectPath);
        const roadmap = ((_f = this.lastResult) === null || _f === void 0 ? void 0 : _f.kind) === 'roadmap'
            ? (_g = this.lastResult.data) === null || _g === void 0 ? void 0 : _g.roadmap
            : ((_h = this.lastResult) === null || _h === void 0 ? void 0 : _h.kind) === 'complete'
                ? ((_j = this.getCompleteStep('roadmap')) === null || _j === void 0 ? void 0 : _j.roadmap)
                    || ((_l = (_k = this.getCompleteStep('roadmap')) === null || _k === void 0 ? void 0 : _k.data) === null || _l === void 0 ? void 0 : _l.roadmap)
                : null;
        const simplebeaconReport = ((_m = this.lastResult) === null || _m === void 0 ? void 0 : _m.kind) === 'complete'
            ? (_o = this.getCompleteStep('simplebeacon')) === null || _o === void 0 ? void 0 : _o.report
            : ((_p = this.lastResult) === null || _p === void 0 ? void 0 : _p.kind) === 'mock-scan'
                ? this.lastResult.report
                : (_q = this.lastResult) === null || _q === void 0 ? void 0 : _q.report;
        (_r = view.querySelector('#download-scan-result')) === null || _r === void 0 ? void 0 : _r.addEventListener('click', () => {
            var _a;
            const payload = this.buildScanResultExport();
            if (!this.scanExportHasPayload(payload)) {
                showToast('No scan results to download yet', 'error');
                return;
            }
            downloadJson(payload, this.resolveScanExportFilename());
            showToast(((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete' ? 'Complete scan bundle downloaded' : 'Scan result downloaded', 'success');
        });
        (_s = view.querySelector('#export-for-remediation')) === null || _s === void 0 ? void 0 : _s.addEventListener('click', () => {
            var _a;
            try {
                console.log('[export-for-remediation] clicked');
                console.log('[export-for-remediation] lastResult:', this.lastResult);
                const payload = this.buildRemediationExport();
                console.log('[export-for-remediation] payload:', payload);
                if (!payload) {
                    showToast('No scan results to export for remediation yet', 'error');
                    return;
                }
                const slug = pathToFileSlug(((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath) || 'project');
                const stamp = dateStamp();
                downloadJson(payload, `remediation-${slug}-${stamp}.json`);
                showToast('Remediation export downloaded — drag it onto the Roadmap page', 'success');
            }
            catch (err) {
                console.error('[export-for-remediation] Error:', err);
                showToast('Export failed: ' + ((err === null || err === void 0 ? void 0 : err.message) || 'Unknown error'), 'error');
            }
        });
        // Send to AI Agent handlers (Analyze page export bar)
        const analyzeAiPanel = view.querySelector('#analyze-ai-panel');
        const analyzeAiNotes = view.querySelector('#analyze-ai-notes');
        const analyzeAiStatus = view.querySelector('#analyze-ai-status');
        const doSendToAi = async (notes = '') => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const report = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.report) || this.app.state.report;
            if (!report) {
                showToast('No report loaded — run a scan first', 'error');
                return;
            }
            const allIssues = report.rawIssues || report.detectedIssues || [];
            const reportSummary = {
                gatePass: (_c = (_b = report.gate) === null || _b === void 0 ? void 0 : _b.pass) !== null && _c !== void 0 ? _c : 'N/A',
                qualityScore: (_d = report.qualityScore) !== null && _d !== void 0 ? _d : 'N/A',
                totalIssues: allIssues.length,
                filesScanned: (_f = (_e = report.repositoryFilesTotal) !== null && _e !== void 0 ? _e : report.totalFiles) !== null && _f !== void 0 ? _f : 'N/A',
                reportType: report.type || 'simplebeacon'
            };
            // If running inside a VS Code-family webview, message the extension directly
            const vscode = this._getVscodeApi();
            if (vscode) {
                try {
                    vscode.postMessage({
                        command: 'sendToAI',
                        data: {
                            projectPath: report.projectRoot || report.projectPath || ((_g = this.lastResult) === null || _g === void 0 ? void 0 : _g.projectPath) || window.location.origin,
                            notes,
                            reportSummary,
                            issues: allIssues
                        }
                    });
                    showToast('Scan data sent to your AI coding agent. Check the editor chat panel.', 'success');
                    return;
                }
                catch (err) {
                    console.warn('[AI-Send] vscode.postMessage failed:', err);
                }
            }
            // Fall back to server API + clipboard for standalone browser or VS Code simple-browser
            try {
                const res = await fetch('/api/ai-context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectPath: report.projectRoot || report.projectPath || ((_h = this.lastResult) === null || _h === void 0 ? void 0 : _h.projectPath) || window.location.origin,
                        notes,
                        reportSummary,
                        issues: allIssues
                    })
                });
                const json = await res.json();
                if (json.success) {
                    if (json.content) {
                        try {
                            await navigator.clipboard.writeText(json.content);
                            showToast('Copied to clipboard — paste into your AI coding agent with Ctrl+V', 'success');
                        }
                        catch (clipErr) {
                            showToast('AI context saved. Use sidebar 🤖 button or mention @.simplebeacon/ai-context.md', 'success');
                        }
                    }
                    else {
                        showToast('AI context saved. Mention @.simplebeacon/ai-context.md in chat.', 'success');
                    }
                }
                else {
                    showToast('Failed: ' + (json.error || 'Unknown'), 'error');
                }
            }
            catch (err) {
                showToast('Network error: ' + err.message, 'error');
            }
        };
        (_u = view.querySelector('#analyze-send-ai-btn')) === null || _u === void 0 ? void 0 : _u.addEventListener('click', () => {
            doSendToAi('');
        });
        (_v = view.querySelector('#analyze-ai-cancel')) === null || _v === void 0 ? void 0 : _v.addEventListener('click', () => {
            if (analyzeAiPanel)
                analyzeAiPanel.style.display = 'none';
            if (analyzeAiNotes)
                analyzeAiNotes.value = '';
            if (analyzeAiStatus) {
                analyzeAiStatus.style.display = 'none';
                analyzeAiStatus.textContent = '';
            }
        });
        (_w = view.querySelector('#analyze-ai-confirm')) === null || _w === void 0 ? void 0 : _w.addEventListener('click', async () => {
            const btn = view.querySelector('#analyze-ai-confirm');
            if (!btn)
                return;
            btn.disabled = true;
            btn.textContent = 'Sending…';
            await doSendToAi((analyzeAiNotes === null || analyzeAiNotes === void 0 ? void 0 : analyzeAiNotes.value) || '');
            btn.disabled = false;
            btn.textContent = 'Confirm Send';
        });
        (_x = view.querySelector('#download-export-bundle-zip')) === null || _x === void 0 ? void 0 : _x.addEventListener('click', async () => {
            var _a;
            const btn = view.querySelector('#download-export-bundle-zip');
            const priorLabel = btn === null || btn === void 0 ? void 0 : btn.textContent;
            if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) !== 'complete') {
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
            const settings = this.loadDownloadSettings();
            if (settings.promptForCredentials) {
                showDownloadCredentialsModal({
                    title: 'Edit ZIP Export Credentials',
                    submitLabel: 'Build ZIP',
                    defaults: settings.credentials,
                    onSubmit: (credentials) => {
                        this.saveDownloadSettings({ ...settings, credentials });
                        this._doZipDownload(btn, priorLabel, payload, exportEngines, credentials);
                    }
                });
                return;
            }
            this._doZipDownload(btn, priorLabel, payload, exportEngines, settings.credentials);
        });
        view.querySelectorAll('#download-eu-ai-act-pdf').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const priorLabel = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Building EU report…';
                try {
                    const data = await this.downloadEuAiActAuditPdf();
                    showToast(`EU compliance report saved as ${data.filename}. Open the HTML file, then Print → Save as PDF.`, 'success');
                }
                catch (err) {
                    showToast(err.message || 'EU compliance PDF failed', 'error');
                }
                finally {
                    btn.disabled = false;
                    btn.textContent = priorLabel || 'Download EU PDF';
                }
            });
        });
        (_y = el.querySelector('#download-audit-pdf')) === null || _y === void 0 ? void 0 : _y.addEventListener('click', async () => {
            const btn = el.querySelector('#download-audit-pdf');
            const priorLabel = btn === null || btn === void 0 ? void 0 : btn.textContent;
            const settings = this.loadDownloadSettings();
            if (settings.promptForCredentials) {
                showDownloadCredentialsModal({
                    title: 'Edit Audit PDF Credentials',
                    submitLabel: 'Build PDF',
                    defaults: settings.credentials,
                    onSubmit: (credentials) => {
                        this.saveDownloadSettings({ ...settings, credentials });
                        this._doPdfDownload(btn, priorLabel, credentials);
                    }
                });
                return;
            }
            this._doPdfDownload(btn, priorLabel, settings.credentials);
        });
        (_z = view.querySelector('#download-simplebeacon-json')) === null || _z === void 0 ? void 0 : _z.addEventListener('click', () => {
            var _a, _b;
            const report = (_a = this.getCompleteStep('simplebeacon')) === null || _a === void 0 ? void 0 : _a.report;
            if (!report) {
                showToast('Simplebeacon step has no report', 'error');
                return;
            }
            const filename = `simplebeacon-${slug}-${dateStamp()}.json`;
            downloadJson(this.prepareReportForResults(report, {
                projectPath: ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath) || report.projectRoot,
                exportFilename: filename
            }), filename);
            showToast('Simplebeacon report downloaded', 'success');
        });
        view.querySelectorAll('.analyze-download-step-json').forEach((btn) => {
            btn.addEventListener('click', () => {
                var _a, _b;
                const stepId = btn.dataset.stepId;
                const step = this.getCompleteStep(stepId);
                if (!step) {
                    showToast('Step not found', 'error');
                    return;
                }
                const payload = {
                    type: 'simplebeacon-step-export',
                    exportedAt: new Date().toISOString(),
                    stepId,
                    label: getCompleteEngineLabel(stepId),
                    findingsCount: (_a = step.findingsCount) !== null && _a !== void 0 ? _a : 0,
                    fileCount: (_b = step.fileCount) !== null && _b !== void 0 ? _b : 0,
                    findings: step.findings || []
                };
                downloadJson(payload, `${stepId}-${slug}-${dateStamp()}.json`);
                showToast(`${getCompleteEngineLabel(stepId)} JSON downloaded`, 'success');
            });
        });
        (_0 = el.querySelector('#download-consolidation-json')) === null || _0 === void 0 ? void 0 : _0.addEventListener('click', () => {
            var _a, _b;
            const scan = (_a = this.getCompleteStep('consolidation')) === null || _a === void 0 ? void 0 : _a.scan;
            if (!scan) {
                showToast('Consolidation step has no report', 'error');
                return;
            }
            const consolidationFilename = `consolidation-${slug}-${dateStamp()}.json`;
            downloadJson(sanitizeConsolidationExport(scan, {
                projectPath: ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath) || scan.projectRoot,
                exportFilename: consolidationFilename
            }), consolidationFilename);
            showToast('Consolidation report downloaded', 'success');
        });
        (_1 = el.querySelector('#download-codebase-json')) === null || _1 === void 0 ? void 0 : _1.addEventListener('click', () => {
            var _a, _b;
            const scan = (_a = this.getCompleteStep('codebase')) === null || _a === void 0 ? void 0 : _a.scan;
            if (!scan) {
                showToast('Codebase step has no report', 'error');
                return;
            }
            const codebaseFilename = `codebase-${slug}-${dateStamp()}.json`;
            downloadJson(sanitizeCodebaseReportExport(scan, {
                requestedProjectPath: (_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath,
                exportFilename: codebaseFilename
            }), codebaseFilename);
            showToast('Codebase report downloaded', 'success');
        });
        /**
         * Export brief.
         * @returns {any}
         */
        const exportBrief = () => {
            var _a;
            const brief = sanitizeCleanupBriefExport(buildCleanupBriefFromLastResult(this.lastResult, ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.policy) || loadCleanupPolicy()));
            if (!brief) {
                showToast('Run Cleanup assistant first', 'error');
                return;
            }
            this.lastResult.brief = brief;
            downloadJson(brief, `cleanup-brief-${slug}-${dateStamp()}.json`);
            showToast('Agent brief exported — attach in Cursor agent mode', 'success');
        };
        (_2 = el.querySelector('#cleanup-brief-export-btn')) === null || _2 === void 0 ? void 0 : _2.addEventListener('click', exportBrief);
        /**
         * Copy prompt.
         * @returns {any}
         */
        const copyPrompt = async () => {
            var _a, _b, _c;
            const brief = buildCleanupBriefFromLastResult(this.lastResult, ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.policy) || loadCleanupPolicy())
                || ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.brief)
                || null;
            const prompt = brief === null || brief === void 0 ? void 0 : brief.agentPrompt;
            if (!prompt) {
                showToast('Run Cleanup assistant first', 'error');
                return;
            }
            try {
                if ((_c = navigator.clipboard) === null || _c === void 0 ? void 0 : _c.writeText) {
                    await navigator.clipboard.writeText(prompt);
                }
                else {
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
            }
            catch (_d) {
                showToast('Could not copy prompt — use Export agent brief instead', 'error');
            }
        };
        (_3 = el.querySelector('#copy-cleanup-agent-prompt')) === null || _3 === void 0 ? void 0 : _3.addEventListener('click', copyPrompt);
        (_4 = el.querySelector('#cleanup-prompt-copy-btn')) === null || _4 === void 0 ? void 0 : _4.addEventListener('click', copyPrompt);
        (_5 = el.querySelector('#cleanup-reapply-policy')) === null || _5 === void 0 ? void 0 : _5.addEventListener('click', () => {
            var _a;
            if (((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) !== 'cleanup-assistant')
                return;
            const policy = readCleanupPolicyFromDom(el);
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
        (_6 = el.querySelector('#download-file-reduction-json')) === null || _6 === void 0 ? void 0 : _6.addEventListener('click', () => {
            var _a;
            const scan = (_a = this.getCompleteStep('file-reduction')) === null || _a === void 0 ? void 0 : _a.scan;
            if (!scan) {
                showToast('File reduction step has no report', 'error');
                return;
            }
            downloadJson(sanitizeDataCleanupReportExport(scan), `file-reduction-${slug}-${dateStamp()}.json`);
            showToast('File reduction report exported', 'success');
        });
        (_7 = el.querySelector('#download-data-quality-json')) === null || _7 === void 0 ? void 0 : _7.addEventListener('click', () => {
            var _a;
            const scan = (_a = this.getCompleteStep('data-quality')) === null || _a === void 0 ? void 0 : _a.scan;
            if (!scan) {
                showToast('Data quality step has no report', 'error');
                return;
            }
            downloadJson(sanitizeDataCleanupReportExport(scan), `data-quality-${slug}-${dateStamp()}.json`);
            showToast('Data quality report exported', 'success');
        });
        el.querySelectorAll('.data-cleanup-download-json').forEach((btn) => {
            btn.addEventListener('click', () => {
                var _a, _b;
                const profile = btn.dataset.profile;
                const scan = profile === 'data-quality'
                    ? (_a = this.getCompleteStep('data-quality')) === null || _a === void 0 ? void 0 : _a.scan
                    : (_b = this.getCompleteStep('file-reduction')) === null || _b === void 0 ? void 0 : _b.scan;
                if (!scan) {
                    showToast(`${profile} step has no report`, 'error');
                    return;
                }
                downloadJson(sanitizeDataCleanupReportExport(scan), `${profile}-${slug}-${dateStamp()}.json`);
                showToast(`${profile} report exported`, 'success');
            });
        });
        (_8 = el.querySelector('#download-mock-scan-json')) === null || _8 === void 0 ? void 0 : _8.addEventListener('click', () => {
            var _a, _b, _c, _d, _e;
            const mockStep = this.getCompleteStep('mock-scan');
            const payload = (mockStep === null || mockStep === void 0 ? void 0 : mockStep.report)
                ? buildFictionDigestPayload(mockStep.report, {
                    projectPath: ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath) || mockStep.report.projectRoot
                })
                : (mockStep === null || mockStep === void 0 ? void 0 : mockStep.fictionIssues)
                    ? {
                        type: 'simplebeacon-fiction-digest',
                        generatedAt: new Date().toISOString(),
                        conclusion: mockStep.conclusion,
                        fictionIssues: mockStep.fictionIssues,
                        nonFictionIssues: mockStep.nonFictionIssues || [],
                        sourceReport: mockStep.report
                    }
                    : (_d = (_b = mockStep === null || mockStep === void 0 ? void 0 : mockStep.report) !== null && _b !== void 0 ? _b : (_c = mockStep === null || mockStep === void 0 ? void 0 : mockStep.data) === null || _c === void 0 ? void 0 : _c.report) !== null && _d !== void 0 ? _d : mockStep === null || mockStep === void 0 ? void 0 : mockStep.data;
            if (!payload) {
                showToast('Fiction digest step has no report', 'error');
                return;
            }
            const fictionFilename = `fiction-digest-${slug}-${dateStamp()}.json`;
            downloadJson(sanitizeFictionDigestExport(payload, {
                projectPath: ((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.projectPath) || (mockStep === null || mockStep === void 0 ? void 0 : mockStep.projectPath),
                exportFilename: fictionFilename
            }), fictionFilename);
            showToast('Fiction digest downloaded', 'success');
        });
        (_9 = el.querySelector('#download-roadmap-json')) === null || _9 === void 0 ? void 0 : _9.addEventListener('click', () => {
            var _a, _b;
            if (!roadmap) {
                showToast('Roadmap step has no report', 'error');
                return;
            }
            const roadmapSlug = pathToFileSlug(((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath) || roadmap.projectName);
            const roadmapFilename = `${roadmapSlug || 'roadmap'}-${dateStamp()}.json`;
            downloadJson(sanitizeRoadmapExport(roadmap, {
                requestedProjectPath: (_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath,
                exportFilename: roadmapFilename
            }), roadmapFilename);
            showToast('Full roadmap downloaded', 'success');
        });
        (_10 = el.querySelector('#download-eu-compliance-json')) === null || _10 === void 0 ? void 0 : _10.addEventListener('click', () => {
            var _a, _b, _c, _d, _e;
            const checklist = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete'
                ? (_c = (_b = this.getCompleteStep('eu-ai-act')) === null || _b === void 0 ? void 0 : _b.sprint) === null || _c === void 0 ? void 0 : _c.complianceChecklist
                : (_e = (_d = this.lastResult) === null || _d === void 0 ? void 0 : _d.sprint) === null || _e === void 0 ? void 0 : _e.complianceChecklist;
            if (!checklist) {
                showToast('EU compliance checklist has no report', 'error');
                return;
            }
            downloadJson(checklist, `eu-ai-act-compliance-${dateStamp()}.json`);
            showToast('EU compliance checklist downloaded', 'success');
        });
        (_11 = el.querySelector('#download-compliance-json')) === null || _11 === void 0 ? void 0 : _11.addEventListener('click', () => {
            var _a, _b, _c, _d, _e, _f, _g;
            const complianceStep = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete'
                ? this.getCompleteStep('compliance')
                : this.lastResult;
            const checklist = complianceStep === null || complianceStep === void 0 ? void 0 : complianceStep.checklist;
            if (!checklist) {
                showToast('Compliance checklist has no report', 'error');
                return;
            }
            const gateReport = ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.kind) === 'complete'
                ? (_c = this.getCompleteStep('simplebeacon')) === null || _c === void 0 ? void 0 : _c.report
                : (_d = this.lastResult) === null || _d === void 0 ? void 0 : _d.report;
            const npmAudit = ((_e = this.lastResult) === null || _e === void 0 ? void 0 : _e.kind) === 'complete'
                ? (_f = this.getCompleteStep('npm-audit')) === null || _f === void 0 ? void 0 : _f.npmAudit
                : complianceStep === null || complianceStep === void 0 ? void 0 : complianceStep.npmAudit;
            const payload = (complianceStep === null || complianceStep === void 0 ? void 0 : complianceStep.complianceExport)
                ? { ...complianceStep.complianceExport, generatedAt: new Date().toISOString() }
                : sanitizeComplianceBundleExport({
                    type: 'simplebeacon-compliance-checklist',
                    generatedAt: new Date().toISOString(),
                    projectPath: (_g = this.lastResult) === null || _g === void 0 ? void 0 : _g.projectPath,
                    gateReport: gateReport || null,
                    checklist,
                    npmAudit: npmAudit || null
                });
            downloadJson(payload, `compliance-${slug}-${dateStamp()}.json`);
            showToast('Compliance checklist downloaded', 'success');
        });
        (_12 = el.querySelector('#download-npm-audit-json')) === null || _12 === void 0 ? void 0 : _12.addEventListener('click', () => {
            var _a, _b, _c, _d;
            const npmAudit = ((_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.kind) === 'complete'
                ? (_b = this.getCompleteStep('npm-audit')) === null || _b === void 0 ? void 0 : _b.npmAudit
                : (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.npmAudit;
            if (!npmAudit) {
                showToast('npm audit has no report', 'error');
                return;
            }
            const projectPath = (_d = this.lastResult) === null || _d === void 0 ? void 0 : _d.projectPath;
            downloadJson(sanitizeNpmAuditExport({
                type: 'simplebeacon-npm-audit',
                generatedAt: new Date().toISOString(),
                projectPath,
                ...npmAudit
            }, projectPath), `npm-audit-${slug}-${dateStamp()}.json`);
            showToast('npm audit downloaded', 'success');
        });
        (_13 = el.querySelector('#copy-roadmap-json')) === null || _13 === void 0 ? void 0 : _13.addEventListener('click', async () => {
            var _a;
            if (!roadmap)
                return;
            try {
                await navigator.clipboard.writeText(JSON.stringify(sanitizeRoadmapExport(roadmap, { requestedProjectPath: (_a = this.lastResult) === null || _a === void 0 ? void 0 : _a.projectPath }), null, 2));
                showToast('Roadmap JSON copied', 'success');
            }
            catch (err) {
                showToast(err.message || 'Copy failed', 'error');
            }
        });
        const issueSlot = el.querySelector('#inline-issue-list');
        if (issueSlot && simplebeaconReport && !this.isResultsLocked()) {
            const categories = this.app.scanService.getIssueCategories(simplebeaconReport);
            const displayCategories = ((_14 = this.lastResult) === null || _14 === void 0 ? void 0 : _14.kind) === 'mock-scan'
                ? categories.filter((cat) => cat.id === 'consistency')
                : categories;
            issueSlot.appendChild(renderIssueList(displayCategories.length ? displayCategories : categories, {
                onSelect: (cat) => this.openResultsView({ filter: cat })
            }));
            // Wire up severity filter chips
            const toolbar = el.querySelector('[data-issue-toolbar]');
            if (toolbar) {
                const chips = toolbar.querySelectorAll('.severity-chip');
                const searchInput = toolbar.querySelector('#issue-search-input');
                const applyFilters = () => {
                    var _a;
                    const activeSevs = new Set(Array.from(chips).filter(c => c.classList.contains('active')).map(c => c.dataset.sev));
                    const q = ((_a = searchInput === null || searchInput === void 0 ? void 0 : searchInput.value) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                    const cards = issueSlot.querySelectorAll('.issue-card');
                    for (const card of cards) {
                        const sev = card.dataset.severity;
                        const text = card.textContent.toLowerCase();
                        const sevMatch = activeSevs.has(sev) || (sev === 'none' && activeSevs.size === 0);
                        const textMatch = !q || text.includes(q);
                        card.style.display = sevMatch && textMatch ? '' : 'none';
                    }
                };
                for (const chip of chips) {
                    chip.addEventListener('click', () => {
                        chip.classList.toggle('active');
                        const sev = chip.dataset.sev;
                        if (chip.classList.contains('active')) {
                            chip.style.background = sev === 'critical' || sev === 'high' ? 'rgba(239,68,68,0.15)'
                                : sev === 'medium' ? 'rgba(245,158,11,0.15)'
                                    : sev === 'low' ? 'rgba(59,130,246,0.15)'
                                        : 'rgba(107,114,128,0.15)';
                            chip.style.color = sev === 'critical' || sev === 'high' ? 'var(--color-danger, #ef4444)'
                                : sev === 'medium' ? 'var(--color-warning, #f59e0b)'
                                    : sev === 'low' ? 'var(--color-info, #3b82f6)'
                                        : 'var(--text-muted, #737373)';
                            chip.style.borderColor = chip.style.color;
                        }
                        else {
                            chip.style.background = 'var(--surface-elevated)';
                            chip.style.color = 'var(--text-secondary)';
                            chip.style.borderColor = 'var(--border)';
                        }
                        applyFilters();
                    });
                }
                if (searchInput)
                    searchInput.addEventListener('input', applyFilters);
            }
        }
        // Paywall email capture — send sample report request
        const paywallEmailForm = el.querySelector('.paywall-email-form');
        if (paywallEmailForm) {
            paywallEmailForm.addEventListener('submit', (e) => {
                var _a, _b, _c, _d, _e, _f, _g;
                e.preventDefault();
                const emailInput = paywallEmailForm.querySelector('input[type="email"]');
                const email = (_a = emailInput === null || emailInput === void 0 ? void 0 : emailInput.value) === null || _a === void 0 ? void 0 : _a.trim();
                if (!email)
                    return;
                // Store lead for follow-up; in production this would POST to a lead capture endpoint
                const leads = JSON.parse(localStorage.getItem('simplebeaconPaywallLeads') || '[]');
                leads.push({ email, projectPath: ((_b = this.lastResult) === null || _b === void 0 ? void 0 : _b.projectPath) || '', scannedAt: new Date().toISOString(), findingsCount: (_g = (_f = (_e = (_d = (_c = this.lastResult) === null || _c === void 0 ? void 0 : _c.steps) === null || _d === void 0 ? void 0 : _d.find((s) => s.id === 'simplebeacon')) === null || _e === void 0 ? void 0 : _e.report) === null || _f === void 0 ? void 0 : _f.issueCount) !== null && _g !== void 0 ? _g : null });
                localStorage.setItem('simplebeaconPaywallLeads', JSON.stringify(leads.slice(-50))); // keep last 50
                showToast(`Sample report requested for ${email}. We'll send a preview within 24 hours.`, 'success');
                emailInput.value = '';
            });
        }
        if (typeof window.lucide !== 'undefined')
            window.lucide.createIcons();
    }
    async tryAutoLoadCompleteScan() {
        var _a;
        if (this._autoLoadAttempted)
            return;
        this._autoLoadAttempted = true;
        // Skip when served from a static file server that lacks the /data/ directory
        if (window.location.protocol === 'file:')
            return;
        const isLikelyDashboardServer = window.location.pathname.startsWith('/simplebeacon-dashboard/')
            || window.location.port === '3000'
            || window.location.port === '3002'
            || window.location.port === '3001'
            || window.location.port === '54449';
        if (!isLikelyDashboardServer)
            return;
        const paths = [
            '/data/complete-scan-ai-platform-2026-06-12.json',
            '/data/complete-scan-cascadeprojects-2026-06-11.json'
        ];
        for (const url of paths) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok)
                    continue;
                const data = await res.json();
                if (data.type === 'simplebeacon-complete-scan' && data.results) {
                    const generatedAt = data.generatedAt || ((_a = data.report) === null || _a === void 0 ? void 0 : _a.generatedAt);
                    const ageMin = generatedAt ? (Date.now() - new Date(generatedAt).getTime()) / 60000 : 0;
                    if (ageMin > 15) {
                        showToast(`Saved scan is ${Math.round(ageMin)} min old — re-run scan for fresh data`, 'warning');
                        continue;
                    }
                    this.importCompleteScanExport(data, url.split('/').pop());
                    showToast('Loaded saved complete scan', 'success');
                    return;
                }
            }
            catch (_b) {
                // Silent — try next path
            }
        }
    }
}
