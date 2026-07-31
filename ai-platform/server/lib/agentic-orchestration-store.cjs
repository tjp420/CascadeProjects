'use strict';

/**
 * Agentic Orchestration Store — Multi-agent executor loop environment
 *
 * Provides:
 *   - Agent definitions with system prompts, tool wiring, and execution config
 *   - State machine tracking for multi-step reasoning loops
 *   - Guardrail inspection passes between intermediate agent steps
 *   - Tool registry with safe execution wrappers
 *   - Execution history with step-by-step traces and timing
 *   - Pause/resume/abort controls for running agent loops
 *
 * @module agentic-orchestration-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./app-logger.cjs');
const schemaValidator = require('./tool-schema-validation-store.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'agentic-orchestration.json');
const MAX_AGENTS = 100;
const MAX_EXECUTIONS = 50;
const MAX_STEPS = 20;

const DEFAULT_AGENT_CONFIG = {
  maxSteps: 10,
  stepTimeoutMs: 30000,
  guardrailEnabled: true,
  guardrailStrictMode: false,
  autoTerminateOnRefusal: true,
  autoTerminateOnRepetition: true,
  repetitionThreshold: 0.85,
  provider: 'openai',
  model: null,
  temperature: 0.7,
  systemPrompt: '',
};

const BUILTIN_TOOLS = {
  'code_search': {
    name: 'code_search',
    description: 'Search the codebase for relevant code patterns, functions, or files',
    parameters: { query: 'string', maxResults: 'number' },
    category: 'analysis',
  },
  'file_read': {
    name: 'file_read',
    description: 'Read the contents of a file at a given path',
    parameters: { filePath: 'string' },
    category: 'io',
  },
  'web_search': {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: { query: 'string' },
    category: 'research',
  },
  'code_execution': {
    name: 'code_execution',
    description: 'Execute code in a sandboxed environment',
    parameters: { language: 'string', code: 'string' },
    category: 'execution',
  },
  'data_analysis': {
    name: 'data_analysis',
    description: 'Analyze data and produce statistical summaries',
    parameters: { data: 'string', operation: 'string' },
    category: 'analysis',
  },
  'api_call': {
    name: 'api_call',
    description: 'Make an HTTP API call to a configured endpoint',
    parameters: { url: 'string', method: 'string', body: 'string' },
    category: 'network',
  },
  'summarize': {
    name: 'summarize',
    description: 'Summarize a block of text',
    parameters: { text: 'string', maxLength: 'number' },
    category: 'text',
  },
  'translate': {
    name: 'translate',
    description: 'Translate text between languages',
    parameters: { text: 'string', from: 'string', to: 'string' },
    category: 'text',
  },
};

const EXECUTION_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ABORTED: 'aborted',
  FAILED: 'failed',
  GUARDRAIL_BLOCKED: 'guardrail_blocked',
};

const STEP_STATES = {
  PENDING: 'pending',
  EXECUTING: 'executing',
  GUARDRAIL_CHECK: 'guardrail_check',
  TOOL_EXECUTION: 'tool_execution',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  FAILED: 'failed',
};

// In-memory state
const activeExecutions = new Map();
const executionHistory = [];
const MAX_HISTORY = 200;

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { agents: {}, tools: {} };
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { agents: {}, tools: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

function makeKey(orgId, id) {
  return orgId ? `${orgId}::${id}` : id;
}

// ── Agent CRUD ───────────────────────────────────────────────────────────────

function getAgent(agentId, orgId) {
  const store = readStore();
  return store.agents[makeKey(orgId, agentId)] || null;
}

function getAllAgents(orgId) {
  const store = readStore();
  return Object.values(store.agents).filter(a => a.orgId === orgId);
}

function createAgent(agentId, agent, orgId) {
  const store = readStore();
  const key = makeKey(orgId, agentId);
  if (store.agents[key]) {
    return { success: false, error: 'Agent already exists: ' + agentId };
  }
  const config = { ...DEFAULT_AGENT_CONFIG, ...(agent.config || {}) };
  store.agents[key] = {
    id: agentId,
    orgId,
    name: agent.name || 'Unnamed Agent',
    description: agent.description || '',
    systemPrompt: agent.systemPrompt || config.systemPrompt || '',
    tools: agent.tools || [],
    config,
    enabled: agent.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0,
    lastExecutedAt: null,
  };

  // Prune
  const orgAgents = Object.entries(store.agents)
    .filter(([, v]) => v.orgId === orgId)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
  if (orgAgents.length > MAX_AGENTS) {
    for (const [k] of orgAgents.slice(MAX_AGENTS)) delete store.agents[k];
  }

  writeStore(store);
  logger.info('[AgenticOrchestration] Agent created: ' + agentId);
  return { success: true, agent: store.agents[key] };
}

function updateAgent(agentId, updates, orgId) {
  const store = readStore();
  const key = makeKey(orgId, agentId);
  if (!store.agents[key]) return { success: false, error: 'Agent not found' };
  const agent = store.agents[key];
  if (updates.name !== undefined) agent.name = updates.name;
  if (updates.description !== undefined) agent.description = updates.description;
  if (updates.systemPrompt !== undefined) agent.systemPrompt = updates.systemPrompt;
  if (updates.tools !== undefined) agent.tools = updates.tools;
  if (updates.enabled !== undefined) agent.enabled = updates.enabled;
  if (updates.config) agent.config = { ...agent.config, ...updates.config };
  agent.updatedAt = new Date().toISOString();
  writeStore(store);
  return { success: true, agent };
}

function deleteAgent(agentId, orgId) {
  const store = readStore();
  const key = makeKey(orgId, agentId);
  if (!store.agents[key]) return { success: false, error: 'Agent not found' };
  delete store.agents[key];
  writeStore(store);
  return { success: true };
}

// ── Tool Registry ────────────────────────────────────────────────────────────

function listTools() {
  const store = readStore();
  const customTools = store.tools || {};
  return { builtin: BUILTIN_TOOLS, custom: customTools };
}

function registerTool(toolId, toolDef, orgId) {
  const store = readStore();
  if (!store.tools) store.tools = {};
  const key = makeKey(orgId, toolId);
  store.tools[key] = {
    id: toolId,
    orgId,
    name: toolDef.name || toolId,
    description: toolDef.description || '',
    parameters: toolDef.parameters || {},
    category: toolDef.category || 'custom',
    handler: toolDef.handler || null,
    enabled: toolDef.enabled !== false,
    createdAt: new Date().toISOString(),
  };
  writeStore(store);
  return { success: true, tool: store.tools[key] };
}

function unregisterTool(toolId, orgId) {
  const store = readStore();
  const key = makeKey(orgId, toolId);
  if (!store.tools || !store.tools[key]) return { success: false, error: 'Tool not found' };
  delete store.tools[key];
  writeStore(store);
  return { success: true };
}

// ── Guardrail Inspection ─────────────────────────────────────────────────────

const REFUSAL_PATTERNS = [
  /I(?:'|['\u2019])?m sorry, but I can(?:'|['\u2019])?t/i,
  /I cannot (?:provide|assist|help|fulfill)/i,
  /I(?:'|['\u2019])?m unable to (?:assist|help|provide)/i,
  /I will not (?:assist|help|provide)/i,
  /I can(?:'|['\u2019])?t (?:help|provide|answer|fulfill)/i,
];

const INJECTION_PATTERNS = [
  /ignore (?:all )?(?:previous|prior) instructions/i,
  /disregard (?:all )?(?:previous|prior) (?:prompts|instructions)/i,
  /you are now (?:a |an )?(?:different|new)/i,
  /(?:jailbreak|DAN|do anything now)/i,
];

/**
 * Run guardrail inspection on an intermediate agent step.
 * @param {string} text — The agent's output text for this step
 * @param {object} config — Agent config with guardrail settings
 * @returns {{ passed: boolean, violations: string[], severity: string }}
 */
function inspectStep(text, config) {
  if (!config.guardrailEnabled) return { passed: true, violations: [], severity: 'none' };

  const violations = [];
  var severity = 'none';

  // Check for refusals
  if (config.autoTerminateOnRefusal) {
    for (const pattern of REFUSAL_PATTERNS) {
      if (pattern.test(text)) {
        violations.push('refusal_detected');
        severity = 'high';
        break;
      }
    }
  }

  // Check for prompt injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push('prompt_injection_attempt');
      severity = severity === 'none' ? 'critical' : severity;
      break;
    }
  }

  // Check for repetition (circular reasoning)
  if (config.autoTerminateOnRepetition && text.length > 50) {
    const words = text.toLowerCase().split(/\s+/);
    if (words.length > 10) {
      const uniqueWords = new Set(words);
      const uniquenessRatio = uniqueWords.size / words.length;
      if (uniquenessRatio < (1 - (config.repetitionThreshold || 0.85))) {
        violations.push('repetitive_reasoning_detected');
        severity = severity === 'none' ? 'medium' : severity;
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    severity,
  };
}

// ── Execution State Machine ──────────────────────────────────────────────────

function createExecution(agentId, orgId, input, options) {
  const agent = getAgent(agentId, orgId);
  if (!agent) return { success: false, error: 'Agent not found' };
  if (!agent.enabled) return { success: false, error: 'Agent is disabled' };

  const execId = 'exec-' + crypto.randomBytes(6).toString('hex');
  const execution = {
    id: execId,
    agentId,
    orgId,
    input: input || '',
    options: options || {},
    state: EXECUTION_STATES.PENDING,
    steps: [],
    currentStep: 0,
    startedAt: null,
    completedAt: null,
    error: null,
    result: null,
    guardrailViolations: [],
    totalTokensUsed: 0,
    totalLatencyMs: 0,
  };

  activeExecutions.set(execId, execution);

  // Update agent stats
  const store = readStore();
  const key = makeKey(orgId, agentId);
  if (store.agents[key]) {
    store.agents[key].executionCount = (store.agents[key].executionCount || 0) + 1;
    store.agents[key].lastExecutedAt = new Date().toISOString();
    writeStore(store);
  }

  return { success: true, executionId: execId };
}

function startStep(execId, stepData) {
  const exec = activeExecutions.get(execId);
  if (!exec) return null;

  const step = {
    index: exec.steps.length,
    state: STEP_STATES.PENDING,
    prompt: stepData.prompt || '',
    reasoning: '',
    toolCalls: [],
    toolResults: [],
    guardrailResult: null,
    startedAt: Date.now(),
    completedAt: null,
    latencyMs: 0,
    tokensUsed: 0,
    error: null,
  };

  exec.steps.push(step);
  exec.currentStep = exec.steps.length - 1;
  step.state = STEP_STATES.EXECUTING;
  return step;
}

function completeStep(execId, stepIndex, result) {
  const exec = activeExecutions.get(execId);
  if (!exec || !exec.steps[stepIndex]) return null;

  const step = exec.steps[stepIndex];
  step.reasoning = result.reasoning || result.text || '';
  step.tokensUsed = result.tokensUsed || 0;
  step.latencyMs = Date.now() - step.startedAt;
  step.completedAt = Date.now();
  exec.totalTokensUsed += step.tokensUsed;
  exec.totalLatencyMs += step.latencyMs;

  // Run guardrail inspection
  const agent = getAgent(exec.agentId, exec.orgId);
  const config = agent ? agent.config : DEFAULT_AGENT_CONFIG;
  step.guardrailResult = inspectStep(step.reasoning, config);

  if (!step.guardrailResult.passed) {
    step.state = STEP_STATES.BLOCKED;
    exec.guardrailViolations.push({
      step: stepIndex,
      violations: step.guardrailResult.violations,
      severity: step.guardrailResult.severity,
    });

    if (config.guardrailStrictMode || step.guardrailResult.severity === 'critical') {
      exec.state = EXECUTION_STATES.GUARDRAIL_BLOCKED;
      exec.error = 'Guardrail violation at step ' + stepIndex + ': ' + step.guardrailResult.violations.join(', ');
      finalizeExecution(execId);
    }
  } else {
    step.state = STEP_STATES.COMPLETED;
  }

  return step;
}

function addToolCall(execId, stepIndex, toolName, args) {
  const exec = activeExecutions.get(execId);
  if (!exec || !exec.steps[stepIndex]) return;
  // Validate tool request against registered schema
  var reqValidation = schemaValidator.validateRequest(toolName, args, exec.orgId);
  exec.steps[stepIndex].toolCalls.push({
    tool: toolName, args, timestamp: Date.now(),
    schemaValid: reqValidation.valid,
    schemaErrors: reqValidation.errors || [],
    schemaSkipped: reqValidation.skipped || false,
  });
}

function addToolResult(execId, stepIndex, toolName, result) {
  const exec = activeExecutions.get(execId);
  if (!exec || !exec.steps[stepIndex]) return;
  // Validate tool response against registered schema
  var resValidation = schemaValidator.validateResponse(toolName, result, exec.orgId);
  exec.steps[stepIndex].toolResults.push({
    tool: toolName, result, timestamp: Date.now(),
    schemaValid: resValidation.valid,
    schemaErrors: resValidation.errors || [],
    schemaSkipped: resValidation.skipped || false,
  });
  // In strict mode, mark step as blocked if response schema validation fails
  if (!resValidation.valid && !resValidation.skipped) {
    var schema = schemaValidator.getSchema(toolName, exec.orgId);
    var globalConfig = schemaValidator.getConfig();
    if ((schema && schema.strictMode) || globalConfig.strictMode) {
      exec.steps[stepIndex].state = STEP_STATES.BLOCKED;
      exec.guardrailViolations.push({
        step: stepIndex,
        violations: ['tool_schema_validation_failed'],
        severity: 'high',
        tool: toolName,
        errors: resValidation.errors,
      });
    }
  }
}

function finalizeExecution(execId) {
  const exec = activeExecutions.get(execId);
  if (!exec) return;

  exec.completedAt = new Date().toISOString();
  if (exec.state === EXECUTION_STATES.RUNNING || exec.state === EXECUTION_STATES.PENDING) {
    exec.state = EXECUTION_STATES.COMPLETED;
  }

  // Move to history
  executionHistory.push({ ...exec });
  if (executionHistory.length > MAX_HISTORY) executionHistory.shift();

  // Keep in active for a short window for polling, then clean up
  setTimeout(() => {
    activeExecutions.delete(execId);
  }, 60000);
}

function getExecution(execId) {
  return activeExecutions.get(execId) || executionHistory.find(e => e.id === execId) || null;
}

function getActiveExecutions(orgId) {
  return Array.from(activeExecutions.values()).filter(e => e.orgId === orgId);
}

function getExecutionHistory(orgId, limit) {
  limit = limit || 50;
  return executionHistory
    .filter(e => e.orgId === orgId)
    .slice()
    .reverse()
    .slice(0, limit);
}

function pauseExecution(execId) {
  const exec = activeExecutions.get(execId);
  if (!exec) return { success: false, error: 'Execution not found' };
  if (exec.state !== EXECUTION_STATES.RUNNING) return { success: false, error: 'Execution not running' };
  exec.state = EXECUTION_STATES.PAUSED;
  return { success: true };
}

function resumeExecution(execId) {
  const exec = activeExecutions.get(execId);
  if (!exec) return { success: false, error: 'Execution not found' };
  if (exec.state !== EXECUTION_STATES.PAUSED) return { success: false, error: 'Execution not paused' };
  exec.state = EXECUTION_STATES.RUNNING;
  return { success: true };
}

function abortExecution(execId) {
  const exec = activeExecutions.get(execId);
  if (!exec) return { success: false, error: 'Execution not found' };
  exec.state = EXECUTION_STATES.ABORTED;
  exec.error = 'Aborted by user';
  finalizeExecution(execId);
  return { success: true };
}

// ── Stats ────────────────────────────────────────────────────────────────────

function getStats(orgId) {
  const store = readStore();
  const orgAgents = Object.values(store.agents).filter(a => a.orgId === orgId);
  const allExecs = executionHistory.filter(e => e.orgId === orgId);
  const active = Array.from(activeExecutions.values()).filter(e => e.orgId === orgId);

  var totalSteps = 0;
  var guardrailBlocks = 0;
  var completed = 0;
  var failed = 0;
  var aborted = 0;
  var totalTokens = 0;
  var totalLatency = 0;

  for (var i = 0; i < allExecs.length; i++) {
    var e = allExecs[i];
    totalSteps += e.steps.length;
    totalTokens += e.totalTokensUsed || 0;
    totalLatency += e.totalLatencyMs || 0;
    if (e.state === EXECUTION_STATES.COMPLETED) completed++;
    if (e.state === EXECUTION_STATES.FAILED) failed++;
    if (e.state === EXECUTION_STATES.ABORTED) aborted++;
    if (e.state === EXECUTION_STATES.GUARDRAIL_BLOCKED) guardrailBlocks++;
  }

  var tools = listTools();
  var totalTools = Object.keys(tools.builtin).length + Object.keys(tools.custom).length;

  return {
    agentCount: orgAgents.length,
    activeExecutions: active.length,
    totalExecutions: allExecs.length,
    completed: completed,
    failed: failed,
    aborted: aborted,
    guardrailBlocks: guardrailBlocks,
    totalSteps: totalSteps,
    totalTokensUsed: totalTokens,
    totalLatencyMs: totalLatency,
    avgStepsPerExecution: allExecs.length > 0 ? totalSteps / allExecs.length : 0,
    avgLatencyMs: allExecs.length > 0 ? totalLatency / allExecs.length : 0,
    toolCount: totalTools,
    builtinToolCount: Object.keys(tools.builtin).length,
    customToolCount: Object.keys(tools.custom).length,
  };
}

// ── Execution Loop Engine ────────────────────────────────────────────────────

/**
 * Execute an agent loop. This is the core executor that:
 * 1. Creates an execution context
 * 2. Iterates through reasoning steps (calling the inference provider)
 * 3. Runs guardrail inspections between steps
 * 4. Tracks state machine transitions
 * 5. Handles tool calls if the agent has tools wired
 *
 * @param {string} agentId — Agent to execute
 * @param {string} orgId — Organization context
 * @param {string} input — User input/prompt
 * @param {function} inferenceFn — Function(prompt, options) => { text, usage }
 * @param {object} [options] — Execution options
 * @returns {Promise<object>} Execution result
 */
async function executeAgentLoop(agentId, orgId, input, inferenceFn, options) {
  options = options || {};
  const agent = getAgent(agentId, orgId);
  if (!agent) return { success: false, error: 'Agent not found' };
  if (!agent.enabled) return { success: false, error: 'Agent is disabled' };

  const config = agent.config;
  const maxSteps = options.maxSteps || config.maxSteps || 10;
  const createResult = createExecution(agentId, orgId, input, options);
  if (!createResult.success) return createResult;

  const execId = createResult.executionId;
  const exec = activeExecutions.get(execId);
  exec.state = EXECUTION_STATES.RUNNING;
  exec.startedAt = new Date().toISOString();

  var conversationHistory = [];
  var systemPrompt = agent.systemPrompt || config.systemPrompt || '';
  var lastOutput = '';

  try {
    for (var stepNum = 0; stepNum < maxSteps; stepNum++) {
      // Check if paused or aborted
      if (exec.state === EXECUTION_STATES.PAUSED) {
        // Wait for resume or abort
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (exec.state === EXECUTION_STATES.PAUSED) continue;
        if (exec.state === EXECUTION_STATES.ABORTED) break;
      }
      if (exec.state === EXECUTION_STATES.ABORTED) break;
      if (exec.state === EXECUTION_STATES.GUARDRAIL_BLOCKED) break;

      // Build step prompt
      var stepPrompt;
      if (stepNum === 0) {
        stepPrompt = systemPrompt ? systemPrompt + '\n\n' + input : input;
      } else {
        stepPrompt = 'Continue reasoning. Previous output: ' + lastOutput + '\n\nProceed to the next step or provide a final answer.';
      }

      var step = startStep(execId, { prompt: stepPrompt });
      if (!step) break;

      // Call inference
      var inferenceResult;
      try {
        inferenceResult = await inferenceFn(stepPrompt, {
          provider: config.provider,
          model: config.model,
          temperature: config.temperature,
          maxTokens: options.maxTokensPerStep || 2000,
        });
      } catch (infErr) {
        step.state = STEP_STATES.FAILED;
        step.error = infErr.message;
        step.completedAt = Date.now();
        step.latencyMs = Date.now() - step.startedAt;
        exec.state = EXECUTION_STATES.FAILED;
        exec.error = 'Inference failed at step ' + stepNum + ': ' + infErr.message;
        finalizeExecution(execId);
        return { success: false, executionId: execId, error: exec.error };
      }

      lastOutput = inferenceResult.text || inferenceResult.output || '';
      conversationHistory.push({ step: stepNum, role: 'assistant', content: lastOutput });

      var stepResult = completeStep(execId, stepNum, {
        reasoning: lastOutput,
        text: lastOutput,
        tokensUsed: inferenceResult.usage ? (inferenceResult.usage.total_tokens || 0) : 0,
      });

      // Check guardrail
      if (stepResult && stepResult.state === STEP_STATES.BLOCKED) {
        logger.warn('[AgenticOrchestration] Guardrail blocked execution ' + execId + ' at step ' + stepNum);
        break;
      }

      // Check for completion indicators
      if (looksComplete(lastOutput)) {
        exec.result = lastOutput;
        exec.state = EXECUTION_STATES.COMPLETED;
        finalizeExecution(execId);
        return { success: true, executionId: execId, result: lastOutput, steps: stepNum + 1 };
      }
    }

    // Reached max steps
    if (exec.state === EXECUTION_STATES.RUNNING) {
      exec.result = lastOutput;
      exec.state = EXECUTION_STATES.COMPLETED;
    }

    finalizeExecution(execId);
    return { success: true, executionId: execId, result: lastOutput, steps: exec.steps.length };
  } catch (err) {
    exec.state = EXECUTION_STATES.FAILED;
    exec.error = err.message;
    finalizeExecution(execId);
    logger.error('[AgenticOrchestration] Execution ' + execId + ' failed: ' + err.message);
    return { success: false, executionId: execId, error: err.message };
  }
}

function looksComplete(text) {
  if (!text || text.length < 10) return false;
  const completionIndicators = [
    /\b(?:final answer|task complete|done|finished|in conclusion|to summarize|in summary)\b/i,
    /\b(?:the (?:answer|solution|result) is)\b/i,
  ];
  for (const pattern of completionIndicators) {
    if (pattern.test(text)) return true;
  }
  return false;
}

module.exports = {
  BUILTIN_TOOLS: BUILTIN_TOOLS,
  EXECUTION_STATES: EXECUTION_STATES,
  STEP_STATES: STEP_STATES,
  DEFAULT_AGENT_CONFIG: DEFAULT_AGENT_CONFIG,
  getAgent: getAgent,
  getAllAgents: getAllAgents,
  createAgent: createAgent,
  updateAgent: updateAgent,
  deleteAgent: deleteAgent,
  listTools: listTools,
  registerTool: registerTool,
  unregisterTool: unregisterTool,
  inspectStep: inspectStep,
  createExecution: createExecution,
  getExecution: getExecution,
  getActiveExecutions: getActiveExecutions,
  getExecutionHistory: getExecutionHistory,
  pauseExecution: pauseExecution,
  resumeExecution: resumeExecution,
  abortExecution: abortExecution,
  getStats: getStats,
  executeAgentLoop: executeAgentLoop,
};
