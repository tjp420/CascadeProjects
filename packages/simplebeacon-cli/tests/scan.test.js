const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { formatBytes } = require('../src/lib/format-utils');
const {
    categoryForExt,
    globToRegex,
    cachedGlobToRegex,
    isIgnoredPath,
    resolveEffectiveScanPaths,
    readFileCached,
    readFileCachedAsync,
    clearFileContentCache
} = require('../src/scan.js');

describe('formatBytes', () => {
    it('returns 0 B for null, undefined, negative, or non-finite values', () => {
        assert.strictEqual(formatBytes(null), '0 B');
        assert.strictEqual(formatBytes(undefined), '0 B');
        assert.strictEqual(formatBytes(-1), '0 B');
        assert.strictEqual(formatBytes(NaN), '0 B');
        assert.strictEqual(formatBytes(Infinity), '0 B');
    });

    it('formats bytes correctly', () => {
        assert.strictEqual(formatBytes(0), '0 B');
        assert.strictEqual(formatBytes(512), '512 B');
        assert.strictEqual(formatBytes(1024), '1.0 KB');
        assert.strictEqual(formatBytes(1536), '1.5 KB');
        assert.strictEqual(formatBytes(1024 * 1024), '1.0 MB');
        assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1.0 GB');
    });
});

describe('categoryForExt', () => {
    it('returns known categories', () => {
        assert.strictEqual(categoryForExt('.json'), 'JSON Files');
        assert.strictEqual(categoryForExt('.csv'), 'CSV Files');
        assert.strictEqual(categoryForExt('.yaml'), 'Config Files');
        assert.strictEqual(categoryForExt('.md'), 'Documentation Files');
    });

    it('returns Other Files for unknown extensions', () => {
        assert.strictEqual(categoryForExt('.xyz'), 'Other Files');
        assert.strictEqual(categoryForExt(''), 'Other Files');
    });
});

describe('globToRegex', () => {
    it('matches literal strings', () => {
        const re = globToRegex('foo.js');
        assert(re.test('foo.js'));
        assert(!re.test('bar.js'));
    });

    it('supports * wildcard', () => {
        const re = globToRegex('*.js');
        assert(re.test('foo.js'));
        assert(re.test('bar.js'));
        assert(!re.test('foo.ts'));
    });

    it('supports ? wildcard', () => {
        const re = globToRegex('foo?.js');
        assert(re.test('foo1.js'));
        assert(!re.test('foo12.js'));
    });

    it('supports **/ prefix', () => {
        const re = globToRegex('**/node_modules/**');
        assert(re.test('node_modules/foo'));
        assert(re.test('a/b/node_modules/foo'));
    });

    it('returns non-matching regex for non-string input', () => {
        const re = globToRegex(123);
        assert(!re.test('anything'));
    });
});

describe('cachedGlobToRegex', () => {
    it('returns same regex instance for identical patterns', () => {
        const a = cachedGlobToRegex('*.test.js');
        const b = cachedGlobToRegex('*.test.js');
        assert.strictEqual(a, b);
    });

    it('returns different regexes for different patterns', () => {
        const a = cachedGlobToRegex('*.js');
        const b = cachedGlobToRegex('*.ts');
        assert.notStrictEqual(a, b);
    });
});

describe('isIgnoredPath', () => {
    it('matches exact paths', () => {
        assert.strictEqual(isIgnoredPath('node_modules', ['node_modules']), true);
    });

    it('matches prefix paths', () => {
        assert.strictEqual(isIgnoredPath('node_modules/foo', ['node_modules']), true);
    });

    it('matches glob patterns', () => {
        assert.strictEqual(isIgnoredPath('src/test.js', ['**/*.test.js']), false);
        assert.strictEqual(isIgnoredPath('src/foo.test.js', ['**/*.test.js']), true);
    });

    it('returns false for empty patterns', () => {
        assert.strictEqual(isIgnoredPath('foo.js', []), false);
    });
});

describe('resolveEffectiveScanPaths', () => {
    it('returns scanRoot when config has fullDirectoryScan', () => {
        const result = resolveEffectiveScanPaths('/project', '/project', { fullDirectoryScan: true });
        assert.deepStrictEqual(result, ['/project']);
    });

    it('returns empty array for invalid inputs', () => {
        assert.deepStrictEqual(resolveEffectiveScanPaths(null, '/project', {}), []);
        assert.deepStrictEqual(resolveEffectiveScanPaths('/project', null, {}), []);
    });
});

describe('readFileCached', () => {
    let tmpFile;

    beforeEach(() => {
        clearFileContentCache();
        tmpFile = path.join(os.tmpdir(), `sb-test-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, 'hello cached world', 'utf8');
    });

    afterEach(() => {
        clearFileContentCache();
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    });

    it('reads file and caches content', () => {
        const content1 = readFileCached(tmpFile);
        assert.strictEqual(content1, 'hello cached world');
        const content2 = readFileCached(tmpFile);
        assert.strictEqual(content2, 'hello cached world');
    });

    it('throws for non-string path', () => {
        assert.throws(() => readFileCached(123), TypeError);
    });
});

describe('readFileCachedAsync', () => {
    let tmpFile;

    beforeEach(() => {
        clearFileContentCache();
        tmpFile = path.join(os.tmpdir(), `sb-async-test-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, 'async hello', 'utf8');
    });

    afterEach(() => {
        clearFileContentCache();
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    });

    it('reads file asynchronously with caching', async () => {
        const content1 = await readFileCachedAsync(tmpFile);
        assert.strictEqual(content1, 'async hello');
        const content2 = await readFileCachedAsync(tmpFile);
        assert.strictEqual(content2, 'async hello');
    });

    it('throws for non-string path', async () => {
        await assert.rejects(readFileCachedAsync(123), TypeError);
    });
});
