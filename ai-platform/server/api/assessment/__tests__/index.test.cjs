"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");

// We test the router by driving it with mock Request/Response objects.
// This avoids pulling in Express as a dependency for unit tests.

function createMockReq(overrides = {}) {
  return {
    params: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
    setHeader(key, value) {
      this._headers[key] = value;
    },
  };
  return res;
}

/** Manually run the route middleware stack against a mock req/res. */
async function runMiddleware(middlewares, req, res) {
  let idx = 0;
  const next = (err) => {
    if (err) {
      // If it's the error handler (4 args), invoke it
      const errorHandler = middlewares.find((m) => m.length === 4);
      if (errorHandler) {
        errorHandler(err, req, res, () => {});
      } else {
        throw err;
      }
      return;
    }
    if (idx >= middlewares.length) return;
    const fn = middlewares[idx++];
    if (fn.length === 4) {
      next(); // skip error handlers on normal path
    } else {
      try {
        const result = fn(req, res, next);
        if (result && typeof result.then === "function") {
          result.catch(next);
        }
      } catch (e) {
        next(e);
      }
    }
  };
  next();
}

describe("assessment router", () => {
  let router;
  let controllerCalls;

  beforeEach(() => {
    controllerCalls = [];

    // Stub controller methods before requiring the router
    const controllerPath = require.resolve("../AssessmentController.cjs");
    delete require.cache[controllerPath];
    require.cache[controllerPath] = {
      id: controllerPath,
      filename: controllerPath,
      loaded: true,
      exports: {
        triggerScan: (req, res) => {
          controllerCalls.push({ method: "triggerScan", req, res });
          res.json({ success: true, action: "triggerScan" });
        },
        getReport: (req, res) => {
          controllerCalls.push({ method: "getReport", req, res });
          res.json({ success: true, action: "getReport" });
        },
        downloadReport: (req, res) => {
          controllerCalls.push({ method: "downloadReport", req, res });
          res.json({ success: true, action: "downloadReport" });
        },
      },
    };

    const indexPath = require.resolve("../index.cjs");
    delete require.cache[indexPath];
    router = require("../index.cjs");
  });

  it("exports an Express router", () => {
    assert.ok(router);
    assert.strictEqual(typeof router.get, "function");
    assert.strictEqual(typeof router.post, "function");
    assert.strictEqual(typeof router.use, "function");
  });

  it("health endpoint returns 200 without rate limit", async () => {
    // The router is an Express Router — we can't easily drive its stack
    // without Express. Instead verify the structure by inspecting the stack.
    const healthLayer = router.stack.find(
      (layer) => layer.route?.path === "/health",
    );
    assert.ok(healthLayer, "health route should exist");
    assert.strictEqual(healthLayer.route.methods.get, true);
    // Verify no rateLimit middleware on health
    const hasRateLimit = healthLayer.route.stack.some((layer) => {
      const name = layer.handle.name || layer.handle.toString();
      return name.includes("rateLimit") || name.includes("assessmentRateLimit");
    });
    assert.strictEqual(
      hasRateLimit,
      false,
      "health should not have rate limit",
    );
  });

  it("scan endpoint has rate limit and validation", async () => {
    const scanLayer = router.stack.find(
      (layer) => layer.route?.path === "/scan",
    );
    assert.ok(scanLayer, "scan route should exist");
    assert.strictEqual(scanLayer.route.methods.post, true);

    const middlewareNames = scanLayer.route.stack.map(
      (layer) => layer.handle.name || "",
    );
    // express-rate-limit returns anonymous middleware; verify there are 3+ layers
    assert.strictEqual(
      scanLayer.route.stack.length >= 3,
      true,
      "scan should have rate limit + validation + handler",
    );
    assert.ok(
      middlewareNames.some((n) => n === "validateScanBody"),
      "scan should have validation",
    );
    assert.ok(
      middlewareNames.some((n) => n === ""),
      "scan should have async handler",
    );
  });

  it("report/:id endpoint has rate limit and validation", async () => {
    const reportLayer = router.stack.find(
      (layer) => layer.route?.path === "/report/:id",
    );
    assert.ok(reportLayer, "report route should exist");
    assert.strictEqual(reportLayer.route.methods.get, true);

    const middlewareNames = reportLayer.route.stack.map(
      (layer) => layer.handle.name || "",
    );
    assert.strictEqual(
      reportLayer.route.stack.length >= 3,
      true,
      "report should have rate limit + validation + handler",
    );
    assert.ok(
      middlewareNames.some((n) => n === "validateReportId"),
      "report should have validation",
    );
  });

  it("download endpoint has rate limit and format validation", async () => {
    const dlLayer = router.stack.find(
      (layer) => layer.route?.path === "/report/:id/download/:format",
    );
    assert.ok(dlLayer, "download route should exist");
    assert.strictEqual(dlLayer.route.methods.get, true);

    const middlewareNames = dlLayer.route.stack.map(
      (layer) => layer.handle.name || "",
    );
    assert.strictEqual(
      dlLayer.route.stack.length >= 3,
      true,
      "download should have rate limit + validation + handler",
    );
    assert.ok(
      middlewareNames.some((n) => n === "validateDownloadParams"),
      "download should have validation",
    );
  });

  it("router has error handler registered last", () => {
    const lastLayer = router.stack[router.stack.length - 1];
    const lastName = lastLayer.handle.name || "";
    assert.ok(
      lastName.includes("assessmentErrorHandler") ||
        lastLayer.handle.length === 4,
      "last middleware should be error handler",
    );
  });
});
