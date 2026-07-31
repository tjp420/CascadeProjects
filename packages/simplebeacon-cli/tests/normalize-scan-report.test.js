const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePlatformScanReport,
  isStaleFullTreeScan,
} = require('../src/lib/normalize-scan-report');

test('recomputes gate and quality from platform-only issues (stale full-tree metrics)', () => {
  const platformIssue = {
    id: 'cred-1',
    severity: 'high',
    type: 'Credential Pattern',
    count: 22,
    description: 'Test credential hits',
    filePath: 'server/routes/billing.js',
  };
  const benchmarkIssue = {
    id: 'bench-1',
    severity: 'high',
    type: 'Credential Pattern',
    count: 60,
    filePath: 'github-cache/some-repo/secret.json',
  };
  const report = {
    type: 'simplebeacon-report',
    projectRoot: '/tmp/example-ai-platform',
    scanPaths: ['/tmp/example-ai-platform'],
    mockSampleFiles: 35481,
    repositoryFilesTotal: 69421,
    qualityScore: 100,
    invalidJson: 26,
    credentialFindings: 82,
    gate: {
      pass: false,
      blockingCount: 30,
      warningCount: 0,
      failOn: ['high'],
      warnOn: ['medium', 'low'],
    },
    rawIssues: [platformIssue, benchmarkIssue],
    detectedIssues: [platformIssue],
    scanScope: { benchmarkCacheIssuesExcluded: 84 },
  };

  const normalized = normalizePlatformScanReport(report);

  assert.equal(isStaleFullTreeScan(report), true);
  assert.equal(normalized.scanScope.reportHealth, 'stale-full-tree-scan');
  assert.equal(normalized.scanScope.rescanRecommended, true);
  assert.equal(normalized.gate.blockingCount, 22);
  assert.equal(normalized.gate.pass, false);
  assert.equal(normalized.credentialFindings, 22);
  assert.ok(normalized.qualityScore < 100);
  assert.equal(normalized.rawIssues.length, 1);
  assert.equal(normalized.scanScope.benchmarkCacheIssuesExcluded, 1);
});

test('monorepo workspace scan at project root is not stale-full-tree-scan', () => {
  const report = {
    type: 'simplebeacon-report',
    projectRoot: 'c:\\Users\\Trevor\\CascadeProjects',
    platformRoot: 'c:\\Users\\Trevor\\CascadeProjects\\ai-platform',
    scanPaths: ['c:\\Users\\Trevor\\CascadeProjects'],
    mockSampleFiles: 66,
    repositoryFilesTotal: 1904,
    totalFiles: 1904,
    ruleScopedFilesAnalyzed: 1904,
    qualityScore: 100,
    gate: {
      pass: true,
      blockingCount: 0,
      warningCount: 817,
      failOn: ['high'],
      warnOn: ['medium', 'low'],
    },
    rawIssues: [],
  };
  assert.equal(isStaleFullTreeScan(report), false);
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.scanScope.reportHealth, 'platform-scoped');
  assert.notEqual(normalized.scanScope.inventoryMetricsStale, true);
  assert.ok(
    !normalized.mockDataCategories ||
      normalized.mockDataCategories.length === 0 ||
      !String(normalized.mockDataCategories[0]?.category || '').includes('Stale inventory')
  );
});

test('intentional fullDirectoryScan with large walk remains stale-full-tree-scan', () => {
  const report = {
    type: 'simplebeacon-report',
    projectRoot: '/repo/monorepo',
    scanPaths: ['/repo/monorepo'],
    fullDirectoryScan: true,
    mockSampleFiles: 120,
    repositoryFilesTotal: 12000,
    totalFiles: 20000,
    ruleScopedFilesAnalyzed: 20000,
    gate: { pass: true, blockingCount: 0, failOn: ['high'], warnOn: ['medium', 'low'] },
    rawIssues: [],
  };
  assert.equal(isStaleFullTreeScan(report), true);
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.scanScope.reportHealth, 'stale-full-tree-scan');
  assert.equal(normalized.scanScope.inventoryMetricsStale, true);
});

test('2026-07-16 CascadeProjects export normalizes without stale flag', () => {
  const reportPath = 'j:/Downloads/simplebeacon-report-2026-07-16.json';
  if (!require('fs').existsSync(reportPath)) {
    return;
  }
  const report = require(reportPath);
  assert.equal(isStaleFullTreeScan(report), false);
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.scanScope.reportHealth, 'platform-scoped');
  assert.notEqual(normalized.scanScope.inventoryMetricsStale, true);
});

test('normalizes stale export (3) to zero actionable platform issues', () => {
  const reportPath = 'j:/Downloads/simplebeacon-report-2026-05-29(3).json';
  if (!require('fs').existsSync(reportPath)) {
    return;
  }
  const report = require(reportPath);
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.rawIssues.length, 0);
  assert.equal(normalized.gate.pass, true);
  assert.equal(normalized.scanScope.reportHealth, 'stale-full-tree-scan');
  assert.equal(normalized.scanScope.excludedScanNoiseIssues, 23);
  assert.equal(normalized.mockDataCategories.length, 1);
  assert.match(normalized.mockDataCategories[0].category, /Stale inventory/);
});

test('warn-only EU AI Act findings do not reduce quality score when gate failOn is high', () => {
  const report = {
    type: 'simplebeacon-report',
    projectRoot: '/repo/ai-platform',
    scanPaths: ['/repo/ai-platform/web/data'],
    mockSampleFiles: 48,
    gate: { failOn: ['high'], warnOn: ['medium', 'low'] },
    rawIssues: Array.from({ length: 71 }, (_, i) => ({
      id: `EUAI-AI-001-file-${i}.js-${i}`,
      severity: 'medium',
      type: 'EU AI Act — AI System Indicator',
      count: 1,
      filePath: `server/file-${i}.js`,
    })),
  };
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.gate.pass, true);
  assert.equal(normalized.gate.blockingCount, 0);
  assert.equal(normalized.qualityScore, 100);
});

test('passes gate when no blocking platform issues remain', () => {
  const report = {
    type: 'simplebeacon-report',
    projectRoot: '/repo/ai-platform',
    scanPaths: ['/repo/ai-platform/web/data'],
    mockSampleFiles: 48,
    rawIssues: [
      {
        id: 'dup-1',
        severity: 'low',
        type: 'Duplicate Data',
        count: 1,
        description: 'duplicate export',
        filePath: 'web/data/a-sample.json',
      },
    ],
    gate: { pass: false, blockingCount: 5 },
  };
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.gate.pass, true);
  assert.equal(normalized.gate.blockingCount, 0);
  assert.equal(normalized.issueCount, 1);
});

test('critical credential issues always block gate', () => {
  const report = {
    type: 'simplebeacon-report',
    projectRoot: '/repo/ai-platform',
    scanPaths: ['/repo/ai-platform/web/data'],
    mockSampleFiles: 48,
    gate: { failOn: ['high'], warnOn: ['medium', 'low'] },
    rawIssues: [
      {
        id: 'crit-1',
        severity: 'high',
        severityBand: 'critical',
        type: 'Credential Pattern',
        count: 1,
        filePath: 'server/routes/billing.js',
      },
    ],
  };
  const normalized = normalizePlatformScanReport(report);
  assert.equal(normalized.gate.pass, false);
  assert.equal(normalized.gate.blockingCount, 1);
});

test('reconcileScanReport aligns scan_summary with gate blockingCount', () => {
  const { reconcileScanReport } = require('../src/lib/normalize-scan-report');
  const report = reconcileScanReport({
    type: 'simplebeacon-report',
    scan_summary: { status: 'PASSED', block_merge: false },
    summary: { gatePass: true },
    metrics: { status: 'OK' },
    gate: {
      pass: true,
      blockingCount: 1,
      blockingIssues: [
        {
          file: 'server/lib/__tests__/audit-remediation-classify.test.cjs',
          type: 'hardcoded-api-key',
          severity: 'high',
          line: 26,
          message: 'Hardcoded API key detected',
        },
      ],
    },
  });
  assert.equal(report.scan_summary.status, 'FAILED');
  assert.equal(report.scan_summary.block_merge, true);
  assert.equal(report.gate.pass, false);
  assert.equal(report.metrics.status, 'CRITICAL_BLOCK');
  assert.equal(report.summary.gatePass, false);
});
