const express = require("express");
const request = require("supertest");
const { registerAuditBookingRoute } = require("../audit-booking-route.cjs");

jest.mock("../../middleware/auth.cjs", () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization !== "Bearer test")
      return res.status(401).json({ error: "unauthorized" });
    req.user = { id: "org-test", email: "operator@example.com" };
    next();
  },
}));
jest.mock("../../lib/admin-throttle.cjs", () => ({
  middleware: (_req, _res, next) => next(),
}));

describe("mounted audit program routes", () => {
  test("export-tier requires authentication and classifies a scan", async () => {
    const auditRoutes = require("../../routes/audit-routes.cjs");
    const app = express();
    app.use(express.json());
    app.use("/api/audit", auditRoutes);

    const unauthenticated = await request(app)
      .post("/api/audit/export-tier")
      .send({});
    expect(unauthenticated.status).toBe(401);

    const response = await request(app)
      .post("/api/audit/export-tier")
      .set("Authorization", "Bearer test")
      .send({ results: { simplebeacon: { gate: { pass: true } } } });
    expect(response.status).toBe(200);
    expect(response.body.exportTier.tier).toBe("gate-only");
  });

  test("export-pdf refuses unsigned output when no signing key is configured", async () => {
    const auditRoutes = require("../../routes/audit-routes.cjs");
    const app = express();
    app.use(express.json());
    app.use("/api/audit", auditRoutes);
    const previousKey = process.env.REPORT_SIGNING_KEY;
    delete process.env.REPORT_SIGNING_KEY;
    const response = await request(app)
      .post("/api/audit/export-pdf")
      .set("Authorization", "Bearer test")
      .send({
        results: {
          simplebeacon: { gate: { pass: true }, issueCount: 0 },
          codebase: { summary: { codeFilesAnalyzed: 1 } },
        },
      });
    if (previousKey === undefined) delete process.env.REPORT_SIGNING_KEY;
    else process.env.REPORT_SIGNING_KEY = previousKey;
    expect(response.status).toBe(503);
  });

  test("booking listing uses the configured authentication middleware", async () => {
    const app = express();
    app.use(express.json());
    const db = {
      query: jest.fn(async (sql) => {
        if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: 0 }] };
        return { rows: [] };
      }),
    };
    registerAuditBookingRoute(app, {
      landingEnabled: true,
      db,
      listMiddleware: (req, res, next) => {
        if (req.headers.authorization !== "Bearer test")
          return res.status(401).json({ error: "unauthorized" });
        next();
      },
    });

    expect((await request(app).get("/api/audit-bookings")).status).toBe(401);
    const response = await request(app)
      .get("/api/audit-bookings")
      .set("Authorization", "Bearer test");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, count: 0, bookings: [] });
  });
});
