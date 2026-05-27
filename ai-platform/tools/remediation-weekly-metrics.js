#!/usr/bin/env node
/**
 * Weekly remediation metrics — health score, debug guard, test/coverage snapshot.
 *
 * Usage:
 *   node tools/remediation-weekly-metrics.js
 *   node tools/remediation-weekly-metrics.js --gate          # exit 1 if health < 90
 *   node tools/remediation-weekly-metrics.js --min-health=88
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { analyzeCodebase } = require('../server/lib/codebase-analyzer');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const gate = args.includes('--gate');
const minHealthArg = args.find((a) => a.startsWith('--min-health='));
const minHealth = minHealthArg ? Number(minHealthArg.split('=')[1]) : (gate ? 90 : null);
const outPath = path.join(ROOT, '.simplebeacon', 'remediation-weekly.json');

function runDebugGuard() {
    try {
        execFileSync(
            process.execPath,
            ['tools/production-debug-guard.js', '--report', '.simplebeacon/debug-artifact-guard-report.json'],
            { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }
        );
    } catch (err) {
        // guard exits 0 even with findings in non-strict mode
    }
    const reportFile = path.join(ROOT, '.simplebeacon', 'debug-artifact-guard-report.json');
    if (!fs.existsSync(reportFile)) {
        return { filesWithFindings: null, totalFindings: null, serverFindings: null };
    }
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const serverFindings = (report.findings || []).filter((f) => f.file.startsWith('server/'));
    const serverHits = serverFindings.reduce(
        (sum, f) => sum + f.hits.reduce((s, h) => s + h.count, 0),
        0
    );
    return {
        filesWithFindings: report.filesWithFindings,
        totalFindings: report.totalFindings,
        serverFilesWithFindings: serverFindings.length,
        serverFindings: serverHits
    };
}

function readCoverageSummary() {
    const summaryPath = path.join(ROOT, 'coverage', 'dashboard', 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) {
        return { available: false, linesPct: null };
    }
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const total = summary.total || {};
    return {
        available: true,
        linesPct: total.lines?.pct ?? null,
        statementsPct: total.statements?.pct ?? null
    };
}

async function main() {
    console.error('[remediation-metrics] Running codebase analyzer…');
    const codebase = await analyzeCodebase(ROOT, { includeEslint: false, inventoryProfile: 'audit' });

    console.error('[remediation-metrics] Running debug guard…');
    const debug = runDebugGuard();

    const report = {
        generatedAt: new Date().toISOString(),
        program: 'FULL_REMEDIATION_PROGRAM_2026-05-26',
        healthScore: codebase.summary.healthScore,
        findingsTotal: codebase.summary.findingsTotal,
        severityCounts: codebase.summary.severityCounts,
        analyzerCounts: codebase.summary.analyzerCounts,
        codeFilesAnalyzed: codebase.summary.codeFilesAnalyzed,
        debugGuard: debug,
        coverage: readCoverageSummary(),
        gates: {
            healthTarget: minHealth ?? 90,
            healthPass: minHealth != null ? codebase.summary.healthScore >= minHealth : null,
            highSeverityTarget: 0,
            highSeverityPass: (codebase.summary.severityCounts?.high ?? 0) === 0
        }
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify(report, null, 2));

    if (gate && codebase.summary.healthScore < (minHealth ?? 90)) {
        console.error(`[remediation-metrics] GATE FAIL: health ${codebase.summary.healthScore} < ${minHealth ?? 90}`);
        process.exit(1);
    }
    if (gate && (codebase.summary.severityCounts?.high ?? 0) > 0) {
        console.error(`[remediation-metrics] GATE FAIL: ${codebase.summary.severityCounts.high} high-severity finding(s) remain`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[remediation-metrics] failed:', err.message);
    process.exit(1);
});
