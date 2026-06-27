/**
 * Browser mirror of assessment-export-sanitize.js — keep in sync.
 */
/**
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactProjectPathForExport(rawPath, projectLabel = 'ai-platform') {
    if (rawPath == null || rawPath === '')
        return rawPath;
    const normalized = String(rawPath).replace(/\\/g, '/');
    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/Users/')
        || normalized.startsWith('/home/') || normalized.includes('CascadeProjects')) {
        return projectLabel;
    }
    return normalized;
}
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
/**
 * Is benchmark path.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkPath(projectPath) {
    return /\/github-cache\//i.test(String(projectPath || '').replace(/\\/g, '/'));
}
/**
 * Normalize simple beacon branding.
 * @param {any} value
 * @returns {any}
 */
function normalizeSimpleBeaconBranding(value) {
    return String(value !== null && value !== void 0 ? value : '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}
/**
 * Normalize assessment title.
 * @param {any} assessment
 * @param {any} projectLabel
 * @returns {any}
 */
function normalizeAssessmentTitle(assessment, projectLabel) {
    const raw = String((assessment === null || assessment === void 0 ? void 0 : assessment.title) || '');
    if (/Free Assessment/i.test(raw)) {
        return `SimpleBeacon Free Assessment — ${projectLabel}`;
    }
    if (/EU AI Act Readiness/i.test(raw)) {
        return `SimpleBeacon EU AI Act Readiness — ${projectLabel}`;
    }
    return normalizeSimpleBeaconBranding(raw) || `SimpleBeacon Assessment — ${projectLabel}`;
}
/**
 * Build files scanned note.
 * @param {any} executiveSummary
 * @returns {any}
 */
function buildFilesScannedNote(executiveSummary = {}) {
    const scoped = executiveSummary.ruleScopedFilesAnalyzed;
    const mock = executiveSummary.mockSampleFiles;
    if (scoped == null || mock == null || mock === 0)
        return null;
    if (scoped > mock * 10) {
        return 'filesScanned reflects gate rule scope — mock-path sample count is mockSampleFiles.';
    }
    return null;
}
/**
 * Build assessment export notes.
 * @param {any} assessment
 * @param {any} _projectLabel
 * @returns {any}
 */
function buildAssessmentExportNotes(assessment, _projectLabel) {
    var _a, _b;
    const notes = [];
    const exec = assessment.executiveSummary || {};
    const checklist = ((_a = assessment.complianceChecklist) === null || _a === void 0 ? void 0 : _a.summary) || {};
    const filesNote = buildFilesScannedNote(exec);
    if (filesNote)
        notes.push(filesNote);
    if (checklist.supplyChainSkipped && exec.gateResult === 'PASS') {
        notes.push('Supply-chain checklist rows skipped — run npm audit on Compliance Audit page for SUPPLY-001/002 evidence.');
    }
    if (exec.gateResult === 'PASS' && checklist.readyForAutomation) {
        notes.push('Gate hygiene and applicable checklist rules pass — not vendor handoff or Complete scan clearance.');
    }
    else if (exec.gateResult === 'FAIL') {
        notes.push(`Gate FAIL — ${(_b = exec.blockingCount) !== null && _b !== void 0 ? _b : 0} blocking finding(s). Review gate report detectedIssues before merge.`);
    }
    return [...new Set(notes)].slice(0, 6);
}
/**
 * Reconcile compliance ready.
 * @param {any} executiveSummary
 * @param {any} checklist
 * @param {number} sourceReport
 * @returns {any}
 */
function reconcileComplianceReady(executiveSummary, checklist, sourceReport) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const summary = (checklist === null || checklist === void 0 ? void 0 : checklist.summary) || {};
    let ready = (_b = (_a = summary.readyForAutomation) !== null && _a !== void 0 ? _a : executiveSummary.complianceReady) !== null && _b !== void 0 ? _b : false;
    if (!sourceReport)
        return ready;
    const ruleScoped = (_e = (_c = sourceReport.ruleScopedFilesAnalyzed) !== null && _c !== void 0 ? _c : (_d = sourceReport.scanScope) === null || _d === void 0 ? void 0 : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0 ? _e : 0;
    /**
     * Core security skipped.
     * @param {any} checklist?.rules || []
     * @returns {any}
     */
    const coreSecuritySkipped = ((checklist === null || checklist === void 0 ? void 0 : checklist.rules) || []).some((r) => ['GATE-001', 'CRED-001', 'LEAK-001'].includes(r.id) && r.status === 'skip');
    const gatePass = Boolean((_g = (_f = sourceReport.gate) === null || _f === void 0 ? void 0 : _f.pass) !== null && _g !== void 0 ? _g : executiveSummary.gateResult === 'PASS');
    if (gatePass
        && ruleScoped > 0
        && ((_h = summary.failed) !== null && _h !== void 0 ? _h : 0) === 0
        && ((_j = summary.passed) !== null && _j !== void 0 ? _j : 0) > 0
        && !coreSecuritySkipped) {
        return true;
    }
    return ready;
}
/**
 * Reconcile executive summary.
 * @param {any} assessment
 * @param {number} sourceReport
 * @returns {any}
 */
function reconcileExecutiveSummary(assessment, sourceReport) {
    var _a, _b, _c;
    const exec = { ...(assessment.executiveSummary || {}) };
    const checklist = assessment.complianceChecklist || {};
    exec.complianceReady = reconcileComplianceReady(exec, checklist, sourceReport);
    exec.complianceScore = (_c = (_b = (_a = checklist.summary) === null || _a === void 0 ? void 0 : _a.score) !== null && _b !== void 0 ? _b : exec.complianceScore) !== null && _c !== void 0 ? _c : null;
    const note = buildFilesScannedNote(exec);
    if (note)
        exec.filesScannedNote = note;
    return exec;
}
/**
 * Reconcile checklist export.
 * @param {any} checklist
 * @param {any} projectLabel
 * @param {number} sourceReport
 * @returns {any}
 */
function reconcileChecklistExport(checklist, projectLabel, sourceReport) {
    if (!checklist)
        return checklist;
    const summary = checklist.summary
        ? {
            ...checklist.summary,
            readyForAutomation: reconcileComplianceReady({}, checklist, sourceReport),
            headline: normalizeSimpleBeaconBranding(checklist.summary.headline)
        }
        : checklist.summary;
    return {
        ...checklist,
        title: normalizeSimpleBeaconBranding(checklist.title || 'SimpleBeacon Corporate Safety Checklist'),
        projectRoot: redactProjectPathForExport(checklist.projectRoot, projectLabel),
        summary
    };
}
/**
 * Sanitize assessment export.
 * @param {any} assessment
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeAssessmentExport(assessment, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
    if (!assessment || assessment.type !== 'simplebeacon-assessment-report')
        return assessment;
    const sourceReport = options.sourceReport || null;
    const projectLabel = projectLabelFromPath(options.projectPath
        || assessment.projectRoot
        || (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.projectRoot));
    const benchmarkScan = Boolean(options.benchmarkScan
        || assessment.benchmarkScan
        || (sourceReport === null || sourceReport === void 0 ? void 0 : sourceReport.benchmarkScan)
        || isBenchmarkPath(assessment.projectRoot));
    let executiveSummary = reconcileExecutiveSummary(assessment, sourceReport);
    if (sourceReport) {
        const ruleScoped = (_c = (_a = sourceReport.ruleScopedFilesAnalyzed) !== null && _a !== void 0 ? _a : (_b = sourceReport.scanScope) === null || _b === void 0 ? void 0 : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0 ? _c : null;
        const mockSampleFiles = (_e = (_d = sourceReport.mockSampleFiles) !== null && _d !== void 0 ? _d : sourceReport.totalFiles) !== null && _e !== void 0 ? _e : null;
        executiveSummary = {
            ...executiveSummary,
            filesScanned: (_g = (_f = ruleScoped !== null && ruleScoped !== void 0 ? ruleScoped : sourceReport.filesAnalyzed) !== null && _f !== void 0 ? _f : sourceReport.repositoryFilesTotal) !== null && _g !== void 0 ? _g : executiveSummary.filesScanned,
            mockSampleFiles,
            ruleScopedFilesAnalyzed: ruleScoped,
            repositoryFilesTotal: (_l = (_k = (_h = sourceReport.repositoryFilesTotal) !== null && _h !== void 0 ? _h : (_j = sourceReport.repositoryInventory) === null || _j === void 0 ? void 0 : _j.totalFiles) !== null && _k !== void 0 ? _k : executiveSummary.repositoryFilesTotal) !== null && _l !== void 0 ? _l : null,
            gateResult: ((_m = sourceReport.gate) === null || _m === void 0 ? void 0 : _m.pass) ? 'PASS' : 'FAIL',
            blockingCount: (_q = (_p = (_o = sourceReport.gate) === null || _o === void 0 ? void 0 : _o.blockingCount) !== null && _p !== void 0 ? _p : executiveSummary.blockingCount) !== null && _q !== void 0 ? _q : 0,
            warningCount: (_t = (_s = (_r = sourceReport.gate) === null || _r === void 0 ? void 0 : _r.warningCount) !== null && _s !== void 0 ? _s : executiveSummary.warningCount) !== null && _t !== void 0 ? _t : 0,
            qualityScore: (_v = (_u = sourceReport.qualityScore) !== null && _u !== void 0 ? _u : executiveSummary.qualityScore) !== null && _v !== void 0 ? _v : null
        };
        const note = buildFilesScannedNote(executiveSummary);
        if (note)
            executiveSummary.filesScannedNote = note;
    }
    const exportNotes = buildAssessmentExportNotes({ ...assessment, executiveSummary }, projectLabel);
    const { sourceReport: embeddedSource, ...rest } = assessment;
    const sanitizedSource = embeddedSource
        ? {
            generatedAt: (_w = embeddedSource.generatedAt) !== null && _w !== void 0 ? _w : null,
            scanPaths: (_x = embeddedSource.scanPaths) !== null && _x !== void 0 ? _x : null,
            duplicateGroups: (_y = embeddedSource.duplicateGroups) !== null && _y !== void 0 ? _y : null
        }
        : undefined;
    return {
        ...rest,
        title: normalizeAssessmentTitle(assessment, projectLabel),
        generatedBy: normalizeSimpleBeaconBranding(assessment.generatedBy || 'SimpleBeacon'),
        projectRoot: redactProjectPathForExport(assessment.projectRoot, projectLabel),
        executiveSummary: {
            ...executiveSummary,
            headline: normalizeSimpleBeaconBranding(executiveSummary.headline)
        },
        complianceChecklist: reconcileChecklistExport(assessment.complianceChecklist, projectLabel, sourceReport),
        ...(sanitizedSource ? { sourceReport: sanitizedSource } : {}),
        exportVersion: '1.1.0',
        exportSanitized: true,
        exportNormalized: true,
        benchmarkScan,
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
        handoffEligible: false,
        hygieneSummary: {
            gateResult: (_z = executiveSummary.gateResult) !== null && _z !== void 0 ? _z : null,
            complianceScore: (_0 = executiveSummary.complianceScore) !== null && _0 !== void 0 ? _0 : null,
            complianceReady: (_1 = executiveSummary.complianceReady) !== null && _1 !== void 0 ? _1 : false,
            filesScanned: (_2 = executiveSummary.filesScanned) !== null && _2 !== void 0 ? _2 : null,
            mockSampleFiles: (_3 = executiveSummary.mockSampleFiles) !== null && _3 !== void 0 ? _3 : null,
            benchmarkScan,
            attestationNote: benchmarkScan
                ? 'Benchmark clone assessment — not SimpleBeacon product handoff clearance.'
                : 'Assessment export — gate hygiene and checklist attestation only, not vendor handoff clearance.'
        },
        exportNotes,
        disclaimers: [
            ...(benchmarkScan
                ? ['Benchmark clone assessment — not SimpleBeacon ai-platform product handoff.']
                : []),
            'Assessment export maps scan signals to deploy-readiness checklist rows — not legal conformity certification.',
            'Findings items may be truncated in exports; use gate report detectedIssues for remediation detail.',
            'Absolute host paths are redacted to project label in exports.',
            'handoffEligible remains false — Complete scan clearance requires operator sign-off.'
        ],
        sanitized: true,
        sanitizedAt: new Date().toISOString()
    };
}
/**
 * Assessment export filename.
 * @param {any} date
 * @returns {any}
 */
export function assessmentExportFilename(date = new Date()) {
    return `simplebeacon-assessment-${date.toISOString().slice(0, 10)}.json`;
}
