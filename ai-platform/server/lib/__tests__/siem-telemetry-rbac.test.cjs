"use strict";

/**
 * RBAC on SIEM Telemetry Endpoint — Access Control Tests
 *
 * Verifies that the /api/analytics/siem-telemetry endpoint enforces
 * role-based access control via the authorize('read:siem_telemetry')
 * middleware. Only admin and auditor roles should have access; other
 * roles (operator, viewer) and unauthenticated requests should be denied.
 *
 * Test items R1-R10 from the RBAC test plan.
 */

const path = require("path");

describe("RBAC on SIEM Telemetry Endpoint", () => {
  const authPath = path.join(__dirname, "..", "..", "middleware", "auth.cjs");
  const authorizePath = path.join(
    __dirname,
    "..",
    "..",
    "middleware",
    "authorize.cjs",
  );
  const rbacStorePath = path.join(
    __dirname,
    "..",
    "..",
    "lib",
    "rbac-store.cjs",
  );

  afterEach(() => {
    jest.dontMock(authPath);
    jest.dontMock(authorizePath);
    jest.dontMock(rbacStorePath);
  });

  // Helper: set up mocked auth + authorize with a specific role
  function setupMocks(role, permissions) {
    jest.mock(authPath, () => ({
      authenticate: (req, res, next) => {
        req.user = { id: "test-user", email: "test@test.com", role };
        next();
      },
    }));
    // Use the REAL authorize middleware with a mocked rbac-store
    jest.mock(rbacStorePath, () => ({
      resolveUserRole: () => ({ role, permissions, source: "role" }),
      hasPermission: (perms, p) => perms.includes(p),
    }));
    jest.resetModules();
  }

  // R1: admin role can access the endpoint (has read:siem_telemetry)
  test("R1: admin role receives 200 with telemetry data", async () => {
    setupMocks("admin", [
      "read:all",
      "write:all",
      "delete:all",
      "admin:all",
      "read:siem_telemetry",
    ]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(200);
    expect(res.body.status).toBe("success");
    expect(res.body.metrics).toBeDefined();
  });

  // R2: auditor role can access the endpoint (has read:siem_telemetry)
  test("R2: auditor role receives 200 with telemetry data", async () => {
    setupMocks("auditor", [
      "read:all",
      "export:audit",
      "read:audit",
      "read:siem_telemetry",
    ]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(200);
    expect(res.body.status).toBe("success");
    expect(res.body.metrics).toBeDefined();
  });

  // R3: operator role is denied (does not have read:siem_telemetry)
  test("R3: operator role receives 403 forbidden", async () => {
    setupMocks("operator", [
      "read:all",
      "write:tickets",
      "write:scans",
      "write:evals",
      "trigger:gates",
    ]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(403);
    expect(res.body.error).toBe("insufficient_permissions");
    expect(res.body.requiredPermission).toBe("read:siem_telemetry");
  });

  // R4: viewer role is denied (does not have read:siem_telemetry)
  test("R4: viewer role receives 403 forbidden", async () => {
    setupMocks("viewer", ["read:analytics", "read:violations"]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(403);
    expect(res.body.error).toBe("insufficient_permissions");
    expect(res.body.requiredPermission).toBe("read:siem_telemetry");
  });

  // R5: unauthenticated request receives 401
  test("R5: unauthenticated request receives 401", async () => {
    jest.mock(authPath, () => ({
      authenticate: (req, res, next) => {
        res.status(401).json({ error: "authentication_required" });
      },
    }));
    jest.mock(rbacStorePath, () => ({
      resolveUserRole: () => ({
        role: "unknown",
        permissions: [],
        source: "default",
      }),
      hasPermission: (perms, p) => perms.includes(p),
    }));
    jest.resetModules();
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(401);
    expect(res.body.error).toBe("authentication_required");
  });

  // R6: user with no role assigned is denied
  test("R6: user with empty role is denied 403", async () => {
    setupMocks("", []);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(403);
    expect(res.body.error).toBe("insufficient_permissions");
  });

  // R7: 403 response includes required permission and user role for diagnostics
  test("R7: 403 response includes requiredPermission and userRole", async () => {
    setupMocks("viewer", ["read:analytics", "read:violations"]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(403);
    expect(res.body.requiredPermission).toBe("read:siem_telemetry");
    expect(res.body.userRole).toBe("viewer");
  });

  // R8: rbac-store has read:siem_telemetry in the permission catalog
  test("R8: rbac-store has read:siem_telemetry in PERMISSIONS catalog", () => {
    jest.resetModules();
    const rbacStore = require(rbacStorePath);
    // The PERMISSIONS object should be accessible via the module's internals
    // We verify by checking that the roles have the permission
    const { ROLES } = require(rbacStorePath);
    expect(ROLES.admin.permissions).toContain("read:siem_telemetry");
    expect(ROLES.auditor.permissions).toContain("read:siem_telemetry");
  });

  // R9: operator role does NOT have read:siem_telemetry in its permissions
  test("R9: operator and viewer roles do not have read:siem_telemetry", () => {
    jest.resetModules();
    const { ROLES } = require(rbacStorePath);
    expect(ROLES.operator.permissions).not.toContain("read:siem_telemetry");
    expect(ROLES.viewer.permissions).not.toContain("read:siem_telemetry");
  });

  // R10: admin with read:all but NOT read:siem_telemetry is still denied
  // (verifies that read:all does not implicitly grant read:siem_telemetry)
  test("R10: read:all does not implicitly grant read:siem_telemetry", async () => {
    setupMocks("custom", ["read:all"]);
    const express = require("express");
    const request = require("supertest");
    const router = require(
      path.join(__dirname, "..", "..", "routes", "analytics-routes.cjs"),
    );

    const app = express();
    app.use(express.json());
    app.use("/api/analytics", router);

    const res = await request(app)
      .get("/api/analytics/siem-telemetry")
      .expect(403);
    expect(res.body.error).toBe("insufficient_permissions");
    expect(res.body.requiredPermission).toBe("read:siem_telemetry");
  });
});
