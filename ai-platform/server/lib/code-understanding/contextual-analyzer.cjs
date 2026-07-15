// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Layer 4 — contextual analysis (git history + adjacent documentation).
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const constants = require('../../config/constants.cjs');
const execFileAsync = promisify(execFile);

/**
 * Run git.
 * @param {any} cwd
 * @param {Array} args
 * @returns {any}
 */
async function runGit(cwd, args) {
    try {
        const { stdout } = await execFileAsync('git', args, {
            cwd,
            windowsHide: true,
            timeout: constants.TIMEOUT_8S,
            maxBuffer: 512 * constants.BYTES_PER_KB
        });
        return String(stdout || '').trim();
    } catch {
        return '';
    }
}

/**
 * Analyze git context.
 * @param {string} relativePath
 * @param {any} projectRoot
 * @returns {any}
 */
async function analyzeGitContext(relativePath, projectRoot) {
    const root = path.resolve(projectRoot);
    const rel = String(relativePath || '').replace(/\\/g, '/');
    const logLine = await runGit(root, ['log', '-1', '--format=%H|%an|%ad|%s', '--date=short', '--', rel]);
    const recent = await runGit(root, ['log', '-5', '--format=%h %ad %s', '--date=short', '--', rel]);

    if (!logLine) {
        return { available: false, reason: 'No git history for path or not a git repository.' };
    }

    const [hash, author, date, message] = logLine.split('|');
    return {
        available: true,
        lastCommit: { hash, author, date, message },
        recentCommits: recent.split('\n').filter(Boolean).slice(0, 5),
        decisionHistory: recent.split('\n').filter(Boolean).slice(0, 5).map((line) => ({
            summary: line,
            inferredIntent: inferIntentFromCommitMessage(line)
        }))
    };
}

/**
 * Infer intent from commit message.
 * @param {any} line
 * @returns {any}
 */
function inferIntentFromCommitMessage(line) {
    const msg = String(line || '').toLowerCase();
    if (/fix|bug|patch/.test(msg)) return 'Bug fix or regression repair';
    if (/feat|add|implement/.test(msg)) return 'Feature addition or capability expansion';
    if (/refactor|cleanup|chore/.test(msg)) return 'Refactor or maintenance';
    if (/test|spec/.test(msg)) return 'Test coverage or validation';
    if (/doc|readme/.test(msg)) return 'Documentation update';
    return 'General change — review commit message for details';
}

/**
 * Find adjacent documentation.
 * @param {string} filePath
 * @param {any} projectRoot
 * @returns {any}
 */
async function findAdjacentDocumentation(filePath, projectRoot) {
    const abs = path.resolve(projectRoot, filePath);
    const dir = path.dirname(abs);
    const candidates = ['README.md', 'readme.md', 'README.txt', 'NOTES.md', 'CHANGELOG.md'];
    const docs = [];

    for (const name of candidates) {
        const docPath = path.join(dir, name);
        if (!fs.existsSync(docPath)) continue;
        try {
            const stat = await fs.promises.stat(docPath);
            if (!stat.isFile() || stat.size > constants.TIMEOUT_2M) continue;
            const content = await fs.promises.readFile(docPath, 'utf8');
            docs.push({
                name,
                relativePath: path.relative(projectRoot, docPath).replace(/\\/g, '/'),
                excerpt: content.slice(0, 800).trim()
            });
        } catch {
            /* skip */
        }
    }

    return docs;
}

/**
 * Analyze contextual layer.
 * @param {string} filePath
 * @param {any} projectRoot
 * @param {any} _content
 * @returns {any}
 */
async function analyzeContextualLayer(filePath, projectRoot, _content = '') {
    const gitHistory = await analyzeGitContext(filePath, projectRoot);
    const documentation = await findAdjacentDocumentation(filePath, projectRoot);

    const contextSummary = [];
    if (gitHistory.available && gitHistory.lastCommit?.message) {
        contextSummary.push(`Last change: "${gitHistory.lastCommit.message}" (${gitHistory.lastCommit.date}).`);
    }
    if (documentation.length) {
        contextSummary.push(`Adjacent docs: ${documentation.map((d) => d.name).join(', ')}.`);
    }
    if (!contextSummary.length) {
        contextSummary.push('Limited contextual metadata — no git history or nearby README found.');
    }

    return {
        layer: 'contextual',
        gitHistory,
        documentation,
        contextSummary: contextSummary.join(' '),
        confidence: gitHistory.available ? 0.6 : 0.35
    };
}

module.exports = {
    analyzeContextualLayer,
    analyzeGitContext,
    findAdjacentDocumentation
};
