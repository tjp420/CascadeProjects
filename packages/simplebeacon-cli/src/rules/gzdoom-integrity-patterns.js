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
const { lintGzdoomDeathFrameReuse } = require('../lib/gzdoom-state-lint');
const { lintGzdoomCvars } = require('../lib/gzdoom-cvar-lint');
const { runGzdoomNorunGate } = require('../lib/gzdoom-norun-gate');

function readConfigGzdoom(modPath) {
    const cfgPath = path.join(modPath, '.simplebeacon', 'config.json');
    if (!fs.existsSync(cfgPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf8')).gzdoom || {};
    } catch {
        return {};
    }
}

/**
 * @param {string} baseDir
 * @param {{ignoreGlobs?:string[],logPath?:string,severity?:string,sourcePaths?:string[],norunGate?:boolean,gzdoomExe?:string,iwad?:string,norunTimeoutMs?:number,timeoutMs?:number,norunDryRun?:boolean,companionMod?:string,companionModPaths?:string[],cvarPrefix?:string,cvarAllowlist?:string[],cvarAllowlistPrefixes?:string[],extendedLint?:boolean,skipLints?:string[],requiredLumps?:string[],deadCvarSeverity?:string,extraActors?:string[],respectIncludes?:boolean}} [options]
 * @returns {Promise<{scanned:number,findings:number,issues:Array<Object>,graphSummary:Object|null}>}
 */
async function scanGzdoomIntegrity(baseDir, options = {}) {
    const gzdoomCfg = readConfigGzdoom(baseDir);
    const opts = { ...gzdoomCfg, ...(options && typeof options === 'object' ? options : {}) };
    const severity = opts.severity || 'high';
    const ignoreGlobs = Array.isArray(opts.ignoreGlobs) ? opts.ignoreGlobs : [];
    const lintOpts = {
        ignoreGlobs,
        respectIncludes: opts.respectIncludes !== false,
        severity,
        companionMod: opts.companionMod,
        companionModPaths: opts.companionModPaths,
        cvarPrefix: opts.cvarPrefix,
        cvarAllowlist: opts.cvarAllowlist,
        cvarAllowlistPrefixes: opts.cvarAllowlistPrefixes,
        deadCvarSeverity: opts.deadCvarSeverity
    };

    const graph = await buildGzdoomSymbolGraph(baseDir, {
        ignoreGlobs,
        respectIncludes: opts.respectIncludes !== false,
        extraActors: opts.extraActors || []
    });
    const issues = validateGzdoomCrossReferences(graph, { severity });

    const stateLint = await lintGzdoomDeathFrameReuse(baseDir, lintOpts);
    issues.push(...stateLint.issues);

    const cvarLint = await lintGzdoomCvars(baseDir, lintOpts);
    issues.push(...cvarLint.issues);

    const extendedLint = opts.extendedLint === true;
    let zscriptLint = { scanned: 0, findings: 0, issues: [] };
    let eventLint = { registrations: 0, findings: 0, issues: [] };
    let gldefsLint = { findings: 0, issues: [] };
    let manifestLint = { missingIncludes: 0, disabledUntracked: 0, findings: 0, issues: [] };
    let handlerMapLint = { findings: 0, issues: [] };
    let pk3Lint = { staleArtifacts: 0, findings: 0, issues: [] };

    if (extendedLint) {
        const skip = new Set(Array.isArray(opts.skipLints) ? opts.skipLints : []);
        const { lintGzdoomZscript } = require('../lib/gzdoom-zscript-lint');
        const { lintGzdoomEventHandlers } = require('../lib/gzdoom-eventhandler-lint');
        const { lintGzdoomGldefs } = require('../lib/gzdoom-gldefs-lint');
        const { lintGzdoomManifest } = require('../lib/gzdoom-manifest-lint');
        const { lintGzdoomHandlerMap } = require('../lib/gzdoom-handler-map-lint');
        const { lintGzdoomPk3 } = require('../lib/gzdoom-pk3-lint');

        if (!skip.has('zscript')) {
            zscriptLint = await lintGzdoomZscript(baseDir, lintOpts);
            issues.push(...zscriptLint.issues);
        }

        eventLint = await lintGzdoomEventHandlers(baseDir, lintOpts);
        issues.push(...eventLint.issues);

        gldefsLint = await lintGzdoomGldefs(baseDir, lintOpts);
        issues.push(...gldefsLint.issues);

        manifestLint = await lintGzdoomManifest(baseDir, lintOpts);
        issues.push(...manifestLint.issues);

        handlerMapLint = await lintGzdoomHandlerMap(baseDir, lintOpts);
        issues.push(...handlerMapLint.issues);

        pk3Lint = await lintGzdoomPk3(baseDir, {
            ...lintOpts,
            requiredLumps: opts.requiredLumps
        });
        issues.push(...pk3Lint.issues);
    }

    let norunGate = null;
    if (opts.norunGate === true) {
        norunGate = runGzdoomNorunGate(baseDir, {
            gzdoomExe: opts.gzdoomExe,
            iwad: opts.iwad,
            timeoutMs: opts.norunTimeoutMs || opts.timeoutMs,
            dryRun: opts.norunDryRun || false,
            companionMod: opts.companionMod,
            companionModPaths: opts.companionModPaths
        });
        if (norunGate.gatePass === false) {
            for (const err of norunGate.errors) {
                issues.push({
                    type: `gzdoom-norun-${err.type}`,
                    severity: 'high',
                    filePath: err.file,
                    line: err.line,
                    count: 1,
                    description: err.message,
                    recommendedAction: 'Fix the ZScript error and re-run the gate',
                    metadata: {
                        patternId: 'GZ-NORUN',
                        engine: 'gzdoom',
                        gateExitCode: norunGate.exitCode
                    }
                });
            }
        }
    }

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
        reachableFiles: graph.reachableFiles.size,
        stateLintScanned: stateLint.scanned,
        deathFrameReuseFindings: stateLint.findings,
        cvarDefinitions: cvarLint.definitions,
        cvarReferences: cvarLint.references,
        cvarFindings: cvarLint.findings,
        zscriptLintScanned: zscriptLint.scanned,
        zscriptFindings: zscriptLint.findings,
        eventHandlerRegistrations: eventLint.registrations,
        eventHandlerFindings: eventLint.findings,
        gldefsFindings: gldefsLint.findings,
        manifestMissingIncludes: manifestLint.missingIncludes,
        manifestDisabledUntracked: manifestLint.disabledUntracked,
        handlerMapFindings: handlerMapLint.findings,
        pk3StaleArtifacts: pk3Lint.staleArtifacts,
        pk3Findings: pk3Lint.findings,
        norunGate: norunGate ? {
            gatePass: norunGate.gatePass,
            exitCode: norunGate.exitCode,
            errorCount: norunGate.errorCount,
            dryRun: norunGate.dryRun,
            setupError: norunGate.setupError || null
        } : null
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
