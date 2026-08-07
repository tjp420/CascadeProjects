// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    scanTextPatterns,
    scanSuspiciousDependencies,
    scanLlmSlopPatterns
} = require('../src/rules/llm-slop-patterns');

test('scanTextPatterns flags YOUR_API_KEY_HERE placeholder', () => {
    const content = 'const key = "YOUR_API_KEY_HERE";\n';
    const hits = scanTextPatterns('src/config.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-001'));
});

test('scanTextPatterns flags markdown fence in source file', () => {
    const content = 'const x = `\n```javascript\nconsole.log(1)\n`;\n';
    const hits = scanTextPatterns('src/broken.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-002'));
});

test('scanTextPatterns ignores fence-detector regex definitions', () => {
    const ruleLine = "        regex: /(```javascript|```typescript|```python|```json|```\\s?$)/gm,\n";
    const parserLine = "    const fenced = text.match(/```json\\s*([\\s\\S]*?)```/gi) || [];\n";
    assert.equal(
        scanTextPatterns('packages/simplebeacon-cli/src/rules/llm-slop-patterns.js', ruleLine, '.js').length,
        0
    );
    assert.equal(
        scanTextPatterns('packages/simplebeacon-cli/src/proxy/inbound-enforcer.js', parserLine, '.js').length,
        0
    );
});

test('scanTextPatterns ignores markdown fences inside JSDoc blocks', () => {
    const content = [
        '/**',
        ' * Example usage:',
        ' * ```js',
        ' * const x = 1;',
        ' * ```',
        ' */',
        'module.exports = {};',
    ].join('\n');
    const hits = scanTextPatterns('src/util.js', content, '.js');
    assert.equal(hits.filter((h) => h.pattern === 'SB-FICTION-002').length, 0);
});

test('scanTextPatterns flags lorem ipsum UI copy', () => {
    const content = '<p>Lorem Ipsum Dolor sit amet</p>\n';
    const hits = scanTextPatterns('web/index.html', content, '.html');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-004'));
});

test('scanSuspiciousDependencies flags fake-* package names', () => {
    const content = JSON.stringify({
        dependencies: {
            'fake-auth-lib': '1.0.0',
            express: '4.18.0'
        }
    }, null, 2);
    const hits = scanSuspiciousDependencies('package.json', content);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].pattern, 'SB-FICTION-003');
});

test('scanLlmSlopPatterns walks repo and finds placeholder in source', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-slop-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'app.js'),
        'export const token = "INSERT_SECRET_HERE";\n'
    );
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'demo', dependencies: { 'mock-api-client': '0.0.1' } }, null, 2)
    );

    const result = await scanLlmSlopPatterns(root, {
        sourcePaths: ['src'],
        productionPaths: ['src'],
        registryCheck: false
    });

    assert.ok(result.findings >= 2);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-FICTION-001'));
    assert.ok(result.issues.some((i) => i.pattern === 'SB-FICTION-003'));
});

test('scanTextPatterns flags hallucinated API method .fetchAllRecords()', () => {
    const content = 'const records = await db.fetchAllRecords();\n';
    const hits = scanTextPatterns('src/api/service.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-005'));
});

test('scanTextPatterns flags hallucinated browser.ai namespace', () => {
    const content = 'const result = await browser.ai.generateResponse(prompt);\n';
    const hits = scanTextPatterns('src/ai-bridge.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-005'));
});

test('scanTextPatterns flags AI conversational debris in TODO comment', () => {
    const content = '// TODO: as discussed, we need to add rate limiting here\n';
    const hits = scanTextPatterns('src/middleware/auth.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-006'));
});

test('scanTextPatterns flags "per your request" in FIXME', () => {
    const content = '// FIXME: per your request, this timeout should be configurable\n';
    const hits = scanTextPatterns('src/config.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-006'));
});

test('scanTextPatterns does not flag plain TODO without AI debris', () => {
    const content = '// TODO: add input validation\n';
    const hits = scanTextPatterns('src/utils.js', content, '.js');
    assert.ok(!hits.some((h) => h.pattern === 'SB-FICTION-006'));
});

test('scanTextPatterns flags mock return true with TODO comment', () => {
    const content = 'function isAuthenticated() {\n  return true; // TODO: implement real check\n}\n';
    const hits = scanTextPatterns('src/auth.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-007'));
});

test('scanTextPatterns flags return null with placeholder comment', () => {
    const content = '  return null; // placeholder\n';
    const hits = scanTextPatterns('src/service.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-007'));
});

test('scanTextPatterns does not flag plain return true without placeholder comment', () => {
    const content = 'function isValid() {\n  return true;\n}\n';
    const hits = scanTextPatterns('src/validator.js', content, '.js');
    assert.ok(!hits.some((h) => h.pattern === 'SB-FICTION-007'));
});

test('scanTextPatterns flags boilerplate "This function does" comment', () => {
    const content = '// This function handles user authentication\nfunction auth() {}\n';
    const hits = scanTextPatterns('src/auth.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-008'));
});

test('scanTextPatterns flags boilerplate "This component renders" comment', () => {
    const content = '// This component renders the user profile card\nconst Profile = () => {};\n';
    const hits = scanTextPatterns('src/Profile.tsx', content, '.tsx');
    assert.ok(hits.some((h) => h.pattern === 'SB-FICTION-008'));
});

test('scanTextPatterns does not flag SB-FICTION-008 in markdown files', () => {
    const content = '// This function handles user authentication\n';
    const hits = scanTextPatterns('docs/readme.md', content, '.md');
    assert.ok(!hits.some((h) => h.pattern === 'SB-FICTION-008'));
});
