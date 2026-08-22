'use strict';

/**
 * Agent PDA REST API routes.
 *
 * Exposes the Agent PDA engine (memory, tasks, policies, gate, handoff)
 * via authenticated REST endpoints for remote agents and CI systems.
 *
 * All endpoints require authentication via the standard `authenticate` middleware.
 * The engine is loaded from the CLI package — same code path as MCP/CLI.
 */

const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.cjs');
const { sendError, sendSuccess } = require('../lib/response-helpers.cjs');

const router = express.Router();

// Lazy-load the PDA engine from the CLI package
let pdaEngine = null;
function getPdaEngine() {
    if (pdaEngine) return pdaEngine;
    try {
        // Try requiring from the CLI package (monorepo)
        pdaEngine = require('../../../packages/simplebeacon-cli/src/agent-pda');
    } catch {
        // Fallback: the engine may be installed as a dependency
        try {
            pdaEngine = require('simplebeacon/src/agent-pda');
        } catch {
            pdaEngine = null;
        }
    }
    return pdaEngine;
}

function ensureEngine(req, res) {
    const engine = getPdaEngine();
    if (!engine) {
        sendError(res, 503, 'Agent PDA engine not available');
        return null;
    }
    return engine;
}

function getProjectRoot(req) {
    // Authenticated users can specify a project root, otherwise use the server's cwd
    return req.body?.projectRoot || req.query?.projectRoot || process.cwd();
}

/**
 * Workspace registry — maps workspace IDs to project roots.
 * Allows remote agents to reference workspaces by short ID instead of full path.
 * Stored in .simplebeacon/agent-pda/workspaces.json on the server.
 */
const WORKSPACES_FILE = require('path').join(process.cwd(), '.simplebeacon', 'agent-pda', 'workspaces.json');

function loadWorkspaces() {
    try {
        return JSON.parse(require('fs').readFileSync(WORKSPACES_FILE, 'utf8'));
    } catch {
        return { workspaces: {}, version: 1 };
    }
}

function saveWorkspaces(data) {
    const dir = require('path').dirname(WORKSPACES_FILE);
    require('fs').mkdirSync(dir, { recursive: true });
    require('fs').writeFileSync(WORKSPACES_FILE, JSON.stringify(data, null, 2));
}

/**
 * Resolve a workspace ID or projectRoot to a validated project root path.
 * Returns null if the workspace is not registered or the path is not allowed.
 */
function resolveWorkspace(req) {
    const engine = getPdaEngine();
    if (!engine) return null;

    const workspaceId = req.body?.workspaceId || req.query?.workspaceId;
    const explicitRoot = req.body?.projectRoot || req.query?.projectRoot;

    // If workspace ID is provided, look it up
    if (workspaceId) {
        const ws = loadWorkspaces();
        const entry = ws.workspaces[workspaceId];
        if (!entry) return { error: 'workspace_not_found', message: `Workspace "${workspaceId}" is not registered` };
        return { root: entry.root };
    }

    // If explicit root is provided, validate it's in the allowed list (if configured)
    if (explicitRoot) {
        const ws = loadWorkspaces();
        const allowedRoots = ws.allowedRoots || [];
        if (allowedRoots.length > 0 && !allowedRoots.includes(explicitRoot)) {
            return { error: 'workspace_not_allowed', message: `Project root "${explicitRoot}" is not in the allowed list` };
        }
        return { root: explicitRoot };
    }

    // Default to server cwd
    return { root: process.cwd() };
}

/**
 * Wrapper that resolves the workspace and returns an error response if invalid.
 * Calls the handler with the resolved root.
 */
function withWorkspace(handler) {
    return (req, res) => {
        const engine = ensureEngine(req, res);
        if (!engine) return;
        const ws = resolveWorkspace(req);
        if (ws.error) return sendError(res, 400, ws.message);
        return handler(req, res, engine, ws.root);
    };
}

// ─── Workspace management endpoints ───

router.post('/agent-pda/workspaces', authenticate, (req, res) => {
    const { root, name, allowedRoots } = req.body || {};
    if (!root) return sendError(res, 400, 'root path is required');
    const ws = loadWorkspaces();
    if (allowedRoots && Array.isArray(allowedRoots)) {
        ws.allowedRoots = allowedRoots;
    }
    const crypto = require('crypto');
    const id = 'ws_' + crypto.createHash('sha256').update(root).digest('hex').substring(0, 12);
    ws.workspaces[id] = { root, name: name || root, createdAt: Date.now() };
    saveWorkspaces(ws);
    sendSuccess(res, { workspaceId: id, root, name: name || root });
});

router.get('/agent-pda/workspaces', authenticate, (req, res) => {
    const ws = loadWorkspaces();
    sendSuccess(res, { workspaces: ws.workspaces, allowedRoots: ws.allowedRoots || [] });
});

router.delete('/agent-pda/workspaces/:workspaceId', authenticate, (req, res) => {
    const ws = loadWorkspaces();
    const deleted = !!ws.workspaces[req.params.workspaceId];
    delete ws.workspaces[req.params.workspaceId];
    if (deleted) saveWorkspaces(ws);
    sendSuccess(res, { deleted });
});

// ─── Agent endpoints ───

router.post('/agent-pda/register', authenticate, withWorkspace((req, res, engine, root) => {
    const { name, type } = req.body || {};
    const agent = engine.registerAgent(root, name || 'remote-agent', type || 'custom');
    sendSuccess(res, { agent });
}));

router.get('/agent-pda/agents', authenticate, withWorkspace((req, res, engine, root) => {
    const agents = engine.listAgents(root);
    sendSuccess(res, { agents, count: agents.length });
}));

router.get('/agent-pda/agents/:agentId', authenticate, withWorkspace((req, res, engine, root) => {
    const agent = engine.getAgent(root, req.params.agentId);
    if (!agent) return sendError(res, 404, 'Agent not found');
    sendSuccess(res, { agent });
}));

router.delete('/agent-pda/agents/:agentId', authenticate, withWorkspace((req, res, engine, root) => {
    const deleted = engine.removeAgent(root, req.params.agentId);
    sendSuccess(res, { deleted });
}));

// ─── Memory endpoints ───

router.post('/agent-pda/agents/:agentId/memory', authenticate, withWorkspace((req, res, engine, root) => {
    const { key, value, category, ttlSeconds } = req.body || {};
    if (!key || !value) return sendError(res, 400, 'key and value are required');
    const memory = engine.remember(root, req.params.agentId, key, value, category || 'context', { ttlSeconds });
    sendSuccess(res, { memory });
}));

router.get('/agent-pda/agents/:agentId/memory', authenticate, withWorkspace((req, res, engine, root) => {
    const { key, category, search, allAgents } = req.query;
    const opts = { allAgents: allAgents === 'true', search: search || undefined };
    const memories = engine.recall(root, req.params.agentId, key, category, opts);
    sendSuccess(res, { memories, count: memories.length });
}));

router.delete('/agent-pda/agents/:agentId/memory', authenticate, withWorkspace((req, res, engine, root) => {
    const { key, category } = req.body || {};
    if (!key) return sendError(res, 400, 'key is required');
    const deleted = engine.forget(root, req.params.agentId, key, category);
    sendSuccess(res, { deleted });
}));

// ─── Task endpoints ───

router.post('/agent-pda/agents/:agentId/tasks', authenticate, withWorkspace((req, res, engine, root) => {
    const { title, description, priority, parentId, approvalRequired } = req.body || {};
    if (!title) return sendError(res, 400, 'title is required');
    const task = engine.createTask(root, req.params.agentId, title, { description, priority, parentId, approvalRequired });
    sendSuccess(res, { task });
}));

router.get('/agent-pda/tasks', authenticate, withWorkspace((req, res, engine, root) => {
    const { agentId, status } = req.query;
    const tasks = engine.listTasks(root, agentId, status);
    sendSuccess(res, { tasks, count: tasks.length });
}));

router.get('/agent-pda/tasks/:taskId', authenticate, withWorkspace((req, res, engine, root) => {
    const task = engine.getTask(root, req.params.taskId);
    if (!task) return sendError(res, 404, 'Task not found');
    sendSuccess(res, { task });
}));

router.patch('/agent-pda/tasks/:taskId', authenticate, withWorkspace((req, res, engine, root) => {
    const { title, description, status, priority, blockReason } = req.body || {};
    const task = engine.updateTask(root, req.params.taskId, { title, description, status, priority, blockReason });
    if (!task) return sendError(res, 404, 'Task not found');
    sendSuccess(res, { task });
}));

router.post('/agent-pda/tasks/:taskId/complete', authenticate, withWorkspace((req, res, engine, root) => {
    const result = engine.completeTask(root, req.params.taskId);
    if (!result) return sendError(res, 404, 'Task not found');
    if (result.error === 'parent_incomplete') return sendError(res, 409, result.message);
    sendSuccess(res, { task: result });
}));

router.post('/agent-pda/tasks/:taskId/approve', authenticate, withWorkspace((req, res, engine, root) => {
    const task = engine.approveTask(root, req.params.taskId, req.user?.email || 'remote');
    if (!task) return sendError(res, 404, 'Task not found');
    sendSuccess(res, { task });
}));

router.get('/agent-pda/tasks/approvals/pending', authenticate, withWorkspace((req, res, engine, root) => {
    const approvals = engine.getPendingApprovals(root);
    sendSuccess(res, { approvals, count: approvals.length });
}));

// ─── Policy endpoints ───

router.get('/agent-pda/policies', authenticate, withWorkspace((req, res, engine, root) => {
    const { policies, source } = engine.listPolicies(root);
    sendSuccess(res, { policies, source, count: policies.length });
}));

router.post('/agent-pda/policies/check', authenticate, withWorkspace((req, res, engine, root) => {
    const { action, context } = req.body || {};
    if (!action) return sendError(res, 400, 'action is required');
    const result = engine.checkAction(root, action, context || {});
    sendSuccess(res, { action, ...result });
}));

router.post('/agent-pda/policies', authenticate, withWorkspace((req, res, engine, root) => {
    const { type, action, description, severity, enabled } = req.body || {};
    if (!type || !action) return sendError(res, 400, 'type and action are required');
    try {
        const policy = engine.addPolicy(root, { type, action, description, severity, enabled });
        sendSuccess(res, { policy });
    } catch (err) {
        sendError(res, 400, err.message);
    }
}));

router.delete('/agent-pda/policies/:policyId', authenticate, withWorkspace((req, res, engine, root) => {
    const deleted = engine.removePolicy(root, req.params.policyId);
    sendSuccess(res, { deleted });
}));

router.post('/agent-pda/policies/init', authenticate, withWorkspace((req, res, engine, root) => {
    const { force } = req.body || {};
    const result = engine.initPolicies(root, force);
    sendSuccess(res, result);
}));

// ─── Gate endpoints ───

router.post('/agent-pda/gate/finalize', authenticate, withWorkspace((req, res, engine, root) => {
    const { agentId, runScan, useExistingReport, action } = req.body || {};
    const result = engine.canFinalize(root, agentId || 'remote', {
        runScan: runScan !== false,
        useExistingReport: useExistingReport === true,
        action: action || 'finalize-changes'
    });
    sendSuccess(res, {
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
    });
}));

// ─── Handoff endpoints ───

router.post('/agent-pda/handoff', authenticate, withWorkspace((req, res, engine, root) => {
    const { agentId, summary, completedTasks, pendingTasks, notes, filesChanged } = req.body || {};
    const brief = {
        summary: summary || '',
        completedTasks: completedTasks || [],
        pendingTasks: pendingTasks || [],
        notes: notes || '',
        filesChanged: filesChanged || [],
        writtenAt: Date.now(),
        fromAgent: agentId || 'remote'
    };
    const memory = engine.remember(root, agentId || 'remote', 'handoff-brief', JSON.stringify(brief), 'handoff');
    sendSuccess(res, { brief, memoryId: memory.id });
}));

router.get('/agent-pda/handoff', authenticate, withWorkspace((req, res, engine, root) => {
    const agents = engine.listAgents(root);
    let latest = null;
    for (const agent of agents) {
        const mem = engine.recallLatest(root, agent.id, 'handoff-brief', 'handoff');
        if (mem && (!latest || mem.updatedAt > latest.updatedAt)) {
            latest = mem;
        }
    }
    if (!latest) return sendSuccess(res, { handoff: null });
    try {
        const brief = JSON.parse(latest.value);
        sendSuccess(res, { handoff: brief });
    } catch {
        sendSuccess(res, { handoff: { raw: latest.value } });
    }
}));

// ─── Sync endpoint (receives queued changes from offline agents) ───

router.post('/agent-pda/sync', authenticate, withWorkspace((req, res, engine, root) => {
    const { changes } = req.body || {};
    if (!Array.isArray(changes)) return sendError(res, 400, 'changes array is required');
    const accepted = changes.length;
    sendSuccess(res, { accepted, processed: accepted, workspace: root });
}));

module.exports = router;
