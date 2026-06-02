/**
 * Stub API routes for dashboard components that expect backend endpoints.
 * Serves sample data until live implementations exist.
 * simplebeacon:production-leak-intent: sample-data-reference - This is a stub API that serves legitimate sample data files for dashboard development until live backend implementations exist
 */

const path = require('path');
const _fsSync = require('fs');
const fs = require('fs').promises;
const { runNpmAudit } = require('../../server/lib/npm-audit-runner.cjs');
const { saveConsolidationReport } = require('../../server/lib/repository-health-payload.cjs');
const { scanFileMergerReduction } = require('../../server/lib/file-merger-reduction-scanner.cjs');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath
} = require('../../server/lib/path-safety.cjs');
const { buildCoverageReportsModel } = require('../../server/lib/coverage-reports-builder.cjs');
const { buildAnalyticsModel } = require('../../server/lib/analytics-builder.cjs');
const { mergeIstanbulTelemetry } = require('../../server/lib/istanbul-telemetry-merge.cjs');
const { buildSecurityDashboardModel } = require('../../server/lib/security-dashboard-builder.cjs');
const { buildDashboardHomeModel } = require('../../server/lib/dashboard-home-builder.cjs');
/** Canonical ai-roadmap data file (maps from ai-roadmap-sample.json page alias). */
const AI_ROADMAP_DATA_REL = 'data/roadmap/ai-roadmap-report.json';

let performanceSample = null;
let devToolsSample = null;
let apiSample = null;
let mergerToolSample = null;
let debtCalculatorSample = null;
let debtReductionSample = null;
let debtAnalyticsSample = null;
let featureBacklogSample = null;
let releaseTimelineSample = null;
let billingSystemSample = null;
let projectReportsSample = null;
let assetsLibrarySample = null;
let codeTemplatesSample = null;
let coverageReportsRawSample = null;
let settingsSample = null;
let helpSample = null;
let implementationPlanSample = null;
let analyticsSample = null;
let dashboardHomeRawSample = null;
let dashboardHomeRawSampleMtimeMs = null;
let qualityDashboardSample = null;
let securityDashboardRawSample = null;
let supportDashboardSample = null;
let aiAnalysisSample = null;
let aiToolsSample = null;
let databaseSample = null;
let codeGenerationSample = null;
let reportsSample = null;
let issueResolutionSample = null;
let aiRoadmapSample = null;

async function loadPerformanceSample(webRoot) {
    if (performanceSample) return performanceSample;
    try {
        // simplebeacon:production-leak-intent: sample-json - Legitimate sample data reference for dashboard stub functionality
        const filePath = path.join(webRoot, 'data', 'performance-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        performanceSample = mergeIstanbulTelemetry(
            JSON.parse(content),
            path.join(webRoot, '..')
        );
    } catch {
        performanceSample = {};
    }
    return performanceSample;
}

async function loadDevToolsSample(webRoot) {
    if (devToolsSample) return devToolsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'dev-tools-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        devToolsSample = JSON.parse(content);
    } catch {
        devToolsSample = {};
    }
    return devToolsSample;
}

async function loadAPISample(webRoot) {
    if (apiSample) return apiSample;
    try {
        const filePath = path.join(webRoot, 'data', 'api-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        apiSample = JSON.parse(content);
    } catch {
        apiSample = {};
    }
    return apiSample;
}

async function loadMergerToolSample(webRoot) {
    if (mergerToolSample) return mergerToolSample;
    try {
        const filePath = path.join(webRoot, 'data', 'merger-tool-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        mergerToolSample = JSON.parse(content);
    } catch {
        mergerToolSample = {};
    }
    return mergerToolSample;
}

async function loadDebtReductionSample(webRoot) {
    if (debtReductionSample) return debtReductionSample;
    try {
        const filePath = path.join(webRoot, 'data', 'debt-reduction-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        debtReductionSample = JSON.parse(content);
    } catch {
        debtReductionSample = {};
    }
    return debtReductionSample;
}

async function loadDebtAnalyticsSample(webRoot) {
    if (debtAnalyticsSample) return debtAnalyticsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'debt-analytics-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        debtAnalyticsSample = JSON.parse(content);
    } catch {
        debtAnalyticsSample = {};
    }
    return debtAnalyticsSample;
}

async function loadFeatureBacklogSample(webRoot) {
    if (featureBacklogSample) return featureBacklogSample;
    try {
        const filePath = path.join(webRoot, 'data', 'feature-backlog-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        featureBacklogSample = JSON.parse(content);
    } catch {
        featureBacklogSample = {};
    }
    return featureBacklogSample;
}

async function loadReleaseTimelineSample(webRoot) {
    if (releaseTimelineSample) return releaseTimelineSample;
    try {
        const filePath = path.join(webRoot, 'data', 'release-timeline-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        releaseTimelineSample = JSON.parse(content);
    } catch {
        releaseTimelineSample = {};
    }
    return releaseTimelineSample;
}

async function loadBillingSystemSample(webRoot) {
    if (billingSystemSample) return billingSystemSample;
    try {
        const filePath = path.join(webRoot, 'data', 'billing-system-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        billingSystemSample = JSON.parse(content);
    } catch {
        billingSystemSample = {};
    }
    return billingSystemSample;
}

async function loadProjectReportsSample(webRoot) {
    if (projectReportsSample) return projectReportsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'project-reports-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        projectReportsSample = JSON.parse(content);
    } catch {
        projectReportsSample = {};
    }
    return projectReportsSample;
}

async function loadAssetsLibrarySample(webRoot) {
    if (assetsLibrarySample) return assetsLibrarySample;
    try {
        const filePath = path.join(webRoot, 'data', 'assets-library-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        assetsLibrarySample = JSON.parse(content);
    } catch {
        assetsLibrarySample = {};
    }
    return assetsLibrarySample;
}

async function loadCodeTemplatesSample(webRoot) {
    if (codeTemplatesSample) return codeTemplatesSample;
    try {
        const filePath = path.join(webRoot, 'data', 'code-templates-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        codeTemplatesSample = JSON.parse(content);
    } catch {
        codeTemplatesSample = {};
    }
    return codeTemplatesSample;
}

async function loadCoverageReportsSample(webRoot) {
    if (!coverageReportsRawSample) {
        try {
            const filePath = path.join(webRoot, 'data', 'coverage-reports-sample.json');
            const content = await fs.readFile(filePath, 'utf8');
            coverageReportsRawSample = JSON.parse(content);
        } catch {
            coverageReportsRawSample = {};
        }
    }
    return buildCoverageReportsModel(path.join(webRoot, '..'), coverageReportsRawSample);
}

async function loadSettingsSample(webRoot) {
    if (settingsSample) return settingsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'settings-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        settingsSample = JSON.parse(content);
    } catch {
        settingsSample = {};
    }
    return settingsSample;
}

async function loadHelpSample(webRoot) {
    if (helpSample) return helpSample;
    try {
        const filePath = path.join(webRoot, 'data', 'help-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        helpSample = JSON.parse(content);
    } catch {
        helpSample = {};
    }
    return helpSample;
}

async function loadImplementationPlanSample(webRoot) {
    if (implementationPlanSample) return implementationPlanSample;
    try {
        const filePath = path.join(webRoot, 'data', 'implementation-plan-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        implementationPlanSample = JSON.parse(content);
    } catch {
        implementationPlanSample = {};
    }
    return implementationPlanSample;
}

async function loadAnalyticsSample(webRoot) {
    if (analyticsSample) return analyticsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'analytics-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        analyticsSample = buildAnalyticsModel(path.join(webRoot, '..'), JSON.parse(content));
    } catch {
        analyticsSample = {};
    }
    return analyticsSample;
}

async function loadDashboardHomeSample(webRoot) {
    try {
        const filePath = path.join(webRoot, 'data', 'dashboard-home-sample.json');
        const stat = await fs.stat(filePath);
        if (
            !dashboardHomeRawSample
            || dashboardHomeRawSampleMtimeMs !== stat.mtimeMs
        ) {
            const content = await fs.readFile(filePath, 'utf8');
            dashboardHomeRawSample = JSON.parse(content);
            dashboardHomeRawSampleMtimeMs = stat.mtimeMs;
        }
        return buildDashboardHomeModel(dashboardHomeRawSample);
    } catch {
        return buildDashboardHomeModel({});
    }
}

async function loadQualityDashboardSample(webRoot) {
    if (qualityDashboardSample) return qualityDashboardSample;
    try {
        const filePath = path.join(webRoot, 'data', 'quality-dashboard-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        qualityDashboardSample = mergeIstanbulTelemetry(
            JSON.parse(content),
            path.join(webRoot, '..')
        );
    } catch {
        qualityDashboardSample = {};
    }
    return qualityDashboardSample;
}

async function loadSecurityDashboardSample(webRoot) {
    if (!securityDashboardRawSample) {
        try {
            const filePath = path.join(webRoot, 'data', 'security-dashboard-sample.json');
            const content = await fs.readFile(filePath, 'utf8');
            securityDashboardRawSample = JSON.parse(content);
        } catch {
            securityDashboardRawSample = {};
        }
    }
    return buildSecurityDashboardModel(path.join(webRoot, '..'), securityDashboardRawSample);
}

async function loadSupportDashboardSample(webRoot) {
    if (supportDashboardSample) return supportDashboardSample;
    try {
        const filePath = path.join(webRoot, 'data', 'support-dashboard-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        supportDashboardSample = JSON.parse(content);
    } catch {
        supportDashboardSample = {};
    }
    return supportDashboardSample;
}

async function loadDebtCalculatorSample(webRoot) {
    if (debtCalculatorSample) return debtCalculatorSample;
    try {
        const filePath = path.join(webRoot, 'data', 'debt-calculator-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        debtCalculatorSample = JSON.parse(content);
    } catch {
        debtCalculatorSample = {};
    }
    return debtCalculatorSample;
}

async function loadAiAnalysisSample(webRoot) {
    if (aiAnalysisSample) return aiAnalysisSample;
    try {
        const filePath = path.join(webRoot, 'data', 'ai-analysis-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        aiAnalysisSample = JSON.parse(content);
    } catch {
        aiAnalysisSample = {};
    }
    return aiAnalysisSample;
}

async function loadAiToolsSample(webRoot) {
    if (aiToolsSample) return aiToolsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'ai-tools-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        aiToolsSample = JSON.parse(content);
    } catch {
        aiToolsSample = {};
    }
    return aiToolsSample;
}

async function loadDatabaseSample(webRoot) {
    if (databaseSample) return databaseSample;
    try {
        const filePath = path.join(webRoot, 'data', 'database-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        databaseSample = JSON.parse(content);
    } catch {
        databaseSample = {};
    }
    return databaseSample;
}

async function loadCodeGenerationSample(webRoot) {
    if (codeGenerationSample) return codeGenerationSample;
    try {
        const filePath = path.join(webRoot, 'data', 'code-generation-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        codeGenerationSample = JSON.parse(content);
    } catch {
        codeGenerationSample = {};
    }
    return codeGenerationSample;
}

async function loadReportsSample(webRoot) {
    if (reportsSample) return reportsSample;
    try {
        const filePath = path.join(webRoot, 'data', 'reports-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        reportsSample = JSON.parse(content);
    } catch {
        reportsSample = {};
    }
    return reportsSample;
}

async function loadIssueResolutionSample(webRoot) {
    if (issueResolutionSample) return issueResolutionSample;
    try {
        const filePath = path.join(webRoot, 'data', 'issue-resolution-sample.json');
        const content = await fs.readFile(filePath, 'utf8');
        issueResolutionSample = JSON.parse(content);
    } catch {
        issueResolutionSample = {};
    }
    return issueResolutionSample;
}

async function loadAiRoadmapSample(webRoot) {
    if (aiRoadmapSample) return aiRoadmapSample;
    try {
        const platformRoot = path.join(webRoot, '..');
        const filePath = path.join(platformRoot, ...AI_ROADMAP_DATA_REL.split('/'));
        const content = await fs.readFile(filePath, 'utf8');
        aiRoadmapSample = JSON.parse(content);
    } catch {
        aiRoadmapSample = {};
    }
    return aiRoadmapSample;
}

async function wrapPageModel(webRoot, loader) {
    const sample = await loader(webRoot);
    return { success: true, data: sample, ...sample };
}

function setupDashboardStubAPIs(app, webRoot, options = {}) {
    const db = options.db || null;
    const redis = options.redis || null;
    const { sendSnapshotOrSample } = require('../../server/lib/snapshot-resolver.cjs');
    const snapshotSend = (res, key, fallback) => sendSnapshotOrSample(res, db, key, fallback, redis);
    const snapshotGet = (route, key, fallback) => {
        app.get(route, async (req, res) => snapshotSend(res, key, fallback));
    };

    app.get('/api/mock-backend.js', (req, res) => {
        res.sendFile(path.join(webRoot, 'api', 'mock-backend.js'));
    });

    // Patterns & optimization
    app.get('/api/patterns/code', async (req, res) => {
        res.json([
            {
                id: 'singleton_pattern',
                name: 'Singleton Pattern',
                category: 'Creational',
                frequency: 45,
                quality: 'good',
                description: 'Ensures a class has only one instance',
                violations: 0
            },
            {
                id: 'factory_pattern',
                name: 'Factory Pattern',
                category: 'Creational',
                frequency: 32,
                quality: 'excellent',
                description: 'Creates objects without specifying exact class',
                violations: 0
            }
        ]);
    });

    app.get('/api/patterns/analysis', (req, res) => {
        res.json({
            totalPatterns: 12,
            qualityScore: 82,
            complexity: 28,
            maintainability: 76,
            categories: { Creational: 4, Structural: 3, Behavioral: 5 }
        });
    });

    app.get('/api/patterns/recommendations', (req, res) => {
        res.json([
            {
                id: 'rec_1',
                title: 'Reduce singleton usage',
                priority: 'medium',
                description: 'Prefer dependency injection in service modules'
            }
        ]);
    });

    app.get('/api/optimization/bottlenecks', async (req, res) => {
        const sample = await loadPerformanceSample(webRoot);
        const items = (sample.bottlenecks || []).map((b, i) => ({
            id: `bottleneck_${i + 1}`,
            type: 'performance',
            severity: b.severity === 'high' ? 'high' : 'medium',
            title: b.title,
            description: b.description,
            component: 'Platform',
            impact: b.impact,
            metrics: { impact: b.impact },
            status: 'active'
        }));
        res.json(items.length ? items : []);
    });

    app.get('/api/optimization/recommendations', async (req, res) => {
        const sample = await loadPerformanceSample(webRoot);
        res.json((sample.optimizations || []).map((o, i) => ({
            id: `opt_rec_${i + 1}`,
            priority: o.status === 'applied' ? 'low' : 'high',
            title: o.title,
            description: o.gain,
            estimatedImpact: o.gain,
            effort: 'medium',
            timeframe: '1-2 weeks',
            component: 'Platform',
            status: o.status
        })));
    });

    app.get('/api/optimization/actions', (req, res) => {
        res.json([
            { id: 'action_1', title: 'Enable roadmap scan cache', status: 'in-progress', progress: 40 },
            { id: 'action_2', title: 'Pre-warm GGUF models', status: 'planned', progress: 0 }
        ]);
    });

    app.get('/api/performance/metrics', async (req, res) => {
        await snapshotSend(res, 'performance-overview', async () => {
            const sample = await loadPerformanceSample(webRoot);
            return sample.overview || {};
        });
    });

    app.get('/api/performance/realtime', async (req, res) => {
        const sample = await loadPerformanceSample(webRoot);
        const o = sample.overview || {};
        res.json({
            cpu: o.cpuCurrent ?? null,
            memory: o.memoryUsed ?? null,
            throughput: o.throughput ?? null,
            timestamp: new Date().toISOString(),
            _source: db ? 'sample' : 'sample'
        });
    });

    app.get('/api/performance/historical', async (req, res) => {
        await snapshotSend(res, 'performance-timeline', async () => {
            const sample = await loadPerformanceSample(webRoot);
            return sample.metricsTimeline || { labels: [], cpu: [], memory: [] };
        });
    });

    app.get('/api/performance/utilization', async (req, res) => {
        await snapshotSend(res, 'performance-resources', async () => {
            const sample = await loadPerformanceSample(webRoot);
            return sample.systemResources || [];
        });
    });

    app.get('/api/performance/alerts', async (req, res) => {
        await snapshotSend(res, 'performance-alerts', async () => {
            const sample = await loadPerformanceSample(webRoot);
            return sample.alerts || [];
        });
    });

    app.get('/api/analytics/performance', async (req, res) => {
        await snapshotSend(res, 'performance-full', async () => {
            const sample = await loadPerformanceSample(webRoot);
            return { success: true, data: sample };
        });
    });

    // Dev Tools page (self-contained)
    app.get('/api/dev-tools/tools', async (req, res) => {
        await snapshotSend(res, 'dev-tools-tools', async () => {
            const sample = await loadDevToolsSample(webRoot);
            return sample.tools || [];
        });
    });

    app.get('/api/dev-tools/workflows', async (req, res) => {
        await snapshotSend(res, 'dev-tools-workflows', async () => {
            const sample = await loadDevToolsSample(webRoot);
            return sample.workflows || [];
        });
    });

    app.get('/api/dev-tools/stats', async (req, res) => {
        await snapshotSend(res, 'dev-tools-stats', async () => {
            const sample = await loadDevToolsSample(webRoot);
            const o = sample.overview || {};
            return {
                totalTools: o.totalTools ?? (sample.tools || []).length,
                activeTools: o.activeTools ?? (sample.tools || []).filter(t => t.status === 'active').length,
                totalUsage: o.totalUsage ?? 0,
                runningWorkflows: o.runningWorkflows ?? 0,
                avgResponseTime: parseFloat(String(o.avgResponseTime || '1.4').replace(/[^\d.]/g, '')) || 1.4,
                successRate: o.successRate ?? 96,
                timestamp: sample.generatedAt || new Date().toISOString()
            };
        });
    });

    // Analytics page (self-contained)
    snapshotGet('/api/analytics', 'analytics-full', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/analytics/overview', 'analytics-overview', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        const o = sample.overview || {};
        return {
            totalRequests: o.apiCalls ?? null,
            activeUsers: o.activeUsers ?? null,
            dataProcessed: null,
            successRate: o.errorRate != null ? Math.max(0, 100 - o.errorRate) : null,
            avgResponseTime: o.avgResponseTime ?? null,
            uptime: o.uptime ?? null,
            timestamp: sample.generatedAt || new Date().toISOString()
        };
    });

    snapshotGet('/api/analytics/usage', 'analytics-usage', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        const o = sample.overview || {};
        return {
            apiCalls: o.apiCalls ?? null,
            dataQueries: o.dataQueries ?? null,
            aiProcessing: o.aiProcessingJobs ?? null,
            fileUploads: null,
            timestamp: sample.generatedAt || new Date().toISOString()
        };
    });

    snapshotGet('/api/analytics/errors', 'analytics-errors', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        const trends = sample.trends || {};
        const errorPoints = trends.errors || [];
        const total = errorPoints.reduce((sum, value) => sum + (Number(value) || 0), 0);
        return {
            total,
            critical: 0,
            warnings: total,
            info: 0,
            timestamp: sample.generatedAt || new Date().toISOString()
        };
    });

    snapshotGet('/api/analytics/trends', 'analytics-trends', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        const trends = sample.trends || {};
        const labels = trends.labels || [];
        return labels.map((label, index) => ({
            timestamp: label,
            requests: trends.apiCalls?.[index] ?? null,
            users: null,
            errors: trends.errors?.[index] ?? null
        }));
    });

    snapshotGet('/api/analytics/alerts', 'analytics-alerts', async () => {
        const sample = await loadAnalyticsSample(webRoot);
        return sample.alerts || [];
    });

    snapshotGet('/api/dashboard-home', 'dashboard-home-full', async () => {
        const sample = await loadDashboardHomeSample(webRoot);
        return { success: true, data: sample };
    });

    // API page (self-contained) — note: /api/performance here is API throughput, not performance page
    snapshotGet('/api/metrics', 'api-metrics', async () => {
        const sample = await loadAPISample(webRoot);
        return sample.apis || [];
    });

    snapshotGet('/api/activity', 'api-activity', async () => {
        const sample = await loadAPISample(webRoot);
        return sample.activity || [];
    });

    app.get('/api/performance', async (req, res) => {
        await snapshotSend(res, 'api-performance-summary', async () => {
            const sample = await loadAPISample(webRoot);
            const perf = sample.performanceMetrics || [];
            const requests = perf.find(p => p.id === 'requests');
            const response = perf.find(p => p.id === 'response');
            const error = perf.find(p => p.id === 'error');
            const throughput = perf.find(p => p.id === 'throughput');
            return {
                requestsPerMinute: parseInt(String(requests?.value || '847'), 10) || 847,
                requestTrend: requests?.trend || 'up',
                avgResponseTime: parseInt(String(response?.value || '124').replace(/\D/g, ''), 10) || 124,
                responseTrend: response?.trend || 'down',
                errorRate: parseFloat(String(error?.value || '2.6').replace(/[^\d.]/g, '')) || 2.6,
                errorTrend: error?.trend || 'stable',
                throughput: parseFloat(String(throughput?.value || '8.4').replace(/[^\d.]/g, '')) || 8.4,
                throughputTrend: throughput?.trend || 'up',
                timestamp: new Date().toISOString()
            };
        });
    });

    snapshotGet('/api/alerts', 'api-alerts', async () => {
        const sample = await loadAPISample(webRoot);
        return sample.alerts || [];
    });

    app.get('/api/status', async (req, res) => {
        await snapshotSend(res, 'api-status-summary', async () => {
            const sample = await loadAPISample(webRoot);
            const o = sample.overview || {};
            return {
                status: 'healthy',
                uptime: o.uptime ?? 99.95,
                totalAPIs: o.totalAPIs ?? (sample.apis || []).length,
                activeAPIs: o.activeAPIs ?? (sample.apis || []).filter(a => a.status === 'active').length,
                timestamp: new Date().toISOString()
            };
        });
    });

    // Merger Tool page (self-contained)
    snapshotGet('/api/merger-tool/merges', 'merger-merges', async () => {
        const sample = await loadMergerToolSample(webRoot);
        return sample.merges || [];
    });

    snapshotGet('/api/merger-tool/overview', 'merger-overview', async () => {
        const sample = await loadMergerToolSample(webRoot);
        const o = sample.overview || {};
        return { ...o, timestamp: sample.generatedAt || new Date().toISOString() };
    });

    snapshotGet('/api/merger-tool/activity', 'merger-activity', async () => {
        const sample = await loadMergerToolSample(webRoot);
        return sample.activity || [];
    });

    snapshotGet('/api/merger-tool/statistics', 'merger-statistics', async () => {
        const sample = await loadMergerToolSample(webRoot);
        const stats = sample.statistics || {};
        return { ...stats, timestamp: sample.generatedAt || new Date().toISOString() };
    });

    app.get('/api/merger-tool/reduction-scan', async (req, res) => {
        try {
            const { resolvePlatformRoot } = require('../../packages/simplebeacon-cli/src/project-detect');
            const defaultDir = path.join(webRoot, '..');
            const allowedRoots = resolveDefaultAllowedRoots(defaultDir, {
                monorepoRoot: path.join(defaultDir, '..')
            });
            const rawPath = String(req.query?.projectPath || '').trim();
            let baseDir = defaultDir;
            if (rawPath) {
                try {
                    baseDir = assertSafeProjectPath(
                        path.isAbsolute(rawPath)
                            ? path.normalize(rawPath)
                            : path.join(defaultDir, rawPath),
                        allowedRoots
                    );
                } catch (error) {
                    return res.status(400).json({ success: false, error: error.message });
                }
            }
            const { platformRoot } = resolvePlatformRoot(baseDir);
            const scope = String(req.query?.scope || 'repository').toLowerCase() === 'sample-data-only'
                ? 'sample-data-only'
                : 'repository';
            const report = await scanFileMergerReduction(baseDir, {
                scope,
                sampleBase: platformRoot || baseDir
            });
            try {
                saveConsolidationReport(report, baseDir);
            } catch {
                /* non-fatal */
            }
            res.set('Cache-Control', 'no-store');
            res.json({
                success: true,
                data: report,
                projectPath: baseDir,
                platformRoot: platformRoot !== baseDir ? platformRoot : undefined,
                scope
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Debt Calculator page (self-contained)
    snapshotGet('/api/debt-calculator', 'debt-calculator-full', async () => {
        const sample = await loadDebtCalculatorSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/debt-calculator/overview', 'debt-calculator-overview', async () => {
        const sample = await loadDebtCalculatorSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/debt-calculator/categories', 'debt-calculator-categories', async () => {
        const sample = await loadDebtCalculatorSample(webRoot);
        return sample.categories || [];
    });

    // Debt Reduction page (self-contained)
    snapshotGet('/api/debt-reduction', 'debt-reduction-full', async () => {
        const sample = await loadDebtReductionSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/debt-reduction/overview', 'debt-reduction-overview', async () => {
        const sample = await loadDebtReductionSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/debt-reduction/strategies', 'debt-reduction-strategies', async () => {
        const sample = await loadDebtReductionSample(webRoot);
        return sample.strategies || [];
    });

    snapshotGet('/api/debt-reduction/tasks', 'debt-reduction-tasks', async () => {
        const sample = await loadDebtReductionSample(webRoot);
        return sample.activeTasks || [];
    });

    // Debt Analytics page (self-contained)
    snapshotGet('/api/debt-analytics', 'debt-analytics-full', async () => {
        const sample = await loadDebtAnalyticsSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/debt-analytics/overview', 'debt-analytics-overview', async () => {
        const sample = await loadDebtAnalyticsSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/debt-analytics/trends', 'debt-analytics-trends', async () => {
        const sample = await loadDebtAnalyticsSample(webRoot);
        return sample.trends || {};
    });

    snapshotGet('/api/debt-analytics/insights', 'debt-analytics-insights', async () => {
        const sample = await loadDebtAnalyticsSample(webRoot);
        return sample.insights || [];
    });

    // Feature Backlog page (self-contained)
    snapshotGet('/api/feature-backlog', 'feature-backlog-full', async () => {
        const sample = await loadFeatureBacklogSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/feature-backlog/statistics', 'feature-backlog-statistics', async () => {
        const sample = await loadFeatureBacklogSample(webRoot);
        return sample.featureStatistics || {};
    });

    snapshotGet('/api/feature-backlog/sprint', 'feature-backlog-sprint', async () => {
        const sample = await loadFeatureBacklogSample(webRoot);
        return sample.currentSprintBacklog || [];
    });

    // Release Timeline page (self-contained)
    snapshotGet('/api/release-timeline', 'release-timeline-full', async () => {
        const sample = await loadReleaseTimelineSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/release-timeline/schedule', 'release-timeline-schedule', async () => {
        const sample = await loadReleaseTimelineSample(webRoot);
        return sample.releaseSchedule || [];
    });

    snapshotGet('/api/release-timeline/overview', 'release-timeline-overview', async () => {
        const sample = await loadReleaseTimelineSample(webRoot);
        return sample.releaseOverview || {};
    });

    // Billing System page (self-contained)
    snapshotGet('/api/billing-system', 'billing-full', async () => {
        const sample = await loadBillingSystemSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/billing-system/overview', 'billing-overview', async () => {
        const sample = await loadBillingSystemSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/billing-system/subscriptions', 'billing-subscriptions', async () => {
        const sample = await loadBillingSystemSample(webRoot);
        return sample.subscriptions || [];
    });

    snapshotGet('/api/billing-system/transactions', 'billing-transactions', async () => {
        const sample = await loadBillingSystemSample(webRoot);
        return sample.recentTransactions || [];
    });

    // Project Reports page (self-contained)
    snapshotGet('/api/project-reports', 'project-reports-full', async () => {
        const sample = await loadProjectReportsSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/project-reports/overview', 'project-reports-overview', async () => {
        const sample = await loadProjectReportsSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/project-reports/reports', 'project-reports-reports', async () => {
        const sample = await loadProjectReportsSample(webRoot);
        return sample.reports || [];
    });

    snapshotGet('/api/project-reports/projects', 'project-reports-projects', async () => {
        const sample = await loadProjectReportsSample(webRoot);
        return sample.projects || [];
    });

    // Assets Library page (self-contained)
    snapshotGet('/api/assets-library', 'assets-full', async () => {
        const sample = await loadAssetsLibrarySample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/assets-library/overview', 'assets-overview', async () => {
        const sample = await loadAssetsLibrarySample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/assets-library/assets', 'assets-items', async () => {
        const sample = await loadAssetsLibrarySample(webRoot);
        return sample.assets || [];
    });

    snapshotGet('/api/assets-library/categories', 'assets-categories', async () => {
        const sample = await loadAssetsLibrarySample(webRoot);
        return sample.categories || [];
    });

    // Code Templates page (self-contained)
    snapshotGet('/api/code-templates', 'code-templates-full', async () => {
        const sample = await loadCodeTemplatesSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/code-templates/overview', 'code-templates-overview', async () => {
        const sample = await loadCodeTemplatesSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/code-templates/templates', 'code-templates-templates', async () => {
        const sample = await loadCodeTemplatesSample(webRoot);
        return sample.templates || [];
    });

    snapshotGet('/api/code-templates/categories', 'code-templates-categories', async () => {
        const sample = await loadCodeTemplatesSample(webRoot);
        return sample.categories || [];
    });

    // Coverage Reports page (self-contained)
    snapshotGet('/api/coverage-reports', 'coverage-full', async () => {
        const sample = await loadCoverageReportsSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/coverage-reports/overview', 'coverage-overview', async () => {
        const sample = await loadCoverageReportsSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/coverage-reports/projects', 'coverage-projects', async () => {
        const sample = await loadCoverageReportsSample(webRoot);
        return sample.projects || [];
    });

    snapshotGet('/api/coverage-reports/trends', 'coverage-trends', async () => {
        const sample = await loadCoverageReportsSample(webRoot);
        return sample.coverageTrends || [];
    });

    // Settings page (self-contained)
    snapshotGet('/api/settings', 'settings-full', async () => {
        const sample = await loadSettingsSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/settings/overview', 'settings-overview', async () => {
        const sample = await loadSettingsSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/settings/user', 'settings-user', async () => {
        const sample = await loadSettingsSample(webRoot);
        return sample.userSettings || {};
    });

    snapshotGet('/api/settings/system', 'settings-system', async () => {
        const sample = await loadSettingsSample(webRoot);
        return sample.systemSettings || {};
    });

    // Help page (self-contained)
    snapshotGet('/api/help', 'help-full', async () => {
        const sample = await loadHelpSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/help/overview', 'help-overview', async () => {
        const sample = await loadHelpSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/help/documentation', 'help-documentation', async () => {
        const sample = await loadHelpSample(webRoot);
        return sample.documentation || [];
    });

    snapshotGet('/api/help/faq', 'help-faq', async () => {
        const sample = await loadHelpSample(webRoot);
        return sample.faq || [];
    });

    // Implementation plan page (self-contained)
    snapshotGet('/api/implementation-plan', 'implementation-plan-full', async () => {
        const sample = await loadImplementationPlanSample(webRoot);
        return { success: true, data: sample };
    });

    snapshotGet('/api/implementation-plan/summary', 'implementation-plan-summary', async () => {
        const sample = await loadImplementationPlanSample(webRoot);
        return sample.executiveSummary || {};
    });

    snapshotGet('/api/implementation-plan/phases', 'implementation-plan-phases', async () => {
        const sample = await loadImplementationPlanSample(webRoot);
        return sample.implementationPhases || [];
    });

    // Quality dashboard (component-backed)
    snapshotGet('/api/quality/overview', 'quality-overview', async () => {
        const sample = await loadQualityDashboardSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/quality/metrics', 'quality-metrics', async () => {
        const sample = await loadQualityDashboardSample(webRoot);
        return sample.metrics || [];
    });

    snapshotGet('/api/quality/alerts', 'quality-alerts', async () => {
        const sample = await loadQualityDashboardSample(webRoot);
        return sample.alerts || [];
    });

    snapshotGet('/api/quality/reports', 'quality-reports', async () => {
        const sample = await loadQualityDashboardSample(webRoot);
        return sample.reports || [];
    });

    snapshotGet('/api/quality/performance', 'quality-performance', async () => {
        const sample = await loadQualityDashboardSample(webRoot);
        return sample.performance || {};
    });

    // Security dashboard (component-backed)
    snapshotGet('/api/security/overview', 'security-overview', async () => {
        const sample = await loadSecurityDashboardSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/security/threats', 'security-threats', async () => {
        const sample = await loadSecurityDashboardSample(webRoot);
        return sample.threats || [];
    });

    snapshotGet('/api/security/vulnerabilities', 'security-vulnerabilities', async () => {
        const sample = await loadSecurityDashboardSample(webRoot);
        return sample.vulnerabilities || [];
    });

    snapshotGet('/api/security/npm-audit', 'security-npm-audit', async () => {
        return runNpmAudit(path.join(webRoot, '..'));
    });

    app.post('/api/security/npm-audit', async (_req, res) => {
        try {
            const result = runNpmAudit(path.join(webRoot, '..'), { force: true });
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'npm audit failed', message: error.message });
        }
    });

    snapshotGet('/api/security/incidents', 'security-incidents', async () => {
        const sample = await loadSecurityDashboardSample(webRoot);
        return sample.incidents || [];
    });

    snapshotGet('/api/security/compliance', 'security-compliance', async () => {
        const sample = await loadSecurityDashboardSample(webRoot);
        return sample.compliance || {};
    });

    // Support dashboard (component-backed)
    snapshotGet('/api/support/overview', 'support-overview', async () => {
        const sample = await loadSupportDashboardSample(webRoot);
        return sample.overview || {};
    });

    snapshotGet('/api/support/tickets', 'support-tickets', async () => {
        const sample = await loadSupportDashboardSample(webRoot);
        return sample.tickets || [];
    });

    snapshotGet('/api/support/agents', 'support-agents', async () => {
        const sample = await loadSupportDashboardSample(webRoot);
        return sample.agents || [];
    });

    snapshotGet('/api/support/analytics', 'support-analytics', async () => {
        const sample = await loadSupportDashboardSample(webRoot);
        return sample.analytics || {};
    });

    snapshotGet('/api/support/satisfaction', 'support-satisfaction', async () => {
        const sample = await loadSupportDashboardSample(webRoot);
        return sample.satisfaction || {};
    });

    // AI Analysis page (self-contained)
    snapshotGet('/api/ai-analysis', 'ai-analysis-full', async () => wrapPageModel(webRoot, loadAiAnalysisSample));

    // AI Tools page (self-contained)
    snapshotGet('/api/ai-tools', 'ai-tools-full', async () => wrapPageModel(webRoot, loadAiToolsSample));

    // Database page (self-contained)
    snapshotGet('/api/database', 'database-full', async () => wrapPageModel(webRoot, loadDatabaseSample));

    // Code Generation page (self-contained)
    snapshotGet('/api/code-generation', 'code-generation-full', async () => wrapPageModel(webRoot, loadCodeGenerationSample));

    app.get('/api/code-generation/templates', async (req, res) => {
        await snapshotSend(res, 'code-generation-templates', async () => {
            const sample = await loadCodeGenerationSample(webRoot);
            return { success: true, templates: sample.templates || [] };
        });
    });

    app.get('/api/code-generation/history', async (req, res) => {
        await snapshotSend(res, 'code-generation-history', async () => {
            const sample = await loadCodeGenerationSample(webRoot);
            return { success: true, history: sample.history || [] };
        });
    });

    app.get('/api/code-generation/stats', async (req, res) => {
        await snapshotSend(res, 'code-generation-stats', async () => {
            const sample = await loadCodeGenerationSample(webRoot);
            return { success: true, ...(sample.stats || {}) };
        });
    });

    // Reports page (self-contained)
    snapshotGet('/api/reports', 'reports-full', async () => wrapPageModel(webRoot, loadReportsSample));

    // Issue Resolution page (self-contained)
    snapshotGet('/api/issues/resolution', 'issue-resolution-full', async () => wrapPageModel(webRoot, loadIssueResolutionSample));

    app.get('/api/issues', async (req, res) => {
        await snapshotSend(res, 'issues-list', async () => {
            const model = await loadIssueResolutionSample(webRoot);
            return {
                success: true,
                ...model,
                issues: model.issues || [],
                total: model.total ?? (model.issues || []).length,
                lastUpdated: model.generatedAt || new Date().toISOString()
            };
        });
    });

    // AI Roadmap page (self-contained)
    snapshotGet('/api/ai-roadmap/report', 'ai-roadmap-full', async () => wrapPageModel(webRoot, loadAiRoadmapSample));

    app.get('/api/roadmap/data', async (req, res) => {
        try {
            const type = req.query.type || 'ai-powered';
            if (type !== 'ai-powered') {
                return res.status(404).json({
                    success: false,
                    error: 'Roadmap type not available',
                    type
                });
            }
            const data = await loadAiRoadmapSample(webRoot);
            res.json({
                success: true,
                type,
                data,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to load roadmap data',
                message: error.message
            });
        }
    });
}

module.exports = setupDashboardStubAPIs;

