const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('internal-improvement-report', () => {
  let tmpDir;
  let storePath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-improvement-report-'));
    storePath = path.join(tmpDir, 'ci-telemetry.json');
    process.env.SIMPLEBEACON_CI_TELEMETRY_STORE = storePath;
    delete require.cache[require.resolve('../../lib/ci-telemetry-store.cjs')];
    delete require.cache[require.resolve('../internal-improvement-report.cjs')];
  });

  afterEach(() => {
    delete process.env.SIMPLEBEACON_CI_TELEMETRY_STORE;
    delete process.env.ADMIN_NOTIFY_EMAIL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve('../../lib/ci-telemetry-store.cjs')];
    delete require.cache[require.resolve('../internal-improvement-report.cjs')];
  });

  it('generateImprovementReportMarkdown produces valid markdown structure', () => {
    const { generateImprovementReportMarkdown } = require('../internal-improvement-report.cjs');
    const summary = {
      periodDays: 30,
      total_scans: 10,
      gates_tripped: 3,
      criticals_blocked: 2,
      gate_pass_rate: 0.7,
      quality_distribution: { p10: 60, p25: 70, p50: 80, p75: 88, p90: 95, sampleSize: 10 },
      severity_totals: { critical: 2, high: 5, medium: 10, low: 15 },
      category_totals: { security: 7, schema: 12, 'ai-quality': 8 },
      scan_sources: { ci: 6, ide: 3, dashboard: 1 },
      distinct_workspaces: 5,
      distinct_orgs: 4,
      k_anonymity_met: true,
      k_anonymity_min: 3,
      workspace_breakdown: [
        { workspace_fingerprint: 'abc123def4567890abcdef12', scan_count: 4 },
        { workspace_fingerprint: 'def456abc7890abcdef1234', scan_count: 6 }
      ]
    };

    const markdown = generateImprovementReportMarkdown(summary);

    assert.ok(markdown.includes('# SimpleBeacon Internal Program Improvement Report'));
    assert.ok(markdown.includes('## Executive Summary'));
    assert.ok(markdown.includes('## Severity Distribution'));
    assert.ok(markdown.includes('## Issue Category Frequency'));
    assert.ok(markdown.includes('## Quality Score Distribution'));
    assert.ok(markdown.includes('## Scan Source Adoption'));
    assert.ok(markdown.includes('## Workspace Breakdown'));
    assert.ok(markdown.includes('## Privacy Status'));
    assert.ok(markdown.includes('**Total scans**: 10'));
    assert.ok(markdown.includes('**Gate pass rate**: 70%'));
    assert.ok(markdown.includes('**critical**: 2'));
    assert.ok(markdown.includes('**security**: 7'));
  });

  it('generateImprovementReportMarkdown handles empty summary', () => {
    const { generateImprovementReportMarkdown } = require('../internal-improvement-report.cjs');
    const markdown = generateImprovementReportMarkdown(null);
    assert.ok(markdown.includes('No telemetry data available.'));
  });

  it('generateImprovementReportMarkdown shows suppressed message when k-anonymity not met', () => {
    const { generateImprovementReportMarkdown } = require('../internal-improvement-report.cjs');
    const summary = {
      periodDays: 30,
      total_scans: 2,
      gates_tripped: 1,
      criticals_blocked: 0,
      gate_pass_rate: 0.5,
      quality_distribution: { p10: null, p25: null, p50: null, p75: null, p90: null, sampleSize: 0 },
      severity_totals: { critical: 0, high: 1, medium: 0, low: 0 },
      category_totals: {},
      scan_sources: { ci: 2, ide: 0, dashboard: 0 },
      distinct_workspaces: 2,
      distinct_orgs: 2,
      k_anonymity_met: false,
      k_anonymity_min: 3
    };

    const markdown = generateImprovementReportMarkdown(summary);
    assert.ok(markdown.includes('NOT MET'));
    assert.ok(markdown.includes('BREAKDOWNS SUPPRESSED'));
    assert.ok(markdown.includes('_Suppressed — k-anonymity floor not met._'));
  });

  it('generateImprovementReportMarkdown contains no PII', () => {
    const { generateImprovementReportMarkdown } = require('../internal-improvement-report.cjs');
    const summary = {
      periodDays: 30,
      total_scans: 5,
      gates_tripped: 1,
      criticals_blocked: 0,
      gate_pass_rate: 0.8,
      quality_distribution: { p10: 70, p25: 75, p50: 82, p75: 88, p90: 92, sampleSize: 5 },
      severity_totals: { critical: 0, high: 1, medium: 3, low: 5 },
      category_totals: { security: 1, schema: 3 },
      scan_sources: { ci: 4, ide: 1, dashboard: 0 },
      distinct_workspaces: 5,
      distinct_orgs: 4,
      k_anonymity_met: true,
      k_anonymity_min: 3,
      workspace_breakdown: [
        { workspace_fingerprint: 'abc123def4567890abcdef12', scan_count: 3 }
      ]
    };

    const markdown = generateImprovementReportMarkdown(summary);
    assert.ok(!markdown.includes('@example.com'), 'No emails in report');
    assert.ok(!markdown.includes('/secret/'), 'No file paths in report');
    assert.ok(!markdown.includes('password'), 'No secrets in report');
    assert.ok(!markdown.includes('user@example'), 'No user identifiers in report');
  });

  it('executeImprovementReportJob generates report and emails when not dry run', async () => {
    const { recordCiTelemetryEvent } = require('../../lib/ci-telemetry-store.cjs');
    const { executeImprovementReportJob, setEmailServiceForTests } = require('../internal-improvement-report.cjs');

    // Record enough events to meet k-anonymity floor
    recordCiTelemetryEvent('a@example.com', {
      workspace_fingerprint: 'aaa1234567890abcdefaaa12',
      gate_pass: true,
      quality_score: 85
    });
    recordCiTelemetryEvent('b@example.com', {
      workspace_fingerprint: 'bbb1234567890abcdefbbb45',
      gate_pass: false,
      quality_score: 72
    });
    recordCiTelemetryEvent('c@example.com', {
      workspace_fingerprint: 'ccc1234567890abcdefccc78',
      gate_pass: true,
      quality_score: 90
    });

    let emailed = false;
    let emailedTo = '';
    let emailedSubject = '';
    setEmailServiceForTests({
      sendEmail: async (opts) => {
        emailed = true;
        emailedTo = opts.to;
        emailedSubject = opts.subject;
      }
    });

    process.env.ADMIN_NOTIFY_EMAIL = 'admin@simplebeacon.ai';
    const result = await executeImprovementReportJob({ days: 7, dryRun: false });

    assert.ok(result.markdown);
    assert.ok(result.summary);
    assert.strictEqual(emailed, true);
    assert.strictEqual(emailedTo, 'admin@simplebeacon.ai');
    assert.ok(emailedSubject.includes('SimpleBeacon Internal Improvement Report'));
  });

  it('executeImprovementReportJob does not email in dry run mode', async () => {
    const { recordCiTelemetryEvent } = require('../../lib/ci-telemetry-store.cjs');
    const { executeImprovementReportJob, setEmailServiceForTests } = require('../internal-improvement-report.cjs');

    recordCiTelemetryEvent('a@example.com', {
      workspace_fingerprint: 'aaa1234567890abcdefaaa12',
      gate_pass: true
    });

    let emailed = false;
    setEmailServiceForTests({
      sendEmail: async () => { emailed = true; }
    });

    const result = await executeImprovementReportJob({ days: 7, dryRun: true });

    assert.ok(result.markdown);
    assert.strictEqual(emailed, false);
    assert.strictEqual(result.emailed, false);
  });

  it('executeImprovementReportJob does not email when no telemetry data', async () => {
    const { executeImprovementReportJob, setEmailServiceForTests } = require('../internal-improvement-report.cjs');

    let emailed = false;
    setEmailServiceForTests({
      sendEmail: async () => { emailed = true; }
    });

    const result = await executeImprovementReportJob({ days: 7, dryRun: false });

    assert.ok(result.markdown);
    assert.strictEqual(result.summary.total_scans, 0);
    assert.strictEqual(emailed, false);
    assert.strictEqual(result.emailed, false);
  });

  it('sortSeverityTotals returns sorted severity pairs', () => {
    const { sortSeverityTotals } = require('../internal-improvement-report.cjs');
    const result = sortSeverityTotals({ critical: 2, high: 5, medium: 0, low: 3 });
    assert.strictEqual(result.length, 3); // only non-zero
    assert.strictEqual(result[0][0], 'critical');
    assert.strictEqual(result[0][1], 2);
    assert.strictEqual(result[1][0], 'high');
    assert.strictEqual(result[1][1], 5);
    assert.strictEqual(result[2][0], 'low');
    assert.strictEqual(result[2][1], 3);
  });

  it('sortCategoryTotals sorts by count descending', () => {
    const { sortCategoryTotals } = require('../internal-improvement-report.cjs');
    const result = sortCategoryTotals({ security: 3, schema: 10, 'ai-quality': 5 });
    assert.strictEqual(result[0][0], 'schema');
    assert.strictEqual(result[0][1], 10);
    assert.strictEqual(result[1][0], 'ai-quality');
    assert.strictEqual(result[1][1], 5);
    assert.strictEqual(result[2][0], 'security');
    assert.strictEqual(result[2][1], 3);
  });

  it('formatQualityDistribution handles null distribution', () => {
    const { formatQualityDistribution } = require('../internal-improvement-report.cjs');
    const result = formatQualityDistribution(null);
    assert.ok(result.includes('No quality score data available.'));
  });

  it('formatQualityDistribution formats valid distribution', () => {
    const { formatQualityDistribution } = require('../internal-improvement-report.cjs');
    const result = formatQualityDistribution({ p10: 60, p25: 70, p50: 80, p75: 88, p90: 95, sampleSize: 10 });
    assert.ok(result.includes('p50: 80'));
    assert.ok(result.includes('sample size: 10'));
  });
});
