'use strict';

const { buildExecutiveDashboardBanner, buildExecutiveKpiStrip, buildCoverPresentation } = require('../audit-report/html-sections.cjs');

describe('audit-report/html-sections', () => {
  test('exports expected functions', () => {
    expect(typeof buildExecutiveDashboardBanner).toBe('function');
    expect(typeof buildExecutiveKpiStrip).toBe('function');
    expect(typeof buildCoverPresentation).toBe('function');
  });

  test('buildExecutiveDashboardBanner returns HTML for handoff tier', () => {
    const model = {
      exportTier: { tier: 'handoff' },
      summary: { gatePass: true }
    };
    const html = buildExecutiveDashboardBanner(model);
    expect(typeof html).toBe('string');
    expect(html).toContain('gate-banner');
    expect(html).toContain('PASS');
  });

  test('buildExecutiveDashboardBanner shows FAIL for gate fail', () => {
    const model = {
      exportTier: { tier: 'handoff' },
      summary: { gatePass: false }
    };
    const html = buildExecutiveDashboardBanner(model);
    expect(html).toContain('FAIL');
  });

  test('buildExecutiveDashboardBanner shows NOT EVALUATED for null gate', () => {
    const model = {
      exportTier: { tier: 'handoff' },
      summary: { gatePass: null }
    };
    const html = buildExecutiveDashboardBanner(model);
    expect(html).toContain('NOT EVALUATED');
  });

  test('buildExecutiveDashboardBanner handles codebase-only tier', () => {
    const model = {
      exportTier: { tier: 'codebase-only' },
      summary: { codebaseHealth: 85, codeFilesAnalyzed: 100, productionFindings: 3 }
    };
    const html = buildExecutiveDashboardBanner(model);
    expect(html).toContain('Codebase deep scan');
    expect(html).toContain('85%');
  });

  test('buildExecutiveKpiStrip returns HTML string', () => {
    const model = {
      summary: { codeFilesAnalyzed: 100, productionFindings: 0, severityCounts: { high: 0, medium: 0, low: 5 } }
    };
    const html = buildExecutiveKpiStrip(model);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  test('buildCoverPresentation returns object with expected fields', () => {
    const model = {
      exportTier: { tier: 'handoff', label: 'Handoff' },
      summary: { gatePass: true }
    };
    const result = buildCoverPresentation(model);
    expect(result).toHaveProperty('pageTitle');
    expect(result).toHaveProperty('tier');
  });
});
