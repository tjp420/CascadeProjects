'use strict';

/**
 * Bundled inline search/replace with syntax verify + rollback.
 * Self-contained for npm publish (no monorepo ai-tools dependency).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_CWD = process.cwd();

function resolveSafePath(relativeFilePath, options) {
    const projectRoot = (options && options.projectRoot) ? String(options.projectRoot) : DEFAULT_CWD;
    const fullPath = path.resolve(projectRoot, relativeFilePath);
    const realPath = fs.existsSync(fullPath) ? fs.realpathSync(fullPath) : fullPath;
    const realRoot = fs.realpathSync(projectRoot);
    if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
        throw new Error(`[AI Safety] Rejected: Path escapes project root: ${relativeFilePath}`);
    }
    return fullPath;
}

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

function proposeInlineFix(relativeFilePath, targetText, replacementText, options) {
    const fullPath = resolveSafePath(relativeFilePath, options);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    if (isBinaryFile(fullPath)) {
        throw new Error(`[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(targetText)) {
        return { ok: false, error: 'Target string to replace was not found in the source file.' };
    }
    const count = options && typeof options.replaceCount === 'number' ? options.replaceCount : Infinity;
    let updatedContent;
    let occurrences = 0;
    if (Number.isFinite(count)) {
        updatedContent = content;
        let idx = updatedContent.indexOf(targetText);
        while (idx !== -1 && occurrences < count) {
            updatedContent = updatedContent.slice(0, idx) + replacementText + updatedContent.slice(idx + targetText.length);
            occurrences += 1;
            idx = updatedContent.indexOf(targetText, idx + replacementText.length);
        }
    } else {
        updatedContent = content.replaceAll(targetText, replacementText);
        occurrences = content.split(targetText).length - 1;
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

module.exports = {
    resolveSafePath,
    verifyFileSyntax,
    proposeInlineFix,
    isBinaryFile
};
