'use strict';
/**
 * SimpleBeacon Sandbox Runner
 *
 * Applies patches to a sandboxed copy of the workspace, runs tests,
 * and returns results without touching the original files.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

/**
 * Create a temporary sandbox directory mirroring a subset of files.
 * @param {string} projectRoot
 * @param {string[]} filesToCopy — relative paths to copy into sandbox
 * @returns {string} sandbox root path
 */
function createSandbox(projectRoot, filesToCopy) {
    const root = path.resolve(projectRoot);
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sandbox-'));

    for (const relPath of filesToCopy) {
        const src = path.resolve(root, relPath);
        if (!fs.existsSync(src)) continue;
        const dst = path.join(sandbox, relPath);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
    }

    return sandbox;
}

/**
 * Apply a search/replace patch to a file in the sandbox.
 * @param {string} sandboxRoot
 * @param {string} relPath
 * @param {string} search
 * @param {string} replace
 * @returns {{ok: boolean, error?: string, diff?: string}}
 */
function applyPatch(sandboxRoot, relPath, search, replace) {
    const fullPath = path.join(sandboxRoot, relPath);
    if (!fs.existsSync(fullPath)) {
        return { ok: false, error: `File not found in sandbox: ${relPath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(search)) {
        return { ok: false, error: `Search string not found in ${relPath}` };
    }

    const patched = content.replace(search, replace);
    fs.writeFileSync(fullPath, patched, 'utf8');

    // Simple diff: show the changed region
    const searchLines = search.split('\n');
    const replaceLines = replace.split('\n');
    const diff = [
        `--- a/${relPath}`,
        `+++ b/${relPath}`,
        ...searchLines.map(l => `-${l}`),
        ...replaceLines.map(l => `+${l}`),
    ].join('\n');

    return { ok: true, diff };
}

/**
 * Run a command in the sandbox and capture output.
 * @param {string} sandboxRoot
 * @param {string} command
 * @param {string[]} args
 * @param {object} [opts] — { timeoutMs, env }
 * @returns {{exitCode: number, stdout: string, stderr: string}}
 */
function runCommand(sandboxRoot, command, args, opts = {}) {
    const timeoutMs = opts.timeoutMs || 30000;
    const env = Object.assign({}, process.env, opts.env || {});

    try {
        const stdout = execFileSync(command, args, {
            cwd: sandboxRoot,
            encoding: 'utf8',
            timeout: timeoutMs,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 5 * 1024 * 1024,
        });
        return { exitCode: 0, stdout, stderr: '' };
    } catch (err) {
        return {
            exitCode: err.status || 1,
            stdout: err.stdout || '',
            stderr: err.stderr || err.message,
        };
    }
}

/**
 * Run tests in the sandbox.
 * @param {string} sandboxRoot
 * @param {object} [opts] — { testCommand, timeoutMs }
 * @returns {{passed: boolean, exitCode: number, output: string}}
 */
function runTests(sandboxRoot, opts = {}) {
    const testCommand = opts.testCommand || 'npm';
    const testArgs = opts.testArgs || ['test'];
    const timeoutMs = opts.timeoutMs || 60000;

    const result = runCommand(sandboxRoot, testCommand, testArgs, { timeoutMs });
    return {
        passed: result.exitCode === 0,
        exitCode: result.exitCode,
        output: result.stdout + '\n' + result.stderr,
    };
}

/**
 * Run a syntax check on a file in the sandbox.
 * @param {string} sandboxRoot
 * @param {string} relPath
 * @returns {{ok: boolean, error?: string}}
 */
function syntaxCheck(sandboxRoot, relPath) {
    const ext = path.extname(relPath);
    const fullPath = path.join(sandboxRoot, relPath);

    if (ext === '.js' || ext === '.cjs' || ext === '.mjs') {
        const result = runCommand(sandboxRoot, 'node', ['--check', fullPath], { timeoutMs: 10000 });
        return { ok: result.exitCode === 0, error: result.stderr || undefined };
    }

    if (ext === '.py') {
        const result = runCommand(sandboxRoot, 'python', ['-m', 'py_compile', fullPath], { timeoutMs: 10000 });
        return { ok: result.exitCode === 0, error: result.stderr || undefined };
    }

    // No syntax checker for this extension — skip
    return { ok: true };
}

/**
 * Clean up the sandbox directory.
 * @param {string} sandboxRoot
 */
function cleanupSandbox(sandboxRoot) {
    try {
        fs.rmSync(sandboxRoot, { recursive: true, force: true });
    } catch (e) {
        // Best-effort cleanup
    }
}

/**
 * Full sandbox workflow: create → apply patch → syntax check → run tests → cleanup.
 * @param {string} projectRoot
 * @param {string[]} filesToCopy
 * @param {object} patch — { path, search, replace }
 * @param {object} [opts] — { testCommand, testArgs, timeoutMs, keepOnFail }
 * @returns {Promise<{applied: boolean, syntaxOk: boolean, testsPassed: boolean, diff?: string, testOutput?: string, error?: string}>}
 */
async function sandboxPatchAndTest(projectRoot, filesToCopy, patch, opts = {}) {
    const sandbox = createSandbox(projectRoot, filesToCopy);
    let result = { applied: false, syntaxOk: false, testsPassed: false };

    try {
        // Apply patch
        const patchResult = applyPatch(sandbox, patch.path, patch.search, patch.replace);
        if (!patchResult.ok) {
            result.error = patchResult.error;
            return result;
        }
        result.applied = true;
        result.diff = patchResult.diff;

        // Syntax check
        const syntaxResult = syntaxCheck(sandbox, patch.path);
        if (!syntaxResult.ok) {
            result.error = `Syntax error: ${syntaxResult.error}`;
            return result;
        }
        result.syntaxOk = true;

        // Run tests
        const testResult = runTests(sandbox, opts);
        result.testsPassed = testResult.passed;
        result.testOutput = testResult.output.slice(-5000); // last 5k chars
        if (!testResult.passed) {
            result.error = `Tests failed (exit ${testResult.exitCode})`;
        }

        return result;
    } finally {
        if (!opts.keepOnFail || result.testsPassed) {
            cleanupSandbox(sandbox);
        }
    }
}

module.exports = {
    createSandbox,
    applyPatch,
    runCommand,
    runTests,
    syntaxCheck,
    cleanupSandbox,
    sandboxPatchAndTest,
};
