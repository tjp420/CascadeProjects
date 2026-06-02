const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanTextPatterns: scanTokenBleed } = require('../src/rules/token-bleed-patterns');
const { scanTextPatterns: scanArchitectureDrift } = require('../src/rules/architecture-drift-patterns');
const { loadSimplebeaconConfig, isRuleEnabled, OPT_IN_RULE_DEFAULTS } = require('../src/config');
const { scanSnippetContent } = require('../src/lib/snippet-scanner');

test('opt-in rules default to disabled via OPT_IN_RULE_DEFAULTS', () => {
    assert.equal(OPT_IN_RULE_DEFAULTS['token-bleed-patterns'].enabled, false);
    assert.equal(OPT_IN_RULE_DEFAULTS['architecture-drift-patterns'].enabled, false);
    assert.equal(OPT_IN_RULE_DEFAULTS['python-ast-patterns'].enabled, false);
    assert.equal(OPT_IN_RULE_DEFAULTS['javascript-ast-patterns'].enabled, false);
});

test('token bleed SB-TB-005 flags LLM call without max_tokens', () => {
    const content = 'await openai.chat.completions.create({ model: "gpt-4o", messages: [] });';
    const findings = scanTokenBleed('server/chat.js', content, '.js', {
        productionPathsOnly: true,
        productionPaths: ['server/']
    });
    assert.ok(findings.some((f) => f.pattern === 'SB-TB-005'));
});

test('token bleed SB-TB-005 passes when max_tokens set in call window', () => {
    const content = [
        'await openai.chat.completions.create({',
        '  model: "gpt-4o",',
        '  max_tokens: 512,',
        '  messages: []',
        '});'
    ].join('\n');
    const findings = scanTokenBleed('server/chat.js', content, '.js', {
        productionPathsOnly: true,
        productionPaths: ['server/']
    });
    assert.equal(findings.filter((f) => f.pattern === 'SB-TB-005').length, 0);
});

test('token bleed detects readFileSync near openai.chat.completions.create', () => {
    const content = [
        "const fs = require('fs');",
        "const body = fs.readFileSync('./upload.txt', 'utf8');",
        'await openai.chat.completions.create({ messages: [{ role: "user", content: body }] });'
    ].join('\n');
    const findings = scanTokenBleed('server/routes/chat.js', content, '.js', {
        productionPathsOnly: true,
        productionPaths: ['server/', 'src/']
    });
    assert.ok(findings.some((f) => f.pattern === 'SB-TB-001'));
});

test('token bleed skips paths outside production dirs', () => {
    const content = "fs.readFileSync('x'); openai.chat.completions.create();";
    const findings = scanTokenBleed('web/components/Chat.tsx', content, '.tsx', {
        productionPathsOnly: true,
        productionPaths: ['server/', 'src/']
    });
    assert.equal(findings.length, 0);
});

test('architecture drift flags hybrid model without validator', () => {
    const content = [
        "const modelId = 'state-spaces/mamba-2-7b';",
        'export async function run() { return fetchModel(modelId); }'
    ].join('\n');
    const findings = scanArchitectureDrift('src/inference/run.ts', content, '.ts', {
        productionPathsOnly: true,
        productionPaths: ['server/', 'src/']
    });
    assert.ok(findings.some((f) => f.pattern === 'SB-AD-001'));
    assert.equal(findings[0].severity, 'high');
});

test('architecture drift passes when zod present in same file', () => {
    const content = [
        "import { z } from 'zod';",
        "const schema = z.object({ answer: z.string() });",
        "const modelId = 'mamba-2';"
    ].join('\n');
    const findings = scanArchitectureDrift('src/inference/run.ts', content, '.ts', {
        productionPathsOnly: true,
        productionPaths: ['server/', 'src/']
    });
    assert.equal(findings.length, 0);
});

test('scan_snippet skips opt-in rules until enabled in config', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-optin-'));
    fs.mkdirSync(path.join(dir, '.simplebeacon'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.simplebeacon', 'config.json'), JSON.stringify({
        profile: 'minimal',
        rules: {}
    }, null, 2));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    const content = "fs.readFileSync('x'); openai.chat.completions.create();";
    const config = loadSimplebeaconConfig(dir);
    assert.equal(isRuleEnabled(config, 'token-bleed-patterns'), false);

    const off = scanSnippetContent(content, { filePath: 'server/chat.js', projectRoot: dir });
    assert.equal(off.findings.filter((f) => f.pattern?.startsWith('SB-TB')).length, 0);

    fs.writeFileSync(path.join(dir, '.simplebeacon', 'config.json'), JSON.stringify({
        profile: 'minimal',
        rules: { 'token-bleed-patterns': { enabled: true } }
    }, null, 2));
    const on = scanSnippetContent(content, { filePath: 'server/chat.js', projectRoot: dir });
    assert.ok(on.findings.some((f) => f.pattern === 'SB-TB-001'));
});
