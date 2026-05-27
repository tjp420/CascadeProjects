/**
 * Track non-JS file references (HTML, CSS, JSON).
 */

const path = require('path');
const { resolveImport } = require('./import-parser');

function parseHtmlReferences(content, filePath, projectRoot) {
    const refs = [];
    const patterns = [
        /(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi,
        /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi
    ];
    for (const regex of patterns) {
        let match = regex.exec(content);
        while (match) {
            const specifier = match[1];
            if (!specifier || /^https?:|^data:|^#|^mailto:/i.test(specifier)) {
                match = regex.exec(content);
                continue;
            }
            const resolvedPath = resolveImport(filePath, specifier, projectRoot)
                || resolveImport(filePath, `.${specifier.startsWith('/') ? '' : '/'}${specifier}`, projectRoot);
            if (resolvedPath) {
                refs.push({ kind: 'html-ref', specifier, source: filePath, resolvedPath });
            }
            match = regex.exec(content);
        }
    }
    return refs;
}

function parseCssReferences(content, filePath, projectRoot) {
    const refs = [];
    const regex = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
    let match = regex.exec(content);
    while (match) {
        const specifier = match[1];
        if (!specifier || /^https?:|^data:/i.test(specifier)) {
            match = regex.exec(content);
            continue;
        }
        const resolvedPath = resolveImport(filePath, specifier, projectRoot);
        if (resolvedPath) {
            refs.push({ kind: 'css-ref', specifier, source: filePath, resolvedPath });
        }
        match = regex.exec(content);
    }
    return refs;
}

function parseJsonReferences(content, filePath, projectRoot) {
    const refs = [];
    try {
        const payload = JSON.parse(content);
        collectJsonPaths(payload, (specifier) => {
            if (typeof specifier !== 'string') return;
            if (!specifier.includes('/') && !specifier.startsWith('.')) return;
            const resolvedPath = resolveImport(filePath, specifier, projectRoot);
            if (resolvedPath) {
                refs.push({ kind: 'json-ref', specifier, source: filePath, resolvedPath });
            }
        });
    } catch {
        /* invalid json */
    }
    return refs;
}

function collectJsonPaths(node, onString) {
    if (typeof node === 'string') {
        onString(node);
        return;
    }
    if (Array.isArray(node)) {
        for (const item of node) collectJsonPaths(item, onString);
        return;
    }
    if (node && typeof node === 'object') {
        for (const value of Object.values(node)) collectJsonPaths(value, onString);
    }
}

function parseNonCodeReferences(filePath, content, projectRoot) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
        return parseHtmlReferences(content, filePath, projectRoot);
    }
    if (ext === '.css' || ext === '.scss') {
        return parseCssReferences(content, filePath, projectRoot);
    }
    if (ext === '.json') {
        return parseJsonReferences(content, filePath, projectRoot);
    }
    return [];
}

function addReference(referenceMap, targetPath, sourcePath) {
    const key = path.resolve(targetPath);
    const bucket = referenceMap.get(key) || new Set();
    bucket.add(path.resolve(sourcePath));
    referenceMap.set(key, bucket);
}

module.exports = {
    parseNonCodeReferences,
    addReference,
    parseHtmlReferences,
    parseCssReferences,
    parseJsonReferences
};
