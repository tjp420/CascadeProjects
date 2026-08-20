"use strict";

/**
 * Scan Counter API — Integration Tests
 *
 * Acceptance Criteria being verified:
 * 1. GET /api/scans/count returns 200 with { count: number } for authenticated user
 * 2. POST /api/scans/increment returns 200 with { incremented: boolean }
 * 3. Unauthenticated requests are rejected (401/403)
 * 4. When DB is unavailable, count returns 0 and increment returns { incremented: false }
 * 5. When DB is available, increment performs upsert and count returns persisted value
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const request = require("supertest");
const Module = require("module");

const ROUTE_PATH = require.resolve("../scan-counter-routes.cjs");
const IS_JEST =
  typeof jest !== "undefined" && typeof jest.doMock === "function";

function loadScanCounterModule(stubs) {
  // mockMap keys are the require paths as seen from the route file's directory.
  // For Jest, we must register mocks under paths resolvable from the test file's
  // directory, so we use the corrected relative paths.
  const routeDir = require("path").dirname(ROUTE_PATH);
  const testDir = __dirname;
  const mockMap = {
    "../middleware/auth.cjs": stubs["auth.cjs"],
    "../lib/app-logger.cjs": stubs["app-logger.cjs"],
  };

  if (IS_JEST) {
    jest.resetModules();
    for (const [modPath, impl] of Object.entries(mockMap)) {
      if (impl) {
        // Resolve the module path relative to the route file, then re-express
        // it relative to the test file so jest.doMock registers under the
        // same resolved absolute path that the route will require.
        const absPath = require("path").resolve(routeDir, modPath);
        const relPath = require("path").relative(testDir, absPath);
        jest.doMock(relPath, () => impl, { virtual: true });
      }
    }
    return require(ROUTE_PATH);
  }

  // Node --test: intercept Module._load
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent && parent.filename === ROUTE_PATH && mockMap[request]) {
      return mockMap[request];
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[ROUTE_PATH];
  const mod = require(ROUTE_PATH);
  Module._load = originalLoad;
  return mod;
}

function makeAuthMiddleware(user) {
  return (req, res, next) => {
    if (user) {
      req.user = user;
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}

function makeLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
}

function makeMockDb(scanCountResult) {
  return {
    query: async (sql, params) => {
      // Simulate SELECT for count
      if (sql && sql.toUpperCase().includes("SELECT")) {
        return {
          rows:
            scanCountResult !== undefined
              ? [{ scan_count: scanCountResult }]
              : [],
        };
      }
      // Simulate INSERT/UPSERT for increment
      if (sql && sql.toUpperCase().includes("INSERT")) {
        return { rows: [{ scan_count: (scanCountResult || 0) + 1 }] };
      }
      return { rows: [] };
    },
  };
}

describe("Scan Counter API — Integration Tests", () => {
  describe("GET /count", () => {
    it("AC1: returns 200 with count for authenticated user (DB available, no prior scans)", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(0);
      app.use("/api/scans", router);

      const res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.count, 0);
    });

    it("AC1: returns 200 with correct count for user with prior scans", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(2);
      app.use("/api/scans", router);

      const res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.count, 2);
    });

    it("AC4: returns count=0 when DB is not available", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      // No app.locals.db
      app.use("/api/scans", router);

      const res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.count, 0);
    });

    it("AC3: returns 401 when not authenticated", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware(null) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(0);
      app.use("/api/scans", router);

      const res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.status, 401);
    });

    it("AC1: returns count=0 when user has no id in JWT", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({}) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(5);
      app.use("/api/scans", router);

      const res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.count, 0);
    });
  });

  describe("POST /increment", () => {
    it("AC2: returns 200 with incremented=true when DB is available", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(0);
      app.use("/api/scans", router);

      const res = await request(app).post("/api/scans/increment");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.incremented, true);
    });

    it("AC4: returns incremented=false when DB is not available", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.use("/api/scans", router);

      const res = await request(app).post("/api/scans/increment");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.incremented, false);
    });

    it("AC3: returns 401 when not authenticated", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware(null) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(0);
      app.use("/api/scans", router);

      const res = await request(app).post("/api/scans/increment");
      assert.strictEqual(res.status, 401);
    });

    it("AC2: returns incremented=false when user has no id", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({}) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = makeMockDb(0);
      app.use("/api/scans", router);

      const res = await request(app).post("/api/scans/increment");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.incremented, false);
    });

    it("AC5: handles DB query error gracefully (returns 200, incremented=false)", async () => {
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-123" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = {
        query: async () => {
          throw new Error("Connection refused");
        },
      };
      app.use("/api/scans", router);

      const res = await request(app).post("/api/scans/increment");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.incremented, false);
    });
  });

  describe("End-to-end: register → increment → count flow", () => {
    it("AC5: multiple increments are tracked correctly", async () => {
      let dbCount = 0;
      const router = loadScanCounterModule({
        "auth.cjs": { authenticate: makeAuthMiddleware({ id: "user-flow" }) },
        "app-logger.cjs": makeLogger(),
      });
      const app = express();
      app.locals.db = {
        query: async (sql) => {
          if (sql.toUpperCase().includes("SELECT")) {
            return { rows: [{ scan_count: dbCount }] };
          }
          if (sql.toUpperCase().includes("INSERT")) {
            dbCount++;
            return { rows: [{ scan_count: dbCount }] };
          }
          return { rows: [] };
        },
      };
      app.use("/api/scans", router);

      // Initial count should be 0
      let res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.body.count, 0);

      // Increment 3 times (simulating 3 free scans)
      await request(app).post("/api/scans/increment");
      await request(app).post("/api/scans/increment");
      await request(app).post("/api/scans/increment");

      // Count should now be 3
      res = await request(app).get("/api/scans/count");
      assert.strictEqual(res.body.count, 3);
    });
  });
});
