// simplebeacon-ignore: debugArtifacts
/**
 * Bridge local Ollama agent to SimpleBeacon deterministic supercharge briefing.
 */
const fs = require('fs');
const path = require('path');

function resolveSimplebeaconCliRoot() {
    const candidates = [
        path.join(__dirname, '..', 'packages', 'simplebeacon-cli'),
        path.join(process.cwd(), 'packages', 'simplebeacon-cli')
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'src', 'lib', 'agent-supercharge.js'))) return c;
    }
    return null;
}

function loadSuperchargeBriefing(projectRoot) {
    const root = path.resolve(projectRoot || process.cwd());
    const superPath = path.join(root, '.simplebeacon', 'agent-supercharge.md');
    if (fs.existsSync(superPath)) {
        return fs.readFileSync(superPath, 'utf8').slice(0, 6000);
    }
    const cliRoot = resolveSimplebeaconCliRoot();
    if (!cliRoot) return null;
    try {
        const { buildAgentSupercharge, formatSuperchargeMarkdown } = require(path.join(cliRoot, 'src', 'lib', 'agent-supercharge'));
        const { readReport } = require(path.join(cliRoot, 'src', 'lib', 'agent-context-pack'));
        const report = readReport(root);
        const bundle = buildAgentSupercharge(root, { report, workspaceRoot: process.env.SIMPLEBEACON_PROJECT_ROOT });
        return formatSuperchargeMarkdown(bundle).slice(0, 6000);
    } catch {
        return null;
    }
}

function enrichGoalWithSupercharge(userGoal, projectRoot) {
    const briefing = loadSuperchargeBriefing(projectRoot);
    if (!briefing) return userGoal;
    return `${userGoal}\n\n--- SIMPLEBEACON SUPERCHARGE ---\n${briefing}\n\nFollow the MCP loop: scan_snippet before patches, only edit files that exist, fix gate-blocking issues first.\n--- END SUPERCHARGE ---\n`;
}

module.exports = {
    resolveSimplebeaconCliRoot,
    loadSuperchargeBriefing,
    enrichGoalWithSupercharge
};
