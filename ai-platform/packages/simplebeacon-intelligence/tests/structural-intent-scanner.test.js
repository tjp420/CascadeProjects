// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    scanStructuralIntent,
    scanCredentialDictStubs,
    extractPythonFunctions,
    extractJsFunctions,
    analyzeFunctionBlock,
    isGenericName,
    credentialKeyMatch,
    isPlaceholderCredentialValue,
    hasPlaceholderReturn
} = require('../src/structural-intent-scanner.js');

test('isGenericName detects generic AI names', () => {
    assert.equal(isGenericName('process_data'), true);
    assert.equal(isGenericName('handle_request'), true);
});

test('isGenericName returns false for specific names', () => {
    assert.equal(isGenericName('authenticateUser'), false);
});

test('credentialKeyMatch detects credential keys', () => {
    assert.equal(credentialKeyMatch('api_key'), true);
    assert.equal(credentialKeyMatch('password'), true);
    assert.equal(credentialKeyMatch('username'), false);
});

test('isPlaceholderCredentialValue detects placeholders', () => {
    assert.equal(isPlaceholderCredentialValue('your_api_key'), true);
    assert.equal(isPlaceholderCredentialValue('changeme'), true);
    assert.equal(isPlaceholderCredentialValue('placeholder'), true);
    assert.equal(isPlaceholderCredentialValue('sk_live_abc123def456'), false);
});

test('isPlaceholderCredentialValue returns true for null/short values', () => {
    assert.equal(isPlaceholderCredentialValue(null), true);
    assert.equal(isPlaceholderCredentialValue('abc'), true);
});

test('extractPythonFunctions extracts function names', () => {
    const code = 'def my_func(arg):\n    return arg\ndef other():\n    pass';
    const fns = extractPythonFunctions(code);
    assert.ok(fns.length >= 2);
    assert.ok(fns.some(f => f.name === 'my_func'));
});

test('extractJsFunctions extracts function names', () => {
    const code = 'function myFunc() { return 1; }\nconst arrow = () => { return 2; };';
    const fns = extractJsFunctions(code);
    assert.ok(fns.length >= 1);
});

test('scanStructuralIntent returns object with findings', () => {
    const code = 'def process_data(data):\n    temp = data\n    return temp\n';
    const result = scanStructuralIntent(code, { filePath: 'test.py', language: 'python' });
    assert.ok(result);
    assert.ok(Array.isArray(result.findings));
});

test('scanCredentialDictStubs detects credential stubs', () => {
    const code = 'const config = { api_key: "your_key_here", secret: "changeme" };';
    const result = scanCredentialDictStubs(code, { filePath: 'config.js' });
    assert.ok(result);
    assert.ok(Array.isArray(result.findings));
});

test('analyzeFunctionBlock returns object', () => {
    const fn = { name: 'test_func', body: 'return None', language: 'python' };
    const result = analyzeFunctionBlock(fn, 'python');
    assert.ok(result);
    assert.equal(typeof result, 'object');
});

test('hasPlaceholderReturn detects placeholder returns', () => {
    assert.equal(hasPlaceholderReturn('return None'), true);
    assert.equal(hasPlaceholderReturn('return 42'), false);
});
