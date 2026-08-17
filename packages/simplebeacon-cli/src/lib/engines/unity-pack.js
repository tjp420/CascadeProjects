/**
 * Unity engine pack — .meta GUID presence and YAML scene/prefab script refs.
 */

const fs = require('fs');
const path = require('path');
const { walkGameFiles, resolveAssetPath } = require('../game-dev-walk');

const UNITY_ASSET_EXTENSIONS = new Set(['.unity', '.prefab', '.asset', '.mat', '.controller', '.anim']);
const SCRIPT_REF_RE = /m_Script:\s*\{[^}]*guid:\s*([a-f0-9]{32})/gi;
const META_GUID_RE = /^guid:\s*([a-f0-9]{32})/m;

async function buildGuidIndex(baseDir, sourcePaths) {
    const index = new Map();
    const metaFiles = await walkGameFiles(baseDir, {
        extensions: new Set(['.meta']),
        sourcePaths,
        ignoreGlobs: ['Library/**', 'Temp/**']
    });
    for (const file of metaFiles) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        const match = META_GUID_RE.exec(content);
        if (match) index.set(match[1].toLowerCase(), file.relativePath.replace(/\.meta$/, ''));
    }
    return index;
}

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanUnityPack(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const sourcePaths = options.sourcePaths || ['Assets'];
    const guidIndex = await buildGuidIndex(baseDir, sourcePaths);
    const files = await walkGameFiles(baseDir, {
        extensions: UNITY_ASSET_EXTENSIONS,
        sourcePaths,
        ignoreGlobs: options.ignoreGlobs || ['Library/**', 'Temp/**']
    });

    const issues = [];
    for (const file of files) {
        let content;
        try {
            content = await fs.promises.readFile(file.path, 'utf8');
        } catch {
            continue;
        }
        SCRIPT_REF_RE.lastIndex = 0;
        let match;
        while ((match = SCRIPT_REF_RE.exec(content)) !== null) {
            const guid = match[1].toLowerCase();
            if (!guidIndex.has(guid)) {
                issues.push({
                    id: `unity-missing-script-guid-${file.relativePath}-${guid}`,
                    severity,
                    type: 'unity-missing-script',
                    filePath: file.relativePath,
                    line: content.slice(0, match.index).split('\n').length,
                    description: `Missing Unity script GUID ${guid} referenced in ${file.relativePath}`,
                    recommendedAction: 'Restore the .meta file or reassign the script reference in the Inspector',
                    metadata: { patternId: 'UNITY-001', guid, engine: 'unity' }
                });
            }
        }
    }

    return {
        engine: 'unity',
        scanned: files.length,
        findings: issues.length,
        issues,
        guidCount: guidIndex.size
    };
}

module.exports = {
    scanUnityPack
};
