// simplebeacon-ignore: debugArtifacts, security
// SPDX-License-Identifier: MIT
// simplebeacon-ignore memory-leak — plan execution with short-lived iterations
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlanningPrompt, getVerificationPrompt } = require('./prompts.js');
const { proposeInlineFix } = require('../ai-tools/index.js');

const DEBUG = process.env.AGENT_DEBUG === 'true';
function debugLog(...args) { if (DEBUG) process.stdout.write([...args].join(" ") + "\n"); } // simplebeacon-ignore debug-artifact — gated by AGENT_DEBUG env var
function debugError(...args) { if (DEBUG) process.stderr.write([...args].join(" ") + "\n"); } // simplebeacon-ignore debug-artifact — gated by AGENT_DEBUG env var

function getOllamaUrl() {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

function getModelName() {
    return process.env.AGENT_MODEL || 'llama3.2:latest';
}

/**
 * Helper to call the local 2B model synchronously via Ollama's generate endpoint.
 */
async function callLocalModel(prompt) {
    const ollamaUrl = getOllamaUrl();
    const modelName = getModelName();
    try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                prompt: prompt,
                stream: false,
                options: { temperature: 0.0 }
            })
        });
        if (!response.ok) {
            throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return (data.response || '').trim();
    } catch (err) {
        throw new Error(`[Ollama Connection Error] Ensure Ollama is running local model ${modelName}: ${err.message}`);
    }
}

async function generatePlan(userGoal) {
    const planningPrompt = getPlanningPrompt(userGoal); // simplebeacon-ignore debug-artifact — core orchestration logic, not a debug stub
    return await callLocalModel(planningPrompt);
}

function parsePlan(planResponse) {
    const cleaned = planResponse.replace(/```[a-z]*|```/g, '').trim();
    const plan = JSON.parse(cleaned);
    if (!Array.isArray(plan)) {
        throw new Error('Plan is not a JSON array');
    }
    return plan;
}

function looksLikeHallucinatedPath(pathStr) {
    const base = path.basename(pathStr, path.extname(pathStr));
    return /^[A-Z\s]+$/.test(base);
}

function validateStep(step, stepNum) {
    if (!step || typeof step.op !== 'string') {
        debugError(`❌ [Step ${stepNum}] Invalid step structure: missing "op" field`);
        return { valid: false, error: `Invalid step ${stepNum}` };
    }
    if (step.path) {
        if (looksLikeHallucinatedPath(step.path)) {
            debugError(`🛡️ [Safety Block] Step ${stepNum} tried to reference hallucinated path: ${step.path}`);
            return { valid: false, error: `Ghost file safety violation: ${step.path}` };
        }
        const fullPath = path.resolve(process.cwd(), step.path);
        if (!fs.existsSync(fullPath)) {
            debugError(`🛡️ [Safety Block] Step ${stepNum} tried to reference ghost file: ${step.path}`);
            return { valid: false, error: `Ghost file safety violation: ${step.path}` };
        }
    }
    return { valid: true };
}

function executeReadFile(step, stepNum) {
    debugLog(`🔍 [Step ${stepNum}] read_file: ${step.path}`);
    const fullPath = path.resolve(process.cwd(), step.path);
    const content = fs.readFileSync(fullPath, 'utf8');
    return { step: stepNum, op: 'read_file', path: step.path, size: content.length };
}

function executePatchFile(step, stepNum) {
    debugLog(`🧹 [Step ${stepNum}] patch_file: ${step.path}`);
    if (!step.search || !step.replace) {
        debugError(`❌ [Step ${stepNum}] patch_file requires "search" and "replace" fields`);
        return { ok: false, error: `Missing patch fields at step ${stepNum}` };
    }
    const result = proposeInlineFix(step.path, step.search, step.replace);
    if (!result.ok) {
        debugError(`❌ [Step ${stepNum}] Patch failed: ${result.error}`);
        return { ok: false, error: result.error, step: stepNum };
    }
    debugLog(`✅ [Step ${stepNum}] Patch applied and syntax verified`);
    return { ok: true, log: { step: stepNum, op: 'patch_file', path: step.path, status: 'ok' } };
}

function runTests() {
    try {
        const logOutput = execSync('npm test', { encoding: 'utf8', stdio: 'pipe', cwd: process.cwd() });
        return { logOutput, testExitCode: 0 };
    } catch (err) {
        return { logOutput: err.stdout || err.message, testExitCode: err.status || 1 };
    }
}

async function verifyTests(logOutput, stepNum) {
    debugLog(`🔍 [Step ${stepNum}] Sending test output to ${MODEL_NAME} for verification...`);
    let assessment;
    try {
        const verificationPrompt = getVerificationPrompt(logOutput); // simplebeacon-ignore debug-artifact — core orchestration logic, not a debug stub
        assessment = await callLocalModel(verificationPrompt);
    } catch (err) {
        debugError(`❌ [Step ${stepNum}] Cannot reach Ollama for verification: ${err.message}`);
        return { ok: false, error: err.message };
    }
    if (assessment !== 'SUCCESS') {
        debugError(`❌ [Verification Failure] 2B model assessment: ${assessment}`);
        debugError('   Test output (first 500 chars):', logOutput.slice(0, 500));
        return { ok: false, error: 'Test verification failed', assessment };
    }
    debugLog(`✅ [Step ${stepNum}] 2B model confirms tests passing`);
    return { ok: true };
}

async function executeRunTests(stepNum) {
    debugLog(`🧪 [Step ${stepNum}] run_tests: invoking project test runner...`);
    const { logOutput, testExitCode } = runTests();
    const verifyResult = await verifyTests(logOutput, stepNum);
    if (!verifyResult.ok) {
        return { ok: false, ...verifyResult };
    }
    return { ok: true, log: { step: stepNum, op: 'run_tests', exitCode: testExitCode } };
}

const stepExecutors = {
    read_file: (step, stepNum) => ({ ok: true, log: executeReadFile(step, stepNum) }),
    patch_file: (step, stepNum) => {
        const result = executePatchFile(step, stepNum);
        return result.ok ? { ok: true, log: result.log } : { ok: false, error: result.error, step: stepNum };
    },
    run_tests: async (_step, stepNum) => await executeRunTests(stepNum),
};

async function executeStep(step, stepNum) {
    const executor = stepExecutors[step.op];
    if (!executor) {
        debugError(`❌ [Step ${stepNum}] Unknown operation: "${step.op}"`);
        return { ok: false, error: `Unknown operation: ${step.op}` };
    }
    return await executor(step, stepNum);
}

/**
 * Core Agentic Orchestrator Loop
 * Plan → Execute → Verify
 */
async function executePlan(plan) {
    const executionLog = [];
    for (let i = 0; i < plan.length; i++) {
        const step = plan[i];
        const stepNum = i + 1;

        const validation = validateStep(step, stepNum);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const result = await executeStep(step, stepNum);
        if (!result.ok) {
            return { success: false, error: result.error, step: result.step, assessment: result.assessment };
        }
        executionLog.push(result.log);
    }
    return { success: true, executionLog };
}

async function runLocalAgent(userGoal) {
    debugLog(`\n🤖 [Agent Initialization] Goal: "${userGoal}"`);
    debugLog(`🧠 [Model] ${getModelName()} @ ${getOllamaUrl()}`);

    let planResponse;
    try {
        planResponse = await generatePlan(userGoal);
    } catch (err) {
        debugError(`❌ [Agent Failure] Cannot reach Ollama: ${err.message}`);
        return { success: false, error: err.message };
    }

    let plan;
    try {
        plan = parsePlan(planResponse);
    } catch (parseErr) {
        debugError('❌ [Agent Failure] The 2B model failed to return a valid JSON array structure.');
        debugError('   Raw response:', planResponse.slice(0, 500));
        return { success: false, error: 'Malformed plan structure', raw: planResponse };
    }

    debugLog(`📋 [Agent Plan Generated] Executing ${plan.length} steps...\n`);

    const result = await executePlan(plan);
    if (!result.success) {
        return result;
    }

    debugLog('\n🎯 [Goal Reached] Agent loop completed successfully.');
    return { success: true, steps: result.executionLog.length };
}

module.exports = { runLocalAgent, callLocalModel, validateStep, executeReadFile, parsePlan, executePatchFile };

// ─── Optimized Agent Loop (token-optimizer + sandbox + cache + escalation) ──

const tokenOptimizer = require('./plugins/token-optimizer.cjs');
const sandboxRunner = require('./plugins/sandbox-runner.cjs');
const { tryCache, storeCache, buildEscalationPrompt, shouldEscalate, logEscalation } = require('./plugins/cache-escalation.cjs');

/**
 * Run the optimized agent loop with token-optimized context, sandboxed
 * patch testing, response caching, and escalation management.
 *
 * Flow: summarize → build prompt → check cache → local model → sandbox test
 *       → verify → (escalate if needed) → log tokens
 *
 * @param {string} userGoal — what the agent should accomplish
 * @param {object} [opts] — { changedPaths, projectRoot, maxAttempts, index, maxTokens }
 * @returns {Promise<object>}
 */
async function runOptimizedAgent(userGoal, opts = {}) {
    const projectRoot = opts.projectRoot || process.cwd();
    const changedPaths = opts.changedPaths || [];
    const maxAttempts = opts.maxAttempts || 3;
    const maxTokens = opts.maxTokens || 4000;

    debugLog(`\n🤖 [Optimized Agent] Goal: "${userGoal}"`);
    debugLog(`📁 [Context] ${changedPaths.length} changed file(s)`);

    // Step 1: Build focused prompt with token-optimized context
    const { prompt, estimatedTokens, breakdown } = await tokenOptimizer.preparePromptForEdit(
        projectRoot,
        changedPaths,
        userGoal,
        { index: opts.index, k: 5, maxTokens }
    );

    debugLog(`📝 [Prompt] ${estimatedTokens} tokens (budget: ${maxTokens})`);
    debugLog(`   Summaries: ${breakdown.summaryTokens} tokens, Retrieval: ${breakdown.retrievalTokens} tokens`);

    if (!breakdown.withinBudget) {
        debugLog(`⚠️ [Warning] Prompt exceeds budget (${estimatedTokens} > ${maxTokens})`);
    }

    // Step 2: Check cache for a previous response to this prompt
    const cacheResult = tryCache(changedPaths, prompt);
    if (cacheResult.hit) {
        debugLog(`💾 [Cache Hit] Reusing cached response`);
        tokenOptimizer.logTokenUsage({
            event: 'cached_response',
            promptTokens: 0,
            completionTokens: 0,
            savedTokens: estimatedTokens,
            task: userGoal,
        });
        return { success: true, cached: true, response: cacheResult.response, tokenBreakdown: breakdown };
    }

    // Step 3: Local model attempts
    const attemptedPatches = [];
    const reasoningTrace = [];
    let lastTestOutput = '';
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        debugLog(`\n🔄 [Attempt ${attempt}/${maxAttempts}] Calling local model...`);

        let modelResponse;
        try {
            const attemptPrompt = attempt === 1
                ? prompt
                : `${prompt}\n\n## Previous attempt failed\nError: ${lastError}\nTest output:\n${lastTestOutput.slice(-1000)}\n\nProvide a corrected patch.`;
            modelResponse = await callLocalModel(attemptPrompt);
            reasoningTrace.push(`Attempt ${attempt}: ${modelResponse.slice(0, 200)}`);
        } catch (err) {
            debugError(`❌ [Attempt ${attempt}] Local model error: ${err.message}`);
            lastError = err.message;

            // Check if we should escalate
            if (shouldEscalate({ attempts: attempt, maxAttempts, lastError, taskComplexity: 'medium' })) {
                return await escalateToRemote({
                    intent: userGoal,
                    summaryText: prompt,
                    attemptedPatches,
                    lastTestOutput,
                    reasoningTrace: reasoningTrace.join('\n'),
                    attempts: attempt,
                    tokenBreakdown: breakdown,
                });
            }
            continue;
        }

        attemptedPatches.push(modelResponse);

        // Step 4: Try to parse and sandbox-test the patch
        // The model response should contain a search/replace patch
        const patch = parseModelPatch(modelResponse, changedPaths[0]);
        if (!patch) {
            debugLog(`⚠️ [Attempt ${attempt}] Could not parse patch from model response`);
            lastError = 'Could not parse patch from model response';
            continue;
        }

        // Step 5: Sandbox test
        debugLog(`🧪 [Attempt ${attempt}] Testing patch in sandbox...`);
        const sandboxResult = await sandboxRunner.sandboxPatchAndTest(
            projectRoot,
            changedPaths,
            patch,
            { testCommand: opts.testCommand, testArgs: opts.testArgs, timeoutMs: 30000 }
        );

        if (sandboxResult.testsPassed) {
            debugLog(`✅ [Attempt ${attempt}] Patch passed tests in sandbox!`);

            // Cache the successful response
            storeCache(cacheResult.key, modelResponse);

            // Log token usage
            tokenOptimizer.logTokenUsage({
                event: 'edit_success',
                promptTokens: estimatedTokens,
                completionTokens: tokenOptimizer.estimateTokens(modelResponse),
                savedTokens: 50000 - estimatedTokens, // estimated savings vs whole-repo dump
                task: userGoal,
                model: getModelName(),
            });

            return {
                success: true,
                cached: false,
                attempts: attempt,
                patch,
                diff: sandboxResult.diff,
                response: modelResponse,
                tokenBreakdown: breakdown,
            };
        }

        lastTestOutput = sandboxResult.testOutput || '';
        lastError = sandboxResult.error || 'Tests failed in sandbox';
        debugLog(`❌ [Attempt ${attempt}] Sandbox test failed: ${lastError}`);

        // Check escalation
        if (shouldEscalate({ attempts: attempt, maxAttempts, lastError, taskComplexity: 'medium' })) {
            return await escalateToRemote({
                intent: userGoal,
                summaryText: prompt,
                attemptedPatches,
                lastTestOutput,
                reasoningTrace: reasoningTrace.join('\n'),
                attempts: attempt,
                tokenBreakdown: breakdown,
            });
        }
    }

    // All local attempts exhausted — escalate
    return await escalateToRemote({
        intent: userGoal,
        summaryText: prompt,
        attemptedPatches,
        lastTestOutput,
        reasoningTrace: reasoningTrace.join('\n'),
        attempts: maxAttempts,
        tokenBreakdown: breakdown,
    });
}

/**
 * Attempt to parse a search/replace patch from a model response.
 * Expects the model to output something like:
 *   SEARCH:
 *   <original code>
 *   REPLACE:
 *   <new code>
 *
 * @param {string} response
 * @param {string} defaultPath
 * @returns {object|null} — { path, search, replace }
 */
function parseModelPatch(response, defaultPath) {
    if (!response) return null;

    // Try SEARCH:/REPLACE: format
    const searchMatch = response.match(/SEARCH:\s*\n?([\s\S]*?)\n\s*REPLACE:\s*\n?([\s\S]*?)(?:\n\s*(?:##|---|\n$|$))/i);
    if (searchMatch) {
        return {
            path: defaultPath,
            search: searchMatch[1].trim(),
            replace: searchMatch[2].trim(),
        };
    }

    // Try diff format
    const diffMatch = response.match(/```diff\n([\s\S]*?)```/);
    if (diffMatch) {
        const diff = diffMatch[1];
        const removed = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1)).join('\n');
        const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n');
        if (removed && added) {
            return { path: defaultPath, search: removed, replace: added };
        }
    }

    return null;
}

/**
 * Escalate to a remote model with a focused prompt.
 */
async function escalateToRemote(params) {
    const escalationPrompt = buildEscalationPrompt(params);
    const escalationTokens = tokenOptimizer.estimateTokens(escalationPrompt);

    debugLog(`\n🚀 [Escalation] Building focused prompt for remote model (${escalationTokens} tokens)`);

    logEscalation({
        intent: params.intent,
        attempts: params.attempts,
        tokensUsed: escalationTokens,
    });

    tokenOptimizer.logTokenUsage({
        event: 'escalation',
        promptTokens: escalationTokens,
        completionTokens: 0,
        savedTokens: 50000 - escalationTokens,
        task: params.intent,
        model: 'remote',
    });

    return {
        success: false,
        escalated: true,
        escalationPrompt,
        escalationTokens,
        attempts: params.attempts,
        tokenBreakdown: params.tokenBreakdown,
        message: 'Local model could not resolve the task. Escalation prompt built for remote model.',
    };
}

module.exports.runOptimizedAgent = runOptimizedAgent;
module.exports.parseModelPatch = parseModelPatch;
