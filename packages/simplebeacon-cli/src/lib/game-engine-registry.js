/**
 * Game engine detection and pack routing — auto | gzdoom | unity | godot | unreal | generic.
 */

const fs = require('fs');
const path = require('path');

const VALID_ENGINES = Object.freeze(['auto', 'gzdoom', 'unity', 'godot', 'unreal', 'generic']);

const ENGINE_MARKERS = Object.freeze({
    gzdoom: [
        'zscript',
        'MAPINFO',
        'ZSCRIPT',
        'mapinfo'
    ],
    unity: [
        'ProjectSettings/ProjectVersion.txt',
        'Assets',
        'Packages/manifest.json'
    ],
    godot: [
        'project.godot'
    ],
    unreal: [
        'Source',
        '.uproject'
    ]
});

function existsRel(baseDir, rel) {
    try {
        return fs.existsSync(path.join(baseDir, ...rel.split('/')));
    } catch {
        return false;
    }
}

function hasUproject(baseDir) {
    try {
        return fs.readdirSync(baseDir).some((name) => name.endsWith('.uproject'));
    } catch {
        return false;
    }
}

/**
 * Detect primary game engine from project markers.
 * @param {string} baseDir
 * @returns {'gzdoom'|'unity'|'godot'|'unreal'|'generic'|null}
 */
function detectGameEngine(baseDir) {
    const root = path.resolve(baseDir);
    if (existsRel(root, 'project.godot')) return 'godot';
    if (hasUproject(root)) return 'unreal';
    if (existsRel(root, 'ProjectSettings/ProjectVersion.txt')) return 'unity';
    if (existsRel(root, 'zscript') || existsRel(root, 'ZSCRIPT') || existsRel(root, 'MAPINFO')) return 'gzdoom';
    return null;
}

/**
 * Resolve configured engine (auto picks detected engine or generic).
 * @param {string} baseDir
 * @param {Object} [config]
 * @returns {string}
 */
function resolveGameEngine(baseDir, config = {}) {
    const requested = String(
        config?.gameDev?.engine
        || config?.engine
        || 'auto'
    ).toLowerCase();
    if (requested !== 'auto' && VALID_ENGINES.includes(requested)) {
        return requested;
    }
    return detectGameEngine(baseDir) || 'generic';
}

/**
 * Whether an engine-specific pack should run for the resolved engine.
 * @param {string} resolvedEngine
 * @param {string} packEngine
 * @returns {boolean}
 */
function shouldRunEnginePack(resolvedEngine, packEngine) {
    if (resolvedEngine === 'generic') {
        return packEngine === 'generic';
    }
    if (resolvedEngine === 'auto') {
        return true;
    }
    return resolvedEngine === packEngine;
}

module.exports = {
    VALID_ENGINES,
    ENGINE_MARKERS,
    detectGameEngine,
    resolveGameEngine,
    shouldRunEnginePack
};
