'use strict';

/**
 * Agent PDA engine tests — memory, tasks, policies, gate bridge, agent registry.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const pda = require('../src/agent-pda');

let dirCounter = 0;
function makeTmpDir() {
    const id = crypto.randomBytes(8).toString('hex') + '-' + (dirCounter++);
    const dir = path.join(os.tmpdir(), 'sb-pda-test-' + id);
    fs.mkdirSync(dir + '/.simplebeacon/agent-pda', { recursive: true });
    return dir;
}

function cleanup(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── Agent Registry Tests ───

test('Agent registry: register and list agents', () => {
    const dir = makeTmpDir();
    try {
        const agent1 = pda.registerAgent(dir, 'TestAgent1', 'cursor');
        const agent2 = pda.registerAgent(dir, 'TestAgent2', 'claude');
        assert.ok(agent1.id.startsWith('agent_'));
        assert.ok(agent2.id.startsWith('agent_'));
        assert.notStrictEqual(agent1.id, agent2.id);

        const agents = pda.listAgents(dir);
        assert.strictEqual(agents.length, 2);
    } finally { cleanup(dir); }
});

test('Agent registry: duplicate register returns same agent', () => {
    const dir = makeTmpDir();
    try {
        const a1 = pda.registerAgent(dir, 'Dup', 'cursor');
        const a2 = pda.registerAgent(dir, 'Dup', 'cursor');
        assert.strictEqual(a1.id, a2.id);
        assert.strictEqual(pda.listAgents(dir).length, 1);
    } finally { cleanup(dir); }
});

test('Agent registry: remove agent', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'ToRemove', 'custom');
        assert.ok(pda.removeAgent(dir, agent.id));
        assert.strictEqual(pda.listAgents(dir).length, 0);
    } finally { cleanup(dir); }
});

// ─── Memory Store Tests ───

test('Memory store: remember and recall', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'MemAgent', 'cursor');
        const mem = pda.remember(dir, agent.id, 'test-key', 'test-value', 'fact');
        assert.ok(mem.id.startsWith('mem_'));
        assert.strictEqual(mem.key, 'test-key');
        assert.strictEqual(mem.value, 'test-value');
        assert.strictEqual(mem.category, 'fact');

        const recalled = pda.recall(dir, agent.id, 'test-key');
        assert.strictEqual(recalled.length, 1);
        assert.strictEqual(recalled[0].value, 'test-value');
    } finally { cleanup(dir); }
});

test('Memory store: upsert by key+category', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'UpsertAgent', 'cursor');
        pda.remember(dir, agent.id, 'key1', 'value1', 'fact');
        pda.remember(dir, agent.id, 'key1', 'value2', 'fact');
        const recalled = pda.recall(dir, agent.id, 'key1');
        assert.strictEqual(recalled.length, 1);
        assert.strictEqual(recalled[0].value, 'value2');
    } finally { cleanup(dir); }
});

test('Memory store: same key different category = separate memories', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'CatAgent', 'cursor');
        pda.remember(dir, agent.id, 'key1', 'factval', 'fact');
        pda.remember(dir, agent.id, 'key1', 'decval', 'decision');
        const recalled = pda.recall(dir, agent.id, 'key1');
        assert.strictEqual(recalled.length, 2);
    } finally { cleanup(dir); }
});

test('Memory store: forget', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'ForgetAgent', 'cursor');
        pda.remember(dir, agent.id, 'key1', 'val1', 'fact');
        assert.ok(pda.forget(dir, agent.id, 'key1'));
        assert.strictEqual(pda.recall(dir, agent.id, 'key1').length, 0);
    } finally { cleanup(dir); }
});

test('Memory store: TTL expiry', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'TtlAgent', 'cursor');
        // ttlSeconds: -1 means it expired 1 second ago
        pda.remember(dir, agent.id, 'temp', 'val', 'context', { ttlSeconds: -1 });
        const recalled = pda.recall(dir, agent.id, 'temp');
        assert.strictEqual(recalled.length, 0);
    } finally { cleanup(dir); }
});

test('Memory store: list by category', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'ListAgent', 'cursor');
        pda.remember(dir, agent.id, 'k1', 'v1', 'fact');
        pda.remember(dir, agent.id, 'k2', 'v2', 'decision');
        pda.remember(dir, agent.id, 'k3', 'v3', 'fact');
        const grouped = pda.listMemoriesByCategory(dir, agent.id);
        assert.strictEqual(grouped.fact.length, 2);
        assert.strictEqual(grouped.decision.length, 1);
    } finally { cleanup(dir); }
});

// ─── Task Store Tests ───

test('Task store: create and list', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'TaskAgent', 'cursor');
        const task = pda.createTask(dir, agent.id, 'Test task', { priority: 'high' });
        assert.strictEqual(task.status, 'pending');
        assert.strictEqual(task.priority, 'high');

        const tasks = pda.listTasks(dir, agent.id);
        assert.strictEqual(tasks.length, 1);
        assert.strictEqual(tasks[0].title, 'Test task');
    } finally { cleanup(dir); }
});

test('Task store: complete task', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'CompleteAgent', 'cursor');
        const task = pda.createTask(dir, agent.id, 'To complete');
        const completed = pda.completeTask(dir, task.id);
        assert.strictEqual(completed.status, 'completed');
        assert.ok(completed.completedAt);
    } finally { cleanup(dir); }
});

test('Task store: block task with reason', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'BlockAgent', 'cursor');
        const task = pda.createTask(dir, agent.id, 'Blocked task');
        const blocked = pda.blockTask(dir, task.id, 'waiting on deps');
        assert.strictEqual(blocked.status, 'blocked');
        assert.strictEqual(blocked.blockReason, 'waiting on deps');
    } finally { cleanup(dir); }
});

test('Task store: approve task', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'ApproveAgent', 'cursor');
        const task = pda.createTask(dir, agent.id, 'Needs approval', { approvalRequired: true });
        const approvals = pda.getPendingApprovals(dir);
        assert.strictEqual(approvals.length, 1);

        const approved = pda.approveTask(dir, task.id, 'human@example.com');
        assert.strictEqual(approved.approvedBy, 'human@example.com');
        assert.ok(approved.approvedAt);

        assert.strictEqual(pda.getPendingApprovals(dir).length, 0);
    } finally { cleanup(dir); }
});

test('Task store: invalid status throws', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'InvalidAgent', 'cursor');
        const task = pda.createTask(dir, agent.id, 'Test');
        assert.throws(() => pda.updateTask(dir, task.id, { status: 'invalid' }));
    } finally { cleanup(dir); }
});

test('Task store: list sorted by status priority', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'SortAgent', 'cursor');
        const t1 = pda.createTask(dir, agent.id, 'pending1');
        const t2 = pda.createTask(dir, agent.id, 'inprogress1');
        pda.updateTask(dir, t2.id, { status: 'in_progress' });
        const t3 = pda.createTask(dir, agent.id, 'completed1');
        pda.completeTask(dir, t3.id);

        const tasks = pda.listTasks(dir, agent.id);
        assert.strictEqual(tasks[0].status, 'in_progress');
        assert.strictEqual(tasks[1].status, 'pending');
        assert.strictEqual(tasks[2].status, 'completed');
    } finally { cleanup(dir); }
});

// ─── Policy Engine Tests ───

test('Policy engine: default policies block force-push', () => {
    const dir = makeTmpDir();
    try {
        const result = pda.checkAction(dir, 'force-push');
        assert.strictEqual(result.allowed, false);
        assert.ok(result.violations.length > 0);
        assert.strictEqual(result.violations[0].policyId, 'default-no-force-push');
    } finally { cleanup(dir); }
});

test('Policy engine: default policies block commit-secrets', () => {
    const dir = makeTmpDir();
    try {
        const result = pda.checkAction(dir, 'commit-secrets');
        assert.strictEqual(result.allowed, false);
        assert.ok(result.violations.length > 0);
    } finally { cleanup(dir); }
});

test('Policy engine: allowed action returns allowed=true', () => {
    const dir = makeTmpDir();
    try {
        const result = pda.checkAction(dir, 'write-code');
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.violations.length, 0);
    } finally { cleanup(dir); }
});

test('Policy engine: init policies creates file', () => {
    const dir = makeTmpDir();
    try {
        const result = pda.initPolicies(dir, true);
        assert.ok(result.created);
        assert.ok(fs.existsSync(path.join(dir, '.simplebeacon', 'policies.json')));

        const { source } = pda.listPolicies(dir);
        assert.strictEqual(source, 'file');
    } finally { cleanup(dir); }
});

test('Policy engine: add and remove custom policy', () => {
    const dir = makeTmpDir();
    try {
        pda.initPolicies(dir, true);
        const policy = pda.addPolicy(dir, {
            type: 'forbidden_action',
            action: 'delete-database',
            description: 'Never delete the database',
            severity: 'block'
        });
        assert.ok(policy.id);

        const result = pda.checkAction(dir, 'delete-database');
        assert.strictEqual(result.allowed, false);

        assert.ok(pda.removePolicy(dir, policy.id));
        const result2 = pda.checkAction(dir, 'delete-database');
        assert.strictEqual(result2.allowed, true);
    } finally { cleanup(dir); }
});

test('Policy engine: invalid type throws', () => {
    const dir = makeTmpDir();
    try {
        assert.throws(() => pda.addPolicy(dir, { type: 'invalid_type', action: 'test' }));
    } finally { cleanup(dir); }
});

// ─── Gate Bridge Tests ───

test('Gate bridge: canFinalize with no-scan returns policy result', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'GateAgent', 'cursor');
        const result = pda.canFinalize(dir, agent.id, { runScan: false });
        // Default policies include must-scan (block), so canFinalize should be false
        assert.strictEqual(result.canFinalize, false);
        assert.ok(result.blockingCount > 0);
    } finally { cleanup(dir); }
});

test('Gate bridge: canFinalize passes when no blocking policies', () => {
    const dir = makeTmpDir();
    try {
        // Init with empty policies
        pda.savePolicies(dir, []);
        const agent = pda.registerAgent(dir, 'PassAgent', 'cursor');
        const result = pda.canFinalize(dir, agent.id, { runScan: false });
        assert.strictEqual(result.canFinalize, true);
        assert.strictEqual(result.blockingCount, 0);
    } finally { cleanup(dir); }
});

// ─── Agent Detection Tests ───

test('Agent detection: returns unknown when no env vars set', () => {
    const agentDetect = require('../src/agent-pda/agent-detect');
    // Save and clear all detection env vars
    const saved = {};
    for (const rule of agentDetect.DETECTION_RULES) {
        if (process.env[rule.envVar]) {
            saved[rule.envVar] = process.env[rule.envVar];
            delete process.env[rule.envVar];
        }
    }
    delete process.env.SIMPLEBEACON_AGENT_NAME;

    try {
        const identity = pda.getAgentIdentity();
        assert.strictEqual(identity.type, 'unknown');
        assert.strictEqual(identity.name, 'unknown-agent');
    } finally {
        // Restore
        for (const [k, v] of Object.entries(saved)) process.env[k] = v;
    }
});

test('Agent detection: SIMPLEBEACON_AGENT_NAME override', () => {
    const old = process.env.SIMPLEBEACON_AGENT_NAME;
    process.env.SIMPLEBEACON_AGENT_NAME = 'MyCustomAgent';
    try {
        const identity = pda.getAgentIdentity();
        assert.strictEqual(identity.name, 'MyCustomAgent');
    } finally {
        if (old) process.env.SIMPLEBEACON_AGENT_NAME = old;
        else delete process.env.SIMPLEBEACON_AGENT_NAME;
    }
});

// ─── Handoff Tests ───

test('Handoff: write and read handoff brief', () => {
    const dir = makeTmpDir();
    try {
        const agent = pda.registerAgent(dir, 'HandoffAgent', 'cursor');
        pda.remember(dir, agent.id, 'handoff-brief', JSON.stringify({
            summary: 'Did stuff',
            notes: 'Next: do more stuff',
            writtenAt: Date.now(),
            fromAgent: agent.id
        }), 'handoff');

        // Read latest handoff
        const agents = pda.listAgents(dir);
        let latest = null;
        for (const a of agents) {
            const mem = pda.recallLatest(dir, a.id, 'handoff-brief', 'handoff');
            if (mem && (!latest || mem.updatedAt > latest.updatedAt)) latest = mem;
        }
        assert.ok(latest);
        const brief = JSON.parse(latest.value);
        assert.strictEqual(brief.summary, 'Did stuff');
    } finally { cleanup(dir); }
});
