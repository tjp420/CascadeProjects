'use strict';

const {
  resolveEnginesRun,
  resolveSelectedEnginesForExport,
  filterCompleteScanForEngines,
  artifactAllowedForEngines,
  shouldIncludeEuAiActArtifacts
} = require('../analyze-export-bundle/engines.cjs');

describe('analyze-export-bundle/engines', () => {
  test('exports expected functions', () => {
    expect(typeof resolveEnginesRun).toBe('function');
    expect(typeof resolveSelectedEnginesForExport).toBe('function');
    expect(typeof filterCompleteScanForEngines).toBe('function');
    expect(typeof artifactAllowedForEngines).toBe('function');
    expect(typeof shouldIncludeEuAiActArtifacts).toBe('function');
  });

  test('resolveEnginesRun returns from options first', () => {
    expect(resolveEnginesRun({}, { enginesRun: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  test('resolveEnginesRun returns from payload', () => {
    expect(resolveEnginesRun({ enginesRun: ['x'] })).toEqual(['x']);
  });

  test('resolveEnginesRun returns from analysisConfig', () => {
    expect(resolveEnginesRun({ analysisConfig: { enginesRun: ['y'] } })).toEqual(['y']);
  });

  test('resolveEnginesRun returns from steps', () => {
    expect(resolveEnginesRun({ steps: [{ id: 's1' }, { id: 's2' }] })).toEqual(['s1', 's2']);
  });

  test('resolveEnginesRun returns empty array for no data', () => {
    expect(resolveEnginesRun({})).toEqual([]);
  });

  test('resolveSelectedEnginesForExport returns from options', () => {
    expect(resolveSelectedEnginesForExport({}, { selectedEngines: ['a', 'a', 'b'] })).toEqual(['a', 'b']);
  });

  test('resolveSelectedEnginesForExport returns null when none found', () => {
    expect(resolveSelectedEnginesForExport({})).toBeNull();
  });

  test('filterCompleteScanForEngines returns input when no engineIds', () => {
    const scan = { type: 'test' };
    expect(filterCompleteScanForEngines(scan, [])).toBe(scan);
  });

  test('filterCompleteScanForEngines returns input when null', () => {
    expect(filterCompleteScanForEngines(null, ['a'])).toBeNull();
  });

  test('artifactAllowedForEngines returns true for complete-scan-bundle on complete', () => {
    expect(artifactAllowedForEngines('complete-scan-bundle', new Set(), { scanKind: 'complete' })).toBe(true);
    expect(artifactAllowedForEngines('complete-scan-bundle', new Set(), { scanKind: 'gate' })).toBe(false);
  });

  test('artifactAllowedForEngines returns true for unknown artifact', () => {
    expect(artifactAllowedForEngines('unknown-artifact', new Set())).toBe(true);
  });

  test('shouldIncludeEuAiActArtifacts respects explicit false', () => {
    expect(shouldIncludeEuAiActArtifacts({}, { includeEuAiAct: false })).toBe(false);
  });

  test('shouldIncludeEuAiActArtifacts respects explicit true', () => {
    expect(shouldIncludeEuAiActArtifacts({}, { includeEuAiAct: true })).toBe(true);
  });

  test('resolveSelectedEnginesForExport reads payload enginesRun', () => {
    expect(resolveSelectedEnginesForExport({ enginesRun: ['simplebeacon', 'roadmap'] }))
      .toEqual(['simplebeacon', 'roadmap']);
  });

  test('filterCompleteScanForEngines filters enginesRun and steps', () => {
    const scan = {
      enginesRun: ['simplebeacon', 'roadmap', 'npm-audit'],
      steps: [{ id: 'simplebeacon' }, { id: 'roadmap' }, { id: 'npm-audit' }],
      results: { simplebeacon: { gate: { pass: true } } }
    };
    const filtered = filterCompleteScanForEngines(scan, ['simplebeacon', 'roadmap']);
    expect(filtered.enginesRun).toEqual(['simplebeacon', 'roadmap']);
    expect(filtered.steps.map((s) => s.id)).toEqual(['simplebeacon', 'roadmap']);
    expect(filtered.analysisConfig.selectedEngines).toEqual(['simplebeacon', 'roadmap']);
  });

  test('artifactAllowedForEngines gates EU AI Act artifacts', () => {
    const engines = new Set(['simplebeacon']);
    expect(artifactAllowedForEngines('eu-ai-act-sprint', engines, { includeEuAiAct: false })).toBe(false);
    expect(artifactAllowedForEngines('eu-ai-act-sprint', engines, { includeEuAiAct: true })).toBe(false);
    expect(artifactAllowedForEngines('eu-ai-act-sprint', new Set(['eu-ai-act']), { includeEuAiAct: true })).toBe(true);
  });

  test('artifactAllowedForEngines requires mapped engine for known artifacts', () => {
    expect(artifactAllowedForEngines('roadmap', new Set(['simplebeacon']))).toBe(false);
    expect(artifactAllowedForEngines('roadmap', new Set(['roadmap']))).toBe(true);
  });

  test('shouldIncludeEuAiActArtifacts detects sprint results and eu-ai-act kind', () => {
    expect(shouldIncludeEuAiActArtifacts({ type: 'simplebeacon-eu-ai-act-sprint' })).toBe(true);
    expect(shouldIncludeEuAiActArtifacts({ results: { sprint: { ok: true } } })).toBe(true);
    expect(shouldIncludeEuAiActArtifacts({ enginesRun: ['eu-ai-act'] })).toBe(true);
  });
});
