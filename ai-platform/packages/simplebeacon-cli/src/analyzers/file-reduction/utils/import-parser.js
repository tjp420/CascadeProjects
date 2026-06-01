/**
 * Extract static import/require references from source files.
 */

const path = require('path');
const fs = require('fs');

const JS_SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

const TSCONFIG_CACHE = new Map();

const JS_PATTERNS = [
    { kind: 'esm', regex: /import\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g },
    { kind: 'cjs', regex: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
    { kind: 'dynamic', regex: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g }
];

const PY_PATTERNS = [
    { kind: 'py-import', regex: /^\s*import\s+([a-zA-Z0-9_.]+)/gm },
    { kind: 'py-from', regex: /^\s*from\s+([a-zA-Z0-9_.]+)\s+import/mg }
];

function extractMatches(content, regex) {
    const matches = [];
    let match = regex.exec(content);
    while (match) {
        matches.push(match[1]);
        match = regex.exec(content);
    }
    return matches;
}

function normalizeSpecifier(specifier) {
    if (!specifier) return specifier;
    return specifier.split('?')[0].split('#')[0];
}

function isRelativeSpecifier(specifier) {
    return specifier.startsWith('.') || specifier.startsWith('/');
}

function resolveImportCandidates(raw) {
    return [
        raw,
        `${raw}.js`,
        `${raw}.mjs`,
        `${raw}.cjs`,
        `${raw}.ts`,
        `${raw}.tsx`,
        `${raw}.jsx`,
        path.join(raw, 'index.js'),
        path.join(raw, 'index.ts')
    ];
}

function firstExistingPath(candidates, projectRoot) {
    for (const candidate of candidates) {
        if (candidate.startsWith(projectRoot) && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function loadTsconfigPaths(tsconfigPath) {
    if (TSCONFIG_CACHE.has(tsconfigPath)) {
        return TSCONFIG_CACHE.get(tsconfigPath);
    }
    let config = null;
    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf8');
        const parsed = JSON.parse(raw);
        const paths = parsed.compilerOptions?.paths || {};
        config = {
            baseUrl: path.dirname(tsconfigPath),
            paths
        };
    } catch {
        config = null;
    }
    TSCONFIG_CACHE.set(tsconfigPath, config);
    return config;
}

function findTsconfigForFile(fromFile, projectRoot) {
    let dir = path.dirname(fromFile);
    while (dir.startsWith(projectRoot)) {
        const tsconfigPath = path.join(dir, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath)) {
            return loadTsconfigPaths(tsconfigPath);
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function resolveAliasImport(fromFile, specifier, projectRoot) {
    const tsconfig = findTsconfigForFile(fromFile, projectRoot);
    if (!tsconfig) return null;

    for (const [aliasPattern, targets] of Object.entries(tsconfig.paths)) {
        if (!Array.isArray(targets) || !targets[0]) continue;
        const starIndex = aliasPattern.indexOf('*');
        if (starIndex === -1) continue;
        const prefix = aliasPattern.slice(0, starIndex);
        const suffix = aliasPattern.slice(starIndex + 1);
        if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
        const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
        const target = targets[0].replace('*', captured);
        const raw = path.resolve(tsconfig.baseUrl, target);
        return firstExistingPath(resolveImportCandidates(raw), projectRoot);
    }
    return null;
}

function resolveImport(fromFile, specifier, projectRoot) {
    const normalized = normalizeSpecifier(specifier);
    if (!isRelativeSpecifier(normalized)) {
        if (normalized.startsWith('@/')) {
            return resolveAliasImport(fromFile, normalized, projectRoot);
        }
        return null;
    }
    const baseDir = path.dirname(fromFile);
    const raw = path.resolve(baseDir, normalized);
    return firstExistingPath(resolveImportCandidates(raw), projectRoot);
}

function parseJSImports(content, filePath, projectRoot) {
    const imports = [];
    for (const pattern of JS_PATTERNS) {
        for (const specifier of extractMatches(content, pattern.regex)) {
            const normalized = normalizeSpecifier(specifier);
            if (!isRelativeSpecifier(normalized) && !normalized.startsWith('@/')) continue;
            const resolvedPath = resolveImport(filePath, specifier, projectRoot);
            if (!resolvedPath) continue;
            imports.push({
                kind: pattern.kind,
                specifier,
                source: filePath,
                resolvedPath
            });
        }
    }
    return imports;
}

function parsePythonImports(content, filePath) {
    const imports = [];
    for (const pattern of PY_PATTERNS) {
        for (const moduleName of extractMatches(content, pattern.regex)) {
            imports.push({
                kind: pattern.kind,
                specifier: moduleName,
                source: filePath,
                resolvedPath: null
            });
        }
    }
    return imports;
}

function parseImports(filePath, content, projectRoot) {
    const ext = path.extname(filePath).toLowerCase();
    if (JS_SOURCE_EXTENSIONS.has(ext)) {
        return parseJSImports(content, filePath, projectRoot);
    }
    if (ext === '.py') {
        return parsePythonImports(content, filePath);
    }
    return [];
}

const RUNTIME_REFERENCE_PATTERNS = [
    { kind: 'fetch', regex: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g },
    { kind: 'fs-readFile', regex: /fs\.(?:promises\.)?readFile(?:Sync)?\s*\(\s*['"`]([^'"`]+)['"`]/g },
    { kind: 'readFileSync', regex: /readFileSync\s*\(\s*['"`]([^'"`]+)['"`]/g },
    { kind: 'createReadStream', regex: /createReadStream\s*\(\s*['"`]([^'"`]+)['"`]/g }
];

function resolveRuntimePath(fromFile, specifier, projectRoot) {
    const normalized = normalizeSpecifier(specifier);
    if (!normalized || normalized.startsWith('http://') || normalized.startsWith('https://')) {
        return null;
    }
    if (isRelativeSpecifier(normalized)) {
        return resolveImport(fromFile, normalized, projectRoot);
    }
    return path.join(projectRoot, normalized.split('/').join(path.sep));
}

function parseRuntimeReferences(filePath, content, projectRoot) {
    const ext = path.extname(filePath).toLowerCase();
    if (!JS_SOURCE_EXTENSIONS.has(ext)) {
        return [];
    }

    const references = [];
    for (const pattern of RUNTIME_REFERENCE_PATTERNS) {
        for (const specifier of extractMatches(content, pattern.regex)) {
            references.push({
                kind: pattern.kind,
                specifier,
                source: filePath,
                resolvedPath: resolveRuntimePath(filePath, specifier, projectRoot)
            });
        }
    }
    return references;
}

module.exports = {
    parseImports,
    parseJSImports,
    parsePythonImports,
    parseRuntimeReferences,
    resolveImport,
    normalizeSpecifier,
    JS_SOURCE_EXTENSIONS
};
