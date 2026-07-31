// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * Enterprise guardrail patterns — unit tests for cost-prevention rules.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  scanHighMaxTokens,
  scanUnboundedLoops,
  scanMissingRetryConfig,
  scanUnsafeStreamCalls,
  scanTokenBudgetLines,
  scanDataLeakLines,
  scanEnterpriseGuardrailContent,
} = require('./enterprise-guardrail-patterns');

describe('SB-ENT-002b — High max_tokens threshold', () => {
  it('flags max_tokens set to 20000', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', max_tokens: 20000 });`;
    const findings = scanHighMaxTokens('test.js', content);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-002b');
    assert.ok(findings[0].description.includes('20000'));
  });

  it('ignores max_tokens at exactly 16384', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', max_tokens: 16384 });`;
    const findings = scanHighMaxTokens('test.js', content);
    assert.strictEqual(findings.length, 0);
  });

  it('ignores max_tokens below threshold', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', max_tokens: 4096 });`;
    const findings = scanHighMaxTokens('test.js', content);
    assert.strictEqual(findings.length, 0);
  });
});

describe('SB-ENT-003 — Unbounded loops with LLM calls', () => {
  it('flags for loop without bound containing LLM call', () => {
    const content = `
for (const item of items) {
    const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });
    results.push(res);
}`;
    const findings = scanUnboundedLoops('test.js', content);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-003');
  });

  it('ignores bounded for loop with length cap', () => {
    const content = `
for (let i = 0; i < items.length; i++) {
    const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });
}`;
    const findings = scanUnboundedLoops('test.js', content);
    assert.strictEqual(findings.length, 0);
  });

  it('ignores forEach with limit in callback', () => {
    const content = `
items.slice(0, 10).forEach((item) => {
    const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });
});`;
    const findings = scanUnboundedLoops('test.js', content);
    assert.strictEqual(findings.length, 0);
  });
});

describe('SB-ENT-004 — Missing retry config on LLM clients', () => {
  it('flags new OpenAI without maxRetries', () => {
    const content = `const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });`;
    const findings = scanMissingRetryConfig('test.js', content);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-004');
  });

  it('ignores new OpenAI with maxRetries', () => {
    const content = `const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 3, timeout: 30000 });`;
    const findings = scanMissingRetryConfig('test.js', content);
    assert.strictEqual(findings.length, 0);
  });

  it('flags new Anthropic without maxRetries', () => {
    const content = `const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });`;
    const findings = scanMissingRetryConfig('test.js', content);
    assert.strictEqual(findings.length, 1);
  });
});

describe('SB-ENT-005 — Unsafe stream calls', () => {
  it('flags stream call without AbortController', () => {
    const content = `const stream = await openai.chat.completions.create({ model: 'gpt-4', stream: true });`;
    const findings = scanUnsafeStreamCalls('test.js', content);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-005');
  });

  it('ignores stream call with AbortController', () => {
    const content = `
const controller = new AbortController();
const stream = await openai.chat.completions.create({ model: 'gpt-4', stream: true, signal: controller.signal });`;
    const findings = scanUnsafeStreamCalls('test.js', content);
    assert.strictEqual(findings.length, 0);
  });

  it('ignores stream call with setTimeout', () => {
    const content = `
const stream = await openai.chat.completions.create({ model: 'gpt-4', stream: true });
setTimeout(() => stream.cancel(), 30000);`;
    const findings = scanUnsafeStreamCalls('test.js', content);
    assert.strictEqual(findings.length, 0);
  });
});

describe('SB-ENT-002 — Token budget bleed (original)', () => {
  it('flags missing max_tokens on openai call', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });`;
    const findings = scanTokenBudgetLines('test.js', content);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-002');
  });

  it('ignores call with max_completion_tokens', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [], max_completion_tokens: 64000 });`;
    const findings = scanTokenBudgetLines('test.js', content);
    assert.strictEqual(findings.length, 0);
  });
});

describe('SB-ENT-001 — Data leakage in LLM-bound strings', () => {
  it('flags hardcoded leak token in string context', () => {
    const content = `const payload = { secret: 'internal_db_password' };`;
    const findings = scanDataLeakLines(
      'test.js',
      content,
      /\b(?:internal_db_password|prod_api_secret|customer_ssn|pii_payload|auth_token)\b/gi
    );
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].pattern, 'SB-ENT-001');
  });

  it('ignores allowlisted snippet', () => {
    const content = `// allow: internal_db_password`;
    const findings = scanDataLeakLines('test.js', content, /\b(?:internal_db_password)\b/gi);
    assert.strictEqual(findings.length, 0);
  });

  it('ignores token in non-string context', () => {
    const content = `const x = internal_db_password;`;
    const findings = scanDataLeakLines('test.js', content, /\b(?:internal_db_password)\b/gi);
    assert.strictEqual(findings.length, 0);
  });

  it('ignores safe content', () => {
    const content = `const greeting = 'Hello world';`;
    const findings = scanDataLeakLines('test.js', content, /\b(?:internal_db_password)\b/gi);
    assert.strictEqual(findings.length, 0);
  });
});

describe('scanEnterpriseGuardrailContent — orchestrator', () => {
  it('returns findings from multiple sub-scanners in one pass', () => {
    const content = `
const payload = { secret: 'internal_db_password' };
const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });
        `;
    const findings = scanEnterpriseGuardrailContent('src/app.js', content);
    const patterns = findings.map((f) => f.pattern);
    assert.ok(patterns.includes('SB-ENT-001'), 'expected SB-ENT-001 (data leak)');
    assert.ok(patterns.includes('SB-ENT-002'), 'expected SB-ENT-002 (token budget)');
  });

  it('returns empty array for safe content', () => {
    const content = `const greeting = 'Hello world';`;
    const findings = scanEnterpriseGuardrailContent('src/app.js', content);
    assert.strictEqual(findings.length, 0);
  });

  it('respects excluded paths', () => {
    const content = `const res = await openai.chat.completions.create({ model: 'gpt-4', messages: [] });`;
    const findings = scanEnterpriseGuardrailContent('simplebeacon-rule-tests/test.js', content);
    assert.strictEqual(findings.length, 0);
  });
});
