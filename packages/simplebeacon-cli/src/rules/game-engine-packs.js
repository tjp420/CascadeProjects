/**
 * Game engine packs orchestrator — Unity, Godot, Unreal, GZDoom (via dedicated rule).
 */

const { resolveGameEngine, shouldRunEnginePack, detectGameEngine } = require('../lib/game-engine-registry');
const { scanUnityPack } = require('../lib/engines/unity-pack');
const { scanGodotPack } = require('../lib/engines/godot-pack');
const { scanUnrealPack } = require('../lib/engines/unreal-pack');

const PACKS = Object.freeze({
    unity: scanUnityPack,
    godot: scanGodotPack,
    unreal: scanUnrealPack
});

/**
 * @param {string} baseDir
 * @param {{engine?:string,sourcePaths?:string[],ignoreGlobs?:string[],severity?:string,config?:Object}} [options]
 */
async function scanGameEnginePacks(baseDir, options = {}) {
    const config = options.config || { gameDev: { engine: options.engine } };
    const requested = resolveGameEngine(baseDir, config);
    const detected = detectGameEngine(baseDir);
    const engine = requested === 'auto' ? (detected || 'generic') : requested;
    const severity = options.severity || 'high';
    const sharedOpts = {
        sourcePaths: options.sourcePaths || ['.'],
        ignoreGlobs: options.ignoreGlobs || [],
        severity
    };

    const issues = [];
    let scanned = 0;
    const packsRun = [];

    for (const [packEngine, scanFn] of Object.entries(PACKS)) {
        if (!shouldRunEnginePack(engine, packEngine)) continue;
        if (engine === 'auto' && detected && detected !== packEngine) continue;
        const result = await scanFn(baseDir, sharedOpts);
        scanned += result.scanned || 0;
        packsRun.push(packEngine);
        if (Array.isArray(result.issues)) issues.push(...result.issues);
    }

    return {
        scanned,
        findings: issues.length,
        issues,
        engine,
        detected,
        packsRun
    };
}

module.exports = {
    scanGameEnginePacks
};
