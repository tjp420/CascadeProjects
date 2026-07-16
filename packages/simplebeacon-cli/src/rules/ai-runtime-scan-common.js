// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Shared helpers for token-bleed and architecture-drift production-path scans.
 */

const path = require('path');

const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/'];
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.vue', '.svelte'
]);
const UNIVERSAL_TEXT_EXTENSIONS = new Set([
    '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.env', '.yaml', '.yml', '.toml',
    '.txt', '.md', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.astro',
    '.py', '.pyw', '.rb', '.go', '.rs', '.java', '.kt', '.cs', '.php', '.swift', '.c', '.cpp', '.h',
    '.hpp', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.sql', '.graphql', '.xml', '.csv',
    '.ini', '.cfg', '.conf', '.properties', '.dockerfile', '.tf', '.hcl', '.lua', '.pl', '.r',
    '.scala', '.groovy', '.clj', '.erl', '.ex', '.exs', '.elm', '.fs', '.fsx', '.ml', '.nim',
    '.dart', '.sol', '.vy', '.move', '.cairo', '.tsv', '.log', '.lock', '.sum', '.mod', '.work'
]);

const ALLOWLIST_SNIPPETS = [
    'token-bleed-patterns.js',
    'architecture-drift-patterns.js',
    'ai-runtime-scan-common.js',
    'example.com',
    'placeholder',
    'not-a-real',
    'process.env',
    '.env.example',
    'your-api-key-here'
];

function lineNumberAt(content, index) {
    return content.slice(0, Math.max(0, index)).split('\n').length;
}

function isScannerImplementationPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/(?:^|\/)src\/(?:rules|reporters|analyzers|proxy)(?:\/|$)/.test(normalized)) return true;
    if (/(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|proxy|lib)\//.test(normalized)) return true;
    if (/(?:^|\/)server\/lib\/(?:codebase-analyzer|production-leak|fiction-kpi|mock-data-scanner|simplebeacon-report|scan-orchestr|secret-config|audit-remediation-recipes|sample-path-resolver|code-roadmap-generator|dashboard-vault-auth|eu-ai-act-sprint-route)/.test(normalized)) return true;
    return false;
}

/** Platform scanner / sample API modules — not greenfield customer application code. */
function isPlatformScannerMetaPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/(?:^|\/)src\/api\/(?:dashboard-stub-api|simplebeacon-api|simplebeacon-billing-api)\.(?:js|cjs)$/.test(normalized)) {
        return true;
    }
    if (/(?:^|\/)server\/services\/model-inference-service\.(?:js|cjs)$/.test(normalized)) {
        return true;
    }
    if (/(?:^|\/)server\/routes\/flexible-analyze-api\.(?:js|cjs)$/.test(normalized)) {
        return true;
    }
    if (!/(?:^|\/)server\/lib\//.test(normalized)) return false;
    return /(?:codebase-analyzer|code-roadmap-generator|audit-remediation-recipes|sample-path-resolver|snapshot-|production-leak|fiction-kpi|simplebeacon-report|dev-tools-workflows|page-sample-specs|complete-scan-audit-report|compliance-trail|eu-ai-act-article|file-audit-context|language-patterns|language-registry|scan-orchestr|export-sanitize|remediation-guide|secret-config|mock-data-scanner)/.test(normalized);
}

/** Dashboard views containing analyzer catalog definitions — not customer application code. */
function isDashboardAnalyzerCatalogPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/(?:^|\/)web\/simplebeacon-dashboard\/js\/views\/analyzeview\.js$/.test(normalized)) return true;
    if (/(?:^|\/)views\/analyzeenginegrid\.js$/.test(normalized)) return true;
    return false;
}

function isExcludedPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    if (isScannerImplementationPath(relativePath)) return true;
    if (isPlatformScannerMetaPath(relativePath)) return true;
    if (isDashboardAnalyzerCatalogPath(relativePath)) return true;
    if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
    if (/\/tests?\//.test(normalized)) return true;
    if (/\/__tests__\//.test(normalized)) return true;
    if (/\/fixtures?\//.test(normalized)) return true;
    if (/\/docs?\//.test(normalized)) return true;
    if (/\/examples?\//.test(normalized)) return true;
    if (/\.example\.[-a-z0-9]+$/i.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
    if (/(?:^|\/)marketing-content-test\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-frameworkless\//.test(normalized)) return true;
    if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
    if (/\.min\.(js|cjs)$/.test(normalized)) return true;
    if (normalized.endsWith('.md')) return true;
    return false;
}

function isUnderProductionPaths(relativePath, productionPaths = DEFAULT_PRODUCTION_PATHS) {
    const rel = String(relativePath || '').replace(/\\/g, '/');
    return (productionPaths || []).some((prefix) => {
        const normalized = String(prefix || '').replace(/\\/g, '/').replace(/\/$/, '');
        if (!normalized) return false;
        return rel === normalized || rel.startsWith(`${normalized}/`);
    });
}

function isCommentLine(line, ext) {
    const trimmed = line.trim();
    if (ext === '.py' && trimmed.startsWith('#')) return true;
    return /^(\/\/|\/\*|\*)/.test(trimmed);
}

function isAllowlistedMatch(line, matchText) {
    const snippet = `${line} ${matchText}`.toLowerCase();
    return ALLOWLIST_SNIPPETS.some((token) => snippet.includes(token));
}

function splitLines(content) {
    return content.split('\n');
}

function lineIndexesMatching(lines, regex) {
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) hits.push(i);
        regex.lastIndex = 0;
    }
    return hits;
}

function withinLineWindow(lineIndex, otherIndex, window = 10) {
    return Math.abs(lineIndex - otherIndex) <= window;
}

function pushFinding(findings, seen, payload) {
    const key = `${payload.pattern}:${payload.filePath}:${payload.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(payload);
}

function makeFinding(relativePath, line, rule, matchText, recommendation) {
    return {
        id: `${rule.category}-${rule.id}-${relativePath}-${line}`,
        severity: rule.severity,
        severityBand: rule.severity,
        type: rule.type,
        category: rule.category,
        filePath: relativePath,
        file: relativePath,
        line,
        pattern: rule.id,
        count: 1,
        description: `${relativePath}:${line} — ${rule.description}`,
        recommendation,
        recommendedAction: recommendation,
        affectedFiles: [path.basename(relativePath)],
        metadata: {
            patternId: rule.id,
            category: rule.category,
            match: (matchText || '').slice(0, 120)
        }
    };
}

module.exports = {
    DEFAULT_PRODUCTION_PATHS,
    SCANNABLE_EXTENSIONS,
    UNIVERSAL_TEXT_EXTENSIONS,
    ALLOWLIST_SNIPPETS,
    lineNumberAt,
    isExcludedPath,
    isPlatformScannerMetaPath,
    isUnderProductionPaths,
    isCommentLine,
    isAllowlistedMatch,
    splitLines,
    lineIndexesMatching,
    withinLineWindow,
    pushFinding,
    makeFinding
};
