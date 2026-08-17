/**
 * Agent context pack — structured project context for any AI assistant (MCP + disk).
 */

const fs = require('fs');
const path = require('path');
const { pickIssues, buildPipelineMetrics } = require('./agent-brief');
const { readAgentSession, buildNextAction } = require('./agent-session');
const { readGateStatus } = require('./snippet-scanner');
const { resolveTaskProfile, listTaskProfiles } = require('./agent-task-profiles');
const { UPGRADE_URL } = require('./agent-tier-capabilities');
const { readCleanupAiNotes, readFileReductionReport, buildFileReductionAiNotes } = require('./file-reduction-ai-notes');

const DOMAIN_HINTS = Object.freeze({
    generic: 'General software. Extend existing handlers inline; match naming and module system in repo.',
    game: 'Game/interactive. Respect update loops, asset pipelines; correlate runtime logs to source.',
    enterprise: 'Enterprise SaaS. Tenant isolation, idempotent webhooks, no secrets in logs.',
    government: 'Regulated software. Env-based secrets, audit logging, fail-closed auth.',
    healthcare: 'Healthcare-adjacent. PHI minimization, no patient identifiers in fixtures.'
});

const UNIVERSAL_RULES = [
    'Read .simplebeacon/agent-brief.md and .simplebeacon/ai-context.md before editing.',
    'For cleanup tasks, read .simplebeacon/file-reduction-ai-notes.md and cleanup-ai-notes.json.',
    'For code quality fixes, read .simplebeacon/code-suggestions.md before editing.',
    'For master plan and recovery playbooks, read .simplebeacon/master-engineering-brief.md first.',
    'Extend existing files — avoid parallel modules unless the scan requires it.',
    'Never commit secrets, mock production paths, or fiction KPIs.',
    'Fix gate-blocking (critical/high) before refactors.',
    'MCP loop: scan_snippet → edit → scan_file → gate_status before merge.'
];

const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.simplebeacon'
]);

const ENTRY_CANDIDATES = [
    'package.json',
    'server/index.cjs',
    'server.cjs',
    'src/extension.ts',
    'src/main.tsx',
    'bin/simplebeacon.js',
    'coming-soon/public/audit.html'
];

function readReport(projectRoot) {
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');
    try {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
        return null;
    }
}

function buildRepoMap(projectRoot, maxEntries = 24) {
    const entries = [];
    try {
        for (const name of fs.readdirSync(projectRoot)) {
            if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
            const full = path.join(projectRoot, name);
            let kind = 'file';
            try {
                kind = fs.statSync(full).isDirectory() ? 'dir' : 'file';
            } catch {
                continue;
            }
            entries.push({ name, kind });
            if (entries.length >= maxEntries) break;
        }
    } catch {
        return [];
    }
    return entries;
}

function detectEntryPoints(projectRoot) {
    const found = [];
    for (const rel of ENTRY_CANDIDATES) {
        const full = path.join(projectRoot, rel);
        if (fs.existsSync(full)) found.push(rel.replace(/\\/g, '/'));
    }
    let scripts = {};
    try {
        const pkgPath = path.join(projectRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            scripts = pkg.scripts || {};
        }
    } catch {
        /* ignore */
    }
    const verifyCommands = [];
    if (scripts.test) verifyCommands.push('npm test');
    if (scripts['scan:gate']) verifyCommands.push('npm run scan:gate');
    else verifyCommands.push('npx simplebeacon scan --gate --offline --format json --output .simplebeacon/report.json');
    return { paths: found, npmScripts: Object.keys(scripts).slice(0, 12), verifyCommands };
}

function buildContextPack(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const task = resolveTaskProfile(options.task || options.taskProfile);
    const report = options.report || readReport(root);
    const gate = readGateStatus(root);
    const session = readAgentSession(root);
    const paid = options.paid === true;
    const issues = pickIssues(report);
    const blocking = issues.filter((i) => {
        const sev = String(i.severity || i.sev || '').toLowerCase();
        return sev === 'critical' || sev === 'high' || i.blocking === true;
    });
    const domain = options.domain || task.domain || 'generic';
    const issueCap = paid ? 12 : 3;
    const fileReductionNotes = readCleanupAiNotes(root)
        || buildFileReductionAiNotes(readFileReductionReport(root) || options.fileReductionReport, { projectRoot: root });
    const topIssues = (blocking.length ? blocking : issues).slice(0, issueCap).map((i) => ({
        severity: i.severity || i.sev || 'medium',
        type: i.type || i.pattern || 'issue',
        file: i.filePath || i.path || i.file || null,
        line: i.line ?? null,
        description: paid
            ? String(i.description || i.message || '').slice(0, 200)
            : 'Upgrade for full details',
        pattern: paid ? (i.pattern || i.rule || null) : null
    }));

    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        projectRoot: root,
        taskProfile: task,
        agentExperience: paid ? '11/10' : '2/10',
        tier: paid ? 'paid' : 'free',
        gate: {
            pass: gate.gatePass ?? report?.gate?.pass ?? null,
            blockingCount: gate.blockingCount ?? report?.gate?.blockingCount ?? 0
        },
        pipeline: buildPipelineMetrics(report),
        session: {
            openFindings: (session.openFindings || []).length,
            nextAction: buildNextAction(session, { gatePass: gate.gatePass })
        },
        repoMap: buildRepoMap(root),
        entryPoints: detectEntryPoints(root),
        domain,
        domainGuidance: DOMAIN_HINTS[domain] || DOMAIN_HINTS.generic,
        codingRules: UNIVERSAL_RULES,
        topIssues,
        verifyCommands: task.verifyCommands,
        mcpWorkflow: [
            'supercharge_agent — start here (one-call mission briefing)',
            'get_context_pack — structured repo context',
            'scan_snippet — before applying edits',
            'scan_file — after saving (paid)',
            'scan_project — refresh gate',
            'gate_status — pre-merge check',
            'code_suggestions — simple before/after code hints',
            'master_engineering_brief — ten-cylinder plan + yes-you-can playbooks',
            'install_agent_plugin — wire Cursor/Windsurf/Continue/Cline/Copilot/Aider',
            'suggest_fixes — prioritized remediation (paid: full)'
        ],
        availableTaskProfiles: listTaskProfiles(),
        fileReduction: fileReductionNotes ? {
            reportHealth: fileReductionNotes.reportHealth,
            rescanRecommended: fileReductionNotes.rescanRecommended,
            reclaim: fileReductionNotes.reclaim,
            safeDirectories: (fileReductionNotes.safeDirectories || []).slice(0, 6),
            agentPrompt: fileReductionNotes.cleanupBrief?.agentPrompt || null,
            artifacts: [
                '.simplebeacon/file-reduction-ai-notes.md',
                '.simplebeacon/cleanup-ai-notes.json',
                '.simplebeacon/cleanup-brief.json'
            ]
        } : null,
        codeSuggestions: report?.codeSuggestions ? {
            quickWinCount: report.codeSuggestions.quickWinCount,
            autoFixCount: report.codeSuggestions.autoFixCount,
            top: (report.codeSuggestions.quickWins || report.codeSuggestions.suggestions || []).slice(0, 5),
            artifacts: ['.simplebeacon/code-suggestions.md', '.simplebeacon/code-suggestions.json']
        } : null,
        masterEngineering: (() => {
            try {
                const { buildMasterEngineeringBrief } = require('./master-engineering-brief');
                const brief = buildMasterEngineeringBrief(root, {
                    gateReport: report,
                    fileReduction: readFileReductionReport(root)
                });
                return {
                    overallScore: brief.overallScore,
                    shipReady: brief.shipReady,
                    tenCylinders: brief.tenCylinders,
                    yesYouCanCount: (brief.yesYouCan || []).length,
                    phasedPlan: (brief.phasedPlan || []).map((p) => ({ phase: p.phase, name: p.name, goal: p.goal })),
                    artifact: '.simplebeacon/master-engineering-brief.md'
                };
            } catch {
                return null;
            }
        })(),
        ...(!paid ? { upgradeUrl: UPGRADE_URL, upsell: 'Upgrade for full context pack, scan_file, and agent loop.' } : {})
    };
}

function formatContextPackMarkdown(pack) {
    if (!pack || typeof pack !== 'object') return '';
    const p = pack.pipeline || {};
    const lines = [
        '# SimpleBeacon AI context',
        '',
        `- **Project:** \`${pack.projectRoot}\``,
        `- **Task profile:** ${pack.taskProfile?.label || 'hygiene'} (${pack.taskProfile?.id || 'hygiene'})`,
        `- **Gate:** ${pack.gate?.pass === true ? 'PASS' : pack.gate?.pass === false ? 'FAIL' : 'unknown'}`,
        `- **Agent experience:** ${pack.agentExperience}`,
        `- **Updated:** ${pack.generatedAt}`,
        '',
        '## Pipeline metrics',
        '',
        `| Stage | Count |`,
        `|-------|------:|`,
        `| Inventory (repo files) | ${p.inventory ?? '—'} |`,
        `| Rule-scoped analyzed | ${p.ruleScoped ?? '—'} |`,
        `| Files analyzed | ${p.analyzed ?? '—'} |`,
        `| Gate blocking | ${p.blocking ?? '—'} |`,
        p.note ? `\n_${p.note}_\n` : '',
        '',
        '## Next action',
        '',
        pack.session?.nextAction || 'Run scan_project with gate:true',
        '',
        '## Domain guidance',
        '',
        pack.domainGuidance || '',
        '',
        '## Entry points',
        '',
        ...(pack.entryPoints?.paths || []).map((e) => `- \`${e}\``),
        '',
        '## Verify commands',
        '',
        ...(pack.verifyCommands || []).map((c) => `- \`${c}\``),
        '',
        '## Coding rules',
        ''
    ];
    for (const rule of pack.codingRules || []) lines.push(`- ${rule}`);
    lines.push('');
    if ((pack.topIssues || []).length) {
        lines.push('## Top findings');
        lines.push('');
        for (const issue of pack.topIssues) {
            lines.push(`- [${issue.severity}] ${issue.type}${issue.file ? ` @ ${issue.file}` : ''}${issue.description ? `: ${issue.description}` : ''}`);
        }
        lines.push('');
    }
    if (pack.fileReduction) {
        const fr = pack.fileReduction;
        const reclaim = fr.reclaim || {};
        lines.push('## File reduction (cleanup intelligence)');
        lines.push('');
        lines.push(`- **Safe to delete:** ${reclaim.safeToDeleteLabel || '—'}`);
        lines.push(`- **Unused candidates:** ${reclaim.unusedFileCandidates ?? '—'}`);
        lines.push(`- **Report health:** ${fr.reportHealth || 'unknown'}`);
        if ((fr.safeDirectories || []).length) {
            lines.push('- **Phase-1 directories:**');
            for (const dir of fr.safeDirectories) {
                lines.push(`  - \`${dir.path}\` (${dir.bytesLabel})`);
            }
        }
        if (fr.agentPrompt) {
            lines.push('');
            lines.push('**Cleanup agent prompt:**');
            lines.push(fr.agentPrompt);
        }
        lines.push('');
        lines.push('Artifacts: `.simplebeacon/file-reduction-ai-notes.md`, `.simplebeacon/cleanup-ai-notes.json`');
        lines.push('');
    }
    if (pack.codeSuggestions?.top?.length) {
        lines.push('## Simple code suggestions');
        lines.push('');
        lines.push(`- **Quick wins:** ${pack.codeSuggestions.quickWinCount ?? 0}`);
        lines.push(`- **Auto-fixable:** ${pack.codeSuggestions.autoFixCount ?? 0}`);
        lines.push('');
        for (const item of pack.codeSuggestions.top) {
            const loc = item.filePath ? `\`${item.filePath}\`` : '—';
            lines.push(`- **${item.title}** @ ${loc}`);
            lines.push(`  ${item.suggestion}`);
        }
        lines.push('');
        lines.push('Full list: `.simplebeacon/code-suggestions.md`');
        lines.push('');
    }
    if (pack.masterEngineering) {
        const me = pack.masterEngineering;
        lines.push('## Master engineering brief');
        lines.push('');
        lines.push(`- **Overall score:** ${me.overallScore}/100 · **Ship ready:** ${me.shipReady ? 'yes' : 'not yet'}`);
        if ((me.tenCylinders || []).length) {
            lines.push('- **Cylinders needing attention:**');
            for (const c of me.tenCylinders.filter((row) => row.status !== 'strong').slice(0, 4)) {
                lines.push(`  - ${c.label}: ${c.score}/100`);
            }
        }
        if ((me.phasedPlan || []).length) {
            lines.push('- **Phases:**');
            for (const p of me.phasedPlan.slice(0, 4)) {
                lines.push(`  - Phase ${p.phase}: ${p.name}`);
            }
        }
        lines.push('');
        lines.push('Full brief: `.simplebeacon/master-engineering-brief.md`');
        lines.push('');
    }
    if (pack.upsell) {
        lines.push(`_${pack.upsell}_`);
        lines.push('');
    }
    return lines.filter((l) => l !== undefined).join('\n');
}

function writeAiContext(projectRoot, options = {}) {
    const root = path.resolve(projectRoot);
    const pack = buildContextPack(root, options);
    const outPath = path.join(root, '.simplebeacon', 'ai-context.md');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, formatContextPackMarkdown(pack), 'utf8');
    return { path: outPath, pack };
}

function refreshAgentArtifacts(projectRoot, report, options = {}) {
    const root = path.resolve(projectRoot);
    const { writeAgentBrief } = require('./agent-brief');
    const brief = writeAgentBrief(root, report || {}, options);
    const ctx = writeAiContext(root, { ...options, report: report || readReport(root) });
    const frReport = readFileReductionReport(root);
    let fileReductionArtifacts = null;
    if (frReport) {
        const { writeFileReductionArtifacts } = require('./file-reduction-ai-notes');
        fileReductionArtifacts = writeFileReductionArtifacts(root, frReport, options);
    }
    let codeSuggestionsArtifacts = null;
    const activeReport = report || readReport(root);
    if (activeReport) {
        const { writeCodeSuggestionArtifacts } = require('./code-suggestions');
        codeSuggestionsArtifacts = writeCodeSuggestionArtifacts(root, activeReport, options);
    }
    let masterEngineeringArtifacts = null;
    try {
        const { writeMasterEngineeringArtifacts } = require('./master-engineering-brief');
        masterEngineeringArtifacts = writeMasterEngineeringArtifacts(root, {
            ...options,
            gateReport: activeReport?.type === 'simplebeacon-report' ? activeReport : undefined,
            fileReduction: readFileReductionReport(root) || undefined
        });
    } catch {
        /* non-fatal */
    }
    let superchargeArtifacts = null;
    try {
        const { writeAgentSupercharge } = require('./agent-supercharge');
        superchargeArtifacts = writeAgentSupercharge(root, { ...options, report: activeReport });
    } catch {
        /* non-fatal */
    }
    return {
        brief,
        context: ctx,
        fileReduction: fileReductionArtifacts,
        codeSuggestions: codeSuggestionsArtifacts,
        masterEngineering: masterEngineeringArtifacts,
        supercharge: superchargeArtifacts
    };
}

module.exports = {
    DOMAIN_HINTS,
    UNIVERSAL_RULES,
    buildContextPack,
    formatContextPackMarkdown,
    writeAiContext,
    refreshAgentArtifacts,
    readReport
};
