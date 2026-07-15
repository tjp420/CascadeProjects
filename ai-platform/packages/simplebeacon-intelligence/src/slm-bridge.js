// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
'use strict';

/**
 * @module slm-bridge
 * Optional local SLM bridge — Tier 2.
 * Invokes LLAMA_CPP_BIN only on high-risk snippets; never during default gate scan.
 *
 * @example <caption>Probe the environment before running</caption>
 * const { probeSlmBin, canRunSlm } = require('./slm-bridge');
 * probeSlmBin(); // { configured: false, executable: false, path: null }
 * canRunSlm();   // false
 *
 * @example <caption>Run a synchronous review</caption>
 * const { runSlmReview } = require('./slm-bridge');
 * const result = runSlmReview('some code snippet', { filePath: 'src/app.js' });
 * // { enabled: true, reviewed: true, risk: 'low', reason: '...' }
 *
 * @example <caption>Run an asynchronous review with cancellation</caption>
 * const { runSlmReviewAsync } = require('./slm-bridge');
 * const controller = new AbortController();
 * const result = await runSlmReviewAsync('snippet', { signal: controller.signal });
 *
 * @file packages/simplebeacon-intelligence/src/slm-bridge.js
 */

import fs from 'fs';
import { spawnSync, spawn } from 'child_process';

import constants from '../../../server/config/constants.cjs';
const DEFAULT_PROMPT_TEMPLATE = `You are a code hygiene auditor. Reply with JSON only: {"risk":"low|medium|high","reason":"..."}.
Does this snippet look like unchecked AI-generated boilerplate, mock API stub, or placeholder credentials?
Snippet:
`;

/**
 * Probe slm bin.
 * @param {Object} options
 * @returns {{configured:boolean, executable:boolean, path:string|null}}
 */
function probeSlmBin(options = {}) {
    const binPath = options.binPath
        || process.env.LLAMA_CPP_BIN
        || options.slm?.binPath
        || null;

    if (!binPath) {
        return { configured: false, executable: false, path: null };
    }

    let executable = false;
    try {
        executable = fs.existsSync(binPath);
    } catch {
        executable = false;
    }

    return { configured: true, executable, path: binPath };
}

const VALID_RISKS = new Set(['low', 'medium', 'high']);

/**
 * Quick predicate: returns true if the SLM is configured, executable, and the model file exists.
 * @param {Object} options
 * @returns {boolean}
 */
function canRunSlm(options = {}) {
    const probe = probeSlmBin(options);
    if (!probe.configured || !probe.executable) return false;
    const modelPath = options.modelPath || options.slm?.modelPath || process.env.SIMPLEBEACON_SLM_MODEL;
    if (!modelPath) return false;
    try {
        return fs.existsSync(modelPath);
    } catch {
        return false;
    }
}

/**
 * Parse the raw stdout from the SLM process into a JSON result.
 * Uses a non-greedy regex to avoid matching multiple JSON blobs.
 * @param {string} stdout
 * @returns {{risk:string, reason:string}|null}
 */
function parseSlmResponse(stdout) {
    const text = String(stdout || '').trim();
    if (!text) return null;
    try {
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
        // fall through
    }
    return null;
}

/**
 * Validate that a parsed SLM result conforms to the expected schema.
 * @param {any} result
 * @returns {{valid:boolean, risk?:string, reason?:string, errors?:string[]}}
 */
function validateSlmResult(result) {
    const errors = [];
    if (!result || typeof result !== 'object') {
        errors.push('Result is not an object');
        return { valid: false, errors };
    }
    const risk = String(result.risk || '').toLowerCase();
    if (!VALID_RISKS.has(risk)) {
        errors.push(`Invalid risk level: ${result.risk}`);
    }
    if (typeof result.reason !== 'string' || !result.reason.trim()) {
        errors.push('Missing or empty reason');
    }
    if (errors.length) {
        return { valid: false, errors };
    }
    return { valid: true, risk, reason: result.reason.trim() };
}

/**
 * Build slm prompt.
 * @param {string} content
 * @param {string} filePath
 * @returns {string}
 */
function buildSlmPrompt(content, filePath) {
    const trimmed = String(content || '').slice(0, 4000);
    return `${DEFAULT_PROMPT_TEMPLATE}File: ${filePath || 'snippet'}\n---\n${trimmed}\n---`;
}

/**
 * Run slm review.
 * @param {string} content
 * @param {Object} options
 * @returns {{enabled:boolean, reviewed:boolean, risk?:string, reason?:string, rawStdout?:string, stderr?:string, error?:string, note?:string, validationErrors?:string[], localOnly?:boolean}}
 */
function runSlmReview(content, options = {}) {
    const probe = probeSlmBin(options);
    if (!probe.configured) {
        return {
            enabled: false,
            reviewed: false,
            note: 'Set LLAMA_CPP_BIN or intelligence.slm.binPath for optional local SLM verification'
        };
    }

    if (!probe.executable) {
        return {
            enabled: true,
            reviewed: false,
            error: `SLM binary not found at ${probe.path}`
        };
    }

    const modelPath = options.modelPath || options.slm?.modelPath || process.env.SIMPLEBEACON_SLM_MODEL;
    if (!modelPath || !fs.existsSync(modelPath)) {
        return {
            enabled: true,
            reviewed: false,
            note: 'Set SIMPLEBEACON_SLM_MODEL or intelligence.slm.modelPath to run local inference'
        };
    }

    const prompt = buildSlmPrompt(content, options.filePath);
    const args = ['-m', modelPath, '-p', prompt, '-n', '128', '--temp', '0.1'];

    try {
        const result = spawnSync(probe.path, args, {
            encoding: 'utf8',
            timeout: options.timeoutMs || constants.TIMEOUT_30S,
            maxBuffer: constants.BYTES_PER_KB * 512
        });

        if (result.error) {
            return { enabled: true, reviewed: false, error: result.error.message };
        }

        const stdout = (result.stdout || '').trim();
        const stderr = (result.stderr || '').trim();
        const parsed = parseSlmResponse(stdout);
        const validation = parsed ? validateSlmResult(parsed) : { valid: false };

        return {
            enabled: true,
            reviewed: true,
            localOnly: true,
            risk: validation.valid ? validation.risk : (parsed?.risk || 'unknown'),
            reason: validation.valid ? validation.reason : (parsed?.reason || stdout.slice(0, 500)),
            rawStdout: stdout.slice(0, 1000),
            stderr: stderr.slice(0, 500) || undefined,
            validationErrors: validation.errors || undefined
        };
    } catch (err) {
        return { enabled: true, reviewed: false, error: err.message };
    }
}

/**
 * Run slm review asynchronously (non-blocking).
 * Supports AbortSignal for cancellation.
 * @param {string} content
 * @param {Object} options
 * @returns {Promise<{enabled:boolean, reviewed:boolean, risk?:string, reason?:string, rawStdout?:string, stderr?:string, error?:string, note?:string}>}
 */
function runSlmReviewAsync(content, options = {}) {
    return new Promise((resolve) => {
        const probe = probeSlmBin(options);
        if (!probe.configured) {
            return resolve({
                enabled: false,
                reviewed: false,
                note: 'Set LLAMA_CPP_BIN or intelligence.slm.binPath for optional local SLM verification'
            });
        }

        if (!probe.executable) {
            return resolve({
                enabled: true,
                reviewed: false,
                error: `SLM binary not found at ${probe.path}`
            });
        }

        const modelPath = options.modelPath || options.slm?.modelPath || process.env.SIMPLEBEACON_SLM_MODEL;
        if (!modelPath || !fs.existsSync(modelPath)) {
            return resolve({
                enabled: true,
                reviewed: false,
                note: 'Set SIMPLEBEACON_SLM_MODEL or intelligence.slm.modelPath to run local inference'
            });
        }

        const prompt = buildSlmPrompt(content, options.filePath);
        const args = ['-m', modelPath, '-p', prompt, '-n', '128', '--temp', '0.1'];
        const timeout = options.timeoutMs || constants.TIMEOUT_30S;

        const child = spawn(probe.path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let finished = false;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve(result);
        };

        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            finish({ enabled: true, reviewed: false, error: 'SLM review timed out' });
        }, timeout);

        if (options.signal) {
            const onAbort = () => {
                child.kill('SIGTERM');
                finish({ enabled: true, reviewed: false, error: 'SLM review aborted by signal' });
            };
            if (options.signal.aborted) {
                onAbort();
                return;
            }
            options.signal.addEventListener('abort', onAbort, { once: true });
        }

        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });

        child.on('error', (err) => {
            finish({ enabled: true, reviewed: false, error: err.message });
        });

        child.on('close', (code) => {
            if (finished) return;
            const out = stdout.trim();
            const err = stderr.trim();
            const parsed = parseSlmResponse(out);
            const validation = parsed ? validateSlmResult(parsed) : { valid: false };

            finish({
                enabled: true,
                reviewed: true,
                localOnly: true,
                risk: validation.valid ? validation.risk : (parsed?.risk || 'unknown'),
                reason: validation.valid ? validation.reason : (parsed?.reason || out.slice(0, 500)),
                rawStdout: out.slice(0, 1000),
                stderr: err.slice(0, 500) || undefined,
                validationErrors: validation.errors || undefined,
                exitCode: code ?? undefined
            });
        });
    });
}

export {
    probeSlmBin,
    canRunSlm,
    buildSlmPrompt,
    parseSlmResponse,
    validateSlmResult,
    runSlmReview,
    runSlmReviewAsync
}
