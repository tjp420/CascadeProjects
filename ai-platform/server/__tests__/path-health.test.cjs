"use strict";

const request = require("supertest");
const express = require("express");
const router = require("../../server/api/metrics/path-health.cjs");

function createApp() {
  const app = express();
  app.use("/api/metrics/path-health", router);
  return app;
}

describe("server/api/metrics/path-health", () => {
  test("exports express router", () => {
    expect(router).toBeDefined();
    expect(typeof router.get).toBe("function");
  });

  test("GET / returns health metrics", async () => {
    const app = createApp();
    const res = await request(app).get("/api/metrics/path-health/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.summary).toBeDefined();
    expect(res.body.directories).toBeDefined();
    expect(Array.isArray(res.body.directories)).toBe(true);
    expect(res.body.engine).toBeDefined();
    expect(res.body.engine.version).toBeDefined();
  });
});
