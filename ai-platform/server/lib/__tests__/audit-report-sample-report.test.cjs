'use strict';

const {
  buildSampleAuditReportModel,
  buildSampleAuditReportHtml,
  wrapSampleReportForWebsite,
} = require('../audit-report/sample-report.cjs');

describe('audit-report/sample-report', () => {
  test('exports expected functions', () => {
    expect(typeof buildSampleAuditReportModel).toBe('function');
    expect(typeof buildSampleAuditReportHtml).toBe('function');
    expect(typeof wrapSampleReportForWebsite).toBe('function');
  });

  test('buildSampleAuditReportModel returns a model object', () => {
    const model = buildSampleAuditReportModel();
    expect(typeof model).toBe('object');
    expect(model).toHaveProperty('summary');
    expect(model).toHaveProperty('readiness');
    expect(model).toHaveProperty('businessRiskCounts');
  });

  test('buildSampleAuditReportModel includes confidenceScore', () => {
    const model = buildSampleAuditReportModel();
    expect(model.summary).toHaveProperty('confidenceScore');
    expect(model.summary.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(model.summary.confidenceScore).toBeLessThanOrEqual(100);
  });

  test('buildSampleAuditReportHtml returns HTML string', () => {
    const html = buildSampleAuditReportHtml();
    expect(typeof html).toBe('string');
    expect(html).toContain('<html');
  });

  test('buildSampleAuditReportHtml with siteChrome=false returns bare audit', () => {
    const html = buildSampleAuditReportHtml({ siteChrome: false });
    expect(typeof html).toBe('string');
    expect(html).toContain('<html');
  });

  test('wrapSampleReportForWebsite returns HTML string', () => {
    const html = wrapSampleReportForWebsite();
    expect(typeof html).toBe('string');
    expect(html).toContain('<html');
  });
});
