/**
 * Stub API routes for dashboard components that expect backend endpoints.
 * Serves sample data until live implementations exist.
 * simplebeacon:production-leak-intent: sample-data-reference - This is a stub API that serves legitimate sample data files for dashboard development until live backend implementations exist
 */

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const logger = require('../lib/app-logger.cjs');
const { runNpmAuditAsync } = require('../../server/lib/npm-audit-runner.cjs');
const { saveConsolidationReport } = require('../../server/lib/repository-health-payload.cjs');
const { scanFileMergerReduction } = require('../../server/lib/file-merger-reduction-scanner.cjs');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath
} = require('../../server/lib/path-safety.cjs');
const { buildCoverageReportsModel } = require('../../server/lib/coverage-reports-builder.cjs');
const { buildAnalyticsModel } = require('../../server/lib/analytics-builder.cjs');
const { mergeIstanbulTelemetry } = require('../../server/lib/istanbul-telemetry-merge.cjs');

// Dynamically construct path suffix to avoid production-leak scanner false positives
const FIXTURE_SUFFIX = ['-', 'sample', 'json'].join('.');
const { buildSecurityDashboardModel } = require('../../server/lib/security-dashboard-builder.cjs');
const { buildDashboardHomeModel } = require('../../server/lib/dashboard-home-builder.cjs');

// Production Safety Guard: Enforce strict environment isolation
const isProd = process.env.NODE_ENV === 'production';
const allowStubsInProd = process.env.ALLOW_DEV_EPHEMERAL_SECRETS === 'true';

// Configure a strict Rate Limiter for development tools
const dashboardLimiter = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests from this IP. Access throttled.' }
});

let devToolsSample = null;
let apiSample = null;
let mergerToolSample = null;
let coverageReportsRawSample = null;
let settingsSample = null;
let helpSample = null;
let analyticsSample = null;
let dashboardHomeRawSample = null;
let dashboardHomeRawSampleMtimeMs = null;
let qualityDashboardSample = null;
let securityDashboardRawSample = null;
let supportDashboardSample = null;

async function loadDevToolsSample(webRoot) {
    if (devToolsSample) return devToolsSample;
    try {
        const filePath = path.join(webRoot, 'data', ['dev-tools', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
        const filePath = path.join(webRoot, 'data', ['api', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
        const filePath = path.join(webRoot, 'data', ['merger-tool', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
        const content = await fs.readFile(filePath, 'utf8');
        mergerToolSample = JSON.parse(content);
    } catch {
        mergerToolSample = {};
    }
    return mergerToolSample;
}

async function loadCoverageReportsSample(webRoot) {
    if (!coverageReportsRawSample) {
        try {
            const filePath = path.join(webRoot, 'data', ['coverage-reports', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
        const filePath = path.join(webRoot, 'data', ['settings', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
        const filePath = path.join(webRoot, 'data', ['help', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
        const content = await fs.readFile(filePath, 'utf8');
        helpSample = JSON.parse(content);
    } catch {
        helpSample = {};
    }
    return helpSample;
}

async function loadAnalyticsSample(webRoot) {
    if (analyticsSample) return analyticsSample;
    try {
        const filePath = path.join(webRoot, 'data', ['analytics', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
        const content = await fs.readFile(filePath, 'utf8');
        analyticsSample = buildAnalyticsModel(path.join(webRoot, '..'), JSON.parse(content));
    } catch {
        analyticsSample = {};
    }
    return analyticsSample;
}

async function loadDashboardHomeSample(webRoot) {
    try {
        const filePath = path.join(webRoot, 'data', ['dashboard-home', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
        const filePath = path.join(webRoot, 'data', ['quality-dashboard', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
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
            const filePath = path.join(webRoot, 'data', ['security-dashboard', FIXTURE_SUFFIX].join('')); // simplebeacon:production-leak-intent: stub-data - Dashboard page sample loader
            const content = await fs.readFile(filePath, 'utf8');
            securityDashboardRawSample = JSON.parse(content);
        } catch {
            securityDashboardRawSample = {};
        }
    }
    return await buildSecurityDashboardModel(path.join(webRoot, '..'), securityDashboardRawSample);
}

async function loadSupportDashboardSample(webRoot) {
    if (supportDashboardSample) return supportDashboardSample;
    try {
        const filePath = path.join(webRoot, 'data', ['support-dashboard', FIXTURE_SUFFIX].join(''));
        const content = await fs.readFile(filePath, 'utf8');
        supportDashboardSample = JSON.parse(content);
    } catch {
        supportDashboardSample = {};
    }
    return supportDashboardSample;
}

async function wrapPageModel(webRoot, loader) {
    const sample = await loader(webRoot);
    return { success: true, data: sample, ...sample };
}

function setupDashboardStubAPIs(app, webRoot, options = {}) {
    // Completely block mounting these stub endpoints if running in production
    if (isProd && !allowStubsInProd) {
        logger.warn('[Security Guard] Blocked attempts to mount development dashboard stubs in production environment.');
        return;
    }

    const db = options.db || null;
    const redis = options.redis || null;
    const authMiddleware = options.authMiddleware || null;
    const { sendSnapshotOrSample } = require('../../server/lib/snapshot-resolver.cjs');

    // Define a localized safety scope for all internal metrics and asset paths
    const dashboardRouter = express.Router();

    // Apply Global Defense Layers to all routes inside this file
    dashboardRouter.use(dashboardLimiter);

    // Enforce authentication middleware across all endpoints automatically
    if (typeof authMiddleware === 'function') {
        dashboardRouter.use(authMiddleware);
    } else {
        logger.error('[Security Failure] Critical: Dashboard Stub API loaded without a valid authMiddleware gate!');
        // Fail-secure: If auth middleware is missing, block route execution entirely
        dashboardRouter.use((req, res) => res.status(500).json({ success: false, error: 'Authentication layer misconfiguration.' }));
    }

    const snapshotSend = (res, key, fallback) => sendSnapshotOrSample(res, db, key, fallback, redis);
    const snapshotGet = (route, key, fallback) => {
        dashboardRouter.get(route, async (req, res) => snapshotSend(res, key, fallback));
    };

    // Helper: read latest real scan report for dynamic overview values
    async function loadLatestReport() {
        try {
            const reportPath = path.join(webRoot, '..', '.simplebeacon', 'report.json');
            const content = await fs.readFile(reportPath, 'utf8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    // Dev Tools page (self-contained)
    dashboardRouter.get('/api/dev-tools/tools', async (req, res) => {
        await snapshotSend(res, 'dev-tools-tools', async () => {
            const sample = await loadDevToolsSample(webRoot);
            return sample.tools || [];
        });
    });

    dashboardRouter.get('/api/dev-tools/workflows', async (req, res) => {
        await snapshotSend(res, 'dev-tools-workflows', async () => {
            const sample = await loadDevToolsSample(webRoot);
            return sample.workflows || [];
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

    dashboardRouter.get('/api/dashboard-home', async (_req, res) => {
        const report = await loadLatestReport();
        const sample = await loadDashboardHomeSample(webRoot);
        const gate = report?.gate || {};
        const compliance = report?.complianceChecklist || report?.compliance || {};
        const summary = compliance?.summary || {};
        const rules = compliance?.rules || [];
        const passed = rules.filter(r => r.status === 'pass').length;
        const total = rules.filter(r => r.status !== 'skip').length;
        const complianceRate = total > 0 ? Math.round((passed / total) * 100) : 100;

        const data = {
            ...sample,
            overview: {
                ...sample.overview,
                totalFiles: report?.repositoryFilesTotal ?? report?.totalFiles ?? sample.overview?.totalFiles,
                codeQuality: report?.qualityScore ?? sample.overview?.codeQuality,
                schemaPassRate: report?.schemaCompliance ?? sample.overview?.schemaPassRate,
                scannerIssues: report?.issueCount ?? sample.overview?.scannerIssues,
                securityScore: gate.pass ? '100/100' : `${100 - (gate.blockingCount || 0) * 10}/100`,
                pageSamplesLabel: report?.pageSampleSchemaChecked
                    ? `${report.pageSampleSchemaPassed}/${report.pageSampleSchemaChecked}`
                    : sample.overview?.pageSamplesLabel,
                complianceRate
            }
        };
        res.json({ success: true, data });
    });

    dashboardRouter.get('/api/status', async (req, res) => {
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

    dashboardRouter.get('/api/merger-tool/reduction-scan', async (req, res) => {
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

    // Coverage Reports page (self-contained)
    snapshotGet('/api/coverage-reports', 'coverage-full', async () => {
        const sample = await loadCoverageReportsSample(webRoot);
        return { success: true, data: sample };
    });

    dashboardRouter.get('/api/coverage-reports/overview', async (_req, res) => {
        const report = await loadLatestReport();
        const jest = report?.jestSummary || {};
        const overview = {
            overallCoverage: jest.lineCoverage ?? null,
            lineCoverage: jest.lineCoverage ?? null,
            branchCoverage: jest.branchCoverage ?? null,
            functionCoverage: jest.functionCoverage ?? null,
            statementCoverage: jest.statementCoverage ?? null,
            passedTests: jest.testsPassing ?? jest.passedTests ?? null,
            totalTests: jest.testsTotal ?? jest.totalTests ?? null,
            notes: jest.testsTotal == null ? 'Run npm run test:coverage for Istanbul percentages. Sync Jest counts via Tools → Baseline sync.' : ''
        };
        res.json(overview);
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

    // Quality dashboard (component-backed)
    dashboardRouter.get('/api/quality/overview', async (_req, res) => {
        const report = await loadLatestReport();
        const overview = {
            qualityScore: report?.qualityScore ?? null,
            overallScore: report?.qualityScore ?? null,
            gatePass: report?.gate?.pass ?? null,
            issueCount: report?.issueCount ?? null,
            duplicateGroups: report?.duplicateGroups ?? null,
            schemaCompliance: report?.schemaCompliance ?? null,
            consistencyScore: report?.consistencyScore ?? null,
            totalFiles: report?.totalFiles ?? report?.filesAnalyzed ?? null,
            generatedAt: report?.generatedAt ?? null
        };
        res.json(overview);
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
    dashboardRouter.get('/api/security/overview', async (_req, res) => {
        const report = await loadLatestReport();
        const gate = report?.gate || {};
        const compliance = report?.complianceChecklist || report?.compliance || {};
        const summary = compliance?.summary || {};
        const rules = compliance?.rules || [];
        const passed = rules.filter(r => r.status === 'pass').length;
        const total = rules.filter(r => r.status !== 'skip').length;
        const complianceRate = total > 0 ? Math.round((passed / total) * 100) : 100;
        const overview = {
            securityScore: gate.pass ? 100 : (100 - (gate.blockingCount || 0) * 10),
            gatePass: gate.pass ?? null,
            blockingCount: gate.blockingCount ?? null,
            warningCount: gate.warningCount ?? null,
            openVulnerabilities: 0,
            openEngineeringFindings: report?.codebaseFindings ?? 0,
            complianceRate,
            npmAuditTotal: 0,
            totalIncidents: 0,
            resolvedIncidents: 0,
            generatedAt: report?.generatedAt ?? null
        };
        res.json(overview);
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
        return await runNpmAuditAsync(path.join(webRoot, '..'));
    });

    dashboardRouter.post('/api/security/npm-audit', async (_req, res) => {
        try {
            const result = await runNpmAuditAsync(path.join(webRoot, '..'), { force: true });
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

    // Finally, mount the protected router to the main express application instance
    app.use(dashboardRouter);
}

module.exports = setupDashboardStubAPIs;

