'use strict';

const { test, describe } = require('node:test');
const assert = require('assert');
const {
  calculateComplianceGrade,
  anonymizeProjectId,
  generateDashboardMetrics
} = require('../dashboard-analytics.cjs');

// Mock data matrix resembling high-volume pipeline telemetry records
const mockScanHistory = [
  {
    timestamp: '2026-08-01T10:00:00.000Z',
    filesCount: 100,
    linesCount: 15000,
    remediationsCount: 15,
    complianceScore: 75,
    severities: { critical: 1, high: 2, medium: 5, low: 7 }
  },
  {
    timestamp: '2026-08-03T14:30:00.000Z',
    filesCount: 120,
    linesCount: 18500,
    remediationsCount: 25,
    complianceScore: 92,
    severities: { critical: 0, high: 0, medium: 2, low: 3 }
  }
];

describe('Admin Dashboard Analytics Backend', () => {

  test('should accurately calculate compliance grades from scores', () => {
    assert.strictEqual(calculateComplianceGrade(95), 'A');
    assert.strictEqual(calculateComplianceGrade(84), 'B');
    assert.strictEqual(calculateComplianceGrade(72), 'C');
    assert.strictEqual(calculateComplianceGrade(60), 'D');
    assert.strictEqual(calculateComplianceGrade(45), 'F');
  });

  test('should generate uniform, truncated project hashes using tenant salts', () => {
    const hashA = anonymizeProjectId('internal-banking-api', 'secret_salt_123');
    const hashB = anonymizeProjectId('internal-banking-api', 'secret_salt_123');
    const hashC = anonymizeProjectId('internal-banking-api', 'different_salt');

    assert.strictEqual(hashA.length, 16);
    assert.strictEqual(hashA, hashB, 'Identical seeds must yield matching tracking IDs');
    assert.notStrictEqual(hashA, hashC, 'Varying salts must separate customer projects completely');
  });

  test('should gracefully aggregate empty history streams', () => {
    const metrics = generateDashboardMetrics([]);
    assert.strictEqual(metrics.totalScans, 0);
    assert.strictEqual(metrics.averageComplianceScore, 0);
    assert.strictEqual(metrics.currentGrade, 'F');
  });

  test('should calculate valid rolling metrics, time series timeline chart mappings, and dev hours', () => {
    const metrics = generateDashboardMetrics(mockScanHistory);

    assert.strictEqual(metrics.totalScans, 2);
    assert.strictEqual(metrics.totalFilesAnalyzed, 220);
    assert.strictEqual(metrics.totalLinesAnalyzed, 33500);
    assert.strictEqual(metrics.totalIssuesRemediated, 40);

    // Formula verification: (40 remediations * 12 mins) / 60 = 8.0 hours saved
    assert.strictEqual(metrics.developerHoursSaved, 8.0);

    // Score scaling: (75 + 92) / 2 = 83.5 -> Rounded to 84 (Grade B)
    assert.strictEqual(metrics.averageComplianceScore, 84);
    assert.strictEqual(metrics.currentGrade, 'B');

    // Severity mapping structures
    assert.strictEqual(metrics.severityDistribution.critical, 1);
    assert.strictEqual(metrics.severityDistribution.high, 2);

    // Dynamic timeline chart indices
    assert.strictEqual(metrics.timelineData.length, 2);
    assert.strictEqual(metrics.timelineData[0].date, '2026-08-01');
    assert.strictEqual(metrics.timelineData[1].score, 92);
  });
});
