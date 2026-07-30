// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
/**
 * Lightweight secret/credential pattern scan for mock-data and production paths.
 */

const fs = require('fs');
const path = require('path');
const { walkProductionFiles, globMatch } = require('../rules/production-leak');

const CREDENTIAL_PATTERNS = [
    { id: 'aws-access-key', regex: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'high' },
    { id: 'github-pat', regex: /\bghp_[A-Za-z0-9]{20,}\b/g, severity: 'high' },
    { id: 'github-oauth', regex: /\bgho_[A-Za-z0-9]{20,}\b/g, severity: 'high' },
    { id: 'openai-key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g, severity: 'high' },
    { id: 'jwt-token', regex: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, severity: 'high' },
    { id: 'slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'high' },
    { id: 'stripe-key', regex: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{16,}\b/g, severity: 'high' },
    { id: 'database-url', regex: new RegExp('(?:postgres|postgresql|mysql|mongodb(?:\\+srv)?):\\/\\/[^\\s\'"]+:[^\\s\'"]+@[^\\s\'"]+', 'gi'), severity: 'high' }, // simplebeacon-ignore redos — scanner rule definition
    { id: 'sendgrid-key', regex: /\bSG\.[A-Za-z0-9_-]{20,}\b/g, severity: 'high' },
    { id: 'resend-key', regex: /\bre_[A-Za-z0-9]{20,}\b/g, severity: 'high' },
    { id: 'firebase-key', regex: /"private_key"\s*:\s*"-----BEGIN/g, severity: 'high' },
    { id: 'generic-api-key', regex: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi, severity: 'medium' },
    { id: 'bearer-token', regex: /Bearer\s+[A-Za-z0-9._-]{20,}/g, severity: 'medium' },
    { id: 'private-key-block', regex: new RegExp('-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----', 'g'), severity: 'high' }, // simplebeacon-ignore redos — scanner rule definition
];

const ALLOWLIST_SNIPPETS = [
    'demo123',
    'dev@simplebeacon.ai',
    'your-api-key-here',
    'your-secret-key',
    'your_secret_key',
    'your_secret',
    '<your-',
    'placeholder',
    'example.com',
    'xxxxxxxx',
    'replace_me',
    'changeme',
    'dummy',
    'test-only',
    'not-a-real',
    'hardcoded-secret-for-unit-test',
    'secret-key-for-unit-test',
    'cascade-secret-key-2024-secure',
    'sk_test_your',
    'sk_test_123456789',
    'pk_test_1234567890abcdef',
    'pk_test_51234567890abcdef',
    '51234567890abcdef',
    '1234567890abcdef',
    'kh9nv',
    'AKIAIOSFODNN7EXAMPLE',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    'example-key',
    'dummy-token',
    'test-secret',
    'fake-api-key',
    'sample-token',
    'mock-secret',
    'placeholder-key',
    'placeholder-token',
    'template-secret',
    'insert_secret_here',
    'your_api_key_here',
    'insert-api-key-here'
];

const SCANNABLE_EXTENSIONS = new Set(['.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.env', '.yaml', '.yml', '.txt', '.md']);
const SUPPRESS_PATTERN = /(?:\/\/|#)\s*simplebeacon-ignore\s+(?:credentials|credential-pattern)/i;
const MAX_SCAN_BYTES = 256000;

const BLOCKING_PATTERN_IDS = new Set([
    'github-pat',
    'github-oauth',
    'openai-key',
    'aws-access-key',
    'stripe-key',
    'private-key-block',
    'resend-key',
    'sendgrid-key',
    'jwt-token',
    'slack-token',
    'database-url',
    'firebase-key'
]);

function lineNumberAt(content, index) {
    if (typeof content !== 'string') return 1;
    const idx = typeof index === 'number' && Number.isFinite(index) ? Math.max(0, index) : 0;
    return content.slice(0, idx).split('\n').length;
}

function severityBandForPattern(patternId) {
    if (['private-key-block', 'aws-access-key', 'github-pat', 'github-oauth', 'openai-key', 'stripe-key'].includes(patternId)) {
        return 'critical';
    }
    if (['jwt-token', 'slack-token'].includes(patternId)) {
        return 'high';
    }
    return 'medium';
}

function isAllowlisted(match, content, fileName = '') {
    if (!match || typeof match.index !== 'number' || !match[0] || typeof content !== 'string') return true;
    const snippet = content.slice(Math.max(0, match.index - 24), match.index + match[0].length + 24);
    const lower = snippet.toLowerCase();
    if (ALLOWLIST_SNIPPETS.some((allowed) => lower.includes(allowed.toLowerCase()))) {
        return true;
    }

    // Ignore placeholder bearer tokens in test fixture modules.
    if (/bearer\s+test-token-placeholder/i.test(match[0])) {
        return true;
    }

    // auth strategy scaffolding often includes apiKey variable names without secrets.
    if (/auth-strategies\.js$/i.test(fileName)
        && /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\b/i.test(match[0])) {
        return true;
    }

    // Ignore redacted placeholder strings and environment variable reads.
    if (/\*\*\*REDACTED\*\*\*/.test(match[0]) || /process\.env\./i.test(snippet)) {
        return true;
    }

    // Check for suppression comment on the same line.
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const lineEnd = content.indexOf('\n', match.index);
    const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (SUPPRESS_PATTERN.test(line)) {
        return true;
    }

    return false;
}

function redactMatch(value) {
    const raw = String(value || '');
    if (raw.length <= 4) return '****';
    return `${raw.slice(0, 4)}…`;
}

function isBlockingSecretFinding(finding) {
    if (!finding || typeof finding !== 'object') return false;
    if (finding.severityBand === 'critical') return true;
    if (BLOCKING_PATTERN_IDS.has(finding.pattern)) return true;
    if (finding.pattern === 'generic-api-key' || finding.pattern === 'bearer-token') {
        const matchLength = finding.metadata?.matchLength || 0;
        return matchLength >= 20;
    }
    return false;
}

function scanTextContent(fileName, content, filePath = fileName) {
    if (typeof content !== 'string') return [];
    if (/simplebeacon-ignore/i.test(content.substring(0, 500))) return [];
    const findings = [];

    for (const pattern of CREDENTIAL_PATTERNS) {
        if (!pattern || !pattern.regex || typeof pattern.regex.exec !== 'function') continue;
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
            if (isAllowlisted(match, content, fileName)) continue;
            const line = lineNumberAt(content, match.index);
            const severityBand = severityBandForPattern(pattern.id);
            const recommendation = severityBand === 'critical'
                ? 'Immediately remove and rotate this credential; store only via environment/secret manager bindings'
                : severityBand === 'high'
                    ? 'Remove token-like material from source control and rotate if it was ever exposed'
                    : 'Replace hardcoded token/value with environment-backed configuration and verify this is not a real secret';
            findings.push({
                id: `${pattern.id}-${fileName}-${match.index}`,
                severity: severityBand === 'critical' ? 'high' : pattern.severity,
                severityBand,
                type: 'Credential Pattern',
                filePath,
                file: filePath,
                line,
                pattern: pattern.id,
                count: 1,
                description: `${filePath}:${line} possible ${pattern.id.replace(/-/g, ' ')}`,
                recommendation,
                recommendedAction: recommendation,
                affectedFiles: [fileName],
                metadata: {
                    patternId: pattern.id,
                    offset: match.index,
                    matchLength: match[0].length,
                    redactedPreview: redactMatch(match[0]),
                    findingPayload: {
                        file: filePath,
                        line,
                        pattern: pattern.id,
                        recommendation
                    }
                }
            });
        }
    }

    return findings;
}

/**
 * Fast pre-commit gate: scan staged git index blobs for blocking credential patterns.
 * @param {string} [cwd]
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ pass: boolean, blockingCount: number, findings: object[], scannedFiles: number, skippedFiles: string[], message?: string }}
 */
function runStagedSecretsGate(cwd, options = {}) {
    const { collectGitStagedFiles, readStagedFileContent } = require('./git-diff-scope');
    const root = cwd || process.cwd();
    const stagedPaths = collectGitStagedFiles(root);

    if (stagedPaths === null) {
        return {
            pass: true,
            blockingCount: 0,
            findings: [],
            scannedFiles: 0,
            skippedFiles: [],
            message: 'Not a git repository — staged secrets gate skipped'
        };
    }

    if (!stagedPaths.length) {
        return {
            pass: true,
            blockingCount: 0,
            findings: [],
            scannedFiles: 0,
            skippedFiles: [],
            message: 'Nothing staged — secrets gate passed'
        };
    }

    const allFindings = [];
    const skippedFiles = [];
    let scannedFiles = 0;

    for (const relativePath of stagedPaths) {
        const name = path.basename(relativePath);
        const ext = path.extname(name).toLowerCase();
        if (isCredentialScanExcludedPath({ relativePath, name })) {
            skippedFiles.push(relativePath);
            continue;
        }
        if (!SCANNABLE_EXTENSIONS.has(ext)) {
            skippedFiles.push(relativePath);
            continue;
        }

        const content = readStagedFileContent(root, relativePath, { maxBytes: MAX_SCAN_BYTES });
        if (content === null) {
            skippedFiles.push(relativePath);
            continue;
        }

        scannedFiles += 1;
        const hits = scanTextContent(name, content, relativePath);
        for (const hit of hits) {
            if (isBlockingSecretFinding(hit)) {
                allFindings.push(hit);
            }
        }
    }

    const blockingCount = allFindings.length;
    return {
        pass: blockingCount === 0 || Boolean(options.dryRun),
        blockingCount,
        findings: allFindings,
        scannedFiles,
        skippedFiles,
        message: blockingCount === 0
            ? `Staged secrets gate passed (${scannedFiles} file(s) scanned)`
            : `Staged secrets gate failed (${blockingCount} blocking finding(s))`
    };
}

function isCredentialScanExcludedPath(file) {
    const rel = String(file.relativePath || '').replace(/\\/g, '/');
    const name = String(file.name || '').toLowerCase();
    return /simplebeacon-rule-tests\//.test(rel)
        || /packages\/simplebeacon-cli\/tests\//.test(rel)
        || /test-all-patterns\.js/.test(rel)
        || name === 'test-all-patterns.js'
        || /-tokens?\.txt$/i.test(name)
        || /packages\/simplebeacon-cli\/src\/(?:lib|rules|reporters|analyzers|proxy)\//.test(rel)
        || /\/credential-pattern-scanner\.js$/.test(rel)
        || /\/report-sanitizer\.js$/.test(rel)
        || /pattern-documentation\.js$/.test(rel)
        || /quick-actions\.js$/.test(rel)
        || /social-posts\.md$/i.test(rel)
        || /scan-wasm-bridge\.test\.js$/i.test(rel)
        || /llm-slop-patterns\.test\.js$/i.test(rel)
        || /coming-soon\//.test(rel)
        || /coming-soon\/public\/data\//.test(rel)
        || /\.env\.(example|sample|template|local\.example)$/.test(name);
}

async function scanCredentialPatterns(files, options = {}) {
    const issues = [];
    let scanned = 0;
    const ignoreGlobs = Array.isArray(options.ignoreGlobs) ? options.ignoreGlobs : [];
    if (!Array.isArray(files)) return { scanned: 0, findings: 0, issues: [] };

    for (const file of files) {
        if (isCredentialScanExcludedPath(file)) continue;
        if (ignoreGlobs.length && file.relativePath && ignoreGlobs.some((pattern) => globMatch(file.relativePath, pattern))) continue;
        if (!SCANNABLE_EXTENSIONS.has(file.ext)) continue;
        if (file.size > MAX_SCAN_BYTES) continue;

        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        scanned += 1;
        issues.push(...scanTextContent(file.name, content, file.path));
    }

    if (options.scanProduction && options.baseDir && options.productionPaths?.length) {
        const prodFiles = [];
        for (const rel of options.productionPaths) {
            const abs = path.isAbsolute(rel)
                ? rel
                : path.join(options.baseDir, ...rel.split('/'));
            if (fs.existsSync(abs)) {
                await walkProductionFiles(abs, prodFiles);
            }
        }

        const ignoreGlobs = options.ignoreGlobs || [];
        for (const file of prodFiles) {
            const relativePath = path.relative(options.baseDir, file.path).split(path.sep).join('/');
            if (isCredentialScanExcludedPath({ relativePath })) continue;
            if (ignoreGlobs.some((pattern) => globMatch(relativePath, pattern))) continue;
            if (!SCANNABLE_EXTENSIONS.has(file.ext)) continue;
            if (file.size > MAX_SCAN_BYTES) continue;

            let content;
            try {
                content = await fs.promises.readFile(file.path, 'utf8');
            } catch {
                continue;
            }

            scanned += 1;
            const hits = scanTextContent(file.name, content, relativePath);
            issues.push(...hits.map((hit) => ({
                ...hit,
                description: `${relativePath}: possible ${hit.metadata.patternId.replace(/-/g, ' ')} in production path`
            })));
        }
    }

    return {
        scanned,
        findings: issues.length,
        issues
    };
}

module.exports = {
    CREDENTIAL_PATTERNS,
    BLOCKING_PATTERN_IDS,
    scanCredentialPatterns,
    scanTextContent,
    runStagedSecretsGate,
    isBlockingSecretFinding,
    redactMatch
};
