'use strict';

/**
 * Tests for PR template and CONTRIBUTING.md release label documentation.
 *
 * Verifies that:
 * - PR template exists and references all valid release labels
 * - PR template mentions the matrix-release.yml workflow
 * - PR template includes dry-run command for resolve-bump-type.cjs
 * - CONTRIBUTING.md documents all release labels
 * - Labels in PR template match labels in resolve-bump-type.cjs
 * - CONTRIBUTING.md references the matrix release pipeline
 *
 * Run: node --test scripts/test-pr-template.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
    bumpFromLabels,
    scopeFromLabels,
    resolveBump
} = require('./resolve-bump-type.cjs');

const REPO_ROOT = path.join(__dirname, '..');

function readFile(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ═══════════════════════════════════════════════
// PR Template
// ═══════════════════════════════════════════════

describe('PR template existence and structure', () => {

    test('PULL_REQUEST_TEMPLATE.md exists', () => {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md')));
    });

    test('has Summary section', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /## Summary/);
    });

    test('has Type of Change section', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /## Type of Change/);
    });

    test('has Test Plan section', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /## Test Plan/);
    });

    test('has Checklist section', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /## Checklist/);
    });
});

describe('PR template release labels', () => {

    test('references release:patch', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /release:patch/);
    });

    test('references release:minor', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /release:minor/);
    });

    test('references release:major', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /release:major/);
    });

    test('references release:cli-only', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /release:cli-only/);
    });

    test('references release:vscode-only', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /release:vscode-only/);
    });

    test('has Release Label section', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /## Release Label/);
    });

    test('has Bump Type subsection', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /### Bump Type/);
    });

    test('has Release Scope subsection', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /### Release Scope/);
    });

    test('mentions no-release option', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /No release/i);
    });
});

describe('PR template references matrix pipeline', () => {

    test('links to matrix-release.yml', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /matrix-release\.yml/);
    });

    test('mentions unified-release.yml', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /unified-release\.yml/);
    });

    test('mentions resolve-bump-type.cjs dry-run', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /resolve-bump-type\.cjs/);
    });

    test('mentions simplebeacon-v* tag prefix', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /simplebeacon-v/);
    });

    test('mentions vscode-v* tag prefix', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /vscode-v/);
    });

    test('mentions npm publish', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /npm/);
    });

    test('mentions VS Code Marketplace', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /Marketplace/i);
    });
});

describe('PR template label consistency with resolve-bump-type.cjs', () => {

    test('all template bump labels are recognized by resolveBump', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        const labels = ['release:patch', 'release:minor', 'release:major'];
        for (const label of labels) {
            assert.ok(template.includes(label), `Template must reference ${label}`);
            const parsed = [label];
            const bump = bumpFromLabels(parsed);
            assert.ok(bump !== null, `resolveBump must recognize ${label}`);
        }
    });

    test('all template scope labels are recognized by scopeFromLabels', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        const scopeLabels = ['release:cli-only', 'release:vscode-only'];
        for (const label of scopeLabels) {
            assert.ok(template.includes(label), `Template must reference ${label}`);
            const scope = scopeFromLabels([label]);
            assert.ok(scope !== 'both', `scopeFromLabels must recognize ${label}`);
        }
    });

    test('no-release option in template corresponds to resolveBump returning false', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        assert.match(template, /No release/i);
        const result = resolveBump([], ['chore: update deps']);
        assert.equal(result.shouldRelease, false);
    });
});

// ═══════════════════════════════════════════════
// CONTRIBUTING.md
// ═══════════════════════════════════════════════

describe('CONTRIBUTING.md release label documentation', () => {

    test('CONTRIBUTING.md exists', () => {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, 'CONTRIBUTING.md')));
    });

    test('has Release Labels section', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /## Release Labels/);
    });

    test('documents release:patch', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /release:patch/);
    });

    test('documents release:minor', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /release:minor/);
    });

    test('documents release:major', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /release:major/);
    });

    test('documents release:cli-only', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /release:cli-only/);
    });

    test('documents release:vscode-only', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /release:vscode-only/);
    });

    test('documents commit message fallback', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /commit message/i);
        assert.match(content, /breaking:/);
        assert.match(content, /feat:/);
        assert.match(content, /fix:/);
    });

    test('references matrix-release.yml', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /matrix-release\.yml/);
    });

    test('includes dry-run command', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /resolve-bump-type\.cjs/);
    });

    test('has Bump Type Labels table', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /Bump Type Labels/);
    });

    test('has Scope Labels table', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /Scope Labels/);
    });

    test('mentions npm as publish target', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /npm/);
    });

    test('mentions VS Code Marketplace as publish target', () => {
        const content = readFile('CONTRIBUTING.md');
        assert.match(content, /Marketplace/i);
    });
});

// ═══════════════════════════════════════════════
// Cross-file consistency
// ═══════════════════════════════════════════════

describe('cross-file label consistency', () => {

    test('all labels in PR template appear in CONTRIBUTING.md', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        const contributing = readFile('CONTRIBUTING.md');
        const labels = ['release:patch', 'release:minor', 'release:major',
                        'release:cli-only', 'release:vscode-only'];
        for (const label of labels) {
            assert.ok(template.includes(label), `PR template must reference ${label}`);
            assert.ok(contributing.includes(label), `CONTRIBUTING.md must reference ${label}`);
        }
    });

    test('all labels in resolve-bump-type.cjs appear in CONTRIBUTING.md', () => {
        const contributing = readFile('CONTRIBUTING.md');
        const allLabels = ['release:patch', 'release:minor', 'release:major',
                          'release:cli-only', 'release:vscode-only'];
        for (const label of allLabels) {
            assert.ok(contributing.includes(label),
                `CONTRIBUTING.md must document ${label}`);
        }
    });

    test('workflow file references match template references', () => {
        const template = readFile('.github/PULL_REQUEST_TEMPLATE.md');
        const workflow = readFile('.github/workflows/matrix-release.yml');
        // Both should reference the same tag prefixes
        assert.match(template, /simplebeacon-v/);
        assert.match(workflow, /simplebeacon-v/);
        assert.match(template, /vscode-v/);
        assert.match(workflow, /vscode-v/);
    });
});
