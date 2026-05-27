#!/usr/bin/env node
/**
 * Non-blocking extended schema-coverage check.
 * Validates JSON docs/runbook payloads with basic structural checks to increase
 * measurable schema coverage without impacting the primary gate.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const TARGETS = [
    { relPath: '.simplebeacon/config.json', requiredKeys: ['profile', 'scanPaths', 'rules', 'gate'] },
    { relPath: '.simplebeacon/baseline.json', requiredKeys: ['dataSource', 'rejectedFiction'] },
    { relPath: '.simplebeacon/compliance-result.json', requiredKeys: ['summary', 'rules'] },
    { relPath: '.simplebeacon/assessment.json', requiredKeys: ['executiveSummary', 'complianceChecklist'] },
    { relPath: '.simplebeacon/report.json', requiredKeys: ['gate', 'scanScope', 'severityCounts'] },
    { relPath: '.simplebeacon/compliance-monitoring.json', requiredKeys: ['gate', 'issueCount', 'severityCounts'] },
    { relPath: 'data/roadmap/ai-roadmap-report.json', requiredKeys: ['projectOverview', 'developmentPhases'] },
    { relPath: 'web/data/mock-analysis-sample.json', requiredKeys: ['type', 'analysisOverview'] },
    { relPath: 'web/data/cascade-roadmap-sample.json', requiredKeys: ['roadmap', 'dataSource'] },
    { relPath: 'web/data/master-roadmap-sample.json', requiredKeys: ['overview', 'sources'] },
    { relPath: 'web/data/engineering-baseline-sample.json', requiredKeys: ['overview', 'releaseMilestones'] },
    { relPath: 'web/data/data-maintenance-analyzers-sample.json', requiredKeys: ['overview', 'analyzerRoadmap'] },
    { relPath: 'web/data/roadmap-comparison-sample.json', requiredKeys: ['ggufReport', 'aiReport', 'differences'] },
    { relPath: 'web/data/simplebeacon-cli-sample.json', requiredKeys: ['overview', 'items', 'commands', 'rules'] },
    { relPath: 'web/data/ai-quality-metrics-sample.json', requiredKeys: ['currentScore', 'metrics'] },
    { relPath: 'web/data/baseline-comparison-sample.json', requiredKeys: ['baselineType', 'comparisons'] },
    { relPath: 'web/data/ai-adoption-trends-sample.json', requiredKeys: ['trends'] }
];

function getAtPath(obj, dottedPath) {
    return dottedPath.split('.').reduce((node, part) => (node == null ? undefined : node[part]), obj);
}

function validateTarget(target) {
    const abs = path.join(ROOT, target.relPath);
    if (!fs.existsSync(abs)) {
        return { path: target.relPath, status: 'missing', errors: ['file missing'] };
    }

    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (error) {
        return { path: target.relPath, status: 'invalid-json', errors: [error.message] };
    }

    const errors = [];
    for (const key of target.requiredKeys || []) {
        if (key.includes('.')) {
            if (getAtPath(payload, key) == null) errors.push(`missing key: ${key}`);
        } else if (!(key in payload)) {
            errors.push(`missing key: ${key}`);
        }
    }

    return {
        path: target.relPath,
        status: errors.length ? 'schema-miss' : 'ok',
        errors
    };
}

function main() {
    const results = TARGETS.map(validateTarget);
    const ok = results.filter((r) => r.status === 'ok').length;
    const missing = results.filter((r) => r.status === 'missing').length;
    const invalid = results.filter((r) => r.status === 'invalid-json').length;
    const schemaMiss = results.filter((r) => r.status === 'schema-miss').length;

    const out = {
        generatedAt: new Date().toISOString(),
        targetsChecked: TARGETS.length,
        ok,
        missing,
        invalidJson: invalid,
        schemaMiss,
        passRate: TARGETS.length ? Math.round((ok / TARGETS.length) * 100) : null,
        results
    };

    const outPath = path.join(ROOT, '.simplebeacon', 'extended-schema-coverage.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log(`[extended-schema-coverage] checked=${out.targetsChecked} ok=${ok} missing=${missing} invalid=${invalid} schemaMiss=${schemaMiss}`);
}

main();
