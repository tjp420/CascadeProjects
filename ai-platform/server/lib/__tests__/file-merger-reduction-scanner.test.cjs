'use strict';

const {
  scanFileMergerReduction,
  collectSampleDataFiles,
  collectRepositoryFiles,
  buildConsolidationConclusion,
  OVERSIZED_THRESHOLD_BYTES,
  STRUCTURE_SIMILARITY_THRESHOLD,
} = require('../file-merger-reduction-scanner.cjs');

describe('file-merger-reduction-scanner', () => {
  test('exports expected functions and constants', () => {
    expect(typeof scanFileMergerReduction).toBe('function');
    expect(typeof collectSampleDataFiles).toBe('function');
    expect(typeof collectRepositoryFiles).toBe('function');
    expect(typeof buildConsolidationConclusion).toBe('function');
    expect(typeof OVERSIZED_THRESHOLD_BYTES).toBe('number');
    expect(typeof STRUCTURE_SIMILARITY_THRESHOLD).toBe('number');
    expect(OVERSIZED_THRESHOLD_BYTES).toBeGreaterThan(0);
    expect(STRUCTURE_SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(STRUCTURE_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
  });

  test('buildConsolidationConclusion produces a summary string', () => {
    const report = {
      summary: {
        mergeCandidates: 2,
        reductionOpportunities: 1,
        filesAnalyzed: 100,
        sampleDataFilesAnalyzed: 10,
        potentialSavingsLabel: '5.2MB',
      },
    };
    const result = buildConsolidationConclusion(report);
    expect(typeof result).toBe('string');
    expect(result).toContain('3 merge/reduction candidate(s)');
    expect(result).toContain('5.2MB');
  });

  test('buildConsolidationConclusion handles missing report', () => {
    const result = buildConsolidationConclusion(null);
    expect(typeof result).toBe('string');
    expect(result).toContain('No consolidation scan available');
  });

  test('collectRepositoryFiles returns array for valid directory', async () => {
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fmrs-test-'));
    fs.writeFileSync(path.join(tmpDir, 'test.json'), '{"a":1}');
    try {
      const files = await collectRepositoryFiles(tmpDir);
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty('path');
    } finally {
      fs.unlinkSync(path.join(tmpDir, 'test.json'));
      fs.rmdirSync(tmpDir);
    }
  });
});
