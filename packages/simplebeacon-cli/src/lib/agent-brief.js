/**
 * Tier-aware agent brief markdown for .simplebeacon/agent-brief.md
 */

const { UPGRADE_URL } = require('./agent-tier-capabilities');
const { buildNextAction, readAgentSession } = require('./agent-session');

function pickIssues(report) {
    if (!report || typeof report !== 'object') return [];
    const raw = report.detectedIssues || report.rawIssues || report.findings || report.issues || [];
    return Array.isArray(raw) ? raw : [];
}

function buildPipelineMetrics(report) {
    if (!report || typeof report !== 'object') {
        return {
            inventory: null,
            ruleScoped: null,
            analyzed: null,
            blocking: null,
            note: 'No scan report — run scan_project or npx simplebeacon scan --gate'
        };
    }
    const gate = report.gate || {};
    const inventory = report.repositoryFilesTotal
        ?? report.repositoryInventory?.totalFiles
        ?? report.totalFiles
        ?? null;
    const ruleScoped = report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? null;
    return {
        inventory,
        ruleScoped,
        analyzed: report.filesAnalyzed ?? ruleScoped,
        blocking: gate.blockingCount ?? null,
        gatePass: gate.pass ?? null,
        qualityScore: report.qualityScore ?? null,
        note: inventory != null && ruleScoped != null && inventory > ruleScoped
            ? 'ruleScoped < inventory is normal — gate scans production/rule paths only'
            : null
    };
}

function formatAgentBrief(report, options = {}) {
    const paid = options.paid === true;
    const projectRoot = options.projectRoot || report?.projectRoot || 'unknown';
    const data = report && typeof report === 'object' ? report : {};
    const gate = data.gate || {};
    const pass = gate.pass === true;
    const score = data.qualityScore ?? data.summary?.qualityScore ?? 'N/A';
    const issues = pickIssues(data);
    const blocking = issues.filter((i) => {
        const sev = String(i.severity || i.sev || '').toLowerCase();
        return sev === 'critical' || sev === 'high' || i.blocking === true;
    });

    if (!paid) {
        const top = (blocking.length ? blocking : issues).slice(0, 1);
        const lines = [
            '# SimpleBeacon agent brief (free preview)',
            '',
            `- **Gate:** ${pass ? 'PASS' : 'FAIL'}`,
            `- **Quality score:** hidden on free tier`,
            `- **Issues detected:** ${issues.length}${blocking.length ? ` (${blocking.length} blocking/high)` : ''}`,
            '',
            'Free tier gives agents a **2/10** experience — enough to know slop exists, not enough to fix it safely.',
            '',
            '**Upgrade for 11/10 agent loop:** propose_fix, verify_fix, scan_staged, agent_status, full pattern IDs, Cursor pre-apply enforcement.',
            '',
            `- Upgrade: ${UPGRADE_URL}`,
            ''
        ];
        if (top.length > 0) {
            const issue = top[0];
            lines.push('## Sample finding (details redacted)');
            lines.push('');
            lines.push(`- [${issue.severity || 'high'}] ${issue.type || issue.pattern || 'issue'} — upgrade to see file, line, and fix steps.`);
            lines.push('');
        }
        return lines.join('\n');
    }

    const pipeline = buildPipelineMetrics(data);
    const session = typeof projectRoot === 'string' && projectRoot !== 'unknown'
        ? readAgentSession(projectRoot)
        : { openFindings: [], lastGatePass: pass };
    const top = (blocking.length ? blocking : issues).slice(0, 12);
    const lines = [
        '# SimpleBeacon agent brief',
        '',
        `- **Project:** ${projectRoot}`,
        `- **Gate:** ${pass ? 'PASS' : 'FAIL'}`,
        `- **Quality score:** ${score}`,
        `- **Issues:** ${issues.length}`,
        `- **Blocking / high:** ${blocking.length}`,
        `- **Open this session:** ${(session.openFindings || []).length}`,
        `- **Updated:** ${new Date().toISOString()}`,
        '',
        '## Pipeline',
        '',
        `- **Inventory:** ${pipeline.inventory ?? '—'} files`,
        `- **Rule-scoped / analyzed:** ${pipeline.ruleScoped ?? pipeline.analyzed ?? '—'}`,
        `- **Gate blocking:** ${pipeline.blocking ?? blocking.length}`,
        ...(pipeline.note ? [`- _${pipeline.note}_`] : []),
        '',
        `**Next action:** ${buildNextAction(session, { gatePass: pass })}`,
        '',
        'Paid agent loop: `scan_snippet` → `propose_fix` → apply → `verify_fix` → `agent_status`. Pre-PR: `scan_staged` → `gate_status`.',
        ''
    ];
    if (top.length > 0) {
        lines.push('## Top findings');
        lines.push('');
        for (const issue of top) {
            const sev = issue.severity || issue.sev || 'low';
            const type = issue.type || issue.pattern || issue.category || 'issue';
            const desc = String(issue.description || issue.message || issue.title || '').slice(0, 180);
            const file = issue.file || issue.path || issue.filePath || '';
            const pattern = issue.pattern || issue.rule || '';
            lines.push(`- [${sev}] ${type}${pattern ? ` (${pattern})` : ''}${file ? ` @ ${file}` : ''}${desc ? `: ${desc}` : ''}`);
        }
        lines.push('');
    } else {
        lines.push('_No findings in the latest report._');
        lines.push('');
    }
    lines.push('Remediate gate-blocking issues before claiming the workspace is clean.');

    const codeSection = buildCodeSuggestionsBriefSection(data, paid);
    if (codeSection) {
        lines.push('');
        lines.push(codeSection);
    }

    const fileReductionSection = buildFileReductionBriefSection(options.projectRoot || projectRoot);
    if (fileReductionSection) {
        lines.push('');
        lines.push(fileReductionSection);
    }

    lines.push('');
    lines.push('**Master plan:** `.simplebeacon/master-engineering-brief.md` — ten cylinders, phased plan, yes-you-can playbooks.');

    return lines.join('\n');
}

function buildCodeSuggestionsBriefSection(report, paid) {
    const payload = report?.codeSuggestions;
    if (!payload || !(payload.suggestions || []).length) return '';
    const items = paid ? payload.suggestions.slice(0, 8) : payload.quickWins.slice(0, 2);
    if (!items.length) return '';
    const lines = [
        '## Simple code suggestions',
        '',
        `- **Quick wins:** ${payload.quickWinCount ?? 0} · **Auto-fixable:** ${payload.autoFixCount ?? 0}`,
        ''
    ];
    for (const item of items) {
        const loc = item.filePath ? `\`${item.filePath}\`` : '—';
        lines.push(`- [${item.severity}] **${item.title}** @ ${loc}`);
        if (paid) {
            lines.push(`  ${item.suggestion}`);
            if (item.autoFixable && item.patternId) {
                lines.push(`  → \`propose_fix\` pattern \`${item.patternId}\``);
            }
        } else {
            lines.push('  Upgrade for full suggestion text and code hints.');
        }
    }
    lines.push('');
    lines.push('Full list: `.simplebeacon/code-suggestions.md`');
    return lines.join('\n');
}

function buildFileReductionBriefSection(projectRoot) {
    if (!projectRoot || typeof projectRoot !== 'string') return '';
    try {
        const { readCleanupAiNotes } = require('./file-reduction-ai-notes');
        const notes = readCleanupAiNotes(projectRoot);
        if (!notes) return '';
        const r = notes.reclaim || {};
        const lines = [
            '## File reduction (for cleanup agents)',
            '',
            `- **Safe to delete:** ${r.safeToDeleteLabel || '—'}`,
            `- **Unused candidates:** ${r.unusedFileCandidates ?? '—'}`,
            `- **Report health:** ${notes.reportHealth || 'unknown'}`
        ];
        if ((notes.safeDirectories || []).length) {
            lines.push('- **Top safe dirs:**');
            for (const dir of notes.safeDirectories.slice(0, 5)) {
                lines.push(`  - \`${dir.path}\` (${dir.bytesLabel})`);
            }
        }
        if (notes.cleanupBrief?.agentPrompt) {
            lines.push('');
            lines.push('**Cleanup prompt:**');
            lines.push(notes.cleanupBrief.agentPrompt.slice(0, 280));
        }
        lines.push('');
        lines.push('Full notes: `.simplebeacon/file-reduction-ai-notes.md`');
        return lines.join('\n');
    } catch {
        return '';
    }
}

function writeAgentBrief(projectRoot, report, options = {}) {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(projectRoot);
    const briefPath = path.join(root, '.simplebeacon', 'agent-brief.md');
    const markdown = formatAgentBrief(report, { ...options, projectRoot: root });
    fs.mkdirSync(path.dirname(briefPath), { recursive: true });
    fs.writeFileSync(briefPath, markdown, 'utf8');
    return { path: briefPath, markdown };
}

module.exports = {
    formatAgentBrief,
    writeAgentBrief,
    pickIssues,
    buildPipelineMetrics
};
