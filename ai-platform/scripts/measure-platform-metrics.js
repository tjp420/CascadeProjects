#!/usr/bin/env node
/**
 * Print measured platform metrics for refreshing implementation-plan-sample.json.
 * Usage: node scripts/measure-platform-metrics.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const scriptsDir = path.join(root, 'web', 'scripts');

function countPageScripts() {
    return fs.readdirSync(scriptsDir).filter((name) => name.endsWith('-page.js')).length;
}

function runJestSummary() {
    try {
        const output = execSync('npm test -- --silent 2>&1', {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const suites = output.match(/Test Suites: (\d+) passed, (\d+) total/);
        const tests = output.match(/Tests:\s+(\d+) passed, (\d+) total/);
        return {
            suitesPassed: suites ? Number(suites[1]) : null,
            suitesTotal: suites ? Number(suites[2]) : null,
            testsPassed: tests ? Number(tests[1]) : null,
            testsTotal: tests ? Number(tests[2]) : null
        };
    } catch (error) {
        const output = `${error.stdout || ''}${error.stderr || ''}`;
        const tests = output.match(/Tests:\s+(\d+) passed, (\d+) total/);
        return {
            suitesPassed: null,
            suitesTotal: null,
            testsPassed: tests ? Number(tests[1]) : null,
            testsTotal: tests ? Number(tests[2]) : null,
            error: error.message
        };
    }
}

function infrastructureScore() {
    const checks = {
        phase2Auth: fs.existsSync(path.join(root, 'server/bootstrap/phase2-integration.js')),
        dockerComposePhase2: fs.existsSync(path.join(root, 'docker-compose.phase2.yml')),
        githubActionsCi: fs.existsSync(path.join(root, '..', '.github', 'workflows', 'dashboard-ci.yml')),
        ggufIssuesApi: fs.existsSync(path.join(root, 'src/api/gguf-issues-api.js')),
        schemaValidator: fs.existsSync(path.join(root, 'server/lib/mock-data-schema-validator.js')),
        singleServerEntry: !fs.existsSync(path.join(root, '..', 'gguf-dashboard-server.js')),
        productionDockerfile: fs.existsSync(path.join(root, 'Dockerfile')),
        monitoringDocs: fs.existsSync(path.join(root, 'DEPLOYMENT.md'))
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return {
        score: Math.round((passed / Object.keys(checks).length) * 100),
        checks
    };
}

const jest = runJestSummary();
const infra = infrastructureScore();

const snapshot = {
    measuredAt: new Date().toISOString(),
    dashboardPages: countPageScripts(),
    jest,
    infrastructurePercent: infra.score,
    infrastructureChecks: infra.checks
};

console.log(JSON.stringify(snapshot, null, 2));
