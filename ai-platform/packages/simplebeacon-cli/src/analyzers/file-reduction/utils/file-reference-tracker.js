/**
 * Track non-JS file references (HTML, CSS, JSON).
 */

const fs = require('fs');
const path = require('path');
const { normalizeSpecifier, resolveImport } = require('./import-parser');

function resolveWebRootRel(relFrom) {
    if (relFrom.startsWith('web/') || relFrom === 'web') {
        return 'web';
    }
    if (relFrom.includes('/web/')) {
        return `${relFrom.split('/web/')[0]}/web`;
    }
    return null;
}

function resolveWebAbsolutePath(fromFile, specifier, projectRoot) {
    if (!specifier.startsWith('/')) {
        return null;
    }
    const relFrom = path.relative(projectRoot, fromFile).split(path.sep).join('/');
    const webRootRel = resolveWebRootRel(relFrom);
    if (!webRootRel) {
        return null;
    }
    const candidate = path.resolve(projectRoot, webRootRel, specifier.slice(1));
    if (candidate.startsWith(path.resolve(projectRoot)) && fs.existsSync(candidate)) {
        return candidate;
    }
    return null;
}

function resolveStaticSiteAbsolutePath(fromFile, specifier, projectRoot) {
    if (!specifier.startsWith('/')) {
        return null;
    }
    const relFrom = path.relative(projectRoot, fromFile).split(path.sep).join('/');
    const siteRoots = ['coming-soon', 'deployments'];
    for (const rootName of siteRoots) {
        const marker = `${rootName}/`;
        const idx = relFrom.indexOf(marker);
        if (idx === -1) continue;
        const siteRel = relFrom.slice(0, idx + rootName.length);
        const candidate = path.resolve(projectRoot, siteRel, specifier.slice(1));
        if (candidate.startsWith(path.resolve(projectRoot)) && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function resolveReferencePath(fromFile, specifier, projectRoot) {
    return resolveImport(fromFile, specifier, projectRoot)
        || resolveWebAbsolutePath(fromFile, specifier, projectRoot)
        || resolveStaticSiteAbsolutePath(fromFile, specifier, projectRoot)
        || resolveImport(fromFile, `.${specifier.startsWith('/') ? '' : '/'}${specifier}`, projectRoot);
}

function parseHtmlReferences(content, filePath, projectRoot) {
    const refs = [];
    const patterns = [
        /(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi,
        /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi
    ];
    for (const regex of patterns) {
        let match = regex.exec(content);
        while (match) {
            const specifier = normalizeSpecifier(match[1]);
            if (!specifier || /^https?:|^data:|^#|^mailto:/i.test(specifier)) {
                match = regex.exec(content);
                continue;
            }
            const resolvedPath = resolveReferencePath(filePath, specifier, projectRoot);
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
        const specifier = normalizeSpecifier(match[1]);
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

function parseWorkerScriptReferences(filePath, content, projectRoot) {
    const refs = [];
    const fromDir = path.dirname(filePath);
    const projectRootResolved = path.resolve(projectRoot);

    const singleSegmentPatterns = [
        /path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g,
        /WORKER_SCRIPT\s*=\s*path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/g
    ];
    for (const regex of singleSegmentPatterns) {
        regex.lastIndex = 0;
        let match = regex.exec(content);
        while (match) {
            const resolvedPath = path.resolve(fromDir, match[1]);
            if (resolvedPath.startsWith(projectRootResolved)) {
                refs.push({ kind: 'worker-ref', specifier: match[1], source: filePath, resolvedPath });
            }
            match = regex.exec(content);
        }
    }

    const multiSegmentPattern = /path\.join\s*\(\s*__dirname\s*((?:\s*,\s*['"][^'"]+['"])+)\s*\)/g;
    multiSegmentPattern.lastIndex = 0;
    let multiMatch = multiSegmentPattern.exec(content);
    while (multiMatch) {
        const segments = [...multiMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((part) => part[1]);
        if (segments.length) {
            const resolvedPath = path.resolve(fromDir, ...segments);
            if (resolvedPath.startsWith(projectRootResolved)) {
                refs.push({
                    kind: 'path-join-ref',
                    specifier: segments.join('/'),
                    source: filePath,
                    resolvedPath
                });
            }
        }
        multiMatch = multiSegmentPattern.exec(content);
    }

    const packageRelativePattern = /path\.join\s*\(\s*[^,)]+,\s*((?:['"][^'"]+['"]\s*,?\s*)+)\)/g;
    packageRelativePattern.lastIndex = 0;
    let packageMatch = packageRelativePattern.exec(content);
    while (packageMatch) {
        const segments = [...packageMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((part) => part[1]);
        if (!segments.length) {
            packageMatch = packageRelativePattern.exec(content);
            continue;
        }
        const resolvedPath = path.resolve(fromDir, ...segments);
        if (resolvedPath.startsWith(projectRootResolved)) {
            refs.push({
                kind: 'package-ref',
                specifier: segments.join('/'),
                source: filePath,
                resolvedPath
            });
        }
        packageMatch = packageRelativePattern.exec(content);
    }

    const spawnPattern = /(?:spawn|spawnSync|execFile(?:Sync)?)\s*\(\s*['"]([^'"]+\.py)['"]/g;
    spawnPattern.lastIndex = 0;
    let spawnMatch = spawnPattern.exec(content);
    while (spawnMatch) {
        const resolvedPath = path.resolve(fromDir, spawnMatch[1]);
        const candidates = [
            resolvedPath,
            path.resolve(projectRootResolved, spawnMatch[1]),
            path.resolve(projectRootResolved, 'packages/simplebeacon-cli', spawnMatch[1])
        ];
        for (const candidate of candidates) {
            if (candidate.startsWith(projectRootResolved) && fs.existsSync(candidate)) {
                refs.push({
                    kind: 'spawn-ref',
                    specifier: spawnMatch[1],
                    source: filePath,
                    resolvedPath: candidate
                });
                break;
            }
        }
        spawnMatch = spawnPattern.exec(content);
    }

    return refs;
}

function addReference(referenceMap, targetPath, sourcePath) {
    const key = path.resolve(targetPath);
    const bucket = referenceMap.get(key) || new Set();
    bucket.add(path.resolve(sourcePath));
    referenceMap.set(key, bucket);
}

module.exports = {
    parseNonCodeReferences,
    parseWorkerScriptReferences,
    addReference,
    parseHtmlReferences,
    parseCssReferences,
    parseJsonReferences
};
