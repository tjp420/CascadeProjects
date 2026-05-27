/**
 * Extract static import/require references from source files.
 */

const path = require('path');
const fs = require('fs');

const JS_SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);

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

function isRelativeSpecifier(specifier) {
    return specifier.startsWith('.') || specifier.startsWith('/');
}

function resolveImport(fromFile, specifier, projectRoot) {
    if (!isRelativeSpecifier(specifier)) {
        return null;
    }
    const baseDir = path.dirname(fromFile);
    const raw = path.resolve(baseDir, specifier);
    const candidates = [
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
    for (const candidate of candidates) {
        if (candidate.startsWith(projectRoot) && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function parseJSImports(content, filePath, projectRoot) {
    const imports = [];
    for (const pattern of JS_PATTERNS) {
        for (const specifier of extractMatches(content, pattern.regex)) {
            if (!isRelativeSpecifier(specifier)) continue;
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

module.exports = {
    parseImports,
    parseJSImports,
    parsePythonImports,
    resolveImport,
    JS_SOURCE_EXTENSIONS
};
