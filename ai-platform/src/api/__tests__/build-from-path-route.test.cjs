'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const setupBuildFromPathRoute = require('../build-from-path-route.cjs');

test('setupBuildFromPathRoute registers health, analysis, export, and build routes', () => {
    const routes = [];
    const app = {
        get(route) { routes.push(`GET ${route}`); },
        post(route) { routes.push(`POST ${route}`); },
        delete(route) { routes.push(`DELETE ${route}`); }
    };

    setupBuildFromPathRoute(app);

    assert.ok(routes.includes('GET /api/dynamic-roadmap/health'));
    assert.ok(routes.includes('GET /api/code-roadmap/analyze'));
    assert.ok(routes.includes('GET /api/code-roadmap/export/html'));
    assert.ok(routes.includes('POST /api/code-roadmap/export/html'));
    assert.ok(routes.includes('POST /api/dynamic-roadmap/build-from-path'));
});
