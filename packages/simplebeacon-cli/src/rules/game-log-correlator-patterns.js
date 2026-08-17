/**
 * Game log correlator — pluggable parsers for GZDoom, Unity, Godot runtime logs.
 */

const fs = require('fs');
const path = require('path');
const { parseGameLog } = require('../lib/game-log-parsers');
const { resolveGameEngine } = require('../lib/game-engine-registry');

function logEntryToIssue(entry, logPath, severity) {
    const details = entry.details || {};
    const filePath = details.filePath || details.resourcePath || details.assetPath || logPath || 'runtime.log';
    return {
        id: `${entry.id}-${entry.line}-${entry.kind}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        severity: entry.severity || severity,
        type: `game-log-${entry.kind}`,
        filePath,
        line: details.line || entry.line || 1,
        description: entry.text || `${entry.kind} in runtime log`,
        recommendedAction: 'Fix the referenced script, asset, or scene path and re-run the gate',
        metadata: {
            patternId: entry.id,
            engine: entry.engine || 'generic',
            logPath,
            ...details
        }
    };
}

/**
 * @param {string} baseDir
 * @param {{logPath?:string,engine?:string,ignoreGlobs?:string[],severity?:string}} [options]
 */
async function scanGameLogCorrelator(baseDir, options = {}) {
    const severity = options.severity || 'high';
    const engine = options.engine || resolveGameEngine(baseDir, { gameDev: { engine: options.engine } });
    const logPath = options.logPath;
    if (!logPath) {
        return { scanned: 0, findings: 0, issues: [], engine, skipped: 'no logPath' };
    }

    const logAbs = path.isAbsolute(logPath) ? logPath : path.join(baseDir, logPath);
    if (!fs.existsSync(logAbs)) {
        return { scanned: 0, findings: 0, issues: [], engine, skipped: 'log not found' };
    }

    let content;
    try {
        content = await fs.promises.readFile(logAbs, 'utf8');
    } catch {
        return { scanned: 0, findings: 0, issues: [], engine, skipped: 'log unreadable' };
    }

    const entries = parseGameLog(content, { engine: engine === 'generic' ? 'auto' : engine });
    const issues = entries.map((entry) => logEntryToIssue(entry, path.relative(baseDir, logAbs), severity));

    return {
        scanned: 1,
        findings: issues.length,
        issues,
        engine,
        logPath: path.relative(baseDir, logAbs)
    };
}

module.exports = {
    scanGameLogCorrelator
};
