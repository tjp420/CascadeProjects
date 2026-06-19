/**
 * Register all operator deliverable + EU AI Act routes (require from dashboard server bootstrap).
 */

const fs = require('fs');
const path = require('path');
const { registerOperatorDeliverableRoute } = require('./operator-deliverable-route.cjs');
const { registerEuAiActSprintRoute } = require('./eu-ai-act-sprint-route.cjs');

/**
 * Register operator landing pages.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerOperatorLandingPages(app, options = {}) {
  const landingRoot = options.landingRoot
    || path.join(options.projectRoot || path.join(__dirname, '../..'), '..', 'coming-soon');
  if (!fs.existsSync(landingRoot)) return;

  const pages = [
    { route: '/operator/eu-ai-act', file: 'operator-eu-ai-act.html' },
    { route: '/operator/bookings', file: 'operator-bookings.html' }
  ];

  for (const page of pages) {
    const filePath = path.join(landingRoot, page.file);
    if (!fs.existsSync(filePath)) continue;
    app.get([page.route, `${page.route}/`], (_req, res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.type('text/html');
      res.sendFile(filePath);
    });
  }
}

/**
 * Register operator routes.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerOperatorRoutes(app, options = {}) {
  registerOperatorDeliverableRoute(app, options);
  registerEuAiActSprintRoute(app, options);
  registerOperatorLandingPages(app, options);
}

module.exports = { registerOperatorRoutes, registerOperatorLandingPages };