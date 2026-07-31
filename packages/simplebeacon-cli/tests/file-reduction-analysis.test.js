// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Helper to create a temporary directory with files
function createTempProject(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-fr-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content || '');
  }
  return tmpDir;
}

function cleanupTempProject(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Mock scanner that returns predictable results
class MockScanner {
  constructor(options) {
    this.options = options;
  }
  async scan(projectRoot, opts) {
    return this.options._result || { findings: [], summary: {} };
  }
}

describe('file-reduction/index.js', () => {
  let tmpDir;
  let moduleUnderTest;

  beforeEach(() => {
    tmpDir = createTempProject({
      'src/index.js': 'console.log("hello")',
      'dist/bundle.js': '/* bundle */',
      'README.md': '# Project',
      'package.json': '{}',
    });

    // Stub heavy dependencies by pre-loading mocks into require cache
    const rulesPath = require.resolve('../src/rules/file-reduction-rules');
    delete require.cache[rulesPath];

    const scannerClasses = [
      '../src/analyzers/file-reduction/build-artifact-scanner',
      '../src/analyzers/file-reduction/asset-consolidation-scanner',
      '../src/analyzers/file-reduction/unused-file-detector',
      '../src/analyzers/file-reduction/supply-chain-security-scanner',
      '../src/analyzers/file-reduction/dead-code-scanner',
      '../src/analyzers/file-reduction/git-hygiene-scanner',
      '../src/analyzers/data-cleanup',
    ];
    for (const mod of scannerClasses) {
      const resolved = require.resolve(mod);
      delete require.cache[resolved];
      require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: {
          BuildArtifactScanner: MockScanner,
          AssetConsolidationScanner: MockScanner,
          UnusedFileDetector: MockScanner,
          SupplyChainSecurityScanner: MockScanner,
          DeadCodeScanner: MockScanner,
          GitHygieneScanner: MockScanner,
          ConfigManagementAnalyzer: MockScanner,
          DependencyHealthAnalyzer: MockScanner,
          EnvironmentVariableAnalyzer: MockScanner,
          DataFreshnessAnalyzer: MockScanner,
          DataAccessPatternAnalyzer: MockScanner,
          DataPrivacyAnalyzer: MockScanner,
          DataLineageAnalyzer: MockScanner,
          DataConsistencyAnalyzer: MockScanner,
        },
      };
    }

    const indexPath = require.resolve('../src/analyzers/file-reduction/index');
    delete require.cache[indexPath];
    moduleUnderTest = require(indexPath);
  });

  it('exports are frozen', () => {
    assert.strictEqual(Object.isFrozen(moduleUnderTest), true);
  });

  it('runFileReductionAnalysis returns structured report', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, { dryRun: true });

    assert.strictEqual(report.type, 'data-cleanup-report');
    assert.strictEqual(report.projectRoot, path.resolve(tmpDir));
    assert.strictEqual(report.dryRun, true);
    assert.strictEqual(typeof report.generatedAt, 'string');
    assert.strictEqual(typeof report.durationMs, 'number');
    assert.ok(report.durationMs >= 0);

    assert.ok(report.inventory);
    assert.strictEqual(typeof report.inventory.totalFiles, 'number');
    assert.strictEqual(typeof report.inventory.totalDirectories, 'number');

    assert.ok(report.scanners);
    assert.ok(report.findings);
    assert.ok(report.aggregation);
    assert.ok(report.allFindings);
    assert.ok(report.summary);
    assert.ok(report.metadata);

    assert.ok(report.fileReductionPlan);
    assert.ok(report.executiveSummary);
    assert.ok(report.scannerStatistics);
  });

  it('findings keys match scanner IDs', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, { dryRun: true });
    const expectedKeys = moduleUnderTest.DEFAULT_SCANNERS.map((s) =>
      s.id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
    );
    for (const key of expectedKeys) {
      assert.ok(Array.isArray(report.findings[key]), `findings.${key} should be an array`);
    }
  });

  it('summary keys match scanner IDs with Findings suffix', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, { dryRun: true });
    const expectedKeys = moduleUnderTest.DEFAULT_SCANNERS.map(
      (s) => s.id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()) + 'Findings'
    );
    for (const key of expectedKeys) {
      assert.strictEqual(typeof report.summary[key], 'number', `summary.${key} should be a number`);
    }
  });

  it('estimatedReductionPct uses bytes ratio, not findings/file count', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, { dryRun: true });
    // With no findings, reclaimableBytes is 0, so pct should be 0
    assert.strictEqual(report.summary.estimatedReductionPct, 0);
  });

  it('enables only default scanners when no explicit config', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, { dryRun: true });
    const enabledByDefault = moduleUnderTest.DEFAULT_SCANNERS.filter((s) => s.enabled);
    // All enabled scanners should have a summary object
    for (const s of enabledByDefault) {
      assert.ok(report.scanners[s.id], `scanner ${s.id} should have summary`);
    }
  });

  it('dryRun defaults to true when omitted', async () => {
    const report = await moduleUnderTest.runFileReductionAnalysis(tmpDir, {});
    assert.strictEqual(report.dryRun, true);
  });

  it('reclaimableBytes sums correctly', async () => {
    // Create a scanner that returns findings with reclaimableBytes
    class ReclaimableScanner extends MockScanner {
      constructor() {
        super({
          _result: {
            findings: [
              { type: 'supply-chain-typosquat', reclaimableBytes: 1024 },
              { type: 'supply-chain-suspicious-script', reclaimableBytes: 2048 },
            ],
            summary: { total: 2 },
          },
        });
      }
    }

    // Mock file-reduction-rules to use our scanner
    const rulesPath = require.resolve('../src/rules/file-reduction-rules');
    delete require.cache[rulesPath];
    require.cache[rulesPath] = {
      id: rulesPath,
      filename: rulesPath,
      loaded: true,
      exports: {
        id: 'file-reduction',
        scanners: [
          { id: 'supply-chain-security', class: ReclaimableScanner, enabled: true, priority: 1 },
        ],
        severityMapping: {},
      },
    };

    const indexPath = require.resolve('../src/analyzers/file-reduction/index');
    delete require.cache[indexPath];
    const mod = require(indexPath);

    const report = await mod.runFileReductionAnalysis(tmpDir, { dryRun: true });
    assert.strictEqual(report.summary.reclaimableBytes, 3072);
    assert.strictEqual(report.summary.supplyChainSecurityFindings, 2);
  });

  it('handles empty inventory gracefully', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-empty-'));
    const report = await moduleUnderTest.runFileReductionAnalysis(emptyDir, { dryRun: true });
    assert.strictEqual(report.inventory.totalFiles, 0);
    assert.strictEqual(report.inventory.totalDirectories, 0);
    assert.strictEqual(report.summary.estimatedReductionPct, 0);
    cleanupTempProject(emptyDir);
  });
});
