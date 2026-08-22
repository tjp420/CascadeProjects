'use strict';

/**
 * Cross-project learner tests — pattern extraction from multiple projects.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { collectProjectData, extractPatterns, generateReport } = require('../src/agent-pda/cross-project-learner');

let dirCounter = 0;
function makeTmpDir() {
    const id = crypto.randomBytes(8).toString('hex') + '-' + (dirCounter++);
    return path.join(os.tmpdir(), 'sb-learn-test-' + id);
}

function makeFakeProject(root, opts = {}) {
    fs.mkdirSync(path.join(root, '.simplebeacon'), { recursive: true });

    // config.json
    if (opts.profile) {
        fs.writeFileSync(
            path.join(root, '.simplebeacon', 'config.json'),
            JSON.stringify({ profile: opts.profile })
        );
    }

    // report.json
    if (opts.gatePass !== undefined || opts.findings) {
        const report = {
            timestamp: new Date().toISOString(),
            gate: {
                pass: opts.gatePass ?? true,
                blockingCount: opts.blockingCount || 0,
            },
            findings: opts.findings || [],
        };
        fs.writeFileSync(
            path.join(root, '.simplebeacon', 'report.json'),
            JSON.stringify(report)
        );
    }

    // PDA state
    if (opts.hasPda) {
        const pdaDir = path.join(root, '.simplebeacon', 'agent-pda');
        fs.mkdirSync(pdaDir, { recursive: true });
        if (opts.agents) {
            fs.writeFileSync(path.join(pdaDir, 'agents.json'), JSON.stringify(opts.agents));
        }
        if (opts.tasks) {
            fs.writeFileSync(path.join(pdaDir, 'tasks.json'), JSON.stringify(opts.tasks));
        }
        if (opts.memories) {
            fs.writeFileSync(path.join(pdaDir, 'memories.json'), JSON.stringify(opts.memories));
        }
    }
}

function cleanup(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── Tests ───

test('Cross-project learner: collectProjectData finds .simplebeacon dirs', () => {
    const root = makeTmpDir();
    const sub = path.join(root, 'myproject');
    fs.mkdirSync(sub, { recursive: true });
    makeFakeProject(sub, { profile: 'standard', gatePass: true });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        assert.ok(projects.length >= 1, 'should find at least 1 project');
        const proj = projects.find(p => p.projectRoot === sub);
        assert.ok(proj, 'should find the fake project');
        assert.strictEqual(proj.profile, 'standard');
        assert.strictEqual(proj.gatePass, true);
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: empty input returns empty patterns', () => {
    const analysis = extractPatterns([]);
    assert.strictEqual(analysis.metrics.totalProjects, 0);
    assert.strictEqual(analysis.patterns.length, 0);
});

test('Cross-project learner: detects archived-files-block-gate pattern', () => {
    const root = makeTmpDir();
    const p1 = path.join(root, 'proj1');
    const p2 = path.join(root, 'proj2');
    fs.mkdirSync(p1, { recursive: true });
    fs.mkdirSync(p2, { recursive: true });
    makeFakeProject(p1, { gatePass: false, blockingCount: 5, findings: [] });
    makeFakeProject(p2, { gatePass: false, blockingCount: 3, findings: [] });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        const analysis = extractPatterns(projects);
        const pattern = analysis.patterns.find(p => p.id === 'archived-files-block-gate');
        assert.ok(pattern, 'should detect archived-files-block-gate pattern');
        assert.ok(pattern.occurrences >= 2, 'should have 2+ occurrences');
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: detects ai-generated-stub-functions pattern', () => {
    const root = makeTmpDir();
    const p1 = path.join(root, 'proj1');
    fs.mkdirSync(p1, { recursive: true });
    makeFakeProject(p1, {
        gatePass: true,
        findings: [
            { type: 'empty-stub-function', severity: 'medium' },
            { type: 'empty-stub-function', severity: 'medium' },
        ],
    });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        const analysis = extractPatterns(projects);
        const pattern = analysis.patterns.find(p => p.id === 'ai-generated-stub-functions');
        assert.ok(pattern, 'should detect stub function pattern');
        assert.strictEqual(pattern.occurrences, 2);
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: detects pda-adoption-rate pattern', () => {
    const root = makeTmpDir();
    const p1 = path.join(root, 'with-pda');
    const p2 = path.join(root, 'without-pda');
    fs.mkdirSync(p1, { recursive: true });
    fs.mkdirSync(p2, { recursive: true });
    makeFakeProject(p1, { gatePass: true, hasPda: true, agents: [{ id: 'a1' }], tasks: [{ id: 't1' }] });
    makeFakeProject(p2, { gatePass: true });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        const analysis = extractPatterns(projects);
        const pattern = analysis.patterns.find(p => p.id === 'pda-adoption-rate');
        assert.ok(pattern, 'should detect pda-adoption-rate pattern');
        assert.strictEqual(pattern.data.pdaEnabled, 1);
        assert.strictEqual(pattern.data.totalProjects, 2);
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: generateReport produces valid markdown', () => {
    const root = makeTmpDir();
    const p1 = path.join(root, 'proj1');
    fs.mkdirSync(p1, { recursive: true });
    makeFakeProject(p1, { profile: 'standard', gatePass: true, hasPda: true });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        const analysis = extractPatterns(projects);
        const report = generateReport(analysis);

        assert.ok(typeof report === 'string');
        assert.ok(report.includes('# Cross-Project Pattern Learning Report'));
        assert.ok(report.includes('## Summary Metrics'));
        assert.ok(report.includes('## Universal Patterns Detected'));
        assert.ok(report.includes('## Recommendations'));
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: recommendations are sorted by priority', () => {
    const root = makeTmpDir();
    const p1 = path.join(root, 'proj1');
    const p2 = path.join(root, 'proj2');
    fs.mkdirSync(p1, { recursive: true });
    fs.mkdirSync(p2, { recursive: true });
    makeFakeProject(p1, { gatePass: false, blockingCount: 10, findings: [] });
    makeFakeProject(p2, { gatePass: false, blockingCount: 5, findings: [] });

    try {
        const projects = collectProjectData([root], { maxDepth: 3 });
        const analysis = extractPatterns(projects);
        // High priority recommendations should come first
        const highIdx = analysis.recommendations.findIndex(r => r.priority === 'high');
        const medIdx = analysis.recommendations.findIndex(r => r.priority === 'medium');
        if (highIdx >= 0 && medIdx >= 0) {
            assert.ok(highIdx < medIdx, 'high priority should come before medium');
        }
    } finally {
        cleanup(root);
    }
});

test('Cross-project learner: skips node_modules and .git', () => {
    const root = makeTmpDir();
    const nmProj = path.join(root, 'node_modules', 'somepkg');
    const gitProj = path.join(root, '.git', 'someproj');
    const realProj = path.join(root, 'realproj');
    fs.mkdirSync(nmProj, { recursive: true });
    fs.mkdirSync(gitProj, { recursive: true });
    fs.mkdirSync(realProj, { recursive: true });
    makeFakeProject(nmProj, { gatePass: true });
    makeFakeProject(gitProj, { gatePass: true });
    makeFakeProject(realProj, { gatePass: true });

    try {
        const projects = collectProjectData([root], { maxDepth: 4 });
        // Should find realproj but not node_modules or .git projects
        const found = projects.map(p => p.projectRoot);
        assert.ok(found.includes(realProj), 'should find realproj');
        assert.ok(!found.includes(nmProj), 'should skip node_modules');
        assert.ok(!found.includes(gitProj), 'should skip .git');
    } finally {
        cleanup(root);
    }
});
