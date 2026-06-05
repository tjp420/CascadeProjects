/**
 * Anonymized export engine — converts scan results into abstract, AI-blind
 * compliance tokens before any payload leaves the developer's machine.
 *
 * Guarantees:
 *   - Zero source code snippets
 *   - Zero file paths (replaced by generic counters)
 *   - Zero human-readable descriptions (replaced by deterministic templates)
 *   - Only severity bands, error type IDs, counts, and gate status are emitted
 *
 * This is the "Abstract Silhouette" privacy architecture. The server receives
 * enough information to verify compliance and generate a PDF layout, but never
 * enough to reconstruct the repository contents or intellectual property.
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Deterministic error taxonomy — these are stable type codes that survive
// across CLI versions so the server side can reason about them.
// ---------------------------------------------------------------------------
const ERROR_TYPE_CODES = {
    'Schema Violation': { code: 'SB-001', category: 'schema' },
    'Invalid JSON': { code: 'SB-002', category: 'syntax' },
    'Empty File': { code: 'SB-003', category: 'data-quality' },
    'Duplicate Data': { code: 'SB-004', category: 'data-quality' },
    'Production Path Leak': { code: 'SB-005', category: 'security' },
    'Credential Pattern': { code: 'SB-006', category: 'security' },
    'Fiction KPI': { code: 'SB-007', category: 'ai-quality' },
    'LLM Slop': { code: 'SB-008', category: 'ai-quality' },
    'EU AI Act Risk': { code: 'SB-009', category: 'compliance' },
    'Agency Handoff Marker': { code: 'SB-010', category: 'ai-quality' },
    'Jest Baseline Failure': { code: 'SB-011', category: 'testing' },
    'Sample Consistency Failure': { code: 'SB-012', category: 'data-quality' },
    'Roadmap Schema Violation': { code: 'SB-013', category: 'schema' },
    'Oversized Roadmap File': { code: 'SB-014', category: 'data-quality' },
    'Legacy Fiction Roadmap': { code: 'SB-015', category: 'data-quality' }
};

const SEVERITY_BANDS = ['critical', 'high', 'medium', 'low'];

function resolveTypeCode(issueType) {
    const normalized = String(issueType || '').trim();
    const match = ERROR_TYPE_CODES[normalized];
    if (match) return match;
    // Fallback: deterministic hash-based code for unknown types
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 6);
    return { code: `SB-UNK-${hash}`, category: 'unknown' };
}

function resolveSeverityBand(issue) {
    const band = String(issue.severityBand || issue.severity || 'low').toLowerCase();
    return SEVERITY_BANDS.includes(band) ? band : 'low';
}

// ---------------------------------------------------------------------------
// Single-issue anonymization — strips every field that could leak IP.
// ---------------------------------------------------------------------------
function anonymizeIssue(issue, index) {
    const typeMeta = resolveTypeCode(issue.type);
    const severity = resolveSeverityBand(issue);
    const count = issue.count || 1;

    // Hash the pattern ID if present — keeps determinism without leaking names
    const patternHash = issue.pattern || issue.metadata?.patternId
        ? crypto.createHash('sha256')
            .update(String(issue.pattern || issue.metadata?.patternId || ''))
            .digest('hex')
            .slice(0, 12)
        : null;

    return {
        i: index + 1,                          // anonymous sequence number only
        t: typeMeta.code,                     // type code (e.g., SB-007)
        c: typeMeta.category,                 // category bucket
        s: severity,                          // severity band
        n: count                              // occurrence count
        // Deliberately OMITTED: filePath, filePaths, affectedFiles,
        // description, recommendedAction, metadata, pattern string, line numbers
    };
}

// ---------------------------------------------------------------------------
// Aggregate rollup — produces server-verifiable compliance metrics.
// ---------------------------------------------------------------------------
function buildAnonymizedAggregate(issues) {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory = {};

    for (const issue of issues) {
        const typeMeta = resolveTypeCode(issue.type);
        const band = resolveSeverityBand(issue);
        const count = issue.count || 1;

        byType[typeMeta.code] = (byType[typeMeta.code] || 0) + count;
        bySeverity[band] = (bySeverity[band] || 0) + count;
        byCategory[typeMeta.category] = (byCategory[typeMeta.category] || 0) + count;
    }

    return { byType, bySeverity, byCategory };
}

// ---------------------------------------------------------------------------
// Repository fingerprint — a one-way hash of the repo identity.
// This lets the server detect duplicate submissions without learning the path.
// ---------------------------------------------------------------------------
function buildRepoFingerprint(projectRoot) {
    const salt = process.env.SIMPLEBEACON_ANON_SALT || 'simplebeacon-anon-v1';
    return crypto.createHash('sha256')
        .update(`${salt}:${String(projectRoot || '').replace(/\\/g, '/')}`)
        .digest('hex')
        .slice(0, 24);
}

// ---------------------------------------------------------------------------
// Scan-profile fingerprint — proves which rulesets were active.
// ---------------------------------------------------------------------------
function buildRulesFingerprint(scanScope = {}) {
    const rules = Array.isArray(scanScope.rulesEnabled) ? scanScope.rulesEnabled : [];
    const sorted = [...rules].sort();
    return crypto.createHash('sha256')
        .update(sorted.join('|'))
        .digest('hex')
        .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Main export: full report → AI-blind token bundle.
// ---------------------------------------------------------------------------
function buildAnonymizedExport(report) {
    if (!report || typeof report !== 'object') {
        throw new Error('buildAnonymizedExport requires a scan report object');
    }

    const rawIssues = report.rawIssues || report.detectedIssues || [];
    const anonymizedIssues = rawIssues.map((issue, idx) => anonymizeIssue(issue, idx));
    const aggregate = buildAnonymizedAggregate(rawIssues);
    const gate = report.gate || {};

    // -----------------------------------------------------------------------
    // The anonymized payload. Every field is intentionally terse and numeric.
    // No strings that could contain file paths, variable names, or code.
    // -----------------------------------------------------------------------
    const payload = {
        schemaVersion: 'anonymized-v1',
        generatedAt: new Date().toISOString(),
        repoFingerprint: buildRepoFingerprint(report.projectRoot),
        rulesFingerprint: buildRulesFingerprint(report.scanScope),
        gate: {
            pass: gate.pass === true,
            failOn: Array.isArray(gate.failOn) ? gate.failOn : ['high'],
            warnOn: Array.isArray(gate.warnOn) ? gate.warnOn : ['medium', 'low'],
            blockingCount: typeof gate.blockingCount === 'number' ? gate.blockingCount : 0,
            warningCount: typeof gate.warningCount === 'number' ? gate.warningCount : 0
        },
        metrics: {
            repositoryFilesTotal: report.repositoryFilesTotal || null,
            repositoryFoldersTotal: report.repositoryFoldersTotal || null,
            ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed || null,
            qualityScore: report.qualityScore || null,
            schemaCompliance: report.schemaCompliance || null,
            invalidJson: report.invalidJson || 0,
            emptyFiles: report.emptyFiles || 0,
            duplicateGroups: report.duplicateGroups || 0,
            fictionJsonFilesScanned: report.fictionJsonFilesScanned || 0,
            fictionSampleFilesScanned: report.fictionSampleFilesScanned || 0,
            credentialFindings: report.credentialFindings || 0,
            productionLeakFindings: report.productionLeakFindings || 0,
            sourceFictionPatternHits: report.sourceFictionPatternHits || 0,
            llmSlopPatternHits: report.llmSlopPatternHits || 0,
            euAiActFindings: report.euAiActFindings || 0,
            euAiActHighRiskIndicators: report.euAiActHighRiskIndicators || 0,
            jestBaselinePassed: report.jestBaselinePassed === true
        },
        severityCounts: report.severityCounts || aggregate.bySeverity,
        aggregate,
        issues: anonymizedIssues,
        analyzerSuite: report.analyzerSuite || null
    };

    return payload;
}

function attachAnalyzerSuiteToReport(report, analyzerSuiteExport) {
    if (!report || typeof report !== 'object') return report;
    if (!analyzerSuiteExport || typeof analyzerSuiteExport !== 'object') return report;
    const summary = analyzerSuiteExport.riskSummary || {};
    const execution = summary.executionStatus || {};
    report.analyzerSuite = {
        measured: execution.measured || 0,
        insufficientData: execution.insufficientData || 0,
        stub: execution.stub || 0,
        overallRiskLevel: summary.overallRiskLevel || 'Low',
        peakSeverity: summary.severityCounts?.critical > 0 ? 'critical' : summary.severityCounts?.high > 0 ? 'high' : 'low',
        topPriorityIssueCount: (analyzerSuiteExport.topPriorityIssues || []).length,
        coverageGapCount: (analyzerSuiteExport.coverageGaps || []).length
    };
    return report;
}

// ---------------------------------------------------------------------------
// Integrity signature — so the server can prove the payload was generated
// by a genuine Simplebeacon CLI and not forged.
// ---------------------------------------------------------------------------
function signAnonymizedExport(payload, secret) {
    const hmacKey = secret || process.env.SIMPLEBEACON_ANON_HMAC || 'simplebeacon-anon-insecure';
    const canon = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', hmacKey).update(canon).digest('hex');
    return {
        ...payload,
        _integrity: signature,
        _integrityAlgo: 'hmac-sha256'
    };
}

function verifyAnonymizedExport(payload, secret) {
    if (!payload || typeof payload !== 'object') return false;
    const signature = payload._integrity;
    if (!signature || typeof signature !== 'string') return false;

    const clone = { ...payload };
    delete clone._integrity;
    delete clone._integrityAlgo;

    const hmacKey = secret || process.env.SIMPLEBEACON_ANON_HMAC || 'simplebeacon-anon-insecure';
    const canon = JSON.stringify(clone);
    const expected = crypto.createHmac('sha256', hmacKey).update(canon).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Validation helpers for the server side.
// ---------------------------------------------------------------------------
function validateAnonymizedSchema(payload) {
    const errors = [];
    if (payload.schemaVersion !== 'anonymized-v1') {
        errors.push(`Unsupported schema version: ${payload.schemaVersion}`);
    }
    if (!payload.repoFingerprint || typeof payload.repoFingerprint !== 'string') {
        errors.push('Missing repoFingerprint');
    }
    if (!payload.gate || typeof payload.gate.pass !== 'boolean') {
        errors.push('Missing gate.pass boolean');
    }
    if (!payload.metrics || typeof payload.metrics !== 'object') {
        errors.push('Missing metrics object');
    }
    if (!Array.isArray(payload.issues)) {
        errors.push('Missing issues array');
    } else {
        for (let idx = 0; idx < payload.issues.length; idx++) {
            const issue = payload.issues[idx];
            if (!issue || typeof issue !== 'object') {
                errors.push(`Issue[${idx}] is not an object`);
                continue;
            }
            if (typeof issue.i !== 'number') errors.push(`Issue[${idx}].i missing`);
            if (typeof issue.t !== 'string') errors.push(`Issue[${idx}].t missing`);
            if (typeof issue.s !== 'string') errors.push(`Issue[${idx}].s missing`);
            if (typeof issue.n !== 'number') errors.push(`Issue[${idx}].n missing`);
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    buildAnonymizedExport,
    signAnonymizedExport,
    verifyAnonymizedExport,
    validateAnonymizedSchema,
    resolveTypeCode,
    attachAnalyzerSuiteToReport,
    ERROR_TYPE_CODES,
    SEVERITY_BANDS
};
