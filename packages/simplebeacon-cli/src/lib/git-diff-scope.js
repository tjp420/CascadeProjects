// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Collect changed file paths for PR / CI diff-only scans.
 */
const { execSync, execFileSync } = require('child_process');
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

/**
 * List paths staged in the git index (cached diff).
 * Returns null when not a git repo or diff cannot be computed.
 * @param {string} [cwd]
 * @returns {string[]|null}
 */
function collectGitStagedFiles(cwd) {
    const root = cwd || process.cwd();
    try {
        const out = execFileSync('git', ['diff', '--cached', '--raw', '--diff-filter=ACMR', '-z'], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'ignore']
        });
        if (!Buffer.isBuffer(out) || out.length === 0) {
            return [];
        }

        const records = out.toString('utf8').split('\0').filter(Boolean);
        const files = [];
        for (let i = 0; i < records.length; i += 1) {
            const record = records[i];
            if (!record || record[0] !== ':') continue;

            const header = record;
            const sourcePath = normalizeRelPath(records[i + 1] || '');
            const statusMatch = header.match(/\s([A-Z][0-9]{0,3})$/);
            const status = statusMatch ? statusMatch[1] : '';

            if (!sourcePath) {
                continue;
            }

            if (/^[RC]/.test(status)) {
                const renamedPath = normalizeRelPath(records[i + 2] || '');
                if (renamedPath) {
                    files.push(renamedPath);
                    i += 2;
                    continue;
                }
            }

            files.push(sourcePath);
            i += 1;
        }

        return Array.from(new Set(files));
    } catch {
        try {
            const fallback = execSync('git diff --cached --name-only --diff-filter=ACMR', {
                cwd: root,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return Array.from(new Set(fallback.split(/\r?\n/).map(normalizeRelPath).filter(Boolean)));
        } catch {
            return null;
        }
    }
}

/**
 * Read staged blob content for a path from the git index.
 * Returns null for binary, missing, or oversized blobs.
 * @param {string} cwd
 * @param {string} relativePath
 * @param {{ maxBytes?: number }} [options]
 * @returns {string|null}
 */
function readStagedFileContent(cwd, relativePath, options = {}) {
    const root = cwd || process.cwd();
    const normalized = normalizeRelPath(relativePath);
    if (!normalized) return null;
    const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 256000;
    try {
        const buffer = execFileSync('git', ['show', `:${normalized}`], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: maxBytes + 1024
        });
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
        if (buffer.includes(0)) return null;
        if (buffer.length > maxBytes) return null;
        return buffer.toString('utf8');
    } catch {
        return null;
    }
}

module.exports = {
    collectGitDiffFiles,
    collectGitStagedFiles,
    readStagedFileContent,
    resolveDiffRefs,
    normalizeRelPath
};
