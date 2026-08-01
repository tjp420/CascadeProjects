/**
 * Scan utilities tests — pure functions with no DOM dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    extractMatches,
    isNodeModulePath,
    isCachePath,
    isTestFilePath,
    normalizePath,
    MAX_DISCOVERED_FILES
} = require('../js/scan-utils.js');

describe('scan-utils', () => {
    it('should extract regex matches with line numbers', () => {
        const text = 'line one\nMOCK_TODO fix this\nline three\nMOCK_TODO another';
        const pattern = /MOCK_TODO/;
        const matches = extractMatches(text, pattern, 2);
        assert.strictEqual(matches.length, 2);
        assert.strictEqual(matches[0].line, 2);
        assert.ok(matches[0].snippet.includes('TODO'));
    });

    it('should identify node_modules paths', () => {
        assert.strictEqual(isNodeModulePath('node_modules/foo/bar.js'), true);
        assert.strictEqual(isNodeModulePath('src/node_modules/foo.js'), true);
        assert.strictEqual(isNodeModulePath('src/foo.js'), false);
    });

    it('should identify cache paths', () => {
        assert.strictEqual(isCachePath('.simplebeacon/report.json'), true);
        assert.strictEqual(isCachePath('github-cache/clone/repo'), true);
        assert.strictEqual(isCachePath('.git/hooks/pre-commit'), true);
        assert.strictEqual(isCachePath('src/index.js'), false);
    });

    it('should identify test files', () => {
        assert.strictEqual(isTestFilePath('test-foo.js'), true);
        assert.strictEqual(isTestFilePath('foo.test.js'), true);
        assert.strictEqual(isTestFilePath('foo.spec.js'), true);
        assert.strictEqual(isTestFilePath('src/index.js'), false);
    });

    it('should normalize backslashes to forward slashes', () => {
        assert.strictEqual(normalizePath('src\\foo\\bar.js'), 'src/foo/bar.js');
        assert.strictEqual(normalizePath('src/foo/bar.js'), 'src/foo/bar.js');
    });

    it('should have correct max files constant', () => {
        assert.strictEqual(MAX_DISCOVERED_FILES, 999999999);
    });
});
