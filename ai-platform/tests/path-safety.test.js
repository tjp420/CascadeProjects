/**
 * Tests for path-safety.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseAllowedRoots,
  resolveDefaultAllowedRoots,
  detectMonorepoRoot,
  loadConfigAnalyzeRoots,
  formatAllowedRootsSummary,
  isPathWithinRoots,
  assertSafeProjectPath,
  validateRepoUrl,
  assertSafeExecutablePath,
  DEFAULT_ALLOWED_HOSTS
} = require('../server/lib/path-safety.cjs');

describe('path-safety', () => {
  let tmpDir;
  let originalAnalyzeAllowedRoots;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-test-'));
    originalAnalyzeAllowedRoots = process.env.ANALYZE_ALLOWED_ROOTS;
  });

  afterEach(() => {
    if (originalAnalyzeAllowedRoots !== undefined) {
      process.env.ANALYZE_ALLOWED_ROOTS = originalAnalyzeAllowedRoots;
    } else {
      delete process.env.ANALYZE_ALLOWED_ROOTS;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('parseAllowedRoots', () => {
    test('returns empty array for empty string', () => {
      expect(parseAllowedRoots('')).toEqual([]);
      expect(parseAllowedRoots(null)).toEqual([]);
      expect(parseAllowedRoots(undefined)).toEqual([]);
    });

    test('splits semicolon-separated paths', () => {
      const roots = parseAllowedRoots('/foo;/bar');
      expect(roots).toContain(path.resolve('/foo'));
      expect(roots).toContain(path.resolve('/bar'));
    });

    test('splits comma-separated paths', () => {
      const roots = parseAllowedRoots('/a,/b');
      expect(roots).toContain(path.resolve('/a'));
      expect(roots).toContain(path.resolve('/b'));
    });

    test('trims whitespace', () => {
      const roots = parseAllowedRoots('  /a  ;  /b  ');
      expect(roots).toContain(path.resolve('/a'));
      expect(roots).toContain(path.resolve('/b'));
    });

    test('deduplicates', () => {
      const roots = parseAllowedRoots('/a;/a');
      expect(roots.length).toBe(1);
    });

    test('merges fallback roots', () => {
      const roots = parseAllowedRoots('/a', [path.resolve('/b')]);
      expect(roots).toContain(path.resolve('/a'));
      expect(roots).toContain(path.resolve('/b'));
    });
  });

  describe('detectMonorepoRoot', () => {
    test('returns null when dir name not in PLATFORM_DIR_NAMES', () => {
      expect(detectMonorepoRoot(tmpDir)).toBeNull();
    });

    test('returns null when already at root', () => {
      if (process.platform === 'win32') {
        expect(detectMonorepoRoot('C:\\')).toBeNull();
      } else {
        expect(detectMonorepoRoot('/')).toBeNull();
      }
    });

    test('returns parent when dir named ai-platform', () => {
      const parentDir = path.join(tmpDir, 'parent-check');
      const platformDir = path.join(parentDir, 'ai-platform');
      fs.mkdirSync(platformDir, { recursive: true });
      expect(detectMonorepoRoot(platformDir)).toBe(path.resolve(parentDir));
    });
  });

  describe('loadConfigAnalyzeRoots', () => {
    test('returns empty array when .simplebeacon/config.json missing', () => {
      expect(loadConfigAnalyzeRoots(tmpDir)).toEqual([]);
    });

    test('returns roots from config file', () => {
      fs.mkdirSync(path.join(tmpDir, '.simplebeacon'));
      fs.writeFileSync(
        path.join(tmpDir, '.simplebeacon', 'config.json'),
        JSON.stringify({ allowedAnalysisRoots: ['/foo', '/bar'] }),
        'utf8'
      );
      const roots = loadConfigAnalyzeRoots(tmpDir);
      expect(roots).toContain(path.resolve('/foo'));
      expect(roots).toContain(path.resolve('/bar'));
    });

    test('falls back to analyzeRoots field', () => {
      fs.mkdirSync(path.join(tmpDir, '.simplebeacon'));
      fs.writeFileSync(
        path.join(tmpDir, '.simplebeacon', 'config.json'),
        JSON.stringify({ analyzeRoots: ['/legacy'] }),
        'utf8'
      );
      const roots = loadConfigAnalyzeRoots(tmpDir);
      expect(roots).toContain(path.resolve('/legacy'));
    });

    test('resolves relative paths against platformRoot', () => {
      fs.mkdirSync(path.join(tmpDir, '.simplebeacon'));
      fs.writeFileSync(
        path.join(tmpDir, '.simplebeacon', 'config.json'),
        JSON.stringify({ allowedAnalysisRoots: ['./relative'] }),
        'utf8'
      );
      const roots = loadConfigAnalyzeRoots(tmpDir);
      expect(roots).toContain(path.resolve(tmpDir, 'relative'));
    });

    test('returns empty array for invalid JSON', () => {
      fs.mkdirSync(path.join(tmpDir, '.simplebeacon'));
      fs.writeFileSync(
        path.join(tmpDir, '.simplebeacon', 'config.json'),
        'not json',
        'utf8'
      );
      expect(loadConfigAnalyzeRoots(tmpDir)).toEqual([]);
    });
  });

  describe('formatAllowedRootsSummary', () => {
    test('formats roots with limit', () => {
      const roots = [path.resolve('/a'), path.resolve('/b'), path.resolve('/c')];
      const summary = formatAllowedRootsSummary(roots, 2);
      expect(summary).toContain(path.resolve('/a'));
      expect(summary).toContain(path.resolve('/b'));
      expect(summary).not.toContain(path.resolve('/c'));
    });

    test('deduplicates before formatting', () => {
      const roots = [path.resolve('/a'), path.resolve('/a')];
      const summary = formatAllowedRootsSummary(roots);
      const parts = summary.split('; ');
      expect(parts.length).toBe(1);
    });

    test('returns empty string for no roots', () => {
      expect(formatAllowedRootsSummary([])).toBe('');
    });
  });

  describe('isPathWithinRoots', () => {
    test('returns true for exact match', () => {
      const roots = [path.resolve('/foo')];
      expect(isPathWithinRoots('/foo', roots)).toBe(true);
    });

    test('returns true for nested path', () => {
      const roots = [path.resolve('/foo')];
      expect(isPathWithinRoots('/foo/bar', roots)).toBe(true);
    });

    test('returns false for outside path', () => {
      const roots = [path.resolve('/foo')];
      expect(isPathWithinRoots('/bar', roots)).toBe(false);
    });

    test('returns false for partial prefix match', () => {
      const roots = [path.resolve('/foo')];
      expect(isPathWithinRoots('/foobar', roots)).toBe(false);
    });

    test('handles multiple roots', () => {
      const roots = [path.resolve('/foo'), path.resolve('/bar')];
      expect(isPathWithinRoots('/foo/a', roots)).toBe(true);
      expect(isPathWithinRoots('/bar/b', roots)).toBe(true);
      expect(isPathWithinRoots('/baz', roots)).toBe(false);
    });

    test('is case-insensitive on Windows', () => {
      if (process.platform === 'win32') {
        const roots = [path.resolve('C:/FOO')];
        expect(isPathWithinRoots('C:/foo/bar', roots)).toBe(true);
      }
    });
  });

  describe('assertSafeProjectPath', () => {
    test('returns resolved path when valid', () => {
      const allowed = [tmpDir];
      const result = assertSafeProjectPath(tmpDir, allowed);
      expect(result).toBe(path.resolve(tmpDir));
    });

    test('throws when path is empty', () => {
      expect(() => assertSafeProjectPath('', [tmpDir])).toThrow(/is required/);
      expect(() => assertSafeProjectPath(null, [tmpDir])).toThrow(/is required/);
    });

    test('throws when path contains null bytes', () => {
      expect(() => assertSafeProjectPath('/tmp/\0evil', [tmpDir])).toThrow(/invalid characters/);
    });

    test('throws when path is outside allowed roots', () => {
      expect(() => assertSafeProjectPath('/etc', [tmpDir])).toThrow(/outside allowed analysis roots/);
    });

    test('throws when path does not exist', () => {
      expect(() => assertSafeProjectPath(path.join(tmpDir, 'does-not-exist'), [tmpDir])).toThrow(/does not exist/);
    });

    test('uses custom label in error', () => {
      expect(() => assertSafeProjectPath('', [tmpDir], 'scanPath')).toThrow(/scanPath is required/);
    });
  });

  describe('validateRepoUrl', () => {
    test('accepts valid GitHub HTTPS URL', () => {
      expect(validateRepoUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo');
    });

    test('accepts valid GitLab HTTPS URL', () => {
      expect(validateRepoUrl('https://gitlab.com/user/repo.git')).toBe('https://gitlab.com/user/repo.git');
    });

    test('accepts valid Bitbucket HTTPS URL', () => {
      expect(validateRepoUrl('https://bitbucket.org/user/repo/')).toBe('https://bitbucket.org/user/repo');
    });

    test('throws for empty string', () => {
      expect(() => validateRepoUrl('')).toThrow(/repoUrl is required/);
      expect(() => validateRepoUrl(null)).toThrow(/repoUrl is required/);
    });

    test('throws for non-HTTPS', () => {
      expect(() => validateRepoUrl('http://github.com/user/repo')).toThrow(/must use HTTPS/);
      expect(() => validateRepoUrl('ftp://github.com/user/repo')).toThrow(/must use HTTPS/);
    });

    test('throws for disallowed host', () => {
      expect(() => validateRepoUrl('https://example.com/repo')).toThrow(/not in the allowed provider list/);
    });

    test('throws for invalid characters', () => {
      expect(() => validateRepoUrl('https://github.com/user/repo;rm -rf')).toThrow(/invalid characters/);
      expect(() => validateRepoUrl("https://github.com/user/repo'")).toThrow(/invalid characters/);
    });

    test('throws for invalid path', () => {
      expect(() => validateRepoUrl('https://github.com/')).toThrow(/not a valid repository path/);
      expect(() => validateRepoUrl('https://github.com')).toThrow(/not a valid repository path/);
    });

    test('allows custom allowedSchemes', () => {
      expect(() => validateRepoUrl('http://github.com/user/repo', { allowedSchemes: ['http:', 'https:'] })).not.toThrow();
    });

    test('allows custom allowedHosts', () => {
      expect(() => validateRepoUrl('https://gitea.example.com/user/repo', { allowedHosts: ['gitea.example.com'] })).not.toThrow();
    });
  });

  describe('assertSafeExecutablePath', () => {
    test('returns path for valid absolute path', () => {
      expect(assertSafeExecutablePath('/usr/bin/node')).toBe('/usr/bin/node');
    });

    test('throws for empty path', () => {
      expect(() => assertSafeExecutablePath('')).toThrow(/path is required/);
      expect(() => assertSafeExecutablePath(null)).toThrow(/path is required/);
    });

    test('throws for relative path', () => {
      expect(() => assertSafeExecutablePath('./node')).toThrow(/must be an absolute path/);
    });

    test('throws for path with invalid characters', () => {
      expect(() => assertSafeExecutablePath('/usr/bin/node;rm -rf')).toThrow(/invalid characters/);
      expect(() => assertSafeExecutablePath('/usr/bin/node|cat')).toThrow(/invalid characters/);
    });

    test('uses custom label', () => {
      expect(() => assertSafeExecutablePath('', 'binary')).toThrow(/binary path is required/);
    });
  });

  describe('DEFAULT_ALLOWED_HOSTS', () => {
    test('includes major Git providers', () => {
      expect(DEFAULT_ALLOWED_HOSTS).toContain('github.com');
      expect(DEFAULT_ALLOWED_HOSTS).toContain('gitlab.com');
      expect(DEFAULT_ALLOWED_HOSTS).toContain('bitbucket.org');
    });
  });

  describe('resolveDefaultAllowedRoots', () => {
    test('always includes platform root', () => {
      const roots = resolveDefaultAllowedRoots(tmpDir);
      expect(roots).toContain(path.resolve(tmpDir));
    });

    test('includes env ANALYZE_ALLOWED_ROOTS', () => {
      const extra = path.join(tmpDir, 'extra');
      fs.mkdirSync(extra, { recursive: true });
      process.env.ANALYZE_ALLOWED_ROOTS = extra;
      const roots = resolveDefaultAllowedRoots(tmpDir);
      expect(roots).toContain(path.resolve(extra));
      expect(roots).toContain(path.resolve(tmpDir));
    });

    test('deduplicates results', () => {
      process.env.ANALYZE_ALLOWED_ROOTS = tmpDir;
      const roots = resolveDefaultAllowedRoots(tmpDir);
      const tmpCount = roots.filter((r) => r === path.resolve(tmpDir)).length;
      expect(tmpCount).toBe(1);
    });
  });
});
