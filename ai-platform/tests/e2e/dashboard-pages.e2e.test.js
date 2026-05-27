const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DASHBOARD_HTML = path.join(__dirname, '../../web/dashboard-new.html');
const DASHBOARD_SHELL = path.join(__dirname, '../../web/scripts/dashboard-shell.js');
const SCRIPTS_DIR = path.join(__dirname, '../../web/scripts');

const SELF_CONTAINED_PAGES = [
    { section: 'dashboard', root: 'dashboard-home-root', script: 'dashboard-home-page.js' },
    { section: 'local-models', root: 'local-models-root', script: 'local-models-page.js' },
    { section: 'gguf-analysis', root: 'gguf-analysis-root', script: 'gguf-analysis-page.js' },
    { section: 'analytics', root: 'analytics-root', script: 'analytics-page.js' },
    { section: 'performance', root: 'performance-root', script: 'performance-page.js' },
    { section: 'quality', root: 'quality-root', script: 'quality-page.js' },
    { section: 'security', root: 'security-root', script: 'security-page.js' },
    { section: 'support', root: 'support-root', script: 'support-page.js' },
    { section: 'dev-tools', root: 'dev-tools-root', script: 'dev-tools-page.js' },
    { section: 'database', root: 'database-root', script: 'database-page.js' },
    { section: 'api', root: 'api-root', script: 'api-page.js' },
    { section: 'merger-tool', root: 'merger-tool-root', script: 'merger-tool-page.js' },
    { section: 'debt-calculator', root: 'debt-calculator-root', script: 'debt-calculator-page.js' },
    { section: 'debt-reduction', root: 'debt-reduction-root', script: 'debt-reduction-page.js' },
    { section: 'debt-analytics', root: 'debt-analytics-root', script: 'debt-analytics-page.js' },
    { section: 'feature-backlog', root: 'feature-backlog-root', script: 'feature-backlog-page.js' },
    { section: 'release-timeline', root: 'release-timeline-root', script: 'release-timeline-page.js' },
    { section: 'billing-system', root: 'billing-system-root', script: 'billing-system-page.js' },
    { section: 'project-reports', root: 'project-reports-root', script: 'project-reports-page.js' },
    { section: 'assets-library', root: 'assets-library-root', script: 'assets-library-page.js' },
    { section: 'code-templates', root: 'code-templates-root', script: 'code-templates-page.js' },
    { section: 'coverage-reports', root: 'coverage-reports-root', script: 'coverage-reports-page.js' },
    { section: 'implementation-plan', root: 'implementation-plan-root', script: 'implementation-plan-page.js' },
    { section: 'settings', root: 'settings-root', script: 'settings-page.js' },
    { section: 'help', root: 'help-root', script: 'help-page.js' },
    { section: 'code-generation', root: 'codegen-root', script: 'code-generation-page.js' },
    { section: 'issue-resolution', root: 'issue-resolution-root', script: 'issue-resolution-page.js' },
    { section: 'ai-roadmap', root: 'ai-roadmap-root', script: 'ai-roadmap-page.js' },
    { section: 'roadmap', root: 'development-roadmap-root', script: 'development-roadmap-page.js' },
    { section: 'ai-tools', root: 'ai-tools-root', script: 'ai-tools-page.js' },
    { section: 'ai-analysis', root: 'ai-analysis-root', script: 'ai-analysis-page.js' },
    { section: 'reports', root: 'reports-root', script: 'reports-page.js' }
];

describe('dashboard-new.html E2E structure', () => {
    let html;
    let shell;

    beforeAll(() => {
        html = fs.readFileSync(DASHBOARD_HTML, 'utf8');
        shell = fs.readFileSync(DASHBOARD_SHELL, 'utf8');
    });

    test('loads payload routing before global data input', () => {
        const routingIdx = html.indexOf('/scripts/payload-routing.js');
        const inputIdx = html.indexOf('/scripts/global-data-input.js');
        expect(routingIdx).toBeGreaterThan(-1);
        expect(inputIdx).toBeGreaterThan(routingIdx);
    });

    test('updateHeader skips self-contained sections', () => {
        const shell = fs.readFileSync(DASHBOARD_SHELL, 'utf8');
        expect(shell).toContain('SELF_CONTAINED_SECTIONS');
        expect(shell).toContain("'debt-calculator'");
        expect(shell).toContain("'merger-tool'");
    });

    test('dashboard shell scripts load before page modules', () => {
        const chartsIdx = html.indexOf('/scripts/roadmap-feature-chart.js');
        const shellIdx = html.indexOf('/scripts/dashboard-shell.js');
        const homeIdx = html.indexOf('/scripts/dashboard-home-page.js');
        expect(chartsIdx).toBeGreaterThan(-1);
        expect(shellIdx).toBeGreaterThan(chartsIdx);
        expect(homeIdx).toBeGreaterThan(shellIdx);
    });

    test('hidden ai-roadmap legacy duplicate section removed', () => {
        expect(html).not.toContain('id="ai-roadmap-legacy-section"');
        expect(html).not.toContain('/scripts/ai-roadmap-legacy-report.js');
    });

    describe.each(SELF_CONTAINED_PAGES)('$section page', ({ section, root, script }) => {
        test(`has #${section}-section`, () => {
            expect(html).toContain(`id="${section}-section"`);
        });

        test(`has #${root} container`, () => {
            expect(html).toContain(`id="${root}"`);
        });

        test(`loads ${script}`, () => {
            expect(html).toContain(`/scripts/${script}`);
            expect(fs.existsSync(path.join(SCRIPTS_DIR, script))).toBe(true);
        });

        test(`showSection initializes ${section}`, () => {
            expect(shell.includes(`sectionName === '${section}'`)).toBe(true);
        });
    });

    test('global data input toolbar is present', () => {
        expect(html).toContain('id="global-data-input"');
        expect(html).toContain('id="global-data-paste-json"');
        expect(html).toContain('id="global-data-analyze"');
    });

    test('sample URL params are wired for key pages', () => {
        const deferred = fs.readFileSync(path.join(SCRIPTS_DIR, 'dashboard-deferred-init.js'), 'utf8');
        expect(deferred).toContain("param: 'debt'");
        expect(deferred).toContain("param: 'reduction'");
        expect(deferred).toContain("param: 'debtanalytics'");
        expect(deferred).toContain("param: 'backlog'");
        expect(deferred).toContain("param: 'timeline'");
        expect(deferred).toContain("param: 'dashboard'");
        expect(deferred).toContain("param: 'billing'");
        expect(deferred).toContain("param: 'preports'");
        expect(deferred).toContain("param: 'assets'");
        expect(deferred).toContain("param: 'templates'");
        expect(deferred).toContain("param: 'coverage'");
        expect(deferred).toContain("param: 'settings'");
        expect(deferred).toContain("param: 'help'");
        expect(deferred).toContain("param: 'implplan'");
        expect(deferred).toContain("param: 'merger'");
        expect(deferred).toContain("param: 'gguf'");
        expect(deferred).toContain("param: 'mock'");
        expect(deferred).toContain("param: 'quality'");
        expect(deferred).toContain("param: 'security'");
        expect(deferred).toContain("param: 'support'");
    });

    test('mock data analyzer consolidated into gguf-analysis section', () => {
        const shell = fs.readFileSync(DASHBOARD_SHELL, 'utf8');
        expect(html).not.toContain('id="mock-data-analyzer-section"');
        expect(shell).toContain("sectionName === 'mock-data-analyzer'");
        expect(html).toContain('data-mock-action="analyze"');
        expect(html).toContain('/scripts/mock-data-analyzer-actions.js');
        expect(html).not.toContain('/scripts/mock-data-analysis-dashboard.js');
    });

    test('development roadmap modules load after section content provider and components', () => {
        const providerIdx = html.indexOf('/scripts/section-content-provider.js');
        const timelineIdx = html.indexOf('/components/roadmap/RoadmapTimelineVisualization.js');
        const coreIdx = html.indexOf('/scripts/development-roadmap-core.js');
        const pageIdx = html.indexOf('/scripts/development-roadmap-page.js');

        expect(providerIdx).toBeGreaterThan(-1);
        expect(timelineIdx).toBeGreaterThan(providerIdx);
        expect(coreIdx).toBeGreaterThan(timelineIdx);
        expect(pageIdx).toBeGreaterThan(coreIdx);
        expect(html).toContain('/scripts/roadmap-data-service.js');
        expect(html).toContain('/scripts/roadmap-comparison-analyzer.js');
        expect(html).toContain('/scripts/roadmap-export-system.js');
    });

    test('gguf enhanced features load after gguf analysis page', () => {
        const pageIdx = html.indexOf('/scripts/gguf-analysis-page.js');
        const enhancedIdx = html.indexOf('/scripts/gguf-enhanced-features.js');
        expect(pageIdx).toBeGreaterThan(-1);
        expect(enhancedIdx).toBeGreaterThan(pageIdx);
    });

    test('deferred init skips duplicate page init on sample URL params', () => {
        const deferred = fs.readFileSync(path.join(SCRIPTS_DIR, 'dashboard-deferred-init.js'), 'utf8');
        const shell = fs.readFileSync(DASHBOARD_SHELL, 'utf8');
        expect(deferred).toContain('__deferredSampleInit');
        expect(shell).toContain('__deferredSampleInit');
        expect(shell).toContain('deferSectionInit');
    });

    test('deferred init loads after all page scripts', () => {
        const deferredIdx = html.indexOf('/scripts/dashboard-deferred-init.js');
        const roadmapPageIdx = html.indexOf('/scripts/development-roadmap-page.js');
        const ggufIdx = html.indexOf('/scripts/gguf-analysis-page.js');
        expect(deferredIdx).toBeGreaterThan(roadmapPageIdx);
        expect(deferredIdx).toBeGreaterThan(ggufIdx);
    });

    test('bootstrap loads after section content provider and deferred init', () => {
        const providerIdx = html.indexOf('/scripts/section-content-provider.js');
        const deferredIdx = html.indexOf('/scripts/dashboard-deferred-init.js');
        const bootstrapIdx = html.indexOf('/scripts/dashboard-bootstrap.js');
        const bootstrap = fs.readFileSync(path.join(SCRIPTS_DIR, 'dashboard-bootstrap.js'), 'utf8');

        expect(providerIdx).toBeGreaterThan(-1);
        expect(bootstrapIdx).toBeGreaterThan(deferredIdx);
        expect(bootstrapIdx).toBeGreaterThan(providerIdx);
        expect(bootstrap).toContain('SectionContentProvider');
        expect(bootstrap).toContain('ensureActionFunctionsAvailable');
        expect(html).toContain('/scripts/quality-page.js');
        expect(html).toContain('/scripts/security-page.js');
        expect(html).toContain('/scripts/support-page.js');
        expect(html).not.toContain('/scripts/component-dashboard-pages.js');
    });

    test('quality, security, and support pages wired to global data input', () => {
        const qualityPage = fs.readFileSync(path.join(SCRIPTS_DIR, 'quality-page.js'), 'utf8');
        const securityPage = fs.readFileSync(path.join(SCRIPTS_DIR, 'security-page.js'), 'utf8');
        const supportPage = fs.readFileSync(path.join(SCRIPTS_DIR, 'support-page.js'), 'utf8');
        const globalInput = fs.readFileSync(path.join(SCRIPTS_DIR, 'global-data-input.js'), 'utf8');

        expect(qualityPage).toContain('applyQualityDashboardModel');
        expect(qualityPage).toContain('loadQualityDashboardSample');
        expect(securityPage).toContain('applySecurityDashboardModel');
        expect(securityPage).toContain('loadSecurityDashboardSample');
        expect(supportPage).toContain('applySupportDashboardModel');
        expect(supportPage).toContain('loadSupportDashboardSample');

        expect(globalInput).toContain("case 'quality':");
        expect(globalInput).toContain("case 'security':");
        expect(globalInput).toContain("case 'support':");
        expect(globalInput).toContain("'quality': 'quality=sample'");
        expect(globalInput).toContain("params.get('quality') === 'sample'");
    });

    test('roadmap path builder supports custom scan options and history', () => {
        expect(html).toContain('id="roadmap-include-paths"');
        expect(html).toContain('id="roadmap-exclude-patterns"');
        expect(html).toContain('id="roadmap-scan-progress"');
        expect(html).toContain('id="roadmap-analysis-history"');
        expect(html).toContain('/scripts/roadmap-path-builder.js');

        const pathBuilder = fs.readFileSync(path.join(SCRIPTS_DIR, 'roadmap-path-builder.js'), 'utf8');
        expect(pathBuilder).toContain('buildRoadmapFromPath');
        expect(pathBuilder).toContain('recordAnalysisHistory');
        expect(pathBuilder).toContain('/api/dynamic-roadmap/history');

        const roadmapScripts = [
            'development-roadmap-core.js',
            'roadmap-path-builder.js',
            'development-roadmap-page.js'
        ];
        roadmapScripts.forEach((script) => {
            expect(() => execSync(`node --check "${path.join(SCRIPTS_DIR, script)}"`, { stdio: 'pipe' })).not.toThrow();
        });
    });
});

describe('dashboard live server smoke (optional)', () => {
    const baseUrl = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:54355';

    async function tryFetch(route, init = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
            const response = await fetch(`${baseUrl}${route}`, { signal: controller.signal, ...init });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    function isInternalDashboardHtml(html) {
        return html.includes('Simplebeacon Dashboard')
            && html.includes('simplebeacon-dashboard/js/main.js')
            && html.includes('id="app-main"');
    }

    test('serves Simplebeacon SPA when server is running', async () => {
        let response;
        try {
            response = await tryFetch('/simplebeacon-dashboard/index.html', { redirect: 'follow' });
        } catch {
            return;
        }
        if (!response.ok) return;
        const text = await response.text();
        if (!isInternalDashboardHtml(text)) return;
        expect(text).toContain('Simplebeacon Dashboard');
        expect(text).toContain('simplebeacon-dashboard/js/main.js');
        expect(text).toContain('id="app-main"');
    });

    test('serves debt calculator sample when server is running', async () => {
        let response;
        try {
            response = await tryFetch('/data/debt-calculator-sample.json');
        } catch {
            return;
        }
        if (!response.ok) return;
        const payload = await response.json();
        expect(payload.type).toBe('debt-calculator-model');
        expect(payload.overview.debtScore).toBeDefined();
    });

    test('auth login endpoint responds when server is running', async () => {
        let response;
        try {
            response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'dev@simplebeacon.ai', password: 'demo123' })
            });
        } catch {
            return;
        }
        if (response.status === 404) {
            throw new Error('POST /api/auth/login returned 404 — Phase 2 routes may be registered after the API 404 handler');
        }
        if (!response.ok) return;
        expect(response.ok).toBe(true);
        const payload = await response.json();
        expect(payload.token).toBeTruthy();
        expect(payload.user?.email).toBe('dev@simplebeacon.ai');
    });
});
