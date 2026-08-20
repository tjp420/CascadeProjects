"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setupOptimizationAPI } = require("../optimization-api.cjs");

test("setupOptimizationAPI registers the health and optimization routes", () => {
  const routes = [];
  const app = {
    get(route) {
      routes.push(`GET ${route}`);
    },
    post(route) {
      routes.push(`POST ${route}`);
    },
  };

  setupOptimizationAPI(app, {
    platformRoot: process.cwd(),
    monorepoRoot: process.cwd(),
  });

  assert.ok(routes.includes("GET /api/optimization/health"));
  assert.ok(routes.includes("GET /api/optimization/compliance"));
  assert.ok(routes.includes("POST /api/optimization/analyze"));
  assert.ok(routes.includes("POST /api/optimization/merge-preview"));
  assert.ok(routes.includes("POST /api/optimization/merge-execute"));
  assert.ok(routes.includes("POST /api/optimization/merge-rollback"));
});
