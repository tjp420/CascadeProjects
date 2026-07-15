'use strict';

jest.mock('../analyze-deliverable-access.cjs', () => ({
  getTierManifest: jest.fn(),
  resolveDeliverableTier: jest.fn(),
  DELIVERABLE_TIERS: {
    operator: { tier: 'operator', label: 'Operator', requiresCompleteScan: false },
    handoff: { tier: 'handoff', label: 'Handoff', requiresCompleteScan: true, minScanKind: ['complete'] }
  }
}));
jest.mock('../simplebeacon-proxy.cjs', () => ({
  applyPublicGateToAnalyzeResponse: jest.fn().mockReturnValue({ publicSummary: { summary: { gatePass: true } } }),
  sanitizePublicOutput: jest.fn().mockReturnValue({ summary: {} }),
  sanitizePublicSummaryArtifactExport: jest.fn().mockReturnValue({ type: 'simplebeacon-public-summary' }),
  sanitizeCompleteScanExport: jest.fn().mockImplementation((scan) => scan),
  projectLabelFromPath: jest.fn().mockReturnValue('project'),
  redactProjectPathForExport: jest.fn().mockReturnValue('/redacted/project')
}));

const {
  enrichExportBundleManifest,
  resolveCompleteScanExportBundle,
  buildPublicSummary,
  validateScanForTier
} = require('../analyze-export-bundle/validation.cjs');

describe('analyze-export-bundle/validation', () => {
  test('exports expected functions', () => {
    expect(typeof enrichExportBundleManifest).toBe('function');
    expect(typeof resolveCompleteScanExportBundle).toBe('function');
    expect(typeof buildPublicSummary).toBe('function');
    expect(typeof validateScanForTier).toBe('function');
  });

  test('enrichExportBundleManifest adds export metadata', () => {
    const manifest = { type: 'test', projectPath: '/orig' };
    const result = enrichExportBundleManifest(manifest, { tierId: 'operator', projectPath: '/project' });
    expect(result.exportNormalized).toBe(true);
    expect(result.exportSanitized).toBe(true);
    expect(result.securityHandoffEligible).toBe(false);
    expect(result.handoffEligible).toBe(false);
    expect(result.exportNotes).toBeDefined();
    expect(Array.isArray(result.exportNotes)).toBe(true);
  });

  test('enrichExportBundleManifest adds extra note for operator tier', () => {
    const result = enrichExportBundleManifest({}, { tierId: 'operator', projectPath: '/p' });
    expect(result.exportNotes.length).toBe(3);
  });

  test('resolveCompleteScanExportBundle returns non-complete-scan unchanged', () => {
    const scan = { type: 'other' };
    const result = resolveCompleteScanExportBundle(scan, '/path');
    expect(result).toBe(scan);
  });

  test('resolveCompleteScanExportBundle sanitizes complete scan', () => {
    const scan = { type: 'simplebeacon-complete-scan', results: {} };
    const result = resolveCompleteScanExportBundle(scan, '/path');
    expect(result).toBeDefined();
  });

  test('buildPublicSummary returns a public summary object', () => {
    const scan = { type: 'simplebeacon-complete-scan', results: { simplebeacon: { summary: { gatePass: true } } } };
    const result = buildPublicSummary(scan);
    expect(result).toBeDefined();
    expect(result.type).toBe('simplebeacon-public-summary');
  });

  test('validateScanForTier returns ok for valid tier/kind', () => {
    const result = validateScanForTier('operator', 'gate');
    expect(result.ok).toBe(true);
  });

  test('validateScanForTier returns error for unknown tier', () => {
    const result = validateScanForTier('nonexistent', 'gate');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown');
  });

  test('validateScanForTier returns error when complete scan required', () => {
    const result = validateScanForTier('handoff', 'gate');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Complete');
  });

  test('validateScanForTier returns ok when complete scan provided for handoff', () => {
    const result = validateScanForTier('handoff', 'complete');
    expect(result.ok).toBe(true);
  });
});
