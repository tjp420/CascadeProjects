#!/usr/bin/env node
/**
 * Consolidate machine-readable quality metrics for dashboard/trend consumption.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function readJsonSafe(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return null;
    try {
        return JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch {
        return null;
    }
}

function buildMetrics() {
    const report = readJsonSafe('.simplebeacon/report.json');
    const assessment = readJsonSafe('.simplebeacon/assessment.json');
    const complianceMonitoring = readJsonSafe('.simplebeacon/compliance-monitoring.json');
    const fictionGuard = readJsonSafe('.simplebeacon/fiction-kpi-guard-report.json');
    const extendedSchema = readJsonSafe('.simplebeacon/extended-schema-coverage.json');
    const jestEvidence = readJsonSafe('.simplebeacon/jest-quality-evidence.json');
    const debugGuard = readJsonSafe('.simplebeacon/debug-artifact-guard-report.json');
    const oversized = readJsonSafe('.simplebeacon/oversized-files-report.json');

    return {
        generatedAt: new Date().toISOString(),
        source: 'quality-maintenance-metrics',
        gate: {
            pass: report?.gate?.pass ?? null,
            blockingCount: report?.gate?.blockingCount ?? null,
            warningCount: report?.gate?.warningCount ?? null,
            issueCount: report?.issueCount ?? null,
            severityCounts: report?.severityCounts || null
        },
        quality: {
            qualityScore: report?.qualityScore ?? null,
            schemaChecked: report?.schemaChecked ?? null,
            schemaPassed: report?.schemaPassed ?? null,
            schemaCompliance: report?.schemaCompliance ?? null,
            consistencyChecked: report?.consistencyChecked ?? null,
            consistencyPassed: report?.consistencyPassed ?? null,
            consistencyScore: report?.consistencyScore ?? null
        },
        coverage: {
            pageSampleSchemaChecked: report?.pageSampleSchemaChecked ?? null,
            pageSampleSchemaPassed: report?.pageSampleSchemaPassed ?? null,
            combinedSchemaChecked: (report?.schemaChecked ?? 0) + (extendedSchema?.targetsChecked ?? 0),
            combinedSchemaPassed: (report?.schemaPassed ?? 0) + (extendedSchema?.ok ?? 0),
            extendedTargetsChecked: extendedSchema?.targetsChecked ?? null,
            extendedTargetsPassRate: extendedSchema?.passRate ?? null,
            extendedTargetsOk: extendedSchema?.ok ?? null
        },
        fictionGuard: {
            filesScanned: fictionGuard?.filesScanned ?? null,
            filesWithFindings: fictionGuard?.filesWithFindings ?? null,
            totalFindings: fictionGuard?.totalFindings ?? null
        },
        debugArtifacts: {
            filesScanned: debugGuard?.filesScanned ?? null,
            filesWithFindings: debugGuard?.filesWithFindings ?? null,
            totalFindings: debugGuard?.totalFindings ?? null
        },
        oversized: {
            oversizedCount: oversized?.oversizedCount ?? null,
            totalOversizedMB: oversized?.savings?.totalMB ?? null,
            actionableOversizedCount: oversized?.actionableOversizedCount ?? null,
            actionableRecoverableMB: oversized?.actionableSavings?.estimatedRecoverableMB ?? null
        },
        assessment: {
            gateResult: assessment?.executiveSummary?.gateResult ?? null,
            complianceScore: assessment?.executiveSummary?.complianceScore ?? null,
            headline: assessment?.executiveSummary?.headline ?? null
        },
        jest: {
            hasEvidence: Boolean(jestEvidence),
            success: jestEvidence?.success ?? null,
            totalTests: jestEvidence?.numTotalTests ?? null,
            passedTests: jestEvidence?.numPassedTests ?? null,
            failedTests: jestEvidence?.numFailedTests ?? null,
            totalSuites: jestEvidence?.numTotalTestSuites ?? null,
            passedSuites: jestEvidence?.numPassedTestSuites ?? null,
            failedSuites: jestEvidence?.numFailedTestSuites ?? null
        },
        complianceMonitoring: complianceMonitoring || null
    };
}

function main() {
    const metrics = buildMetrics();
    const outPath = path.join(ROOT, '.simplebeacon', 'quality-maintenance-metrics.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
    console.log(`[quality-maintenance-metrics] wrote ${outPath}`);
}

main();
