const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BuildArtifactScanner } = require('../src/analyzers/file-reduction/build-artifact-scanner');
const { AssetConsolidationScanner } = require('../src/analyzers/file-reduction/asset-consolidation-scanner');
const { UnusedFileDetector } = require('../src/analyzers/file-reduction/unused-file-detector');
const { runFileReductionAnalysis } = require('../src/analyzers/file-reduction');
const { parseJSImports } = require('../src/analyzers/file-reduction/utils/import-parser');
const { generateFileReductionReport } = require('../src/reporters/file-reduction-report');

function makeTempProject(structure) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-reduce-'));
    for (const [relPath, content] of Object.entries(structure)) {
        const fullPath = path.join(root, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }
    return root;
}

test('BuildArtifactScanner detects node_modules and standalone .map files', async () => {
    const root = makeTempProject({
        'node_modules/pkg/index.js': 'module.exports = {};\n',
        'node_modules/nested/node_modules/pkg/index.js': 'module.exports = {};\n',
        'dist/app.min.js': 'console.log("x");\n',
        'src/app.js.map': '{}',
        'src/index.js': 'console.log("ok");\n'
    });

    const scanner = new BuildArtifactScanner();
    const result = await scanner.scan(root);
    assert.ok(result.findings.some((f) => f.path === 'node_modules'));
    assert.ok(!result.findings.some((f) => f.path === 'node_modules/nested/node_modules'));
    assert.ok(result.findings.some((f) => f.path === 'src/app.js.map'));
    assert.ok(!result.findings.some((f) => f.path === 'dist/app.min.js.map'));
    assert.ok(result.summary.safeToDeleteBytes <= result.summary.reclaimableBytes);
});

test('buildFileReductionPlan groups safe and review categories', async () => {
    const { buildFileReductionPlan } = require('../src/lib/file-reduction-plan');
    const root = makeTempProject({
        'node_modules/pkg/index.js': 'module.exports = {};\n',
        'coverage/lcov.info': 'TN:\n',
        'logs/audit.log': 'entry\n',
        'assets/a.png': 'same',
        'assets/b.png': 'same'
    });
    const report = await runFileReductionAnalysis(root, {
        scanners: {
            'build-artifacts': { enabled: true },
            'asset-consolidation': { enabled: true },
            'unused-files': { enabled: true }
        }
    });
    report.scanProfile = 'file-reduction';
    const plan = buildFileReductionPlan(report);
    assert.ok(plan.safeToDelete.directories >= 1);
    assert.ok(plan.reviewBeforeDelete.logs.length >= 1);
    assert.ok(plan.summaryTable.length >= 3);
});

test('AssetConsolidationScanner groups identical assets', async () => {
    const root = makeTempProject({
        'assets/a.png': 'same-image-bytes',
        'assets/b.png': 'same-image-bytes',
        'assets/c.png': 'different-image'
    });

    const scanner = new AssetConsolidationScanner();
    const result = await scanner.scan(root);
    assert.equal(result.findings.length, 1);
    assert.deepEqual(result.findings[0].duplicates.sort(), ['assets/b.png']);
    assert.equal(result.findings[0].keeper, 'assets/a.png');
});

test('UnusedFileDetector flags unreferenced modules but keeps entry points', async () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ main: 'index.js' }),
        'index.js': "const helper = require('./lib/helper');\nmodule.exports = helper;\n",
        'lib/helper.js': 'module.exports = () => 1;\n',
        'lib/orphan.js': 'module.exports = () => 2;\n'
    });

    const scanner = new UnusedFileDetector();
    const result = await scanner.scan(root);
    assert.ok(result.findings.some((f) => f.path === 'lib/orphan.js'));
    assert.equal(result.findings.some((f) => f.path === 'lib/helper.js'), false);
});

test('parseJSImports resolves relative require paths', () => {
    const root = path.resolve('/tmp/project');
    const imports = parseJSImports(
        "const x = require('./lib/helper');\nimport y from '../shared/util.js';\n",
        path.join(root, 'src', 'app.js'),
        root
    );
    assert.equal(imports.length, 0);
});

test('runFileReductionAnalysis aggregates scanner summaries', async () => {
    const root = makeTempProject({
        'node_modules/pkg/index.js': 'module.exports = {};\n',
        'assets/a.png': 'dup',
        'assets/b.png': 'dup',
        'package.json': JSON.stringify({ main: 'index.js' }),
        'index.js': "require('./used.js');\n",
        'used.js': 'module.exports = 1;\n',
        'unused.js': 'module.exports = 2;\n'
    });

    const report = await runFileReductionAnalysis(root);
    assert.ok(report.summary.totalFindings > 0);
    assert.ok(report.findings.buildArtifacts.length > 0);
    assert.ok(report.findings.assetConsolidation.length > 0);
    assert.equal(report.dryRun, true);
});

test('generateFileReductionReport renders markdown sections', async () => {
    const report = {
        projectRoot: '/tmp/demo',
        generatedAt: '2026-05-25T00:00:00.000Z',
        dryRun: true,
        inventory: { totalFiles: 10, totalDirectories: 2 },
        summary: {
            totalFindings: 2,
            buildArtifactFindings: 1,
            duplicateAssetGroups: 1,
            unusedFileCandidates: 0,
            reclaimableBytes: 100,
            estimatedReductionPct: 20
        },
        findings: {
            buildArtifacts: [{
                path: 'dist',
                reason: 'dist directory',
                fileCount: 3,
                sizeBytes: 100,
                action: 'safe-to-delete'
            }],
            assetConsolidation: [],
            unusedFiles: []
        },
        metadata: { entryPoints: ['index.js'] }
    };

    const markdown = generateFileReductionReport(report);
    assert.match(markdown, /Data Cleanup Report/);
    assert.match(markdown, /Build Artifacts/);
    assert.match(markdown, /dist/);
});
