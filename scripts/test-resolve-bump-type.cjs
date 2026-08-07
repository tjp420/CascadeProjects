'use strict';

/**
 * Tests for resolve-bump-type.cjs
 *
 * Tests cover:
 * - Label parsing: JSON array, comma-separated, empty
 * - Commit parsing: newline-separated, literal \n, empty
 * - Label-based bump: patch, minor, major, no label
 * - Commit-based bump: breaking, feat, fix, no match
 * - Hybrid priority: labels take priority over commits
 * - Scope resolution: cli-only, vscode-only, both
 * - Version bumping: patch, minor, major, edge cases
 * - CLI entry point: JSON output format
 *
 * Run: node --test scripts/test-resolve-bump-type.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const {
    parseLabels,
    parseCommits,
    bumpFromLabels,
    bumpFromCommits,
    scopeFromLabels,
    resolveBump,
    bumpVersion
} = require('./resolve-bump-type.cjs');

// ═══════════════════════════════════════════════
// parseLabels
// ═══════════════════════════════════════════════

describe('parseLabels', () => {

    test('parses JSON array', () => {
        const result = parseLabels('["release:patch","release:cli-only"]');
        assert.deepEqual(result, ['release:patch', 'release:cli-only']);
    });

    test('parses empty JSON array', () => {
        const result = parseLabels('[]');
        assert.deepEqual(result, []);
    });

    test('parses comma-separated string', () => {
        const result = parseLabels('release:minor,release:vscode-only');
        assert.deepEqual(result, ['release:minor', 'release:vscode-only']);
    });

    test('handles empty string', () => {
        const result = parseLabels('');
        assert.deepEqual(result, []);
    });

    test('handles null/undefined', () => {
        assert.deepEqual(parseLabels(null), []);
        assert.deepEqual(parseLabels(undefined), []);
    });

    test('lowercases labels', () => {
        const result = parseLabels('["Release:PATCH"]');
        assert.deepEqual(result, ['release:patch']);
    });

    test('trims whitespace', () => {
        const result = parseLabels('  release:minor  ,  release:cli-only  ');
        assert.deepEqual(result, ['release:minor', 'release:cli-only']);
    });

    test('filters empty entries', () => {
        const result = parseLabels('release:patch,,release:minor,');
        assert.deepEqual(result, ['release:patch', 'release:minor']);
    });
});

// ═══════════════════════════════════════════════
// parseCommits
// ═══════════════════════════════════════════════

describe('parseCommits', () => {

    test('parses newline-separated commits', () => {
        const result = parseCommits('feat: add x\nfix: fix y');
        assert.deepEqual(result, ['feat: add x', 'fix: fix y']);
    });

    test('parses literal \\n string', () => {
        const result = parseCommits('feat: add x\\nfix: fix y');
        assert.deepEqual(result, ['feat: add x', 'fix: fix y']);
    });

    test('handles empty string', () => {
        const result = parseCommits('');
        assert.deepEqual(result, []);
    });

    test('handles null/undefined', () => {
        assert.deepEqual(parseCommits(null), []);
        assert.deepEqual(parseCommits(undefined), []);
    });

    test('trims whitespace', () => {
        const result = parseCommits('  feat: add x  \n  fix: fix y  ');
        assert.deepEqual(result, ['feat: add x', 'fix: fix y']);
    });

    test('filters empty lines', () => {
        const result = parseCommits('feat: add x\n\n\nfix: fix y\n');
        assert.deepEqual(result, ['feat: add x', 'fix: fix y']);
    });

    test('handles single commit', () => {
        const result = parseCommits('feat: standalone feature');
        assert.deepEqual(result, ['feat: standalone feature']);
    });
});

// ═══════════════════════════════════════════════
// bumpFromLabels
// ═══════════════════════════════════════════════

describe('bumpFromLabels', () => {

    test('detects release:patch', () => {
        assert.equal(bumpFromLabels(['release:patch']), 'patch');
    });

    test('detects release:minor', () => {
        assert.equal(bumpFromLabels(['release:minor']), 'minor');
    });

    test('detects release:major', () => {
        assert.equal(bumpFromLabels(['release:major']), 'major');
    });

    test('returns null for no release label', () => {
        assert.equal(bumpFromLabels(['bug', 'enhancement']), null);
    });

    test('returns null for empty array', () => {
        assert.equal(bumpFromLabels([]), null);
    });

    test('ignores non-release labels', () => {
        assert.equal(bumpFromLabels(['release:patch', 'bug', 'wontfix']), 'patch');
    });

    test('handles multiple release labels (patch takes priority)', () => {
        // patch is checked first in the implementation
        assert.equal(bumpFromLabels(['release:patch', 'release:minor']), 'patch');
    });
});

// ═══════════════════════════════════════════════
// bumpFromCommits
// ═══════════════════════════════════════════════

describe('bumpFromCommits', () => {

    test('detects breaking: as major', () => {
        assert.equal(bumpFromCommits(['breaking: change API']), 'major');
    });

    test('detects BREAKING: as major', () => {
        assert.equal(bumpFromCommits(['BREAKING: change API']), 'major');
    });

    test('detects BREAKING CHANGE as major', () => {
        assert.equal(bumpFromCommits(['feat: add thing\n\nBREAKING CHANGE: API removed']), 'major');
    });

    test('detects major: as major', () => {
        assert.equal(bumpFromCommits(['major: complete rewrite']), 'major');
    });

    test('detects feat: as minor', () => {
        assert.equal(bumpFromCommits(['feat: add new feature']), 'minor');
    });

    test('detects feature: as minor', () => {
        assert.equal(bumpFromCommits(['feature: add new thing']), 'minor');
    });

    test('detects fix: as patch', () => {
        assert.equal(bumpFromCommits(['fix: resolve bug']), 'patch');
    });

    test('detects bugfix: as patch', () => {
        assert.equal(bumpFromCommits(['bugfix: fix issue']), 'patch');
    });

    test('detects resolve: as patch', () => {
        assert.equal(bumpFromCommits(['resolve: fix issue']), 'patch');
    });

    test('returns null for only chore commits', () => {
        assert.equal(bumpFromCommits(['chore: update deps', 'docs: update readme']), null);
    });

    test('returns null for empty array', () => {
        assert.equal(bumpFromCommits([]), null);
    });

    test('breaking takes priority over feat', () => {
        assert.equal(bumpFromCommits(['feat: add thing', 'breaking: change API']), 'major');
    });

    test('feat takes priority over fix', () => {
        assert.equal(bumpFromCommits(['fix: fix bug', 'feat: add feature']), 'minor');
    });

    test('detects feat with parentheses scope', () => {
        assert.equal(bumpFromCommits(['feat(api): add endpoint']), 'minor');
    });

    test('detects fix with parentheses scope', () => {
        assert.equal(bumpFromCommits(['fix(core): fix crash']), 'patch');
    });
});

// ═══════════════════════════════════════════════
// scopeFromLabels
// ═══════════════════════════════════════════════

describe('scopeFromLabels', () => {

    test('returns both by default', () => {
        assert.equal(scopeFromLabels([]), 'both');
    });

    test('detects release:cli-only', () => {
        assert.equal(scopeFromLabels(['release:cli-only']), 'cli');
    });

    test('detects release:vscode-only', () => {
        assert.equal(scopeFromLabels(['release:vscode-only']), 'vscode');
    });

    test('ignores other labels', () => {
        assert.equal(scopeFromLabels(['bug', 'release:patch']), 'both');
    });

    test('cli-only takes priority over vscode-only', () => {
        // cli is checked first in the implementation
        assert.equal(scopeFromLabels(['release:cli-only', 'release:vscode-only']), 'cli');
    });
});

// ═══════════════════════════════════════════════
// resolveBump (hybrid priority)
// ═══════════════════════════════════════════════

describe('resolveBump hybrid priority', () => {

    test('label takes priority over commit messages', () => {
        const result = resolveBump(['release:patch'], ['breaking: change API']);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'patch');
        assert.equal(result.source, 'label');
    });

    test('falls back to commits when no label', () => {
        const result = resolveBump([], ['feat: add feature']);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'minor');
        assert.equal(result.source, 'commit');
    });

    test('no release when no label and no matching commits', () => {
        const result = resolveBump([], ['chore: update deps', 'docs: readme']);
        assert.equal(result.shouldRelease, false);
        assert.equal(result.bumpType, null);
        assert.equal(result.source, 'none');
    });

    test('no release when both empty', () => {
        const result = resolveBump([], []);
        assert.equal(result.shouldRelease, false);
        assert.equal(result.bumpType, null);
        assert.equal(result.source, 'none');
    });

    test('label:minor overrides commit:breaking', () => {
        const result = resolveBump(['release:minor'], ['breaking: change']);
        assert.equal(result.bumpType, 'minor');
        assert.equal(result.source, 'label');
    });

    test('label:major overrides commit:fix', () => {
        const result = resolveBump(['release:major'], ['fix: small bug']);
        assert.equal(result.bumpType, 'major');
        assert.equal(result.source, 'label');
    });

    test('preserves scope from labels', () => {
        const result = resolveBump(['release:patch', 'release:cli-only'], []);
        assert.equal(result.scope, 'cli');
    });

    test('scope defaults to both when no scope label', () => {
        const result = resolveBump(['release:patch'], ['feat: add thing']);
        assert.equal(result.scope, 'both');
    });

    test('scope works with commit-based bump', () => {
        const result = resolveBump(['release:vscode-only'], ['feat: add feature']);
        assert.equal(result.scope, 'vscode');
        assert.equal(result.source, 'commit');
    });
});

// ═══════════════════════════════════════════════
// bumpVersion
// ═══════════════════════════════════════════════

describe('bumpVersion', () => {

    test('bumps patch correctly', () => {
        assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
    });

    test('bumps minor correctly (resets patch)', () => {
        assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
    });

    test('bumps major correctly (resets minor and patch)', () => {
        assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
    });

    test('handles version with zeros', () => {
        assert.equal(bumpVersion('0.0.0', 'patch'), '0.0.1');
        assert.equal(bumpVersion('0.0.0', 'minor'), '0.1.0');
        assert.equal(bumpVersion('0.0.0', 'major'), '1.0.0');
    });

    test('handles large version numbers', () => {
        assert.equal(bumpVersion('10.20.30', 'patch'), '10.20.31');
        assert.equal(bumpVersion('10.20.30', 'minor'), '10.21.0');
        assert.equal(bumpVersion('10.20.30', 'major'), '11.0.0');
    });

    test('throws on invalid semver', () => {
        assert.throws(() => bumpVersion('1.2', 'patch'), /Invalid semver/);
        assert.throws(() => bumpVersion('1.2.3.4', 'patch'), /Invalid semver/);
        assert.throws(() => bumpVersion('abc', 'patch'), /Invalid semver/);
    });

    test('throws on non-numeric parts', () => {
        assert.throws(() => bumpVersion('1.x.3', 'patch'), /Invalid semver/);
    });
});

// ═══════════════════════════════════════════════
// CLI entry point
// ═══════════════════════════════════════════════

describe('CLI entry point', () => {

    const scriptPath = path.join(__dirname, 'resolve-bump-type.cjs');

    function runCli(args) {
        return execFileSync('node', [scriptPath, ...args], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }

    test('outputs valid JSON for label-based bump', () => {
        const output = runCli(['--labels', '["release:minor"]', '--commits', '']);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'minor');
        assert.equal(result.source, 'label');
    });

    test('outputs valid JSON for commit-based bump', () => {
        const output = runCli(['--labels', '[]', '--commits', 'feat: add thing']);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'minor');
        assert.equal(result.source, 'commit');
    });

    test('outputs no release when no trigger', () => {
        const output = runCli(['--labels', '[]', '--commits', 'chore: update deps']);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, false);
        assert.equal(result.bumpType, null);
        assert.equal(result.source, 'none');
    });

    test('handles scope labels', () => {
        const output = runCli(['--labels', '["release:patch","release:cli-only"]', '--commits', '']);
        const result = JSON.parse(output);
        assert.equal(result.scope, 'cli');
    });

    test('defaults to empty labels and commits', () => {
        const output = runCli([]);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, false);
    });

    test('dry-run outputs to stderr, JSON to stdout', () => {
        const output = runCli(['--dry-run', '--labels', '["release:patch"]', '--commits', '']);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'patch');
    });

    test('handles multiple commits with mixed types', () => {
        const output = runCli(['--labels', '[]', '--commits', 'fix: bug one\\nfeat: feature two\\nchore: deps']);
        const result = JSON.parse(output);
        assert.equal(result.shouldRelease, true);
        assert.equal(result.bumpType, 'minor');
        assert.equal(result.source, 'commit');
    });

    test('handles breaking change in multi-commit', () => {
        const output = runCli(['--labels', '[]', '--commits', 'feat: add thing\\nbreaking: change API']);
        const result = JSON.parse(output);
        assert.equal(result.bumpType, 'major');
    });
});
