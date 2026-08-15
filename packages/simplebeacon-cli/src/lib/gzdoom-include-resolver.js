/**
 * Resolve ZScript #include chains from ZSCRIPT entry — only reachable files are compiled.
 */

const fs = require('fs');
const path = require('path');

const LUMP_ENTRIES = new Set([
    'zscript', 'decorate', 'modeldef', 'voxeldef', 'keyconf', 'mapinfo',
    'cvarinfo', 'texturedef', 'animdefs'
]);

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function extractIncludes(content) {
    const includes = [];
    const re = /#include\s+["']([^"']+)["']/g;
    let match;
    while ((match = re.exec(String(content || ''))) !== null) {
        includes.push(match[1]);
    }
    return includes;
}

/**
 * @param {string} baseDir
 * @param {string} fromAbsPath
 * @param {string} includeRef
 * @returns {string|null} relative path from baseDir
 */
function resolveIncludePath(baseDir, fromAbsPath, includeRef) {
    const ref = String(includeRef || '').replace(/\\/g, '/').trim();
    if (!ref) return null;

    const fromDir = path.dirname(fromAbsPath);
    const candidates = [
        path.join(fromDir, ref),
        path.join(fromDir, `${ref}.zs`),
        path.join(baseDir, ref),
        path.join(baseDir, `${ref}.zs`),
        path.join(baseDir, 'zscript', ref),
        path.join(baseDir, 'zscript', `${ref}.zs`),
        path.join(baseDir, ref.replace(/^zscript\//i, 'zscript/')),
        path.join(baseDir, ref.replace(/^zscript\//i, 'zscript/').replace(/\.zs$/i, '') + '.zs')
    ];

    for (const abs of candidates) {
        try {
            if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
                return normalizeRel(baseDir, abs);
            }
        } catch {
            /* skip */
        }
    }
    return null;
}

/**
 * @param {string} baseDir
 * @param {Array<{path:string,relativePath:string,name:string,kind:string}>} allFiles
 * @returns {{reachable:Set<string>,orphans:string[],entryPoints:string[]}}
 */
function resolveReachableGzdoomFiles(baseDir, allFiles) {
    const reachable = new Set();
    const orphans = [];
    const entryPoints = [];
    const sourceByRel = new Map();

    for (const file of allFiles) {
        if (file.kind !== 'source') continue;
        sourceByRel.set(file.relativePath, file);
        const lower = file.name.toLowerCase();
        if (LUMP_ENTRIES.has(lower)) {
            reachable.add(file.relativePath);
            entryPoints.push(file.relativePath);
        }
        if (lower.endsWith('.decorate') || lower.endsWith('.dec')) {
            reachable.add(file.relativePath);
            entryPoints.push(file.relativePath);
        }
    }

    const zscriptEntry = allFiles.find((f) => f.name.toLowerCase() === 'zscript');
    const queue = [];

    if (zscriptEntry) {
        if (!reachable.has(zscriptEntry.relativePath)) {
            reachable.add(zscriptEntry.relativePath);
            entryPoints.push(zscriptEntry.relativePath);
        }
        queue.push(zscriptEntry.relativePath);
    } else {
        // No ZSCRIPT lump — treat root-level .zs and zscript/**/*.zs as entry if no includes graph
        for (const file of allFiles) {
            if (file.kind !== 'source') continue;
            const lower = file.relativePath.toLowerCase();
            if (lower.endsWith('.zs') && (lower.startsWith('zscript/') || !lower.includes('/'))) {
                reachable.add(file.relativePath);
                queue.push(file.relativePath);
            }
        }
    }

    const visited = new Set();
    while (queue.length) {
        const rel = queue.shift();
        if (visited.has(rel)) continue;
        visited.add(rel);
        reachable.add(rel);

        const file = sourceByRel.get(rel);
        if (!file) continue;

        let content;
        try {
            content = fs.readFileSync(file.path, 'utf8');
        } catch {
            continue;
        }

        for (const inc of extractIncludes(content)) {
            const resolved = resolveIncludePath(baseDir, file.path, inc);
            if (resolved && !visited.has(resolved)) {
                queue.push(resolved);
            }
        }
    }

    for (const file of allFiles) {
        if (file.kind !== 'source') continue;
        const lower = file.name.toLowerCase();
        if (LUMP_ENTRIES.has(lower) || lower.endsWith('.decorate') || lower.endsWith('.dec')) continue;
        if (!file.relativePath.toLowerCase().endsWith('.zs') &&
            !file.relativePath.toLowerCase().endsWith('.zscript')) continue;
        if (!reachable.has(file.relativePath)) {
            orphans.push(file.relativePath);
        }
    }

    return { reachable, orphans, entryPoints };
}

module.exports = {
    LUMP_ENTRIES,
    extractIncludes,
    resolveIncludePath,
    resolveReachableGzdoomFiles
};
