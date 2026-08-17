// simplebeacon-ignore classification-spillage — scanner rule definitions, not real markings
/**
 * Classification / CUI / export-control spillage detection for production paths.
 * Flags controlled-unclassified and legacy markings that must not ship in software artifacts.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');

const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/', 'api/', 'packages/'];
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.vue', '.svelte',
    '.json', '.env', '.yaml', '.yml', '.toml', '.md', '.txt', '.xml', '.csv', '.sh', '.ps1'
]);
const MAX_SCAN_BYTES = 512000;

const RULE_CATALOG_RAW = require('./classification-spillage-catalog.json');
const RULE_CATALOG = RULE_CATALOG_RAW.map((r) => ({
    ...r,
    regex: new RegExp(r.regexSource, r.regexFlags)
}));

const ALLOWLIST_SNIPPETS = [
    'classification-spillage-catalog.json',
    'classification-spillage-patterns.js',
    'synthetic-cui-marker',
    'synthetic marking for unit test',
    'simplebeacon-toxic-fixtures',
    'sb-gov-001',
    'example marking only'
];

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isExcludedPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/\.(test|spec)\.[jt]sx?$/i.test(normalized)) return true;
    if (/\.(test|spec)\.[cm]js$/i.test(normalized)) return true;
    if (/(?:^|\/)__tests__\//.test(normalized)) return true;
    if (/(?:^|\/)tests?\//.test(normalized)) return true;
    if (/(?:^|\/)fixtures?\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
    if (/(?:^|\/)simplebeacon-toxic-fixtures\//.test(normalized)) return true;
    if (/classification-spillage-catalog\.json$/i.test(normalized)) return true;
    if (/classification-spillage-patterns\.js$/i.test(normalized)) return true;
    return false;
}

function isScannerImplementationPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    if (/(?:^|\/)src\/rules\//.test(normalized) && /classification-spillage/.test(normalized)) return true;
    if (/packages\/simplebeacon-cli\/src\/rules\/classification-spillage/.test(normalized)) return true;
    return false;
}

function isAllowlistedMatch(line, matchText) {
    const snippet = `${line} ${matchText}`.toLowerCase();
    return ALLOWLIST_SNIPPETS.some((token) => snippet.includes(token));
}

function isCommentLine(line, ext) {
    const trimmed = line.trim();
    if (ext === '.py' && trimmed.startsWith('#')) return true;
    if (/^(\/\/|#|\*|\/\*)/.test(trimmed)) return true;
    return false;
}

function lineNumberAt(content, index) {
    let line = 1;
    for (let i = 0; i < index && i < content.length; i++) {
        if (content.charCodeAt(i) === 10) line++;
    }
    return line;
}

function recommendationForRule(rule) {
    switch (rule.category) {
        case 'classification-spillage':
            return 'Remove classification/CUI markings from source. Store controlled content outside the repo or in approved controlled systems.';
        case 'export-control':
            return 'Review export-control references with compliance counsel. Do not embed ITAR/EAR markings in production code paths.';
        default:
            return 'Remove or redact controlled markings before release.';
    }
}

function hasIgnoreNearLine(content, lineIndex) {
    const lines = content.split('\n');
    const cur = lines[lineIndex] || '';
    const prev = lines[lineIndex - 1] || '';
    const ignoreRe = /simplebeacon-ignore(?:\s+classification-spillage)?/i;
    return ignoreRe.test(cur) || ignoreRe.test(prev);
}

function scanTextPatterns(relativePath, content, ext, options = {}) {
    const findings = [];
    if (isExcludedPath(relativePath) || isScannerImplementationPath(relativePath)) return findings;
    if (/simplebeacon-ignore(?:\s+classification-spillage)?/i.test(content.substring(0, 500))) return findings;

    const skipComments = options.skipComments !== false;

    for (const rule of RULE_CATALOG) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(content)) !== null) {
            const lineIndex = lineNumberAt(content, match.index) - 1;
            const line = content.split('\n')[lineIndex] || '';
            if (skipComments && isCommentLine(line, ext)) continue;
            if (hasIgnoreNearLine(content, lineIndex)) continue;
            if (isAllowlistedMatch(line, match[0])) continue;

            findings.push({
                id: `classification-spillage-${rule.id}-${relativePath}-${match.index}`,
                severity: rule.severity,
                severityBand: rule.severity,
                type: rule.type,
                category: rule.category,
                filePath: relativePath,
                file: relativePath,
                line: lineIndex + 1,
                pattern: rule.id,
                count: 1,
                description: `${relativePath}:${lineIndex + 1} — ${rule.description}`,
                recommendation: recommendationForRule(rule),
                recommendedAction: recommendationForRule(rule),
                affectedFiles: [path.basename(relativePath)],
                metadata: {
                    patternId: rule.id,
                    category: rule.category,
                    offset: match.index,
                    match: match[0].slice(0, 120)
                }
            });
        }
    }
    return findings;
}

async function walkClassificationFiles(dir, results = [], depth = 0) {
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
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            await walkClassificationFiles(fullPath, results, depth + 1);
            continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
        results.push({ path: fullPath, ext });
    }
    return results;
}

async function scanClassificationSpillagePatterns(baseDir, options = {}) {
    const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
    const ignoreGlobs = options.ignoreGlobs || [];
    const severityDefault = options.severity || 'critical';
    const scanDocs = options.scanDocs === true;

    const files = [];
    for (const rel of productionPaths) {
        const abs = path.join(baseDir, ...rel.replace(/\/$/, '').split('/'));
        if (fs.existsSync(abs)) {
            await walkClassificationFiles(abs, files);
        }
    }

    const seen = new Set();
    const uniqueFiles = [];
    for (const file of files) {
        const key = file.path;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueFiles.push(file);
    }

    const issues = [];
    let scanned = 0;

    for (const file of uniqueFiles) {
        const relativePath = normalizeRel(baseDir, file.path);
        if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
        if (isExcludedPath(relativePath) || isScannerImplementationPath(relativePath)) continue;

        const ext = file.ext || path.extname(file.path).toLowerCase();
        if (!scanDocs && (ext === '.md' || ext === '.txt')) continue;
        if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

        let content;
        try {
            const stat = await fs.promises.stat(file.path);
            if (stat.size > MAX_SCAN_BYTES) continue;
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        scanned += 1;
        issues.push(...scanTextPatterns(relativePath, content, ext, options));
    }

    for (const issue of issues) {
        if (!issue.severity) issue.severity = severityDefault;
    }

    return {
        scanned,
        findings: issues.length,
        issues,
        patterns: RULE_CATALOG.map((r) => r.id)
    };
}

module.exports = {
    RULE_CATALOG,
    scanTextPatterns,
    scanClassificationSpillagePatterns,
    DEFAULT_PRODUCTION_PATHS
};
