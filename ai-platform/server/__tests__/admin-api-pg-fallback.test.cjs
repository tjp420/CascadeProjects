"use strict";

process.env.NODE_ENV = "development";
process.env.DEV_AUTH_BYPASS = "1";
process.env.ALLOW_DEV_EPHEMERAL_SECRETS = "true";
process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = require("path").join(
  require("os").tmpdir(),
  "sb-admin-tier-test-subscriptions.json",
);

const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const { setupAdminAPI } = require("../routes/admin-api.cjs");

describe("admin-api postgres fallback", () => {
  const app = express();
  app.use(express.json());
  app.locals.db = {
    query: async () => {
      throw new Error('relation "users" does not exist');
    },
  };
  setupAdminAPI(app);
  const server = app.listen(0);
  const port = server.address().port;

  after(() => {
    server.close();
  });

  it("GET /api/admin/stats returns 200 when Postgres users table is missing", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/stats`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.stats);
    assert.equal(typeof body.stats.totalAccounts, "number");
  });

  it("GET /api/admin/users returns 200 when Postgres users table is missing", async () => {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/admin/users?limit=20`,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.users));
  });

  it("POST /api/admin/users/:id/trust-level returns 404 not 500 when Postgres users table is missing", async () => {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/admin/users/missing-user-id/trust-level`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "admin123",
          trustLevel: "gold",
          subscriptionTier: "developer",
        }),
      },
    );
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
  });
});
