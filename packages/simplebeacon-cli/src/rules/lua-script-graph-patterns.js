/**
 * Lua script graph — require/path and suspicious global heuristics.
 */

const fs = require('fs');
const path = require('path');
const { walkGameFiles, resolveAssetPath } = require('../lib/game-dev-walk');

const REQUIRE_RE = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
const DOFILE_RE = /\b(?:dofile|loadfile)\s*\(\s*["']([^"']+)["']\s*\)/g;
const GLOBAL_ASSIGN_RE = /^\s*([A-Z][A-Z0-9_]{2,})\s*=/gm;
const SUSPICIOUS_GLOBALS = new Set(['TODO', 'FIXME', 'NIL', 'NULL']);

function resolveLuaModule(baseDir, fromFile, moduleName) {
    const cleaned = String(moduleName || '').replace(/\\/g, '/');
    const candidates = [
        `${cleaned}.lua`,
        `${cleaned}/init.lua`,
        cleaned
    ];
    for (const candidate of candidates) {
        const resolved = resolveAssetPath(baseDir, fromFile, candidate);
        if (resolved) return resolved;
    }
    return null;
}

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanLuaScriptGraph(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const files = await walkGameFiles(baseDir, {
        extensions: new Set(['.lua']),
        sourcePaths: options.sourcePaths || ['.'],
        ignoreGlobs: options.ignoreGlobs || []
    });

    const issues = [];
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        for (const re of [REQUIRE_RE, DOFILE_RE]) {
            re.lastIndex = 0;
            let match;
            while ((match = re.exec(content)) !== null) {
                const moduleName = match[1];
                if (!resolveLuaModule(baseDir, file.path, moduleName)) {
                    issues.push({
                        id: `lua-unresolved-${file.relativePath}-${moduleName}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
                        severity,
                        type: 'lua-unresolved-require',
                        filePath: file.relativePath,
                        line: content.slice(0, match.index).split('\n').length,
                        description: `Unresolved Lua require "${moduleName}" in ${file.relativePath}`,
                        recommendedAction: 'Add the module file or fix the require path',
                        metadata: { patternId: 'LUA-GRAPH-001', moduleName }
                    });
                }
            }
        }

        GLOBAL_ASSIGN_RE.lastIndex = 0;
        let globalMatch;
        while ((globalMatch = GLOBAL_ASSIGN_RE.exec(content)) !== null) {
            const name = globalMatch[1];
            if (SUSPICIOUS_GLOBALS.has(name)) continue;
            if (/^(ENV|API|VERSION|DEBUG|MAX_|MIN_)/.test(name)) continue;
        }
    }

    return {
        scanned: files.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    scanLuaScriptGraph
};
