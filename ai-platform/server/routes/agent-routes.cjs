const express = require('express');
const { sendError } = require('../lib/response-helpers.cjs');
const router = express.Router();

// Agent execution status (in-memory, no castles)
let currentAgentStatus = {
  status: 'idle',
  goal: null,
  startedAt: null,
  completedAt: null,
  error: null,
};

// POST /api/agent/execute
router.post('/agent/execute', (req, res) => {
  const { goal } = req.body || {};
  if (!goal || typeof goal !== 'string') {
    return sendError(res, 400, 'goal (string) is required in request body');
  }
  // Agent execution not currently available - orchestrator.js not implemented
  return sendError(res, 501, 'Agent execution not implemented');

  // Agent execution temporarily disabled
  /*
  currentAgentStatus = { status: 'running', goal, startedAt: new Date().toISOString(), completedAt: null, error: null };
  res.status(202).json({ success: true, message: 'Agent execution started', goal });

  runLocalAgent(goal)
      .then((result) => {
          currentAgentStatus = {
              status: result.success ? 'completed' : 'failed',
              goal,
              startedAt: currentAgentStatus.startedAt,
              completedAt: new Date().toISOString(),
              error: result.error || null
          };
      })
      .catch((err) => {
          currentAgentStatus = {
              status: 'failed',
              goal,
              startedAt: currentAgentStatus.startedAt,
              completedAt: new Date().toISOString(),
              error: err.message
          };
      });
  */
});

// GET /api/agent/status
router.get('/agent/status', (_req, res) => {
  res.json(currentAgentStatus);
});

module.exports = router;
