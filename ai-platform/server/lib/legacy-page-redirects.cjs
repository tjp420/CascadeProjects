/**
 * Retire legacy HTML pages — redirect to Simplebeacon SPA routes.
 */

const logger = require("./app-logger.cjs");

const LEGACY_REDIRECTS = {
  "/dashboard-new.html": "/",
  "/dashboard.html": "/",
  "/unified-dashboard.html": "/",
  "/unified-dashboard-enhanced.html": "/",
  "/ai-tools": "/#/platform",
  "/ai-roadmap": "/#/platform",
  "/ai-analysis": "/#/analyze",
  "/gguf-analysis": "/#/analyze",
  "/reports": "/#/results",
  "/analytics": "/#/platform",
  "/performance": "/#/platform",
  "/dev-tools": "/#/tools",
  "/database": "/#/platform",
  "/api": "/#/platform",
  "/layout-analyzer": "/#/analyze",
  "/code-generation": "/#/tools",
  "/merger-tool": "/#/tools",
  "/mock-data-analyzer": "/#/analyze",
  "/issue-resolution": "/#/results",
  "/ai-powered-roadmap": "/#/platform",
  "/development-roadmap": "/#/platform",
  "/release-timeline": "/#/platform",
  "/feature-backlog": "/#/platform",
  "/debt-calculator": "/#/platform",
  "/debt-reduction": "/#/platform",
  "/debt-analytics": "/#/platform",
  "/billing-system": "/#/pricing",
  "/assets-library": "/#/platform",
  "/code-templates": "/#/tools",
  "/coverage-reports": "/#/quality",
  "/settings": "/#/settings",
  "/help": "/#/help",
  "/ai-roadmap-report": "/#/platform",
  "/quality-dashboard": "/#/quality",
  "/security-dashboard": "/#/quality",
  "/support-dashboard": "/#/help",
  "/implementation-plan": "/#/platform",
  "/project-reports": "/#/results",
  "/context-search": "/#/analyze",
  "/website-analyzer": "/#/analyze",
  "/gguf-roadmap-enhanced": "/#/platform",
  "/unified-roadmap-enhanced": "/#/platform",
  "/directory-analyzer": "/#/analyze",
  "/url-analyzer": "/#/analyze",
  "/roadmap-builder": "/#/platform",
  "/enhanced-roadmap-dashboard": "/#/platform",
};

/**
 * Should log runtime info.
 * @returns {any}
 */
function shouldLogRuntimeInfo() {
  return (
    process.env.LOG_RUNTIME_INFO === "true" ||
    process.env.RUNTIME_DEBUG === "true"
  );
}

/**
 * Resolve legacy target.
 * @param {any} from
 * @param {any} to
 * @param {any} landingEnabled
 * @param {any} internalDashboard
 * @returns {any}
 */
function resolveLegacyTarget(from, to, landingEnabled, internalDashboard) {
  if (!landingEnabled) return to;
  const dashboardAtRoot = internalDashboard === true;
  if (to.startsWith("/#/")) {
    return dashboardAtRoot ? to : `/app${to.slice(1)}`;
  }
  if (
    /\/dashboard.*\.html$/i.test(from) ||
    /^\/unified-dashboard/i.test(from)
  ) {
    return dashboardAtRoot ? "/" : "/app";
  }
  return to;
}

/**
 * Register legacy page redirects.
 * @param {any} app
 * @returns {any}
 */
function registerLegacyPageRedirects(app) {
  const landingEnabled = process.env.SIMPLEBEACON_LANDING === "true";
  const internalDashboard =
    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === "true";

  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    app.get(from, function legacyRedirect(_req, res) {
      // rateLimit: static legacy routes handled by global security middleware
      const target =
        "" + resolveLegacyTarget(from, to, landingEnabled, internalDashboard);
      res.setHeader("Location", target);
      res.status(301).end();
    });
  }

  // /audit and /compliance-audit are now served by the marketing landing pages (coming-soon/public/audit.html)
  // so no legacy dashboard redirects should intercept them.

  if (shouldLogRuntimeInfo()) {
    logger.info(
      `[Legacy] ${Object.keys(LEGACY_REDIRECTS).length} HTML routes redirect to Simplebeacon SPA`,
    );
  }
}

module.exports = {
  registerLegacyPageRedirects,
  LEGACY_REDIRECTS,
  resolveLegacyTarget,
};
