/**
 * Game asset integrity — scan JSON/YAML/TOML for broken path references.
 */

const fs = require('fs');
const path = require('path');
const {
    walkGameFiles,
    CONFIG_EXTENSIONS,
    looksLikeAssetPath,
    resolveAssetPath
} = require('../lib/game-dev-walk');

const YAML_KEY_RE = /^\s*([A-Za-z0-9_.-]+)\s*:\s*(.+)$/;
const TOML_STRING_RE = /^\s*[A-Za-z0-9_.-]+\s*=\s*["']([^"']+)["']/;

function collectStringsFromJson(value, out) {
    if (typeof value === 'string') {
        if (looksLikeAssetPath(value)) out.push(value);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStringsFromJson(item, out);
        return;
    }
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            if (/(path|file|asset|resource|texture|model|audio|shader|script|prefab|scene)/i.test(key)) {
                collectStringsFromJson(value[key], out);
            } else {
                collectStringsFromJson(value[key], out);
            }
        }
    }
}

function collectStringsFromYaml(content) {
    const refs = [];
    for (const line of content.split('\n')) {
        const match = YAML_KEY_RE.exec(line);
        if (!match) continue;
        const raw = match[2].replace(/^["']|["']$/g, '').trim();
        if (looksLikeAssetPath(raw)) refs.push(raw);
    }
    return refs;
}

function collectStringsFromToml(content) {
    const refs = [];
    for (const line of content.split('\n')) {
        const match = TOML_STRING_RE.exec(line);
        if (!match) continue;
        if (looksLikeAssetPath(match[1])) refs.push(match[1]);
    }
    return refs;
}

function collectStringsFromIni(content) {
    const refs = [];
    for (const line of content.split('\n')) {
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const raw = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (looksLikeAssetPath(raw)) refs.push(raw);
    }
    return refs;
}

function extractAssetRefs(content, ext) {
    if (ext === '.json') {
        try {
            const refs = [];
            collectStringsFromJson(JSON.parse(content), refs);
            return [...new Set(refs)];
        } catch {
            return [];
        }
    }
    if (ext === '.yaml' || ext === '.yml') return collectStringsFromYaml(content);
    if (ext === '.toml') return collectStringsFromToml(content);
    if (ext === '.ini' || ext === '.cfg') return collectStringsFromIni(content);
    return [];
}

/**
 * @param {string} baseDir
 * @param {{sourcePaths?:string[],ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanGameAssetIntegrity(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const files = await walkGameFiles(baseDir, {
        extensions: CONFIG_EXTENSIONS,
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
        const refs = extractAssetRefs(content, file.ext);
        for (const ref of refs) {
            if (!resolveAssetPath(baseDir, file.path, ref)) {
                issues.push({
                    id: `game-asset-missing-${file.relativePath}-${ref}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
                    severity,
                    type: 'game-missing-asset',
                    filePath: file.relativePath,
                    line: 1,
                    description: `Missing asset reference "${ref}" in ${file.relativePath}`,
                    recommendedAction: 'Fix the path or add the missing asset file',
                    metadata: {
                        patternId: 'GAME-ASSET-001',
                        engine: 'generic',
                        refPath: ref
                    }
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
    scanGameAssetIntegrity,
    extractAssetRefs
};
