// simplebeacon-ignore classification-spillage — synthetic test fixtures only
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeHandoffExport,
    redactHandoffString,
    redactPathValue,
    hashSnippetValue
} = require('../src/lib/report-sanitizer');

test('redactPathValue redacts absolute user paths', () => {
    assert.equal(redactPathValue('/Users/admin/secret-project/src/app.ts'), '[REDACTED_PATH]');
    assert.equal(redactPathValue('C:\\Users\\admin\\secret-project\\src\\app.ts'), '[REDACTED_PATH]');
    assert.equal(redactPathValue('server/index.js'), 'server/index.js');
});

test('redactHandoffString redacts emails, IPs, and CUI markings', () => {
    const input = 'owner trevor@simplebeacon.ai host 10.0.0.5 banner CUI//SP-DISC keep 127.0.0.1';
    const out = redactHandoffString(input);
    assert.match(out, /\[REDACTED_EMAIL\]/);
    assert.match(out, /\[REDACTED_IP\]/);
    assert.match(out, /\[REDACTED_CLASSIFICATION\]/);
    assert.match(out, /127\.0\.0\.1/);
    assert.ok(!out.includes('trevor@simplebeacon.ai'));
    assert.ok(!out.includes('10.0.0.5'));
    assert.ok(!out.includes('CUI//SP-DISC'));
});

test('hashSnippetValue returns digest metadata without raw content', () => {
    const hashed = hashSnippetValue('line one\nline two');
    assert.equal(hashed.redacted, true);
    assert.equal(hashed.lineCount, 2);
    assert.equal(hashed.charCount, 17);
    assert.match(hashed.sha256, /^[a-f0-9]{64}$/);
});

test('sanitizeHandoffExport redacts paths and replaces snippets with hashes', () => {
    const handoff = sanitizeHandoffExport({
        type: 'simplebeacon-report',
        projectRoot: '/Users/admin/secret-project',
        platformRoot: 'C:\\Users\\admin\\CascadeProjects\\ai-platform',
        configPath: '/Users/admin/secret-project/.simplebeacon/config.json',
        gate: { pass: false, blockingCount: 1 },
        rawIssues: [{ severity: 'critical', filePath: 'server/a.js', snippet: 'sk_live_secret' }],
        detectedIssues: [{
            severity: 'critical',
            type: 'Classification Spillage',
            filePath: '/Users/admin/secret-project/server/a.js',
            description: 'CUI//SP-DISC found near trevor@example.com',
            snippet: 'const banner = "CUI//SP-DISC";',
            match: 'CUI//SP-DISC'
        }]
    });

    assert.equal(handoff.handoffExport, true);
    assert.equal(handoff.projectRoot, '[REDACTED_PATH]');
    assert.equal(handoff.platformRoot, '[REDACTED_PATH]');
    assert.equal(handoff.configPath, '[REDACTED_PATH]');
    assert.equal(handoff.rawIssues, undefined);
    assert.equal(handoff.detectedIssues.length, 1);

    const issue = handoff.detectedIssues[0];
    assert.equal(issue.filePath, '[REDACTED_PATH]');
    assert.match(issue.description, /\[REDACTED_CLASSIFICATION\]/);
    assert.match(issue.description, /\[REDACTED_EMAIL\]/);
    assert.equal(issue.snippet.redacted, true);
    assert.equal(issue.match.redacted, true);
    assert.ok(!JSON.stringify(handoff).includes('CUI//SP-DISC'));
    assert.ok(!JSON.stringify(handoff).includes('/Users/admin'));
});

test('sanitizeHandoffExport includeRedactedSnippets keeps redacted text', () => {
    const handoff = sanitizeHandoffExport({
        detectedIssues: [{
            filePath: '/home/deploy/app/server.js',
            snippet: 'const x = "CUI//SP-DISC";'
        }]
    }, { includeRedactedSnippets: true });

    const issue = handoff.detectedIssues[0];
    assert.equal(typeof issue.snippet, 'string');
    assert.match(issue.snippet, /\[REDACTED_CLASSIFICATION\]/);
    assert.ok(!issue.snippet.includes('CUI//SP-DISC'));
});
