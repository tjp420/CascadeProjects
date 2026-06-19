const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sanitizeFilePath, sanitizeString } = require('../../src/lib/input-sanitizer');

describe('input-sanitizer', () => {
    describe('sanitizeFilePath', () => {
        it('returns empty string for null input', () => {
            assert.strictEqual(sanitizeFilePath(null), '');
        });

        it('returns empty string for undefined input', () => {
            assert.strictEqual(sanitizeFilePath(undefined), '');
        });

        it('trims whitespace from input', () => {
            assert.strictEqual(sanitizeFilePath('  /path/to/file  '), '/path/to/file');
        });

        it('removes control characters from input', () => {
            assert.strictEqual(sanitizeFilePath('/path\x00/to\x1F/file\x7F'), '/path/to/file');
        });

        it('returns the same string for clean input', () => {
            assert.strictEqual(sanitizeFilePath('/clean/path'), '/clean/path');
        });
    });

    describe('sanitizeString', () => {
        it('returns empty string for null input', () => {
            assert.strictEqual(sanitizeString(null), '');
        });

        it('trims and truncates to maxLength', () => {
            const long = 'a'.repeat(2000);
            assert.strictEqual(sanitizeString(long).length, 1000);
        });

        it('accepts custom maxLength', () => {
            const input = 'hello world';
            assert.strictEqual(sanitizeString(input, 5), 'hello');
        });

        it('removes control characters', () => {
            assert.strictEqual(sanitizeString('test\x00\x1F\x7Fvalue'), 'testvalue');
        });
    });
});
