/**
 * Retire legacy HTML pages — redirect to Simplebeacon SPA routes.
 */

const logger = require('./app-logger.cjs');

const LEGACY_REDIRECTS = {
  '/dashboard-new.html': '/',
  '/dashboard.html': '/',
  '/unified-dashboard.html': '/',
  '/unified-dashboard-enhanced.html': '/',
  '/ai-tools': '/#/platform',
  '/ai-roadmap': '/#/platform',
  '/ai-analysis': '/#/analyze',
  '/gguf-analysis': '/#/analyze',
  '/reports': '/#/results',
  '/analytics': '/#/platform',
  '/performance': '/#/platform',
  '/dev-tools': '/#/tools',
  '/database': '/#/platform',
  '/api': '/#/platform',
  '/layout-analyzer': '/#/analyze',
  '/code-generation': '/#/tools',
  '/merger-tool': '/#/tools',
  '/mock-data-analyzer': '/#/analyze',
  '/issue-resolution': '/#/results',
  '/ai-powered-roadmap': '/#/platform',
  '/development-roadmap': '/#/platform',
  '/release-timeline': '/#/platform',
  '/feature-backlog': '/#/platform',
  '/debt-calculator': '/#/platform',
  '/debt-reduction': '/#/platform',
  '/debt-analytics': '/#/platform',
  '/billing-system': '/#/pricing',
  '/assets-library': '/#/platform',
  '/code-templates': '/#/tools',
  '/coverage-reports': '/#/quality',
  '/settings': '/#/settings',
  '/help': '/#/help',
  '/ai-roadmap-report': '/#/platform',
  '/quality-dashboard': '/#/quality',
  '/security-dashboard': '/#/quality',
  '/support-dashboard': '/#/help',
  '/implementation-plan': '/#/platform',
  '/project-reports': '/#/results',
  '/context-search': '/#/analyze',
  '/website-analyzer': '/#/analyze',
  '/gguf-roadmap-enhanced': '/#/platform',
  '/unified-roadmap-enhanced': '/#/platform',
  '/directory-analyzer': '/#/analyze',
  '/url-analyzer': '/#/analyze',
  '/roadmap-builder': '/#/platform',
  '/enhanced-roadmap-dashboard': '/#/platform'
};

function shouldLogRuntimeInfo() {
  return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

function resolveLegacyTarget(from, to, landingEnabled, internalDashboard) {
  if (!landingEnabled) return to;
  const dashboardAtRoot = internalDashboard === true;
  if (to.startsWith('/#/')) {
    return dashboardAtRoot ? to : `/app${to.slice(1)}`;
  }
  if (/\/dashboard.*\.html$/i.test(from) || /^\/unified-dashboard/i.test(from)) {
    return dashboardAtRoot ? '/' : '/app';
  }
  return to;
}

function registerLegacyPageRedirects(app) {
  const landingEnabled = process.env.SIMPLEBEACON_LANDING === 'true';
  const internalDashboard = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true';

  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    app.get(from, (_req, res) => {
      res.redirect(301, resolveLegacyTarget(from, to, landingEnabled, internalDashboard));
    });
  }

  if (landingEnabled) {
    const auditTarget = internalDashboard ? '/#/audit' : '/app#/audit';
    app.get('/audit', (_req, res) => res.redirect(301, auditTarget));
    app.get('/compliance-audit', (_req, res) => res.redirect(301, auditTarget));
  }

  if (shouldLogRuntimeInfo()) {
    logger.info(`[Legacy] ${Object.keys(LEGACY_REDIRECTS).length} HTML routes redirect to Simplebeacon SPA`);
  }
}

module.exports = { registerLegacyPageRedirects, LEGACY_REDIRECTS, resolveLegacyTarget };
