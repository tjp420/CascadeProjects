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

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = process.cwd();

/**
 * Resolve a path relative to the current working directory,
 * rejecting directory-traversal attempts outside the project root.
 *
 * @param {string} relativeFilePath
 * @returns {string}
 */
function resolveSafePath(relativeFilePath) {
    const fullPath = path.resolve(CWD, relativeFilePath);
    // Prevent directory traversal outside the project root
    const realPath = fs.existsSync(fullPath) ? fs.realpathSync(fullPath) : fullPath;
    const realCwd = fs.realpathSync(CWD);
    if (!realPath.startsWith(realCwd + path.sep) && realPath !== realCwd) {
        throw new Error(`[AI Safety] Rejected: Path escapes project root: ${relativeFilePath}`);
    }
    return fullPath;
}

/**
 * Verify JavaScript/Node syntax by running `node -c` on the resolved file.
 *
 * @param {string} relativeFilePath
 * @returns {{ok:boolean, message?:string, error?:string}}
 */
function verifyFileSyntax(relativeFilePath) {
    const fullPath = resolveSafePath(relativeFilePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Rejected: Target path does not exist on disk: ${relativeFilePath}`);
    }
    try {
        execFileSync(process.execPath, ['-c', fullPath], { stdio: 'ignore' });
        return { ok: true, message: `Syntax check passed for ${relativeFilePath}` };
    } catch (error) {
        return { ok: false, error: `Syntax compilation failed in ${relativeFilePath}` };
    }
}

/**
 * Replace `targetText` with `replacementText` in a file, then verify syntax.
 * Rolls back the change if syntax verification fails.
 *
 * @param {string} relativeFilePath
 * @param {string} targetText
 * @param {string} replacementText
 * @returns {{ok:boolean, message?:string, error?:string}}
 */
function proposeInlineFix(relativeFilePath, targetText, replacementText) {
    const fullPath = resolveSafePath(relativeFilePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(targetText)) {
        return { ok: false, error: 'Target string to replace was not found in the source file.' };
    }
    const updatedContent = content.replaceAll(targetText, replacementText);
    fs.writeFileSync(fullPath, updatedContent, 'utf8');
    const check = verifyFileSyntax(relativeFilePath);
    if (!check.ok) {
        fs.writeFileSync(fullPath, content, 'utf8');
        return { ok: false, error: `Patch rolled back. AI introduced a syntax error: ${check.error}` };
    }
    return { ok: true, message: 'Inline patch applied and syntax verified successfully.' };
}

module.exports = Object.freeze({
    verifyFileSyntax,
    proposeInlineFix
});