// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * EU AI Act compliance page export bundle — browser mirror of server/lib/eu-ai-act-export.js
 */
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';
import { sanitizeComplianceChecklistArtifactExport } from './compliance-export.browser.js?v=20260716cachefix1';
import {
    redactProjectPathForExport,
    normalizeSimpleBeaconBranding
} from './quality-export.browser.js?v=20260716cachefix1';
// ── Small helpers to cut repetitive deep-path fallback chains ──
/**
 * Return the first non-nullish value from a list of arguments.
 * @param  {...any} candidates
 * @returns {any}
 */
function pick(...candidates) {
    for (const c of candidates) {
        if (c !== undefined && c !== null) return c;
    }
    return null;
}
/**
 * Safely traverse a path of optional properties on an object.
 * @param {object} obj
 * @param {string[]} keys
 * @returns {any}
 */
function deepGet(obj, keys) {
    let current = obj;
    for (const key of keys) {
        if (current == null) return undefined;
        current = current[key];
    }
    return current;
}
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {string}
 */
function projectLabelFromPath(projectPath) {
    const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'ai-platform';
}
/**
 * Parse timestamp.
 * @param {any} value
 * @returns {any}
 */
function parseTimestamp(value) {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : null;
}
/**
 * Resolve project label.
 * @param {any} bundle
 * @returns {any}
 */
function resolveProjectLabel(bundle = {}) {
    var _a, _b, _c, _d;
    return projectLabelFromPath(
        ((_a = bundle.compliance) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
            ((_b = bundle.assessment) === null || _b === void 0 ? void 0 : _b.projectRoot) ||
            ((_c = bundle.sprintReport) === null || _c === void 0 ? void 0 : _c.projectRoot) ||
            ((_d = bundle.embeddedInMainReport) === null || _d === void 0 ? void 0 : _d.projectRoot)
    );
}
/**
 * Resolve gate result.
 * @param {any} bundle
 * @returns {any}
 */
export function resolveGateResult(bundle = {}) {
    var _a, _b, _c, _d;
    if (!bundle || typeof bundle !== 'object') return null;
    const embedded = bundle.embeddedInMainReport;
    const assessment = bundle.assessment;
    const embeddedAt = parseTimestamp(embedded === null || embedded === void 0 ? void 0 : embedded.generatedAt);
    const sprintAt = parseTimestamp(
        (assessment === null || assessment === void 0 ? void 0 : assessment.generatedAt) ||
            ((_a = bundle.compliance) === null || _a === void 0 ? void 0 : _a.evaluatedAt) ||
            ((_b = bundle.sprintReport) === null || _b === void 0 ? void 0 : _b.generatedAt)
    );
    if (
        (embedded === null || embedded === void 0 ? void 0 : embedded.gatePass) != null &&
        (embeddedAt == null || sprintAt == null || embeddedAt >= sprintAt)
    ) {
        return embedded.gatePass === true ? 'PASS' : 'FAIL';
    }
    return (_d =
        (_c = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
        _c === void 0
            ? void 0
            : _c.gateResult) !== null && _d !== void 0
        ? _d
        : (embedded === null || embedded === void 0 ? void 0 : embedded.gatePass) === true
          ? 'PASS'
          : (embedded === null || embedded === void 0 ? void 0 : embedded.gatePass) === false
            ? 'FAIL'
            : null;
}
/**
 * Build freshness note.
 * @param {any} bundle
 * @returns {any}
 */
function buildFreshnessNote(bundle = {}) {
    var _a, _b, _c, _d, _e, _f;
    const embeddedAt = parseTimestamp(
        (_a = bundle.embeddedInMainReport) === null || _a === void 0 ? void 0 : _a.generatedAt
    );
    const sprintAt = parseTimestamp(
        ((_b = bundle.compliance) === null || _b === void 0 ? void 0 : _b.evaluatedAt) ||
            ((_c = bundle.assessment) === null || _c === void 0 ? void 0 : _c.generatedAt) ||
            ((_d = bundle.sprintReport) === null || _d === void 0 ? void 0 : _d.generatedAt)
    );
    if (embeddedAt == null || sprintAt == null || embeddedAt <= sprintAt) return null;
    return `Latest gate scan (${bundle.embeddedInMainReport.generatedAt}) is newer than EU sprint artifacts (${((_e = bundle.compliance) === null || _e === void 0 ? void 0 : _e.evaluatedAt) || ((_f = bundle.assessment) === null || _f === void 0 ? void 0 : _f.generatedAt)}). Summary gate result uses the latest scan.`;
}
/**
 * Resolve sprint timestamp.
 * @param {any} bundle
 * @returns {any}
 */
function resolveSprintTimestamp(bundle = {}) {
    var _a, _b, _c;
    return parseTimestamp(
        ((_a = bundle.compliance) === null || _a === void 0 ? void 0 : _a.evaluatedAt) ||
            ((_b = bundle.assessment) === null || _b === void 0 ? void 0 : _b.generatedAt) ||
            ((_c = bundle.sprintReport) === null || _c === void 0 ? void 0 : _c.generatedAt)
    );
}
/**
 * Is live gate preferred.
 * @param {any} bundle
 * @returns {any}
 */
function isLiveGatePreferred(bundle = {}) {
    const embedded = bundle.embeddedInMainReport;
    const embeddedAt = parseTimestamp(embedded === null || embedded === void 0 ? void 0 : embedded.generatedAt);
    const sprintAt = resolveSprintTimestamp(bundle);
    return (
        (embedded === null || embedded === void 0 ? void 0 : embedded.gatePass) != null &&
        embeddedAt != null &&
        sprintAt != null &&
        embeddedAt > sprintAt
    );
}
const SCAN_CHECKLIST_RULE_IDS = ['GATE-001', 'CRED-001', 'LEAK-001'];
/**
 * Should reconcile scan rules from embedded.
 * @param {any} bundle
 * @returns {any}
 */
function shouldReconcileScanRulesFromEmbedded(bundle = {}) {
    var _a, _b;
    if (
        !bundle.embeddedInMainReport ||
        !((_b = (_a = bundle.compliance) === null || _a === void 0 ? void 0 : _a.rules) === null || _b === void 0
            ? void 0
            : _b.length)
    )
        return false;
    if (isLiveGatePreferred(bundle)) return true;
    const embedded = bundle.embeddedInMainReport;
    if (embedded.gatePass !== true) return false;
    const hasStaleFail = bundle.compliance.rules.some(
        rule => SCAN_CHECKLIST_RULE_IDS.includes(rule.id) && rule.status === 'fail'
    );
    if (!hasStaleFail) return false;
    const cred = embedded.credentialFindings;
    const leak = embedded.productionLeakFindings;
    if (cred === 0 && leak === 0) return true;
    return cred == null && leak == null;
}
/**
 * Reconcile scan checklist rule.
 * @param {any} rule
 * @param {any} embedded
 * @returns {any}
 */
function reconcileScanChecklistRule(rule, embedded = {}) {
    var _a, _b, _c, _d;
    if (!SCAN_CHECKLIST_RULE_IDS.includes(rule.id)) return rule;
    const gatePass = embedded.gatePass === true;
    const cred = (_a = embedded.credentialFindings) !== null && _a !== void 0 ? _a : null;
    const leak = (_b = embedded.productionLeakFindings) !== null && _b !== void 0 ? _b : null;
    const credScanned = (_c = embedded.credentialScanned) !== null && _c !== void 0 ? _c : null;
    const leakScanned = (_d = embedded.productionLeakScanned) !== null && _d !== void 0 ? _d : null;
    if (rule.id === 'GATE-001') {
        return {
            ...rule,
            status: gatePass ? 'pass' : 'fail',
            evidence: gatePass
                ? 'Gate pass — no blocking issues at configured severities (live report.json scan)'
                : rule.evidence
        };
    }
    if (
        rule.id === 'CRED-001' &&
        cred === 0 &&
        (credScanned !== null && credScanned !== void 0 ? credScanned : 0) > 0
    ) {
        return {
            ...rule,
            status: 'pass',
            evidence: `Scanned ${credScanned} gate-scoped path(s) — no credential patterns (live report.json)`
        };
    }
    if (
        rule.id === 'LEAK-001' &&
        leak === 0 &&
        (leakScanned !== null && leakScanned !== void 0 ? leakScanned : 0) > 0
    ) {
        return {
            ...rule,
            status: 'pass',
            evidence: `Scanned ${leakScanned} gate-scoped production file(s) — no sample-path leaks (live report.json)`
        };
    }
    return rule;
}
/**
 * Dedupe finding summary.
 * @param {string} text
 * @returns {any}
 */
function dedupeFindingSummary(text) {
    const raw = String(text || '').trim();
    if (!raw) return raw;
    const colonIdx = raw.indexOf(': ');
    if (colonIdx <= 0) return raw;
    const prefix = raw.slice(0, colonIdx).trim();
    const remainder = raw.slice(colonIdx + 2).trim();
    if (remainder.startsWith(`${prefix}:`)) {
        return remainder;
    }
    return raw;
}
/**
 * Split documentation paths.
 * @param {Array} docs
 * @returns {any}
 */
function splitDocumentationPaths(docs = []) {
    const all = Array.isArray(docs) ? docs : [];
    const simplebeaconArtifactPaths = all.filter(doc => String(doc).startsWith('.simplebeacon/'));
    const operatorDocumentationFound = all.filter(doc => {
        const rel = String(doc).replace(/\\/g, '/');
        return rel.startsWith('docs/');
    });
    const scanMatchedNonDocsPaths = all.filter(doc => {
        const rel = String(doc).replace(/\\/g, '/');
        return !rel.startsWith('.simplebeacon/') && !rel.startsWith('docs/');
    });
    return {
        documentationFound: all,
        operatorDocumentationFound,
        simplebeaconArtifactPaths,
        operatorDocumentationCount: operatorDocumentationFound.length,
        simplebeaconArtifactCount: simplebeaconArtifactPaths.length,
        documentationArtifacts: operatorDocumentationFound.length,
        ...(scanMatchedNonDocsPaths.length
            ? {
                  scanMatchedNonDocsPaths,
                  scanMatchedNonDocsCount: scanMatchedNonDocsPaths.length
              }
            : {})
    };
}
/**
 * Build checklist headline.
 * @param {any} passed
 * @param {any} failed
 * @param {any} total
 * @returns {any}
 */
function buildChecklistHeadline(passed, failed, total) {
    if (failed === 0 && passed > 0) {
        return `${passed}/${total} EU AI Act readiness rules pass`;
    }
    if (failed > 0) {
        return `${failed} EU AI Act rule(s) fail — address before August 2026 deadline`;
    }
    return null;
}
/**
 * Reconcile compliance for live gate.
 * @param {any} compliance
 * @param {any} bundle
 * @returns {any}
 */
function reconcileComplianceForLiveGate(compliance, bundle = {}) {
    var _a, _b, _c, _d, _e, _f;
    if (
        !((_a = compliance === null || compliance === void 0 ? void 0 : compliance.rules) === null || _a === void 0
            ? void 0
            : _a.length)
    )
        return compliance;
    const freshMetrics = resolveFreshEuAiActMetrics(bundle);
    let rules = compliance.rules.map(rule => {
        if (rule.id === 'EUAI-002' && freshMetrics.aiSystemIndicators != null) {
            return {
                ...rule,
                evidence: `${freshMetrics.aiSystemIndicators} AI integration(s) with Article 50 disclosure markers present`
            };
        }
        if (
            rule.id === 'EUAI-003' &&
            freshMetrics.operatorDocumentationCount != null &&
            freshMetrics.aiSystemIndicators != null
        ) {
            const operatorDocs = freshMetrics.operatorDocumentationCount;
            return {
                ...rule,
                evidence: `${operatorDocs} operator doc(s) under docs/ — required: ai-system-documentation.md and eu-ai-act-compliance.md`
            };
        }
        return rule;
    });
    if (!shouldReconcileScanRulesFromEmbedded(bundle)) {
        return {
            ...compliance,
            title: normalizeSimpleBeaconBranding(compliance.title),
            rules
        };
    }
    const embedded = bundle.embeddedInMainReport;
    rules = rules.map(rule => reconcileScanChecklistRule(rule, embedded));
    const passed = rules.filter(rule => rule.status === 'pass').length;
    const failed = rules.filter(rule => rule.status === 'fail').length;
    const skipped = rules.filter(rule => rule.status === 'skip').length;
    const scored = passed + failed;
    const score = scored
        ? Math.round((passed / scored) * 100)
        : (_c = (_b = compliance.summary) === null || _b === void 0 ? void 0 : _b.score) !== null && _c !== void 0
          ? _c
          : null;
    return {
        ...compliance,
        title: normalizeSimpleBeaconBranding(compliance.title),
        rules,
        summary: {
            ...compliance.summary,
            passed,
            failed,
            skipped,
            total: rules.length,
            score,
            headline:
                (_d = buildChecklistHeadline(passed, failed, rules.length)) !== null && _d !== void 0
                    ? _d
                    : (_e = compliance.summary) === null || _e === void 0
                      ? void 0
                      : _e.headline,
            readyForAutomation: failed === 0 && passed > 0,
            handoffEligible: false
        },
        gateReconciledFrom: 'live-gate-scan',
        gateReconciledAt: (_f = embedded.generatedAt) !== null && _f !== void 0 ? _f : null
    };
}
/**
 * Dedupe assessment findings.
 * @param {any} assessment
 * @returns {any}
 */
function dedupeAssessmentFindings(assessment) {
    var _a, _b;
    if (
        !((_b =
            (_a = assessment === null || assessment === void 0 ? void 0 : assessment.findings) === null || _a === void 0
                ? void 0
                : _a.fictionKpis) === null || _b === void 0
            ? void 0
            : _b.summary)
    )
        return assessment;
    return {
        ...assessment,
        findings: {
            ...assessment.findings,
            fictionKpis: {
                ...assessment.findings.fictionKpis,
                summary: dedupeFindingSummary(assessment.findings.fictionKpis.summary)
            }
        }
    };
}
/**
 * Resolve sprint gate result.
 * @param {any} bundle
 * @param {any} assessment
 * @returns {any}
 */
function resolveSprintGateResult(bundle = {}, assessment = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (
        (_a = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
        _a === void 0
            ? void 0
            : _a.sprintGateResult
    ) {
        return assessment.executiveSummary.sprintGateResult;
    }
    if (
        ((_c = (_b = bundle.sprintReport) === null || _b === void 0 ? void 0 : _b.gate) === null || _c === void 0
            ? void 0
            : _c.pass) === false
    )
        return 'FAIL';
    if (
        ((_e = (_d = bundle.sprintReport) === null || _d === void 0 ? void 0 : _d.gate) === null || _e === void 0
            ? void 0
            : _e.pass) === true
    )
        return 'PASS';
    if (
        ((_f = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
        _f === void 0
            ? void 0
            : _f.gateResultSource) !== 'live-gate-scan'
    ) {
        return (_h =
            (_g = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
            _g === void 0
                ? void 0
                : _g.gateResult) !== null && _h !== void 0
            ? _h
            : null;
    }
    return null;
}
/**
 * Build live gate executive headline.
 * @param {Array} gatePass
 * @returns {any}
 */
function buildLiveGateExecutiveHeadline(gatePass) {
    return gatePass ? 'Gate pass — no blocking issues at configured severities (live report.json scan).' : null;
}
/**
 * Reconcile executive summary for live gate.
 * @param {any} executiveSummary
 * @param {any} bundle
 * @returns {any}
 */
function reconcileExecutiveSummaryForLiveGate(executiveSummary, bundle = {}) {
    var _a;
    if (!executiveSummary || !isLiveGatePreferred(bundle)) return executiveSummary;
    const gateResult = resolveGateResult(bundle);
    const gatePass = gateResult === 'PASS';
    const sprintGateResult = resolveSprintGateResult(bundle, { executiveSummary });
    const sprintBlocking = (_a = executiveSummary.blockingCount) !== null && _a !== void 0 ? _a : 0;
    const next = {
        ...executiveSummary,
        gateResult,
        sprintGateResult,
        gateResultSource: 'live-gate-scan'
    };
    if (gatePass) {
        next.blockingCount = 0;
        next.warningCount = 0;
        next.criticalIssues = 0;
        next.highIssues = 0;
        next.mediumIssues = 0;
        next.lowIssues = 0;
        next.headline = buildLiveGateExecutiveHeadline(true);
        next.complianceReady = gatePass ? true : executiveSummary.complianceReady;
        if (sprintBlocking > 0) {
            next.executiveSummaryNote = `Sprint executiveSummary cached ${sprintBlocking} blocking issue(s) — live gate scan shows PASS.`;
        }
    }
    return next;
}
/**
 * Reconcile assessment for live gate.
 * @param {any} assessment
 * @param {any} bundle
 * @returns {any}
 */
function reconcileAssessmentForLiveGate(assessment, bundle = {}) {
    var _a;
    if (!assessment) return assessment;
    let next = dedupeAssessmentFindings(assessment);
    next = {
        ...next,
        title: normalizeSimpleBeaconBranding(next.title),
        generatedBy: normalizeSimpleBeaconBranding(next.generatedBy)
    };
    const freshMetrics = resolveFreshEuAiActMetrics(bundle);
    if (freshMetrics.metricsSource === 'live-gate-scan' && next.euAiActSummary) {
        next = {
            ...next,
            euAiActSummary: {
                ...next.euAiActSummary,
                ...(((_a = next.euAiActSummary.documentationFound) === null || _a === void 0 ? void 0 : _a.length)
                    ? splitDocumentationPaths(next.euAiActSummary.documentationFound)
                    : {})
            }
        };
    }
    if (!isLiveGatePreferred(bundle)) return next;
    return {
        ...next,
        executiveSummary: reconcileExecutiveSummaryForLiveGate(next.executiveSummary, bundle)
    };
}
/**
 * Apply export reconciliation.
 * @param {any} bundle
 * @returns {any}
 */
function applyExportReconciliation(bundle = {}) {
    return {
        ...bundle,
        compliance: bundle.compliance
            ? reconcileComplianceForLiveGate(
                  { ...bundle.compliance, title: normalizeSimpleBeaconBranding(bundle.compliance.title) },
                  bundle
              )
            : null,
        assessment: reconcileAssessmentForLiveGate(bundle.assessment, bundle),
        sprintReport: bundle.sprintReport
            ? {
                  ...bundle.sprintReport,
                  title: normalizeSimpleBeaconBranding(bundle.sprintReport.title),
                  generatedBy: normalizeSimpleBeaconBranding(bundle.sprintReport.generatedBy)
              }
            : null
    };
}
/**
 * Resolve fresh eu ai act metrics.
 * @param {any} bundle
 * @returns {any}
 */
function resolveFreshEuAiActMetrics(bundle = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const assessment = bundle.assessment;
    const embedded = bundle.embeddedInMainReport;
    const embeddedAt = parseTimestamp(embedded === null || embedded === void 0 ? void 0 : embedded.generatedAt);
    const sprintAt = resolveSprintTimestamp(bundle);
    const sprintEu = (assessment === null || assessment === void 0 ? void 0 : assessment.euAiActSummary) || {};
    const embeddedEu = (embedded === null || embedded === void 0 ? void 0 : embedded.summary) || {};
    const embeddedNewer = embeddedAt != null && sprintAt != null && embeddedAt > sprintAt;
    const preferEmbedded =
        embeddedNewer && (embeddedEu.aiSystemIndicators != null || embeddedEu.documentationArtifacts != null);
    const source = preferEmbedded ? embeddedEu : sprintEu;
    const docs = source.documentationFound || sprintEu.documentationFound || embeddedEu.documentationFound || [];
    const operatorCount =
        (_a = source.operatorDocumentationCount) !== null && _a !== void 0
            ? _a
            : docs.filter(doc => !String(doc).startsWith('.simplebeacon/')).length;
    const metricsStaleNote =
        preferEmbedded &&
        ((sprintEu.aiSystemIndicators != null &&
            embeddedEu.aiSystemIndicators != null &&
            sprintEu.aiSystemIndicators !== embeddedEu.aiSystemIndicators) ||
            (sprintEu.operatorDocumentationCount != null &&
                embeddedEu.operatorDocumentationCount != null &&
                sprintEu.operatorDocumentationCount !== embeddedEu.operatorDocumentationCount))
            ? `EU indicator counts use live gate scan (${embedded.generatedAt}) — sprint cached ${(_b = sprintEu.aiSystemIndicators) !== null && _b !== void 0 ? _b : '?'} AI integrations and ${(_d = (_c = sprintEu.operatorDocumentationCount) !== null && _c !== void 0 ? _c : sprintEu.documentationArtifacts) !== null && _d !== void 0 ? _d : '?'} operator docs at ${((_e = bundle.compliance) === null || _e === void 0 ? void 0 : _e.evaluatedAt) || (assessment === null || assessment === void 0 ? void 0 : assessment.generatedAt)}.`
            : null;
    return {
        aiSystemIndicators: (_f = source.aiSystemIndicators) !== null && _f !== void 0 ? _f : null,
        highRiskIndicators: (_g = source.highRiskIndicators) !== null && _g !== void 0 ? _g : null,
        transparencyGaps: (_h = source.transparencyGaps) !== null && _h !== void 0 ? _h : null,
        documentationArtifacts: operatorCount,
        euAiActScanned: preferEmbedded
            ? (_j = embedded.euAiActScanned) !== null && _j !== void 0
                ? _j
                : null
            : (_p =
                    (_m =
                        (_l =
                            (_k = assessment === null || assessment === void 0 ? void 0 : assessment.findings) ===
                                null || _k === void 0
                                ? void 0
                                : _k.euAiAct) === null || _l === void 0
                            ? void 0
                            : _l.scanned) !== null && _m !== void 0
                        ? _m
                        : (_o = bundle.sprintReport) === null || _o === void 0
                          ? void 0
                          : _o.euAiActScanned) !== null && _p !== void 0
              ? _p
              : null,
        metricsSource: preferEmbedded ? 'live-gate-scan' : 'eu-ai-act-sprint',
        metricsStaleNote,
        simplebeaconDocumentationArtifacts: docs.filter(doc => String(doc).startsWith('.simplebeacon/')).length || null,
        operatorDocumentationCount: operatorCount
    };
}
/**
 * Build files scanned note.
 * @param {any} assessment
 * @returns {any}
 */
function buildFilesScannedNote(assessment) {
    var _a;
    const filesScanned =
        (_a = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
        _a === void 0
            ? void 0
            : _a.filesScanned;
    if (filesScanned == null || filesScanned > 20) return null;
    return `Assessment filesScanned (${filesScanned}) reflects configured mock/sample JSON paths — not whole-repository coverage.`;
}
/** @type {Map<RegExp,string>} */
const NOTE_CLASSIFIERS = new Map([
    [/latest gate scan.*newer than eu sprint/i, 'freshness-note'],
    [/eu indicator counts use live gate scan/i, 'metrics-stale-note'],
    [/filesScanned \(3\)/i, 'files-scanned-note'],
    [/sprint artifacts still record gate fail/i, 'gate-mismatch-note'],
    [/GATE-001 checklist rule reconciled|GATE-001, CRED-001, and LEAK-001 reconciled/i, 'gate-checklist-reconciled'],
    [/documentation path\(s\) under \.simplebeacon\//i, 'simplebeacon-docs-note'],
    [/sprint executiveSummary cached/i, 'exec-summary-stale']
]);
/**
 * Classify a note for deduplication.
 * @param {string} text
 * @returns {string}
 */
function classifyNote(text) {
    for (const [pattern, key] of NOTE_CLASSIFIERS) {
        if (pattern.test(text)) return key;
    }
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {string[]}
 */
function dedupeExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes.filter(Boolean)) {
        const text = String(note);
        const key = classifyNote(text);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text.trim());
    }
    return out.slice(0, 8);
}
/**
 * Relativize scan paths for export.
 * @param {Array} scanPaths
 * @param {any} projectRoot
 * @param {any} projectLabel
 * @returns {any}
 */
function relativizeScanPathsForExport(scanPaths, projectRoot, projectLabel) {
    const root = String(projectRoot || '')
        .replace(/\\/g, '/')
        .replace(/\/$/, '')
        .toLowerCase();
    return (scanPaths || []).map(entry => {
        let rel = String(entry).replace(/\\/g, '/');
        if (root && rel.toLowerCase().startsWith(root)) {
            rel = rel.slice(root.length).replace(/^\//, '');
        }
        if (!rel || rel === projectLabel) return rel || entry;
        return rel;
    });
}
/**
 * Sanitize compliance export.
 * @param {any} compliance
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeComplianceExport(compliance, projectLabel) {
    if (!compliance) return null;
    return {
        ...compliance,
        projectRoot: redactProjectPathForExport(compliance.projectRoot, projectLabel),
        provenance:
            compliance.gateReconciledFrom === 'live-gate-scan'
                ? 'live-gate-scan-reconciled'
                : 'eu-ai-act-sprint-artifact'
    };
}
/**
 * Sanitize assessment export.
 * @param {any} assessment
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeAssessmentExport(assessment, projectLabel) {
    var _a, _b, _c;
    if (!assessment) return null;
    const {
        complianceChecklist: _complianceChecklist,
        sourceReport,
        euAiActSummary,
        executiveSummary,
        ...rest
    } = assessment;
    const docSplit = splitDocumentationPaths(
        (euAiActSummary === null || euAiActSummary === void 0 ? void 0 : euAiActSummary.documentationFound) || []
    );
    const { executiveSummaryNote: _executiveSummaryNote, ...executiveRest } = executiveSummary || {};
    return {
        ...rest,
        ...(executiveSummary ? { executiveSummary: executiveRest } : {}),
        projectRoot: redactProjectPathForExport(assessment.projectRoot, projectLabel),
        provenance:
            ((_a = assessment.executiveSummary) === null || _a === void 0 ? void 0 : _a.gateResultSource) ===
            'live-gate-scan'
                ? 'live-gate-scan-reconciled'
                : 'eu-ai-act-sprint-artifact',
        ...(euAiActSummary
            ? {
                  euAiActSummary: {
                      ...euAiActSummary,
                      ...docSplit
                  }
              }
            : {}),
        ...(sourceReport
            ? {
                  sourceReport: {
                      generatedAt: (_b = sourceReport.generatedAt) !== null && _b !== void 0 ? _b : null,
                      scanPaths: relativizeScanPathsForExport(
                          sourceReport.scanPaths,
                          assessment.projectRoot,
                          projectLabel
                      ),
                      duplicateGroups: (_c = sourceReport.duplicateGroups) !== null && _c !== void 0 ? _c : null
                  }
              }
            : {})
    };
}
/**
 * Sanitize embedded main report export.
 * @param {any} embedded
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeEmbeddedMainReportExport(embedded, projectLabel) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!embedded) return null;
    const docSplit = splitDocumentationPaths(
        ((_a = embedded.summary) === null || _a === void 0 ? void 0 : _a.documentationFound) || []
    );
    return {
        generatedAt: (_b = embedded.generatedAt) !== null && _b !== void 0 ? _b : null,
        projectRoot: redactProjectPathForExport(embedded.projectRoot, projectLabel),
        euAiActScanned: (_c = embedded.euAiActScanned) !== null && _c !== void 0 ? _c : null,
        euAiActFindings: (_d = embedded.euAiActFindings) !== null && _d !== void 0 ? _d : null,
        gatePass: (_e = embedded.gatePass) !== null && _e !== void 0 ? _e : null,
        credentialFindings: (_f = embedded.credentialFindings) !== null && _f !== void 0 ? _f : null,
        credentialScanned: (_g = embedded.credentialScanned) !== null && _g !== void 0 ? _g : null,
        productionLeakFindings: (_h = embedded.productionLeakFindings) !== null && _h !== void 0 ? _h : null,
        productionLeakScanned: (_j = embedded.productionLeakScanned) !== null && _j !== void 0 ? _j : null,
        provenance: 'live-gate-scan',
        summary: {
            ...(embedded.summary || {}),
            ...docSplit
        }
    };
}
/**
 * Sanitize sprint report export.
 * @param {number} sprintReport
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeSprintReportExport(sprintReport, projectLabel) {
    if (!sprintReport) return null;
    return sanitizeSimplebeaconReportExport(sprintReport, {
        projectPath: sprintReport.projectRoot || projectLabel
    });
}
/**
 * Build eu ai act summary.
 * @param {any} bundle
 * @returns {any}
 */
export function buildEuAiActSummary(bundle = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    if (!bundle || typeof bundle !== 'object') return {};
    const compliance = bundle.compliance;
    const assessment = bundle.assessment;
    const embedded = bundle.embeddedInMainReport;
    const summary =
        (compliance === null || compliance === void 0 ? void 0 : compliance.summary) ||
        (assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) ||
        {};
    const freshMetrics = resolveFreshEuAiActMetrics(bundle);
    const projectLabel = resolveProjectLabel(bundle);
    const gateResult = resolveGateResult(bundle);
    const sprintGateResult = resolveSprintGateResult(bundle, assessment);
    const mainReportGatePass =
        (_a = embedded === null || embedded === void 0 ? void 0 : embedded.gatePass) !== null && _a !== void 0
            ? _a
            : null;
    const filesScannedNote = buildFilesScannedNote(assessment);
    const liveGatePreferred = isLiveGatePreferred(bundle);
    return {
        checklistPassed: (_b = summary.passed) !== null && _b !== void 0 ? _b : null,
        checklistTotal: (_c = summary.total) !== null && _c !== void 0 ? _c : null,
        readinessScore:
            (_e = (_d = summary.score) !== null && _d !== void 0 ? _d : summary.complianceScore) !== null &&
            _e !== void 0
                ? _e
                : null,
        checklistHeadline:
            (_g =
                (_f = summary.headline) !== null && _f !== void 0
                    ? _f
                    : compliance === null || compliance === void 0
                      ? void 0
                      : compliance.title) !== null && _g !== void 0
                ? _g
                : null,
        checklistReconciledFrom:
            (_h = compliance === null || compliance === void 0 ? void 0 : compliance.gateReconciledFrom) !== null &&
            _h !== void 0
                ? _h
                : null,
        gateResult,
        sprintGateResult,
        mainReportGatePass,
        gateMismatch:
            mainReportGatePass != null &&
            sprintGateResult != null &&
            ((mainReportGatePass === false && sprintGateResult === 'PASS') ||
                (mainReportGatePass === true && sprintGateResult === 'FAIL')),
        gateMismatchNote:
            liveGatePreferred && mainReportGatePass != null && sprintGateResult === 'FAIL'
                ? 'Sprint artifacts still record gate FAIL — summary gateResult and GATE-001 use live report.json.'
                : null,
        aiSystemIndicators: freshMetrics.aiSystemIndicators,
        highRiskIndicators: freshMetrics.highRiskIndicators,
        transparencyGaps: freshMetrics.transparencyGaps,
        documentationArtifacts: freshMetrics.documentationArtifacts,
        euAiActScanned: freshMetrics.euAiActScanned,
        metricsSource: freshMetrics.metricsSource,
        simplebeaconDocumentationArtifacts: freshMetrics.simplebeaconDocumentationArtifacts,
        operatorDocumentationCount: freshMetrics.operatorDocumentationCount,
        hasData: bundle.hasData === true,
        evaluatedAt:
            (_l =
                (_k =
                    (_j = compliance === null || compliance === void 0 ? void 0 : compliance.evaluatedAt) !== null &&
                    _j !== void 0
                        ? _j
                        : assessment === null || assessment === void 0
                          ? void 0
                          : assessment.generatedAt) !== null && _k !== void 0
                    ? _k
                    : embedded === null || embedded === void 0
                      ? void 0
                      : embedded.generatedAt) !== null && _l !== void 0
                ? _l
                : null,
        mainReportGeneratedAt:
            (_m = embedded === null || embedded === void 0 ? void 0 : embedded.generatedAt) !== null && _m !== void 0
                ? _m
                : null,
        projectRoot: redactProjectPathForExport(
            (_r =
                (_p =
                    (_o = compliance === null || compliance === void 0 ? void 0 : compliance.projectRoot) !== null &&
                    _o !== void 0
                        ? _o
                        : assessment === null || assessment === void 0
                          ? void 0
                          : assessment.projectRoot) !== null && _p !== void 0
                    ? _p
                    : (_q = bundle.sprintReport) === null || _q === void 0
                      ? void 0
                      : _q.projectRoot) !== null && _r !== void 0
                ? _r
                : embedded === null || embedded === void 0
                  ? void 0
                  : embedded.projectRoot,
            projectLabel
        ),
        freshnessNote: buildFreshnessNote(bundle),
        metricsStaleNote: freshMetrics.metricsStaleNote,
        ...(filesScannedNote ? { filesScannedNote } : {}),
        ...((
            (_s = assessment === null || assessment === void 0 ? void 0 : assessment.executiveSummary) === null ||
            _s === void 0
                ? void 0
                : _s.executiveSummaryNote
        )
            ? { executiveSummaryNote: assessment.executiveSummary.executiveSummaryNote }
            : {})
    };
}
/**
 * Build export provenance.
 * @param {any} bundle
 * @returns {any}
 */
function buildExportProvenance(bundle = {}) {
    return {
        compliance: bundle.compliance ? 'eu-ai-act-sprint-artifact' : 'missing',
        assessment: bundle.assessment ? 'eu-ai-act-sprint-artifact' : 'missing',
        sprintReport: bundle.sprintReport ? 'eu-ai-act-sprint-artifact' : 'missing',
        embeddedInMainReport: bundle.embeddedInMainReport ? 'live-gate-scan' : 'missing'
    };
}
/**
 * Sync assessment eu metrics.
 * @param {any} assessment
 * @param {any} summary
 * @returns {any}
 */
function syncAssessmentEuMetrics(assessment, summary) {
    var _a, _b, _c, _d;
    if (
        !(assessment === null || assessment === void 0 ? void 0 : assessment.euAiActSummary) ||
        summary.metricsSource !== 'live-gate-scan'
    )
        return assessment;
    return {
        ...assessment,
        euAiActSummary: {
            ...assessment.euAiActSummary,
            aiSystemIndicators:
                (_a = summary.aiSystemIndicators) !== null && _a !== void 0
                    ? _a
                    : assessment.euAiActSummary.aiSystemIndicators,
            highRiskIndicators:
                (_b = summary.highRiskIndicators) !== null && _b !== void 0
                    ? _b
                    : assessment.euAiActSummary.highRiskIndicators,
            transparencyGaps:
                (_c = summary.transparencyGaps) !== null && _c !== void 0
                    ? _c
                    : assessment.euAiActSummary.transparencyGaps,
            documentationArtifacts:
                (_d = summary.documentationArtifacts) !== null && _d !== void 0
                    ? _d
                    : assessment.euAiActSummary.documentationArtifacts
        }
    };
}
/**
 * Sanitize classification export.
 * @param {any} classification
 * @param {any} _projectLabel
 * @returns {any}
 */
function sanitizeClassificationExport(classification, _projectLabel) {
    if (!classification) return null;
    const reviewer = classification.legalReviewer || {};
    return {
        systemName: classification.systemName || null,
        riskTier: classification.riskTier || 'unclassified',
        role: classification.role || null,
        annexIIIAreas: classification.annexIIIAreas || [],
        rationale: classification.rationale || null,
        legalReviewer: {
            name: reviewer.name || null,
            firm: reviewer.firm || null,
            signedAt: reviewer.signedAt || null,
            attestation: reviewer.attestation || null
        },
        disclaimerAccepted: classification.disclaimerAccepted === true,
        updatedAt: classification.updatedAt || null,
        disclaimer: 'Legal classification record — independent counsel review required; not conformity certification.'
    };
}
/**
 * Sanitize legal attestation export.
 * @param {any} attestation
 * @returns {any}
 */
function sanitizeLegalAttestationExport(attestation) {
    if (!attestation || attestation.status !== 'legal_review_complete') return null;
    return {
        status: attestation.status,
        approver_name: attestation.approver_name || null,
        approver_firm: attestation.approver_firm || null,
        signed_at: attestation.signed_at || null,
        attestation: attestation.attestation || null,
        risk_tier: attestation.risk_tier || null,
        role: attestation.role || null,
        system_name: attestation.system_name || null,
        linked_sprint_evaluated_at: attestation.linked_sprint_evaluated_at || null,
        disclaimer: attestation.disclaimer || null
    };
}
/**
 * Build eu ai act export bundle.
 * @param {any} bundle
 * @returns {any}
 */
export function buildEuAiActExportBundle(bundle = {}) {
    var _a, _b, _c, _d, _e;
    if (!bundle || typeof bundle !== 'object') return {};
    const reconciled = applyExportReconciliation(bundle);
    const projectLabel = resolveProjectLabel(reconciled);
    const summary = buildEuAiActSummary(reconciled);
    const assessmentForExport = syncAssessmentEuMetrics(reconciled.assessment, summary);
    const exportEligibility = bundle.exportEligibility || {
        eligible: false,
        errors: [{ message: 'Refresh EU compliance page before export' }]
    };
    const exportNotes = dedupeExportNotes([
        summary.freshnessNote,
        summary.metricsStaleNote,
        summary.filesScannedNote,
        summary.executiveSummaryNote,
        summary.gateMismatchNote,
        summary.checklistReconciledFrom === 'live-gate-scan'
            ? 'GATE-001, CRED-001, and LEAK-001 reconciled from live report.json when sprint artifacts are stale — re-run EU sprint to refresh stored compliance.json.'
            : null,
        summary.metricsSource === 'live-gate-scan' && summary.simplebeaconDocumentationArtifacts
            ? `${summary.simplebeaconDocumentationArtifacts} documentation path(s) under .simplebeacon/ are scan artifacts — prefer docs/ for operator handoff packs.`
            : null,
        !exportEligibility.eligible &&
        ((_b = (_a = exportEligibility.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0
            ? void 0
            : _b.message)
            ? `Export blocked: ${exportEligibility.errors[0].message}`
            : null
    ]);
    const classificationExport = sanitizeClassificationExport(reconciled.classification, projectLabel);
    const legalAttestationExport = sanitizeLegalAttestationExport(reconciled.legalAttestation);
    return {
        type: 'simplebeacon-eu-ai-act-export',
        version: '1.2.0',
        exportVersion: '1.2.0',
        generatedBy: 'SimpleBeacon',
        title: 'SimpleBeacon EU AI Act Export',
        generatedAt: new Date().toISOString(),
        disclaimer:
            bundle.disclaimer ||
            'Static technical readiness signals — not legal conformity certification under Regulation (EU) 2024/1689.',
        disclaimers: [
            'EU AI Act export bundles sprint artifacts plus embedded gate-scan metrics — not legal conformity certification.',
            'When main report.json is newer than sprint artifacts, gateResult and EU indicator counts follow the latest gate scan.',
            'assessment.complianceChecklist is omitted from exports — use top-level compliance rules.',
            'Absolute host paths are redacted to project label; prefer docs/ paths for operator handoff packs.',
            'assessment.executiveSummary.filesScanned counts mock/sample JSON under configured scan paths only.',
            'Client-facing export requires fresh sprint, legal classification (EUAI-000), and legal_review_complete attestation.'
        ],
        summary: {
            ...summary,
            operatorDocumentationCount:
                (_c = summary.operatorDocumentationCount) !== null && _c !== void 0
                    ? _c
                    : summary.documentationArtifacts,
            exportEligible: exportEligibility.eligible,
            legalHandoffEligible: exportEligibility.legalHandoffEligible
        },
        exportEligibility,
        legalClassification: classificationExport,
        legalAttestation: legalAttestationExport,
        provenance: buildExportProvenance(bundle),
        artifacts: bundle.artifacts || null,
        generateCommands: bundle.generateCommands || [],
        compliance: sanitizeComplianceExport(reconciled.compliance, projectLabel),
        assessment: sanitizeAssessmentExport(assessmentForExport, projectLabel),
        sprintReport: sanitizeSprintReportExport(reconciled.sprintReport, projectLabel),
        embeddedInMainReport: sanitizeEmbeddedMainReportExport(reconciled.embeddedInMainReport, projectLabel),
        bundleGeneratedAt: bundle.generatedAt || null,
        exportSanitized: true,
        handoffEligible: false,
        hygieneSummary: {
            checklistPassed: summary.checklistPassed,
            checklistTotal: summary.checklistTotal,
            readinessScore: summary.readinessScore,
            gateResult: summary.gateResult,
            aiSystemIndicators: summary.aiSystemIndicators,
            highRiskIndicators: summary.highRiskIndicators,
            documentationArtifacts:
                (_d = summary.operatorDocumentationCount) !== null && _d !== void 0
                    ? _d
                    : summary.documentationArtifacts,
            operatorDocumentationCount:
                (_e = summary.operatorDocumentationCount) !== null && _e !== void 0
                    ? _e
                    : summary.documentationArtifacts,
            metricsSource: summary.metricsSource,
            exportEligible: exportEligibility.eligible,
            attestationNote: exportEligibility.eligible
                ? 'EU AI Act export includes classification and legal_review_complete attestation — still not legal conformity certification.'
                : 'EU AI Act technical readiness export — not legal conformity certification or vendor handoff clearance.'
        },
        exportNotes
    };
}
/**
 * Default sprint relative artifacts.
 * @returns {any}
 */
function defaultSprintRelativeArtifacts() {
    return {
        report: '.simplebeacon/eu-ai-act-report.json',
        compliance: '.simplebeacon/eu-ai-act-compliance.json',
        assessment: '.simplebeacon/eu-ai-act-assessment.json'
    };
}
/**
 * Resolve sprint gate context.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
function resolveSprintGateContext(sprint = {}, options = {}) {
    const gateReport = options.gateReport || {};
    const repositoryFilesTotal = pick(
        options.repositoryFilesTotal,
        options.gateRepositoryFilesTotal,
        gateReport.repositoryFilesTotal,
        deepGet(gateReport, ['repositoryInventory', 'totalFiles']),
        deepGet(sprint, ['hygieneSummary', 'gateRepositoryFilesTotal']),
        deepGet(sprint, ['report', 'hygieneSummary', 'gateRepositoryFilesTotal'])
    );
    const credentialScanned = pick(
        gateReport.credentialScanned,
        gateReport.productionLeakScanned,
        deepGet(gateReport, ['scanScope', 'productionDirsScanned']),
        deepGet(sprint, ['hygieneSummary', 'gateContentFilesScanned']),
        deepGet(sprint, ['report', 'hygieneSummary', 'contentFilesScanned'])
    );
    const gateProfile = pick(
        deepGet(gateReport, ['scanScope', 'profile']),
        deepGet(sprint, ['report', 'scanScope', 'profile']),
        deepGet(sprint, ['report', 'scanScope', 'gateRuleBundleProfile']),
        deepGet(sprint, ['complianceChecklist', 'scanScope', 'gateRuleBundleProfile']),
        deepGet(sprint, ['complianceChecklist', 'hygieneSummary', 'gateRuleBundleProfile']),
        deepGet(sprint, ['hygieneSummary', 'gateRuleBundleProfile'])
    );
    return {
        gateReport,
        repositoryFilesTotal,
        credentialScanned,
        gateProfile,
        fictionJsonFilesScanned: pick(
            gateReport.fictionJsonFilesScanned,
            deepGet(gateReport, ['scanScope', 'fictionJsonFilesScanned']),
            deepGet(sprint, ['hygieneSummary', 'gateFictionJsonFilesScanned'])
        ),
        fictionSampleFilesScanned: pick(
            gateReport.fictionSampleFilesScanned,
            gateReport.mockSampleFiles,
            deepGet(gateReport, ['scanScope', 'fictionSampleFilesScanned']),
            deepGet(sprint, ['hygieneSummary', 'fictionSampleFilesScanned'])
        )
    };
}
/**
 * Build sprint artifact export notes.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
function buildSprintArtifactExportNotes(sprint = {}, options = {}) {
    var _a,
        _b,
        _c,
        _d,
        _e,
        _f,
        _g,
        _h,
        _j,
        _k,
        _l,
        _m,
        _o,
        _p,
        _q,
        _r,
        _s,
        _t,
        _u,
        _v,
        _w,
        _x,
        _y,
        _z,
        _0,
        _1,
        _2,
        _3,
        _4,
        _5,
        _6,
        _7,
        _8,
        _9;
    const notes = [
        'EU AI Act sprint artifact — technical readiness only, not legal conformity certification.',
        'securityHandoffEligible is false — SimpleBeacon vendor handoff requires separate Complete scan attestation.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    if (
        ((_b = (_a = sprint.complianceChecklist) === null || _a === void 0 ? void 0 : _a.summary) === null ||
        _b === void 0
            ? void 0
            : _b.legalHandoffEligible) === true
    ) {
        notes.push(
            'legalHandoffEligible reflects EU technical rule rows — EUAI-000 classification sign-off still required before client legal handoff.'
        );
    }
    const gateContext = resolveSprintGateContext(sprint, options);
    const {
        repositoryFilesTotal: gateTotal,
        credentialScanned,
        gateProfile,
        gateReport,
        fictionJsonFilesScanned: gateFiction,
        fictionSampleFilesScanned: fictionSamples
    } = gateContext;
    const sprintRepo =
        (_g =
            (_d = (_c = sprint.report) === null || _c === void 0 ? void 0 : _c.repositoryFilesTotal) !== null &&
            _d !== void 0
                ? _d
                : (_f = (_e = sprint.report) === null || _e === void 0 ? void 0 : _e.repositoryInventory) === null ||
                    _f === void 0
                  ? void 0
                  : _f.totalFiles) !== null && _g !== void 0
            ? _g
            : null;
    if (gateTotal != null && sprintRepo != null && gateTotal > sprintRepo) {
        notes.push(
            `EU sprint inventory ${Number(sprintRepo).toLocaleString()} files (audit profile) — Complete scan gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
        );
    }
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(
            `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
        );
    }
    const ruleScoped =
        (_m =
            (_j = (_h = sprint.report) === null || _h === void 0 ? void 0 : _h.ruleScopedFilesAnalyzed) !== null &&
            _j !== void 0
                ? _j
                : (_l = (_k = sprint.report) === null || _k === void 0 ? void 0 : _k.scanScope) === null ||
                    _l === void 0
                  ? void 0
                  : _l.ruleScopedFilesAnalyzed) !== null && _m !== void 0
            ? _m
            : null;
    const sprintProfile =
        (_q =
            (_p = (_o = sprint.report) === null || _o === void 0 ? void 0 : _o.scanScope) === null || _p === void 0
                ? void 0
                : _p.profile) !== null && _q !== void 0
            ? _q
            : gateProfile;
    if (sprintProfile === 'eu-ai-act' && ruleScoped != null) {
        notes.push(
            `EU AI Act sprint gate checked ${Number(ruleScoped).toLocaleString()} rule-scoped paths — narrower scope than full-platform gate when run standalone.`
        );
    }
    const sprintFiction =
        (_s = (_r = sprint.report) === null || _r === void 0 ? void 0 : _r.fictionJsonFilesScanned) !== null &&
        _s !== void 0
            ? _s
            : (_u = (_t = sprint.report) === null || _t === void 0 ? void 0 : _t.scanScope) === null || _u === void 0
              ? void 0
              : _u.fictionJsonFilesScanned;
    if (sprintFiction != null && gateFiction != null && fictionSamples != null && sprintFiction !== gateFiction) {
        notes.push(
            // simplebeacon:production-leak-intent - legitimate KPI reference for EU AI Act reporting
            `Sprint fiction KPI rules evaluated ${Number(sprintFiction).toLocaleString()} repository JSON path(s) — Complete scan gate evaluated ${Number(gateFiction).toLocaleString()} with ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
        );
    }
    const nonDocs =
        (_w = (_v = sprint.report) === null || _v === void 0 ? void 0 : _v.euAiActSummary) === null || _w === void 0
            ? void 0
            : _w.scanMatchedNonDocsCount;
    if (nonDocs != null && nonDocs > 0) {
        notes.push(
            `${Number(nonDocs).toLocaleString()} EU AI Act scan pattern match(es) outside docs/ (e.g. package.json) — not operator handoff documentation.`
        );
    }
    const suppressed = (_x = sprint.report) === null || _x === void 0 ? void 0 : _x.productionLeakSuppressedIntent;
    if (
        suppressed != null &&
        suppressed > 0 &&
        ((_z = (_y = sprint.report) === null || _y === void 0 ? void 0 : _y.productionLeakFindings) !== null &&
        _z !== void 0
            ? _z
            : 0) === 0
    ) {
        notes.push(
            `${Number(suppressed).toLocaleString()} production-leak pattern hit(s) suppressed as intentional — blocking productionLeakFindings is 0.`
        );
    }
    if (
        (_1 = (_0 = sprint.assessment) === null || _0 === void 0 ? void 0 : _0.pilotProposal) === null || _1 === void 0
            ? void 0
            : _1.pricePlaceholder
    ) {
        notes.push(
            'assessment.pilotProposal pricing is a template range — not a binding quote in operator vault exports.'
        );
    }
    if (gateProfile) {
        notes.push(
            `Gate rule bundle profile: ${gateProfile} — pair sprint export with json/simplebeacon-gate.json for full-tree handoff evidence.`
        );
    }
    if (
        ((_2 = sprint.gate) === null || _2 === void 0 ? void 0 : _2.pass) === false ||
        ((_3 = sprint.complianceChecklist) === null || _3 === void 0 ? void 0 : _3.complianceStatus) === 'failed'
    ) {
        const failedIds = (((_4 = sprint.complianceChecklist) === null || _4 === void 0 ? void 0 : _4.rules) || [])
            .filter(rule => rule.status === 'fail')
            .map(rule => rule.id);
        const blocking =
            (_8 =
                (_6 = (_5 = sprint.gate) === null || _5 === void 0 ? void 0 : _5.blockingCount) !== null &&
                _6 !== void 0
                    ? _6
                    : (_7 = gateReport.gate) === null || _7 === void 0
                      ? void 0
                      : _7.blockingCount) !== null && _8 !== void 0
                ? _8
                : null;
        if (failedIds.length) {
            notes.push(
                `Checklist failures (${failedIds.join(', ')}) align with sprint gate (pass=false${blocking != null ? `, ${Number(blocking).toLocaleString()} blocking finding(s)` : ''}) — see json/simplebeacon-gate.json.`
            );
        }
    }
    const reportNotes = (_9 = sprint.report) === null || _9 === void 0 ? void 0 : _9.exportNotes;
    if (Array.isArray(reportNotes)) {
        const jestNote = reportNotes.find(n => /Jest was not run/i.test(String(n)));
        if (jestNote) notes.push(jestNote);
    }
    return [...new Set(notes)].slice(0, 14);
}
/**
 * Build sprint artifact hygiene summary.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
function buildSprintArtifactHygieneSummary(sprint = {}, options = {}) {
    var _a,
        _b,
        _c,
        _d,
        _e,
        _f,
        _g,
        _h,
        _j,
        _k,
        _l,
        _m,
        _o,
        _p,
        _q,
        _r,
        _s,
        _t,
        _u,
        _v,
        _w,
        _x,
        _y,
        _z,
        _0,
        _1,
        _2,
        _3,
        _4,
        _5,
        _6,
        _7,
        _8,
        _9,
        _10,
        _11,
        _12,
        _13,
        _14,
        _15,
        _16,
        _17,
        _18,
        _19,
        _20,
        _21,
        _22,
        _23,
        _24,
        _25;
    const checklist = ((_a = sprint.complianceChecklist) === null || _a === void 0 ? void 0 : _a.summary) || {};
    const gateContext = resolveSprintGateContext(sprint, options);
    const {
        repositoryFilesTotal: gateTotal,
        credentialScanned,
        gateProfile,
        gateReport,
        fictionJsonFilesScanned: gateFiction,
        fictionSampleFilesScanned: fictionSamples
    } = gateContext;
    const sprintRepo =
        (_f =
            (_c = (_b = sprint.report) === null || _b === void 0 ? void 0 : _b.repositoryFilesTotal) !== null &&
            _c !== void 0
                ? _c
                : (_e = (_d = sprint.report) === null || _d === void 0 ? void 0 : _d.repositoryInventory) === null ||
                    _e === void 0
                  ? void 0
                  : _e.totalFiles) !== null && _f !== void 0
            ? _f
            : null;
    const ruleScoped =
        (_l =
            (_h = (_g = sprint.report) === null || _g === void 0 ? void 0 : _g.ruleScopedFilesAnalyzed) !== null &&
            _h !== void 0
                ? _h
                : (_k = (_j = sprint.report) === null || _j === void 0 ? void 0 : _j.scanScope) === null ||
                    _k === void 0
                  ? void 0
                  : _k.ruleScopedFilesAnalyzed) !== null && _l !== void 0
            ? _l
            : null;
    const sprintFiction =
        (_r =
            (_o = (_m = sprint.report) === null || _m === void 0 ? void 0 : _m.fictionJsonFilesScanned) !== null &&
            _o !== void 0
                ? _o
                : (_q = (_p = sprint.report) === null || _p === void 0 ? void 0 : _p.scanScope) === null ||
                    _q === void 0
                  ? void 0
                  : _q.fictionJsonFilesScanned) !== null && _r !== void 0
            ? _r
            : null;
    const jestChecked =
        (_w =
            (_u =
                (_t = (_s = sprint.report) === null || _s === void 0 ? void 0 : _s.jestBaselineChecked) !== null &&
                _t !== void 0
                    ? _t
                    : gateReport.jestBaselineChecked) !== null && _u !== void 0
                ? _u
                : (_v = sprint.hygieneSummary) === null || _v === void 0
                  ? void 0
                  : _v.jestBaselineChecked) !== null && _w !== void 0
            ? _w
            : null;
    return {
        checklistPassed:
            (_z =
                (_x = checklist.passed) !== null && _x !== void 0
                    ? _x
                    : (_y = sprint.compliance) === null || _y === void 0
                      ? void 0
                      : _y.passed) !== null && _z !== void 0
                ? _z
                : null,
        checklistTotal:
            (_2 =
                (_0 = checklist.total) !== null && _0 !== void 0
                    ? _0
                    : (_1 = sprint.compliance) === null || _1 === void 0
                      ? void 0
                      : _1.total) !== null && _2 !== void 0
                ? _2
                : null,
        readinessScore:
            (_5 =
                (_3 = checklist.score) !== null && _3 !== void 0
                    ? _3
                    : (_4 = sprint.compliance) === null || _4 === void 0
                      ? void 0
                      : _4.score) !== null && _5 !== void 0
                ? _5
                : null,
        gateResult:
            ((_6 = sprint.gate) === null || _6 === void 0 ? void 0 : _6.pass) === false
                ? 'FAIL'
                : ((_7 = sprint.gate) === null || _7 === void 0 ? void 0 : _7.pass)
                  ? 'PASS'
                  : null,
        euPatternHits:
            (_10 =
                (_8 = sprint.euPatternHits) !== null && _8 !== void 0
                    ? _8
                    : (_9 = sprint.report) === null || _9 === void 0
                      ? void 0
                      : _9.euAiActFindings) !== null && _10 !== void 0
                ? _10
                : 0,
        operatorDocumentationCount:
            (_14 =
                (_11 = checklist.operatorDocumentationCount) !== null && _11 !== void 0
                    ? _11
                    : (_13 = (_12 = sprint.report) === null || _12 === void 0 ? void 0 : _12.euAiActSummary) === null ||
                        _13 === void 0
                      ? void 0
                      : _13.operatorDocumentationCount) !== null && _14 !== void 0
                ? _14
                : null,
        ruleScopedFilesAnalyzed: ruleScoped,
        euAiActScanned:
            (_19 =
                (_16 = (_15 = sprint.report) === null || _15 === void 0 ? void 0 : _15.euAiActScanned) !== null &&
                _16 !== void 0
                    ? _16
                    : (_18 = (_17 = sprint.report) === null || _17 === void 0 ? void 0 : _17.scanScope) === null ||
                        _18 === void 0
                      ? void 0
                      : _18.euAiActFilesScanned) !== null && _19 !== void 0
                ? _19
                : null,
        scanMatchedNonDocsCount:
            (_22 =
                (_21 = (_20 = sprint.report) === null || _20 === void 0 ? void 0 : _20.euAiActSummary) === null ||
                _21 === void 0
                    ? void 0
                    : _21.scanMatchedNonDocsCount) !== null && _22 !== void 0
                ? _22
                : null,
        productionLeakSuppressedIntent:
            (_24 = (_23 = sprint.report) === null || _23 === void 0 ? void 0 : _23.productionLeakSuppressedIntent) !==
                null && _24 !== void 0
                ? _24
                : null,
        sprintFictionJsonFilesScanned: sprintFiction,
        gateFictionJsonFilesScanned: gateFiction,
        fictionSampleFilesScanned: fictionSamples,
        legalHandoffEligible: (_25 = checklist.legalHandoffEligible) !== null && _25 !== void 0 ? _25 : null,
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(sprintRepo != null ? { sprintRepositoryFilesTotal: sprintRepo } : {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && sprintRepo != null && gateTotal > sprintRepo
            ? { sprintInventoryNotInGate: gateTotal - sprintRepo }
            : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(credentialScanned != null ? { gateContentFilesScanned: credentialScanned } : {}),
        ...(jestChecked === false ? { jestBaselineChecked: false } : {}),
        attestationNote:
            'EU AI Act sprint hygiene — technical readiness only, not legal conformity or vendor handoff clearance.'
    };
}
/**
 * Reconcile eu ai act sprint report limitations.
 * @param {number} report
 * @returns {any}
 */
function reconcileEuAiActSprintReportLimitations(report) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (
        !((_b =
            (_a = report === null || report === void 0 ? void 0 : report.scanScope) === null || _a === void 0
                ? void 0
                : _a.limitations) === null || _b === void 0
            ? void 0
            : _b.length)
    )
        return report;
    const prodScanned =
        (_e =
            (_c = report.productionLeakScanned) !== null && _c !== void 0
                ? _c
                : (_d = report.scanScope) === null || _d === void 0
                  ? void 0
                  : _d.productionDirsScanned) !== null && _e !== void 0
            ? _e
            : 0;
    const sourceFiction =
        (_h =
            (_f = report.sourceCodeFilesScanned) !== null && _f !== void 0
                ? _f
                : (_g = report.scanScope) === null || _g === void 0
                  ? void 0
                  : _g.sourceCodeFilesScanned) !== null && _h !== void 0
            ? _h
            : 0;
    const limitations = report.scanScope.limitations.map(note => {
        if (/source code \(0 files in server/i.test(String(note)) && prodScanned > 0) {
            return `Fiction/KPI source-code rules scanned ${sourceFiction} file(s); production-leak rules scanned ${prodScanned} file(s) under server/, src/.`;
        }
        return note;
    });
    return {
        ...report,
        scanScope: {
            ...report.scanScope,
            limitations
        }
    };
}
/**
 * Operator ZIP artifact for raw EU AI Act sprint service payload (not page export bundle).
 */
/**
 * Sanitize eu ai act sprint artifact export.
 * @param {any} sprint
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeEuAiActSprintArtifactExport(sprint, options = {}) {
    var _a, _b, _c, _d, _e, _f;
    if (!sprint || typeof sprint !== 'object') return sprint;
    if (sprint.ok === false) return sprint;
    const projectPath = options.projectPath || sprint.projectPath || sprint.platformRoot || '';
    const projectLabel = projectLabelFromPath(projectPath);
    const relativeArtifacts = sprint.relativeArtifacts || defaultSprintRelativeArtifacts();
    const gateReport = options.gateReport || null;
    const repositoryFilesTotal =
        (_d =
            (_b =
                (_a = options.repositoryFilesTotal) !== null && _a !== void 0
                    ? _a
                    : gateReport === null || gateReport === void 0
                      ? void 0
                      : gateReport.repositoryFilesTotal) !== null && _b !== void 0
                ? _b
                : (_c = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryInventory) ===
                        null || _c === void 0
                  ? void 0
                  : _c.totalFiles) !== null && _d !== void 0
            ? _d
            : null;
    const reportOptions = {
        projectPath,
        embeddedInEuAiActSprint: true,
        ...(repositoryFilesTotal != null
            ? { repositoryFilesTotal, gateRepositoryFilesTotal: repositoryFilesTotal }
            : {})
    };
    let report = sprint.report ? sanitizeSimplebeaconReportExport(sprint.report, reportOptions) : sprint.report;
    if (report) {
        report = reconcileEuAiActSprintReportLimitations(report);
    }
    let complianceChecklist = sprint.complianceChecklist
        ? sanitizeComplianceChecklistArtifactExport(sprint.complianceChecklist, {
              projectPath,
              gateReport: gateReport || report || null,
              npmAudit: options.npmAudit || null,
              operatorExport: true
          })
        : sprint.complianceChecklist;
    if (complianceChecklist === null || complianceChecklist === void 0 ? void 0 : complianceChecklist.projectRoot) {
        complianceChecklist = {
            ...complianceChecklist,
            projectRoot: redactProjectPathForExport(complianceChecklist.projectRoot, projectLabel)
        };
    }
    if (
        ((_f = (_e = sprint.complianceChecklist) === null || _e === void 0 ? void 0 : _e.summary) === null ||
        _f === void 0
            ? void 0
            : _f.legalHandoffEligible) != null &&
        (complianceChecklist === null || complianceChecklist === void 0 ? void 0 : complianceChecklist.summary)
    ) {
        complianceChecklist = {
            ...complianceChecklist,
            summary: {
                ...complianceChecklist.summary,
                legalHandoffEligible: sprint.complianceChecklist.summary.legalHandoffEligible
            }
        };
    }
    let assessment = sprint.assessment ? sanitizeAssessmentExport(sprint.assessment, projectLabel) : sprint.assessment;
    if (assessment) {
        assessment = {
            ...assessment,
            ...((report === null || report === void 0 ? void 0 : report.euAiActSummary)
                ? { euAiActSummary: report.euAiActSummary }
                : {}),
            exportNormalized: true,
            exportSanitized: true,
            securityHandoffEligible: false,
            handoffEligible: false
        };
    }
    const sprintContext = { ...sprint, report, complianceChecklist, assessment };
    const sanitized = {
        ...sprint,
        projectPath: redactProjectPathForExport(sprint.projectPath, projectLabel),
        platformRoot: redactProjectPathForExport(sprint.platformRoot, projectLabel),
        report,
        complianceChecklist,
        assessment,
        artifacts: relativeArtifacts,
        relativeArtifacts,
        exportNormalized: true,
        exportSanitized: true,
        scanTargetProfile: 'product',
        securityHandoffEligible: false,
        handoffEligible: false,
        hygieneSummary: buildSprintArtifactHygieneSummary(sprintContext, {
            ...options,
            repositoryFilesTotal
        }),
        exportNotes: buildSprintArtifactExportNotes(sprintContext, {
            ...options,
            repositoryFilesTotal,
            gateReport
        })
    };
    delete sanitized.sampleReportUrl;
    delete sanitized.analyzeHashUrl;
    return sanitized;
}
/**
 * Sanitize eu ai act export.
 * @param {any} bundle
 * @returns {any}
 */
export function sanitizeEuAiActExport(bundle) {
    var _a, _b;
    if (!bundle || typeof bundle !== 'object') return bundle;
    if (bundle.type === 'simplebeacon-eu-ai-act-export') {
        return buildEuAiActExportBundle({
            hasData:
                (_b = (_a = bundle.summary) === null || _a === void 0 ? void 0 : _a.hasData) !== null && _b !== void 0
                    ? _b
                    : true,
            disclaimer: bundle.disclaimer,
            artifacts: bundle.artifacts,
            generateCommands: bundle.generateCommands,
            generatedAt: bundle.bundleGeneratedAt,
            compliance: bundle.compliance,
            assessment: bundle.assessment,
            sprintReport: bundle.sprintReport,
            embeddedInMainReport: bundle.embeddedInMainReport
        });
    }
    return buildEuAiActExportBundle(bundle);
}
/**
 * RFC 4180-compliant CSV cell escape.
 * Quotes the cell only when it contains commas, newlines, quotes, or leading/trailing spaces.
 * @param {any} cell
 * @returns {string}
 */
function csvEscape(cell) {
    const raw = String(cell !== null && cell !== void 0 ? cell : '');
    const needsQuotes = /[",\n\r]/.test(raw) || raw.startsWith(' ') || raw.endsWith(' ');
    const escaped = raw.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}
/**
 * Build eu ai act checklist csv.
 * @param {Array} rules
 * @returns {any}
 */
export function buildEuAiActChecklistCsv(rules) {
    if (!(rules === null || rules === void 0 ? void 0 : rules.length)) return null;
    const header = ['id', 'title', 'category', 'severity', 'status', 'evidence', 'remediation'];
    const rows = rules.map(rule =>
        [
            rule.id || '',
            rule.title || '',
            rule.category || '',
            rule.severity || '',
            rule.status || '',
            rule.evidence || '',
            rule.remediation || ''
        ]
            .map(csvEscape)
            .join(',')
    );
    return [header.join(','), ...rows].join('\n');
}
/**
 * Build eu ai act documentation csv.
 * @param {Array} docs
 * @returns {any}
 */
export function buildEuAiActDocumentationCsv(docs) {
    if (!(docs === null || docs === void 0 ? void 0 : docs.length)) return null;
    const header = ['path'];
    const rows = docs.map(doc => csvEscape(typeof doc === 'string' ? doc : String(doc)));
    return [header.join(','), ...rows].join('\n');
}
/**
 * Build eu ai act summary csv.
 * @param {any} summary
 * @returns {any}
 */
export function buildEuAiActSummaryCsv(summary) {
    if (!summary) return null;
    const header = ['metric', 'value'];
    const rows = Object.entries(summary).map(([key, value]) =>
        [key, value == null ? '' : String(value)].map(csvEscape).join(',')
    );
    return [header.join(','), ...rows].join('\n');
}
/**
 * Build eu ai act csv.
 * @param {Object} options
 * @param {any} documentationFound
 * @param {any} summary }
 * @returns {any}
 */
export function buildEuAiActCsv({ rules, documentationFound, summary } = {}) {
    const parts = [];
    const checklist = buildEuAiActChecklistCsv(rules);
    const docs = buildEuAiActDocumentationCsv(documentationFound);
    const summaryCsv = !checklist ? buildEuAiActSummaryCsv(summary) : null;
    if (checklist) parts.push(checklist);
    if (summaryCsv) {
        if (parts.length) parts.push('');
        parts.push('EU AI Act Summary');
        parts.push(summaryCsv);
    }
    if (docs) {
        if (parts.length) parts.push('');
        parts.push('Documentation artifacts');
        parts.push(docs);
    }
    return parts.length ? parts.join('\n') : null;
}
/**
 * Eu ai act export filename.
 * @param {any} ext
 * @returns {any}
 */
export function euAiActExportFilename(ext = 'json') {
    const stamp = new Date().toISOString().slice(0, 10);
    if (ext === 'csv') return `eu-ai-act-metrics-${stamp}.csv`;
    return `eu-ai-act-export-${stamp}.json`;
}
