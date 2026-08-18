/**
 * Agent context pack + task profiles
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { buildContextPack, formatContextPackMarkdown, refreshAgentArtifacts } = require('../src/lib/agent-context-pack');
const { resolveTaskProfile, listTaskProfiles } = require('../src/lib/agent-task-profiles');
const { buildPipelineMetrics } = require('../src/lib/agent-brief');
const { createMcpToolHandlers } = require('../src/mcp/tools');

test('resolveTaskProfile maps aliases', () => {
    assert.equal(resolveTaskProfile('gzdoom').id, 'gamedev');
    assert.equal(resolveTaskProfile('handoff').scanProfile, 'cascade');
    assert.equal(resolveTaskProfile('unknown').id, 'hygiene');
});

test('listTaskProfiles returns eight profiles', () => {
    assert.equal(listTaskProfiles().length, 8);
});

test('buildPipelineMetrics explains inventory vs ruleScoped', () => {
    const m = buildPipelineMetrics({
        repositoryFilesTotal: 1000,
        ruleScopedFilesAnalyzed: 200,
        gate: { pass: true, blockingCount: 0 }
    });
    assert.equal(m.inventory, 1000);
    assert.equal(m.ruleScoped, 200);
    assert.match(m.note, /normal/);
});

test('buildContextPack includes repo map and workflow', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ctx-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 't', scripts: { test: 'node -c x' } }), 'utf8');
    const pack = buildContextPack(tmp, { paid: true, task: 'hygiene' });
    assert.equal(pack.taskProfile.id, 'hygiene');
    assert.ok(Array.isArray(pack.repoMap));
    assert.ok(pack.mcpWorkflow.length >= 4);
    assert.ok(pack.entryPoints.paths.includes('package.json'));
});

test('refreshAgentArtifacts writes brief and ai-context', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-art-'));
    const report = {
        gate: { pass: false, blockingCount: 1 },
        qualityScore: 80,
        detectedIssues: [{ severity: 'high', type: 'test', filePath: 'a.js' }]
    };
    refreshAgentArtifacts(tmp, report, { paid: true });
    assert.ok(fs.existsSync(path.join(tmp, '.simplebeacon', 'agent-brief.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.simplebeacon', 'ai-context.md')));
    const md = formatContextPackMarkdown(buildContextPack(tmp, { paid: true, report }));
    assert.match(md, /Pipeline metrics/);
});

test('buildContextPack includes file reduction notes when artifacts exist', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-fr-ctx-'));
    const { writeFileReductionArtifacts } = require('../src/lib/file-reduction-ai-notes');
    writeFileReductionArtifacts(tmp, {
        type: 'data-cleanup-report',
        generatedAt: new Date().toISOString(),
        inventory: { totalFiles: 500 },
        summary: { totalFindings: 3, reclaimableBytes: 4000 },
        fileReductionPlan: {
            totals: { safeToDeleteBytes: 4000 },
            safeToDelete: { topDirectories: [{ path: 'coverage', bytes: 4000, files: 10 }] }
        },
        scanScope: { reportHealth: 'platform-scoped' }
    }, { includeBrief: false });
    const pack = buildContextPack(tmp, { paid: true });
    assert.ok(pack.fileReduction);
    assert.equal(pack.fileReduction.reclaim.safeToDeleteBytes, 4000);
    const md = formatContextPackMarkdown(pack);
    assert.match(md, /File reduction/);
});

test('MCP exposes tools including context pack and supercharge', () => {
    const { createMcpStdioServer } = require('../src/mcp/stdio-server');
    const server = createMcpStdioServer({ offline: true });
    const list = server.toolListResult();
    assert.ok(list.tools.length >= 22);
    assert.ok(list.tools.some((t) => t.name === 'get_context_pack'));
    assert.ok(list.tools.some((t) => t.name === 'supercharge_agent'));
    assert.ok(list.tools.some((t) => t.name === 'install_agent_plugin'));
    assert.ok(list.tools.some((t) => t.name === 'master_engineering_brief'));
});

test('get_context_pack handler returns structured JSON', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.get_context_pack({ projectRoot: process.cwd(), task: 'hygiene' });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.schemaVersion, '1.0');
    assert.ok(parsed.taskProfile);
    assert.equal(parsed.agentExperience, '2/10');
});
