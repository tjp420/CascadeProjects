/**
 * PK3 / build_temp validation — required lumps and stale artifact detection.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');
const { resolveReachableGzdoomFiles } = require('./gzdoom-include-resolver');
const { collectGzdoomFiles } = require('./gzdoom-symbol-graph');

const DEFAULT_REQUIRED_LUMPS = ['ZSCRIPT', 'CVARINFO', 'MENUDEF', 'LOADACS'];
const STALE_SUFFIX_RE = /(?:_(?:DUPLICATE|OLD|backup)|\.(?:corrupt|clean|bak|old|tmp))(?:\.(?:zs|zscript))?$/i;
const _STALE_DIR_RE = /(?:^|\/)(?:build_temp|Backup|archive)(?:\/|$)/i;

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function findRequiredLump(root, lumpName) {
    const lower = lumpName.toLowerCase();
    const candidates = [
        path.join(root, lumpName),
        path.join(root, `${lumpName}.zs`),
        path.join(root, lumpName.toLowerCase())
    ];
    for (const direct of candidates) {
        if (fs.existsSync(direct)) return path.basename(direct);
    }
    try {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.toLowerCase() === lower) return entry.name;
        }
    } catch { /* ignore */ }
    return null;
}

function collectStalePackagingFiles(scanRoot, ignoreGlobs = [], max = 100) {
    const hits = [];
    function walk(dir, depth) {
        if (depth > 10 || hits.length >= max) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            const rel = normalizeRel(scanRoot, full);
            if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
            if (entry.isDirectory()) {
                if (/node_modules|\.git$/i.test(entry.name)) continue;
                walk(full, depth + 1);
                continue;
            }
            if (STALE_SUFFIX_RE.test(entry.name)) {
                hits.push(rel);
            }
        }
    }
    walk(path.resolve(scanRoot), 0);
    return hits;
}

/**
 * @param {string} modPath
 * @param {{ignoreGlobs?:string[],severity?:string,checkBuildTemp?:boolean}} [options]
 */
async function lintGzdoomPk3(modPath, options = {}) {
    const opts = options || {};
    const severity = opts.severity || 'high';
    const staleSeverity = opts.staleSeverity || 'medium';
    const ignoreGlobs = opts.ignoreGlobs || [];
    const root = path.resolve(modPath);
    const issues = [];
    const requiredLumps = Array.isArray(opts.requiredLumps) && opts.requiredLumps.length
        ? opts.requiredLumps
        : DEFAULT_REQUIRED_LUMPS;

    for (const lump of requiredLumps) {
        const found = findRequiredLump(root, lump);
        if (found) continue;
        issues.push({
            type: 'gzdoom-pk3-missing-lump',
            severity,
            filePath: lump,
            line: 0,
            count: 1,
            description: `Required PK3 lump "${lump}" not found in mod root`,
            recommendedAction: `Add ${lump} to the mod root before packaging`,
            affectedFiles: [],
            metadata: { engine: 'gzdoom-pk3-lint', lump }
        });
    }

    const buildTemp = path.join(root, 'build_temp');
    const scanRoots = [root];
    if (opts.checkBuildTemp !== false && fs.existsSync(buildTemp)) {
        scanRoots.push(buildTemp);
    }

    const staleHits = [];
    for (const scanRoot of scanRoots) {
        staleHits.push(...collectStalePackagingFiles(scanRoot, ignoreGlobs));
    }

    for (const rel of [...new Set(staleHits)].slice(0, 50)) {
        const inBuild = rel.startsWith('build_temp/') || rel.startsWith('build_temp\\');
        issues.push({
            type: 'gzdoom-pk3-stale-artifact',
            severity: staleSeverity,
            filePath: rel,
            line: 0,
            count: 1,
            description: `Stale/duplicate file "${rel}" should not be packaged in PK3${inBuild ? ' (found in build_temp)' : ''}`,
            recommendedAction: 'Delete or exclude *_DUPLICATE, *_OLD, .corrupt, .clean files from build_repack.bat',
            affectedFiles: [rel],
            metadata: { engine: 'gzdoom-pk3-lint', inBuildTemp: inBuild }
        });
    }

    const allFiles = await collectGzdoomFiles(root, { ignoreGlobs });
    const reachable = resolveReachableGzdoomFiles(root, allFiles).reachable;
    const reachableZs = [...reachable].filter((r) => r.toLowerCase().endsWith('.zs'));
    const missingFromRoot = reachableZs.filter((r) => !fs.existsSync(path.join(root, r.replace(/\//g, path.sep))));

    for (const rel of missingFromRoot.slice(0, 20)) {
        issues.push({
            type: 'gzdoom-pk3-missing-include-target',
            severity: 'high',
            filePath: rel,
            line: 0,
            count: 1,
            description: `Reachable include "${rel}" is referenced but missing from mod tree`,
            recommendedAction: 'Restore the file or remove it from the ZSCRIPT manifest chain',
            affectedFiles: [rel],
            metadata: { engine: 'gzdoom-pk3-lint' }
        });
    }

    return {
        requiredLumps: requiredLumps.length,
        staleArtifacts: staleHits.length,
        reachableIncludes: reachableZs.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    lintGzdoomPk3,
    findRequiredLump,
    collectStalePackagingFiles,
    DEFAULT_REQUIRED_LUMPS
};
