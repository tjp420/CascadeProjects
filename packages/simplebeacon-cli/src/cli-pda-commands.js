'use strict';

/**
 * CLI PDA command handlers — agent, task, policy, gate finalize, handoff.
 * Loaded lazily by bin/simplebeacon.js to keep the main bundle small.
 */

const pda = require('../src/agent-pda');

function getProjectRoot(options) {
    return options.projectRoot || options._projectRoot || process.cwd();
}

function printJson(data) {
    console.log(JSON.stringify(data, null, 2));
}

function _printTable(items, columns) {
    if (!items || items.length === 0) {
        console.log('  (none)');
        return;
    }
    for (const item of items) {
        for (const col of columns) {
            const val = item[col.key];
            if (val !== undefined && val !== null) {
                console.log(`  ${col.label}: ${val}`);
            }
        }
        console.log('');
    }
}

// ─── Agent commands ───

function runAgentCommand(options) {
    const sub = options._subcommand || options._args?.[0] || 'list';
    const root = getProjectRoot(options);

    switch (sub) {
        case 'register': {
            const agent = pda.registerAgent(root, options.name || 'unknown', options.type || 'custom');
            printJson({ success: true, agent });
            return 0;
        }
        case 'list': {
            const agents = pda.listAgents(root);
            printJson({ success: true, agents, count: agents.length });
            return 0;
        }
        case 'detect': {
            const identity = pda.getAgentIdentity();
            printJson({ success: true, identity });
            return 0;
        }
        default:
            console.error('Usage: simplebeacon agent [register|list|detect] [--name <name>] [--type <type>]');
            return 2;
    }
}

// ─── Task commands ───

function runTaskCommand(options) {
    const sub = options._subcommand || options._args?.[0] || 'list';
    const root = getProjectRoot(options);

    switch (sub) {
        case 'add':
        case 'create': {
            const agentId = options.agentId || pda.autoRegister(root).id;
            const task = pda.createTask(root, agentId, options.title || options._args?.[1] || 'Untitled', {
                description: options.description,
                priority: options.priority,
                approvalRequired: options.approvalRequired
            });
            printJson({ success: true, task });
            return 0;
        }
        case 'list': {
            const tasks = pda.listTasks(root, options.agentId, options.status);
            printJson({ success: true, tasks, count: tasks.length });
            return 0;
        }
        case 'update': {
            const taskId = options.taskId || options._args?.[1];
            if (!taskId) { console.error('Task ID required'); return 2; }
            const task = pda.updateTask(root, taskId, {
                title: options.title,
                description: options.description,
                status: options.status,
                priority: options.priority,
                blockReason: options.blockReason
            });
            if (!task) { console.error('Task not found'); return 1; }
            printJson({ success: true, task });
            return 0;
        }
        case 'complete': {
            const taskId = options.taskId || options._args?.[1];
            if (!taskId) { console.error('Task ID required'); return 2; }
            const task = pda.completeTask(root, taskId);
            if (!task) { console.error('Task not found'); return 1; }
            printJson({ success: true, task });
            return 0;
        }
        case 'block': {
            const taskId = options.taskId || options._args?.[1];
            if (!taskId) { console.error('Task ID required'); return 2; }
            const task = pda.blockTask(root, taskId, options.reason || 'blocked');
            if (!task) { console.error('Task not found'); return 1; }
            printJson({ success: true, task });
            return 0;
        }
        case 'approvals': {
            const approvals = pda.getPendingApprovals(root);
            printJson({ success: true, approvals, count: approvals.length });
            return 0;
        }
        default:
            console.error('Usage: simplebeacon task [add|list|update|complete|block|approvals]');
            return 2;
    }
}

// ─── Policy commands ───

function runPolicyCommand(options) {
    const sub = options._subcommand || options._args?.[0] || 'list';
    const root = getProjectRoot(options);

    switch (sub) {
        case 'list': {
            const { policies, source } = pda.listPolicies(root);
            printJson({ success: true, policies, source, count: policies.length });
            return 0;
        }
        case 'check': {
            const action = options.action || options._args?.[1];
            if (!action) { console.error('Action required'); return 2; }
            const result = pda.checkAction(root, action, {});
            printJson({ success: true, action, ...result });
            return result.allowed ? 0 : 1;
        }
        case 'add': {
            const type = options.type || options._args?.[1];
            const action = options.action || options._args?.[2];
            if (!type || !action) { console.error('Type and action required'); return 2; }
            const policy = pda.addPolicy(root, {
                type,
                action,
                description: options.description || '',
                severity: options.severity || 'block',
                enabled: true
            });
            printJson({ success: true, policy });
            return 0;
        }
        case 'remove': {
            const policyId = options.policyId || options._args?.[1];
            if (!policyId) { console.error('Policy ID required'); return 2; }
            const deleted = pda.removePolicy(root, policyId);
            printJson({ success: deleted });
            return 0;
        }
        case 'init': {
            const result = pda.initPolicies(root, options.force);
            printJson({ success: true, ...result });
            return 0;
        }
        default:
            console.error('Usage: simplebeacon policy [list|check|add|remove|init]');
            return 2;
    }
}

// ─── Gate finalize command ───

function runGateFinalizeCommand(options) {
    const root = getProjectRoot(options);
    const agentId = options.agentId || pda.autoRegister(root).id;

    console.log('Running self-gating check...');
    const result = pda.canFinalize(root, agentId, {
        runScan: options.noScan !== true,
        useExistingReport: options.useExistingReport === true,
        action: 'finalize-changes'
    });

    // Print a compact summary instead of the full result (which may contain
    // a 10k-line gate report). Only show the decision-relevant fields.
    const summary = {
        canFinalize: result.canFinalize,
        blockingCount: result.blockingCount,
        violations: result.violations,
        warnings: result.warnings,
        approvalsNeeded: result.approvalsNeeded,
        gateSummary: result.gateResult ? {
            pass: result.gateResult.pass,
            blockingCount: result.gateResult.blockingCount,
            qualityScore: result.gateResult.qualityScore,
            error: result.gateResult.error || undefined
        } : null,
        agentId: result.agentId
    };
    printJson(summary);

    if (result.canFinalize) {
        console.log('\n✓ Gate PASSED — work can be finalized');
        return 0;
    } else {
        console.error(`\n✗ Gate FAILED — ${result.blockingCount} blocking issue(s)`);
        if (result.violations.length > 0) {
            console.error('  Violations:');
            for (const v of result.violations) {
                console.error(`    - [${v.policyId}] ${v.description}`);
            }
        }
        if (result.approvalsNeeded.length > 0) {
            console.error('  Approvals needed:');
            for (const a of result.approvalsNeeded) {
                console.error(`    - [${a.policyId}] ${a.description}`);
            }
        }
        if (result.gateResult && !result.gateResult.pass) {
            console.error(`  Gate scan: ${result.gateResult.blockingCount} blocking findings`);
        }
        return 1;
    }
}

// ─── Handoff commands ───

function runHandoffCommand(options) {
    const sub = options._subcommand || options._args?.[0] || 'read';
    const root = getProjectRoot(options);

    switch (sub) {
        case 'write': {
            const agentId = options.agentId || pda.autoRegister(root).id;
            const brief = {
                summary: options.summary || '',
                completedTasks: [],
                pendingTasks: [],
                notes: options.notes || '',
                filesChanged: [],
                writtenAt: Date.now(),
                fromAgent: agentId
            };
            const memory = pda.remember(root, agentId, 'handoff-brief', JSON.stringify(brief), 'handoff');
            printJson({ success: true, brief, memoryId: memory.id });
            console.log('\nHandoff brief written. Next agent can read it with: simplebeacon handoff read');
            return 0;
        }
        case 'read': {
            const agents = pda.listAgents(root);
            let latest = null;
            for (const agent of agents) {
                const mem = pda.recallLatest(root, agent.id, 'handoff-brief', 'handoff');
                if (mem && (!latest || mem.updatedAt > latest.updatedAt)) {
                    latest = mem;
                }
            }
            if (!latest) {
                console.log('No handoff brief found.');
                return 0;
            }
            try {
                const brief = JSON.parse(latest.value);
                printJson({ success: true, handoff: brief });
                if (brief.summary) console.log(`\nSummary: ${brief.summary}`);
                if (brief.notes) console.log(`Notes: ${brief.notes}`);
            } catch {
                printJson({ success: true, raw: latest.value });
            }
            return 0;
        }
        default:
            console.error('Usage: simplebeacon handoff [write|read]');
            return 2;
    }
}

module.exports = {
    runAgentCommand,
    runTaskCommand,
    runPolicyCommand,
    runGateFinalizeCommand,
    runHandoffCommand
};

// ─── Cross-Project Learning ───

function runLearnCommand(options) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const defaultRoots = [
        path.join(os.homedir(), 'CascadeProjects'),
        os.homedir(),
        'E:\\Ai',
    ].filter(p => { try { return fs.existsSync(p); } catch { return false; } });

    const roots = options.roots
        ? options.roots.split(',').map(s => s.trim()).filter(Boolean)
        : defaultRoots;
    const maxDepth = parseInt(options.depth || '5', 10);
    const format = options.format || 'json';
    const outputPath = options.output || null;

    const projects = pda.collectProjectData(roots, { maxDepth, includeWorktrees: false });
    const analysis = pda.extractPatterns(projects);

    if (format === 'markdown') {
        const report = pda.generateLearningReport(analysis);
        if (outputPath) {
            fs.writeFileSync(outputPath, report);
            console.log(`Report written to ${outputPath}`);
        } else {
            console.log(report);
        }
        return 0;
    }

    // JSON output
    const result = {
        success: true,
        projectsAnalyzed: analysis.metrics.totalProjects,
        gatePassCount: analysis.metrics.gatePassCount,
        gateFailCount: analysis.metrics.gateFailCount,
        totalFindings: analysis.metrics.totalFindings,
        totalBlocking: analysis.metrics.totalBlocking,
        patterns: analysis.patterns,
        recommendations: analysis.recommendations,
        metrics: analysis.metrics,
    };

    if (outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`Report written to ${outputPath}`);
    } else {
        printJson(result);
    }
    return 0;
}

module.exports.runLearnCommand = runLearnCommand;
