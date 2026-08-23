'use strict';

/**
 * Cross-Project Pattern Learner
 *
 * Reads gate reports, PDA state, and agent behavior from ALL projects
 * that have .simplebeacon/ directories. Extracts universal patterns
 * that apply to ALL programs and ALL AI agents — not just one project.
 *
 * The output is a pattern library that feeds back into:
 *   - gate rules (new rules, tightened rules, narrowed false positives)
 *   - policy templates (default policies that work across projects)
 *   - agent guidance (what works, what doesn't, what to watch for)
 *   - severity calibration (which findings actually matter)
 *
 * Local-first. No upload. Patterns are extracted on-machine.
 */

const fs = require('fs');
const path = require('path');

/**
 * Scan all drives/directories for .simplebeacon/ folders and collect
 * gate reports, configs, and PDA state.
 *
 * @param {string[]} searchRoots — directories to scan recursively
 * @param {object} options — { maxDepth: 6, includeWorktrees: false }
 * @returns {object[]} — array of project records
 */
function collectProjectData(searchRoots, options = {}) {
    const maxDepth = options.maxDepth || 6;
    const includeWorktrees = options.includeWorktrees || false;
    const projects = [];

    for (const root of searchRoots) {
        if (!fs.existsSync(root)) continue;
        _walkForSimpleBeacon(root, 0, maxDepth, projects, includeWorktrees);
    }

    return projects;
}

function _walkForSimpleBeacon(dir, depth, maxDepth, projects, includeWorktrees) {
    if (depth > maxDepth) return;

    const sbDir = path.join(dir, '.simplebeacon');
    if (fs.existsSync(sbDir)) {
        const project = _readProjectData(dir, sbDir);
        if (project) projects.push(project);
    }

    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        if (!includeWorktrees && entry.name.includes('worktrees')) continue;
        if (entry.name.startsWith('.')) continue;

        _walkForSimpleBeacon(
            path.join(dir, entry.name),
            depth + 1,
            maxDepth,
            projects,
            includeWorktrees
        );
    }
}

function _readProjectData(projectRoot, sbDir) {
    const data = {
        projectRoot,
        profile: null,
        gatePass: null,
        blockingCount: null,
        findingCount: 0,
        findingTypes: {},
        findingSeverities: {},
        rulesTriggered: {},
        hasPda: false,
        agentCount: 0,
        taskCount: 0,
        memoryCount: 0,
        policyCount: 0,
        scanDate: null,
    };

    // Read config
    const configPath = path.join(sbDir, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            data.profile = config.profile || null;
        } catch (_e) { /* ignore */ }
    }

    // Read report
    const reportPath = path.join(sbDir, 'report.json');
    if (fs.existsSync(reportPath)) {
        try {
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            data.gatePass = report.gate?.pass ?? null;
            data.blockingCount = report.gate?.blockingCount ?? null;
            data.scanDate = report.timestamp || report.scanDate || null;

            const findings = report.findings || [];
            data.findingCount = findings.length;

            for (const f of findings) {
                // Count by type
                const type = f.type || f.pattern || 'unknown';
                data.findingTypes[type] = (data.findingTypes[type] || 0) + 1;

                // Count by severity
                const sev = f.severity || 'unknown';
                data.findingSeverities[sev] = (data.findingSeverities[sev] || 0) + 1;

                // Track which rule triggered
                const rule = f.rule || f.pattern || type;
                data.rulesTriggered[rule] = (data.rulesTriggered[rule] || 0) + 1;
            }
        } catch (_e) { /* ignore */ }
    }

    // Read PDA state
    const pdaDir = path.join(sbDir, 'agent-pda');
    if (fs.existsSync(pdaDir)) {
        data.hasPda = true;

        const agentsFile = path.join(pdaDir, 'agents.json');
        if (fs.existsSync(agentsFile)) {
            try {
                const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
                data.agentCount = Array.isArray(agents) ? agents.length : (agents.agents?.length || 0);
            } catch (_e) { /* ignore */ }
        }

        const tasksFile = path.join(pdaDir, 'tasks.json');
        if (fs.existsSync(tasksFile)) {
            try {
                const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
                data.taskCount = Array.isArray(tasks) ? tasks.length : (tasks.tasks?.length || 0);
            } catch (_e) { /* ignore */ }
        }

        const memFile = path.join(pdaDir, 'memories.json');
        if (fs.existsSync(memFile)) {
            try {
                const mems = JSON.parse(fs.readFileSync(memFile, 'utf8'));
                data.memoryCount = Array.isArray(mems) ? mems.length : (mems.memories?.length || 0);
            } catch (_e) { /* ignore */ }
        }
    }

    // Read policies
    const policyFile = path.join(pdaDir, 'policies.json');
    if (fs.existsSync(policyFile)) {
        try {
            const policies = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
            data.policyCount = Array.isArray(policies) ? policies.length : (policies.policies?.length || 0);
        } catch (_e) { /* ignore */ }
    }

    return data;
}

/**
 * Extract universal patterns from collected project data.
 *
 * These are patterns that apply to ALL programs, not just one project.
 * Each pattern includes:
 *   - what it is
 *   - which projects it appeared in
 *   - how to detect it
 *   - what rule improvement it suggests
 *
 * @param {object[]} projects — output of collectProjectData()
 * @returns {object} — { patterns, metrics, recommendations }
 */
function extractPatterns(projects) {
    const patterns = [];
    const metrics = {
        totalProjects: projects.length,
        gatePassCount: 0,
        gateFailCount: 0,
        totalFindings: 0,
        totalBlocking: 0,
        totalAgents: 0,
        totalTasks: 0,
        totalMemories: 0,
        projectsByProfile: {},
        topFindingTypes: {},
        topRulesTriggered: {},
    };

    for (const p of projects) {
        if (p.gatePass === true) metrics.gatePassCount++;
        if (p.gatePass === false) metrics.gateFailCount++;
        metrics.totalFindings += p.findingCount;
        metrics.totalBlocking += p.blockingCount || 0;
        metrics.totalAgents += p.agentCount;
        metrics.totalTasks += p.taskCount;
        metrics.totalMemories += p.memoryCount;

        if (p.profile) {
            metrics.projectsByProfile[p.profile] = (metrics.projectsByProfile[p.profile] || 0) + 1;
        }

        for (const [type, count] of Object.entries(p.findingTypes)) {
            metrics.topFindingTypes[type] = (metrics.topFindingTypes[type] || 0) + count;
        }
        for (const [rule, count] of Object.entries(p.rulesTriggered)) {
            metrics.topRulesTriggered[rule] = (metrics.topRulesTriggered[rule] || 0) + count;
        }
    }

    // Pattern 1: Archived/disabled files still blocking the gate
    const blockedByArchive = projects.filter(p =>
        p.gatePass === false &&
        p.blockingCount > 0 &&
        p.findingCount === 0 // blockers come from gate-only rules, not findings
    );
    if (blockedByArchive.length > 0) {
        patterns.push({
            id: 'archived-files-block-gate',
            title: 'Archived/disabled files still block the gate',
            description: 'Files that have been moved to archive folders or renamed with DISABLED_/.bak prefixes still get scanned and block the gate. The files are not active code — they are leftovers from previous fixes.',
            projectsAffected: blockedByArchive.map(p => p.projectRoot),
            occurrences: blockedByArchive.length,
            universalRule: 'Gate scanner should exclude files in archive/, disabled/, .bak, and similar paths by default. Add a .simplebeaconignore pattern for common archive conventions.',
            severityImpact: 'high — causes false gate failures across project types',
        });
    }

    // Pattern 2: Empty stub functions from AI code generation
    const stubProjects = projects.filter(p =>
        p.findingTypes['empty-stub-function'] > 0
    );
    if (stubProjects.length > 0) {
        const totalStubs = stubProjects.reduce((sum, p) => sum + p.findingTypes['empty-stub-function'], 0);
        patterns.push({
            id: 'ai-generated-stub-functions',
            title: 'AI agents leave empty stub functions',
            description: 'AI coding agents generate placeholder functions that return nothing or return hardcoded values. These pass syntax checks but fail at runtime. The pattern appears across web apps, CLI tools, and game mods.',
            projectsAffected: stubProjects.map(p => p.projectRoot),
            occurrences: totalStubs,
            universalRule: 'Gate should flag any function with an empty body or that returns a hardcoded value without processing input. This is language-agnostic — applies to JS, TS, ZScript, Python, Go, etc.',
            severityImpact: 'medium — not a crash, but indicates incomplete implementation',
        });
    }

    // Pattern 3: Duplicate basenames across project structure
    const dupProjects = projects.filter(p =>
        p.findingTypes['duplicate-basename'] > 0
    );
    if (dupProjects.length > 0) {
        patterns.push({
            id: 'duplicate-basenames',
            title: 'Files with same basename in different directories',
            description: 'Multiple files with the same basename exist in different directories. This causes import confusion, build conflicts, and makes it hard for AI agents to know which file to edit.',
            projectsAffected: dupProjects.map(p => p.projectRoot),
            occurrences: dupProjects.reduce((sum, p) => sum + p.findingTypes['duplicate-basename'], 0),
            universalRule: 'Gate should warn when two files in the same project have the same basename but different paths. AI agents should be warned before editing to confirm they have the right file.',
            severityImpact: 'low — warning, but prevents agent confusion',
        });
    }

    // Pattern 4: Backup/fixture files in scan path
    const backupProjects = projects.filter(p =>
        p.findingTypes['backup-or-fixture'] > 0
    );
    if (backupProjects.length > 0) {
        patterns.push({
            id: 'backup-files-in-scan-path',
            title: 'Backup and fixture files detected in scan path',
            description: 'Files with .bak, .old, .backup, or fixture/ in the path are being scanned as if they are production code. These inflate finding counts and can block the gate with issues that do not affect runtime.',
            projectsAffected: backupProjects.map(p => p.projectRoot),
            occurrences: backupProjects.reduce((sum, p) => sum + p.findingTypes['backup-or-fixture'], 0),
            universalRule: 'Add .bak, .old, .backup, fixture/, fixtures/, test-fixtures/ to default .simplebeaconignore. Gate should skip these by default.',
            severityImpact: 'low — noise reduction, prevents false blockers',
        });
    }

    // Pattern 5: License header issues
    const licenseProjects = projects.filter(p =>
        p.findingTypes['licensed-under'] > 0
    );
    if (licenseProjects.length > 0) {
        patterns.push({
            id: 'license-header-issues',
            title: 'License header patterns triggering false positives',
            description: 'The "licensed-under" rule fires on standard license text in source files. This is the highest-volume finding type across projects, suggesting the rule is too broad.',
            projectsAffected: licenseProjects.map(p => p.projectRoot),
            occurrences: licenseProjects.reduce((sum, p) => sum + p.findingTypes['licensed-under'], 0),
            universalRule: 'Narrow the licensed-under rule to only flag files that claim a different license than the project LICENSE file. Standard MIT/Apache/GPL headers should be allowlisted when they match the project license.',
            severityImpact: 'low — noise reduction, 85+ false positives in one project',
        });
    }

    // Pattern 6: Gate pass rate by profile
    const profilePassRates = {};
    for (const profile of Object.keys(metrics.projectsByProfile)) {
        const profileProjects = projects.filter(p => p.profile === profile);
        const passed = profileProjects.filter(p => p.gatePass === true).length;
        const failed = profileProjects.filter(p => p.gatePass === false).length;
        profilePassRates[profile] = {
            total: profileProjects.length,
            passed,
            failed,
            passRate: profileProjects.length > 0 ? (passed / (passed + failed) * 100).toFixed(1) + '%' : 'N/A',
        };
    }
    if (Object.keys(profilePassRates).length > 0) {
        patterns.push({
            id: 'gate-pass-rate-by-profile',
            title: 'Gate pass rate varies by project profile',
            description: 'Different project profiles (gamedev, eu-ai-act, complete, minimal) have different gate pass rates. This indicates that some profiles have rules that are too strict or too loose for their target project type.',
            data: profilePassRates,
            universalRule: 'Review profiles with low pass rates — rules may need narrowing. Review profiles with 100% pass rates — rules may be too loose.',
            severityImpact: 'informational — guides profile tuning',
        });
    }

    // Pattern 7: PDA adoption
    const pdaProjects = projects.filter(p => p.hasPda);
    if (pdaProjects.length > 0 || projects.length > 0) {
        patterns.push({
            id: 'pda-adoption-rate',
            title: 'PDA adoption across projects',
            description: 'How many projects have actually initialized PDA state (agents, tasks, memories). Low adoption means agents are not using the PDA even when the MCP server is available.',
            data: {
                totalProjects: projects.length,
                pdaEnabled: pdaProjects.length,
                adoptionRate: projects.length > 0 ? (pdaProjects.length / projects.length * 100).toFixed(1) + '%' : '0%',
                totalAgents: metrics.totalAgents,
                totalTasks: metrics.totalTasks,
                totalMemories: metrics.totalMemories,
            },
            universalRule: 'If adoption is low, the MCP server may not be wired to all agents. If adoption is high but task/memory counts are low, agents have the tools but are not using them.',
            severityImpact: 'informational — guides MCP config outreach',
        });
    }

    // Generate recommendations
    const recommendations = _generateRecommendations(patterns, metrics);

    return { patterns, metrics, recommendations };
}

function _generateRecommendations(patterns, _metrics) {
    const recs = [];

    // Gate rule recommendations
    for (const p of patterns) {
        if (p.universalRule && p.severityImpact?.startsWith('high')) {
            recs.push({
                priority: 'high',
                category: 'gate-rule',
                pattern: p.id,
                action: p.universalRule,
                reason: `${p.occurrences} occurrences across ${p.projectsAffected.length} projects`,
            });
        }
    }

    // Noise reduction recommendations
    for (const p of patterns) {
        if (p.severityImpact?.startsWith('low') && p.occurrences > 10) {
            recs.push({
                priority: 'medium',
                category: 'noise-reduction',
                pattern: p.id,
                action: p.universalRule,
                reason: `${p.occurrences} findings — high volume noise`,
            });
        }
    }

    // Profile tuning recommendations
    const profilePattern = patterns.find(p => p.id === 'gate-pass-rate-by-profile');
    if (profilePattern) {
        for (const [profile, data] of Object.entries(profilePattern.data)) {
            if (data.passRate === '0.0%' || (data.failed > 0 && data.passed === 0)) {
                recs.push({
                    priority: 'high',
                    category: 'profile-tuning',
                    pattern: 'gate-pass-rate-by-profile',
                    action: `Profile "${profile}" has 0% pass rate — review rules for this profile type`,
                    reason: `${data.failed} of ${data.total} projects failing`,
                });
            }
        }
    }

    // PDA adoption recommendations
    const pdaPattern = patterns.find(p => p.id === 'pda-adoption-rate');
    if (pdaPattern && pdaPattern.data.adoptionRate !== '100.0%') {
        recs.push({
            priority: 'medium',
            category: 'pda-adoption',
            pattern: 'pda-adoption-rate',
            action: 'Wire MCP config to more agents and run init --starter in projects without PDA state',
            reason: `Only ${pdaPattern.data.adoptionRate} of projects have PDA state`,
        });
    }

    return recs.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
    });
}

/**
 * Generate a human-readable cross-project learning report.
 *
 * @param {object} analysis — output of extractPatterns()
 * @returns {string} — markdown report
 */
function generateReport(analysis) {
    const { patterns, metrics, recommendations } = analysis;
    const lines = [];

    lines.push('# Cross-Project Pattern Learning Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Projects analyzed:** ${metrics.totalProjects}`);
    lines.push('');

    lines.push('## Summary Metrics');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Projects analyzed | ${metrics.totalProjects} |`);
    lines.push(`| Gate passing | ${metrics.gatePassCount} |`);
    lines.push(`| Gate failing | ${metrics.gateFailCount} |`);
    lines.push(`| Total findings | ${metrics.totalFindings} |`);
    lines.push(`| Total blocking | ${metrics.totalBlocking} |`);
    lines.push(`| PDA agents | ${metrics.totalAgents} |`);
    lines.push(`| PDA tasks | ${metrics.totalTasks} |`);
    lines.push(`| PDA memories | ${metrics.totalMemories} |`);
    lines.push('');

    lines.push('### Projects by profile');
    lines.push('');
    for (const [profile, count] of Object.entries(metrics.projectsByProfile)) {
        lines.push(`- ${profile}: ${count}`);
    }
    lines.push('');

    lines.push('### Top finding types (across all projects)');
    lines.push('');
    const sortedTypes = Object.entries(metrics.topFindingTypes).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedTypes.slice(0, 10)) {
        lines.push(`- ${type}: ${count}`);
    }
    lines.push('');

    lines.push('## Universal Patterns Detected');
    lines.push('');
    for (const p of patterns) {
        lines.push(`### ${p.title}`);
        lines.push('');
        lines.push(`**Pattern ID:** ${p.id}`);
        lines.push(`**Occurrences:** ${p.occurrences || 'N/A'}`);
        lines.push(`**Severity impact:** ${p.severityImpact || 'N/A'}`);
        lines.push('');
        lines.push(p.description);
        lines.push('');
        if (p.projectsAffected) {
            lines.push('**Projects affected:**');
            for (const proj of p.projectsAffected.slice(0, 5)) {
                lines.push(`- ${proj}`);
            }
            if (p.projectsAffected.length > 5) {
                lines.push(`- ... and ${p.projectsAffected.length - 5} more`);
            }
            lines.push('');
        }
        if (p.data) {
            lines.push('**Data:**');
            lines.push('```json');
            lines.push(JSON.stringify(p.data, null, 2));
            lines.push('```');
            lines.push('');
        }
        lines.push(`**Universal rule:** ${p.universalRule}`);
        lines.push('');
    }

    lines.push('## Recommendations');
    lines.push('');
    for (const r of recommendations) {
        lines.push(`- **[${r.priority.toUpperCase()}]** [${r.category}] ${r.action}`);
        lines.push(`  - Reason: ${r.reason}`);
        lines.push('');
    }

    lines.push('## How This Feeds Back');
    lines.push('');
    lines.push('1. **Gate rules** — patterns with high severity impact become new rules or tightened rules');
    lines.push('2. **Noise reduction** — patterns with high volume but low severity get narrowed or excluded');
    lines.push('3. **Profile tuning** — profiles with low pass rates get their rules reviewed');
    lines.push('4. **PDA adoption** — projects without PDA state get MCP config and init');
    lines.push('5. **Agent guidance** — patterns become part of the agent briefing in supercharge_agent');
    lines.push('');
    lines.push('Each round of analysis makes the gate smarter for ALL projects, not just one.');

    return lines.join('\n');
}

module.exports = {
    collectProjectData,
    extractPatterns,
    generateReport,
};
