/**
 * Local agent session state for paid MCP agent_status tool.
 * Persisted to .simplebeacon/agent-session.json (gitignored by convention).
 */

const fs = require('fs');
const path = require('path');

const SESSION_FILENAME = 'agent-session.json';

function sessionPath(projectRoot) {
    return path.join(path.resolve(projectRoot), '.simplebeacon', SESSION_FILENAME);
}

function defaultSession() {
    return {
        version: 1,
        lastGatePass: null,
        openFindings: [],
        fixedThisSession: [],
        scanWatermark: null,
        updatedAt: null
    };
}

function readAgentSession(projectRoot) {
    const file = sessionPath(projectRoot);
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...defaultSession(), ...parsed, path: file };
    } catch {
        return { ...defaultSession(), path: file };
    }
}

function writeAgentSession(projectRoot, patch) {
    const file = sessionPath(projectRoot);
    const current = readAgentSession(projectRoot);
    const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString()
    };
    delete next.path;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
    return next;
}

function recordScanResult(projectRoot, { gatePass, findings, watermark }) {
    const open = (findings || [])
        .filter((f) => f.severity === 'critical' || f.severity === 'high')
        .map((f, i) => f.id || `${f.pattern || f.type || 'finding'}-${i}-${f.filePath || 'snippet'}`);
    return writeAgentSession(projectRoot, {
        lastGatePass: gatePass === true,
        openFindings: open,
        scanWatermark: watermark || null
    });
}

function recordFix(projectRoot, findingId) {
    const session = readAgentSession(projectRoot);
    const fixed = Array.isArray(session.fixedThisSession) ? [...session.fixedThisSession] : [];
    if (findingId && !fixed.includes(findingId)) fixed.push(findingId);
    const open = (session.openFindings || []).filter((id) => id !== findingId);
    return writeAgentSession(projectRoot, { fixedThisSession: fixed, openFindings: open });
}

function buildNextAction(session, gateStatus) {
    const open = session.openFindings || [];
    if (session.lastGatePass === true && open.length === 0) {
        return 'Gate PASS — run scan_staged before opening a PR.';
    }
    if (open.length > 0) {
        return `Fix open finding "${open[0]}" then call verify_fix.`;
    }
    if (gateStatus && gateStatus.gatePass === false) {
        return 'Run scan_project --gate then suggest_fixes.';
    }
    return 'Run scan_snippet on the next edit, then propose_fix for any blocking findings.';
}

module.exports = {
    SESSION_FILENAME,
    sessionPath,
    readAgentSession,
    writeAgentSession,
    recordScanResult,
    recordFix,
    buildNextAction,
    defaultSession
};
