// simplebeacon-ignore: Scanner rule definitions — all findings are false positives in scanner code
/**
 * Git History Secret Scanner — runs credential patterns against `git log -p`
 * output to catch secrets committed in history that were later removed but
 * still exist in git objects.
 *
 * Reuses the CREDENTIAL_PATTERNS and ALLOWLIST_SNIPPETS from credential-pattern-scanner.js
 * to maintain consistency with the working-tree scan.
 */

const { execFile } = require('child_process');
const path = require('path');
const { CREDENTIAL_PATTERNS, ALLOWLIST_SNIPPETS } = require('../lib/credential-pattern-scanner');

const DEFAULT_MAX_COMMITS = 1000;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Check if a snippet matches any allowlist entry (false positive).
 * @param {string} snippet
 * @returns {boolean}
 */
function isAllowlisted(snippet) {
    const lower = snippet.toLowerCase();
    for (const allowed of ALLOWLIST_SNIPPETS) {
        if (lower.includes(allowed.toLowerCase())) return true;
    }
    return false;
}

/**
 * Extract a safe preview of a secret (first 12 chars + ...).
 * @param {string} match
 * @returns {string}
 */
function secretPreview(match) {
    if (!match) return '';
    // Show first 12 chars + last 4, mask the middle
    if (match.length <= 20) return match;
    return match.slice(0, 12) + '...' + match.slice(-4);
}

/**
 * Run git log -p and stream output, applying credential patterns line by line.
 * @param {string} rootDir
 * @param {{ maxCommits?: number, timeoutMs?: number, paths?: string[] }} [options]
 * @returns {Promise<{ scanned: number, findings: number, issues: Array, summary: object }>}
 */
async function scanGitHistorySecrets(rootDir, options = {}) {
    const maxCommits = options.maxCommits || DEFAULT_MAX_COMMITS;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    // Check if this is a git repo
    const isGitRepo = await checkGitRepo(rootDir);
    if (!isGitRepo) {
        return {
            scanned: 0,
            findings: 0,
            issues: [],
            summary: {
                gitRepo: false,
                commitsScanned: 0,
                secretsFound: 0,
                maxCommits,
            },
        };
    }

    // Run git log -p with format that includes commit hash and date
    const args = [
        'log',
        `--max-count=${maxCommits}`,
        '--format=__COMMIT__%H|%aI',
        '-p',
        '--no-color',
    ];
    if (options.paths && options.paths.length > 0) {
        args.push('--');
        args.push(...options.paths);
    }

    let output;
    try {
        output = await runGit(rootDir, args, timeoutMs);
    } catch (err) {
        return {
            scanned: 0,
            findings: 0,
            issues: [{
                type: 'git-history-scan-error',
                severity: 'low',
                rule: 'git-history-secret',
                filePath: '',
                line: 0,
                impact: `Git history scan failed: ${err.message}`,
                fix: 'Ensure git is installed and the directory is a valid git repository',
                count: 1,
                metadata: { error: err.message },
            }],
            summary: {
                gitRepo: true,
                commitsScanned: 0,
                secretsFound: 0,
                maxCommits,
                error: err.message,
            },
        };
    }

    return parseGitLogOutput(output, rootDir, maxCommits);
}

/**
 * Parse git log -p output and find credential patterns.
 * @param {string} output
 * @param {string} rootDir
 * @param {number} maxCommits
 * @returns {{ scanned: number, findings: number, issues: Array, summary: object }}
 */
function parseGitLogOutput(output, rootDir, maxCommits) {
    const issues = [];
    const seen = new Set(); // dedupe by (commitHash, patternId, secretPreview)
    let commitsScanned = 0;
    let currentCommit = null;
    let currentDate = null;
    let currentFile = null;

    const lines = output.split('\n');

    for (const line of lines) {
        // Commit header: __COMMIT__<hash>|<date>
        if (line.startsWith('__COMMIT__')) {
            commitsScanned++;
            const rest = line.slice('__COMMIT__'.length);
            const sepIdx = rest.indexOf('|');
            if (sepIdx > 0) {
                currentCommit = rest.slice(0, sepIdx);
                currentDate = rest.slice(sepIdx + 1);
            }
            continue;
        }

        // Diff header: diff --git a/path b/path
        const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
        if (diffMatch) {
            currentFile = diffMatch[2];
            continue;
        }

        // Only scan added lines (starting with +, but not +++ for file headers)
        if (!line.startsWith('+') || line.startsWith('+++')) continue;
        if (line.length < 10) continue;

        const content = line.slice(1); // remove leading +

        // Apply credential patterns
        for (const pattern of CREDENTIAL_PATTERNS) {
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags.replace('g', '') + 'g');
            let match;
            while ((match = regex.exec(content)) !== null) {
                const matchedText = match[0];
                if (isAllowlisted(matchedText)) continue;

                const preview = secretPreview(matchedText);
                const dedupeKey = `${currentCommit}|${pattern.id}|${preview}`;
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);

                issues.push({
                    type: 'git-history-secret',
                    severity: pattern.severity === 'high' ? 'critical' : pattern.severity,
                    rule: 'git-history-secret',
                    filePath: currentFile || '(unknown)',
                    line: 0,
                    impact: `${pattern.id} found in commit ${currentCommit?.slice(0, 8)} (${currentDate?.slice(0, 10)}) — ${preview}`,
                    fix: 'Rotate the exposed credential immediately. Use git-filter-repo or BFG Repo-Cleaner to purge from history.',
                    count: 1,
                    metadata: {
                        commitHash: currentCommit,
                        commitDate: currentDate,
                        patternId: pattern.id,
                        secretPreview: preview,
                        filePath: currentFile,
                    },
                });
            }
        }
    }

    return {
        scanned: commitsScanned,
        findings: issues.length,
        issues,
        summary: {
            gitRepo: true,
            commitsScanned,
            secretsFound: issues.length,
            maxCommits,
        },
    };
}

/**
 * Check if rootDir is inside a git repository.
 * @param {string} rootDir
 * @returns {Promise<boolean>}
 */
function checkGitRepo(rootDir) {
    return new Promise((resolve) => {
        execFile('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: rootDir,
            timeout: 5000,
            windowsHide: true,
        }, (err, stdout) => {
            if (err) return resolve(false);
            resolve(stdout.trim() === 'true');
        });
    });
}

/**
 * Run git with a timeout and return stdout.
 * @param {string} rootDir
 * @param {string[]} args
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function runGit(rootDir, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile('git', args, {
            cwd: rootDir,
            timeout: timeoutMs,
            maxBuffer: 50 * 1024 * 1024, // 50MB
            windowsHide: true,
        }, (err, stdout, stderr) => {
            if (err) return reject(err);
            resolve(stdout);
        });
    });
}

module.exports = {
    scanGitHistorySecrets,
    parseGitLogOutput,
    isAllowlisted,
    secretPreview,
};
