const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanTextContent } = require('../src/lib/credential-pattern-scanner');
const { scanFileContent, globMatch } = require('../src/rules/production-leak');
const { classifyProductionLeakMatch } = require('../src/lib/production-leak-intent');
const { parseJestSummary, checkJestBaseline } = require('../src/rules/jest-baseline');
const { formatGithubComment } = require('../src/reporters/github-comment');
const { evaluateGate } = require('../src/gate');
const { formatTextReport, colorEnabled } = require('../src/reporters/text');

function leakFindings(relativePath, content, options) {
    return scanFileContent(relativePath, content, options).findings;
}

test('production-leak ignores scanner meta modules with audit exclusion catalogs', () => {
    const content = [
        "const SAMPLE_DATA_PREFIX = ['web', 'data'].join('/') + '/';",
        "const SAMPLE_JSON_SUFFIX = ['-', 'sample', '.json'].join('');",
        "return rel.endsWith(SAMPLE_JSON_SUFFIX);"
    ].join('\n');
    const findings = leakFindings('server/lib/codebase-analyzer.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak detects sample json reference', () => {
    const content = "const data = require('../web/data/users-sample.json');";
    const findings = leakFindings('server/routes/users.js', content);
    assert.ok(findings.length > 0);
    assert.equal(findings[0].type, 'Production Leak');
    assert.equal(findings[0].severityBand, 'critical');
    assert.equal(findings[0].line, 1);
    assert.equal(findings[0].pattern, 'sample-json');
    assert.ok(findings[0].recommendation);
});

test('production-leak skips comment lines', () => {
    const content = "// const x = require('./foo-sample.json');";
    const findings = leakFindings('server/routes/users.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak ignores dev-tools page-spec metadata descriptions', () => {
    const content = 'description: `Validates ${label} registered dashboard page-spec JSON files`';
    const findings = leakFindings('server/lib/dev-tools-workflows.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak ignores cross-line template-sample false positives in roadmap generator', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../../server/lib/code-roadmap-generator.cjs');
    const content = fs.readFileSync(filePath, 'utf8');
    const result = scanFileContent('server/lib/code-roadmap-generator.cjs', content);
    assert.equal(result.findings.length, 0);
});

test('production-leak detects single-line template literal mock paths', () => {
    const content = 'const p = `./fixtures/mock/users.json`;';
    const findings = leakFindings('src/load.js', content);
    assert.ok(findings.some((f) => f.metadata.patternId === 'template-sample'));
});

test('production-leak ignores generic template json paths', () => {
    const content = 'const p = `./config/app-settings.json`;';
    const findings = leakFindings('src/load.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak ignores mock/sample prose in template literals', () => {
    const content = 'const msg = `Scope: mock/sample JSON files only — not a path`;';
    const findings = leakFindings('server/services/cloud-inference-service.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak ignores instructional template-sample wording', () => {
    const content = 'const msg = `Use the phrase "sample-suffix subset" instead of "template-sample".`;';
    const findings = leakFindings('server/services/cloud-inference-service.js', content);
    assert.equal(findings.length, 0);
});

test('production-leak suppresses audit sample filename catalog entries', () => {
    const content = [
        'const AUDIT_SAMPLE_FILES = {',
        "  fictionPatterns: 'fictional-patterns-sample.json',",
        "  qualityMetrics: 'ai-quality-metrics-sample.json'",
        '};'
    ].join('\n');
    const result = scanFileContent('src/api/simplebeacon-api.js', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 2);
});

test('production-leak suppresses sampleDir config preset references', () => {
    const content = "sampleDir: 'web/data',";
    const result = scanFileContent('src/api/simplebeacon-api.js', content);
    assert.equal(result.findings.length, 0);
    assert.equal(result.suppressed.length, 1);
    assert.equal(result.suppressed[0].intent, 'config-metadata');
});

test('production-leak suppresses snapshot seed catalog entries', () => {
    const content = "{ key: 'settings-overview', file: 'settings-sample.json', pick: (s) => s.overview },";
    const result = scanFileContent('server/lib/snapshot-seeds.js', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 1);
});

test('production-leak suppresses platform reports bundle seed registry loaders', () => {
    const content = [
        'const SNAPSHOT_SEEDS = [',
        "  { key: 'platform-metrics', file: 'platform-metrics-sample.json' },",
        "  { key: 'eng-baseline', file: 'engineering-baseline-sample.json' },",
        '];',
        "const sampleDir = path.join(__dirname, 'web', 'data');"
    ].join('\n');
    const result = scanFileContent('server/lib/platform-reports-export-bundle.js', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 2);
});

test('production-leak suppresses docs archive finance model sample citations', () => {
    const content = [
        '{',
        '  "sources": {',
        '    "platform_metrics": [',
        '      "web/data/analytics-sample.json",',
        '      "web/data/engineering-baseline-sample.json"',
        '    ]',
        '  }',
        '}'
    ].join('\n');
    const result = scanFileContent('docs/archive/historical/ai-problem-analyzer-finance-model.json', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 2);
});

test('production-leak suppresses docs codemap dashboard artifact catalog', () => {
    const content = '    { "path": "web/data/cascade-roadmap-sample.json", "section": "Development Roadmap" },';
    const result = scanFileContent('docs/codemap/future-projections-roadmap.json', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 1);
});

test('production-leak suppresses docs archive fixture path prose in historical logs', () => {
    const content = '    "Error improving structure in C:\\\\repo\\\\tests\\\\fixtures\\\\__init__.py: example",';
    const result = scanFileContent('docs/archive/historical/quality_achievement_report.json', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 1);
});

test('production-leak suppresses stub-api canonical ai-roadmap loader', () => {
    const content = [
        "const filePath = path.join(platformRoot, ...AI_ROADMAP_DATA_REL.split('/'));",
        "const content = await fs.readFile(filePath, 'utf8');"
    ].join('\n');
    const result = scanFileContent('src/api/dashboard-stub-api.js', content);
    assert.equal(result.findings.length, 0);
});

test('production-leak suppresses stub-api path.join sample loaders', () => {
    const content = [
        "const filePath = path.join(webRoot, 'data', 'performance-sample.json');",
        "const content = await fs.readFile(filePath, 'utf8');"
    ].join('\n');
    const result = scanFileContent('src/api/dashboard-stub-api.js', content);
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.length >= 1);
    assert.equal(result.suppressed[0].intent, 'repository-audit-stub-loader');
});

test('classifyProductionLeakMatch flags runtime require loads', () => {
    const content = "const data = require('./web/data/users-sample.json');";
    const result = classifyProductionLeakMatch({
        relativePath: 'server/routes/users.js',
        content,
        lineIndex: 0,
        matchText: "'./web/data/users-sample.json'",
        patternId: 'sample-json'
    });
    assert.equal(result.intent, 'accidental-leak');
    assert.equal(result.suppress, false);
});

test('production-leak suppresses eu-ai-act export sanitizer fiction KPI export note prose', () => {
    const content = [
        'function buildSprintArtifactExportNotes(sprint = {}, options = {}) {',
        '  exportSanitized: true,',
        '  notes.push(',
        '    `Sprint fiction KPI rules evaluated ${Number(sprintFiction).toLocaleString()} repository JSON path(s) — Complete scan gate evaluated ${Number(gateFiction).toLocaleString()} with ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`',
        '  );',
        '}'
    ].join('\n');
    const result = classifyProductionLeakMatch({
        relativePath: 'server/lib/eu-ai-act-export.js',
        content,
        lineIndex: 3,
        matchText: '`*-sample.json`',
        patternId: 'template-sample'
    });
    assert.equal(result.intent, 'scanner-meta');
    assert.equal(result.suppress, true);
});

test('production-leak suppresses MCP rule-catalog pattern metadata', () => {
    const content = [
        "const PRODUCTION_LEAK_SUMMARIES = {",
        "    'web-data-sample': 'String literal references web/data sample fixture path',",
        "    'template-sample': 'String literal references template sample data'",
        '};'
    ].join('\n');
    const result = classifyProductionLeakMatch({
        relativePath: 'src/mcp/rule-catalog.js',
        content,
        lineIndex: 1,
        matchText: "'web-data-sample'",
        patternId: 'web-data-sample'
    });
    assert.equal(result.intent, 'scanner-meta');
    assert.equal(result.suppress, true);
});

test('production-leak suppresses scanner scan.js PAGE_SAMPLE_SPECS references', () => {
    const content = [
        "const { PAGE_SAMPLE_SPECS } = require('./lib/page-sample-specs');",
        "if (file.name.endsWith('-sample.json') && PAGE_SAMPLE_SPECS[file.name]) {",
        "    applyPageSampleValidation({ fileName: file.name });",
        '}'
    ].join('\n');
    const result = classifyProductionLeakMatch({
        relativePath: 'src/scan.js',
        content,
        lineIndex: 1,
        matchText: "'-sample.json'",
        patternId: 'sample-json'
    });
    assert.equal(result.intent, 'scanner-meta');
    assert.equal(result.suppress, true);
});

test('production-leak suppresses demo tool paths for -sample.json imports', () => {
    const content = 'import addressSample from "./address-sample.json";';
    const result = scanFileContent('src/applets/tools/jsonata-tool/jsonata-tool.ts', content);
    assert.equal(result.findings.length, 0);
    assert.equal(result.suppressed[0].intent, 'demo-tool-sample');
});

test('production-leak suppresses example route plain sample.json imports', () => {
    const content = "import sample from './sample.json';";
    const result = scanFileContent('src/app/example/example.component.ts', content, { plainSampleJson: true });
    assert.equal(result.findings.length, 0);
    assert.ok(result.suppressed.some((row) => row.intent === 'demo-tool-sample'));
});

test('production-leak detects plain sample.json when plainSampleJson enabled', () => {
    const content = 'import SampleJsonFile from "../assets/sample.json?raw";';
    const findings = leakFindings('src/hooks/use-jsonpath.ts', content, { plainSampleJson: true });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].pattern, 'plain-sample-json');
    assert.equal(findings[0].metadata.intent, 'accidental-leak');
});

test('production-leak ignores plain sample.json unless plainSampleJson enabled', () => {
    const content = "import sample from './sample.json';";
    const findings = leakFindings('src/hooks/use-jsonpath.ts', content);
    assert.equal(findings.length, 0);
});

test('globMatch supports tsx test file patterns', () => {
    assert.equal(globMatch('src/components/voice/index.test.tsx', '**/*.test.tsx'), true);
    assert.equal(globMatch('src/components/voice/index.tsx', '**/*.test.tsx'), false);
});

test('globMatch supports node_modules ignore', () => {
    assert.equal(globMatch('node_modules/foo/index.js', 'node_modules/**'), true);
    assert.equal(globMatch('server/routes/users.js', 'node_modules/**'), false);
});

test('globMatch supports test file patterns', () => {
    assert.equal(globMatch('tests/unit/foo.test.js', '**/*.test.js'), true);
    assert.equal(globMatch('server/routes/users.js', '**/*.test.js'), false);
});

test('credential scanner detects AWS key and allows demo placeholder', () => {
    const real = scanTextContent('secrets.json', '{"key":"AKIA1A2B3C4D5E6F7G8H"}');
    assert.ok(real.length > 0);
    assert.equal(real[0].severityBand, 'critical');
    assert.equal(real[0].line, 1);
    assert.equal(real[0].pattern, 'aws-access-key');
    assert.ok(real[0].recommendation);
    const demo = scanTextContent('auth.json', '{"password":"demo123","email":"dev@simplebeacon.ai"}');
    assert.equal(demo.length, 0);
});

test('credential scanner detects JWT pattern', () => {
    const token = 'eyJzzzzzzzzzzzzzzzz.eyJyyyyyyyyyyyyyyyyy.zzzzzzzzzzzzzzzzzzzz';
    const findings = scanTextContent('token.txt', token);
    assert.ok(findings.some((f) => f.metadata.patternId === 'jwt-token'));
});

test('parseJestSummary extracts pass counts', () => {
    const output = `
Test Suites: 27 passed, 27 total
Tests:       578 passed, 578 total
`;
    const summary = parseJestSummary(output);
    assert.equal(summary.testsPassed, 578);
    assert.equal(summary.suitesPassed, 27);
});

test('formatGithubComment includes gate and severities', () => {
    const body = formatGithubComment({
        qualityScore: 99,
        severityCounts: { high: 0, medium: 1, low: 0 },
        rawIssues: [{ severity: 'medium', type: 'Test', description: 'example' }]
    }, { pass: true });
    assert.match(body, /Simplebeacon/);
    assert.match(body, /PASS/);
});

test('evaluateGate fails on configured severities', () => {
    const report = {
        rawIssues: [{ severity: 'high', type: 'Credential Pattern', count: 1 }]
    };
    const result = evaluateGate(report, { failOn: ['high'], warnOn: ['medium'] });
    assert.equal(result.pass, false);
    assert.equal(result.blockingIssues.length, 1);
});

test('evaluateGate supports severityBand escalation', () => {
    const report = {
        rawIssues: [{ severity: 'high', severityBand: 'critical', type: 'Credential Pattern', count: 1 }]
    };
    const result = evaluateGate(report, { failOn: ['critical'], warnOn: ['high', 'medium'] });
    assert.equal(result.pass, false);
    assert.equal(result.blockingIssues.length, 1);
});

test('formatTextReport renders without color when NO_COLOR set', () => {
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    const text = formatTextReport({ projectRoot: '/tmp', totalFiles: 0, qualityScore: 100, rawIssues: [] }, { pass: true });
    assert.match(text, /No issues detected/);
    assert.equal(colorEnabled(), false);
    if (prev == null) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
});

test('checkJestBaseline validates cached jest-result.json when runTests is false', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-jest-cache-'));
    const sbDir = path.join(tmp, '.simplebeacon');
    fs.mkdirSync(sbDir, { recursive: true });
    fs.writeFileSync(path.join(sbDir, 'jest-result.json'), `${JSON.stringify({
        summary: {
            testsPassed: 991,
            testsTotal: 991,
            testsFailed: 0,
            suitesPassed: 72,
            suitesTotal: 72
        },
        exitCode: 0
    })}\n`, 'utf8');

    const result = await checkJestBaseline(tmp, {
        baseline: { jestTestsPassing: 991, jestTestsLabel: '991/991', jestSuites: 72 },
        runTests: false
    });
    assert.equal(result.checked, true);
    assert.equal(result.fromCache, true);
    assert.equal(result.passed, true);
    assert.equal(result.summary?.testsPassed, 991);
    assert.equal(result.issues.length, 0);
});
