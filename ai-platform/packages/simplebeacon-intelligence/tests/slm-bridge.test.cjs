// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  probeSlmBin,
  canRunSlm,
  buildSlmPrompt,
  parseSlmResponse,
  validateSlmResult,
  runSlmReview,
  runSlmReviewAsync,
} = require('../src/slm-bridge.js');

test('probeSlmBin returns not configured when no env var', () => {
  delete process.env.LLAMA_CPP_BIN;
  const result = probeSlmBin();
  assert.equal(result.configured, false);
  assert.equal(result.executable, false);
  assert.equal(result.path, null);
});

test('probeSlmBin returns configured when path provided', () => {
  const result = probeSlmBin({ binPath: '/usr/bin/llama-cli' });
  assert.equal(result.configured, true);
  assert.equal(result.path, '/usr/bin/llama-cli');
});

test('canRunSlm returns false when not configured', () => {
  delete process.env.LLAMA_CPP_BIN;
  assert.equal(canRunSlm(), false);
});

test('buildSlmPrompt returns string with snippet', () => {
  const prompt = buildSlmPrompt('const x = 1;', { filePath: 'test.js' });
  assert.equal(typeof prompt, 'string');
  assert.ok(prompt.includes('const x = 1;'));
});

test('parseSlmResponse parses valid JSON', () => {
  const result = parseSlmResponse('{"risk":"low","reason":"looks fine"}');
  assert.equal(result.risk, 'low');
  assert.equal(result.reason, 'looks fine');
});

test('parseSlmResponse handles invalid JSON', () => {
  const result = parseSlmResponse('not json');
  assert.ok(result);
  assert.equal(typeof result, 'object');
});

test('validateSlmResult returns boolean', () => {
  assert.equal(typeof validateSlmResult({ risk: 'low', reason: 'ok' }), 'boolean');
});

test('runSlmReview returns disabled when not configured', () => {
  delete process.env.LLAMA_CPP_BIN;
  const result = runSlmReview('snippet', {});
  assert.equal(result.enabled, false);
});

test('runSlmReviewAsync returns disabled when not configured', async () => {
  delete process.env.LLAMA_CPP_BIN;
  const result = await runSlmReviewAsync('snippet', {});
  assert.equal(result.enabled, false);
});
