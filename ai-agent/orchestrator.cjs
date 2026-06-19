// SPDX-License-Identifier: MIT
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlanningPrompt, getVerificationPrompt } = require('./prompts.js');
const { proposeInlineFix } = require('../ai-tools/index.js');

const DEBUG = process.env.AGENT_DEBUG === 'true';
function debugLog(...args) { if (DEBUG) console.log(...args); }
function debugError(...args) { if (DEBUG) console.error(...args); }

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
    const planningPrompt = getPlanningPrompt(userGoal);
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

function validateStep(step, stepNum) {
    if (!step || typeof step.op !== 'string') {
        debugError(`❌ [Step ${stepNum}] Invalid step structure: missing "op" field`);
        return { valid: false, error: `Invalid step ${stepNum}` };
    }
    if (step.path) {
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
        const verificationPrompt = getVerificationPrompt(logOutput);
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
