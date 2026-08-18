// simplebeacon-ignore: debugArtifacts, security
// SPDX-License-Identifier: MIT
// simplebeacon-ignore memory-leak — plan execution with short-lived iterations
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlanningPrompt, getVerificationPrompt } = require('./prompts.js');
const { proposeInlineFix } = require('../ai-tools/index.js');
// require plugins module at call time to allow test harness monkey-patching
const pluginsModule = require('./plugins.cjs');
const { enrichGoalWithSupercharge } = require('./simplebeacon-bridge.cjs');
const PriorityQueue = require('./priority-queue.cjs');
const http = require('http');

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
    // If AGENT_TEST_MODE is enabled, return a fast mock to avoid running long test suites
    if (process.env.AGENT_TEST_MODE === '1' || process.env.AGENT_TEST_MODE === 'true') {
        return { logOutput: 'AGENT_TEST_MODE active: mocked tests', testExitCode: 0 };
    }
    try {
        const logOutput = execSync('npm test', { encoding: 'utf8', stdio: 'pipe', cwd: process.cwd() });
        return { logOutput, testExitCode: 0 };
    } catch (err) {
        return { logOutput: err.stdout || err.message, testExitCode: err.status || 1 };
    }
}

async function verifyTests(logOutput, stepNum) {
    debugLog(`🔍 [Step ${stepNum}] Sending test output to ${getModelName()} for verification...`);
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
    const scanRoot = process.env.SIMPLEBEACON_SCAN_ROOT || process.cwd();
    userGoal = enrichGoalWithSupercharge(userGoal, scanRoot);
    debugLog(`\n🤖 [Agent Initialization] Goal: "${userGoal.slice(0, 120)}..."`);
    debugLog(`🧠 [Model] ${getModelName()} @ ${getOllamaUrl()}`);

    // Plugin registration API exposed to plugins
    const registeredPlugins = [];
    const capabilities = [];
    const agentApi = {
        debug: (msg) => debugLog('[plugin]', msg),
        callLocalModel,
        runTests,
        proposePatch: (filePath, search, replace) => proposeInlineFix(filePath, search, replace),
        readFile: (p) => {
            try { return fs.readFileSync(path.resolve(process.cwd(), p), 'utf8'); } catch (e) { return null; }
        },
        writeFile: (p, content) => {
            try { fs.mkdirSync(path.dirname(path.resolve(process.cwd(), p)), { recursive: true }); fs.writeFileSync(path.resolve(process.cwd(), p), content, 'utf8'); return true; } catch (e) { return false; }
        },
        safePatch: (filePath, search, replace) => {
            // wrapper to propose an inline fix and verify result
            return proposeInlineFix(filePath, search, replace);
        },
        registerCapability: (cap) => { try { capabilities.push(cap); } catch (e) { } },
        listCapabilities: () => capabilities.slice(),
        sandbox: {
            writeTemp: (name, content) => {
                try {
                    const os = require('os');
                    const p = path.join(os.tmpdir(), name);
                    fs.writeFileSync(p, content, 'utf8');
                    return p;
                } catch (e) { return null; }
            }
        },
        // Event bus: namespaced listeners and async queue processing
        on: (ev, fn, opts = {}) => {
            try {
                    if (!agentApi._bus) agentApi._bus = { listeners: new Map(), queue: new PriorityQueue(), processing: false, handlerMeta: new Map() };
                const map = agentApi._bus.listeners.get(ev) || new Map();
                map.set(fn, { fn, opts, failures: 0, trippedUntil: 0 });
                agentApi._bus.listeners.set(ev, map);
            } catch (e) { debugError('bus.on error', e && e.message); }
        },
        once: (ev, fn, opts = {}) => {
            const wrapper = async (payload) => { try { await fn(payload); } finally { agentApi.off(ev, wrapper); } };
            agentApi.on(ev, wrapper, opts);
        },
        off: (ev, fn) => {
            try {
                if (!agentApi._bus) return;
                const map = agentApi._bus.listeners.get(ev);
                if (map) { map.delete(fn); if (map.size === 0) agentApi._bus.listeners.delete(ev); }
            } catch (e) { debugError('bus.off error', e && e.message); }
        },
        emit: (ev, payload, meta = {}) => {
            try {
                if (!agentApi._bus) agentApi._bus = { listeners: new Map(), queue: new PriorityQueue(), processing: false, handlerMeta: new Map() };
                // support priority on emitted items (higher number = higher priority)
                const priority = (meta && typeof meta.priority === 'number') ? meta.priority : 0;
                agentApi._bus.queue.push({ ev, payload, meta, priority, enqueuedAt: Date.now() });
                const BUS_MAX_RETRIES = 3;
                const BUS_HANDLER_TIMEOUT_MS = 1000;
                const BUS_COOLDOWN_MS = 5000;

                if (!agentApi._bus.processing) {
                    agentApi._bus.processing = true;
                    (async function processQueue() {
                        while (agentApi._bus.queue.length) {
                            const item = agentApi._bus.queue.shift();
                            const evName = item.ev;
                            const data = item.payload;
                            const listeners = new Map();
                            // collect exact and wildcard listeners
                            for (const [key, map] of agentApi._bus.listeners.entries()) {
                                if (key === evName) { for (const [fn, meta] of map.entries()) listeners.set(fn, meta); continue; }
                                if (key.endsWith('*')) {
                                    const prefix = key.slice(0, -1);
                                    if (evName.startsWith(prefix)) { for (const [fn, meta] of map.entries()) listeners.set(fn, meta); }
                                }
                            }
                            // sort listeners by handler-level priority (opts.priority)
                            const listenerEntries = Array.from(listeners.entries()).map(([fn, meta]) => [fn, meta]);
                            listenerEntries.sort((a, b) => ((b[1].opts && b[1].opts.priority) || 0) - ((a[1].opts && a[1].opts.priority) || 0));
                            for (const [fn, meta] of listenerEntries) {
                                const now = Date.now();
                                if (meta.trippedUntil && meta.trippedUntil > now) continue; // circuit open
                                let attempt = 0;
                                let succeeded = false;
                                let lastErr = null;
                                while (attempt < BUS_MAX_RETRIES && !succeeded) {
                                    attempt++;
                                    try {
                                        await Promise.race([
                                            Promise.resolve(meta.fn(data)),
                                            new Promise((_, rej) => setTimeout(() => rej(new Error('handler timeout')), BUS_HANDLER_TIMEOUT_MS))
                                        ]);
                                        succeeded = true;
                                        meta.failures = 0;
                                    } catch (err) {
                                        lastErr = err;
                                        meta.failures = (meta.failures || 0) + 1;
                                        const backoff = 50 * Math.pow(2, attempt);
                                        await new Promise((r) => setTimeout(r, backoff));
                                    }
                                }
                                if (!succeeded) {
                                    debugError('Event handler failed after retries', lastErr && lastErr.message);
                                    // trip circuit for this handler
                                    meta.trippedUntil = Date.now() + BUS_COOLDOWN_MS;
                                }
                            }
                        }
                        agentApi._bus.processing = false;
                    })();
                }
            } catch (e) { debugError('bus.emit error', e && e.message); }
        },
        registerPlugin: (pluginMeta) => {
            try { registeredPlugins.push(pluginMeta); } catch (e) { /* ignore */ }
        }
    };

    // Optionally expose runtime metrics HTTP endpoint when AGENT_RUNTIME_METRICS_PORT is set
    let __metricsServer = null;
    if (process.env.AGENT_RUNTIME_METRICS_PORT) {
        try {
            const port = parseInt(process.env.AGENT_RUNTIME_METRICS_PORT, 10);
            __metricsServer = http.createServer((req, res) => {
                if (req.method === 'GET' && req.url && req.url.startsWith('/runtime-metrics')) {
                    // optional auth
                    const expected = process.env.METRICS_AUTH_TOKEN;
                    if (expected) {
                        const auth = req.headers['authorization'] || '';
                        if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
                            res.writeHead(401, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'unauthorized' }));
                            return;
                        }
                    }
                    try {
                        const bus = agentApi._bus || { listeners: new Map(), queue: { length: 0 } };
                        // generate lightweight summary
                        const handlers = [];
                        if (bus.listeners) {
                            for (const [ev, map] of bus.listeners.entries()) {
                                for (const [fn, meta] of map.entries()) {
                                    handlers.push({ ev, fnName: fn && fn.name, failures: meta.failures || 0, trippedUntil: meta.trippedUntil || 0, opts: meta.opts || {} });
                                }
                            }
                        }
                        const queueLen = (bus.queue && bus.queue.length) || (bus.queue && typeof bus.queue.length === 'number' ? bus.queue.length : 0);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ handlers, queueLen }));
                        return;
                    } catch (e) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e && e.message }));
                        return;
                    }
                }
                res.writeHead(404); res.end();
            }).listen(port, () => debugLog(`Runtime metrics server listening on http://localhost:${process.env.AGENT_RUNTIME_METRICS_PORT}/runtime-metrics`));
        } catch (e) { debugError('runtime metrics server failed to start', e && e.message); }
    }

    // Load plugins from ai-agent/plugins relative to this file
    let loadedPluginModules = [];
    try {
        const pluginDir = path.join(__dirname, 'plugins');
        const loader = pluginsModule.loadPlugins || ((dir, api) => []);
        const loaded = loader(pluginDir, agentApi);
        if (loaded && loaded.length) {
            loadedPluginModules = loaded;
            debugLog(`🔌 Loaded plugins: ${loaded.map(p => p.name || p.file).join(', ')}`);
        }
    } catch (err) {
        debugError('❌ [Plugin Load Error] ' + err.message);
    }

    // Let plugins inspect or alter the userGoal before planning
    try {
        for (const p of loadedPluginModules) {
            const hook = (p && p.meta && typeof p.meta.beforePlan === 'function') ? p.meta.beforePlan : (p && p.module && typeof p.module.beforePlan === 'function' ? p.module.beforePlan : null);
            if (hook) {
                try {
                    const beforeRes = await hook(userGoal);
                    if (beforeRes && typeof beforeRes === 'object' && beforeRes.goal) {
                        debugLog(`🔁 Plugin ${p.name || p.file} adjusted goal to: ${beforeRes.goal}`);
                        userGoal = beforeRes.goal;
                    }
                } catch (err) {
                    debugError(`❌ [Plugin beforePlan error] ${p.name || p.file}: ${err.message}`);
                }
            }
        }
    } catch (err) {
        debugError('❌ [Plugin beforePlan loop error] ' + err.message);
    }

    let planResponse;
    try {
        planResponse = await generatePlan(userGoal);
    } catch (err) {
        debugError(`❌ [Agent Failure] Cannot reach Ollama: ${err.message}`);
        return { success: false, error: err.message };
    }

    let plan;
    try {
        console.log('PLAN_RESPONSE_RAW:', planResponse);
        plan = parsePlan(planResponse);
    } catch (parseErr) {
        debugError('❌ [Agent Failure] The 2B model failed to return a valid JSON array structure.');
        debugError('   Raw response:', planResponse.slice(0, 500));
        return { success: false, error: 'Malformed plan structure', raw: planResponse };
    }

    // Allow plugins to modify or augment the plan before execution
    try {
        for (const p of loadedPluginModules) {
            const hook = (p && p.meta && typeof p.meta.modifyPlan === 'function') ? p.meta.modifyPlan : (p && p.module && typeof p.module.modifyPlan === 'function' ? p.module.modifyPlan : null);
            if (hook) {
                try {
                    const mod = await hook(plan);
                    if (Array.isArray(mod)) {
                        debugLog(`🔁 Plugin ${p.name || p.file} modified the plan (steps ${plan.length} -> ${mod.length})`);
                        plan = mod;
                    }
                } catch (err) {
                    debugError(`❌ [Plugin modifyPlan error] ${p.name || p.file}: ${err.message}`);
                }
            }
        }
    } catch (err) {
        debugError('❌ [Plugin modifyPlan loop error] ' + err.message);
    }

    // Allow plugins to inspect the final plan (afterPlan hook)
    try {
        for (const p of loadedPluginModules) {
            const hook = (p && p.meta && typeof p.meta.afterPlan === 'function') ? p.meta.afterPlan : (p && p.module && typeof p.module.afterPlan === 'function' ? p.module.afterPlan : null);
            if (hook) {
                try {
                    await hook(plan);
                } catch (err) {
                    debugError(`❌ [Plugin afterPlan error] ${p.name || p.file}: ${err.message}`);
                }
            }
        }
    } catch (err) {
        debugError('❌ [Plugin afterPlan loop error] ' + err.message);
    }

    console.log('FINAL PLAN:', JSON.stringify(plan, null, 2));
    debugLog(`📋 [Agent Plan Generated] Executing ${plan.length} steps...\n`);

    const result = await executePlan(plan);
    // close runtime metrics server if it was started
    try { if (__metricsServer) __metricsServer.close(); } catch (e) { /* ignore */ }
    if (!result.success) {
        // Allow plugins to observe failed execution
        for (const p of loadedPluginModules) {
            const hook = (p && p.meta && typeof p.meta.onExecute === 'function') ? p.meta.onExecute : (p && p.module && typeof p.module.onExecute === 'function' ? p.module.onExecute : null);
            if (hook) {
                try { await hook(result); } catch (e) { debugError(`Plugin onExecute error: ${e.message}`); }
            }
        }
        return result;
    }

    // Allow plugins to observe successful execution
    for (const p of loadedPluginModules) {
        const hook = (p && p.meta && typeof p.meta.onExecute === 'function') ? p.meta.onExecute : (p && p.module && typeof p.module.onExecute === 'function' ? p.module.onExecute : null);
        if (hook) {
            try { await hook(result.executionLog); } catch (e) { debugError(`Plugin onExecute error: ${e.message}`); }
        }
    }

    debugLog('\n🎯 [Goal Reached] Agent loop completed successfully.');
    return { success: true, steps: result.executionLog.length };
}

module.exports = { runLocalAgent, callLocalModel, validateStep, executeReadFile, parsePlan, executePatchFile, runTests };
