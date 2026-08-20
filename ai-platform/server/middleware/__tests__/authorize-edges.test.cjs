describe("authorize middleware edge cases", () => {
  beforeEach(() => jest.resetModules());

  test("authorize returns 401 when no user", () => {
    const mod = require("../authorize.cjs");
    const mw = mod.authorize("read:x");
    const req = {};
    const res = { status: (s) => ({ json: (b) => b }) };
    const next = jest.fn();
    const out = mw(req, res, next);
    expect(out).toMatchObject({ success: false });
  });

  test("authorize denies when permission missing", () => {
    jest.doMock("../../lib/rbac-store.cjs", () => ({
      resolveUserRole: () => ({ role: "user", permissions: [] }),
      hasPermission: (perms, p) => perms.includes(p),
    }));
    const mod = require("../authorize.cjs");
    const mw = mod.authorize("write:foo");
    const req = { user: { id: "u1" } };
    const res = { status: (s) => ({ json: (b) => b }) };
    const next = jest.fn();
    const out = mw(req, res, next);
    expect(out).toHaveProperty("error", "insufficient_permissions");
  });

  test("authorize allows when permission present", () => {
    jest.doMock("../../lib/rbac-store.cjs", () => ({
      resolveUserRole: () => ({
        role: "admin",
        permissions: ["write:foo"],
        source: "role",
      }),
      hasPermission: (perms, p) => perms.includes(p),
    }));
    const mod = require("../authorize.cjs");
    const mw = mod.authorize("write:foo");
    const req = { user: { id: "u1" } };
    const res = {};
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userRole).toBe("admin");
  });
});
