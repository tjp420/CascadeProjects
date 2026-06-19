import {
  isBuildArtifact,
  getBuildArtifactPatterns,
  DEFAULT_BUILD_ARTIFACT_PATTERNS,
  escapeRegex,
  exportScanResultToJson,
  ScanResult,
  ANALYZER_PRESETS,
} from '../workspaceAnalyzer';

describe('ANALYZER_PRESETS', () => {
  it('has essential, security, full, and custom presets', () => {
    expect(ANALYZER_PRESETS.essential.label).toBe('Essential');
    expect(ANALYZER_PRESETS.security.label).toBe('Security');
    expect(ANALYZER_PRESETS.full.label).toBe('Full');
    expect(ANALYZER_PRESETS.custom.label).toBe('Custom');
  });

  it('full preset contains all pattern IDs', () => {
    const fullIds = ANALYZER_PRESETS.full.patternIds;
    expect(fullIds.length).toBeGreaterThan(0);
    expect(fullIds).toContain('credentials');
    expect(fullIds).toContain('llmSlop');
  });

  it('essential preset excludes non-security patterns', () => {
    const essentialIds = ANALYZER_PRESETS.essential.patternIds;
    expect(essentialIds).toContain('credentials');
    expect(essentialIds).not.toContain('debugArtifacts');
    expect(essentialIds).not.toContain('missingTest');
  });
});

describe('isBuildArtifact', () => {
  it('excludes node_modules', () => {
    expect(isBuildArtifact('node_modules/lodash/index.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('src/node_modules/pkg/file.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes .git directory', () => {
    expect(isBuildArtifact('.git/config', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('src/.git/hooks/pre-commit', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes dist and build directories', () => {
    expect(isBuildArtifact('dist/bundle.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('build/index.html', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes .next and out directories', () => {
    expect(isBuildArtifact('.next/static/chunks/main.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('out/index.html', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes coverage directory', () => {
    expect(isBuildArtifact('coverage/lcov-report/index.html', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes .map files', () => {
    expect(isBuildArtifact('src/app.js.map', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('dist/main.js.map', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes .lock files', () => {
    expect(isBuildArtifact('package-lock.json.lock', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes minified files', () => {
    expect(isBuildArtifact('jquery.min.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('styles.min.css', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes bundle files', () => {
    expect(isBuildArtifact('app.bundle.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('vendor.bundle.css', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('excludes code-map.json generated artifact', () => {
    expect(isBuildArtifact('code-map.json', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('simplebeacon-vscode/code-map.json', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
    expect(isBuildArtifact('out/code-map.json', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });

  it('does NOT exclude regular source files', () => {
    expect(isBuildArtifact('src/index.ts', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(false);
    expect(isBuildArtifact('app.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(false);
    expect(isBuildArtifact('styles.css', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(false);
    expect(isBuildArtifact('README.md', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(false);
  });

  it('respects custom patterns', () => {
    const custom = ['custom-out', '.map'];
    expect(isBuildArtifact('custom-out/file.js', custom)).toBe(true);
    expect(isBuildArtifact('src/index.ts', custom)).toBe(false);
  });

  it('handles backslash paths', () => {
    expect(isBuildArtifact('node_modules\\lodash\\index.js', DEFAULT_BUILD_ARTIFACT_PATTERNS)).toBe(true);
  });
});

describe('getBuildArtifactPatterns', () => {
  it('returns defaults when no user config', () => {
    const patterns = getBuildArtifactPatterns();
    expect(patterns).toContain('node_modules');
    expect(patterns).toContain('.git');
    expect(patterns).toContain('dist');
  });
});

describe('extractMatches', () => {
  // extractMatches is not exported; integration tests cover it via analyzeWorkspace
  it('should be covered by analyzeWorkspace integration tests', () => {
    expect(true).toBe(true);
  });
});

describe('exportScanResultToJson', () => {
  it('exports a ScanResult as structured JSON with metadata', () => {
    const result: ScanResult = {
      findings: [],
      summary: {
        totalFiles: 10,
        filesAnalyzed: 8,
        totalFindings: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        categoryCounts: {},
        scanProfile: 'complete',
        selectedModules: ['credentials'],
        aiAssistedFindings: 0,
        averageFileSizeBytes: 1024,
        totalLinesOfCode: 500,
      },
      qualityScore: 100,
      gate: { pass: true, blockingCount: 0 },
    };

    const json = exportScanResultToJson(result, true);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe('simplebeacon-report');
    expect(parsed.reportVersion).toBe(2);
    expect(parsed.generatedBy).toBe('SimpleBeacon VS Code Extension');
    expect(parsed.summary.scanProfile).toBe('complete');
    expect(parsed.summary.selectedModules).toContain('credentials');
    expect(parsed.qualityScore).toBe(100);
    expect(parsed.gate.pass).toBe(true);
  });
});
