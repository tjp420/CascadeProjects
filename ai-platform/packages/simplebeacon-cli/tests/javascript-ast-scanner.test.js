const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    scanTextPatterns,
    scanJavascriptAstPatterns,
    loadBabelParser
} = require('../src/lib/javascript-ast-scanner');

test('babel parser loads for javascript-ast-patterns', () => {
    assert.ok(loadBabelParser());
});

test('javascript AST flags unbounded openai.chat.completions.create', () => {
    const content = [
        'import OpenAI from "openai";',
        'const client = new OpenAI();',
        'export async function run() {',
        '  return client.chat.completions.create({ model: "gpt-4o", messages: [] });',
        '}'
    ].join('\n');
    const findings = scanTextPatterns('server/chat.ts', content, '.ts', {
        productionPathsOnly: true,
        productionPaths: ['server/']
    });
    assert.ok(findings.some((f) => f.pattern === 'SB-JS-TB-001'));
});

test('javascript AST passes when max_tokens provided', () => {
    const content = [
        'client.chat.completions.create({',
        '  model: "gpt-4o",',
        '  max_tokens: 400,',
        '  messages: []',
        '});'
    ].join('\n');
    const findings = scanTextPatterns('server/chat.ts', content, '.ts', {
        productionPathsOnly: true,
        productionPaths: ['server/']
    });
    assert.equal(findings.filter((f) => f.pattern === 'SB-JS-TB-001').length, 0);
});

test('javascript AST directory scan finds mock string in production path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-js-ast-'));
    const serverDir = path.join(dir, 'server');
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, 'agent.ts'), [
        'const path = "web/data/users-sample.json";',
        'export const x = path;'
    ].join('\n'));

    const result = await scanJavascriptAstPatterns(dir, {
        productionPaths: ['server/'],
        severity: 'medium'
    });
    assert.equal(result.ok, true, result.error);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-JS-FICTION-001'));
});
