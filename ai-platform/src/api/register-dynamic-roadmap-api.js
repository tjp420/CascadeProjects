/**
 * Register dynamic roadmap API routes (including build-from-path) on an Express app.
 */

const path = require('path');
const GlobalContextManager = require('../core/GlobalContextManager');
const DynamicRoadmapAPI = require('./dynamic-roadmap-api');
const setupBuildFromPathRoute = require('./build-from-path-route');
const { setupRoadmapAnalysisHistoryRoutes } = require('./roadmap-analysis-history');

/**
 * @param {import('express').Express} app
 * @param {string} [scanRoot] - Directory for default GlobalContextManager scans
 * @param {{ skipBuildFromPath?: boolean }} [options]
 * @returns {DynamicRoadmapAPI}
 */
function registerDynamicRoadmapApi(app, scanRoot, options = {}) {
    if (!options.skipBuildFromPath) {
        setupBuildFromPathRoute(app);
    } else {
        setupRoadmapAnalysisHistoryRoutes(app);
    }
    const root = scanRoot || path.join(__dirname, '..');
    const globalContextManager = new GlobalContextManager(root);
    return new DynamicRoadmapAPI(app, globalContextManager);
}

module.exports = registerDynamicRoadmapApi;
module.exports.setupBuildFromPathRoute = setupBuildFromPathRoute;
