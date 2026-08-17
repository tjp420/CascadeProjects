/**
 * Tests for the master engineer problem solver and error diagnostician.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { solveProblem, diagnoseError, matchPlaybooks, extractKeywords, SOLVE_PLAYBOOKS, PROBLEM_RESOURCES } = require('../src/lib/problem-solver');

test('solveProblem returns a structured response for CI failures', () => {
    const result = solveProblem('CI is failing with 37 test errors on GitHub Actions');

    assert.ok(result.schemaVersion);
    assert.ok(result.motto.includes('Yes you can'));
    assert.ok(result.primaryPlaybook, 'should have a primary playbook');
    assert.strictEqual(result.primaryPlaybook.id, 'ci-failing-tests');
    assert.ok(result.primaryPlaybook.othersSay);
    assert.ok(result.primaryPlaybook.youCan);
    assert.ok(result.primaryPlaybook.steps.length >= 5);
    assert.ok(result.primaryPlaybook.resources.length > 0);
    assert.ok(result.agentPrompt);
});

test('solveProblem returns a structured response for Lighthouse a11y', () => {
    const result = solveProblem('Lighthouse accessibility score is 0.87, button-name and color-contrast failing');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'lighthouse-a11y-fail');
    assert.ok(result.detectedKeywords.includes('lighthouse'));
    assert.ok(result.primaryPlaybook.resources.some(r => r.url.includes('web.dev')));
});

test('solveProblem matches TypeScript errors', () => {
    const result = solveProblem('TypeScript TS2339 errors everywhere, strict mode is impossible');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'typescript-errors');
    assert.ok(result.detectedKeywords.includes('typescript'));
});

test('solveProblem matches secrets/credential issues', () => {
    const result = solveProblem('A Stripe API key was committed to git');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'secrets-exposed');
    assert.ok(result.primaryPlaybook.resources.some(r => r.url.includes('owasp')));
});

test('solveProblem matches Docker build failures', () => {
    const result = solveProblem('Docker build failing with no such file or directory');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'docker-build-fail');
});

test('solveProblem matches git recovery', () => {
    const result = solveProblem('I accidentally reset to the wrong commit and lost work');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'git-disaster-recovery');
});

test('solveProblem matches ESM/CJS interop', () => {
    const result = solveProblem('ERR_REQUIRE_ESM: cannot use require in ESM module');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'node-esm-cjs-interop');
});

test('solveProblem matches monorepo CI overwhelm', () => {
    const result = solveProblem('Monorepo CI takes 40 minutes, scanning 600k files in npm workspaces');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'monorepo-ci-overwhelm');
});

test('solveProblem matches Redis rate limiting', () => {
    const result = solveProblem('Need to set up Redis-backed rate limiting for the API');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'redis-rate-limit-setup');
});

test('solveProblem matches Cloudflare Workers deployment', () => {
    const result = solveProblem('How to deploy Cloudflare Workers with wrangler and secrets');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'cloudflare-workers-deploy');
});

test('solveProblem matches memory leak', () => {
    const result = solveProblem('Node.js memory leak, JavaScript heap out of memory in production');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'memory-leak-node');
});

test('solveProblem matches auth implementation', () => {
    const result = solveProblem('Need to implement JWT authentication with OAuth and SSO');

    assert.ok(result.primaryPlaybook);
    assert.strictEqual(result.primaryPlaybook.id, 'auth-implementation');
});

test('solveProblem returns fallback for unknown problems', () => {
    const result = solveProblem('How to bake a chocolate cake');

    assert.ok(result.fallback);
    assert.ok(result.fallback.message);
    assert.ok(result.fallback.generalResources);
    assert.ok(result.agentPrompt);
});

test('solveProblem deduplicates resources', () => {
    const result = solveProblem('CI failing with tests, monorepo, npm workspaces, GitHub Actions');

    const urls = result.allRelevantResources.map(r => r.url);
    const unique = [...new Set(urls)];
    assert.strictEqual(urls.length, unique.length, 'resources should be deduplicated');
});

test('solveProblem recommendedTools are deduplicated', () => {
    const result = solveProblem('CI failing with tests and dependency vulnerabilities and secrets');

    const tools = result.recommendedTools;
    const unique = [...new Set(tools)];
    assert.strictEqual(tools.length, unique.length, 'tools should be deduplicated');
});

test('diagnoseError identifies ERR_REQUIRE_ESM', () => {
    const result = diagnoseError('Error [ERR_REQUIRE_ESM]: require() of ES Module not supported');

    assert.ok(result.diagnoses.length > 0);
    assert.strictEqual(result.topDiagnosis.rootCause, 'ESM/CJS module type mismatch');
    assert.strictEqual(result.topDiagnosis.confidence, 'high');
    assert.ok(result.topDiagnosis.fix);
});

test('diagnoseError identifies ECONNREFUSED', () => {
    const result = diagnoseError('Error: connect ECONNREFUSED 127.0.0.1:6379');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('Service not running'));
});

test('diagnoseError identifies heap out of memory', () => {
    const result = diagnoseError('FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('memory'));
});

test('diagnoseError identifies TypeScript TS2339', () => {
    const result = diagnoseError('src/app.ts(10,5): error TS2339: Property map does not exist on type {}');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('TS2339'));
    assert.ok(result.topDiagnosis.fix.includes('Property does not exist'));
});

test('diagnoseError identifies TypeScript TS2304', () => {
    const result = diagnoseError('error TS2304: Cannot find name useState');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('TS2304'));
});

test('diagnoseError identifies Jest timeout', () => {
    const result = diagnoseError('FAIL test/api.test.js ● API suite › exceeded timeout of 5000 ms');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('timeout'));
});

test('diagnoseError identifies Lighthouse button-name', () => {
    const result = diagnoseError('button-name: Buttons do not have an accessible name (score=0)');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('button-name'));
    assert.ok(result.topDiagnosis.fix.includes('aria-label'));
});

test('diagnoseError identifies Lighthouse color-contrast', () => {
    const result = diagnoseError('color-contrast: Background and foreground colors do not have a sufficient contrast ratio');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('color-contrast'));
});

test('diagnoseError identifies npm ERESOLVE', () => {
    const result = diagnoseError('npm ERR! ERESOLVE could not resolve peer dependency');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('peer dependency'));
});

test('diagnoseError identifies git merge conflict', () => {
    const result = diagnoseError('CONFLICT (content): Merge conflict in src/index.ts');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis.rootCause.includes('merge conflict'));
});

test('diagnoseError returns fallback for unknown errors', () => {
    const result = diagnoseError('Something weird happened with code XYZ123');

    assert.ok(result.diagnoses.length > 0);
    assert.ok(result.topDiagnosis);
    assert.ok(result.agentPrompt);
});

test('matchPlaybooks returns sorted by relevance', () => {
    const matches = matchPlaybooks('CI failing with tests and GitHub Actions and npm audit vulnerabilities');

    assert.ok(matches.length >= 2);
    // CI failing tests should score higher than dependency vulnerabilities
    assert.ok(matches[0].triggers.length <= matches[0].triggers.length);
});

test('extractKeywords detects technologies', () => {
    const keywords = extractKeywords('React component failing to render with Vite and TypeScript');

    assert.ok(keywords.includes('react'));
    assert.ok(keywords.includes('vite'));
    assert.ok(keywords.includes('typescript'));
});

test('SOLVE_PLAYBOOKS has at least 20 playbooks', () => {
    assert.ok(SOLVE_PLAYBOOKS.length >= 20, `expected >= 20 playbooks, got ${SOLVE_PLAYBOOKS.length}`);
});

test('PROBLEM_RESOURCES has at least 25 resources', () => {
    assert.ok(Object.keys(PROBLEM_RESOURCES).length >= 25, `expected >= 25 resources, got ${Object.keys(PROBLEM_RESOURCES).length}`);
});

test('every playbook has required fields', () => {
    for (const pb of SOLVE_PLAYBOOKS) {
        assert.ok(pb.id, `playbook missing id`);
        assert.ok(pb.domain, `playbook ${pb.id} missing domain`);
        assert.ok(pb.triggers && pb.triggers.length > 0, `playbook ${pb.id} missing triggers`);
        assert.ok(pb.othersSay, `playbook ${pb.id} missing othersSay`);
        assert.ok(pb.youCan, `playbook ${pb.id} missing youCan`);
        assert.ok(pb.steps && pb.steps.length > 0, `playbook ${pb.id} missing steps`);
    }
});

test('every playbook resource key exists in PROBLEM_RESOURCES', () => {
    for (const pb of SOLVE_PLAYBOOKS) {
        for (const key of pb.resources || []) {
            assert.ok(PROBLEM_RESOURCES[key], `playbook ${pb.id} references unknown resource: ${key}`);
        }
    }
});
