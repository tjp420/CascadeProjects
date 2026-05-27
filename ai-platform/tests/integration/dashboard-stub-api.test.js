const express = require('express');
const path = require('path');
const setupDashboardStubAPIs = require('../../src/api/dashboard-stub-api');
const { REPOSITORY_AUDIT_BASELINE } = require('../../server/lib/repository-audit-baseline');

async function withStubServer(fn) {
    const app = express();
    const webRoot = path.join(__dirname, '../../web');
    setupDashboardStubAPIs(app, webRoot);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
        await fn(baseUrl);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    }
}

async function getJson(baseUrl, route) {
    const response = await fetch(`${baseUrl}${route}`);
    expect(response.ok).toBe(true);
    return response.json();
}

describe('dashboard stub API routes', () => {
    test('performance endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const metrics = await getJson(baseUrl, '/api/performance/metrics');
            expect(metrics).toBeTruthy();

            const realtime = await getJson(baseUrl, '/api/performance/realtime');
            expect(realtime).toHaveProperty('cpu');
            expect(realtime).toHaveProperty('memory');

            const historical = await getJson(baseUrl, '/api/performance/historical');
            expect(historical).toBeTruthy();
        });
    });

    test('dev-tools endpoints return arrays', async () => {
        await withStubServer(async (baseUrl) => {
            const tools = await getJson(baseUrl, '/api/dev-tools/tools');
            expect(Array.isArray(tools)).toBe(true);

            const workflows = await getJson(baseUrl, '/api/dev-tools/workflows');
            expect(Array.isArray(workflows)).toBe(true);

            const stats = await getJson(baseUrl, '/api/dev-tools/stats');
            expect(stats).toHaveProperty('totalTools');
        });
    });

    test('api page endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const metrics = await getJson(baseUrl, '/api/metrics');
            expect(Array.isArray(metrics)).toBe(true);

            const activity = await getJson(baseUrl, '/api/activity');
            expect(Array.isArray(activity)).toBe(true);

            const status = await getJson(baseUrl, '/api/status');
            expect(status).toHaveProperty('status', 'healthy');
        });
    });

    test('merger-tool endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const merges = await getJson(baseUrl, '/api/merger-tool/merges');
            expect(Array.isArray(merges)).toBe(true);
            expect(merges.length).toBeGreaterThan(0);

            const overview = await getJson(baseUrl, '/api/merger-tool/overview');
            expect(overview).toHaveProperty('totalMerges');

            const activity = await getJson(baseUrl, '/api/merger-tool/activity');
            expect(Array.isArray(activity)).toBe(true);

            const reduction = await getJson(baseUrl, '/api/merger-tool/reduction-scan');
            expect(reduction.success).toBe(true);
            expect(reduction.data.type).toBe('file-merger-reduction-report');
            expect(reduction.data.summary.filesAnalyzed).toBeGreaterThan(0);
        });
    });

    test('debt-calculator endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/debt-calculator');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('categories');

            const overview = await getJson(baseUrl, '/api/debt-calculator/overview');
            expect(overview).toHaveProperty('debtScore');

            const categories = await getJson(baseUrl, '/api/debt-calculator/categories');
            expect(Array.isArray(categories)).toBe(true);
        });
    });

    test('debt-reduction endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/debt-reduction');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('strategies');

            const overview = await getJson(baseUrl, '/api/debt-reduction/overview');
            expect(overview).toHaveProperty('debtReduction');

            const strategies = await getJson(baseUrl, '/api/debt-reduction/strategies');
            expect(Array.isArray(strategies)).toBe(true);
            expect(strategies.length).toBeGreaterThan(0);
        });
    });

    test('debt-analytics endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/debt-analytics');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('trends');

            const overview = await getJson(baseUrl, '/api/debt-analytics/overview');
            expect(overview).toHaveProperty('totalDebt');

            const trends = await getJson(baseUrl, '/api/debt-analytics/trends');
            expect(Array.isArray(trends.monthly)).toBe(true);

            const insights = await getJson(baseUrl, '/api/debt-analytics/insights');
            expect(Array.isArray(insights)).toBe(true);
        });
    });

    test('feature-backlog endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/feature-backlog');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('featureCategories');

            const stats = await getJson(baseUrl, '/api/feature-backlog/statistics');
            expect(stats).toHaveProperty('totalFeatures');

            const sprint = await getJson(baseUrl, '/api/feature-backlog/sprint');
            expect(Array.isArray(sprint)).toBe(true);
            expect(sprint.length).toBeGreaterThan(0);
        });
    });

    test('release-timeline endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/release-timeline');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('releaseSchedule');

            const schedule = await getJson(baseUrl, '/api/release-timeline/schedule');
            expect(Array.isArray(schedule)).toBe(true);
            expect(schedule.length).toBeGreaterThan(0);

            const overview = await getJson(baseUrl, '/api/release-timeline/overview');
            expect(overview).toHaveProperty('totalReleases');
        });
    });

    test('billing-system endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/billing-system');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('subscriptions');

            const overview = await getJson(baseUrl, '/api/billing-system/overview');
            expect(overview).toHaveProperty('totalRevenue');

            const subscriptions = await getJson(baseUrl, '/api/billing-system/subscriptions');
            expect(Array.isArray(subscriptions)).toBe(true);

            const transactions = await getJson(baseUrl, '/api/billing-system/transactions');
            expect(Array.isArray(transactions)).toBe(true);
        });
    });

    test('project-reports endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/project-reports');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('reports');

            const overview = await getJson(baseUrl, '/api/project-reports/overview');
            expect(overview).toHaveProperty('totalReports');

            const reports = await getJson(baseUrl, '/api/project-reports/reports');
            expect(Array.isArray(reports)).toBe(true);
            expect(reports.length).toBeGreaterThan(0);

            const projects = await getJson(baseUrl, '/api/project-reports/projects');
            expect(Array.isArray(projects)).toBe(true);
        });
    });

    test('assets-library endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/assets-library');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('assets');

            const overview = await getJson(baseUrl, '/api/assets-library/overview');
            expect(overview).toHaveProperty('totalAssets');

            const assets = await getJson(baseUrl, '/api/assets-library/assets');
            expect(Array.isArray(assets)).toBe(true);
            expect(assets.length).toBeGreaterThan(0);

            const categories = await getJson(baseUrl, '/api/assets-library/categories');
            expect(Array.isArray(categories)).toBe(true);
        });
    });

    test('code-templates endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/code-templates');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('templates');

            const overview = await getJson(baseUrl, '/api/code-templates/overview');
            expect(overview).toHaveProperty('totalSnippets');

            const templates = await getJson(baseUrl, '/api/code-templates/templates');
            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThan(0);

            const categories = await getJson(baseUrl, '/api/code-templates/categories');
            expect(Array.isArray(categories)).toBe(true);
        });
    });

    test('coverage-reports endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/coverage-reports');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('projects');

            const overview = await getJson(baseUrl, '/api/coverage-reports/overview');
            expect(overview).toHaveProperty('overallCoverage');
            expect(overview.totalTests).toBe(REPOSITORY_AUDIT_BASELINE.jestTestsPassing);
            if (overview.coverageCollection === 'istanbul') {
                expect(overview.lineCoverage).toBeGreaterThan(0);
            }

            const projects = await getJson(baseUrl, '/api/coverage-reports/projects');
            expect(Array.isArray(projects)).toBe(true);
            expect(projects.length).toBeGreaterThan(0);

            const trends = await getJson(baseUrl, '/api/coverage-reports/trends');
            expect(Array.isArray(trends)).toBe(true);
        });
    });

    test('settings endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/settings');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('userSettings');

            const overview = await getJson(baseUrl, '/api/settings/overview');
            expect(overview).toHaveProperty('totalUsers');

            const user = await getJson(baseUrl, '/api/settings/user');
            expect(user).toHaveProperty('profile');

            const system = await getJson(baseUrl, '/api/settings/system');
            expect(system).toHaveProperty('platform');
        });
    });

    test('help endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/help');
            expect(full.success).toBe(true);
            expect(full.data).toHaveProperty('documentation');

            const overview = await getJson(baseUrl, '/api/help/overview');
            expect(overview).toHaveProperty('totalDocs');

            const docs = await getJson(baseUrl, '/api/help/documentation');
            expect(Array.isArray(docs)).toBe(true);
            expect(docs.length).toBeGreaterThan(0);

            const faq = await getJson(baseUrl, '/api/help/faq');
            expect(Array.isArray(faq)).toBe(true);
        });
    });

    test('implementation-plan endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/implementation-plan');
            expect(full.success).toBe(true);
            expect(full.data.type).toBe('implementation-plan-model');

            const summary = await getJson(baseUrl, '/api/implementation-plan/summary');
            expect(summary).toHaveProperty('currentCompletion');

            const phases = await getJson(baseUrl, '/api/implementation-plan/phases');
            expect(Array.isArray(phases)).toBe(true);
            expect(phases.length).toBeGreaterThan(0);
        });
    });

    test('analytics endpoint returns model payload', async () => {
        await withStubServer(async (baseUrl) => {
            const analytics = await getJson(baseUrl, '/api/analytics');
            expect(analytics.success).toBe(true);
            expect(analytics.data).toHaveProperty('overview');
            expect(analytics.data.type).toBe('analytics-model');
        });
    });

    test('dashboard-home endpoint returns data', async () => {
        await withStubServer(async (baseUrl) => {
            const full = await getJson(baseUrl, '/api/dashboard-home');
            expect(full.success).toBe(true);
            expect(full.data.type).toBe('dashboard-home-model');
            expect(full.data.overview.totalFiles).toBeDefined();
        });
    });

    test('quality dashboard endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const overview = await getJson(baseUrl, '/api/quality/overview');
            expect(overview).toHaveProperty('issuesFound');

            const metrics = await getJson(baseUrl, '/api/quality/metrics');
            expect(Array.isArray(metrics)).toBe(true);
        });
    });

    test('security dashboard endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const overview = await getJson(baseUrl, '/api/security/overview');
            expect(overview).toHaveProperty('securityScore');
            expect(typeof overview.npmAuditTotal).toBe('number');
            expect(overview.npmAuditTotal).toBeGreaterThanOrEqual(0);
            expect(overview.criticalVulnerabilities).toBe(0);

            const threats = await getJson(baseUrl, '/api/security/threats');
            expect(Array.isArray(threats)).toBe(true);

            const npmAudit = await getJson(baseUrl, '/api/security/npm-audit');
            expect(npmAudit).toHaveProperty('dataSource', 'npm-audit');
            expect(npmAudit).toHaveProperty('vulnerabilities');
            expect(Array.isArray(npmAudit.vulnerabilities)).toBe(true);

            const vulnerabilities = await getJson(baseUrl, '/api/security/vulnerabilities');
            expect(Array.isArray(vulnerabilities)).toBe(true);
            expect(vulnerabilities.some((item) => item.id === 'SEC-004' && item.status === 'resolved')).toBe(true);
        });
    });

    test('support dashboard endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const overview = await getJson(baseUrl, '/api/support/overview');
            expect(overview).toHaveProperty('openTickets');

            const tickets = await getJson(baseUrl, '/api/support/tickets');
            expect(Array.isArray(tickets)).toBe(true);
        });
    });

    test('tier-1 page stub endpoints return data', async () => {
        await withStubServer(async (baseUrl) => {
            const aiAnalysis = await getJson(baseUrl, '/api/ai-analysis');
            expect(aiAnalysis.success).toBe(true);
            expect(aiAnalysis.data).toHaveProperty('overview');

            const aiTools = await getJson(baseUrl, '/api/ai-tools');
            expect(aiTools.success).toBe(true);
            expect(Array.isArray(aiTools.data?.tools || aiTools.tools)).toBe(true);

            const database = await getJson(baseUrl, '/api/database');
            expect(database.success).toBe(true);
            expect(Array.isArray(database.data?.databases || database.databases)).toBe(true);

            const codeGen = await getJson(baseUrl, '/api/code-generation');
            expect(codeGen.success).toBe(true);
            expect(codeGen.data).toHaveProperty('stats');

            const templates = await getJson(baseUrl, '/api/code-generation/templates');
            expect(templates.success).toBe(true);
            expect(Array.isArray(templates.templates)).toBe(true);

            const reports = await getJson(baseUrl, '/api/reports');
            expect(reports.success).toBe(true);
            expect(Array.isArray(reports.data?.reports || reports.reports)).toBe(true);

            const issues = await getJson(baseUrl, '/api/issues/resolution');
            expect(issues.success).toBe(true);
            expect(Array.isArray(issues.data?.issues || issues.issues)).toBe(true);

            const issueList = await getJson(baseUrl, '/api/issues');
            expect(issueList.success).toBe(true);
            expect(Array.isArray(issueList.issues)).toBe(true);

            const roadmap = await getJson(baseUrl, '/api/ai-roadmap/report');
            expect(roadmap.success).toBe(true);
            expect(roadmap.data).toHaveProperty('developmentPhases');

            const aiRoadmap = await getJson(baseUrl, '/api/roadmap/data?type=ai-powered');
            expect(aiRoadmap.success).toBe(true);
            expect(aiRoadmap.data.type).toBe('ai-roadmap-report-model');
        });
    });

    test('reduction-scan validates bad projectPath and supports sample-data-only scope', async () => {
        await withStubServer(async (baseUrl) => {
            const badPathRes = await fetch(`${baseUrl}/api/merger-tool/reduction-scan?projectPath=does-not-exist`);
            expect(badPathRes.status).toBe(400);
            const badPathBody = await badPathRes.json();
            expect(badPathBody.success).toBe(false);

            const scopedRes = await fetch(`${baseUrl}/api/merger-tool/reduction-scan?scope=sample-data-only`);
            expect(scopedRes.ok).toBe(true);
            const scopedBody = await scopedRes.json();
            expect(scopedBody.success).toBe(true);
            expect(scopedBody.scope).toBe('sample-data-only');
        });
    });

    test('roadmap data endpoint serves ai-powered type only', async () => {
        await withStubServer(async (baseUrl) => {
            const aiRoadmap = await getJson(baseUrl, '/api/roadmap/data?type=ai-powered');
            expect(aiRoadmap.success).toBe(true);
            expect(aiRoadmap.type).toBe('ai-powered');

            const unknownRes = await fetch(`${baseUrl}/api/roadmap/data?type=gguf`);
            expect(unknownRes.status).toBe(404);
            const unknownBody = await unknownRes.json();
            expect(unknownBody.success).toBe(false);
        });
    });
});
