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
const auditLogger = require('../lib/audit-logger.cjs');
const agenticStore = require('../lib/agentic-orchestration-store.cjs');
const siemExporter = require('../lib/siem-exporter.cjs');
const { authorize, enforceOrgPartition } = require('../middleware/authorize.cjs');
const { sendError, sendSuccess } = require('../lib/response-helpers.cjs');
const { canonicalizeRequest, createReplayDetector } = require('../lib/crypto-utils.cjs');

const router = express.Router();

// Replay detector for agentic orchestration requests — prevents duplicate
// execution of identical payloads within the TTL window.
const replayDetector = createReplayDetector({
  ttlMs: parseInt(process.env.AGENTIC_REPLAY_TTL_MS, 10) || 5 * 60 * 1000,
  maxPerOrg: parseInt(process.env.AGENTIC_REPLAY_MAX_PER_ORG, 10) || 1000,
});

// Apply org-partition enforcement for all agentic routes
router.use(enforceOrgPartition());

// centralized async handler wrapper to forward errors to logger and responses
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      try {
        logger.error('[AgenticOrchestration] Unexpected handler error: ' + err.message);
      } catch {}
      sendError(res, 500, 'internal_error', { message: err.message });
    });
  };
}

/**
 * Replay detection middleware — computes a canonical fingerprint of the
 * request body and checks it against the replay detector. If the same
 * fingerprint was seen recently for this org, the request is rejected
 * with 409 Conflict. Otherwise, the fingerprint is marked and the
 * canonical fingerprint is attached to req for audit logging.
 *
 * Only applies to POST/PUT/DELETE methods with a JSON body.
 */
function replayDetectionMiddleware(req, res, next) {
  // Only check state-changing requests with a body
  if (!['POST', 'PUT', 'DELETE'].includes(req.method) || !req.body || Object.keys(req.body).length === 0) {
    return next();
  }

  try {
    const orgId = req.user?.id || req.user?.email || 'default';
    const { fingerprint, canonical } = canonicalizeRequest(req.body);

    // Attach fingerprint to req for downstream audit logging
    req.canonicalFingerprint = fingerprint;
    req.canonicalRequest = canonical;

    const result = replayDetector.checkAndMark(orgId, fingerprint);

    if (result.isReplay) {
      logger.warn(`[AgenticOrchestration] Replay detected for org ${orgId}: ${fingerprint}`);
      return res.status(409).json({
        success: false,
        error: 'replay_detected',
        message: 'This request payload was already submitted recently',
        fingerprint,
        firstSeen: result.firstSeen,
      });
    }

    next();
  } catch (err) {
    logger.warn('[AgenticOrchestration] Replay check failed:', err.message);
    // Fail open — don't block on replay detector errors
    next();
  }
}

// --- Quota & Rate Limiting (in-memory for active executions) ---
// Active-execution quota remains file-backed. Trigger rate-limiting is delegated
// to `server/lib/redis-rate-limiter.cjs`, which will use Redis when available.
const QUOTA = {
  MAX_ACTIVE_EXECUTIONS_PER_ORG: 3, // max concurrent active executions per org
  // RATE_LIMIT_* constants are owned by the rate limiter implementation
};

const rateLimiter = require('../lib/redis-rate-limiter.cjs');

function getAuditContext(req) {
  try {
    const sourceIp = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || req.ip || (req.connection && req.connection.remoteAddress) || null;
    const headers = {
      'user-agent': req.headers && req.headers['user-agent'],
      'x-request-id': req.headers && req.headers['x-request-id'],
      'x-test-user': req.headers && req.headers['x-test-user'],
    };
    const body = req.body || {};
    // Canonicalize body by deep-sorting object keys so semantically-equal JSON
    // produces deterministic hashes regardless of key ordering.
    function canonicalize(value) {
      if (value === null || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(canonicalize);
      const keys = Object.keys(value).sort();
      const out = {};
      for (const k of keys) out[k] = canonicalize(value[k]);
      return out;
    }
    const canonicalBody = canonicalize(body);
    const hash = crypto.createHash('sha256').update(JSON.stringify(canonicalBody)).digest('hex');
    return { sourceIp, headers, payloadHash: hash, at: new Date().toISOString() };
  } catch (e) {
    return { sourceIp: null, headers: {}, payloadHash: null, at: new Date().toISOString() };
  }
}

// Check active execution quota using distributed counters when available.
async function checkAndReserveActiveSlot(orgId) {
  // Try Redis-backed atomic increment first
  try {
    if (rateLimiter && typeof rateLimiter.incrementActiveExecutions === 'function') {
      const cnt = await rateLimiter.incrementActiveExecutions(orgId);
      if (cnt > QUOTA.MAX_ACTIVE_EXECUTIONS_PER_ORG) {
        // undo the increment and signal quota exhausted
        try { await rateLimiter.decrementActiveExecutions(orgId); } catch (e) { logger.debug('decrementActiveExecutions failed during quota check', { error: e.message, orgId }); }
        return { allowed: false, current: cnt };
      }
      return { allowed: true, current: cnt };
    }
  } catch (e) {
    console.error('agentic-orchestration-routes.cjs error:', e);
    // fallthrough to store-backed check
    logger.debug('Redis-backed quota check failed; falling back to store-backed check', { error: e.message, orgId });
  }

  // Fallback: use agenticStore's active executions list (per-process)
  try {
    const active = agenticStore.getActiveExecutions(orgId) || [];
    if (active.length >= QUOTA.MAX_ACTIVE_EXECUTIONS_PER_ORG) return { allowed: false, current: active.length };
    // best-effort: mark reservation via agenticStore if supported (no-op otherwise)
    if (typeof agenticStore.reserveExecution === 'function') {
      try { agenticStore.reserveExecution(orgId); } catch (e) { logger.debug('reserveExecution failed', { error: e.message, orgId }); }
    }
    return { allowed: true, current: active.length + 1 };
  } catch (err) {
    return { allowed: true, current: 0 };
  }
}

// `checkAndRecordRateLimit` is provided by `rateLimiter.checkAndRecordRateLimit(orgId)`

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
router.post('/agents', authorize('admin:all'), asyncHandler(async function (req, res) {
  var orgId = req.orgId || req.body.orgId || 'default';
  // require explicit id in request body for deterministic agent ids in production
  var agentId = req.body.id;
  if (!agentId) {
    // client must provide an id to avoid accidental duplicates; respond with conflict
    return sendError(res, 409, 'agent_create_failed', { message: 'missing agent id' });
  }
  var result = agenticStore.createAgent(agentId, req.body, orgId);
  if (!result.success) return sendError(res, 409, 'agent_create_failed', { message: result.error });
  logger.info('[AgenticOrchestration] Agent created: ' + agentId + ' by ' + (req.user && req.user.email || 'admin'));
  res.json(result);
}));

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
router.post('/agents/:id/execute', authorize('admin:all'), replayDetectionMiddleware, asyncHandler(async function (req, res) {
  var orgId = req.orgId || req.body.orgId || 'default';
  var input = req.body.input || '';
  var options = req.body.options || {};
  // Log canonical fingerprint for audit integrity
  if (req.canonicalFingerprint) {
    try { auditLogger.logEvent && auditLogger.logEvent('AGENTIC_EXECUTE_REQUEST', { orgId, agentId: req.params.id, fingerprint: req.canonicalFingerprint, user: req.user && req.user.id }); } catch (e) { logger.debug('audit log AGENTIC_EXECUTE_REQUEST failed', { error: e.message }); }
  }
  // Enforce active-execution quota per org using distributed reservation
  let reserved = false;
  try {
    const slot = await checkAndReserveActiveSlot(orgId);
    if (!slot.allowed) {
      try { auditLogger.logEvent && auditLogger.logEvent('AGENTIC_QUOTA_EXHAUSTED', Object.assign({ orgId, agentId: req.params.id, user: req.user && req.user.id }, getAuditContext(req))); } catch (e) { logger.debug('audit log AGENTIC_QUOTA_EXHAUSTED failed', { error: e.message }); }
      return sendError(res, 429, 'rate_limited', { message: 'max_active_executions_reached' });
    }
    reserved = true;
  } catch (e) {
    console.error('agentic-orchestration-routes.cjs error:', e);
    // on any error, fail-safe: allow execution to proceed
    logger.debug('quota enforcement failed; failing safe to allow execution', { error: e.message, orgId });
  }

  // Enforce trigger rate limit per org (sliding window) using the pluggable limiter
  const rl = await rateLimiter.checkAndRecordRateLimit(orgId);
  if (!rl.allowed) {
    const retrySecs = Math.ceil((rl.retryAfterMs || 0) / 1000);
    res.setHeader('Retry-After', String(retrySecs));
    try { auditLogger.logEvent && auditLogger.logEvent('AGENTIC_RATE_LIMIT_TRIPPED', Object.assign({ orgId, agentId: req.params.id, user: req.user && req.user.id, retryAfter: retrySecs }, getAuditContext(req))); } catch (e) { logger.debug('audit log AGENTIC_RATE_LIMIT_TRIPPED failed', { error: e.message }); }
    return sendError(res, 429, 'rate_limited', { message: 'rate_limit_exceeded', retryAfter: retrySecs });
  }

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

  // Execute and ensure we release the reserved slot in all cases
  try {
    var result = await agenticStore.executeAgentLoop(req.params.id, orgId, input, inferenceFn, options);
    if (!result || result.success === false) return sendError(res, 500, 'agent_execute_failed', { message: result && result.error });
    res.json(result);
  } finally {
    if (reserved) {
      try { await rateLimiter.decrementActiveExecutions(orgId); } catch (e) { logger.debug('decrementActiveExecutions failed in finally', { error: e.message, orgId }); }
    }
  }
}));

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

// GET /replay-stats — admin-only: replay detector health stats
router.get('/replay-stats', authorize('admin:all'), function (req, res) {
  try {
    const stats = replayDetector.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    sendError(res, 500, 'replay_stats_failed', { message: err.message });
  }
});

// GET /metrics — debug-only: expose SIEM exporter in Prometheus exposition format
router.get('/metrics', authorize('admin:all'), function (req, res) {
  try {
    let metrics = {};
    if (siemExporter && siemExporter._debug && typeof siemExporter._debug.getMetrics === 'function') {
      metrics = siemExporter._debug.getMetrics();
    }
    // Build Prometheus exposition format
    const lines = [];
    const meta = {
      siem_delivery_retries_total: 'Total count of SIEM log delivery retry attempts.',
      siem_delivery_dropped_total: 'Total number of SIEM events dropped due to queue trimming.',
    };
    for (const metricName of Object.keys(metrics)) {
      const help = meta[metricName] || '';
      lines.push(`# HELP ${metricName} ${help}`);
      lines.push(`# TYPE ${metricName} counter`);
      lines.push(`${metricName} ${Number(metrics[metricName] || 0)}`);
    }
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
  } catch (err) {
    sendError(res, 500, 'metrics_failed', { message: err.message });
  }
});

// GET /canonical-fingerprint — compute canonical fingerprint for a payload
// (useful for testing/debugging deduplication logic)
router.post('/canonical-fingerprint', authorize('admin:all'), function (req, res) {
  try {
    const result = canonicalizeRequest(req.body);
    res.json({ success: true, fingerprint: result.fingerprint, canonical: result.canonical });
  } catch (err) {
    sendError(res, 500, 'canonical_fingerprint_failed', { message: err.message });
  }
});

module.exports = router;
// Export replay detector for cross-route telemetry aggregation
module.exports.replayDetector = replayDetector;
module.exports.canonicalizeRequest = canonicalizeRequest;
