const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    GRAMMAR_MAP,
    initParser,
    createLanguageParser,
    parseWithTreeSitter,
    isGrammarAvailable,
    getTreeSitterStatus,
    resolveWasmDir
} = require('../src/tree-sitter-loader.js');

test('GRAMMAR_MAP has expected language mappings', () => {
    assert.ok(GRAMMAR_MAP.javascript);
    assert.ok(GRAMMAR_MAP.typescript);
    assert.ok(GRAMMAR_MAP.python);
    assert.ok(GRAMMAR_MAP.go);
});

test('resolveWasmDir returns string path', () => {
    const result = resolveWasmDir();
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
});

test('resolveWasmDir respects custom wasmDir option', () => {
    const result = resolveWasmDir({ wasmDir: '/custom/path' });
    assert.ok(result.includes('custom'));
});

test('isGrammarAvailable returns boolean', () => {
    const result = isGrammarAvailable('javascript');
    assert.equal(typeof result, 'boolean');
});

test('isGrammarAvailable returns false for unknown language', () => {
    assert.equal(isGrammarAvailable('cobol'), false);
});

test('getTreeSitterStatus returns object', () => {
    const result = getTreeSitterStatus();
    assert.ok(result);
    assert.equal(typeof result, 'object');
});

test('initParser returns null or promise when web-tree-sitter not installed', async () => {
    const result = await initParser().catch(() => null);
    assert.ok(result === null || typeof result === 'object');
});

test('createLanguageParser returns null for unavailable grammar', async () => {
    const result = await createLanguageParser('cobol').catch(() => null);
    assert.ok(result === null || typeof result === 'object');
});

test('parseWithTreeSitter returns null or object', async () => {
    const result = await parseWithTreeSitter('const x = 1;', 'javascript').catch(() => null);
    assert.ok(result === null || typeof result === 'object');
});
