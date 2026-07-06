import { describe, it } from 'node:test';
import assert from 'node:assert';

// Set up minimal browser globals before dynamic import
globalThis.document = { cookie: '' };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = { location: { origin: 'http://localhost' }, addEventListener: () => {}, removeEventListener: () => {} };

const {
  slimReportForSummary,
  previewAuditExportTier,
  normalizeAuditExportPayload,
  filterIssuesByKind,
  isLegacyScanReport,
  buildScanConclusion,
  buildConsolidationConclusion,
  isSimplebeaconReport,
  isCodebaseReport,
  formatScanScopeSummary,
  formatScanInventoryNote,
  getScanFileMetrics
} = await import('../services/analyzeService.js');

describe('analyzeService', () => {
  describe('slimReportForSummary', () => {
    it('slims codebase-analyzer-report', () => {
      const report = {
        type: 'codebase-analyzer-report',
        summary: 'test',
        categories: Array(20).fill({}),
        findings: Array(30).fill({ category: 'a', severity: 'high', description: 'd', filePath: 'f.js' }),
        scanScope: { profile: 'universal' },
        repositoryInventory: { totalFiles: 100 }
      };
      const slim = slimReportForSummary(report);
      assert.strictEqual(slim.categories.length, 12);
      assert.strictEqual(slim.findings.length, 24);
      assert.strictEqual(slim.findings[0].category, 'a');
    });

    it('slims simplebeacon-report', () => {
      const report = {
        type: 'simplebeacon-report',
        rawIssues: Array(30).fill({ severity: 'high' }),
        detectedIssues: Array(20).fill({ severity: 'medium' })
      };
      const slim = slimReportForSummary(report);
      assert.strictEqual(slim.rawIssues.length, 24);
      assert.strictEqual(slim.detectedIssues.length, 12);
    });

    it('slims file-merger-reduction-report', () => {
      const report = {
        type: 'file-merger-reduction-report',
        summary: 'test',
        mergeCandidates: Array(12).fill({}),
        reductionOpportunities: Array(12).fill({}),
        scanScope: { profile: 'all' },
        repositoryInventory: { totalFiles: 50 }
      };
      const slim = slimReportForSummary(report);
      assert.strictEqual(slim.mergeCandidates.length, 8);
      assert.strictEqual(slim.reductionOpportunities.length, 8);
    });

    it('slims data-cleanup-report', () => {
      const report = {
        type: 'data-cleanup-report',
        scanProfile: 'data-quality',
        summary: { totalFindings: 5 },
        fileReductionPlan: {
          totals: { safeToDeleteBytes: 100 },
          safeToDelete: { topDirectories: Array(12).fill('dir') },
          unusedFiles: { candidates: [] }
        },
        executiveSummary: {
          priorityActions: Array(10).fill('action'),
          workspace: {},
          security: {}
        },
        allFindings: Array(20).fill({ type: 't', severity: 'low', path: 'p', reason: 'r' })
      };
      const slim = slimReportForSummary(report);
      assert.strictEqual(slim.allFindings.length, 12);
      assert.strictEqual(slim.fileReductionPlan.safeToDelete.topDirectories.length, 8);
    });

    it('returns non-matching report as-is', () => {
      const report = { type: 'unknown', data: 'keep' };
      assert.strictEqual(slimReportForSummary(report), report);
    });
  });

  describe('previewAuditExportTier', () => {
    it('returns insufficient for null payload', () => {
      const result = previewAuditExportTier(null);
      assert.strictEqual(result.tier, 'insufficient');
      assert.strictEqual(result.exportBlocked, true);
    });

    it('returns handoff when gate and codebase present', () => {
      const payload = {
        results: {
          simplebeacon: { gate: { pass: true } },
          codebase: { summary: { codeFilesAnalyzed: 10 } }
        }
      };
      const result = previewAuditExportTier(payload);
      assert.strictEqual(result.tier, 'handoff');
      assert.strictEqual(result.exportBlocked, false);
    });

    it('returns gate-only when only gate present', () => {
      const payload = {
        results: {
          simplebeacon: { gate: { pass: false } }
        }
      };
      const result = previewAuditExportTier(payload);
      assert.strictEqual(result.tier, 'gate-only');
    });

    it('returns supplementary for roadmap results', () => {
      const payload = {
        results: { roadmap: { type: 'roadmap' } }
      };
      const result = previewAuditExportTier(payload);
      assert.strictEqual(result.tier, 'supplementary');
      assert.strictEqual(result.label, 'Roadmap analysis');
    });
  });

  describe('normalizeAuditExportPayload', () => {
    it('returns existing payload with results', () => {
      const payload = { results: { a: 1 } };
      assert.strictEqual(normalizeAuditExportPayload(payload), payload);
    });

    it('wraps data-cleanup-report into simplebeacon-complete-scan', () => {
      const payload = {
        type: 'data-cleanup-report',
        scanProfile: 'file-reduction',
        generatedAt: '2024-01-01',
        projectRoot: '/test'
      };
      const result = normalizeAuditExportPayload(payload);
      assert.strictEqual(result.type, 'simplebeacon-complete-scan');
      assert.ok(result.results.fileReduction);
    });

    it('returns null for invalid input', () => {
      assert.strictEqual(normalizeAuditExportPayload(null), null);
      assert.strictEqual(normalizeAuditExportPayload('string'), null);
    });
  });

  describe('filterIssuesByKind', () => {
    it('filters fiction issues', () => {
      const report = {
        rawIssues: [
          { type: 'fiction-kpi', count: 1 },
          { type: 'credential', count: 1 },
          { type: 'fictional', count: 1 }
        ]
      };
      const fiction = filterIssuesByKind(report, 'fiction');
      assert.strictEqual(fiction.length, 2);
    });

    it('filters credential issues', () => {
      const report = {
        rawIssues: [
          { type: 'credential-leak', count: 1 },
          { type: 'production', count: 1 }
        ]
      };
      const creds = filterIssuesByKind(report, 'credentials');
      assert.strictEqual(creds.length, 1);
    });

    it('returns all issues for unknown kind', () => {
      const report = {
        rawIssues: [{ type: 'a' }, { type: 'b' }]
      };
      assert.strictEqual(filterIssuesByKind(report, 'unknown').length, 2);
    });
  });

  describe('isLegacyScanReport', () => {
    it('returns true for null report', () => {
      assert.strictEqual(isLegacyScanReport(null), true);
    });

    it('returns true for old reportVersion', () => {
      assert.strictEqual(isLegacyScanReport({ reportVersion: 1 }), true);
    });

    it('returns false for matching projectRoot', () => {
      assert.strictEqual(
        isLegacyScanReport({ reportVersion: 2, projectRoot: '/test' }, '/test'),
        false
      );
    });

    it('returns true for mismatched projectRoot', () => {
      assert.strictEqual(
        isLegacyScanReport({ reportVersion: 2, projectRoot: '/other' }, '/test'),
        true
      );
    });
  });

  describe('buildScanConclusion', () => {
    it('returns no-scan message for null report', () => {
      assert.strictEqual(buildScanConclusion(null), 'No scan report available.');
    });

    it('mentions benchmark scan when flagged', () => {
      const report = { repositoryFilesTotal: 100, scanScope: {} };
      const result = buildScanConclusion(report, { benchmarkScan: true });
      assert.ok(result.includes('benchmark'));
    });

    it('includes fiction issue count when present', () => {
      const report = {
        rawIssues: [
          { type: 'fiction-kpi', count: 3 },
          { type: 'credential', count: 1 }
        ]
      };
      const result = buildScanConclusion(report);
      assert.ok(result.includes('3 fiction'));
    });

    it('returns clean scan message when no issues', () => {
      const report = { rawIssues: [], gate: { pass: true } };
      const result = buildScanConclusion(report);
      assert.ok(result.includes('Clean deterministic') || result.includes('Gate passes'));
    });
  });

  describe('buildConsolidationConclusion', () => {
    it('returns no-scan message for null scan', () => {
      assert.strictEqual(buildConsolidationConclusion(null), 'No consolidation scan available.');
    });

    it('detects benchmark clone', () => {
      const scan = {
        projectRoot: '/github-cache/test',
        benchmarkScan: true,
        summary: { repositoryFilesTotal: 50 }
      };
      const result = buildConsolidationConclusion(scan);
      assert.ok(result.includes('benchmark'));
    });
  });

  describe('isSimplebeaconReport', () => {
    it('returns true for simplebeacon-report type', () => {
      assert.strictEqual(isSimplebeaconReport({ type: 'simplebeacon-report' }), true);
    });

    it('returns true for rawIssues presence', () => {
      assert.strictEqual(isSimplebeaconReport({ rawIssues: [] }), true);
    });

    it('returns false for non-report', () => {
      assert.strictEqual(isSimplebeaconReport(null), false);
      assert.strictEqual(isSimplebeaconReport({}), false);
    });
  });

  describe('isCodebaseReport', () => {
    it('returns true for codebase-analyzer-report', () => {
      assert.strictEqual(isCodebaseReport({ type: 'codebase-analyzer-report' }), true);
    });

    it('returns false for other types', () => {
      assert.strictEqual(isCodebaseReport({ type: 'simplebeacon-report' }), false);
      assert.strictEqual(isCodebaseReport(null), false);
    });
  });

  describe('formatScanScopeSummary', () => {
    it('returns formatted summary with metrics', () => {
      const report = {
        ruleScopedFilesAnalyzed: 100,
        repositoryFilesTotal: 200,
        mockSampleFiles: 10,
        totalSizeLabel: '1.2 MB'
      };
      const result = formatScanScopeSummary(report);
      assert.ok(result.includes('100 files analyzed'));
      assert.ok(result.includes('200 total'));
    });

    it('returns 0 files for empty report', () => {
      assert.ok(formatScanScopeSummary({}).includes('0 files analyzed'));
    });
  });

  describe('formatScanInventoryNote', () => {
    it('returns null when no repositoryFiles', () => {
      assert.strictEqual(formatScanInventoryNote({}), null);
    });

    it('returns formatted note when metrics available', () => {
      const report = { repositoryFilesTotal: 100, repositoryFoldersTotal: 10 };
      const result = formatScanInventoryNote(report);
      assert.ok(result.includes('100 repo files'));
      assert.ok(result.includes('10 folders'));
    });
  });

  describe('getScanFileMetrics', () => {
    it('returns null metrics for null report', () => {
      const result = getScanFileMetrics(null);
      assert.strictEqual(result.filesAnalyzed, null);
    });

    it('returns metrics for file-merger-reduction-report', () => {
      const report = {
        type: 'file-merger-reduction-report',
        summary: { filesAnalyzed: 50, repositoryFilesTotal: 100 }
      };
      const result = getScanFileMetrics(report);
      assert.strictEqual(result.filesAnalyzed, 100);
    });

    it('returns standard metrics for simplebeacon report', () => {
      const report = {
        filesAnalyzed: 100,
        ruleScopedFilesAnalyzed: 80,
        mockSampleFiles: 10,
        credentialScanned: 5,
        repositoryFilesTotal: 200
      };
      const result = getScanFileMetrics(report);
      assert.strictEqual(result.filesAnalyzed, 80);
      assert.strictEqual(result.mockSampleFiles, 10);
      assert.strictEqual(result.credentialScanned, 5);
      assert.strictEqual(result.repositoryFiles, 200);
    });
  });
});
