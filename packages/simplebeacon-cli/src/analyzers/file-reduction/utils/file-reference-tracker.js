// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Track non-JS file references (HTML, CSS, JSON, worker scripts).
 *
 * @module file-reference-tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizePathKey } = require('../../../lib/path-utils');
const { normalizeSpecifier, resolveImport } = require('./import-parser');

/** Pre-compiled regexes cached at module scope. */
const HTML_PATTERNS = Object.freeze([
    { kind: 'html-ref', regex: /(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi },
    { kind: 'css-ref', regex: /url\(\s*['"]?([^'"\)\\s]+)['"]?\s*\)/gi }
]);
const CSS_URL_PATTERN = /url\(\s*['"]?([^'"\)\\s]+)['"]?\s*\)/gi;
const WORKER_SINGLE_PATTERNS = Object.freeze([
    /path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g,
    /WORKER_SCRIPT\s*=\s*path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g
]);
const WORKER_MULTI_PATTERN = /path\.join\s*\(\s*__dirname\s*((?:\s*,\s*['"][^'"]+['"])+\s*)\)/g;
const PACKAGE_REL_PATTERN = /path\.join\s*\(\s*[^,)]+,\s*((?:['"][^'"]+['"]\s*,?\s*)+)\)/g;
const SPAWN_PATTERN = /(?:spawn|spawnSync|execFile(?:Sync)?)\s*\(\s*['"]([^'"]+\.py)['"]/g;

/**
 * Detect the nearest `web/` root from a relative path.
 * @param {string} relFrom
 * @returns {string|null}
 */
function resolveWebRootRel(relFrom) {
    if (relFrom.startsWith('web/') || relFrom === 'web') {
        return 'web';
    }
    if (relFrom.includes('/web/')) {
        return `${relFrom.split('/web/')[0]}/web`;
    }
    return null;
}

/**
 * Resolve an absolute web-root reference (e.g. `/css/style.css`).
 * @param {string} fromFile
 * @param {string} specifier
 * @param {string} projectRoot
 * @returns {string|null}
 */
function resolveWebAbsolutePath(fromFile, specifier, projectRoot) {
    if (!specifier.startsWith('/')) return null;
    const relFrom = path.relative(projectRoot, fromFile).split(path.sep).join('/');
    const webRootRel = resolveWebRootRel(relFrom);
    if (!webRootRel) return null;
    const candidate = path.resolve(projectRoot, webRootRel, specifier.slice(1));
    const rootResolved = path.resolve(projectRoot);
    if (normalizePathKey(candidate).startsWith(normalizePathKey(rootResolved)) && fs.existsSync(candidate)) {
        return candidate;
    }
    return null;
}

/**
 * Resolve an absolute static-site reference (e.g. `/img/logo.png` inside `coming-soon/`).
 * @param {string} fromFile
 * @param {string} specifier
 * @param {string} projectRoot
 * @returns {string|null}
 */
function resolveStaticSiteAbsolutePath(fromFile, specifier, projectRoot) {
    if (!specifier.startsWith('/')) return null;
    const relFrom = path.relative(projectRoot, fromFile).split(path.sep).join('/');
    const siteRoots = ['coming-soon', 'deployments'];
    const rootNorm = normalizePathKey(projectRoot);
    for (const rootName of siteRoots) {
        const marker = `${rootName}/`;
        const idx = relFrom.indexOf(marker);
        if (idx === -1) continue;
        const siteRel = relFrom.slice(0, idx + rootName.length);
        const candidate = path.resolve(projectRoot, siteRel, specifier.slice(1));
        if (normalizePathKey(candidate).startsWith(rootNorm) && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

/**
 * Resolve a file reference using multiple strategies.
 * @param {string} fromFile
 * @param {string} specifier
 * @param {string} projectRoot
 * @returns {string|null}
 */
function resolveReferencePath(fromFile, specifier, projectRoot) {
    return resolveImport(fromFile, specifier, projectRoot)
        || resolveWebAbsolutePath(fromFile, specifier, projectRoot)
        || resolveStaticSiteAbsolutePath(fromFile, specifier, projectRoot)
        || resolveImport(fromFile, `.${specifier.startsWith('/') ? '' : '/'}${specifier}`, projectRoot);
}

/**
 * Iterate all matches of a regex and invoke a callback.
 * @param {string} content
 * @param {RegExp} regex
 * @param {Function} onMatch
 */
function forEachMatch(content, regex, onMatch) {
    regex.lastIndex = 0;
    let match = regex.exec(content);
    while (match) {
        onMatch(match);
        match = regex.exec(content);
    }
}

/**
 * Extract HTML asset references (src, href, url()).
 * @param {string} content
 * @param {string} filePath
 * @param {string} projectRoot
 * @returns {Array<Object>}
 */
function parseHtmlReferences(content, filePath, projectRoot) {
    const refs = [];
    for (const { regex } of HTML_PATTERNS) {
        forEachMatch(content, regex, (match) => {
            const specifier = normalizeSpecifier(match[1]);
            if (!specifier || /^https?:|^data:|^#|^mailto:/i.test(specifier)) return;
            const resolvedPath = resolveReferencePath(filePath, specifier, projectRoot);
            if (resolvedPath) {
                refs.push({ kind: 'html-ref', specifier, source: filePath, resolvedPath });
            }
        });
    }
    return refs;
}

/**
 * Extract CSS asset references (url()).
 * @param {string} content
 * @param {string} filePath
 * @param {string} projectRoot
 * @returns {Array<Object>}
 */
function parseCssReferences(content, filePath, projectRoot) {
    const refs = [];
    forEachMatch(content, CSS_URL_PATTERN, (match) => {
        const specifier = normalizeSpecifier(match[1]);
        if (!specifier || /^https?:|^data:/i.test(specifier)) return;
        const resolvedPath = resolveImport(filePath, specifier, projectRoot);
        if (resolvedPath) {
            refs.push({ kind: 'css-ref', specifier, source: filePath, resolvedPath });
        }
    });
    return refs;
}

/**
 * Extract JSON string references that look like file paths.
 * @param {string} content
 * @param {string} filePath
 * @param {string} projectRoot
 * @returns {Array<Object>}
 */
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

/**
 * Recursively visit every string value in a JSON tree.
 * @param {any} node
 * @param {Function} onString
 */
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

/**
 * Parse file references from non-code files based on extension.
 * @param {string} filePath
 * @param {string} content
 * @param {string} projectRoot
 * @returns {Array<Object>}
 */
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

/**
 * Extract worker-script and spawn references from JS source.
 * @param {string} filePath
 * @param {string} content
 * @param {string} projectRoot
 * @returns {Array<Object>}
 */
function parseWorkerScriptReferences(filePath, content, projectRoot) {
    const refs = [];
    const fromDir = path.dirname(filePath);
    const rootNorm = normalizePathKey(projectRoot);

    for (const regex of WORKER_SINGLE_PATTERNS) {
        forEachMatch(content, regex, (match) => {
            const resolvedPath = path.resolve(fromDir, match[1]);
            if (normalizePathKey(resolvedPath).startsWith(rootNorm)) {
                refs.push({ kind: 'worker-ref', specifier: match[1], source: filePath, resolvedPath });
            }
        });
    }

    forEachMatch(content, WORKER_MULTI_PATTERN, (multiMatch) => {
        const segments = [...multiMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((part) => part[1]);
        if (!segments.length) return;
        const resolvedPath = path.resolve(fromDir, ...segments);
        if (normalizePathKey(resolvedPath).startsWith(rootNorm)) {
            refs.push({
                kind: 'path-join-ref',
                specifier: segments.join('/'),
                source: filePath,
                resolvedPath
            });
        }
    });

    forEachMatch(content, PACKAGE_REL_PATTERN, (packageMatch) => {
        const segments = [...packageMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((part) => part[1]);
        if (!segments.length) return;
        const resolvedPath = path.resolve(fromDir, ...segments);
        if (normalizePathKey(resolvedPath).startsWith(rootNorm)) {
            refs.push({
                kind: 'package-ref',
                specifier: segments.join('/'),
                source: filePath,
                resolvedPath
            });
        }
    });

    forEachMatch(content, SPAWN_PATTERN, (spawnMatch) => {
        const resolvedPath = path.resolve(fromDir, spawnMatch[1]);
        const candidates = [
            resolvedPath,
            path.resolve(projectRoot, spawnMatch[1]),
            path.resolve(projectRoot, 'packages/simplebeacon-cli', spawnMatch[1])
        ];
        for (const candidate of candidates) {
            if (normalizePathKey(candidate).startsWith(rootNorm) && fs.existsSync(candidate)) {
                refs.push({
                    kind: 'spawn-ref',
                    specifier: spawnMatch[1],
                    source: filePath,
                    resolvedPath: candidate
                });
                break;
            }
        }
    });

    return refs;
}

/**
 * Record a source-to-target reference in a Map.
 * @param {Map<string, Set<string>>} referenceMap
 * @param {string} targetPath
 * @param {string} sourcePath
 * @returns {Set<string>} The updated bucket.
 */
function addReference(referenceMap, targetPath, sourcePath) {
    const key = path.resolve(targetPath);
    const bucket = referenceMap.get(key) || new Set();
    bucket.add(path.resolve(sourcePath));
    referenceMap.set(key, bucket);
    return bucket;
}

module.exports = {
    parseNonCodeReferences,
    parseWorkerScriptReferences,
    addReference,
    forEachMatch,
    collectJsonPaths,
    parseHtmlReferences,
    parseCssReferences,
    parseJsonReferences
};
