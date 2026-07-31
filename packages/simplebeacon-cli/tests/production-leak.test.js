/**
 * Production-leak scanner — regression tests for false-positive suppression.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const { scanFileContent } = require('../src/rules/production-leak.js');

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

function expectNoFindings(relativePath, content, opts = {}) {
  const result = scanFileContent(relativePath, content, opts);
  assert.strictEqual(
    result.findings.length,
    0,
    `Expected 0 findings for ${relativePath}, got ${result.findings.length}: ` +
      result.findings.map((f) => `${f.pattern} at L${f.line}`).join(', ')
  );
  return result;
}

function expectFindings(relativePath, content, opts = {}) {
  const result = scanFileContent(relativePath, content, opts);
  assert.ok(result.findings.length > 0, `Expected at least 1 finding for ${relativePath}, got 0`);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Scanner infrastructure — should be suppressed                     */
/* ------------------------------------------------------------------ */

describe('Scanner infrastructure exclusions', () => {
  it('suppresses mock-data-helpers.cjs template-literal filename generator', () => {
    const content = `
  return {
    name: pattern,
    recordCount,
    fields,
    dataTypes: ['JSON', 'CSV'],
    realismScore: constants.MOCK_REALISM_SCORE,
    filePath: \`mock_data_\${pattern.replace(/\\W+/g, '_')}.json\`
  };
`;
    expectNoFindings('ai-platform/server/lib/mock-data-helpers.cjs', content);
  });

  it('suppresses simplebeacon-proxy.cjs scanner re-exports', () => {
    const content = `
const { DEFAULT_MOCK_SCAN_RELATIVE_PATHS, resolveMockDataScanPaths } = require('../../../packages/simplebeacon-cli/src/index.js');
`;
    expectNoFindings('ai-platform/server/lib/simplebeacon-proxy.cjs', content);
  });
});

/* ------------------------------------------------------------------ */
/*  Joi schema names — should be suppressed                           */
/* ------------------------------------------------------------------ */

describe('Joi schema name exclusions', () => {
  it('suppresses mockDataAnalysis as a Joi schema property', () => {
    const content = `
  mockDataAnalysis: Joi.object({
    targetDirectory: Joi.string().optional(),
    mode: Joi.string().valid('analysis', 'conversion').default('analysis'),
    options: Joi.object({
      includePatterns: Joi.array().items(Joi.string()).default(['mock', 'sample', 'demo', 'test']),
    }).optional()
  }),
`;
    expectNoFindings('server/middleware/security.cjs', content);
  });

  it('suppresses sampleData as a Joi schema property', () => {
    const content = `sampleData: Joi.object({ count: Joi.number() })`;
    expectNoFindings('server/routes/api.cjs', content);
  });
});

/* ------------------------------------------------------------------ */
/*  Real leaks — should still be flagged                              */
/* ------------------------------------------------------------------ */

describe('Real production leaks still flagged', () => {
  it('flags require of a mock JSON file in a production route', () => {
    const content = `const data = require('../mock/users-sample.json');`;
    const result = expectFindings('server/routes/users.cjs', content);
    assert.ok(result.findings.some((f) => f.pattern === 'sample-json'));
  });

  it('flags runtime load of a fixture path', () => {
    const content = `const fixture = fs.readFileSync('data/fixtures/user-data.json');`;
    const result = expectFindings('server/lib/processor.cjs', content);
    assert.ok(result.findings.some((f) => f.pattern === 'fixtures-path'));
  });
});

/* ------------------------------------------------------------------ */
/*  simplebeacon:production-leak-intent annotation                     */
/* ------------------------------------------------------------------ */

describe('Production-leak-intent annotation', () => {
  it('suppresses all findings when annotation is present', () => {
    const content = `// simplebeacon:production-leak-intent
const data = require('../data/users-mock.json');`;
    expectNoFindings('server/lib/loader.cjs', content);
  });
});

/* ------------------------------------------------------------------ */
/*  globMatch                                                         */
/* ------------------------------------------------------------------ */

const {
  globMatch,
  normalizeRel,
  getActiveLeakPatterns,
} = require('../src/rules/production-leak.js');

describe('globMatch', () => {
  it('matches exact paths', () => {
    assert.strictEqual(globMatch('foo.js', 'foo.js'), true);
    assert.strictEqual(globMatch('bar.js', 'foo.js'), false);
  });

  it('matches suffix wildcard', () => {
    assert.strictEqual(globMatch('foo.test.js', '*.test.js'), true);
    assert.strictEqual(globMatch('main.js', '*.test.js'), false);
    assert.strictEqual(globMatch('src/foo.test.js', '**/*.test.js'), true);
    assert.strictEqual(globMatch('src/main.js', '**/*.test.js'), false);
  });

  it('matches **/dir/** pattern', () => {
    assert.strictEqual(globMatch('node_modules/foo/package.json', 'node_modules/**'), true);
    assert.strictEqual(globMatch('a/b/tests/foo.js', '**/tests/**'), true);
    assert.strictEqual(globMatch('src/main.js', '**/tests/**'), false);
  });

  it('returns false for invalid inputs', () => {
    assert.strictEqual(globMatch(null, '*.js'), false);
    assert.strictEqual(globMatch('foo.js', null), false);
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeRel                                                      */
/* ------------------------------------------------------------------ */

describe('normalizeRel', () => {
  it('returns forward-slash relative paths', () => {
    const base = path.join(os.tmpdir(), 'project');
    const file = path.join(base, 'src', 'main.js');
    const result = normalizeRel(base, file);
    assert.strictEqual(result, 'src/main.js');
  });
});

/* ------------------------------------------------------------------ */
/*  getActiveLeakPatterns                                             */
/* ------------------------------------------------------------------ */

describe('getActiveLeakPatterns', () => {
  it('returns base patterns by default', () => {
    const patterns = getActiveLeakPatterns();
    assert.strictEqual(patterns.length, 5);
    assert.ok(patterns.every((p) => p.regex instanceof RegExp));
  });

  it('includes plain-sample-json when requested', () => {
    const patterns = getActiveLeakPatterns({ plainSampleJson: true });
    assert.strictEqual(patterns.length, 6);
    assert.ok(patterns.some((p) => p.id === 'plain-sample-json'));
  });

  it('returns independent regex instances on each call', () => {
    const a = getActiveLeakPatterns();
    const b = getActiveLeakPatterns();
    a[0].regex.lastIndex = 99;
    assert.strictEqual(b[0].regex.lastIndex, 0);
  });
});
