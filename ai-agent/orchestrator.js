const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlanningPrompt, getVerificationPrompt } = require('./prompts.js');
const { proposeInlineFix, verifyFileSyntax } = require('../ai-tools/index.js');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.AGENT_MODEL || 'llama3.2:latest';

/**
 * Helper to call the local 2B model synchronously via Ollama's generate endpoint.
 */
async function callLocalModel(prompt) {
    try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
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
        throw new Error(`[Ollama Connection Error] Ensure Ollama is running local model ${MODEL_NAME}: ${err.message}`);
    }
}

/**
 * Core Agentic Orchestrator Loop
 * Plan → Execute → Verify
 */
async function runLocalAgent(userGoal) {
    console.log(`\n🤖 [Agent Initialization] Goal: "${userGoal}"`);
    console.log(`🧠 [Model] ${MODEL_NAME} @ ${OLLAMA_URL}`);

    // Step 1: PLAN (Generate Steps via 2B model)
    const planningPrompt = getPlanningPrompt(userGoal);
    const planResponse = await callLocalModel(planningPrompt);

    let plan;
    try {
        // Strip markdown fences if the model wrapped JSON in code blocks
        const cleaned = planResponse.replace(/```[a-z]*|```/g, '').trim();
        plan = JSON.parse(cleaned);
        if (!Array.isArray(plan)) {
            throw new Error('Plan is not a JSON array');
        }
    } catch (parseErr) {
        console.error('❌ [Agent Failure] The 2B model failed to return a valid JSON array structure.');
        console.error('   Raw response:', planResponse.slice(0, 500));
        return { success: false, error: 'Malformed plan structure', raw: planResponse };
    }

    console.log(`📋 [Agent Plan Generated] Executing ${plan.length} steps...\n`);

    const executionLog = [];

    // Step 2: EXECUTE (Iterate through steps natively)
    for (let i = 0; i < plan.length; i++) {
        const step = plan[i];
        const stepNum = i + 1;

        if (!step || typeof step.op !== 'string') {
            console.error(`❌ [Step ${stepNum}] Invalid step structure: missing "op" field`);
            return { success: false, error: `Invalid step ${stepNum}` };
        }

        // AGENTS.md Rule Guard: Block operations on ghost files
        if (step.path) {
            const fullPath = path.resolve(process.cwd(), step.path);
            if (!fs.existsSync(fullPath)) {
                console.error(`🛡️ [Safety Block] Step ${stepNum} tried to reference ghost file: ${step.path}`);
                return { success: false, error: `Ghost file safety violation: ${step.path}` };
            }
        }

        switch (step.op) {
            case 'read_file': {
                console.log(`🔍 [Step ${stepNum}] read_file: ${step.path}`);
                const fullPath = path.resolve(process.cwd(), step.path);
                const content = fs.readFileSync(fullPath, 'utf8');
                executionLog.push({ step: stepNum, op: 'read_file', path: step.path, size: content.length });
                // Store content in a context variable for potential chaining (not used in current simple loop)
                break;
            }

            case 'patch_file': {
                console.log(`🧹 [Step ${stepNum}] patch_file: ${step.path}`);
                if (!step.search || !step.replace) {
                    console.error(`❌ [Step ${stepNum}] patch_file requires "search" and "replace" fields`);
                    return { success: false, error: `Missing patch fields at step ${stepNum}` };
                }

                const result = proposeInlineFix(step.path, step.search, step.replace);
                if (!result.ok) {
                    console.error(`❌ [Step ${stepNum}] Patch failed: ${result.error}`);
                    return { success: false, error: result.error, step: stepNum };
                }
                console.log(`✅ [Step ${stepNum}] Patch applied and syntax verified`);
                executionLog.push({ step: stepNum, op: 'patch_file', path: step.path, status: 'ok' });
                break;
            }

            case 'run_tests': {
                console.log(`🧪 [Step ${stepNum}] run_tests: invoking project test runner...`);
                let logOutput;
                let testExitCode = 0;
                try {
                    logOutput = execSync('npm test', { encoding: 'utf8', stdio: 'pipe', cwd: process.cwd() });
                } catch (err) {
                    logOutput = err.stdout || err.message;
                    testExitCode = err.status || 1;
                }
                executionLog.push({ step: stepNum, op: 'run_tests', exitCode: testExitCode });

                // Step 3: VERIFY (Let the 2B model evaluate the raw text outcome)
                console.log(`🔍 [Step ${stepNum}] Sending test output to ${MODEL_NAME} for verification...`);
                const verificationPrompt = getVerificationPrompt(logOutput);
                const assessment = await callLocalModel(verificationPrompt);

                if (assessment !== 'SUCCESS') {
                    console.error(`❌ [Verification Failure] 2B model assessment: ${assessment}`);
                    console.error('   Test output (first 500 chars):', logOutput.slice(0, 500));
                    return { success: false, error: 'Test verification failed', assessment };
                }
                console.log(`✅ [Step ${stepNum}] 2B model confirms tests passing`);
                break;
            }

            default: {
                console.error(`❌ [Step ${stepNum}] Unknown operation: "${step.op}"`);
                return { success: false, error: `Unknown operation: ${step.op}` };
            }
        }
    }

    console.log('\n🎯 [Goal Reached] Agent loop completed successfully.');
    return { success: true, steps: executionLog.length };
}

module.exports = { runLocalAgent, callLocalModel };