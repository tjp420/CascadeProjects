/**
 * Enterprise AI technical risk guardrails — local pattern scan only.
 * Data leakage in LLM-bound strings and unbounded token spend on model API calls.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app', 'api', 'services'];
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs'
]);
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'examples'
]);
const MAX_SCAN_BYTES = 512000;
const CALL_BLOCK_MAX_LINES = 48;

const DEFAULT_LEAK_TOKENS = [
    'internal_db_password',
    'prod_api_secret',
    'customer_ssn',
    'pii_payload',
    'auth_token'
];

const RULE_CATALOG = [
    {
        id: 'SB-ENT-001',
        category: 'data-leakage',
        severity: 'critical',
        description: 'Hardcoded internal/corporate identifier in a string bound for AI or secrets context'
    },
    {
        id: 'SB-ENT-002',
        category: 'token-budget',
        severity: 'high',
        description: 'LLM API call without explicit max_tokens / max_completion_tokens / maxOutputTokens cap'
    }
];

const LLM_INVOCATION_PATTERNS = [
    /chat\.completions\.(?:create|stream)\s*\(/i,
    /\.messages\.(?:create|stream)\s*\(/i,
    /\.completions\.(?:create|stream)\s*\(/i,
    /\.responses\.(?:create|stream)\s*\(/i,
    /\.beta\.threads\.runs\.(?:create|stream)\s*\(/i,
    /\.embeddings\.create\s*\(/i,
    /(?:openai|anthropic|bedrock|vertexai|generativeai)\.[a-z0-9_.]+\.(?:create|generate|invoke|stream)\s*\(/i,
    /\.invoke\s*\(/i
];

function lineHasLlmInvocation(line) {
    if (line.length > 8000) return false;
    if (/Object\.create\s*\(/.test(line) && !/completions|\.messages\.|openai|anthropic|bedrock/i.test(line)) {
        return false;
    }
    return LLM_INVOCATION_PATTERNS.some((re) => re.test(line));
}

const TOKEN_CAP_RE = /\bmax_(?:completion_)?tokens\b|\bmaxOutputTokens\b|\bmax_tokens_to_sample\b/i;

const ALLOWLIST_SNIPPETS = [
    'enterprise-guardrail-patterns.js',
    'enterprise-guardrail-patterns.test.js',
    'eu-ai-act-patterns.test.js',
    'example.com',
    'placeholder',
    'your-api-key',
    'not-a-real',
    'test-only',
    'changeme'
];

const SCANNER_IMPL_PATH_RE = /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|lib|mcp)(?:\/|$)|(?:^|\/)src\/rules\/enterprise-guardrail/i;

function escapeRegexToken(token) {
    return String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLeakPattern(extraTokens = []) {
    const tokens = [...new Set([
        ...DEFAULT_LEAK_TOKENS,
        ...(Array.isArray(extraTokens) ? extraTokens : [])
    ].map((t) => String(t || '').trim().toLowerCase()).filter(Boolean))];
    if (!tokens.length) return null;
    return new RegExp(`\\b(?:${tokens.map(escapeRegexToken).join('|')})\\b`, 'gi');
}

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
    return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

function isExcludedPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    if (/\.(test|spec)\.[jt]sx?$/.test(normalized)) return true;
    if (/\/tests?\//.test(normalized)) return true;
    if (/\/fixtures?\//.test(normalized)) return true;
    if (/\.example\.[-a-z0-9]+$/i.test(normalized)) return true;
    if (/\/\.cursor\//.test(normalized)) return true;
    if (SCANNER_IMPL_PATH_RE.test(normalized)) return true;
    return false;
}

function isAllowlisted(line, matchText) {
    const snippet = `${line} ${matchText}`.toLowerCase();
    return ALLOWLIST_SNIPPETS.some((token) => snippet.includes(token));
}

function lineHasStringContext(line) {
    return /['"`]/.test(line) || /=>\s*['"`]/.test(line) || /:\s*['"`]/.test(line);
}

function scanDataLeakLines(relativePath, content, leakPattern) {
    const findings = [];
    if (!leakPattern) return findings;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        leakPattern.lastIndex = 0;
        let match;
        while ((match = leakPattern.exec(line)) !== null) {
            if (!lineHasStringContext(line)) continue;
            if (isAllowlisted(line, match[0])) continue;
            findings.push({
                id: `enterprise-SB-ENT-001-${relativePath}-${i + 1}`,
                severity: 'critical',
                severityBand: 'critical',
                type: 'Enterprise Data Leakage Risk',
                filePath: relativePath,
                file: relativePath,
                line: i + 1,
                pattern: 'SB-ENT-001',
                count: 1,
                description: `${relativePath}:${i + 1} — hardcoded corporate/internal identifier "${match[0]}" in static string`,
                recommendedAction: 'Remove secret or PII from source; load from vault/env at runtime; never embed in LLM prompts',
                affectedFiles: [relativePath],
                metadata: {
                    ruleId: 'SB-ENT-001',
                    category: 'data-leakage',
                    match: match[0]
                }
            });
        }
    }
    return findings;
}

function callBlockHasTokenCap(lines, startLineIndex) {
    const block = lines.slice(startLineIndex, startLineIndex + CALL_BLOCK_MAX_LINES).join('\n');
    return TOKEN_CAP_RE.test(block);
}

function scanTokenBudgetLines(relativePath, content) {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!lineHasLlmInvocation(line)) continue;
        if (TOKEN_CAP_RE.test(line)) continue;
        if (isAllowlisted(line, '')) continue;
        if (callBlockHasTokenCap(lines, i)) continue;

        findings.push({
            id: `enterprise-SB-ENT-002-${relativePath}-${i + 1}`,
            severity: 'high',
            severityBand: 'high',
            type: 'Enterprise Token Budget Bleed',
            filePath: relativePath,
            file: relativePath,
            line: i + 1,
            pattern: 'SB-ENT-002',
            count: 1,
            description: `${relativePath}:${i + 1} — LLM call missing explicit token cap (max_tokens / max_completion_tokens / maxOutputTokens)`,
            recommendedAction: 'Set max_tokens or max_completion_tokens on every production LLM call to prevent runaway billing',
            affectedFiles: [relativePath],
            metadata: {
                ruleId: 'SB-ENT-002',
                category: 'token-budget'
            }
        });
    }
    return findings;
}

function scanEnterpriseGuardrailContent(relativePath, content, options = {}) {
    if (isExcludedPath(relativePath)) return [];
    const leakPattern = buildLeakPattern(options.extraLeakTokens);
    return [
        ...scanDataLeakLines(relativePath, content, leakPattern),
        ...scanTokenBudgetLines(relativePath, content)
    ];
}

async function walkFiles(dir, results = [], options = {}, depth = 0) {
    if (depth > 12) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walkFiles(fullPath, results, options, depth + 1);
            continue;
        }
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

        const relativePath = normalizeRel(options.baseDir, fullPath);
        if (isExcludedPath(relativePath)) continue;
        if (isIgnored(relativePath, options.ignoreGlobs)) continue;

        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > MAX_SCAN_BYTES) continue;
            results.push({ path: fullPath, relativePath, ext, size: stat.size });
        } catch {
            /* skip */
        }
    }
    return results;
}

async function scanEnterpriseGuardrailPatterns(baseDir, options = {}) {
    const sourcePaths = options.sourcePaths || DEFAULT_SOURCE_PATHS;
    const productionPaths = options.productionPaths || sourcePaths;
    const pathsToWalk = [...new Set([...sourcePaths, ...productionPaths])];
    const ignoreGlobs = options.ignoreGlobs || [];

    const files = [];
    for (const rel of pathsToWalk) {
        const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
        if (fs.existsSync(abs)) {
            await walkFiles(abs, files, { baseDir, ignoreGlobs });
        }
    }

    const issues = [];
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        const hits = scanEnterpriseGuardrailContent(file.relativePath, content, {
            extraLeakTokens: options.extraLeakTokens
        });
        const tokenSeverity = options.tokenCapSeverity || 'high';
        for (const issue of hits) {
            if (issue.pattern === 'SB-ENT-002') {
                issue.severity = tokenSeverity;
                issue.severityBand = tokenSeverity;
            }
            if (options.severity && issue.pattern === 'SB-ENT-001') {
                issue.severity = options.severity;
                issue.severityBand = options.severity;
            }
        }
        issues.push(...hits);
    }

    return {
        scanned: files.length,
        findings: issues.length,
        issues,
        patterns: RULE_CATALOG.map((r) => r.id)
    };
}

module.exports = {
    RULE_CATALOG,
    DEFAULT_LEAK_TOKENS,
    buildLeakPattern,
    scanEnterpriseGuardrailContent,
    scanEnterpriseGuardrailPatterns,
    scanDataLeakLines,
    scanTokenBudgetLines
};
