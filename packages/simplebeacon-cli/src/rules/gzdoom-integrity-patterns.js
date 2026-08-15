/**
 * GZDoom mod integrity — cross-reference validation, runtime log correlation, ammo flow heuristics.
 */

const fs = require('fs');
const path = require('path');
const { parseGzdoomLog } = require('../lib/gzdoom-log-parser');
const {
    buildGzdoomSymbolGraph,
    validateGzdoomCrossReferences,
    correlateLogEntries
} = require('../lib/gzdoom-symbol-graph');

/**
 * @param {string} baseDir
 * @param {{ignoreGlobs?:string[],logPath?:string,severity?:string,sourcePaths?:string[]}} [options]
 * @returns {Promise<{scanned:number,findings:number,issues:Array<Object>,graphSummary:Object|null}>}
 */
async function scanGzdoomIntegrity(baseDir, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const severity = opts.severity || 'high';
    const ignoreGlobs = Array.isArray(opts.ignoreGlobs) ? opts.ignoreGlobs : [];

    const graph = await buildGzdoomSymbolGraph(baseDir, {
        ignoreGlobs,
        respectIncludes: opts.respectIncludes !== false,
        extraActors: opts.extraActors || []
    });
    const issues = validateGzdoomCrossReferences(graph, { severity });

    if (opts.logPath) {
        const logAbs = path.isAbsolute(opts.logPath)
            ? opts.logPath
            : path.join(baseDir, opts.logPath);
        if (fs.existsSync(logAbs)) {
            try {
                const logContent = fs.readFileSync(logAbs, 'utf8');
                const logEntries = parseGzdoomLog(logContent);
                const correlated = correlateLogEntries(logEntries, graph);
                issues.push(...correlated);
            } catch {
                /* unreadable log — skip */
            }
        }
    }

    const graphSummary = {
        actors: graph.actors.size,
        sprites: graph.sprites.size,
        modelRefs: graph.modelActorRefs.length + graph.modelSpriteRefs.length,
        replacesChains: graph.replacesChains.size,
        filesScanned: graph.filesScanned,
        orphanZScriptFiles: graph.orphanFiles.length,
        reachableFiles: graph.reachableFiles.size
    };

    return {
        scanned: graph.filesScanned,
        findings: issues.length,
        issues,
        graphSummary
    };
}

module.exports = {
    scanGzdoomIntegrity
};
