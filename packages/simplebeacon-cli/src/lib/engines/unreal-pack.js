/**
 * Unreal engine pack — .ini plugin refs and C++ #include graph (lightweight).
 */

const fs = require('fs');
const path = require('path');
const { walkGameFiles, resolveAssetPath } = require('../game-dev-walk');

const CPP_EXTENSIONS = new Set(['.cpp', '.h', '.hpp', '.cc', '.cxx']);
const INCLUDE_RE = /#\s*include\s+"([^"]+)"/g;
const PLUGIN_RE = /^\s*\+?\s*([A-Za-z0-9_]+)\s*=\s*Enabled/i;

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanUnrealPack(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const sourcePaths = options.sourcePaths || ['Source', 'Config'];
    const issues = [];

    const iniFiles = await walkGameFiles(baseDir, {
        extensions: new Set(['.ini']),
        sourcePaths: ['Config'],
        ignoreGlobs: options.ignoreGlobs || ['Intermediate/**', 'Saved/**', 'Binaries/**']
    });

    for (const file of iniFiles) {
        if (!/plugins/i.test(file.relativePath)) continue;
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        for (const line of content.split('\n')) {
            const match = PLUGIN_RE.exec(line);
            if (!match) continue;
            const pluginName = match[1];
            const pluginDir = path.join(baseDir, 'Plugins', pluginName);
            if (!fs.existsSync(pluginDir)) {
                issues.push({
                    id: `unreal-missing-plugin-${pluginName}`,
                    severity,
                    type: 'unreal-missing-plugin',
                    filePath: file.relativePath,
                    line: 1,
                    description: `Enabled Unreal plugin "${pluginName}" not found under Plugins/`,
                    recommendedAction: 'Install the plugin or disable it in DefaultEngine.ini',
                    metadata: { patternId: 'UNREAL-001', pluginName, engine: 'unreal' }
                });
            }
        }
    }

    const cppFiles = await walkGameFiles(baseDir, {
        extensions: CPP_EXTENSIONS,
        sourcePaths,
        ignoreGlobs: options.ignoreGlobs || ['Intermediate/**', 'Binaries/**']
    });

    for (const file of cppFiles) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        INCLUDE_RE.lastIndex = 0;
        let match;
        while ((match = INCLUDE_RE.exec(content)) !== null) {
            const includePath = match[1];
            if (!resolveAssetPath(baseDir, file.path, includePath)) {
                issues.push({
                    id: `unreal-missing-include-${file.relativePath}-${includePath}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
                    severity,
                    type: 'unreal-missing-include',
                    filePath: file.relativePath,
                    line: content.slice(0, match.index).split('\n').length,
                    description: `Missing Unreal C++ include "${includePath}" in ${file.relativePath}`,
                    recommendedAction: 'Fix the #include path or add the header to the module',
                    metadata: { patternId: 'UNREAL-002', includePath, engine: 'unreal' }
                });
            }
        }
    }

    return {
        engine: 'unreal',
        scanned: iniFiles.length + cppFiles.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    scanUnrealPack
};
