const test = require('node:test');
const assert = require('node:assert');

const { stripMarkdownFenceBlock, buildRemediationPrompt } = require('../out/fixes/localRemediationText.js');

test('strips markdown fence wrappers from remediation snippets', () => {
  const fenced = '```javascript\nconst value = 1;\n```';

  assert.strictEqual(stripMarkdownFenceBlock(fenced), 'const value = 1;');
});

test('leaves plain text unchanged when no fences are present', () => {
  const snippet = 'const value = 1;';

  assert.strictEqual(stripMarkdownFenceBlock(snippet), snippet);
});

test('trims padded fenced blocks without disturbing inner code', () => {
  const fenced = '```ts\n\n  const value = 1;\n\n```';

  assert.strictEqual(stripMarkdownFenceBlock(fenced), '\n  const value = 1;');
});

test('builds a remediation prompt with diagnostic context', () => {
  const prompt = buildRemediationPrompt({
    filePath: 'c:/repo/src/app.ts',
    rangeStartLine: 2,
    rangeStartCharacter: 4,
    rangeEndLine: 2,
    rangeEndCharacter: 18,
    diagnosticCode: 'RULE_SEC_020',
    diagnosticMessage: 'Hardcoded fallback secret detected',
    snippet: 'const secret = "simplebeacon-dev-insecure";',
  });

  assert.match(prompt, /RULE_SEC_020/);
  assert.match(prompt, /Hardcoded fallback secret detected/);
  assert.match(prompt, /app\.ts/);
  assert.match(prompt, /simplebeacon-dev-insecure/);
});
