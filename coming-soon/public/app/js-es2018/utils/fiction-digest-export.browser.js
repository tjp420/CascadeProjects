// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Browser mirror of fiction-digest-export-sanitize.js — keep in sync.
 */
import { redactProjectPathForExport } from './quality-export.browser.js?v=20260716cachefix1';
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
    const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'ai-platform';
}
const SCANNER_IMPL_PATH_RE =
    /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)|(?:^|\/)src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)/;
const OSS_SCANNER_ROOT_FILES = new Set(['src/scan.js', 'src/config.js', 'src/project-detect.js', 'src/index.js']);
const SUPPRESSED_PRODUCTION_LEAK_INTENTS = new Set([
    'scanner-meta',
    'repository-audit-loader',
    'repository-audit-stub-loader',
    'config-metadata',
    'demo-tool-sample'
]);
/**
 * Normalize rel.
 * @param {string} filePath
 * @returns {any}
 */
function normalizeRel(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}
/**
 * Is scanner implementation path.
 * @param {string} relativePath
 * @returns {any}
 */
function isScannerImplementationPath(relativePath) {
    const rel = normalizeRel(relativePath);
    if (SCANNER_IMPL_PATH_RE.test(rel.toLowerCase())) return true;
    if (OSS_SCANNER_ROOT_FILES.has(rel)) return true;
    return false;
}
/**
 * Is benchmark path.
 * @param {string} filePath
 * @returns {any}
 */
function isBenchmarkPath(filePath) {
    const rel = normalizeRel(filePath).toLowerCase();
    return (
        rel.includes('/github-cache/') ||
        rel.startsWith('github-cache/') ||
        rel.includes('/java-ai-vulnerable/') ||
        rel.startsWith('java-ai-vulnerable/')
    );
}
/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}
/**
 * Resolve digest project path.
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function resolveDigestProjectPath(digest, options = {}) {
    var _a;
    return String(
        options.projectPath ||
            digest.projectPath ||
            digest.sourceProjectPath ||
            ((_a = digest.sourceReport) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
            ''
    ).replace(/\\/g, '/');
}
/**
 * Is benchmark fiction digest.
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function isBenchmarkFictionDigest(digest, options = {}) {
    if (options.benchmarkScan != null) return Boolean(options.benchmarkScan);
    return isBenchmarkPath(resolveDigestProjectPath(digest, options));
}
/**
 * Is benchmark clone noise issue.
 * @param {boolean} issue
 * @returns {any}
 */
function isBenchmarkCloneNoiseIssue(issue) {
    var _a, _b;
    if (!issue) return false;
    const pattern = String(
        issue.pattern || ((_a = issue.metadata) === null || _a === void 0 ? void 0 : _a.patternId) || ''
    );
    const category = String(
        issue.category || ((_b = issue.metadata) === null || _b === void 0 ? void 0 : _b.category) || ''
    );
    const type = String(issue.type || '');
    if (/SB-HANDOFF/i.test(pattern) || category === 'handoff-integrity') return true;
    if (/EUAI-/i.test(pattern) || /EU AI Act/i.test(type)) return true;
    return false;
}
/**
 * Is benchmark scanner meta issue.
 * @param {boolean} issue
 * @returns {any}
 */
function isBenchmarkScannerMetaIssue(issue) {
    var _a;
    if (!issue) return false;
    const intent = String(((_a = issue.metadata) === null || _a === void 0 ? void 0 : _a.intent) || issue.intent || '');
    if (intent && SUPPRESSED_PRODUCTION_LEAK_INTENTS.has(intent)) return true;
    if (!/production leak/i.test(String(issue.type || ''))) return false;
    const filePath = issue.filePath || issue.file || '';
    return filePath ? isScannerImplementationPath(filePath) : false;
}
/**
 * Is benchmark digest excluded issue.
 * @param {boolean} issue
 * @param {any} benchmarkScan
 * @returns {any}
 */
function isBenchmarkDigestExcludedIssue(issue, benchmarkScan) {
    if (!benchmarkScan || !issue) return false;
    if (isBenchmarkCloneNoiseIssue(issue)) return true;
    return isBenchmarkScannerMetaIssue(issue);
}
/**
 * Filter digest issues.
 * @param {Array} issues
 * @param {any} benchmarkScan
 * @returns {any}
 */
function filterDigestIssues(issues = [], benchmarkScan) {
    return issues.filter(issue => {
        const filePath = issue.filePath || issue.file || '';
        if (filePath && isBenchmarkPath(filePath)) return false;
        if (isBenchmarkDigestExcludedIssue(issue, benchmarkScan)) return false;
        return true;
    });
}
/**
 * Build benchmark fiction conclusion.
 * @param {Array} fictionIssues
 * @param {Array} nonFictionIssues
 * @param {number} sourceReport
 * @returns {any}
 */
function buildBenchmarkFictionConclusion(fictionIssues, nonFictionIssues, sourceReport) {
    var _a, _b, _c, _d, _e, _f, _g;
    const repoFiles =
        (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.repositoryFilesTotal) !== null &&
        _a !== void 0
            ? _a
            : (_b = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                _b === void 0
              ? void 0
              : _b.repositoryFilesTotal;
    const ruleScoped =
        (_e =
            (_c = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.ruleScopedFilesAnalyzed) !==
                null && _c !== void 0
                ? _c
                : (_d = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                    _d === void 0
                  ? void 0
                  : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0
            ? _e
            : 0;
    const jsonFiction =
        (_f = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fictionJsonFilesScanned) !==
            null && _f !== void 0
            ? _f
            : (_g = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                _g === void 0
              ? void 0
              : _g.fictionJsonFilesScanned;
    const fictionN = fictionIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);
    const parts = [
        'OSS benchmark clone under github-cache/ — not Simplebeacon product handoff',
        fictionN
            ? // simplebeacon:production-leak-intent - legitimate sample path reference for fiction digest reporting
              `${fictionN} fiction/KPI pattern(s) in clone JSON — not product *-sample.json`
            : 'No Simplebeacon fiction KPI hits in product sample paths',
        nonFictionIssues.length
            ? `${nonFictionIssues.length} clone-local pattern hit(s) remain — informational only`
            : 'No actionable fiction-digest findings on this clone',
        repoFiles != null ? `Repository inventory: ${Number(repoFiles).toLocaleString()} files` : null,
        `Product gate paths checked ${Number(ruleScoped).toLocaleString()} files`,
        jsonFiction != null
            ? `Fiction rules scanned ${Number(jsonFiction).toLocaleString()} JSON file(s) in clone`
            : null,
        'Agency-handoff and EU AI Act blog matches are excluded from vendor gate scoring',
        'Re-run Complete scan on ai-platform root for handoff evidence'
    ].filter(Boolean);
    return `${parts.join('. ')}.`;
}
/**
 * Is stale full tree scan.
 * @param {number} report
 * @returns {any}
 */
function isStaleFullTreeScan(report) {
    var _a, _b, _c, _d;
    if (
        report.fullDirectoryScan ||
        ((_a = report.scanScope) === null || _a === void 0 ? void 0 : _a.fullDirectoryScan)
    ) {
        return false;
    }
    const mock =
        (_c = (_b = report.mockSampleFiles) !== null && _b !== void 0 ? _b : report.totalFiles) !== null &&
        _c !== void 0
            ? _c
            : 0;
    const repoFiles = (_d = report.repositoryFilesTotal) !== null && _d !== void 0 ? _d : 0;
    /**
     * Paths.
     * @param {number} report.scanPaths || []
     * @returns {any}
     */
    const paths = (report.scanPaths || []).map(p => String(p).replace(/\\/g, '/').toLowerCase());
    const platformKey = String(report.projectRoot || '')
        .replace(/\\/g, '/')
        .toLowerCase();
    const scanIsPlatformRootOnly = paths.length === 1 && paths[0] === platformKey;
    return mock > 500 || scanIsPlatformRootOnly || repoFiles > 15000;
}
/**
 * Normalize digest project paths.
 * @param {string} projectPath
 * @param {any} projectLabel
 * @returns {any}
 */
function normalizeDigestProjectPaths(projectPath, projectLabel) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    if (!normalized) return undefined;
    const label = projectLabel || projectLabelFromPath(normalized);
    return redactProjectPathForExport(normalized, label);
}
/**
 * Reconcile product digest scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @returns {any}
 */
function reconcileProductDigestScanScope(scanScope = {}, report = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fullTree = Boolean(report.fullDirectoryScan || scanScope.fullDirectoryScan);
    if (!fullTree) return scanScope;
    const mockInPaths = (_a = scanScope.mockSampleFilesInScanPaths) !== null && _a !== void 0 ? _a : 0;
    const ruleScoped =
        (_c =
            (_b = report.ruleScopedFilesAnalyzed) !== null && _b !== void 0
                ? _b
                : scanScope.ruleScopedFilesAnalyzed) !== null && _c !== void 0
            ? _c
            : 0;
    const mockSampleFiles =
        (_e = (_d = report.mockSampleFiles) !== null && _d !== void 0 ? _d : report.totalFiles) !== null &&
        _e !== void 0
            ? _e
            : null;
    const fictionSamples =
        (_g =
            (_f = report.fictionSampleFilesScanned) !== null && _f !== void 0
                ? _f
                : scanScope.fictionSampleFilesScanned) !== null && _g !== void 0
            ? _g
            : null;
    let reconciled = mockInPaths;
    if (mockSampleFiles != null && mockSampleFiles < mockInPaths) {
        reconciled = mockSampleFiles;
    } else if (mockInPaths >= ruleScoped && ruleScoped > 0 && fictionSamples != null && fictionSamples < mockInPaths) {
        reconciled = fictionSamples;
    } else if (mockInPaths >= ruleScoped && ruleScoped > 0) {
        const jsonFiction =
            (_j =
                (_h = report.fictionJsonFilesScanned) !== null && _h !== void 0
                    ? _h
                    : scanScope.fictionJsonFilesScanned) !== null && _j !== void 0
                ? _j
                : null;
        if (jsonFiction != null && jsonFiction < mockInPaths) {
            reconciled = jsonFiction;
        }
    }
    if (reconciled === mockInPaths) return scanScope;
    return {
        ...scanScope,
        mockSampleFilesInScanPaths: reconciled,
        mockSampleFilesReconciledNote: `mockSampleFilesInScanPaths reconciled from ${Number(mockInPaths).toLocaleString()} to ${Number(reconciled).toLocaleString()} — full-directory scan counts repo-wide paths, not mock/sample JSON only.`
    };
}
/**
 * Infer digest scan target from hints.
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function inferDigestScanTargetFromHints(digest, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';
    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';
    const cloneName = slugMatch[1];
    const sourceRoot = resolveDigestProjectPath(digest, options);
    if (isBenchmarkPath(sourceRoot)) return '';
    const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}
/**
 * Dedupe fiction digest export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeFictionDigestExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes) {
        const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
        const scopeKey = /agency-handoff and eu ai act blog matches/i.test(normalized)
            ? 'benchmark-handoff-note'
            : /production-leak hits in simplebeacon scanner source/i.test(normalized)
              ? 'benchmark-scanner-meta-note'
              : /gate pass on clone does not imply/i.test(normalized)
                ? 'benchmark-gate-handoff-note'
                : /llm slop file count reconciled/i.test(normalized)
                  ? 'benchmark-llm-reconcile-note'
                  : normalized;
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(note));
    }
    return out.slice(0, 6);
}
/**
 * Build benchmark fiction export notes.
 * @param {Array} existingNotes
 * @param {Array} extras
 * @returns {any}
 */
function buildBenchmarkFictionExportNotes(existingNotes = [], extras = []) {
    const canonical = [
        'Agency-handoff and EU AI Act blog matches removed from fiction digest for github-cache/ benchmark target.',
        'Production-leak hits in Simplebeacon scanner source (src/) excluded on OSS self-scan benchmark clone.',
        'Gate pass on clone does not imply Simplebeacon product handoff readiness.'
    ];
    const filtered = dedupeFictionDigestExportNotes(existingNotes).filter(note => {
        const text = String(note).toLowerCase();
        return (
            !/agency-handoff and eu ai act blog matches/i.test(text) &&
            !/production-leak hits in simplebeacon scanner source/i.test(text) &&
            !/gate pass on clone does not imply/i.test(text)
        );
    });
    return dedupeFictionDigestExportNotes([...filtered, ...extras, ...canonical]);
}
/**
 * Reconcile benchmark digest scan metrics.
 * @param {number} report
 * @returns {any}
 */
function reconcileBenchmarkDigestScanMetrics(report) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const repoTotal =
        (_c =
            (_a = report.repositoryFilesTotal) !== null && _a !== void 0
                ? _a
                : (_b = report.repositoryInventory) === null || _b === void 0
                  ? void 0
                  : _b.totalFiles) !== null && _c !== void 0
            ? _c
            : null;
    const ruleScoped =
        (_f =
            (_d = report.ruleScopedFilesAnalyzed) !== null && _d !== void 0
                ? _d
                : (_e = report.scanScope) === null || _e === void 0
                  ? void 0
                  : _e.ruleScopedFilesAnalyzed) !== null && _f !== void 0
            ? _f
            : null;
    const cap = repoTotal !== null && repoTotal !== void 0 ? repoTotal : ruleScoped;
    const rawLlm =
        (_m =
            (_k =
                (_j =
                    (_g = report.llmSlopScanRaw) !== null && _g !== void 0
                        ? _g
                        : (_h = report.scanScope) === null || _h === void 0
                          ? void 0
                          : _h.llmSlopScanRaw) !== null && _j !== void 0
                    ? _j
                    : report.llmSlopFilesScanned) !== null && _k !== void 0
                ? _k
                : (_l = report.scanScope) === null || _l === void 0
                  ? void 0
                  : _l.llmSlopFilesScanned) !== null && _m !== void 0
            ? _m
            : 0;
    if (cap == null || rawLlm <= cap) return report;
    const scanScope = {
        ...(report.scanScope || {}),
        llmSlopFilesScanned: cap,
        llmSlopScanRaw: rawLlm,
        llmSlopScanReconciled: true
    };
    return {
        ...report,
        llmSlopFilesScanned: cap,
        llmSlopScanRaw: rawLlm,
        llmSlopScanReconciled: true,
        scanScope
    };
}
/**
 * Sanitize benchmark digest scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @returns {any}
 */
function sanitizeBenchmarkDigestScanScope(scanScope, report) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!scanScope) return scanScope;
    const repoTotal =
        (_c =
            (_a = report.repositoryFilesTotal) !== null && _a !== void 0
                ? _a
                : (_b = report.repositoryInventory) === null || _b === void 0
                  ? void 0
                  : _b.totalFiles) !== null && _c !== void 0
            ? _c
            : null;
    const scanned =
        (_e = (_d = scanScope.llmSlopFilesScanned) !== null && _d !== void 0 ? _d : report.llmSlopFilesScanned) !==
            null && _e !== void 0
            ? _e
            : repoTotal;
    const rawLlm = (_f = scanScope.llmSlopScanRaw) !== null && _f !== void 0 ? _f : report.llmSlopScanRaw;
    const reconciled =
        (_g = scanScope.llmSlopScanReconciled) !== null && _g !== void 0 ? _g : report.llmSlopScanReconciled;
    if (!reconciled || rawLlm == null || scanned == null || rawLlm <= scanned) return scanScope;
    const next = { ...scanScope };
    delete next.llmSlopScanRaw;
    next.llmSlopReconciliationNote = `LLM slop scan reconciled from ${rawLlm} to ${scanned} files to match clone inventory.`;
    return next;
}
/**
 * Resolve benchmark digest gate attestation.
 * @param {number} sourceReport
 * @returns {any}
 */
function resolveBenchmarkDigestGateAttestation(sourceReport) {
    var _a, _b, _c, _d, _e;
    if (!sourceReport) return 'benchmark-clone';
    if (sourceReport.gateAttestation === 'benchmark-clone') return 'benchmark-clone';
    const ruleScoped =
        (_c =
            (_a = sourceReport.ruleScopedFilesAnalyzed) !== null && _a !== void 0
                ? _a
                : (_b = sourceReport.scanScope) === null || _b === void 0
                  ? void 0
                  : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
            ? _c
            : 0;
    if (((_d = sourceReport.gate) === null || _d === void 0 ? void 0 : _d.pass) && ruleScoped > 0)
        return 'benchmark-clone';
    if (((_e = sourceReport.gate) === null || _e === void 0 ? void 0 : _e.pass) && ruleScoped === 0)
        return 'limited-benchmark';
    return 'benchmark-clone';
}
/**
 * Build benchmark fiction scope summary.
 * @param {number} sourceReport
 * @returns {any}
 */
function buildBenchmarkFictionScopeSummary(sourceReport) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const repoTotal =
        (_b =
            (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.repositoryFilesTotal) !==
                null && _a !== void 0
                ? _a
                : scope.repositoryFilesTotal) !== null && _b !== void 0
            ? _b
            : null;
    const llmScanned =
        (_d =
            (_c = scope.llmSlopFilesScanned) !== null && _c !== void 0
                ? _c
                : sourceReport === null || sourceReport === void 0
                  ? void 0
                  : sourceReport.llmSlopFilesScanned) !== null && _d !== void 0
            ? _d
            : repoTotal;
    const rawLlm =
        (_e = scope.llmSlopScanRaw) !== null && _e !== void 0
            ? _e
            : sourceReport === null || sourceReport === void 0
              ? void 0
              : sourceReport.llmSlopScanRaw;
    const reconciled =
        (_f = scope.llmSlopScanReconciled) !== null && _f !== void 0
            ? _f
            : sourceReport === null || sourceReport === void 0
              ? void 0
              : sourceReport.llmSlopScanReconciled;
    return {
        benchmarkScannerMetaExcluded: (_g = scope.benchmarkScannerMetaExcluded) !== null && _g !== void 0 ? _g : 0,
        benchmarkCloneNoiseExcluded: (_h = scope.benchmarkCloneNoiseExcluded) !== null && _h !== void 0 ? _h : 0,
        fictionJsonFilesScanned:
            (_k =
                (_j =
                    sourceReport === null || sourceReport === void 0
                        ? void 0
                        : sourceReport.fictionJsonFilesScanned) !== null && _j !== void 0
                    ? _j
                    : scope.fictionJsonFilesScanned) !== null && _k !== void 0
                ? _k
                : null,
        ruleScopedFilesAnalyzed:
            (_m =
                (_l =
                    sourceReport === null || sourceReport === void 0
                        ? void 0
                        : sourceReport.ruleScopedFilesAnalyzed) !== null && _l !== void 0
                    ? _l
                    : scope.ruleScopedFilesAnalyzed) !== null && _m !== void 0
                ? _m
                : 0,
        repositoryFilesTotal: repoTotal,
        llmSlopFilesScanned: llmScanned,
        ...(reconciled && rawLlm != null && llmScanned != null && rawLlm > llmScanned
            ? { llmSlopScanReconciledFrom: rawLlm }
            : {})
    };
}
/**
 * Resolve product fiction digest gate attestation.
 * @param {number} sourceReport
 * @returns {any}
 */
function resolveProductFictionDigestGateAttestation(sourceReport) {
    var _a, _b, _c, _d, _e, _f;
    if (!sourceReport) return 'limited-scope';
    const ruleScoped =
        (_c =
            (_a = sourceReport.ruleScopedFilesAnalyzed) !== null && _a !== void 0
                ? _a
                : (_b = sourceReport.scanScope) === null || _b === void 0
                  ? void 0
                  : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
            ? _c
            : 0;
    if (((_d = sourceReport.gate) === null || _d === void 0 ? void 0 : _d.pass) === false)
        return 'fiction-review-required';
    if (((_e = sourceReport.gate) === null || _e === void 0 ? void 0 : _e.pass) && ruleScoped > 0)
        return 'platform-fiction-clean';
    if (((_f = sourceReport.gate) === null || _f === void 0 ? void 0 : _f.pass) && ruleScoped === 0)
        return 'limited-scope';
    return 'limited-scope';
}
/**
 * Summarize ancillary pattern hits.
 * @param {number} sourceReport
 * @returns {any}
 */
function summarizeAncillaryPatternHits(sourceReport) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const totals =
        (_c =
            (_b =
                (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                _a === void 0
                    ? void 0
                    : _a.fullDirectoryStats) === null || _b === void 0
                ? void 0
                : _b.ruleHitTotals) !== null && _c !== void 0
            ? _c
            : (_d = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fullDirectoryStats) ===
                    null || _d === void 0
              ? void 0
              : _d.ruleHitTotals;
    if (totals && typeof totals === 'object') {
        const ancillary = {};
        for (const [key, val] of Object.entries(totals)) {
            if (key === 'fictionKpi' || !val) continue;
            ancillary[key] = val;
        }
        if (Object.keys(ancillary).length > 0) {
            return { fictionKpi: (_e = totals.fictionKpi) !== null && _e !== void 0 ? _e : 0, ancillary };
        }
        return null;
    }
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const ancillary = {};
    if (((_f = scope.llmSlopPatternHits) !== null && _f !== void 0 ? _f : 0) > 0)
        ancillary.llmSlop = scope.llmSlopPatternHits;
    if (((_g = scope.euAiActPatternHits) !== null && _g !== void 0 ? _g : 0) > 0)
        ancillary.euAiAct = scope.euAiActPatternHits;
    const prodLeak =
        (_j =
            (_h = scope.productionLeakFindings) !== null && _h !== void 0
                ? _h
                : sourceReport === null || sourceReport === void 0
                  ? void 0
                  : sourceReport.productionLeakFindings) !== null && _j !== void 0
            ? _j
            : 0;
    if (prodLeak > 0) ancillary.productionLeak = prodLeak;
    return Object.keys(ancillary).length ? { fictionKpi: 0, ancillary } : null;
}
/**
 * Format ancillary pattern hits note.
 * @param {number} sourceReport
 * @returns {any}
 */
function formatAncillaryPatternHitsNote(sourceReport) {
    var _a, _b;
    const summary = summarizeAncillaryPatternHits(sourceReport);
    if (!(summary === null || summary === void 0 ? void 0 : summary.ancillary)) return null;
    const parts = Object.entries(summary.ancillary).map(([key, val]) => {
        const label =
            key === 'llmSlop'
                ? 'LLM slop'
                : key === 'euAiAct'
                  ? 'EU AI Act'
                  : key === 'agencyHandoff'
                    ? 'agency-handoff'
                    : key === 'productionLeak'
                      ? 'production-leak'
                      : key;
        return `${label}: ${val}`;
    });
    const total = Object.values(summary.ancillary).reduce((sum, n) => sum + n, 0);
    const blocking =
        (_b =
            (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null ||
            _a === void 0
                ? void 0
                : _a.blockingCount) !== null && _b !== void 0
            ? _b
            : 0;
    const gateClause =
        blocking > 0
            ? `gate blockingCount ${Number(blocking).toLocaleString()} on configured severities`
            : 'gate blockingCount 0 on configured severities';
    return `${total} ancillary pattern hit(s) in full-tree scan (${parts.join(', ')}) — not fiction-KPI digest rows; ${gateClause}.`;
}
/**
 * Resolve fiction digest gate context.
 * @param {number} sourceReport
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function resolveFictionDigestGateContext(sourceReport, digest, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const gate = options.gateReport || {};
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const hygiene = (digest === null || digest === void 0 ? void 0 : digest.hygieneSummary) || {};
    return {
        gateReport: gate,
        repositoryFilesTotal:
            (_g =
                (_e =
                    (_d =
                        (_c =
                            (_b =
                                (_a = options.repositoryFilesTotal) !== null && _a !== void 0
                                    ? _a
                                    : gate.repositoryFilesTotal) !== null && _b !== void 0
                                ? _b
                                : sourceReport === null || sourceReport === void 0
                                  ? void 0
                                  : sourceReport.repositoryFilesTotal) !== null && _c !== void 0
                            ? _c
                            : scope.repositoryFilesTotal) !== null && _d !== void 0
                        ? _d
                        : hygiene.repositoryFilesTotal) !== null && _e !== void 0
                    ? _e
                    : (_f = digest === null || digest === void 0 ? void 0 : digest.scanScope) === null || _f === void 0
                      ? void 0
                      : _f.gateRepositoryFilesTotal) !== null && _g !== void 0
                ? _g
                : null,
        contentScanned:
            (_p =
                (_o =
                    (_m =
                        (_l =
                            (_j =
                                (_h = scope.fullDirectoryStats) === null || _h === void 0
                                    ? void 0
                                    : _h.contentScanned) !== null && _j !== void 0
                                ? _j
                                : (_k = scope.fullDirectoryStats) === null || _k === void 0
                                  ? void 0
                                  : _k.filesContentScanned) !== null && _l !== void 0
                            ? _l
                            : sourceReport === null || sourceReport === void 0
                              ? void 0
                              : sourceReport.credentialScanned) !== null && _m !== void 0
                        ? _m
                        : gate.credentialScanned) !== null && _o !== void 0
                    ? _o
                    : hygiene.contentFilesScanned) !== null && _p !== void 0
                ? _p
                : null,
        gateProfile:
            (_w =
                (_u =
                    (_t =
                        (_r = (_q = scope.profile) !== null && _q !== void 0 ? _q : scope.gateRuleBundleProfile) !==
                            null && _r !== void 0
                            ? _r
                            : (_s = digest === null || digest === void 0 ? void 0 : digest.scanScope) === null ||
                                _s === void 0
                              ? void 0
                              : _s.gateRuleBundleProfile) !== null && _t !== void 0
                        ? _t
                        : hygiene.gateRuleBundleProfile) !== null && _u !== void 0
                    ? _u
                    : (_v = gate.scanScope) === null || _v === void 0
                      ? void 0
                      : _v.profile) !== null && _w !== void 0
                ? _w
                : null
    };
}
/**
 * Build product fiction hygiene summary.
 * @param {number} sourceReport
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function buildProductFictionHygieneSummary(sourceReport, digest, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const { repositoryFilesTotal: repoTotal, contentScanned, gateProfile, gateReport } = gateContext;
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const ancillary = summarizeAncillaryPatternHits(sourceReport);
    const sourceScanned =
        (_b =
            (_a = scope.sourceCodeFilesScanned) !== null && _a !== void 0
                ? _a
                : sourceReport === null || sourceReport === void 0
                  ? void 0
                  : sourceReport.sourceCodeFilesScanned) !== null && _b !== void 0
            ? _b
            : null;
    const jestChecked =
        (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.jestBaselineChecked) === false ||
        scope.jestExecutedDuringScan === false ||
        gateReport.jestBaselineChecked === false ||
        ((_c = digest === null || digest === void 0 ? void 0 : digest.hygieneSummary) === null || _c === void 0
            ? void 0
            : _c.jestBaselineChecked) === false
            ? false
            : null;
    return {
        digestTrust: (_d = digest.digestTrust) !== null && _d !== void 0 ? _d : null,
        gatePass:
            (_f =
                (_e = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null ||
                _e === void 0
                    ? void 0
                    : _e.pass) !== null && _f !== void 0
                ? _f
                : null,
        blockingCount:
            (_h =
                (_g = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null ||
                _g === void 0
                    ? void 0
                    : _g.blockingCount) !== null && _h !== void 0
                ? _h
                : 0,
        repositoryFilesTotal: repoTotal,
        ruleScopedFilesAnalyzed:
            (_k =
                (_j =
                    sourceReport === null || sourceReport === void 0
                        ? void 0
                        : sourceReport.ruleScopedFilesAnalyzed) !== null && _j !== void 0
                    ? _j
                    : scope.ruleScopedFilesAnalyzed) !== null && _k !== void 0
                ? _k
                : null,
        fictionJsonFilesScanned:
            (_m =
                (_l =
                    sourceReport === null || sourceReport === void 0
                        ? void 0
                        : sourceReport.fictionJsonFilesScanned) !== null && _l !== void 0
                    ? _l
                    : scope.fictionJsonFilesScanned) !== null && _m !== void 0
                ? _m
                : null,
        fictionSampleFilesScanned:
            (_p =
                (_o =
                    sourceReport === null || sourceReport === void 0
                        ? void 0
                        : sourceReport.fictionSampleFilesScanned) !== null && _o !== void 0
                    ? _o
                    : scope.fictionSampleFilesScanned) !== null && _p !== void 0
                ? _p
                : null,
        fictionKpiHits: (digest.fictionIssues || []).reduce((sum, issue) => sum + (issue.count || 1), 0),
        fullDirectoryScan: Boolean(
            (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fullDirectoryScan) ||
            scope.fullDirectoryScan
        ),
        sourceCodeFilesScanned: sourceScanned,
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(repoTotal != null && contentScanned != null && repoTotal > contentScanned
            ? { metadataOnlyInventoryFiles: repoTotal - contentScanned }
            : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...((ancillary === null || ancillary === void 0 ? void 0 : ancillary.fictionKpi) != null
            ? { fictionKpiPatternHits: ancillary.fictionKpi }
            : {}),
        ...((ancillary === null || ancillary === void 0 ? void 0 : ancillary.ancillary)
            ? { ancillaryPatternHits: ancillary.ancillary }
            : {}),
        ...(jestChecked === false ? { jestBaselineChecked: false } : {}),
        attestationNote: 'Fiction/KPI digest hygiene — not vendor handoff or Complete scan clearance certification.'
    };
}
/**
 * Build product fiction scan scope.
 * @param {number} sourceReport
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
function buildProductFictionScanScope(sourceReport, digest, options = {}) {
    var _a;
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        resultsViewScope: scope.resultsViewScope || 'platform-only',
        reportHealth: scope.reportHealth || 'platform-scoped',
        securityHandoffEligible: false,
        fullDirectoryScan: Boolean(
            (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fullDirectoryScan) ||
            scope.fullDirectoryScan
        ),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        fictionDigestNote:
            scope.fictionDigestNote ||
            ((_a = digest === null || digest === void 0 ? void 0 : digest.scanScope) === null || _a === void 0
                ? void 0
                : _a.fictionDigestNote) ||
            'Fiction/KPI digest export — gate pass here does not replace Complete scan clearance bundle.'
    };
}
/**
 * Build product fiction export notes.
 * @param {any} digest
 * @param {number} sourceReport
 * @param {Object} options
 * @returns {any}
 */
function buildProductFictionExportNotes(digest, sourceReport, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const notes = [
        'securityHandoffEligible is false — fiction/KPI digest is hygiene attestation only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    const gateContext = resolveFictionDigestGateContext(sourceReport, digest, options);
    const { repositoryFilesTotal: repoTotal, contentScanned, gateProfile } = gateContext;
    if (repoTotal != null && contentScanned != null && contentScanned < repoTotal) {
        notes.push(
            `Gate content-scanned ${Number(contentScanned).toLocaleString()} production-path file(s) — ${Number(repoTotal - contentScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(repoTotal).toLocaleString()}.`
        );
    }
    const scope = (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) || {};
    const fictionJson =
        (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fictionJsonFilesScanned) !==
            null && _a !== void 0
            ? _a
            : scope.fictionJsonFilesScanned;
    const sourceScanned =
        (_b = scope.sourceCodeFilesScanned) !== null && _b !== void 0
            ? _b
            : sourceReport === null || sourceReport === void 0
              ? void 0
              : sourceReport.sourceCodeFilesScanned;
    if (fictionJson != null && sourceScanned != null) {
        notes.push(
            `Fiction/KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) plus ${Number(sourceScanned).toLocaleString()} source file(s) under server/, src/.`
        );
    }
    if (!scope.jestExecutedDuringScan) {
        notes.push(
            'Jest was not run during this scan — use `npm run simplebeacon:full` or `npm test` for live test verification.'
        );
    }
    if (scope.mockSampleFilesReconciledNote) {
        notes.push(scope.mockSampleFilesReconciledNote);
    }
    const mockSamples =
        (_e =
            (_d =
                (_c = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.mockSampleFiles) !==
                    null && _c !== void 0
                    ? _c
                    : sourceReport === null || sourceReport === void 0
                      ? void 0
                      : sourceReport.totalFiles) !== null && _d !== void 0
                ? _d
                : scope.mockSampleFilesInScanPaths) !== null && _e !== void 0
            ? _e
            : 0;
    const fictionSamples =
        (_g =
            (_f =
                sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fictionSampleFilesScanned) !==
                null && _f !== void 0
                ? _f
                : scope.fictionSampleFilesScanned) !== null && _g !== void 0
            ? _g
            : 0;
    if (mockSamples > 0 && fictionSamples === 0 && !scope.mockSampleFilesReconciledNote) {
        notes.push(
            // simplebeacon:production-leak-intent - legitimate sample path reference for fiction digest reporting
            `${mockSamples} mock-data path(s) exist in the tree — fiction KPI rules target *-sample.json filenames; none were counted in this pass.`
        );
    }
    const ruleScoped =
        (_j =
            (_h = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.ruleScopedFilesAnalyzed) !==
                null && _h !== void 0
                ? _h
                : scope.ruleScopedFilesAnalyzed) !== null && _j !== void 0
            ? _j
            : 0;
    if (
        (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.fullDirectoryScan) ||
        scope.fullDirectoryScan
    ) {
        notes.push(
            'Fiction digest sourced from intentional full-directory scan — rule-scoped counts include configured production paths (e.g. server/, src/).'
        );
    }
    if (
        ((_k = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null || _k === void 0
            ? void 0
            : _k.pass) &&
        ruleScoped > 0
    ) {
        notes.push(
            `Gate pass on ${Number(ruleScoped).toLocaleString()} rule-scoped files — fiction digest is hygiene only, not vendor handoff certification.`
        );
    } else if (
        ((_l = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null || _l === void 0
            ? void 0
            : _l.pass) &&
        ruleScoped === 0
    ) {
        notes.push(
            'Gate pass with zero rule-scoped files — limited-scope attestation; re-run on product root with gate profile.'
        );
    } else if (
        ((_m = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null || _m === void 0
            ? void 0
            : _m.pass) === false
    ) {
        const blocking =
            (_p = (_o = sourceReport.gate) === null || _o === void 0 ? void 0 : _o.blockingCount) !== null &&
            _p !== void 0
                ? _p
                : 0;
        if (blocking > 0) {
            notes.push(
                `Gate FAIL — ${Number(blocking).toLocaleString()} blocking finding(s) in bundled scan — fiction KPI rows are clean; see json/simplebeacon-gate.json for production-path evidence.`
            );
        }
    }
    const profile =
        gateProfile !== null && gateProfile !== void 0
            ? gateProfile
            : (_q = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                _q === void 0
              ? void 0
              : _q.profile;
    if (profile && !/^(gate|full-tree)$/i.test(String(profile))) {
        notes.push(
            `scanScope.profile (${profile}) reflects Complete scan rule bundle — fiction digest lists fiction-KPI rows only.`
        );
    }
    const ancillaryNote = formatAncillaryPatternHitsNote(sourceReport);
    if (ancillaryNote) {
        notes.push(ancillaryNote);
    }
    if ((digest.fictionIssues || []).length === 0 && (digest.nonFictionIssues || []).length === 0) {
        notes.push(
            ancillaryNote
                ? 'No fiction-KPI digest rows exported — ancillary pattern totals are in sourceReport.scanScope.fullDirectoryStats.ruleHitTotals.'
                : 'No fiction or ancillary pattern rows in digest export — see sourceReport.scanScope for scan limits.'
        );
    }
    return [...new Set(notes)].slice(0, 12);
}
/**
 * Enrich product source report.
 * @param {number} sourceReport
 * @returns {any}
 */
function enrichProductSourceReport(sourceReport) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!sourceReport || sourceReport.type !== 'simplebeacon-report') return sourceReport;
    const { gateAttestation: _gateAttestation, ...reportRest } = sourceReport;
    const intentionalFullTree = Boolean(
        sourceReport.fullDirectoryScan ||
        ((_a = sourceReport.scanScope) === null || _a === void 0 ? void 0 : _a.fullDirectoryScan)
    );
    const reportHealth = intentionalFullTree
        ? 'platform-scoped-full-tree'
        : ((_b = sourceReport.scanScope) === null || _b === void 0 ? void 0 : _b.reportHealth) || 'platform-scoped';
    const scanProfile = (_c = sourceReport.scanScope) === null || _c === void 0 ? void 0 : _c.profile;
    const fictionDigestProfileNote =
        scanProfile && !/^(gate|full-tree)$/i.test(String(scanProfile))
            ? `scanScope.profile (${scanProfile}) reflects Complete scan rule bundle — fiction digest lists fiction-KPI rows only.`
            : undefined;
    return {
        ...reportRest,
        scanTargetProfile: 'product',
        exportSanitized: true,
        handoffEligible: false,
        securityHandoffEligible: false,
        scanScope: {
            ...(sourceReport.scanScope || {}),
            resultsViewScope:
                ((_d = sourceReport.scanScope) === null || _d === void 0 ? void 0 : _d.resultsViewScope) ||
                'platform-only',
            reportHealth,
            rescanRecommended: intentionalFullTree
                ? false
                : Boolean((_e = sourceReport.scanScope) === null || _e === void 0 ? void 0 : _e.rescanRecommended),
            inventoryMetricsStale: intentionalFullTree
                ? false
                : (_g = (_f = sourceReport.scanScope) === null || _f === void 0 ? void 0 : _f.inventoryMetricsStale) !==
                        null && _g !== void 0
                  ? _g
                  : false,
            fictionDigestNote:
                'Fiction/KPI digest export — gate pass here does not replace Complete scan clearance bundle.',
            ...(fictionDigestProfileNote ? { fictionDigestProfileNote } : {})
        }
    };
}
/**
 * Resolve digest trust.
 * @param {any} benchmarkScan
 * @param {Array} fictionIssues
 * @param {number} sourceReport
 * @returns {any}
 */
function resolveDigestTrust(benchmarkScan, fictionIssues, sourceReport) {
    var _a, _b, _c, _d;
    if (benchmarkScan) return 'benchmark-clone';
    const fictionN = fictionIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);
    if (fictionN > 0) return 'review';
    const ruleScoped =
        (_c =
            (_a = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.ruleScopedFilesAnalyzed) !==
                null && _a !== void 0
                ? _a
                : (_b = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.scanScope) === null ||
                    _b === void 0
                  ? void 0
                  : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
            ? _c
            : 0;
    if (
        ((_d = sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.gate) === null || _d === void 0
            ? void 0
            : _d.pass) &&
        ruleScoped === 0
    )
        return 'limited-scope';
    return 'trustworthy';
}
/**
 * Sanitize source report for digest.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
function sanitizeSourceReportForDigest(report, projectPath) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!report || report.type !== 'simplebeacon-report') return report;
    const projectKey = String(report.projectRoot || projectPath || '').replace(/\\/g, '/');
    const benchmarkTarget = isBenchmarkPath(projectKey);
    const sourceIssues = ((_a = report.rawIssues) === null || _a === void 0 ? void 0 : _a.length)
        ? report.rawIssues
        : report.detectedIssues || [];
    const platformIssues = [];
    const benchmarkCloneNoiseIssues = [];
    const benchmarkScannerMetaIssues = [];
    for (const issue of sourceIssues) {
        const paths = [
            issue === null || issue === void 0 ? void 0 : issue.filePath,
            issue === null || issue === void 0 ? void 0 : issue.file,
            ...((issue === null || issue === void 0 ? void 0 : issue.affectedFiles) || [])
        ].filter(Boolean);
        if (paths.some(isBenchmarkPath)) continue;
        if (benchmarkTarget && isBenchmarkCloneNoiseIssue(issue)) {
            benchmarkCloneNoiseIssues.push(issue);
            continue;
        }
        if (benchmarkTarget && isBenchmarkScannerMetaIssue(issue)) {
            benchmarkScannerMetaIssues.push(issue);
            continue;
        }
        platformIssues.push(issue);
    }
    const gateConfig = report.gate ||
        ((_b = report.scanScope) === null || _b === void 0 ? void 0 : _b.gatePolicy) || {
            failOn: ['high'],
            warnOn: ['medium', 'low']
        };
    const blockingCount = platformIssues
        .filter(issue => (gateConfig.failOn || ['high']).includes(issue.severityBand || issue.severity))
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const warningCount = platformIssues
        .filter(issue => (gateConfig.warnOn || ['medium', 'low']).includes(issue.severityBand || issue.severity))
        .reduce((sum, issue) => sum + (issue.count || 1), 0);
    const ruleScoped =
        (_e =
            (_c = report.ruleScopedFilesAnalyzed) !== null && _c !== void 0
                ? _c
                : (_d = report.scanScope) === null || _d === void 0
                  ? void 0
                  : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0
            ? _e
            : 0;
    const gatePass = blockingCount === 0;
    const hollowGate = gatePass && ruleScoped === 0;
    const intentionalFullTree = Boolean(
        report.fullDirectoryScan || ((_f = report.scanScope) === null || _f === void 0 ? void 0 : _f.fullDirectoryScan)
    );
    const staleFullTreeScan = !benchmarkTarget && !intentionalFullTree && isStaleFullTreeScan(report);
    let normalizedReport = benchmarkTarget ? reconcileBenchmarkDigestScanMetrics(report) : report;
    const gateAttestation = benchmarkTarget ? resolveBenchmarkDigestGateAttestation(normalizedReport) : undefined;
    const scanScopeBase = {
        ...(normalizedReport.scanScope || {}),
        resultsViewScope: benchmarkTarget ? 'benchmark-clone' : 'platform-only',
        benchmarkScanTarget: benchmarkTarget || undefined,
        benchmarkCloneNoiseExcluded: benchmarkCloneNoiseIssues.length || undefined,
        benchmarkScannerMetaExcluded: benchmarkScannerMetaIssues.length || undefined,
        reportHealth: benchmarkTarget
            ? 'benchmark-clone-scan'
            : intentionalFullTree
              ? 'platform-scoped-full-tree'
              : staleFullTreeScan
                ? 'stale-full-tree-scan'
                : ((_g = report.scanScope) === null || _g === void 0 ? void 0 : _g.reportHealth) || 'platform-scoped',
        rescanRecommended: benchmarkTarget
            ? false
            : intentionalFullTree
              ? false
              : staleFullTreeScan ||
                Boolean((_h = report.scanScope) === null || _h === void 0 ? void 0 : _h.rescanRecommended),
        limitations: benchmarkTarget
            ? ['Scanning OSS benchmark clone under github-cache/ — Simplebeacon product gate paths were not evaluated.']
            : (_j = report.scanScope) === null || _j === void 0
              ? void 0
              : _j.limitations
    };
    const scanScope = benchmarkTarget
        ? sanitizeBenchmarkDigestScanScope(scanScopeBase, normalizedReport)
        : reconcileProductDigestScanScope(scanScopeBase, normalizedReport);
    const projectLabel = projectLabelFromPath(projectKey);
    return {
        ...normalizedReport,
        projectRoot: normalizeDigestProjectPaths(normalizedReport.projectRoot || projectKey, projectLabel),
        platformRoot: benchmarkTarget
            ? normalizeDigestProjectPaths(
                  normalizedReport.platformRoot || resolveProductPlatformRoot(projectKey),
                  projectLabel
              )
            : normalizeDigestProjectPaths(normalizedReport.platformRoot, projectLabel),
        rawIssues: platformIssues,
        detectedIssues: platformIssues.slice(0, 12),
        benchmarkCloneNoiseIssues: benchmarkCloneNoiseIssues.length ? benchmarkCloneNoiseIssues : undefined,
        benchmarkScannerMetaIssues: benchmarkScannerMetaIssues.length ? benchmarkScannerMetaIssues : undefined,
        issueCount: blockingCount,
        gate: { ...gateConfig, pass: gatePass, blockingCount, warningCount },
        ...(hollowGate && !benchmarkTarget ? { gateAttestation: 'limited-scope' } : {}),
        ...(benchmarkTarget ? { gateAttestation } : {}),
        scanScope,
        ...(benchmarkTarget
            ? {
                  benchmarkScan: true,
                  scanTargetProfile: 'benchmark-cache',
                  handoffEligible: false,
                  productPlatformRoot: normalizeDigestProjectPaths(resolveProductPlatformRoot(projectKey))
              }
            : {})
    };
}
/**
 * Sanitize fiction digest export.
 * @param {any} digest
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeFictionDigestExport(digest, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!digest || digest.type !== 'simplebeacon-fiction-digest') return digest;
    const hintedPath = inferDigestScanTargetFromHints(digest, options);
    const rawProjectPath = hintedPath || resolveDigestProjectPath(digest, options);
    const benchmarkScan = isBenchmarkFictionDigest(digest, { ...options, projectPath: rawProjectPath });
    const projectLabel = projectLabelFromPath(rawProjectPath);
    const projectPath = normalizeDigestProjectPaths(rawProjectPath, projectLabel);
    const rawPlatformRoot = benchmarkScan
        ? options.productPlatformRoot || resolveProductPlatformRoot(rawProjectPath)
        : null;
    const productPlatformRoot = rawPlatformRoot
        ? normalizeDigestProjectPaths(rawPlatformRoot, projectLabelFromPath(rawPlatformRoot))
        : null;
    const normalizedPath = projectPath;
    const scanTargetRoot = normalizedPath;
    const sourceReport = digest.sourceReport
        ? sanitizeSourceReportForDigest(digest.sourceReport, rawProjectPath)
        : null;
    const enrichedSourceReport = benchmarkScan ? sourceReport : enrichProductSourceReport(sourceReport);
    const fictionIssues = filterDigestIssues(digest.fictionIssues || [], benchmarkScan);
    const nonFictionIssues = filterDigestIssues(digest.nonFictionIssues || [], benchmarkScan);
    const digestTrust = resolveDigestTrust(benchmarkScan, fictionIssues, enrichedSourceReport);
    const fictionScopePreview = benchmarkScan ? buildBenchmarkFictionScopeSummary(enrichedSourceReport) : null;
    const ancillaryPatternSummary = benchmarkScan ? null : summarizeAncillaryPatternHits(enrichedSourceReport);
    const exportNotes = benchmarkScan
        ? buildBenchmarkFictionExportNotes(
              digest.exportNotes || [],
              (fictionScopePreview === null || fictionScopePreview === void 0
                  ? void 0
                  : fictionScopePreview.llmSlopScanReconciledFrom) != null
                  ? [
                        `LLM slop file count reconciled from ${fictionScopePreview.llmSlopScanReconciledFrom} to ${fictionScopePreview.llmSlopFilesScanned} clone inventory files on benchmark export.`
                    ]
                  : []
          )
        : buildProductFictionExportNotes(
              { ...digest, fictionIssues, nonFictionIssues, digestTrust },
              enrichedSourceReport,
              options
          );
    return {
        type: 'simplebeacon-fiction-digest',
        generatedAt: digest.generatedAt || new Date().toISOString(),
        conclusion: benchmarkScan
            ? buildBenchmarkFictionConclusion(fictionIssues, nonFictionIssues, enrichedSourceReport)
            : digest.conclusion,
        fictionIssues,
        nonFictionIssues,
        digestTrust,
        projectPath: normalizedPath,
        sourceProjectPath: normalizeDigestProjectPaths(digest.sourceProjectPath, projectLabel) || normalizedPath,
        ...(benchmarkScan
            ? {
                  benchmarkScan: true,
                  scanTargetProfile: 'benchmark-cache',
                  handoffEligible: false,
                  exportNormalized: true,
                  scanTargetRoot,
                  platformRoot: productPlatformRoot || undefined,
                  productPlatformRoot: productPlatformRoot || undefined,
                  gateAttestation: resolveBenchmarkDigestGateAttestation(enrichedSourceReport),
                  fictionScopeSummary: buildBenchmarkFictionScopeSummary(enrichedSourceReport)
              }
            : {
                  exportNormalized: true,
                  scanTargetProfile: 'product',
                  securityHandoffEligible: false,
                  handoffEligible: false,
                  gateAttestation: resolveProductFictionDigestGateAttestation(enrichedSourceReport),
                  fictionScopeSummary: {
                      fictionJsonFilesScanned:
                          (_c =
                              (_a =
                                  enrichedSourceReport === null || enrichedSourceReport === void 0
                                      ? void 0
                                      : enrichedSourceReport.fictionJsonFilesScanned) !== null && _a !== void 0
                                  ? _a
                                  : (_b =
                                          enrichedSourceReport === null || enrichedSourceReport === void 0
                                              ? void 0
                                              : enrichedSourceReport.scanScope) === null || _b === void 0
                                    ? void 0
                                    : _b.fictionJsonFilesScanned) !== null && _c !== void 0
                              ? _c
                              : null,
                      fictionSampleFilesScanned:
                          (_f =
                              (_d =
                                  enrichedSourceReport === null || enrichedSourceReport === void 0
                                      ? void 0
                                      : enrichedSourceReport.fictionSampleFilesScanned) !== null && _d !== void 0
                                  ? _d
                                  : (_e =
                                          enrichedSourceReport === null || enrichedSourceReport === void 0
                                              ? void 0
                                              : enrichedSourceReport.scanScope) === null || _e === void 0
                                    ? void 0
                                    : _e.fictionSampleFilesScanned) !== null && _f !== void 0
                              ? _f
                              : null,
                      sourceFictionPatternHits:
                          (_h =
                              (_g =
                                  enrichedSourceReport === null || enrichedSourceReport === void 0
                                      ? void 0
                                      : enrichedSourceReport.scanScope) === null || _g === void 0
                                  ? void 0
                                  : _g.sourceFictionPatternHits) !== null && _h !== void 0
                              ? _h
                              : 0,
                      jestExecutedDuringScan:
                          (_k =
                              (_j =
                                  enrichedSourceReport === null || enrichedSourceReport === void 0
                                      ? void 0
                                      : enrichedSourceReport.scanScope) === null || _j === void 0
                                  ? void 0
                                  : _j.jestExecutedDuringScan) !== null && _k !== void 0
                              ? _k
                              : false,
                      ...((
                          ancillaryPatternSummary === null || ancillaryPatternSummary === void 0
                              ? void 0
                              : ancillaryPatternSummary.ancillary
                      )
                          ? { ancillaryPatternHits: ancillaryPatternSummary.ancillary }
                          : {})
                  },
                  hygieneSummary: buildProductFictionHygieneSummary(
                      enrichedSourceReport,
                      {
                          ...digest,
                          fictionIssues,
                          nonFictionIssues,
                          digestTrust
                      },
                      options
                  ),
                  scanScope: buildProductFictionScanScope(
                      enrichedSourceReport,
                      {
                          ...digest,
                          fictionIssues,
                          nonFictionIssues,
                          digestTrust
                      },
                      options
                  )
              }),
        sourceReport: enrichedSourceReport,
        exportSanitized: true,
        exportNotes: exportNotes.length ? exportNotes : undefined
    };
}
