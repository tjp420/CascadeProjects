'use strict';

/**
 * Agentic Orchestration API — Management endpoints for multi-agent executor loop
 *
 * Endpoints:
 *   GET    /api/agentic/stats                    — Orchestration stats
 *   GET    /api/agentic/agents                   — List agents
 *   POST   /api/agentic/agents                   — Create agent
 *   GET    /api/agentic/agents/:id               — Get agent
 *   PUT    /api/agentic/agents/:id               — Update agent
 *   DELETE /api/agentic/agents/:id               — Delete agent
 *   POST   /api/agentic/agents/:id/execute       — Execute agent loop
 *   GET    /api/agentic/executions               — List executions (active + history)
 *   GET    /api/agentic/executions/:id           — Get execution detail
 *   POST   /api/agentic/executions/:id/pause     — Pause execution
 *   POST   /api/agentic/executions/:id/resume    — Resume execution
 *   POST   /api/agentic/executions/:id/abort     — Abort execution
 *   GET    /api/agentic/tools                    — List tools
 *   POST   /api/agentic/tools                    — Register custom tool
 *   DELETE /api/agentic/tools/:id                — Unregister tool
 *   POST   /api/agentic/inspect                  — Test guardrail inspection
 *
 * @module agentic-orchestration-routes
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/app-logger.cjs');
const agenticStore = require('../lib/agentic-orchestration-store.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError, sendSuccess } = require('../lib/response-helpers.cjs');

const router = express.Router();

// GET /stats
router.get('/stats', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    res.json({ success: true, stats: agenticStore.getStats(orgId) });
  } catch (err) {
    sendError(res, 500, 'agentic_stats_failed', { message: err.message });
  }
});

// GET /agents
router.get('/agents', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    res.json({ success: true, agents: agenticStore.getAllAgents(orgId) });
  } catch (err) {
    sendError(res, 500, 'agents_list_failed', { message: err.message });
  }
});

// POST /agents
router.post('/agents', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var agentId = req.body.id || 'agent-' + crypto.randomBytes(4).toString('hex');
    var result = agenticStore.createAgent(agentId, req.body, orgId);
    if (!result.success) return sendError(res, 409, 'agent_create_failed', { message: result.error });
    logger.info('[AgenticOrchestration] Agent created: ' + agentId + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) {
    sendError(res, 400, 'agent_create_failed', { message: err.message });
  }
});

// GET /agents/:id
router.get('/agents/:id', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var agent = agenticStore.getAgent(req.params.id, orgId);
    if (!agent) return sendError(res, 404, 'agent_not_found');
    res.json({ success: true, agent });
  } catch (err) {
    sendError(res, 500, 'agent_get_failed', { message: err.message });
  }
});

// PUT /agents/:id
router.put('/agents/:id', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var result = agenticStore.updateAgent(req.params.id, req.body, orgId);
    if (!result.success) return sendError(res, 404, 'agent_not_found');
    logger.info('[AgenticOrchestration] Agent updated: ' + req.params.id + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) {
    sendError(res, 400, 'agent_update_failed', { message: err.message });
  }
});

// DELETE /agents/:id
router.delete('/agents/:id', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var result = agenticStore.deleteAgent(req.params.id, orgId);
    if (!result.success) return sendError(res, 404, 'agent_not_found');
    logger.info('[AgenticOrchestration] Agent deleted: ' + req.params.id + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'agent_delete_failed', { message: err.message });
  }
});

// POST /agents/:id/execute
router.post('/agents/:id/execute', authorize('admin:all'), async function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var input = req.body.input || '';
    var options = req.body.options || {};

    // Get the agent to determine provider
    var agent = agenticStore.getAgent(req.params.id, orgId);
    if (!agent) return sendError(res, 404, 'agent_not_found');

    // Lazy-load inference service
    var inferenceService;
    try {
      inferenceService = require('../services/cloud-inference-service.cjs');
    } catch (err) {
      return sendError(res, 500, 'inference_service_unavailable', { message: err.message });
    }

    // Build inference function that uses the existing callProvider
    var inferenceFn = async function (prompt, opts) {
      var result = await inferenceService.generateWithProvider(
        opts.provider || agent.config.provider || 'openai',
        prompt,
        { model: opts.model || agent.config.model, temperature: opts.temperature || agent.config.temperature }
      );
      return {
        text: result.text || result.output || (typeof result === 'string' ? result : JSON.stringify(result)),
        usage: result.usage || null,
      };
    };

    var result = await agenticStore.executeAgentLoop(req.params.id, orgId, input, inferenceFn, options);
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'agent_execute_failed', { message: err.message });
  }
});

// GET /executions
router.get('/executions', function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var active = agenticStore.getActiveExecutions(orgId);
    var history = agenticStore.getExecutionHistory(orgId, parseInt(req.query.limit, 10) || 50);
    res.json({ success: true, active, history });
  } catch (err) {
    sendError(res, 500, 'executions_list_failed', { message: err.message });
  }
});

// GET /executions/:id
router.get('/executions/:id', function (req, res) {
  try {
    var exec = agenticStore.getExecution(req.params.id);
    if (!exec) return sendError(res, 404, 'execution_not_found');
    res.json({ success: true, execution: exec });
  } catch (err) {
    sendError(res, 500, 'execution_get_failed', { message: err.message });
  }
});

// POST /executions/:id/pause
router.post('/executions/:id/pause', authorize('admin:all'), function (req, res) {
  try {
    var result = agenticStore.pauseExecution(req.params.id);
    if (!result.success) return sendError(res, 400, 'pause_failed', { message: result.error });
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'pause_failed', { message: err.message });
  }
});

// POST /executions/:id/resume
router.post('/executions/:id/resume', authorize('admin:all'), function (req, res) {
  try {
    var result = agenticStore.resumeExecution(req.params.id);
    if (!result.success) return sendError(res, 400, 'resume_failed', { message: result.error });
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'resume_failed', { message: err.message });
  }
});

// POST /executions/:id/abort
router.post('/executions/:id/abort', authorize('admin:all'), function (req, res) {
  try {
    var result = agenticStore.abortExecution(req.params.id);
    if (!result.success) return sendError(res, 400, 'abort_failed', { message: result.error });
    logger.info('[AgenticOrchestration] Execution aborted: ' + req.params.id);
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'abort_failed', { message: err.message });
  }
});

// GET /tools
router.get('/tools', function (req, res) {
  try {
    res.json({ success: true, tools: agenticStore.listTools() });
  } catch (err) {
    sendError(res, 500, 'tools_list_failed', { message: err.message });
  }
});

// POST /tools
router.post('/tools', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.body.orgId || 'default';
    var toolId = req.body.id || 'tool-' + crypto.randomBytes(4).toString('hex');
    var result = agenticStore.registerTool(toolId, req.body, orgId);
    logger.info('[AgenticOrchestration] Tool registered: ' + toolId + ' by ' + (req.user && req.user.email || 'admin'));
    res.json(result);
  } catch (err) {
    sendError(res, 400, 'tool_register_failed', { message: err.message });
  }
});

// DELETE /tools/:id
router.delete('/tools/:id', authorize('admin:all'), function (req, res) {
  try {
    var orgId = req.orgId || req.query.orgId || 'default';
    var result = agenticStore.unregisterTool(req.params.id, orgId);
    if (!result.success) return sendError(res, 404, 'tool_not_found');
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'tool_unregister_failed', { message: err.message });
  }
});

// POST /inspect — test guardrail inspection
router.post('/inspect', function (req, res) {
  try {
    var text = req.body.text || '';
    var config = req.body.config || {};
    var result = agenticStore.inspectStep(text, {
      guardrailEnabled: true,
      autoTerminateOnRefusal: true,
      autoTerminateOnRepetition: true,
      repetitionThreshold: 0.85,
      ...config,
    });
    res.json({ success: true, result });
  } catch (err) {
    sendError(res, 500, 'inspect_failed', { message: err.message });
  }
});

module.exports = router;
