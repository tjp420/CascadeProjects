const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    scanEnterpriseGuardrailContent,
    scanEnterpriseGuardrailPatterns
} = require('../src/rules/enterprise-guardrail-patterns');

test('scanEnterpriseGuardrailContent flags corporate token in quoted string', () => {
    const content = 'const prompt = "Use internal_db_password for context";\n';
    const hits = scanEnterpriseGuardrailContent('src/agent.py', content);
    assert.ok(hits.some((h) => h.pattern === 'SB-ENT-001'));
    assert.equal(hits.find((h) => h.pattern === 'SB-ENT-001').severity, 'critical');
});

test('scanEnterpriseGuardrailContent ignores leak token outside string context', () => {
    const content = '// rename internal_db_password field later\n';
    const hits = scanEnterpriseGuardrailContent('src/config.js', content);
    assert.equal(hits.filter((h) => h.pattern === 'SB-ENT-001').length, 0);
});

test('scanEnterpriseGuardrailContent flags LLM call without token cap', () => {
    const content = 'await openai.chat.completions.create({ model: "gpt-4o", messages });\n';
    const hits = scanEnterpriseGuardrailContent('src/llm.ts', content);
    assert.ok(hits.some((h) => h.pattern === 'SB-ENT-002'));
});

test('scanEnterpriseGuardrailContent passes when max_tokens set in multiline block', () => {
    const content = [
        'await client.chat.completions.create({',
        '  model: "gpt-4o-mini",',
        '  messages: msgs,',
        '  max_tokens: 512',
        '});',
        ''
    ].join('\n');
    const hits = scanEnterpriseGuardrailContent('src/safe.ts', content);
    assert.equal(hits.filter((h) => h.pattern === 'SB-ENT-002').length, 0);
});

test('scanEnterpriseGuardrailPatterns walks repo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ent-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'risk.py'),
        'client.messages.create(model="claude-3", messages=[{"role":"user","content": "customer_ssn=123"}])\n'
    );

    const result = await scanEnterpriseGuardrailPatterns(root, {
        sourcePaths: ['src'],
        productionPaths: ['src']
    });

    assert.ok(result.findings >= 2);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-ENT-001'));
    assert.ok(result.issues.some((i) => i.pattern === 'SB-ENT-002'));

    fs.rmSync(root, { recursive: true, force: true });
});

test('scanEnterpriseGuardrailContent respects extraLeakTokens', () => {
    const content = 'const x = "acme_corporate_vault_id";\n';
    const hits = scanEnterpriseGuardrailContent('lib/x.js', content, {
        extraLeakTokens: ['acme_corporate_vault_id']
    });
    assert.ok(hits.some((h) => h.pattern === 'SB-ENT-001'));
});
