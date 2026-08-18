const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scanContent, JS_PHANTOM_APIS, PY_PHANTOM_APIS } = require('../src/rules/phantom-api-scanner');

test('detects fs.readFilePromise hallucination', () => {
  const code = `const data = await fs.readFilePromise('path');`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.ruleId === 'phantom-api-call' && f.snippet.includes('readFilePromise')));
});

test('detects JSON.tryParse hallucination', () => {
  const code = `const obj = JSON.tryParse(str);`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('tryParse')), 'should detect JSON.tryParse');
});

test('detects Array.first hallucination', () => {
  const code = `const first = Array.first(arr);`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('first')), 'should detect Array.first');
});

test('detects Object.deepClone hallucination', () => {
  const code = `const copy = Object.deepClone(obj);`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('deepClone')), 'should detect Object.deepClone');
});

test('detects Promise.retry hallucination', () => {
  const code = `await Promise.retry(() => fetch(url), 3);`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('retry')), 'should detect Promise.retry');
});

test('detects Math.clamp hallucination', () => {
  const code = `const v = Math.clamp(x, 0, 100);`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('clamp')), 'should detect Math.clamp');
});

test('detects React.useMemoCallback hallucination', () => {
  const code = `const fn = React.useMemoCallback(cb, [dep]);`;
  const findings = scanContent(code, 'test.tsx');
  assert.ok(findings.some(f => f.snippet.includes('useMemoCallback')), 'should detect React.useMemoCallback');
});

test('detects Python pandas to_jsonl hallucination', () => {
  const code = `pd.DataFrame.to_jsonl(df, 'output.jsonl')`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.snippet.includes('to_jsonl')), 'should detect pd.to_jsonl');
});

test('detects Python requests.get_async hallucination', () => {
  const code = `await requests.get_async(url)`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.snippet.includes('get_async')), 'should detect requests.get_async');
});

test('detects Python json.loads_safe hallucination', () => {
  const code = `data = json.loads_safe(raw)`;
  const findings = scanContent(code, 'test.py');
  assert.ok(findings.some(f => f.snippet.includes('loads_safe')), 'should detect json.loads_safe');
});

test('does not flag real fs.readFile', () => {
  const code = `fs.readFile('path', (err, data) => {});`;
  const findings = scanContent(code, 'test.js');
  assert.equal(findings.length, 0, 'should not flag real fs.readFile');
});

test('does not flag real JSON.parse', () => {
  const code = `const obj = JSON.parse(str);`;
  const findings = scanContent(code, 'test.js');
  assert.equal(findings.length, 0, 'should not flag real JSON.parse');
});

test('does not flag real Promise.all', () => {
  const code = `await Promise.all(promises);`;
  const findings = scanContent(code, 'test.js');
  assert.equal(findings.length, 0, 'should not flag real Promise.all');
});

test('reports correct line number', () => {
  const code = `function foo() {\n  const x = JSON.tryParse(str);\n  return x;\n}`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.length >= 1);
  assert.equal(findings[0].line, 2);
});

test('includes recommendation in finding', () => {
  const code = `JSON.tryParse(str)`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.length >= 1);
  assert.ok(findings[0].recommendation, 'should include recommendation');
  assert.ok(findings[0].recommendation.includes('JSON.parse'), 'recommendation should mention JSON.parse');
});

test('JS_PHANTOM_APIS has at least 40 entries', () => {
  assert.ok(JS_PHANTOM_APIS.length >= 40, `should have 40+ JS phantom APIs, got ${JS_PHANTOM_APIS.length}`);
});

test('PY_PHANTOM_APIS has at least 15 entries', () => {
  assert.ok(PY_PHANTOM_APIS.length >= 15, `should have 15+ Python phantom APIs, got ${PY_PHANTOM_APIS.length}`);
});

test('all JS phantom APIs have required fields', () => {
  for (const api of JS_PHANTOM_APIS) {
    assert.ok(api.object, 'missing object');
    assert.ok(api.method, 'missing method');
    assert.ok(api.suggestion, 'missing suggestion');
    assert.ok(api.severity, 'missing severity');
  }
});

test('detects optional chaining variant', () => {
  const code = `const x = fs?.readFilePromise('path');`;
  const findings = scanContent(code, 'test.js');
  assert.ok(findings.some(f => f.snippet.includes('readFilePromise')), 'should detect optional chaining variant');
});
