'use strict';

const {
  normalizePathKey,
  parseLocation,
  isHandoffArtifactPath,
  isIntentionalFixturePath,
  isDocumentationPath,
  inferArtifactContext,
  resolveFindingFilePath,
  isFindingInProjectScope,
  shouldScopeFindingsToProject,
  filterFindingsByProjectScope,
} = require('../audit-remediation-recipes/paths.cjs');

describe('audit-remediation-recipes/paths', () => {
  test('exports expected functions', () => {
    expect(typeof normalizePathKey).toBe('function');
    expect(typeof parseLocation).toBe('function');
    expect(typeof isHandoffArtifactPath).toBe('function');
    expect(typeof isIntentionalFixturePath).toBe('function');
    expect(typeof isDocumentationPath).toBe('function');
    expect(typeof inferArtifactContext).toBe('function');
    expect(typeof resolveFindingFilePath).toBe('function');
    expect(typeof isFindingInProjectScope).toBe('function');
    expect(typeof shouldScopeFindingsToProject).toBe('function');
    expect(typeof filterFindingsByProjectScope).toBe('function');
  });

  test('normalizePathKey normalizes backslashes and lowercases', () => {
    expect(normalizePathKey('C:\\Users\\Test')).toBe('c:/users/test');
    expect(normalizePathKey('')).toBe('');
  });

  test('parseLocation parses file:line:column', () => {
    expect(parseLocation('src/index.js:42:10')).toEqual({
      file: 'src/index.js',
      line: 42,
      column: 10,
    });
  });

  test('parseLocation parses file:line', () => {
    expect(parseLocation('src/index.js:42')).toEqual({
      file: 'src/index.js',
      line: 42,
      column: null,
    });
  });

  test('parseLocation handles bare path', () => {
    expect(parseLocation('src/index.js')).toEqual({
      file: 'src/index.js',
      line: null,
      column: null,
    });
  });

  test('parseLocation handles empty input', () => {
    expect(parseLocation('')).toEqual({ file: null, line: null, column: null });
    expect(parseLocation(null)).toEqual({ file: null, line: null, column: null });
  });

  test('isHandoffArtifactPath detects deliverables', () => {
    expect(isHandoffArtifactPath('deliverables/report.html')).toBe(true);
    expect(isHandoffArtifactPath('.simplebeacon/report.html')).toBe(true);
    expect(isHandoffArtifactPath('src/index.js')).toBe(false);
  });

  test('isIntentionalFixturePath detects test fixtures', () => {
    expect(isIntentionalFixturePath('tests/fixtures/data.json')).toBe(true);
    expect(isIntentionalFixturePath('web/data/sample-sample.json')).toBe(true);
    expect(isIntentionalFixturePath('src/index.js')).toBe(false);
  });

  test('isDocumentationPath detects docs', () => {
    expect(isDocumentationPath('docs/readme.md')).toBe(true);
    expect(isDocumentationPath('src/index.js')).toBe(false);
  });

  test('inferArtifactContext returns null for regular source', () => {
    expect(inferArtifactContext({ location: 'src/index.js:10' })).toBeNull();
  });

  test('inferArtifactContext identifies handoff deliverable', () => {
    const ctx = inferArtifactContext({ location: 'deliverables/report.html' });
    expect(ctx.artifactType).toBe('handoff-deliverable');
    expect(ctx.blocksGate).toBe(false);
  });

  test('inferArtifactContext identifies intentional fixture', () => {
    const ctx = inferArtifactContext({ location: 'tests/fixtures/data.json' });
    expect(ctx.artifactType).toBe('intentional-fixture');
    expect(ctx.blocksGate).toBe(false);
  });

  test('inferArtifactContext identifies documentation', () => {
    const ctx = inferArtifactContext({ location: 'docs/readme.md' });
    expect(ctx.artifactType).toBe('documentation');
  });

  test('resolveFindingFilePath resolves from filePath', () => {
    const result = resolveFindingFilePath(
      { filePath: 'src/index.js' },
      { projectPath: '/project' }
    );
    expect(result).toContain('index.js');
  });

  test('resolveFindingFilePath handles absolute paths', () => {
    const result = resolveFindingFilePath({ filePath: 'C:/Users/test/src.js' });
    expect(result).toContain('src.js');
  });

  test('resolveFindingFilePath returns empty for no path info', () => {
    expect(resolveFindingFilePath({})).toBe('');
  });

  test('isFindingInProjectScope returns true when no projectPath', () => {
    expect(isFindingInProjectScope({ filePath: 'src/index.js' }, {})).toBe(true);
  });

  test('shouldScopeFindingsToProject returns true for github-cache', () => {
    expect(shouldScopeFindingsToProject({ projectPath: '/project/github-cache/repo' })).toBe(true);
    expect(shouldScopeFindingsToProject({ projectPath: '/project/src' })).toBe(false);
  });

  test('filterFindingsByProjectScope returns all when not scoped', () => {
    const findings = [{ filePath: 'a.js' }, { filePath: 'b.js' }];
    expect(filterFindingsByProjectScope(findings, { projectPath: '/project/src' })).toHaveLength(2);
  });

  test('filterFindingsByProjectScope keeps only in-scope findings for github-cache', () => {
    const projectPath = 'C:/repo/github-cache/my-project';
    const findings = [
      { filePath: 'C:/repo/github-cache/my-project/src/a.js' },
      { filePath: 'C:/repo/other-project/src/b.js' },
    ];
    const scoped = filterFindingsByProjectScope(findings, { projectPath });
    expect(scoped).toHaveLength(1);
    expect(scoped[0].filePath).toContain('my-project');
  });

  test('inferArtifactContext identifies scanner rule sources', () => {
    const ctx = inferArtifactContext({
      location: 'packages/simplebeacon-cli/src/rules/security-pattern-scanner.js:10',
    });
    expect(ctx.artifactType).toBe('scanner-rule');
    expect(ctx.blocksGate).toBe(false);
  });

  test('isFindingInProjectScope rejects out-of-scope paths when projectPath set', () => {
    const inScope = isFindingInProjectScope(
      { filePath: 'C:/repo/github-cache/pkg/src/index.js' },
      { projectPath: 'C:/repo/github-cache/pkg' }
    );
    const outOfScope = isFindingInProjectScope(
      { filePath: 'C:/repo/other/src/index.js' },
      { projectPath: 'C:/repo/github-cache/pkg' }
    );
    expect(inScope).toBe(true);
    expect(outOfScope).toBe(false);
  });
});
