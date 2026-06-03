const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function verifyFileSyntax(relativeFilePath) {
    const fullPath = path.resolve(process.cwd(), relativeFilePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Rejected: Target path does not exist on disk: ${relativeFilePath}`);
    }
    try {
        execSync(`node -c "${fullPath}"`, { stdio: 'ignore' });
        return { ok: true, message: `Syntax check passed for ${relativeFilePath}` };
    } catch (error) {
        return { ok: false, error: `Syntax compilation failed in ${relativeFilePath}` };
    }
}

function verifyTestSuites() {
    try {
        console.log('[AI Runner] Invoking local project test suites...');
        const output = execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });
        return { ok: true, rawOutput: output };
    } catch (error) {
        return { ok: false, rawOutput: error.stdout || error.message };
    }
}

function proposeInlineFix(relativeFilePath, targetText, replacementText) {
    const fullPath = path.resolve(process.cwd(), relativeFilePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`);
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(targetText)) {
        return { ok: false, error: 'Target string to replace was not found in the source file.' };
    }
    const updatedContent = content.replace(targetText, replacementText);
    fs.writeFileSync(fullPath, updatedContent, 'utf8');
    const check = verifyFileSyntax(relativeFilePath);
    if (!check.ok) {
        fs.writeFileSync(fullPath, content, 'utf8');
        return { ok: false, error: `Patch rolled back. AI introduced a syntax error: ${check.error}` };
    }
    return { ok: true, message: 'Inline patch applied and syntax verified successfully.' };
}

module.exports = {
    verifyFileSyntax,
    verifyTestSuites,
    proposeInlineFix
};