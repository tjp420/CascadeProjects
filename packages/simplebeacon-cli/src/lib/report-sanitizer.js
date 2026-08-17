// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * Redact secret-like substrings before reports leave the customer machine or persist on server.
 */

const crypto = require('crypto');

const CLASSIFICATION_CATALOG = require('../rules/classification-spillage-catalog.json');
const CLASSIFICATION_PATTERNS = CLASSIFICATION_CATALOG.map((entry) => ({
    ...entry,
    regex: new RegExp(entry.regexSource, entry.regexFlags)
}));

const HANDOFF_SNIPPET_FIELDS = new Set([
    'snippet', 'match', 'code', 'context', 'excerpt', 'sample', 'rawMatch', 'lineContent', 'sourceLine'
]);
const HANDOFF_PATH_FIELDS = new Set([
    'filePath', 'file', 'path', 'projectRoot', 'platformRoot', 'configPath',
    'scanTargetRoot', 'projectPath', 'productPlatformRoot'
]);
const HANDOFF_PATH_ARRAY_FIELDS = new Set(['scanPaths', 'affectedFiles', 'filePaths']);

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const INTERNAL_HOST_PATTERN = /\b[a-z0-9][-a-z0-9.]*\.(?:internal|local|corp|lan|intranet)\b/gi;

const REDACTION_RULES = [
    { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: 'AKIA████████████████' },
    { pattern: /\bghp_[A-Za-z0-9]{20,}\b/g, replacement: 'ghp_████████████████' },
    { pattern: /\bgho_[A-Za-z0-9]{20,}\b/g, replacement: 'gho_████████████████' },
    { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, replacement: 'sk-████████████████████' },
    { pattern: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g, replacement: '$1_$2_████████████████' },
    { pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: 'eyJ…[REDACTED_JWT]' },
    { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replacement: 'xox…[REDACTED]' },
    { pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g, replacement: 'Bearer [REDACTED]' },
    { pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY_BLOCK]' },
    { pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY_BLOCK]' },
    { pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY_BLOCK]' },
    {
        pattern: /\b(api[_-]?key|secret[_-]?key|access[_-]?token|password)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
        replacement: '$1: "[REDACTED]"'
    }
];

function isAbsoluteOrUserPath(value) {
    if (typeof value !== 'string' || !value) return false;
    const normalized = value.replace(/\\/g, '/');
    return /^[a-zA-Z]:\//.test(normalized)
        || normalized.startsWith('/Users/')
        || normalized.startsWith('/home/')
        || /\/Users\/[^/]+/.test(normalized)
        || /\\Users\\[^\\]+/.test(value);
}

function redactPathValue(value) {
    if (typeof value !== 'string' || !value) return value;
    if (isAbsoluteOrUserPath(value)) return '[REDACTED_PATH]';
    return redactHandoffString(value);
}

function redactClassificationMarkings(value) {
    if (typeof value !== 'string' || !value) return value;
    let out = value;
    for (const rule of CLASSIFICATION_PATTERNS) {
        rule.regex.lastIndex = 0;
        out = out.replace(rule.regex, '[REDACTED_CLASSIFICATION]');
    }
    return out;
}

function redactHandoffString(value) {
    if (typeof value !== 'string' || !value) return value;
    let out = redactSecretsInString(value);
    out = out.replace(/[A-Za-z]:\\Users\\[^\\]+(?:\\[^\\"'<>|\s]+)*/g, '[REDACTED_PATH]');
    out = out.replace(/\/Users\/[^/\s"'<>|]+(?:\/[^\s"'<>|]*)?/g, '[REDACTED_PATH]');
    out = out.replace(/\/home\/[^/\s"'<>|]+(?:\/[^\s"'<>|]*)?/g, '[REDACTED_PATH]');
    out = out.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
    out = out.replace(IP_PATTERN, (ip) => (ip === '127.0.0.1' ? ip : '[REDACTED_IP]'));
    out = out.replace(INTERNAL_HOST_PATTERN, '[REDACTED_HOST]');
    out = redactClassificationMarkings(out);
    return out;
}

function hashSnippetValue(value) {
    if (typeof value !== 'string' || !value) return value;
    return {
        redacted: true,
        sha256: crypto.createHash('sha256').update(value).digest('hex'),
        lineCount: value.split('\n').length,
        charCount: value.length
    };
}

function sanitizeHandoffIssue(issue, options = {}) {
    if (!issue || typeof issue !== 'object') return issue;
    const next = {};
    for (const [key, value] of Object.entries(issue)) {
        if (HANDOFF_SNIPPET_FIELDS.has(key)) {
            if (options.includeRedactedSnippets && typeof value === 'string') {
                next[key] = redactHandoffString(value);
            } else if (typeof value === 'string' && value.length > 0) {
                next[key] = hashSnippetValue(value);
            } else {
                next[key] = value;
            }
            continue;
        }
        if (HANDOFF_PATH_FIELDS.has(key)) {
            next[key] = Array.isArray(value)
                ? value.map((entry) => redactPathValue(String(entry)))
                : redactPathValue(String(value));
            continue;
        }
        if (HANDOFF_PATH_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
            next[key] = value.map((entry) => redactPathValue(String(entry)));
            continue;
        }
        next[key] = sanitizeHandoffValue(value, options);
    }
    return next;
}

function sanitizeHandoffValue(value, options = {}) {
    if (typeof value === 'string') return redactHandoffString(value);
    if (Array.isArray(value)) return value.map((entry) => sanitizeHandoffValue(entry, options));
    if (value && typeof value === 'object') return sanitizeHandoffObject(value, options);
    return value;
}

function sanitizeHandoffObject(obj, options = {}) {
    const next = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key === 'rawIssues' || key === 'sampleFiles') {
            continue;
        }
        if (Array.isArray(value) && (key === 'rawIssues' || key === 'detectedIssues' || key === 'findings' || key === 'issues' || key === 'blockingIssues' || key === 'warningIssues')) {
            next[key] = value.map((issue) => sanitizeHandoffIssue(issue, options));
            continue;
        }
        if (HANDOFF_PATH_FIELDS.has(key)) {
            next[key] = redactPathValue(String(value));
            continue;
        }
        if (HANDOFF_PATH_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
            next[key] = value.map((entry) => redactPathValue(String(entry)));
            continue;
        }
        if (value && typeof value === 'object' && key === 'repositoryInventory') {
            next[key] = {
                ...sanitizeHandoffObject(value, options),
                projectRoot: redactPathValue(String(value.projectRoot || ''))
            };
            continue;
        }
        next[key] = sanitizeHandoffValue(value, options);
    }
    return next;
}

/**
 * Produce a lower-side-safe handoff bundle from a scan report.
 * Strips absolute paths, usernames, emails, internal hosts, classification markings,
 * and replaces code snippets with content hashes unless includeRedactedSnippets is set.
 * @param {Object} report
 * @param {Object} [options]
 * @param {boolean} [options.includeRedactedSnippets=false]
 * @returns {Object}
 */
function sanitizeHandoffExport(report, options = {}) {
    if (!report || typeof report !== 'object') return report;
    const base = sanitizeScanReport(report, { stripRawIssues: true });
    const sanitized = sanitizeHandoffObject(base, options);
    sanitized.handoffExport = true;
    sanitized.handoffSanitized = true;
    sanitized.handoffSanitizedAt = new Date().toISOString();
    sanitized.disclaimers = [
        ...(Array.isArray(sanitized.disclaimers) ? sanitized.disclaimers : []),
        'Handoff export — absolute paths, emails, classification markings, and code snippets redacted for cross-domain transfer.',
        'Review gate summary and severity counts only; re-run scan on receiving side for line-level remediation.'
    ];
    return sanitized;
}

function redactSecretsInString(value) {
    if (typeof value !== 'string' || !value) return value;
    let out = value;
    for (const rule of REDACTION_RULES) {
        out = out.replace(rule.pattern, rule.replacement);
    }
    return out;
}

function sanitizeValue(value) {
    if (typeof value === 'string') return redactSecretsInString(value);
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (value && typeof value === 'object') return sanitizePlainObject(value);
    return value;
}

function sanitizePlainObject(obj) {
    const next = {};
    for (const [key, value] of Object.entries(obj)) {
        next[key] = sanitizeValue(value);
    }
    return next;
}

function sanitizeIssue(issue) {
    if (!issue || typeof issue !== 'object') return issue;
    return sanitizePlainObject(issue);
}

function sanitizeScanReport(report, options = {}) {
    if (!report || typeof report !== 'object') return report;
    const sanitized = sanitizePlainObject(report);

    if (Array.isArray(sanitized.rawIssues)) {
        sanitized.rawIssues = sanitized.rawIssues.map(sanitizeIssue);
    }
    if (Array.isArray(sanitized.detectedIssues)) {
        sanitized.detectedIssues = sanitized.detectedIssues.map(sanitizeIssue);
    }

    if (options.stripRawIssues) {
        delete sanitized.rawIssues;
        delete sanitized.sampleFiles;
    }

    sanitized.sanitized = true;
    sanitized.sanitizedAt = new Date().toISOString();
    return sanitized;
}

function sanitizeAssessment(assessment, options = {}) {
    if (!assessment || typeof assessment !== 'object') return assessment;
    const sanitized = sanitizePlainObject(assessment);

    if (sanitized.findings && typeof sanitized.findings === 'object') {
        for (const bucket of Object.values(sanitized.findings)) {
            if (bucket?.items && Array.isArray(bucket.items)) {
                bucket.items = bucket.items.map(sanitizeIssue);
            }
            if (bucket?.summary) bucket.summary = redactSecretsInString(bucket.summary);
        }
    }

    if (sanitized.complianceChecklist?.rules) {
        sanitized.complianceChecklist.rules = sanitized.complianceChecklist.rules.map((rule) => sanitizePlainObject(rule));
    }

    if (sanitized.metadata) {
        sanitized.metadata = sanitizePlainObject(sanitized.metadata);
    }

    if (options.stripSourceReport) {
        delete sanitized.sourceReport;
    }

    sanitized.sanitized = true;
    sanitized.sanitizedAt = new Date().toISOString();
    return sanitized;
}

function sanitizeReportForCloudUpload(report) {
    return sanitizeScanReport(report, { stripRawIssues: true });
}

function normalizeSeverity(value) {
    return String(value || 'low').toLowerCase();
}

function collectIssuesFromScan(rawScanJson) {
    if (!rawScanJson || typeof rawScanJson !== 'object') return [];
    if (Array.isArray(rawScanJson.issues)) return rawScanJson.issues;
    if (Array.isArray(rawScanJson.rawIssues)) return rawScanJson.rawIssues;
    if (Array.isArray(rawScanJson.detectedIssues)) return rawScanJson.detectedIssues;
    if (Array.isArray(rawScanJson.findings)) return rawScanJson.findings;

    const collected = [];
    const simplebeacon = rawScanJson.results?.simplebeacon || rawScanJson.simplebeacon;
    if (simplebeacon) {
        collected.push(...(simplebeacon.rawIssues || simplebeacon.detectedIssues || []));
    }
    const codebase = rawScanJson.results?.codebase || rawScanJson.codebase;
    if (codebase?.findings) {
        collected.push(...codebase.findings);
    }
    return collected;
}

function countIssueSeverities(issues = []) {
    return issues.reduce((acc, issue) => {
        const band = normalizeSeverity(issue.severity);
        if (band === 'critical' || band === 'high' || band === 'medium' || band === 'low') {
            acc[band] += issue.count || 1;
        } else {
            acc.low += issue.count || 1;
        }
        return acc;
    }, { critical: 0, high: 0, medium: 0, low: 0 });
}

function resolveGateStatus(rawScanJson) {
    const gatePass = rawScanJson.gate?.pass
        ?? rawScanJson.results?.simplebeacon?.gate?.pass
        ?? rawScanJson.summary?.simplebeaconGatePass;
    if (gatePass === true) return 'PASS';
    if (gatePass === false) return 'FAIL';
    return 'REVIEW';
}

function resolveFilesScanned(rawScanJson) {
    return rawScanJson.summary?.codeFilesAnalyzed
        ?? rawScanJson.summary?.files
        ?? rawScanJson.codeFilesAnalyzed
        ?? rawScanJson.filesAnalyzed
        ?? rawScanJson.repositoryFilesTotal
        ?? rawScanJson.results?.codebase?.summary?.codeFilesAnalyzed
        ?? null;
}

/**
 * Strips line locations and code snippets from public scan results.
 * Keeps high-level counts to show the danger, but hides the fix.
 * @param {Object} rawScanJson - Complete internal scan database object.
 * @returns {Object} Sanitized public summary safe for browser display.
 */
function sanitizePublicOutput(rawScanJson) {
    const issues = collectIssuesFromScan(rawScanJson);
    const severityCounts = countIssueSeverities(issues);
    const totalIssuesFound = issues.reduce((sum, issue) => sum + (issue.count || 1), 0);

    return {
        summary: {
            filesScanned: resolveFilesScanned(rawScanJson),
            status: resolveGateStatus(rawScanJson),
            totalIssuesFound,
            gatePass: rawScanJson.gate?.pass
                ?? rawScanJson.results?.simplebeacon?.gate?.pass
                ?? rawScanJson.summary?.simplebeaconGatePass
                ?? null,
            qualityScore: rawScanJson.qualityScore
                ?? rawScanJson.results?.simplebeacon?.qualityScore
                ?? null,
            codeHealth: rawScanJson.summary?.codebaseHealthScore
                ?? rawScanJson.results?.codebase?.summary?.healthScore
                ?? null
        },
        severityCounts,
        publicGateLocked: true,
        issues: []
    };
}

function stripSensitiveScanFields(report) {
    if (!report || typeof report !== 'object') return report;
    const next = sanitizePlainObject(report);
    next.rawIssues = [];
    next.detectedIssues = [];
    if (Array.isArray(next.findings)) {
        next.findings = next.findings.filter((f) => f && f.category === 'workspace-health');
    }
    if (next.results && typeof next.results === 'object') {
        next.results = sanitizePlainObject(next.results);
        if (next.results.codebase?.findings) {
            next.results.codebase = {
                ...next.results.codebase,
                findings: []
            };
        }
        if (next.results.simplebeacon) {
            next.results.simplebeacon = {
                ...next.results.simplebeacon,
                rawIssues: [],
                detectedIssues: []
            };
        }
    }
    next.publicGateLocked = true;
    return next;
}

function applyPublicGateToAnalyzeResponse(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const scanRoot = payload.report
        || payload.data
        || payload.completeScan
        || payload;
    const publicSummary = sanitizePublicOutput(scanRoot);
    const next = {
        ...payload,
        publicGateLocked: true,
        publicSummary
    };
    if (next.report) next.report = stripSensitiveScanFields(next.report);
    if (next.data) next.data = stripSensitiveScanFields(next.data);
    if (next.completeScan) next.completeScan = stripSensitiveScanFields(next.completeScan);
    return next;
}

module.exports = {
    redactSecretsInString,
    sanitizeScanReport,
    sanitizeAssessment,
    sanitizeReportForCloudUpload,
    sanitizePublicOutput,
    applyPublicGateToAnalyzeResponse,
    collectIssuesFromScan,
    stripSensitiveScanFields,
    sanitizeHandoffExport,
    redactHandoffString,
    redactPathValue,
    hashSnippetValue
};
