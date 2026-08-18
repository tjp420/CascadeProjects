const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scanContent, JS_PATTERNS, PY_PATTERNS, GO_PATTERNS } = require('../src/rules/swallowed-exception-scanner');

test('detects empty catch block in JS', () => {
  const code = `try { doSomething(); } catch (e) {}`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.length >= 1, 'should find at least 1 finding');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-empty-catch'), 'should detect empty catch');
  assert.equal(findings[0].severity, 'high');
});

test('detects catch-and-return-null in JS', () => {
  const code = `try { getData(); } catch (err) { return null; }`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-catch-return-null'), 'should detect catch-return-null');
});

test('detects catch-and-return-false in JS', () => {
  const code = `try { save(); } catch (e) { return false; }`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-catch-return-false'), 'should detect catch-return-false');
});

test('detects comment-only catch in JS', () => {
  const code = `try { risky(); } catch (e) { /* ignore */ }`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-catch-comment-only'), 'should detect comment-only catch');
});

test('detects Python except: pass', () => {
  const code = `try:\n    do_thing()\nexcept Exception:\n    pass\n`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-except-pass'), 'should detect except: pass');
});

test('detects Python bare except with pass (critical)', () => {
  const code = `try:\n    do_thing()\nexcept:\n    pass\n`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-bare-except'), 'should detect bare except');
  assert.equal(findings.find(f => f.ruleId === 'swallowed-bare-except').severity, 'critical');
});

test('detects Python except returning None', () => {
  const code = `try:\n    get_data()\nexcept ValueError:\n    return None\n`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-except-return-none'), 'should detect except-return-None');
});

test('detects Go silent error return', () => {
  const code = `result, err := doThing()\nif err != nil {\n    return nil\n}`;
  const findings = scanContent(code, 'test.go');
  assert.ok(findings.some(f => f.ruleId === 'swallowed-go-return-nil'), 'should detect Go silent error return');
});

test('does not flag properly handled catch with logging', () => {
  const code = `try { risky(); } catch (e) { console.error('Failed:', e); throw e; }`;
  const findings = scanContent(code, 'test.js');
  assert.equal(findings.length, 0, 'should not flag properly handled catch');
});

test('reports correct line numbers', () => {
  const code = `function foo() {\n  try {\n    bar();\n  } catch (e) {}\n}\n`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.length >= 1);
  assert.ok(findings[0].line >= 3, 'line should be at or after line 3');
});

test('JS_PATTERNS is non-empty', () => {
  assert.ok(JS_PATTERNS.length >= 5, 'should have at least 5 JS patterns');
});

test('PY_PATTERNS is non-empty', () => {
  assert.ok(PY_PATTERNS.length >= 3, 'should have at least 3 Python patterns');
});

test('GO_PATTERNS is non-empty', () => {
  assert.ok(GO_PATTERNS.length >= 2, 'should have at least 2 Go patterns');
});
