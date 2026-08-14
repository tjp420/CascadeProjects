// simplebeacon-ignore: Test file for scanner rules — all findings are expected test fixtures
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    scanEuAiActPatterns,
    detectComplianceArtifacts,
    COMPLIANCE_OBLIGATIONS
} = require('../src/rules/eu-ai-act-patterns');

test('COMPLIANCE_OBLIGATIONS has 8 rules covering Articles 9-27', () => {
    assert.ok(COMPLIANCE_OBLIGATIONS.length >= 8);
    const articles = COMPLIANCE_OBLIGATIONS.map((r) => r.article);
    for (const art of ['9', '10', '12', '13', '14', '15', '26', '27']) {
        assert.ok(articles.includes(art), `Missing Article ${art}`);
    }
});

test('Art. 10: flags training data from unvalidated URLs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-dg-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'train.js'),
        "const openai = require('openai');\nconst data = await fetch('https://example.com/scraped-dataset.json');"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'EUAI-DG-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 14: flags fully automated decision without human oversight', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-ho2-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'approve.js'),
        "const openai = require('openai');\nfunction processApplication() { return autoApprove(applicant); }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'EUAI-HO-002'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 26: flags high-risk AI deployment without deployer obligations', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-dep-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'deploy.js'),
        "const openai = require('openai');\nfunction deployModel() { return deploying ai system to production; }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'EUAI-DEP-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 27 FRIA: flags missing FRIA when high-risk indicator detected', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-fria-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    // High-risk pattern (employment screening) + AI indicator, but no FRIA artifact
    fs.writeFileSync(
        path.join(dir, 'server', 'hiring.js'),
        "const openai = require('openai');\nconst model = trainHiringDecisionModel(data);\nfunction scoreCandidate(resume) { return model.predict(resume); }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    const fria = result.issues.find((i) => i.metadata?.patternId === 'EUAI-FRIA-001');
    assert.ok(fria, 'Expected EUAI-FRIA-001 finding');
    assert.equal(fria.severity, 'high');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 27 FRIA: does not flag when no high-risk indicator present', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-fria-clean-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    // AI indicator but no high-risk pattern
    fs.writeFileSync(
        path.join(dir, 'server', 'chatbot.js'),
        "const openai = require('openai');\nfunction chat() { return openai.chat.completions.create({ messages: [] }); }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    const fria = result.issues.filter((i) => i.metadata?.patternId === 'EUAI-FRIA-001');
    assert.equal(fria.length, 0, 'Should not flag FRIA without high-risk indicator');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 9: flags missing risk register artifact', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-rm-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'ai.js'),
        "const openai = require('openai');\nfunction generate() { return openai.chat.completions.create(); }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    const rm = result.issues.find((i) => i.metadata?.patternId === 'EUAI-RM-001');
    assert.ok(rm, 'Expected EUAI-RM-001 finding for missing risk register');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('Art. 9: does not flag when risk register artifact exists', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-rm-ok-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'ai.js'),
        "const openai = require('openai');\nfunction generate() { return openai.chat.completions.create(); }"
    );
    fs.writeFileSync(
        path.join(dir, 'docs', 'risk-register.md'),
        '# Risk Register\n\n## Identified Risks\n- Model bias\n- Data leakage'
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    const rm = result.issues.filter((i) => i.metadata?.patternId === 'EUAI-RM-001');
    assert.equal(rm.length, 0, 'Should not flag when risk register exists');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('detectComplianceArtifacts finds FRIA artifact', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-artifacts-'));
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'fria.md'), '# FRIA\n\nFundamental Rights Impact Assessment');
    const result = detectComplianceArtifacts(dir);
    assert.ok(result.artifacts.some((a) => a.id === 'fria'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('detectComplianceArtifacts returns empty for repo without artifacts', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-no-artifacts-'));
    const result = detectComplianceArtifacts(dir);
    assert.equal(result.artifacts.length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('summary includes articlesCovered and compliance fields', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-summary-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'ai.js'),
        "const openai = require('openai');\nfunction generate() { return openai.chat.completions.create(); }"
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.summary.articlesCovered);
    assert.ok(result.summary.articlesCovered.includes('9'));
    assert.ok(result.summary.articlesCovered.includes('27'));
    assert.ok(typeof result.summary.complianceArtifacts === 'number');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('existing high-risk rules still work (no regression)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-euai-regression-'));
    fs.mkdirSync(path.join(dir, 'server'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'server', 'hiring.js'),
        'export const hiringDecisionModel = trainClassifier(data);'
    );
    const result = await scanEuAiActPatterns(dir, { sourcePaths: ['server'] });
    assert.ok(result.summary.highRiskIndicators >= 1);
    assert.ok(result.issues.some((i) => i.metadata?.patternId === 'EUAI-HR-001'));
    fs.rmSync(dir, { recursive: true, force: true });
});
