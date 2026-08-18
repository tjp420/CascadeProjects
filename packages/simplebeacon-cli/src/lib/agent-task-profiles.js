/**
 * Task profiles — map agent intent to scan profile, domain hints, and verify commands.
 * PDA modes (gamedev / security / handoff) are first-class assistant operating modes.
 */

/** First-class PDA modes surfaced in supercharge_agent */
const PDA_MODE_IDS = Object.freeze(['handoff', 'security', 'gamedev']);

const TASK_PROFILES = Object.freeze({
    'agent-core': {
        label: 'AI agent core verification',
        scanProfile: 'agent-core',
        domain: 'generic',
        pdaMode: false,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Core AI-agent failure scanners: swallowed exceptions, phantom APIs, hallucinated imports, LLM slop, secrets, production leaks.',
        verifyCommands: [
            'npx simplebeacon scan --profile agent-core --gate --offline --format json --output .simplebeacon/report.json',
            'npx simplebeacon gate status'
        ]
    },
    hygiene: {
        label: 'Repository hygiene',
        scanProfile: 'standard',
        domain: 'generic',
        pdaMode: false,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Secrets, slop, TODOs, mock paths, production leaks.',
        verifyCommands: [
            'npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json',
            'npm test --if-present'
        ]
    },
    handoff: {
        label: 'Ship / handoff readiness',
        scanProfile: 'cascade',
        domain: 'enterprise',
        pdaMode: true,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Gate pass, blocking issues, consistency anchors, pre-PR checks.',
        verifyCommands: [
            'npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json',
            'npx simplebeacon gate status'
        ]
    },
    security: {
        label: 'Security review',
        scanProfile: 'standard',
        domain: 'enterprise',
        pdaMode: true,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Credentials, auth bypass patterns, production env leaks.',
        verifyCommands: [
            'npx simplebeacon scan --gate --offline',
            'npm audit --audit-level=high'
        ]
    },
    refactor: {
        label: 'Refactor / architecture',
        scanProfile: 'standard',
        domain: 'generic',
        pdaMode: false,
        scanOptions: { gate: false, fullDirectoryScan: false, complete: false },
        description: 'Import cycles, dead code signals, architecture drift (when enabled).',
        verifyCommands: [
            'npx simplebeacon scan --offline',
            'npm test --if-present'
        ]
    },
    gamedev: {
        label: 'Game mod / interactive',
        scanProfile: 'gamedev',
        domain: 'game',
        pdaMode: true,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false, profile: 'gamedev' },
        description: 'Game project integrity — scripts, assets, shaders, and runtime log correlation (Unity, Unreal, Godot, mods).',
        verifyCommands: [
            'npx simplebeacon scan --profile gamedev --gate --offline --format json --output .simplebeacon/report.json',
            'npx simplebeacon scan --config .simplebeacon/config-game-dev.json --log path/to/Player.log --gate --offline'
        ]
    },
    extension: {
        label: 'VS Code extension / dashboard',
        scanProfile: 'cascade',
        domain: 'generic',
        pdaMode: false,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Extension packaging, dashboard-web sync, circular ES imports.',
        verifyCommands: [
            'npm run compile --workspace=simplebeacon-vscode-merged',
            'npm run sync:dashboard-web --workspace=simplebeacon-vscode-merged'
        ]
    },
    monorepo: {
        label: 'Monorepo / multi-package',
        scanProfile: 'cascade',
        domain: 'enterprise',
        pdaMode: false,
        scanOptions: { gate: true, fullDirectoryScan: false, complete: false },
        description: 'Scan a package (e.g. ai-platform/) with workspace-root plugin detection and per-package gates.',
        verifyCommands: [
            'npx simplebeacon supercharge <package-path> --write-disk --task monorepo',
            'npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json',
            'npm test --workspaces --if-present'
        ]
    }
});

function resolveTaskProfile(task) {
    const key = String(task || 'hygiene').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const aliases = {
        ship: 'handoff',
        pr: 'handoff',
        merge: 'handoff',
        gzdoom: 'gamedev',
        doom: 'gamedev',
        mod: 'gamedev',
        unity: 'gamedev',
        godot: 'gamedev',
        unreal: 'gamedev',
        game: 'gamedev',
        vscode: 'extension',
        vsix: 'extension',
        audit: 'hygiene',
        mono: 'monorepo',
        monorepo: 'monorepo'
    };
    const resolved = TASK_PROFILES[aliases[key] || key] || TASK_PROFILES.hygiene;
    return { id: aliases[key] || (TASK_PROFILES[key] ? key : 'hygiene'), ...resolved };
}

function listTaskProfiles() {
    return Object.entries(TASK_PROFILES).map(([id, p]) => ({
        id,
        label: p.label,
        scanProfile: p.scanProfile,
        pdaMode: p.pdaMode === true,
        description: p.description
    }));
}

function listPdaModes() {
    return PDA_MODE_IDS.map((id) => {
        const p = TASK_PROFILES[id];
        return {
            id,
            label: p.label,
            description: p.description,
            scanOptions: p.scanOptions,
            verifyCommands: p.verifyCommands
        };
    });
}

/**
 * Default scan flags for the PDA layer — monorepos use gate-only, not full-tree walks.
 */
function resolvePdaScanDefaults(projectRoot, options = {}) {
    const task = resolveTaskProfile(options.task || options.taskProfile);
    const monorepo = options.monorepo === true || detectMonorepoRoot(projectRoot);
    const explicitFull = options.fullDirectoryScan === true || options.complete === true;
    const scanMode = String(options.scanMode || '').toLowerCase();

    if (explicitFull || scanMode === 'full' || scanMode === 'complete') {
        return {
            gate: scanMode !== 'full' && task.scanOptions?.gate !== false,
            complete: true,
            fullDirectoryScan: true,
            taskProfile: task.id,
            monorepo,
            reason: 'explicit full/complete scan requested'
        };
    }

    const base = task.scanOptions || { gate: true, fullDirectoryScan: false, complete: false };
    if (monorepo && !task.pdaMode) {
        return {
            ...base,
            gate: true,
            complete: false,
            fullDirectoryScan: false,
            taskProfile: task.id,
            monorepo: true,
            reason: 'monorepo default — gate on production paths only (use --full for full-tree)'
        };
    }

    return {
        ...base,
        taskProfile: task.id,
        monorepo,
        reason: task.pdaMode ? `PDA mode: ${task.id}` : 'PDA default — gate scan'
    };
}

function detectMonorepoRoot(projectRoot) {
    if (!projectRoot || typeof projectRoot !== 'string') return false;
    try {
        const fs = require('fs');
        const path = require('path');
        const root = path.resolve(projectRoot);
        const pkgPath = path.join(root, 'package.json');
        if (!fs.existsSync(pkgPath)) return false;
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) return true;
        let pkgCount = 0;
        for (const name of fs.readdirSync(root)) {
            if (name === 'node_modules' || name.startsWith('.')) continue;
            const sub = path.join(root, name);
            try {
                if (fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'package.json'))) {
                    pkgCount += 1;
                }
            } catch {
                /* ignore */
            }
        }
        return pkgCount >= 2;
    } catch {
        return false;
    }
}

module.exports = {
    TASK_PROFILES,
    PDA_MODE_IDS,
    resolveTaskProfile,
    listTaskProfiles,
    listPdaModes,
    resolvePdaScanDefaults,
    detectMonorepoRoot
};
