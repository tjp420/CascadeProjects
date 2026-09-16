"use strict";

/**
 * Happy path: POST /api/admin/users/customer-{id}/trust-level
 * when Postgres users is missing. Asserts SQLite customer mutation
 * and real upsertSubscription file-store write.
 *
 * Not Jest: this workspace uses node:test + fetch. licenseTier maps
 * from gold trust → team_pro (trustLevelToTier), not the string "gold".
 */

process.env.NODE_ENV = "development";
process.env.DEV_AUTH_BYPASS = "1";
process.env.ALLOW_DEV_EPHEMERAL_SECRETS = "true";
process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = require("path").join(
  require("os").tmpdir(),
  "sb-admin-customer-tier-subscriptions.json",
);

const fs = require("fs");
const path = require("path");
const { describe, it, after, before } = require("node:test");
const assert = require("node:assert");
const express = require("express");

const sqliteCalls = {
  getAllCustomers: 0,
  updateCustomerSubscription: [],
  getOrCreateCustomer: [],
};

const mockEmail = "beta-tester@example.com";
const mockSqlite = {
  getUserById: () => null,
  getUserByEmail: () => null,
  getAllUsers: () => [],
  getAllCustomers: () => {
    sqliteCalls.getAllCustomers += 1;
    return [
      {
        id: 12,
        email: mockEmail,
        stripe_customer_id: "cus_TEST123",
        tier: "community",
        subscription_status: "inactive",
      },
    ];
  },
  getOrCreateCustomer: (email) => {
    sqliteCalls.getOrCreateCustomer.push(email);
    return { id: 12, email };
  },
  updateCustomerSubscription: (email, status, tier) => {
    sqliteCalls.updateCustomerSubscription.push([email, status, tier]);
  },
  updateUserTierById: () => {},
};

const dbAbs = require.resolve("../../../coming-soon/lib/db.cjs");
require.cache[dbAbs] = {
  id: dbAbs,
  filename: dbAbs,
  loaded: true,
  exports: mockSqlite,
};

const { setupAdminAPI } = require("../routes/admin-api.cjs");
const { readStore } = require("../lib/simplebeacon-subscription-store.cjs");

describe("admin-api customer-* trust-level happy path", () => {
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
  const storePath = process.env.SIMPLEBEACON_SUBSCRIPTION_STORE;

  before(() => {
    sqliteCalls.getAllCustomers = 0;
    sqliteCalls.updateCustomerSubscription = [];
    sqliteCalls.getOrCreateCustomer = [];
    try {
      fs.unlinkSync(storePath);
    } catch {
      /* missing is fine */
    }
  });

  after(() => {
    server.close();
    try {
      fs.unlinkSync(storePath);
    } catch {
      /* ignore */
    }
  });

  it("POST customer-12 updates SQLite customers and the subscription file store", async () => {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/admin/users/customer-12/trust-level`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "admin123",
          trustLevel: "gold",
        }),
      },
    );
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.success, true);
    assert.equal(body.id, "customer-12");
    assert.equal(body.trustLevel, "gold");
    assert.equal(body.subscriptionTier, "team_pro");
    assert.equal(body.subscriptionStatus, "active");

    assert.ok(sqliteCalls.getAllCustomers >= 1);
    assert.deepEqual(sqliteCalls.updateCustomerSubscription, [
      [mockEmail, "active", "team_pro"],
    ]);
    assert.ok(sqliteCalls.getOrCreateCustomer.includes(mockEmail));

    const store = await readStore();
    const record = store.subscriptions[mockEmail];
    assert.ok(record, "file store should contain the customer email");
    assert.equal(record.tier, "team_pro");
    assert.equal(record.licenseTier, "team_pro");
    assert.equal(record.product, "team_pro");
    assert.equal(record.subscriptionActive, true);
    assert.ok(fs.existsSync(storePath));
    assert.equal(path.basename(storePath).includes("customer-tier"), true);
  });
});
