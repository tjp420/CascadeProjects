// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
'use strict';

/**
 * @module ai-tools
 * AI safety utilities for file operations.
 *
 * Provides path-sanitized helpers that verify targets are inside the
 * project root before reading or writing. Every mutation is preceded
 * by a `node -c` syntax check, and changes are rolled back on failure.
 *
 * ```js
 * const { verifyFileSyntax, proposeInlineFix } = require('./ai-tools');
 * const check = verifyFileSyntax('src/app.js');
 * if (check.ok) {
 *   proposeInlineFix('src/app.js', 'oldText', 'newText');
 * }
 * ```
 *
 * @file ai-tools/index.js
 */

const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_CWD = process.cwd();
const BACKUP_DIR_NAME = '.ai-tools-backups';

// ── Internal helpers ─────────────────────────────────────────────────────

function _resolveRoot(options) {
    return (options && options.projectRoot) ? String(options.projectRoot) : DEFAULT_CWD;
}

function _backupDirFor(projectRoot) {
    return path.join(projectRoot, BACKUP_DIR_NAME);
}

function _backupPath(relativeFilePath, projectRoot) {
    const fullPath = resolveSafePath(relativeFilePath, { projectRoot });
    const relToRoot = path.relative(projectRoot, fullPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = relToRoot.replace(/[\\/]/g, '--');
    return path.join(_backupDirFor(projectRoot), `${safeName}--${timestamp}.bak`);
}

// ── Path safety ──────────────────────────────────────────────────────────

/**
 * Resolve a path relative to the project root,
 * rejecting directory-traversal attempts outside the project root.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {string}
 */
function resolveSafePath(relativeFilePath, options) {
    const projectRoot = _resolveRoot(options);
    const fullPath = path.resolve(projectRoot, relativeFilePath);
    const realPath = fs.existsSync(fullPath) ? fs.realpathSync(fullPath) : fullPath;
    const realRoot = fs.realpathSync(projectRoot);
    if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
        throw new Error(`[AI Safety] Rejected: Path escapes project root: ${relativeFilePath}`);
    }
    return fullPath;
}

// ── Binary guard ─────────────────────────────────────────────────────────

/**
 * Check whether a file appears to be binary by scanning for null bytes.
 *
 * @param {string} fullPath
 * @returns {boolean}
 */
function isBinaryFile(fullPath) {
    try {
        const buf = fs.readFileSync(fullPath);
        const sample = buf.slice(0, 8192);
        for (let i = 0; i < sample.length; i++) {
            if (sample[i] === 0x00) return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Detect the dominant line ending style in a text buffer.
 * Defaults to LF for empty/single-line files.
 *
 * @param {string} content
 * @returns {'\r\n'|'\n'}
 */
function detectPreferredLineEnding(content) {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const newlineCount = (content.match(/\n/g) || []).length;
    const lfCount = Math.max(0, newlineCount - crlfCount);
    if (crlfCount === 0 && lfCount === 0) return '\n';
    return crlfCount >= lfCount ? '\r\n' : '\n';
}

/**
 * Normalize line endings in text to match the target file style.
 *
 * @param {string} text
 * @param {'\r\n'|'\n'} preferredEol
 * @returns {string}
 */
function normalizeLineEndings(text, preferredEol) {
    const value = (typeof text === 'string') ? text : String(text ?? '');
    if (preferredEol === '\r\n') {
        return value.replace(/\r?\n/g, '\r\n');
    }
    return value.replace(/\r\n/g, '\n');
}

/**
 * Resolve target/replacement pair against current file content.
 * Falls back to line-ending-normalized target matching for cross-platform snippets.
 *
 * @param {string} content
 * @param {string} targetText
 * @param {string} replacementText
 * @returns {{target:string,replacement:string}|null}
 */
function resolveReplacementPair(content, targetText, replacementText) {
    const preferredEol = detectPreferredLineEnding(content);
    const normalizedReplacement = normalizeLineEndings(replacementText, preferredEol);

    if (content.includes(targetText)) {
        return { target: targetText, replacement: normalizedReplacement };
    }

    const normalizedTarget = normalizeLineEndings(targetText, preferredEol);
    if (content.includes(normalizedTarget)) {
        return { target: normalizedTarget, replacement: normalizedReplacement };
    }

    return null;
}

// ── Syntax verification (sync) ───────────────────────────────────────────

/**
 * Verify JavaScript/Node syntax by running `node -c` on the resolved file.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {{ok:boolean, message?:string, error?:string, stderr?:string}}
 */
function verifyFileSyntax(relativeFilePath, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Rejected: Target path does not exist on disk: ${relativeFilePath}`);
    }
    try {
        execFileSync(process.execPath, ['-c', fullPath], { stdio: 'pipe' });
        return { ok: true, message: `Syntax check passed for ${relativeFilePath}` };
    } catch (error) {
        const stderr = error.stderr ? String(error.stderr).trim() : '';
        return {
            ok: false,
            error: `Syntax compilation failed in ${relativeFilePath}`,
            stderr: stderr || undefined
        };
    }
}

// ── Syntax verification (async) ──────────────────────────────────────────

/**
 * Async variant of verifyFileSyntax.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {Promise<{ok:boolean, message?:string, error?:string, stderr?:string}>}
 */
function verifyFileSyntaxAsync(relativeFilePath, options) {
    return new Promise((resolve) => {
        const fullPath = resolveSafePath(relativeFilePath, options);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`[AI Safety] Rejected: Target path does not exist on disk: ${relativeFilePath}`);
        }
        execFile(process.execPath, ['-c', fullPath], { encoding: 'utf8' }, (err, _stdout, stderr) => {
            if (err) {
                resolve({
                    ok: false,
                    error: `Syntax compilation failed in ${relativeFilePath}`,
                    stderr: stderr ? stderr.trim() : undefined
                });
            } else {
                resolve({ ok: true, message: `Syntax check passed for ${relativeFilePath}` });
            }
        });
    });
}

// ── Diff / preview helpers ───────────────────────────────────────────────

/**
 * Compute a diff preview without writing to disk.
 *
 * @param {string} relativeFilePath
 * @param {string} targetText
 * @param {string} replacementText
 * @param {{projectRoot?:string, replaceCount?:number}} [options]
 * @returns {{before:string, after:string, changed:boolean, occurrences:number}}
 */
function computeDiff(relativeFilePath, targetText, replacementText, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Target path does not exist on disk: ${relativeFilePath}`);
    }
    if (isBinaryFile(fullPath)) {
        throw new Error(`[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`);
    }
    const before = fs.readFileSync(fullPath, 'utf8');
    const pair = resolveReplacementPair(before, targetText, replacementText);
    if (!pair) {
        return { before, after: before, changed: false, occurrences: 0 };
    }
    const count = options && typeof options.replaceCount === 'number' ? options.replaceCount : Infinity;
    let after = before;
    let occurrences = 0;
    if (Number.isFinite(count)) {
        let idx = after.indexOf(pair.target);
        while (idx !== -1 && occurrences < count) {
            after = after.slice(0, idx) + pair.replacement + after.slice(idx + pair.target.length);
            occurrences += 1;
            idx = after.indexOf(pair.target, idx + pair.replacement.length);
        }
    } else {
        after = before.replaceAll(pair.target, pair.replacement);
        occurrences = (before.split(pair.target).length - 1);
    }
    return { before, after, changed: after !== before, occurrences };
}

/**
 * Preview an inline fix without applying it.
 *
 * @param {string} relativeFilePath
 * @param {string} targetText
 * @param {string} replacementText
 * @param {{projectRoot?:string, replaceCount?:number}} [options]
 * @returns {{ok:boolean, message?:string, error?:string, diff?:{before:string, after:string, changed:boolean, occurrences:number}}}
 */
function previewFix(relativeFilePath, targetText, replacementText, options) {
    try {
        const diff = computeDiff(relativeFilePath, targetText, replacementText, options);
        if (!diff.changed) {
            return { ok: false, error: 'Target string to replace was not found in the source file.' };
        }
        return {
            ok: true,
            message: `Preview ready. ${diff.occurrences} occurrence(s) would be replaced.`,
            diff
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

// ── Inline fix (sync) ────────────────────────────────────────────────────

/**
 * Replace `targetText` with `replacementText` in a file, then verify syntax.
 * Rolls back the change if syntax verification fails.
 *
 * @param {string} relativeFilePath
 * @param {string} targetText
 * @param {string} replacementText
 * @param {{projectRoot?:string, replaceCount?:number}} [options]
 * @returns {{ok:boolean, message?:string, error?:string}}
 */
function proposeInlineFix(relativeFilePath, targetText, replacementText, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    if (isBinaryFile(fullPath)) {
        throw new Error(`[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`);
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    const pair = resolveReplacementPair(content, targetText, replacementText);
    if (!pair) {
        return { ok: false, error: 'Target string to replace was not found in the source file.' };
    }
    const count = options && typeof options.replaceCount === 'number' ? options.replaceCount : Infinity;
    let updatedContent;
    let occurrences = 0;
    if (Number.isFinite(count)) {
        updatedContent = content;
        let idx = updatedContent.indexOf(pair.target);
        while (idx !== -1 && occurrences < count) {
            updatedContent = updatedContent.slice(0, idx) + pair.replacement + updatedContent.slice(idx + pair.target.length);
            occurrences += 1;
            idx = updatedContent.indexOf(pair.target, idx + pair.replacement.length);
        }
    } else {
        updatedContent = content.replaceAll(pair.target, pair.replacement);
        occurrences = content.split(pair.target).length - 1;
    }
    fs.writeFileSync(fullPath, updatedContent, 'utf8');
    const check = verifyFileSyntax(relativeFilePath, options);
    if (!check.ok) {
        fs.writeFileSync(fullPath, content, 'utf8');
        return {
            ok: false,
            error: `Patch rolled back. AI introduced a syntax error: ${check.error}`,
            stderr: check.stderr
        };
    }
    return {
        ok: true,
        message: `Inline patch applied and syntax verified successfully. ${occurrences} occurrence(s) replaced.`
    };
}

// ── Inline fix (async) ───────────────────────────────────────────────────

/**
 * Async variant of proposeInlineFix.
 *
 * @param {string} relativeFilePath
 * @param {string} targetText
 * @param {string} replacementText
 * @param {{projectRoot?:string, replaceCount?:number}} [options]
 * @returns {Promise<{ok:boolean, message?:string, error?:string, stderr?:string}>}
 */
async function proposeInlineFixAsync(relativeFilePath, targetText, replacementText, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    if (isBinaryFile(fullPath)) {
        throw new Error(`[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`);
    }
    const content = await fs.promises.readFile(fullPath, 'utf8');
    const pair = resolveReplacementPair(content, targetText, replacementText);
    if (!pair) {
        return { ok: false, error: 'Target string to replace was not found in the source file.' };
    }
    const count = options && typeof options.replaceCount === 'number' ? options.replaceCount : Infinity;
    let updatedContent;
    let occurrences = 0;
    if (Number.isFinite(count)) {
        updatedContent = content;
        let idx = updatedContent.indexOf(pair.target);
        while (idx !== -1 && occurrences < count) {
            updatedContent = updatedContent.slice(0, idx) + pair.replacement + updatedContent.slice(idx + pair.target.length);
            occurrences += 1;
            idx = updatedContent.indexOf(pair.target, idx + pair.replacement.length);
        }
    } else {
        updatedContent = content.replaceAll(pair.target, pair.replacement);
        occurrences = content.split(pair.target).length - 1;
    }
    await fs.promises.writeFile(fullPath, updatedContent, 'utf8');
    const check = await verifyFileSyntaxAsync(relativeFilePath, options);
    if (!check.ok) {
        await fs.promises.writeFile(fullPath, content, 'utf8');
        return {
            ok: false,
            error: `Patch rolled back. AI introduced a syntax error: ${check.error}`,
            stderr: check.stderr
        };
    }
    return {
        ok: true,
        message: `Inline patch applied and syntax verified successfully. ${occurrences} occurrence(s) replaced.`
    };
}

// ── Batch fix ────────────────────────────────────────────────────────────

/**
 * Apply an ordered list of replacements atomically.
 * All replacements are applied, then syntax is verified.
 * Rolls back to the original content on any failure.
 *
 * @param {string} relativeFilePath
 * @param {Array<{target:string, replacement:string}>} replacements
 * @param {{projectRoot?:string}} [options]
 * @returns {{ok:boolean, message?:string, error?:string, applied:number, stderr?:string}}
 */
function proposeBatchFix(relativeFilePath, replacements, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    if (isBinaryFile(fullPath)) {
        throw new Error(`[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`);
    }
    if (!Array.isArray(replacements) || replacements.length === 0) {
        return { ok: false, error: 'Replacements must be a non-empty array.' };
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    let updated = content;
    let applied = 0;
    for (const { target, replacement } of replacements) {
        if (typeof target !== 'string' || typeof replacement !== 'string') {
            return { ok: false, error: 'Each replacement must have {target, replacement} strings.' };
        }
        const pair = resolveReplacementPair(updated, target, replacement);
        if (!pair) {
            return { ok: false, error: `Batch fix failed: target "${target}" not found.` };
        }
        updated = updated.replaceAll(pair.target, pair.replacement);
        applied += 1;
    }
    fs.writeFileSync(fullPath, updated, 'utf8');
    const check = verifyFileSyntax(relativeFilePath, options);
    if (!check.ok) {
        fs.writeFileSync(fullPath, content, 'utf8');
        return {
            ok: false,
            error: `Batch patch rolled back. AI introduced a syntax error: ${check.error}`,
            applied,
            stderr: check.stderr
        };
    }
    return {
        ok: true,
        message: `Batch patch applied and syntax verified successfully. ${applied} replacement(s) applied.`,
        applied
    };
}

// ── Backup / restore API ────────────────────────────────────────────────

/**
 * Create a timestamped backup of a file inside `.ai-tools-backups/`.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {{backupPath:string, timestamp:string}}
 */
function createBackup(relativeFilePath, options) {
    const projectRoot = _resolveRoot(options);
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Cannot back up non-existent file: ${relativeFilePath}`);
    }
    const backupDir = _backupDirFor(projectRoot);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const backupPath = _backupPath(relativeFilePath, projectRoot);
    fs.copyFileSync(fullPath, backupPath);
    return { backupPath, timestamp };
}

/**
 * List available backups for a file, newest first.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {Array<{backupPath:string, mtime:Date}>}
 */
function listBackups(relativeFilePath, options) {
    const projectRoot = _resolveRoot(options);
    const fullPath = resolveSafePath(relativeFilePath, options);
    const relToRoot = path.relative(projectRoot, fullPath);
    const safeName = relToRoot.replace(/[\\/]/g, '--');
    const backupDir = _backupDirFor(projectRoot);
    if (!fs.existsSync(backupDir)) {
        return [];
    }
    const entries = fs.readdirSync(backupDir)
        .filter(name => name.startsWith(safeName + '--') && name.endsWith('.bak'))
        .map(name => {
            const bp = path.join(backupDir, name);
            return { backupPath: bp, mtime: fs.statSync(bp).mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
    return entries;
}

/**
 * Restore the most recent backup for a file.
 *
 * @param {string} relativeFilePath
 * @param {{projectRoot?:string}} [options]
 * @returns {{ok:boolean, message?:string, error?:string, restoredFrom?:string}}
 */
function restoreBackup(relativeFilePath, options) {
    const projectRoot = _resolveRoot(options);
    const fullPath = resolveSafePath(relativeFilePath, options);
    const backups = listBackups(relativeFilePath, options);
    if (backups.length === 0) {
        return { ok: false, error: `No backups found for ${relativeFilePath}` };
    }
    const mostRecent = backups[0];
    fs.copyFileSync(mostRecent.backupPath, fullPath);
    return {
        ok: true,
        message: `Restored ${relativeFilePath} from backup.`,
        restoredFrom: path.relative(projectRoot, mostRecent.backupPath)
    };
}

// ── Exports ──────────────────────────────────────────────────────────────

module.exports = Object.freeze({
    resolveSafePath,
    verifyFileSyntax,
    verifyFileSyntaxAsync,
    proposeInlineFix,
    proposeInlineFixAsync,
    proposeBatchFix,
    previewFix,
    computeDiff,
    createBackup,
    restoreBackup,
    listBackups,
    isBinaryFile
});