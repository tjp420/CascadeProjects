/**
 * Shared file walk helpers for game-dev scanners.
 */

const fs = require('fs');
const path = require('path');
const { globMatch } = require('../rules/production-leak');

const GAME_SKIP_DIRS = new Set([
    'node_modules', '.git', 'Library', 'Temp', 'obj', 'bin', 'Build', 'Builds',
    'DerivedDataCache', 'Intermediate', 'Saved', 'Binaries', '.godot', '.import',
    'Packages', 'Logs', '.simplebeacon', 'coverage', 'dist'
]);

const ASSET_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tga', '.dds', '.svg',
    '.wav', '.ogg', '.mp3', '.flac', '.aac',
    '.fbx', '.obj', '.gltf', '.glb', '.blend', '.dae',
    '.ttf', '.otf', '.woff', '.woff2',
    '.mat', '.material', '.prefab', '.unity', '.tscn', '.tres', '.uasset', '.umap',
    '.wad', '.pk3', '.pak', '.zip',
    '.glsl', '.vert', '.frag', '.hlsl', '.fx', '.fxh', '.shader', '.cginc', '.wgsl',
    '.lua', '.cs', '.gd', '.zs', '.cpp', '.h'
]);

const CONFIG_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg']);

function normalizeRel(baseDir, filePath) {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function isIgnored(relativePath, ignoreGlobs) {
    return (ignoreGlobs || []).some((pattern) => globMatch(relativePath, pattern));
}

async function walkGameFiles(baseDir, options = {}) {
    const extensions = options.extensions || null;
    const ignoreGlobs = options.ignoreGlobs || [];
    const sourcePaths = options.sourcePaths || ['.'];
    const maxBytes = options.maxBytes || 512000;
    const files = [];

    async function walk(absDir) {
        let entries;
        try {
            entries = await fs.promises.readdir(absDir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const abs = path.join(absDir, entry.name);
            const rel = normalizeRel(baseDir, abs);
            if (entry.isDirectory()) {
                if (GAME_SKIP_DIRS.has(entry.name)) continue;
                if (isIgnored(rel, ignoreGlobs)) continue;
                await walk(abs);
                continue;
            }
            if (!entry.isFile()) continue;
            if (isIgnored(rel, ignoreGlobs)) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions && !extensions.has(ext)) continue;
            let size = 0;
            try {
                size = (await fs.promises.stat(abs)).size;
            } catch {
                continue;
            }
            if (size > maxBytes) continue;
            files.push({ path: abs, relativePath: rel, ext, size });
        }
    }

    for (const rel of sourcePaths) {
        const abs = path.isAbsolute(rel) ? rel : path.join(baseDir, ...String(rel).split('/'));
        if (fs.existsSync(abs)) {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) await walk(abs);
            else if (stat.isFile()) {
                const ext = path.extname(abs).toLowerCase();
                if (!extensions || extensions.has(ext)) {
                    files.push({
                        path: abs,
                        relativePath: normalizeRel(baseDir, abs),
                        ext,
                        size: stat.size
                    });
                }
            }
        }
    }
    return files;
}

function looksLikeAssetPath(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 512) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;
    if (/^(res|uid|guid|uuid):/i.test(trimmed)) return false;
    if (/^[A-Fa-f0-9]{32}$/.test(trimmed)) return false;
    const ext = path.extname(trimmed.split('?')[0].split('#')[0]).toLowerCase();
    if (ext && ASSET_EXTENSIONS.has(ext)) return true;
    if (/^(assets|content|resources|textures|models|audio|sounds|materials|scenes|prefabs|scripts|shaders)\//i.test(trimmed)) {
        return true;
    }
    if (/\.(png|jpg|wav|ogg|fbx|gltf|prefab|tscn|glsl|shader|lua|cs|gd|zs)$/i.test(trimmed)) return true;
    return false;
}

function resolveAssetPath(baseDir, fromFile, refPath) {
    const cleaned = String(refPath || '').trim().replace(/\\/g, '/');
    if (!cleaned) return null;
    const fromDir = path.dirname(fromFile);
    const candidates = [
        path.resolve(fromDir, cleaned),
        path.resolve(baseDir, cleaned),
        path.resolve(baseDir, 'Assets', cleaned),
        path.resolve(baseDir, 'Content', cleaned),
        path.resolve(baseDir, 'resources', cleaned)
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

module.exports = {
    GAME_SKIP_DIRS,
    ASSET_EXTENSIONS,
    CONFIG_EXTENSIONS,
    walkGameFiles,
    looksLikeAssetPath,
    resolveAssetPath,
    normalizeRel,
    isIgnored
};
