/**
 * Agent Supercharge — one-call mission briefing for any AI coding agent plugin.
 * Bundles context pack, gate, code suggestions, master brief, host wiring, and playbooks.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildContextPack, readReport } = require('./agent-context-pack');
const { formatAgentBrief, pickIssues, buildPipelineMetrics } = require('./agent-brief');
const { readAgentSession, buildNextAction } = require('./agent-session');
const { readGateStatus } = require('./snippet-scanner');
const { resolveTaskProfile, listPdaModes, resolvePdaScanDefaults } = require('./agent-task-profiles');
const { resolveAgentTier, getAgentCapabilities, UPGRADE_URL } = require('./agent-tier-capabilities');
const { HOST_REGISTRY, ALL_HOST_IDS, parseHostsOption } = require('./agent-host-adapters');
const { findWorkspaceRoot, resolveScanAndWorkspaceRoots } = require('./workspace-root');

const SUPERCHARGE_PLAYBOOK = Object.freeze({
    sessionStart: [
        'Call supercharge_agent (or get_context_pack + gate_status) — read mission briefing first',
        'Read .simplebeacon/agent-supercharge.md when present',
        'Read .simplebeacon/agent-brief.md and .simplebeacon/code-suggestions.md',
        'Confirm SimpleBeacon MCP is connected (hostStatus in supercharge response)'
    ],
    beforeEdit: [
        'scan_snippet with content + filePath — fix blockingCount before applying',
        'code_suggestions — check for auto-fixable patterns on target file',
        'explain_finding when pattern id is unclear (paid)'
    ],
    afterEdit: [
        'scan_file on changed path (paid)',
        'verify_fix after propose_fix patch (paid)',
        'agent_status — track open findings (paid)'
    ],
    beforeDone: [
        'handoff_check — do not claim complete until ready:true',
        'scan_staged on git staged files (paid)',
        'npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json'
    ]
});

const TOOL_ROUTER = Object.freeze([
    { when: 'Session start', tool: 'supercharge_agent', alt: 'get_context_pack + gate_status' },
    { when: 'Before accepting generated code', tool: 'scan_snippet', required: true },
    { when: 'Need before/after fix hints', tool: 'code_suggestions', required: false },
    { when: 'Unclear finding', tool: 'explain_finding', tier: 'paid' },
    { when: 'Deterministic patch', tool: 'propose_fix → verify_fix', tier: 'paid' },
    { when: 'After saving file', tool: 'scan_file', tier: 'paid' },
    { when: 'Master recovery plan', tool: 'master_engineering_brief', required: false },
    { when: 'Natural language blocker', tool: 'solve_problem / diagnose_error', required: false },
    { when: 'Wire IDE plugin', tool: 'install_agent_plugin', required: false },
    { when: 'Pre-merge', tool: 'scan_staged → gate_status → handoff_check', tier: 'mixed' }
]);

function safeGitSummary(projectRoot) {
    const root = path.resolve(projectRoot);
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: root, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        const status = execSync('git status --porcelain', {
            cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        const lines = status ? status.split('\n').filter(Boolean) : [];
        const modified = lines.filter((l) => /^ M|^M /.test(l)).length;
        const untracked = lines.filter((l) => /^\?\?/.test(l)).length;
        const staged = lines.filter((l) => /^[MADRC]/.test(l)).length;
        return {
            branch,
            dirty: lines.length > 0,
            modified,
            untracked,
            staged,
            recentFiles: lines.slice(0, 8).map((l) => l.slice(3).trim())
        };
    } catch {
        return null;
    }
}

function detectInstalledHosts(projectRoot, options = {}) {
    const root = path.resolve(options.workspaceRoot || findWorkspaceRoot(projectRoot));
    const detected = [];
    const installed = [];

    for (const hostId of ALL_HOST_IDS) {
        const host = HOST_REGISTRY[hostId];
        if (!host) continue;

        let signal = false;
        if (host.instructionPath) {
            const instr = path.join(root, host.instructionPath);
            if (fs.existsSync(instr)) {
                const body = fs.readFileSync(instr, 'utf8');
                if (host.instructionKind === 'append-section') {
                    signal = body.includes('SimpleBeacon') || body.includes('simplebeacon');
                } else {
                    signal = body.includes('SimpleBeacon') || body.includes('scan_snippet');
                }
            }
        }
        if (host.mcpConfigPath) {
            const mcpPath = path.join(root, host.mcpConfigPath);
            if (fs.existsSync(mcpPath)) {
                try {
                    const cfg = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
                    const servers = host.continueMcpFormat
                        ? cfg.experimental?.modelContextProtocolServers
                        : cfg[host.mcpRootKey];
                    if (host.continueMcpFormat && Array.isArray(servers)) {
                        signal = signal || servers.some((s) => s?.name === 'simplebeacon');
                    } else if (servers?.simplebeacon) {
                        signal = signal || true;
                    }
                } catch {
                    /* ignore */
                }
            }
        }
        if (signal) {
            detected.push(hostId);
            if (host.mcpConfigPath && fs.existsSync(path.join(root, host.mcpConfigPath))) {
                installed.push(hostId);
            }
        }
    }

    // Extra signals for hosts without dedicated MCP paths
    if (fs.existsSync(path.join(root, '.clinerules')) && !detected.includes('cline')) {
        const body = fs.readFileSync(path.join(root, '.clinerules'), 'utf8');
        if (body.includes('SimpleBeacon') || body.includes('scan_snippet')) detected.push('cline');
    }
    if (fs.existsSync(path.join(root, '.github', 'copilot-instructions.md')) && !detected.includes('copilot')) {
        detected.push('copilot');
    }

    const missing = ALL_HOST_IDS.filter((id) => !detected.includes(id));
    return { detected, installed, missing };
}

function buildMissionHeadline(gate, blockingCount, codeSuggestions) {
    if (gate === true) {
        return 'Gate passed — verify handoff_check before claiming done';
    }
    if (blockingCount > 0) {
        const qw = codeSuggestions?.quickWinCount || 0;
        return `Fix ${blockingCount} gate blocker${blockingCount === 1 ? '' : 's'}${qw ? ` (${qw} quick-win hints available)` : ''}`;
    }
    return 'Run scan_project with gate:true to refresh baseline';
}

function buildAgentPrompt(mission, tierCtx, hostStatus) {
    const tierName = tierCtx.tier === 'game_dev' ? 'Game Dev Pro'
        : tierCtx.tier === 'agent' ? 'Agent'
        : tierCtx.paid ? 'Developer+'
        : 'Free';
    const expLabel = tierCtx.tier === 'game_dev' ? '7/10 game dev fix loop'
        : tierCtx.tier === 'agent' ? '8/10 agent fix loop'
        : tierCtx.paid ? '11/10 paid full loop'
        : '2/10 free preview';
    const lines = [
        'You are supercharged by SimpleBeacon — local verify layer, no source upload.',
        `Mission: ${mission.headline}`,
        `Tier: ${tierName} (${expLabel}).`,
        'Loop: scan_snippet before apply → scan_file after save (paid) → handoff_check before done.',
        'Read .simplebeacon/code-suggestions.md and master-engineering-brief.md for deterministic fixes.',
        'Never commit secrets, fiction KPIs, or mock production paths.'
    ];
    if ((hostStatus.detected || []).length === 0) {
        lines.push('Run install_agent_plugin or `npx simplebeacon init --starter` to wire this IDE.');
    }
    return lines.join('\n');
}

function buildAgentSupercharge(projectRoot, options = {}) {
    const { scanRoot, workspaceRoot } = resolveScanAndWorkspaceRoots(projectRoot, options);
    const tierCtx = options.tierCtx || resolveAgentTier(options);
    const paid = tierCtx.paid;
    const capabilities = getAgentCapabilities(tierCtx);
    const task = resolveTaskProfile(options.task || options.taskProfile);
    const pdaScanDefaults = resolvePdaScanDefaults(scanRoot, {
        task: task.id,
        monorepo: options.monorepo,
        fullDirectoryScan: options.fullDirectoryScan,
        complete: options.complete,
        scanMode: options.scanMode
    });
    const pdaModes = listPdaModes();
    const report = options.report || readReport(scanRoot);
    const gate = readGateStatus(scanRoot);
    const session = readAgentSession(scanRoot);
    const gatePass = gate.gatePass ?? report?.gate?.pass ?? null;
    const blockingCount = gate.blockingCount ?? report?.gate?.blockingCount ?? 0;
    const issues = pickIssues(report);
    const hostStatus = detectInstalledHosts(scanRoot, { workspaceRoot });

    let codeSuggestions = null;
    try {
        const { buildCodeSuggestions } = require('./code-suggestions');
        codeSuggestions = buildCodeSuggestions(report, { maxSuggestions: paid ? 10 : 3 });
    } catch {
        /* optional */
    }

    let masterSummary = null;
    try {
        const { buildMasterEngineeringBrief } = require('./master-engineering-brief');
        const brief = buildMasterEngineeringBrief(scanRoot, {
            gateReport: report,
            fileReduction: options.fileReduction
        });
        masterSummary = {
            overallScore: brief.overallScore,
            shipReady: brief.shipReady,
            weakCylinders: (brief.tenCylinders || []).filter((c) => c.status !== 'strong').slice(0, 4),
            yesYouCanTop: (brief.yesYouCan || []).slice(0, 3).map((y) => y.title || y.problem),
            phasedPlan: (brief.phasedPlan || []).slice(0, 3)
        };
    } catch {
        /* optional */
    }

    const contextPack = buildContextPack(scanRoot, { task: task.id, report, paid });
    const nextAction = buildNextAction(session, { gatePass });
    const git = options.includeGit === false ? null : safeGitSummary(scanRoot);

    const mission = {
        headline: buildMissionHeadline(gatePass, blockingCount, codeSuggestions),
        nextAction,
        handoffReady: gatePass === true && blockingCount === 0,
        gatePass,
        blockingCount
    };

    const topFixes = (codeSuggestions?.suggestions || codeSuggestions?.quickWins || []).slice(0, paid ? 5 : 2);

    return {
        schemaVersion: '1.0',
        kind: 'agent-supercharge',
        generatedAt: new Date().toISOString(),
        scanRoot,
        workspaceRoot,
        projectRoot: scanRoot,
        tier: tierCtx.tier,
        agentExperience: capabilities.agentExperience,
        capabilities,
        taskProfile: task,
        pdaMode: task.pdaMode ? task.id : null,
        pdaModes,
        pdaScanDefaults,
        mission,
        git,
        hostStatus: {
            ...hostStatus,
            workspaceRoot,
            scanRoot,
            supportedHosts: ALL_HOST_IDS.map((id) => ({
                id,
                label: HOST_REGISTRY[id]?.label || id,
                mcp: Boolean(HOST_REGISTRY[id]?.supportsMcp)
            })),
            installHint: hostStatus.detected.length
                ? null
                : 'npx simplebeacon init --starter --hosts all'
        },
        playbook: SUPERCHARGE_PLAYBOOK,
        toolRouter: TOOL_ROUTER,
        pipeline: buildPipelineMetrics(report),
        contextPack,
        briefMarkdown: formatAgentBrief(report || {}, { paid, projectRoot: scanRoot }),
        topIssues: issues.slice(0, paid ? 8 : 3).map((i) => ({
            severity: i.severity || i.sev,
            type: i.type || i.pattern,
            file: i.filePath || i.file,
            line: i.line,
            pattern: paid ? (i.pattern || i.rule) : null
        })),
        codeSuggestions: codeSuggestions ? {
            quickWinCount: codeSuggestions.quickWinCount,
            autoFixCount: codeSuggestions.autoFixCount,
            top: topFixes
        } : null,
        masterEngineering: masterSummary,
        artifacts: [
            '.simplebeacon/agent-supercharge.md',
            '.simplebeacon/agent-brief.md',
            '.simplebeacon/ai-context.md',
            '.simplebeacon/code-suggestions.md',
            '.simplebeacon/master-engineering-brief.md',
            '.simplebeacon/report.json'
        ],
        agentPrompt: buildAgentPrompt(mission, tierCtx, hostStatus),
        mcpTools: {
            startHere: 'supercharge_agent',
            essentials: ['scan_snippet', 'gate_status', 'handoff_check', 'code_suggestions'],
            paidLoop: ['scan_file', 'propose_fix', 'verify_fix', 'scan_staged', 'agent_status'],
            install: 'install_agent_plugin'
        },
        ...(!paid ? { upgradeUrl: UPGRADE_URL } : {})
    };
}

function formatSuperchargeMarkdown(bundle) {
    if (!bundle || typeof bundle !== 'object') return '';
    const lines = [
        '# SimpleBeacon Agent Supercharge',
        '',
        `> ${bundle.agentPrompt?.split('\n')[0] || 'Local verify layer for AI coding agents.'}`,
        '',
        `- **Mission:** ${bundle.mission?.headline || '—'}`,
        `- **Next action:** ${bundle.mission?.nextAction || '—'}`,
        `- **Gate:** ${bundle.mission?.gatePass === true ? 'PASS' : bundle.mission?.gatePass === false ? 'FAIL' : 'unknown'} (${bundle.mission?.blockingCount ?? 0} blocking)`,
        `- **Agent experience:** ${bundle.agentExperience}`,
        `- **Updated:** ${bundle.generatedAt}`,
        ''
    ];

    if (bundle.taskProfile) {
        lines.push('## PDA mode');
        lines.push('');
        lines.push(`- **Active profile:** ${bundle.taskProfile.label} (\`${bundle.taskProfile.id}\`)`);
        if (bundle.pdaMode) {
            lines.push(`- **PDA mode:** \`${bundle.pdaMode}\` — use \`supercharge_agent\` with \`task: "${bundle.pdaMode}"\``);
        }
        if (bundle.pdaScanDefaults) {
            const d = bundle.pdaScanDefaults;
            lines.push(`- **Scan default:** gate=${d.gate !== false}, fullTree=${d.fullDirectoryScan === true} (${d.reason || 'PDA'})`);
        }
        lines.push('');
    }

    if ((bundle.pdaModes || []).length) {
        lines.push('## Available PDA modes');
        lines.push('');
        for (const mode of bundle.pdaModes) {
            lines.push(`- **${mode.id}** — ${mode.label}: ${mode.description}`);
        }
        lines.push('');
        lines.push('_Call `supercharge_agent` with `task: "handoff"`, `"security"`, or `"gamedev"`._');
        lines.push('');
    }

    if (bundle.workspaceRoot && bundle.scanRoot && bundle.workspaceRoot !== bundle.scanRoot) {
        lines.push('## Roots');
        lines.push('');
        lines.push(`- **Scan target:** \`${bundle.scanRoot}\``);
        lines.push(`- **Workspace (plugins):** \`${bundle.workspaceRoot}\``);
        lines.push('');
    }

    if (bundle.git) {
        lines.push('## Git snapshot');
        lines.push('');
        lines.push(`- Branch: \`${bundle.git.branch}\`${bundle.git.dirty ? ' (dirty)' : ''}`);
        if (bundle.git.staged) lines.push(`- Staged: ${bundle.git.staged}`);
        if (bundle.git.modified) lines.push(`- Modified: ${bundle.git.modified}`);
        if ((bundle.git.recentFiles || []).length) {
            lines.push('- Recent changes:');
            for (const f of bundle.git.recentFiles) lines.push(`  - \`${f}\``);
        }
        lines.push('');
    }

    lines.push('## Host plugin status');
    lines.push('');
    if ((bundle.hostStatus?.detected || []).length) {
        lines.push(`- **Wired:** ${bundle.hostStatus.detected.join(', ')}`);
    } else {
        lines.push('- **Not wired** — run `install_agent_plugin` or `npx simplebeacon init --starter`');
    }
    lines.push('');

    lines.push('## Session playbook');
    lines.push('');
    for (const [phase, steps] of Object.entries(bundle.playbook || {})) {
        lines.push(`### ${phase}`);
        for (const step of steps) lines.push(`- ${step}`);
        lines.push('');
    }

    lines.push('## MCP tool router');
    lines.push('');
    for (const row of bundle.toolRouter || []) {
        lines.push(`- **${row.when}:** \`${row.tool}\`${row.tier ? ` (${row.tier})` : ''}`);
    }
    lines.push('');

    if ((bundle.codeSuggestions?.top || []).length) {
        lines.push('## Top code suggestions');
        lines.push('');
        for (const item of bundle.codeSuggestions.top) {
            lines.push(`- **${item.title}** @ \`${item.filePath || '—'}\``);
            lines.push(`  ${item.suggestion || item.codeHint || ''}`);
        }
        lines.push('');
    }

    if (bundle.masterEngineering) {
        const me = bundle.masterEngineering;
        lines.push('## Master engineering');
        lines.push('');
        lines.push(`- Score: ${me.overallScore}/100 · Ship ready: ${me.shipReady ? 'yes' : 'no'}`);
        if ((me.yesYouCanTop || []).length) {
            lines.push('- Yes you can:');
            for (const t of me.yesYouCanTop) lines.push(`  - ${t}`);
        }
        lines.push('');
    }

    lines.push('## Full agent prompt');
    lines.push('');
    lines.push('```');
    lines.push(bundle.agentPrompt || '');
    lines.push('```');
    lines.push('');

    if (bundle.upgradeUrl) {
        lines.push(`_Upgrade for paid 11/10 loop: ${bundle.upgradeUrl}_`);
        lines.push('');
    }

    return lines.join('\n');
}

function writeAgentSupercharge(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const bundle = buildAgentSupercharge(root, options);
    const outPath = path.join(root, '.simplebeacon', 'agent-supercharge.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, formatSuperchargeMarkdown(bundle), 'utf8');
    return { path: outPath, bundle };
}

module.exports = {
    SUPERCHARGE_PLAYBOOK,
    TOOL_ROUTER,
    safeGitSummary,
    detectInstalledHosts,
    buildAgentSupercharge,
    formatSuperchargeMarkdown,
    writeAgentSupercharge,
    parseHostsOption,
    findWorkspaceRoot,
    resolveScanAndWorkspaceRoots
};
