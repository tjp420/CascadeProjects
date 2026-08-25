"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

// Set env BEFORE requiring server
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-chars";
process.env.SIMPLEBEACON_LICENSE_SECRET =
  "test-license-secret-at-least-32-chars";

const { app, server } = require("../server.cjs");

function request(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr && addr.port ? addr.port : addr;
    const req = http.request(
      {
        port,
        path,
        method,
        headers: opts.headers || {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      },
    );
    req.on("error", reject);
    if (opts.body)
      req.write(
        typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
      );
    req.end();
  });
}

describe("API Server smoke tests (v3.2.0)", () => {
  before(async () => {
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, resolve));
    }
  });

  after(async () => {
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("GET /health returns 200 with status ok", async () => {
    const res = await request("GET", "/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, "ok");
  });

  it("GET /api/health returns 200 with service simplebeacon-api", async () => {
    const res = await request("GET", "/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, "ok");
    assert.strictEqual(res.json.service, "simplebeacon-api");
  });

  it("GET /api/platform/status returns 200 with version 3.2.0", async () => {
    const res = await request("GET", "/api/platform/status");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.online, true);
    assert.strictEqual(res.json.version, "3.2.0");
  });

  it("GET /api/auth/me returns authenticated false", async () => {
    const res = await request("GET", "/api/auth/me");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.authenticated, false);
  });

  it("GET /api/webauthn/status returns enabled false", async () => {
    const res = await request("GET", "/api/webauthn/status");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.enabled, false);
  });

  it("GET /api/metrics/path-health returns success", async () => {
    const res = await request("GET", "/api/metrics/path-health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, "success");
  });

  it("GET /nonexistent returns 404 JSON", async () => {
    const res = await request("GET", "/nonexistent");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.json.error, "Not found");
  });

  it("OPTIONS /api/anything returns 204 for CORS preflight", async () => {
    const res = await request("OPTIONS", "/api/anything", {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.strictEqual(res.status, 204);
    assert.ok(res.headers["access-control-allow-origin"]);
  });

  it("CORS rejects disallowed origin with 403", async () => {
    const res = await request("GET", "/health", {
      headers: { Origin: "https://evil.example.com" },
    });
    assert.strictEqual(res.status, 403);
  });

  it("Security headers are present", async () => {
    const res = await request("GET", "/health");
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(res.headers["x-frame-options"], "DENY");
    assert.strictEqual(res.headers["x-xss-protection"], "1; mode=block");
  });
});
