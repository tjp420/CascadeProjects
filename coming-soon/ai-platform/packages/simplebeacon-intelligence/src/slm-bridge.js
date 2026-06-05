/**
 * Optional local SLM bridge — Tier 2.
 * Invokes LLAMA_CPP_BIN only on high-risk snippets; never during default gate scan.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

const DEFAULT_PROMPT_TEMPLATE = `You are a code hygiene auditor. Reply with JSON only: {"risk":"low|medium|high","reason":"..."}.
Does this snippet look like unchecked AI-generated boilerplate, mock API stub, or placeholder credentials?
Snippet:
`;

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

function buildSlmPrompt(content, filePath) {
    const trimmed = String(content || '').slice(0, 4000);
    return `${DEFAULT_PROMPT_TEMPLATE}File: ${filePath || 'snippet'}\n---\n${trimmed}\n---`;
}

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
            timeout: options.timeoutMs || 30000,
            maxBuffer: 1024 * 512
        });

        if (result.error) {
            return { enabled: true, reviewed: false, error: result.error.message };
        }

        const stdout = (result.stdout || '').trim();
        let parsed = null;
        try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch {
            parsed = null;
        }

        return {
            enabled: true,
            reviewed: true,
            localOnly: true,
            risk: parsed?.risk || 'unknown',
            reason: parsed?.reason || stdout.slice(0, 500),
            rawStdout: stdout.slice(0, 1000)
        };
    } catch (err) {
        return { enabled: true, reviewed: false, error: err.message };
    }
}

module.exports = {
    probeSlmBin,
    buildSlmPrompt,
    runSlmReview
};
