// simplebeacon-ignore: Test file for scanner rules — all findings are expected test fixtures
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanOwaspLlmPatterns, RULE_CATALOG, OWASP_CATEGORIES } = require('../src/rules/owasp-llm-patterns');

test('RULE_CATALOG has 10 rules covering all OWASP LLM categories', () => {
    assert.equal(RULE_CATALOG.length, 10);
    const owaspIds = RULE_CATALOG.map((r) => r.owaspId);
    for (let i = 1; i <= 10; i++) {
        assert.ok(owaspIds.includes(`LLM${String(i).padStart(2, '0')}:2025`), `Missing LLM${String(i).padStart(2, '0')}`);
    }
});

test('OWASP_CATEGORIES has 10 categories', () => {
    assert.equal(OWASP_CATEGORIES.length, 10);
});

test('LLM01: flags prompt injection — user input into prompt', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-01-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'chat.js'),
        'const prompt = "Answer: " + req.body.userInput;\nopenai.chat.completions.create({ prompt });'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM01-001'));
    assert.equal(result.issues.find((i) => i.metadata?.patternId === 'OWASP-LLM01-001').severity, 'high');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM02: flags sensitive info in LLM API calls', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-02-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'api.js'),
        'openai.chat.completions.create({ messages: [{ content: user.email }] });'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM02-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM03: flags unpinned LLM package import', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-03-'));
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'src', 'index.js'),
        "const OpenAI = require('openai');"
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['src'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM03-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM04: flags training data from unvalidated URLs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-04-'));
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'src', 'train.js'),
        "const data = await fetch('https://example.com/scraped-dataset.json');"
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['src'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM04-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM05: flags LLM output into innerHTML', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-05-'));
    fs.mkdirSync(path.join(dir, 'web'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'web', 'render.js'),
        'document.getElementById("output").innerHTML = aiResponse;'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['web'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM05-001'));
    assert.equal(result.issues.find((i) => i.metadata?.patternId === 'OWASP-LLM05-001').severity, 'high');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM06: flags LLM output driving exec', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-06-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'agent.js'),
        'const result = exec(aiCommand);'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM06-001'));
    assert.equal(result.issues.find((i) => i.metadata?.patternId === 'OWASP-LLM06-001').severity, 'high');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM07: flags secrets in system prompts', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-07-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'prompt.js'),
        "const messages = [{ role: 'system', content: 'You are helpful. API_KEY=sk-xxx' }];"
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM07-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM08: flags embedding from unvalidated user input', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-08-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'vector.js'),
        'const embedding = await embeddings.create({ input: req.body.userInput });'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM08-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM09: flags LLM output returned without disclaimer', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-09-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'route.js'),
        'function getAnswer() { return aiResponse; }'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM09-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('LLM10: flags unbounded max_tokens', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-10-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'llm.js'),
        'openai.chat.completions.create({ max_tokens: 999999 });'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'OWASP-LLM10-001'));
    assert.equal(result.issues.find((i) => i.metadata?.patternId === 'OWASP-LLM10-001').severity, 'high');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('suppression comment prevents finding', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-suppress-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'suppressed.js'),
        'document.getElementById("output").innerHTML = aiResponse; // simplebeacon-ignore owasp-llm'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    const llm05 = result.issues.filter((i) => i.metadata?.patternId === 'OWASP-LLM05-001');
    assert.equal(llm05.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('clean file with no LLM patterns produces 0 findings', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-clean-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'health.js'),
        'function healthCheck() { return { status: "ok", uptime: process.uptime() }; }\nmodule.exports = { healthCheck };'
    );
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.equal(result.findings, 0);
    assert.equal(result.issues.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('summary includes OWASP version and categories', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-owasp-summary-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'server', 'empty.js'), '');
    const result = await scanOwaspLlmPatterns(dir, { sourcePaths: ['server'] });
    assert.equal(result.summary.owaspVersion, '2025');
    assert.equal(result.summary.totalRules, 10);
    assert.ok(result.summary.referenceUrl.includes('genai.owasp.org'));
    fs.rmSync(dir, { recursive: true, force: true });
});
