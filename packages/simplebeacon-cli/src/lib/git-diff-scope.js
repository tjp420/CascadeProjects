// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Collect changed file paths for PR / CI diff-only scans.
 */
const { execSync } = require('child_process');
const path = require('path');

function normalizeRelPath(entry) {
    return String(entry || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Resolve base/head refs from CLI options or GitHub Actions env.
 * @param {{ baseRef?: string, headRef?: string }} [options]
 * @returns {{ base: string, head: string }}
 */
function resolveDiffRefs(options = {}) {
    const base = options.baseRef
        || process.env.SIMPLEBEACON_BASE_REF
        || process.env.GITHUB_BASE_REF
        || 'origin/main';
    const head = options.headRef
        || process.env.SIMPLEBEACON_HEAD_REF
        || process.env.GITHUB_SHA
        || 'HEAD';
    return { base, head };
}

/**
 * List changed files between base and head (merge-base triple-dot diff).
 * Returns null when not a git repo or diff cannot be computed.
 * @param {string} cwd
 * @param {{ baseRef?: string, headRef?: string }} [options]
 * @returns {string[]|null}
 */
function collectGitDiffFiles(cwd, options = {}) {
    const root = cwd || process.cwd();
    const { base, head } = resolveDiffRefs(options);
    const attempts = [
        `git diff --name-only --diff-filter=ACMR ${base}...${head}`,
        `git diff --name-only --diff-filter=ACMR ${base}..${head}`,
        'git diff --name-only --diff-filter=ACMR HEAD~1..HEAD'
    ];

    for (const cmd of attempts) {
        try {
            const out = execSync(cmd, {
                cwd: root,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            const files = out.split(/\r?\n/).map(normalizeRelPath).filter(Boolean);
            if (files.length) {
                return files;
            }
        } catch {
            /* try next strategy */
        }
    }
    return null;
}

module.exports = {
    collectGitDiffFiles,
    resolveDiffRefs,
    normalizeRelPath
};
