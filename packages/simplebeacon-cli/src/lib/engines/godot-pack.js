/**
 * Godot engine pack — .tscn / .tres ext_resource and node path validation.
 */

const fs = require('fs');
const path = require('path');
const { walkGameFiles, resolveAssetPath } = require('../game-dev-walk');

const GODOT_EXTENSIONS = new Set(['.tscn', '.tres']);
const EXT_RESOURCE_RE = /\[ext_resource[^\]]*path="([^"]+)"/g;
const NODE_PATH_RE = /node_path="([^"]+)"/g;

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanGodotPack(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const sourcePaths = options.sourcePaths || ['.'];
    const files = await walkGameFiles(baseDir, {
        extensions: GODOT_EXTENSIONS,
        sourcePaths,
        ignoreGlobs: options.ignoreGlobs || ['.godot/**', '.import/**']
    });

    const issues = [];
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }

        for (const re of [EXT_RESOURCE_RE, NODE_PATH_RE]) {
            re.lastIndex = 0;
            let match;
            while ((match = re.exec(content)) !== null) {
                const ref = match[1];
                if (ref.startsWith('uid://')) continue;
                const normalized = ref.replace(/^res:\/\//, '');
                if (!resolveAssetPath(baseDir, file.path, normalized)) {
                    issues.push({
                        id: `godot-missing-resource-${file.relativePath}-${ref}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
                        severity,
                        type: 'godot-missing-resource',
                        filePath: file.relativePath,
                        line: content.slice(0, match.index).split('\n').length,
                        description: `Missing Godot resource "${ref}" in ${file.relativePath}`,
                        recommendedAction: 'Fix the ext_resource path or restore the missing scene/script',
                        metadata: { patternId: 'GODOT-001', refPath: ref, engine: 'godot' }
                    });
                }
            }
        }
    }

    return {
        engine: 'godot',
        scanned: files.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    scanGodotPack
};
