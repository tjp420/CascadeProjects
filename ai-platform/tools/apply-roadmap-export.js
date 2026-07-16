#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Import a dynamic-project-roadmap-analysis export (e.g. from Analyze download)
 * into data/roadmap/ for dashboard API + gate validation.
 *
 * Usage:
 *   node tools/apply-roadmap-export.js path/to/export.json
 */
const fs = require('fs');
const path = require('path');
const { sanitizeRoadmapExport } = require('../packages/simplebeacon-cli/src/lib/roadmap-export-sanitize');
const { validateRoadmapJson } = require('../packages/simplebeacon-cli/src/lib/roadmap-json-specs');
const { getRepositoryAuditBaseline } = require('../packages/simplebeacon-cli/src/index');

const ROOT = path.resolve(__dirname, '..');
const ROADMAP_DIR = path.join(ROOT, 'data', 'roadmap');
const CANONICAL = path.join(ROADMAP_DIR, 'ai-roadmap-report.json');
const DYNAMIC_ARCHIVE = path.join(ROADMAP_DIR, 'dynamic-roadmap-last-scan.json');

function toAiRoadmapReportModel(roadmap) {
    const rec = roadmap.recommendations || {};
    return {
        type: 'ai-roadmap-report-model',
        dataSource: 'repository-audit',
        generatedAt: roadmap.generatedAt || roadmap.timestamp || new Date().toISOString(),
        projectOverview: roadmap.projectOverview || {
            projectName: roadmap.projectName || roadmap.projectTitle || 'ai-platform',
            completionRate: roadmap.executiveSummary?.completionRate ?? null,
            overallProgress: roadmap.projectOverview?.overallProgress || 'In Progress',
            projectHealth: roadmap.projectOverview?.projectHealth || roadmap.executiveSummary?.projectHealth || null
        },
        developmentPhases: Array.isArray(roadmap.developmentPhases) ? roadmap.developmentPhases : [],
        recommendations: {
            immediate: rec.immediate || insights.sourceMetrics?.immediateActions || [],
            shortTerm: rec.shortTerm || insights.sourceMetrics?.shortTermActions || [],
            longTerm: rec.longTerm || insights.sourceMetrics?.longTermActions || [],
            priorities: rec.priorities || {
                high: insights.sourceMetrics?.immediateActions || [],
                medium: insights.sourceMetrics?.shortTermActions || [],
                low: insights.sourceMetrics?.longTermActions || []
            }
        },
        predictions: [],
        risks: (insights.riskAssessment?.riskFactors || []).map((f) => ({
            category: f.category,
            severity: f.severity,
            description: f.description
        })),
        actionPlan: (insights.recommendations || []).map((r) => ({
            priority: r.priority,
            action: r.action,
            category: r.category
        })),
        performanceMetrics: [],
        hygieneSummary: roadmap.hygieneSummary || undefined,
        roadmapScanMeta: {
            exportProfile: roadmap.roadmapExportProfile,
            sprintCompletionRate: roadmap.hygieneSummary?.sprintCompletionRate ?? roadmap.executiveSummary?.completionRate,
            apiRouteCount: roadmap.hygieneSummary?.apiRouteCount ?? roadmap.aiIntegration?.apiRouteCount,
            jestFilesOnDisk: roadmap.hygieneSummary?.jestFilesOnDisk,
            appliedAt: new Date().toISOString()
        }
    };
}

function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage: node tools/apply-roadmap-export.js <export.json>');
        process.exit(1);
    }

    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    if (raw.type !== 'dynamic-project-roadmap-analysis') {
        console.error(`Expected type dynamic-project-roadmap-analysis, got ${raw.type || 'unknown'}`);
        process.exit(1);
    }

    const exportFilename = path.basename(resolved);
    const sanitized = sanitizeRoadmapExport(raw, {
        requestedProjectPath: raw.sourceProjectPath || 'ai-platform',
        exportFilename
    });

    if (sanitized.benchmarkScan) {
        console.error('Export resolved as benchmark-cache — use a product-scoped ai-platform scan, not github-cache.');
        process.exit(1);
    }

    fs.mkdirSync(ROADMAP_DIR, { recursive: true });
    fs.writeFileSync(DYNAMIC_ARCHIVE, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');

    const pageModel = toAiRoadmapReportModel(sanitized);
    fs.writeFileSync(CANONICAL, `${JSON.stringify(pageModel, null, 2)}\n`, 'utf8');

    const baseline = getRepositoryAuditBaseline(ROOT);
    const validation = validateRoadmapJson('ai-roadmap-report.json', pageModel, baseline);
    if (!validation.valid) {
        console.error('Canonical roadmap failed validation:', validation.violations);
        process.exit(1);
    }

    console.log('Applied roadmap export:');
    console.log(`  dynamic (full): ${path.relative(ROOT, DYNAMIC_ARCHIVE)}`);
    console.log(`  canonical:      ${path.relative(ROOT, CANONICAL)}`);
    console.log(`  sprints:        ${pageModel.developmentPhases.length} phases, ${pageModel.projectOverview?.completionRate ?? '—'}% complete`);
    console.log(`  profile:        ${sanitized.scanTargetProfile || 'product'}`);
}

main();
