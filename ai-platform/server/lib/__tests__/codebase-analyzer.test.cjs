// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  dedupeFindings,
  scanContentPatterns,
  getCodeExtensions,
  REPO_SKIP_DIRS
} = require('../codebase-analyzer.cjs');

const {
  TECH_DEBT_PATTERNS,
  PLACEHOLDER_PATTERNS,
  INSECURE_RANDOM_PATTERNS,
  SECURITY_HEADERS_PATTERNS,
  SECURITY_PATTERNS
} = require('../codebase-analyzer-patterns.cjs');

describe('codebase-analyzer utilities', () => {
  describe('dedupeFindings', () => {
    it('removes duplicates by composite key', () => {
      const findings = [
        { filePath: 'a.js', line: 1, type: 'todo', category: 'tech-debt', match: 'TODO fix' },
        { filePath: 'a.js', line: 1, type: 'todo', category: 'tech-debt', match: 'TODO fix' },
        { filePath: 'b.js', line: 2, type: 'fixme', category: 'tech-debt', match: 'FIXME' }
      ];
      const result = dedupeFindings(findings);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].filePath, 'a.js');
      assert.strictEqual(result[1].filePath, 'b.js');
    });

    it('preserves first occurrence order', () => {
      const findings = [
        { filePath: 'a.js', line: 1, type: 'x', category: 'c', match: 'm' },
        { filePath: 'b.js', line: 2, type: 'y', category: 'c', match: 'n' },
        { filePath: 'a.js', line: 1, type: 'x', category: 'c', match: 'm' }
      ];
      const result = dedupeFindings(findings);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].filePath, 'a.js');
      assert.strictEqual(result[1].filePath, 'b.js');
    });

    it('handles empty array', () => {
      assert.deepStrictEqual(dedupeFindings([]), []);
    });

    it('handles undefined with default parameter', () => {
      assert.deepStrictEqual(dedupeFindings(undefined), []);
    });
  });

  describe('scanContentPatterns', () => {
    it('detects TODO markers in JS content', () => {
      const content = 'function foo() {\n  // TODO: fix this\n}';
      const findings = scanContentPatterns(content, 'src/foo.js', [...TECH_DEBT_PATTERNS], 'tech-debt', 'medium');
      assert.ok(findings.length > 0, 'should find at least one TODO');
      assert.ok(findings.some((f) => f.type === 'todo'));
    });

    it('detects placeholder patterns', () => {
      const content = 'const desc = "lorem ipsum placeholder text";';
      const findings = scanContentPatterns(content, 'src/app.js', [...PLACEHOLDER_PATTERNS], 'meaningless-data', 'low');
      assert.ok(findings.some((f) => f.type === 'lorem'));
    });

    it('detects insecure random usage', () => {
      const content = 'const token = Math.random();';
      const findings = scanContentPatterns(content, 'src/auth.js', [...INSECURE_RANDOM_PATTERNS], 'insecure-random', 'medium');
      assert.ok(findings.some((f) => f.type === 'insecure-random'));
    });

    it('detects CORS wildcard in headers', () => {
      const content = 'Access-Control-Allow-Origin: *';
      const findings = scanContentPatterns(content, 'src/server.js', [...SECURITY_HEADERS_PATTERNS], 'security-headers', 'low');
      assert.ok(findings.some((f) => f.type === 'cors-wildcard'));
    });

    it('returns empty for non-matching content', () => {
      const content = 'const x = 42;';
      const findings = scanContentPatterns(content, 'src/app.js', [...TECH_DEBT_PATTERNS], 'tech-debt', 'medium');
      assert.strictEqual(findings.length, 0);
    });

    it('skips minified vendor files for eval-danger', () => {
      const content = 'eval(userInput);';
      const findings = scanContentPatterns(content, 'lib/d3.v7.min.js', [...SECURITY_PATTERNS.filter((p) => p.id === 'eval-danger')], 'eval-danger', 'medium');
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('REPO_SKIP_DIRS', () => {
    it('contains expected skip directories', () => {
      assert.ok(REPO_SKIP_DIRS.has('node_modules'));
      assert.ok(REPO_SKIP_DIRS.has('.git'));
      assert.ok(REPO_SKIP_DIRS.has('coverage'));
      assert.ok(REPO_SKIP_DIRS.has('dist'));
      assert.ok(REPO_SKIP_DIRS.has('build'));
    });

    it('is a Set', () => {
      assert.ok(REPO_SKIP_DIRS instanceof Set);
    });
  });

  describe('getCodeExtensions', () => {
    it('returns a Set of extensions', () => {
      const exts = getCodeExtensions('default');
      assert.ok(exts instanceof Set);
      assert.ok(exts.has('.js'));
      assert.ok(exts.has('.ts'));
      assert.ok(exts.has('.json'));
    });
  });
});
