/**
 * Append trust publish + fiction scope lines to GITHUB_STEP_SUMMARY (or stdout).
 * Usage: node tools/append-trust-step-summary.js [platformRoot]
 */

const fs = require('fs');
const path = require('path');

const platformRoot = path.resolve(process.argv[2] || process.cwd());
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

function append(line) {
    const text = String(line);
    if (summaryPath) {
        fs.appendFileSync(summaryPath, `${text}\n`);
        return;
    }
    console.log(text);
}

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function main() {
    append('### Trust publish');

    const env = readJsonIfExists(path.join(platformRoot, '.simplebeacon', 'trust-publish-env-validation.json'));
    if (env) {
        append(`- Env validation ready: ${env.ready}`);
        append(`- Endpoint configured: ${env.endpointConfigured}`);
        append(`- Token configured: ${env.tokenConfigured}`);
        append(`- Endpoint: ${env.endpointRedacted || 'n/a'}`);
        if (Array.isArray(env.warnings) && env.warnings.length) {
            append(`- Warnings: ${env.warnings.join(' | ')}`);
        }
    } else {
        append('- Env validation artifact missing');
    }

    const audit = readJsonIfExists(path.join(platformRoot, '.simplebeacon', 'trust-publish-audit.json'));
    if (audit) {
        append(`- Publish status: ${audit.remote?.status || 'unknown'}`);
        if (audit.remote?.reason) append(`- Publish reason: ${audit.remote.reason}`);
        if (audit.remote?.message) append(`- Publish error: ${audit.remote.message}`);
        append(`- Verification ID: ${audit.verificationId || 'n/a'}`);
    } else {
        append('- Publish audit artifact missing');
    }

    const trust = readJsonIfExists(path.join(platformRoot, 'public', 'trust-verification.json'));
    const fiction = trust?.fictionScope;
    if (fiction) {
        append('');
        append('### Fiction / KPI scope (published)');
        append(`- Mode: ${fiction.mode || 'repository-json'}`);
        append(`- JSON pattern-checked: ${fiction.fictionJsonFilesScanned ?? '—'}`);
        append(`- Mock JSON among them: ${fiction.fictionSampleFilesScanned ?? '—'}`);
        append(`- Walk root: ${fiction.walkRoot || 'ai-platform'}`);
    }

    const platformReport = readJsonIfExists(path.join(platformRoot, '.simplebeacon', 'report.json'));
    const monorepoReport = readJsonIfExists(path.join(platformRoot, '..', '.simplebeacon', 'report.json'));
    if (platformReport || monorepoReport) {
        append('');
        append('### Scan reports on disk');
        if (platformReport) {
            append(`- Platform: gate ${platformReport.gate?.pass ? 'PASS' : 'REVIEW'}, fiction JSON ${platformReport.fictionJsonFilesScanned ?? '—'}, ${platformReport.generatedAt || '—'}`);
        }
        if (monorepoReport) {
            append(`- Monorepo: gate ${monorepoReport.gate?.pass ? 'PASS' : 'REVIEW'}, fiction JSON ${monorepoReport.fictionJsonFilesScanned ?? '—'}, ${monorepoReport.generatedAt || '—'}`);
        }
    }
}

main();
