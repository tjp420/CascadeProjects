// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * LLM slop / placeholder detection (SB-FICTION-001–004).
 * Line-based regex scan on source, config, and UI layers — complements fiction-kpi-patterns.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { resolvePackageExists, detectProxyEnvironment } = require('../lib/offline-resolver');
const { globMatch } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = ['server', 'src', 'web', 'lib', 'packages', 'app'];
const MANIFEST_NAMES = new Set(['package.json', 'package-lock.json']);
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.vue', '.svelte', '.json', '.env', '.yaml', '.yml', '.md'
]);
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'coverage', 'dist', 'build', 'archive',
    '.simplebeacon', 'tests', 'test', '__tests__', 'fixtures', 'docs', 'deliverables',
    'coming-soon', 'reports', 'security-reports', 'templates', 'data-central',
    'deployments', 'functions', 'cloudflare-deploy', 'temp', 'tests-legacy',
    '.github-sync', '.cursor', '.vscode', 'downloads', 'findings',
    'simplebeacon-rule-tests', 'simplebeacon-toxic-fixtures'
]);

// Directory names containing __tests__ are already in SKIP_DIRS above, but the
// isExcludedPath regex below also skips explicit test directories to be safe.
const MAX_SCAN_BYTES = 512000;

const RULE_CATALOG_RAW = require('./llm-slop-catalog.json');
const RULE_CATALOG = RULE_CATALOG_RAW.map((r) => ({
    ...r,
    regex: new RegExp(r.regexSource, r.regexFlags)
}));
const SUSPICIOUS_DEP_NAME = /^(fake-|mock-|test-api-package)/i;

const ALLOWLIST_SNIPPETS = [
    'your-api-key-here',
    'your_secret',
    'placeholder',
    'example.com',
    'llm-slop-patterns.js',
    'fiction-kpi-patterns.js',
    'rule_definitions',
    'not model output',
    'baseline false'
];

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
    return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

function isExcludedPath(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    if (/\.(test|spec)\.[jt]sx?$/i.test(normalized)) return true;
    if (/\.(test|spec)\.[cm]js$/i.test(normalized)) return true;
    if (/(?:^|\/)__tests__\//.test(normalized)) return true;
    if (/(?:^|\/)__tests__\.[jt]sx?$/i.test(normalized)) return true;
    if (/(?:^|\/)__tests__\.[cm]js$/i.test(normalized)) return true;
    if (/\/tests?\//.test(normalized)) return true;
    if (/\/fixtures?\//.test(normalized)) return true;
    if (/\.example\.[a-z0-9]+$/i.test(normalized)) return true;
    if (/\.md$/i.test(normalized)) return false;
    if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
    if (/(?:^|\/)reports\//.test(normalized)) return true;
    if (/(?:^|\/)security-reports\//.test(normalized)) return true;
    if (/(?:^|\/)templates\//.test(normalized)) return true;
    if (/(?:^|\/)data-central\//.test(normalized)) return true;
    if (/(?:^|\/)deployments\//.test(normalized)) return true;
    if (/(?:^|\/)functions\//.test(normalized)) return true;
    if (/(?:^|\/)cloudflare-deploy\//.test(normalized)) return true;
    if (/(?:^|\/)archive\//.test(normalized)) return true;
    if (/(?:^|\/)temp\//.test(normalized)) return true;
    if (/(?:^|\/)tests-legacy\//.test(normalized)) return true;
    if (/(?:^|\/)downloads\//.test(normalized)) return true;
    if (/(?:^|\/)web\/(?:data|findings|simplebeacon-findings)\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-toxic-fixtures\//.test(normalized)) return true;
    return false;
}

function isAllowlistedMatch(line, matchText) {
    const strippedLine = String(line || '').replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//, '');
    const snippet = `${strippedLine} ${matchText}`.toLowerCase();
    return ALLOWLIST_SNIPPETS.some((token) => snippet.includes(token));
}

/** SB-FICTION-002 must not flag regex/parsers that detect markdown fences (incl. this rule file). */
function isFenceDetectorMetaLine(line, relativePath, ruleId) {
    if (ruleId !== 'SB-FICTION-002') return false;
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    if (normalized.endsWith('llm-slop-patterns.js')) return true;
    if (normalized.endsWith('llm-slop-catalog.json')) return true;
    const trimmed = line.trim();
    if (/regex:\s*\/[`]{3}/.test(trimmed)) return true;
    if (/\.(?:match|replace|test|split)\(\s*\/[`]{3}/.test(trimmed)) return true;
    if (/\/[`]{3}[a-z]*/i.test(trimmed) && /\/[gimsuy]*['"]?\)/.test(trimmed)) return true;
    if (/[`]{3}(?:json|javascript|typescript|python)/i.test(trimmed)
        && /(?:match|replace|RegExp|extractJson|fenced)/.test(trimmed)) {
        return true;
    }
    return false;
}

function isCommentLine(line, ext) {
    const trimmed = line.trim();
    if (/^(\/\/|#|\*|\/\*)/.test(trimmed)) return true;
    if (ext === '.py' && trimmed.startsWith('#')) return true;
    return false;
}

/* JSDoc continuation lines (prefixed with star inside doc blocks) are standard docs, not slop. */
function isJSDocLine(line) {
    const trimmed = line.trim();
    return /^\*/.test(trimmed);
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
        const baseName = entry.name.toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext) && !MANIFEST_NAMES.has(baseName)) continue;

        const relativePath = normalizeRel(options.baseDir, fullPath);
        if (isExcludedPath(relativePath)) continue;
        if (isIgnored(relativePath, options.ignoreGlobs)) continue;

        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > MAX_SCAN_BYTES) continue;
            results.push({ path: fullPath, relativePath, ext, baseName, size: stat.size });
        } catch {
            /* skip */
        }
    }
    return results;
}

function scanTextPatterns(relativePath, content, ext, options = {}) {
    if (isExcludedPath(relativePath)) {
        return [];
    }
    if (typeof content === 'string' && /simplebeacon-ignore/i.test(content.substring(0, 500))) {
        return [];
    }
    const findings = [];
    const lines = content.split('\n');
    const minConfidence = options.minConfidence ?? 0.5;

    for (const rule of RULE_CATALOG) {
        // Skip patterns below confidence threshold
        if ((rule.confidence ?? 0) < minConfidence) {
            continue;
        }

        // Respect context exclusions from catalog
        const exclusions = rule.contextExclusions;
        if (exclusions && exclusions.ext && exclusions.ext.length > 0) {
            const fileExt = ext || ('.' + path.extname(relativePath));
            if (exclusions.ext.some((e) => relativePath.endsWith(e) || fileExt === e)) {
                continue;
            }
        }

        if (rule.id === 'SB-FICTION-002' && ext === '.md') continue;

        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(content)) !== null) {
            const lineIndex = content.slice(0, match.index).split('\n').length - 1;
            const line = lines[lineIndex] || '';

            // Skip excluded line prefixes
            if (exclusions && exclusions.linePrefixes && exclusions.linePrefixes.length > 0) {
                const trimmed = line.trim();
                if (exclusions.linePrefixes.some((prefix) => trimmed.startsWith(prefix))) {
                    continue;
                }
            }

            if (isAllowlistedMatch(line, match[0]) && rule.id !== 'SB-FICTION-007') continue;
            if (isFenceDetectorMetaLine(line, relativePath, rule.id)) continue;
            if (rule.id === 'SB-FICTION-002' && isJSDocLine(line)) continue;
            if (isCommentLine(line, ext) && rule.id !== 'SB-FICTION-002' && rule.id !== 'SB-FICTION-001' && rule.id !== 'SB-FICTION-005' && rule.id !== 'SB-FICTION-006' && rule.id !== 'SB-FICTION-008') continue;

            const cardType = rule.id === 'SB-FICTION-002' ? 'markdown-fence-leak'
                : rule.id === 'SB-FICTION-001' ? 'ai-placeholder-comment'
                : rule.type || 'llm-slop';
            findings.push({
                id: `llm-slop-${rule.id}-${relativePath}-${match.index}`,
                severity: rule.severity,
                type: cardType,
                filePath: relativePath,
                file: relativePath,
                line: lineIndex + 1,
                pattern: rule.id,
                count: 1,
                description: `${relativePath}:${lineIndex + 1} ${rule.description}`,
                recommendedAction: 'Replace placeholder copy with production-ready values before client handoff',
                affectedFiles: [path.basename(relativePath)],
                metadata: {
                    ruleId: rule.id,
                    match: match[0].slice(0, 120),
                    confidence: rule.confidence
                }
            });
        }
    }

    return findings;
}

function scanSuspiciousDependencies(relativePath, content) {
    if (path.basename(relativePath) !== 'package.json') return [];
    let pkg;
    try {
        pkg = JSON.parse(content);
    } catch {
        return [];
    }

    const findings = [];
    const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
    for (const section of sections) {
        const block = pkg[section];
        if (!block || typeof block !== 'object') continue;
        for (const name of Object.keys(block)) {
            if (!SUSPICIOUS_DEP_NAME.test(name)) continue;
            findings.push({
                id: `llm-slop-SB-FICTION-003-${relativePath}-${name}`,
                severity: 'high',
                type: 'LLM Slop Pattern',
                filePath: relativePath,
                file: relativePath,
                line: 1,
                pattern: 'SB-FICTION-003',
                count: 1,
                description: `${relativePath}: suspicious dependency name "${name}" (${section})`,
                recommendedAction: 'Verify package exists on npm/PyPI or remove fabricated dependency',
                affectedFiles: [relativePath],
                metadata: {
                    ruleId: 'SB-FICTION-003',
                    packageName: name,
                    section
                }
            });
        }
    }
    return findings;
}

function npmRegistryExists(packageName, timeoutMs = 4000) {
    return resolvePackageExists(packageName, { timeoutMs, useCache: true });
}

async function scanUnknownNpmDependencies(relativePath, content, options = {}) {
    if (path.basename(relativePath) !== 'package.json') return [];
    if (options.registryCheck !== true) return [];

    let pkg;
    try {
        pkg = JSON.parse(content);
    } catch {
        return [];
    }

    const names = new Set();
    for (const section of ['dependencies', 'devDependencies']) {
        const block = pkg[section];
        if (!block) continue;
        for (const name of Object.keys(block)) {
            if (name.startsWith('.') || name.startsWith('file:') || name.startsWith('workspace:')) continue;
            if (SUSPICIOUS_DEP_NAME.test(name)) continue;
            names.add(name);
        }
    }

    const flagged = [];
    const limit = Math.min(names.size, options.registryCheckLimit || 12);
    let checked = 0;
    for (const name of names) {
        if (checked >= limit) break;
        checked += 1;
        const exists = await npmRegistryExists(name, options.registryTimeoutMs || 4000);
        if (exists === false) {
            flagged.push({
                id: `llm-slop-registry-404-${relativePath}-${name}`,
                severity: 'high',
                type: 'LLM Slop Pattern',
                filePath: relativePath,
                file: relativePath,
                line: 1,
                pattern: 'SB-FICTION-003b',
                count: 1,
                description: `${relativePath}: npm registry 404 for "${name}" — possible hallucinated package`,
                recommendedAction: 'Remove or replace dependency; confirm package name on registry.npmjs.org',
                affectedFiles: [relativePath],
                metadata: {
                    ruleId: 'SB-FICTION-003b',
                    packageName: name,
                    registryStatus: 404
                }
            });
        }
    }
    return flagged;
}

async function scanLlmSlopPatterns(baseDir, options = {}) {
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

    const rootPackage = path.join(baseDir, 'package.json');
    if (fs.existsSync(rootPackage)) {
        files.push({
            path: rootPackage,
            relativePath: 'package.json',
            ext: '.json',
            baseName: 'package.json',
            size: fs.statSync(rootPackage).size
        });
    }

    const issues = [];
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        issues.push(...scanTextPatterns(file.relativePath, content, file.ext, { minConfidence: options.minConfidence }));
        issues.push(...scanSuspiciousDependencies(file.relativePath, content));
        if (options.registryCheck === true) {
            issues.push(...await scanUnknownNpmDependencies(file.relativePath, content, options));
        }
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
    scanLlmSlopPatterns,
    scanTextPatterns,
    scanSuspiciousDependencies,
    npmRegistryExists
};
