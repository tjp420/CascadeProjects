/**
 * Shader include integrity — GLSL/HLSL/CGINC #include path validation.
 */

const fs = require('fs');
const path = require('path');
const { walkGameFiles, resolveAssetPath } = require('../lib/game-dev-walk');

const SHADER_EXTENSIONS = new Set(['.glsl', '.vert', '.frag', '.hlsl', '.fx', '.fxh', '.shader', '.cginc', '.wgsl']);
const INCLUDE_RE = /#\s*include\s+[<"]([^>"]+)[>"]/g;

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanGameShaderIntegrity(baseDir, options = {}) {
    const severity = options.severity || 'medium';
    const files = await walkGameFiles(baseDir, {
        extensions: SHADER_EXTENSIONS,
        sourcePaths: options.sourcePaths || ['.'],
        ignoreGlobs: options.ignoreGlobs || [],
        maxBytes: 256000
    });

    const issues = [];
    for (const file of files) {
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
                    id: `shader-include-${file.relativePath}-${includePath}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
                    severity,
                    type: 'shader-missing-include',
                    filePath: file.relativePath,
                    line: content.slice(0, match.index).split('\n').length,
                    description: `Missing shader include "${includePath}" referenced from ${file.relativePath}`,
                    recommendedAction: 'Add the include file or fix the #include path',
                    metadata: { patternId: 'GAME-SHADER-001', includePath }
                });
            }
        }
    }

    return {
        scanned: files.length,
        findings: issues.length,
        issues
    };
}

module.exports = {
    scanGameShaderIntegrity
};
