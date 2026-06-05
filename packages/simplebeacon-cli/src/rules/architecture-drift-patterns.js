/**
 * Architecture drift — hybrid/SSM model identifiers without schema validators (gate when enabled).
 * Production paths only; opt-in via config.rules['architecture-drift-patterns'].
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('./production-leak');
const {
    DEFAULT_PRODUCTION_PATHS,
    SCANNABLE_EXTENSIONS,
    isExcludedPath,
    isUnderProductionPaths,
    isCommentLine,
    isAllowlistedMatch,
    splitLines,
    pushFinding,
    makeFinding
} = require('./ai-runtime-scan-common');

const MAX_SCAN_BYTES = 512000;

const HYBRID_MODEL_REGEX = new RegExp(
    [
        String.raw`\bmamba(?:-2)?\b`,
        String.raw`\bstate-spaces\/`,
        String.raw`\bstate-space-model\b`,
        String.raw`\bstate-spaces\b`,
        String.raw`\bssm\b`,
        String.raw`\bjamba\b`,
        String.raw`\bhybrid-transformer\b`,
        String.raw`\bmixture-of-experts\b`,
        String.raw`\btitans\b`,
        String.raw`\blong-context-arch\b`,
        String.raw`\blong-context\b`,
        String.raw`\brwkv\b`,
        String.raw`\bhyena\b`,
        String.raw`\bretnet\b`,
        String.raw`\bmistralai\/mamba\b`,
        String.raw`huggingface\.co\/state-spaces\/`
    ].join('|'),
    'i'
);

const VALIDATOR_REGEX = new RegExp(
    [
        String.raw`\bzod\b`,
        String.raw`\bfrom\s+['"]zod['"]`,
        String.raw`\bajv\b`,
        String.raw`\byup\b`,
        String.raw`\bio-ts\b`,
        String.raw`\bclass-validator\b`,
        String.raw`\bpydantic\.BaseModel\b`,
        String.raw`\bpydantic\.Field\b`,
        String.raw`\b__post_init__\b`,
        String.raw`\bdataclasses\b`,
        String.raw`\bresponse_format\b`,
        String.raw`\bjson_schema\b`,
        String.raw`\bstructuredOutputs\b`,
        String.raw`\bsafeParse\s*\(`,
        String.raw`\b\.parse\s*\(`,
        String.raw`\bvalidate\s*\(`,
        String.raw`\bschema\s*[:=]`
    ].join('|'),
    'i'
);

const RULE_CATALOG = [
    {
        id: 'SB-AD-001',
        category: 'architecture-drift',
        type: 'Architecture Drift',
        severity: 'high',
        description: 'Hybrid/SSM or long-context model identifier without schema/validator guard in the same file'
    }
];

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function scanTextPatterns(relativePath, content, ext, options = {}) {
    const findings = [];
    const seen = new Set();
    if (isExcludedPath(relativePath)) return findings;
    if (options.productionPathsOnly !== false
        && !isUnderProductionPaths(relativePath, options.productionPaths || DEFAULT_PRODUCTION_PATHS)) {
        return findings;
    }
    if (!HYBRID_MODEL_REGEX.test(content)) return findings;
    if (VALIDATOR_REGEX.test(content)) return findings;

    const lines = splitLines(content);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isCommentLine(line, ext)) continue;
        HYBRID_MODEL_REGEX.lastIndex = 0;
        const match = HYBRID_MODEL_REGEX.exec(line);
        if (!match) continue;
        if (isAllowlistedMatch(line, match[0])) continue;
        pushFinding(findings, seen, makeFinding(
            relativePath,
            i + 1,
            RULE_CATALOG[0],
            match[0],
            'Add zod/ajv/Pydantic or response_format/json_schema validation before hybrid or SSM model calls.'
        ));
        break;
    }

    return findings;
}

async function walkProductionSourceFiles(dir, results = [], depth = 0) {
    if (depth > 8) return results;
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', '.git', 'coverage', 'dist', 'build', 'tests', 'test', '__tests__', 'docs', 'examples'].includes(entry.name)) {
                continue;
            }
            await walkProductionSourceFiles(fullPath, results, depth + 1);
            continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
        try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size > MAX_SCAN_BYTES) continue;
            results.push({ path: fullPath, ext });
        } catch {
            /* skip */
        }
    }
    return results;
}

async function scanArchitectureDriftPatterns(baseDir, options = {}) {
    const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
    const ignoreGlobs = options.ignoreGlobs || [];
    const severityDefault = options.severity || 'high';
    const files = [];

    for (const rel of productionPaths) {
        const abs = path.join(baseDir, ...rel.replace(/\/$/, '').split('/'));
        if (fs.existsSync(abs)) {
            await walkProductionSourceFiles(abs, files);
        }
    }

    const seen = new Set();
    const uniqueFiles = [];
    for (const file of files) {
        if (seen.has(file.path)) continue;
        seen.add(file.path);
        uniqueFiles.push(file);
    }

    const issues = [];
    let scanned = 0;

    for (const file of uniqueFiles) {
        const relativePath = normalizeRel(baseDir, file.path);
        if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
        if (isExcludedPath(relativePath)) continue;
        if (!isUnderProductionPaths(relativePath, productionPaths)) continue;

        let content;
        try {
            const stat = await fs.promises.stat(file.path);
            if (stat.size > MAX_SCAN_BYTES) continue;
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        scanned += 1;
        const ext = file.ext || path.extname(file.path).toLowerCase();
        issues.push(...scanTextPatterns(relativePath, content, ext, {
            productionPathsOnly: true,
            productionPaths
        }));
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
    scanArchitectureDriftPatterns,
    DEFAULT_PRODUCTION_PATHS
};
