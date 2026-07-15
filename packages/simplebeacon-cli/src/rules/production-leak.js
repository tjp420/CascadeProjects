// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Detect mock/sample/fixture paths referenced from production code directories.
 */

const fs = require('fs');
const path = require('path');
const { classifyProductionLeakMatch } = require('../lib/production-leak-intent');

const DEFAULT_PRODUCTION_PATHS = Object.freeze(['server/', 'src/', 'app/', 'lib/', 'packages/', 'components/', 'modules/', 'services/', 'utils/', 'hooks/', 'types/', 'config/', 'api/', 'web/', 'client/', 'shared/', 'common/', 'core/']);
const DEFAULT_SKIP_DIRS = Object.freeze(['node_modules', '.git', 'coverage', 'dist', 'build']);
const DEFAULT_IGNORE_GLOBS = Object.freeze([
    'node_modules/**',
    'coverage/**',
    'dist/**',
    'build/**',
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.tsx',
    '**/*.spec.tsx',
    'tests/**',
    'test/**',
    '.github-sync/**',
    'github-cache/**',
    '**/*.log',
    '**/*-report*.json',
    '**/test*',
    'archive/**',
    '**/archive/**',
    'simplebeacon-rule-tests/**',
    '**/simplebeacon-rule-tests/**',
    'scripts/**',
    '**/scripts/**'
]);

const LEAK_PATTERNS = Object.freeze([
    Object.freeze({ id: 'sample-json', regex: /['"`][^'"`]*(?:[\/\\][^'"`]+)?-sample\.json['"`]/gi }),
    Object.freeze({ id: 'mock-path', regex: /['"`][^'"`]*(?:\/|\\)mock(?:\/|\\)[^'"`]+['"`]/gi }),
    Object.freeze({ id: 'fixtures-path', regex: /['"`][^'"`]*(?:\/|\\)fixtures(?:\/|\\)[^'"`]+['"`]/gi }),
    Object.freeze({ id: 'web-data-sample', regex: /['"`][^'"`]*(?:[\/\\]|(?<![a-zA-Z0-9_-]))web(?:\/|\\)data[^'"`]*['"`]/gi }),
    Object.freeze({
        id: 'template-sample',
        regex: /`[^`\n]*[\/\\](?:-sample\.json|mock(?:\/|\\)[^`\n]+|fixtures(?:\/|\\)[^`\n]+|web(?:\/|\\)data)[^`\n]*`/gi
    })
]);

const PLAIN_SAMPLE_JSON_PATTERN = Object.freeze({
    id: 'plain-sample-json',
    regex: /['"`][^'"`]*(?:\/|\\|\.\/)(?<![\w-])sample\.json(?:\?[^'"`]*)?['"`]/gi
});

function getActiveLeakPatterns(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!opts.plainSampleJson) {
        return LEAK_PATTERNS;
    }
    return [...LEAK_PATTERNS, PLAIN_SAMPLE_JSON_PATTERN];
}

const SCANNABLE_EXTENSIONS = Object.freeze(new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx']));
const MAX_SCAN_BYTES = 512000;
const NON_PRODUCTION_PATH_HINTS = Object.freeze([
    '/test/', '/tests/', '/__tests__/', '.test.', '.spec.',
    '/fixtures/', '/fixture/', '/mock/', '/mocks/', '/docs/', '/examples/',
    '/storybook/', '/scripts/', '/dev/', '/demo/'
]);
const CONFIG_FILE_NAMES = Object.freeze(new Set([
    'webpack.config.js',
    'vite.config.js',
    'vitest.config.js',
    'jest.config.js',
    'rollup.config.js'
]));

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function lineNumberAt(content, index) {
    if (!content || typeof content !== 'string') return 0;
    const safeIndex = Number.isFinite(index) ? Math.max(0, Math.min(index, content.length)) : 0;
    return content.slice(0, safeIndex).split('\n').length;
}

function globMatch(relativePath, pattern) {
    if (typeof relativePath !== 'string' || typeof pattern !== 'string') return false;
    const normalized = relativePath.split('\\').join('/');
    const p = pattern.split('\\').join('/');

    if (p.includes('node_modules')) {
        return normalized.includes('node_modules/') || normalized.startsWith('node_modules/');
    }
    if (p === 'tests/**' || p.endsWith('/tests/**')) {
        return normalized.startsWith('tests/') || normalized.includes('/tests/');
    }
    if (p === 'test/**' || p.endsWith('/test/**')) {
        return normalized.startsWith('test/') || normalized.includes('/test/');
    }
    if (p.includes('**')) {
        const suffix = p.replace(/^\*\*\//, '');
        if (suffix.startsWith('*.')) {
            return normalized.endsWith(suffix.slice(1));
        }
        if (suffix.endsWith('/**')) {
            const prefix = suffix.replace(/\/\*\*$/, '');
            return normalized === prefix || normalized.startsWith(`${prefix}/`) || normalized.includes(`/${prefix}/`);
        }
        if (p.startsWith('**/') && suffix !== p) {
            try {
                const tailRegex = new RegExp(
                    `(^|/)${suffix.replace(/\./g, '\\.').replace(/\*/g, '[^/]*')}$`
                );
                return tailRegex.test(normalized);
            } catch {
                return false;
            }
        }
    }
    try {
        const regex = new RegExp(
            `^${p.replace(/\./g, '\\.').replace(/\*/g, '[^/]*')}$`
        );
        return regex.test(normalized);
    } catch {
        return false;
    }
}

function isIgnored(relativePath, ignoreGlobs) {
    return ignoreGlobs.some((pattern) => globMatch(relativePath, pattern));
}

function isAllowlisted(relativePath, allowlistFiles) {
    if (typeof relativePath !== 'string') return false;
    const normalized = relativePath.split('\\').join('/');
    return allowlistFiles.some((entry) => {
        if (typeof entry !== 'string') return false;
        const allowed = entry.split('\\').join('/');
        return normalized === allowed
            || normalized.endsWith('/' + allowed)
            || allowed.endsWith('/' + normalized);
    });
}

function isScannerMetaFile(relativePath, userMetaFiles = []) {
    if (typeof relativePath !== 'string') return false;
    const normalized = relativePath.split('\\').join('/');
    return userMetaFiles.some((entry) => {
        if (typeof entry !== 'string') return false;
        return normalized === entry.split('\\').join('/');
    });
}

function shouldSuppressMatch({ relativePath, line, matchText }) {
    const lineStr = String(line || '');
    const matchStr = String(matchText || '');

    const trimmed = lineStr.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return true;

    if (typeof relativePath === 'string') {
        let base;
        try { base = path.basename(relativePath); } catch { /* ignore */ }
        if (base && CONFIG_FILE_NAMES.has(base)) return true;
        if (/\.simplebeacon|truthcheck|repository-audit|page-sample-specs/i.test(matchStr)) return true;
    }

    if (/mock\/sample(?:\s+(?:json|files|data|paths?|only)|\s*—)/i.test(matchStr) || /Mock\/sample\s+files/i.test(matchStr)) return true;

    if (/instead of\s+["'`]template(?:\s|-)sample["'`]/i.test(matchStr) || /use the phrase\s+["'`]sample-suffix subset["'`]/i.test(matchStr)) return true;

    if (/\bexpress\.static\s*\(/.test(lineStr) && /web[/\\]data/.test(lineStr)) return true;

    if (/\bfilePath\s*[:=]\s*[`'][^`']*mock_data_/.test(lineStr)) return true;

    if (/\b(mockDataAnalysis|mockData|sampleData|fixtureData|demoData|testData)\s*:\s*Joi\./.test(lineStr)) return true;

    if (/\bexpress\.static\s*\(\s*[^)]+web[/\\]data/.test(lineStr) || /\bjoin\s*\(\s*__dirname\s*,\s*['"]\.\.\/web\/data['"]/.test(lineStr)) return true;

    return false;
}

function hasProductionLeakIntentAnnotation(content) {
    return /simplebeacon:production-leak-intent/i.test(content);
}

function isProductionRelevantPath(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').toLowerCase();
    return !NON_PRODUCTION_PATH_HINTS.some((hint) => normalized.includes(hint));
}

function mapSeverityBand(relativePath, patternId) {
    if (!isProductionRelevantPath(relativePath)) return 'medium';
    if (patternId === 'sample-json' || patternId === 'web-data-sample') {
        return 'critical';
    }
    if (patternId === 'plain-sample-json' || patternId === 'mock-path' || patternId === 'template-sample') {
        return 'high';
    }
    return 'medium';
}

function buildRecommendation(patternId) {
    if (patternId === 'sample-json' || patternId === 'web-data-sample') {
        return 'Replace hardcoded sample data imports with measured runtime API/scanner output before release';
    }
    if (patternId === 'plain-sample-json') {
        return 'Replace plain sample.json imports with live data sources or move demo defaults behind example/dev routes';
    }
    if (patternId === 'mock-path' || patternId === 'template-sample') {
        return 'Move mock-only paths behind test/dev gates and keep production paths bound to live data sources';
    }
    return 'Audit fixture usage and remove mock references from production-bound modules';
}

async function walkProductionFiles(dir, results = [], depth = 0, skipDirs = DEFAULT_SKIP_DIRS) {
    if (depth > 8) return results;
    if (typeof dir !== 'string' || !dir) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs && skipDirs.includes(entry.name)) continue;
            await walkProductionFiles(fullPath, results, depth + 1, skipDirs);
            continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > MAX_SCAN_BYTES) continue;
            results.push({ path: fullPath, name: entry.name, ext, size: stat.size });
        } catch {
            /* skip */
        }
    }
    return results;
}

/**
 * @param {string} relativePath
 * @param {string} content
 * @param {{intentClassification?:boolean,severityBand?:string,severity?:string,plainSampleJson?:boolean}} [options]
 * @returns {{findings:any[],suppressed:any[]}}
 */
function scanFileContent(relativePath, content, options = {}) {
    const findings = [];
    const suppressed = [];
    if (typeof relativePath !== 'string') return { findings, suppressed };
    const opts = (options && typeof options === 'object') ? options : {};
    const intentClassification = opts.intentClassification !== false;
    const fallbackSeverityBand = opts.severityBand || opts.severity || 'high';
    if (typeof content !== 'string') return { findings, suppressed };
    const lines = content.split('\n');
    const patterns = getActiveLeakPatterns(opts);

    if (hasProductionLeakIntentAnnotation(content)) {
        return { findings: [], suppressed };
    }

    for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
            const lineNum = lineNumberAt(content, match.index);
            const lineIndex = lineNum - 1;
            const line = lines[lineIndex] || '';
            const snippet = content.slice(Math.max(0, match.index - 12), match.index + match[0].length + 12);
            if (shouldSuppressMatch({ relativePath, line, matchText: match[0] }) || shouldSuppressMatch({ relativePath, line, matchText: snippet })) continue;

            let intentResult = null;
            if (intentClassification) {
                intentResult = classifyProductionLeakMatch({
                    relativePath,
                    content,
                    lineIndex,
                    matchText: match[0],
                    patternId: pattern.id
                });
                if (intentResult.suppress) {
                    suppressed.push({
                        filePath: relativePath,
                        line: lineNum,
                        pattern: pattern.id,
                        intent: intentResult.intent,
                        reason: intentResult.reason,
                        match: match[0]
                    });
                    continue;
                }
            }

            const severityBand = intentResult?.severityBand
                || ((opts.severityBand || opts.severity)
                    ? fallbackSeverityBand
                    : mapSeverityBand(relativePath, pattern.id));
            const recommendation = buildRecommendation(pattern.id);
            const cardType = pattern.id === 'sample-json-ref' ? 'sample-json-ref'
                : pattern.id === 'c-sample-data-ref' || pattern.id === 'c-mock-path-ref' ? 'mock-path-leak'
                : pattern.id.startsWith('mock') || pattern.id.startsWith('c-') ? 'mock-path-leak'
                : 'production-leak';
            findings.push({
                id: `production-leak-${pattern.id}-${relativePath}-${match.index}`,
                severity: severityBand === 'critical' ? 'high' : severityBand,
                severityBand,
                type: cardType,
                filePath: relativePath,
                file: relativePath,
                line: lineNum,
                pattern: pattern.id,
                count: 1,
                description: `${relativePath}:${lineNum} references mock/sample path (${pattern.id})`,
                recommendation,
                recommendedAction: recommendation,
                affectedFiles: [path.basename(relativePath)],
                metadata: {
                    patternId: pattern.id,
                    offset: match.index,
                    match: match[0],
                    intent: intentResult?.intent || 'unclassified',
                    intentReason: intentResult?.reason || null,
                    findingPayload: {
                        file: relativePath,
                        line: lineNum,
                        pattern: pattern.id,
                        recommendation
                    }
                }
            });
        }
    }

    return { findings, suppressed };
}

/**
 * @param {string} baseDir
 * @param {{productionPaths?:string[],ignoreGlobs?:string[],allowlistFiles?:string[],scannerMetaFiles?:string[],severity?:string,intentClassification?:boolean,plainSampleJson?:boolean}} [options]
 * @returns {Promise<{scanned:number,findings:number,issues:any[],suppressedIntent:any[],suppressedIntentCount:number}>}
 */
async function scanProductionLeaks(baseDir, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const productionPaths = Array.isArray(opts.productionPaths) ? opts.productionPaths : DEFAULT_PRODUCTION_PATHS;
    const ignoreGlobs = Array.isArray(opts.ignoreGlobs) ? opts.ignoreGlobs : DEFAULT_IGNORE_GLOBS;
    const allowlistFiles = Array.isArray(opts.allowlistFiles)
        ? opts.allowlistFiles.map((p) => String(p).split('\\').join('/'))
        : [];
    const scannerMetaFiles = Array.isArray(opts.scannerMetaFiles) ? opts.scannerMetaFiles : [];
    const severity = opts.severity || 'high';

    const files = [];
    for (const rel of productionPaths) {
        const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...rel.split('/'));
        if (fs.existsSync(abs)) {
            await walkProductionFiles(abs, files);
        }
    }

    const issues = [];
    const suppressedIntent = [];
    let scanned = 0;
    const BATCH = 64;

    for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const batchResults = await Promise.all(batch.map(async (file) => {
            const relativePath = normalizeRel(baseDir, file.path);
            if (isIgnored(relativePath, ignoreGlobs)) return null;
            if (isAllowlisted(relativePath, allowlistFiles)) return null;
            if (isScannerMetaFile(relativePath, scannerMetaFiles)) return null;

            let content;
            try {
                content = await fs.promises.readFile(file.path, 'utf8');
            } catch {
                return null;
            }
            const result = scanFileContent(relativePath, content, {
                severity,
                intentClassification: options.intentClassification !== false,
                plainSampleJson: options.plainSampleJson === true
            });
            return { scanned: 1, findings: result.findings, suppressed: result.suppressed };
        }));
        for (const r of batchResults) {
            if (!r) continue;
            scanned += r.scanned;
            issues.push(...r.findings);
            suppressedIntent.push(...r.suppressed);
        }
    }

    return {
        scanned,
        findings: issues.length,
        issues,
        suppressedIntent,
        suppressedIntentCount: suppressedIntent.length
    };
}

module.exports = Object.freeze({
    DEFAULT_PRODUCTION_PATHS,
    DEFAULT_SKIP_DIRS,
    DEFAULT_IGNORE_GLOBS,
    LEAK_PATTERNS,
    PLAIN_SAMPLE_JSON_PATTERN,
    getActiveLeakPatterns,
    scanProductionLeaks,
    scanFileContent,
    globMatch,
    walkProductionFiles,
    normalizeRel
});
