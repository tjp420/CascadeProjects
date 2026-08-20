const { jest: _jest } = require("@jest/globals");

describe("requireDashboardWrite middleware", () => {
  beforeEach(() => jest.resetModules());

  test("returns 401 when no user", () => {
    const auth = require("../auth.cjs");
    const req = {};
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    auth.requireDashboardWrite(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 when user lacks access", () => {
    const auth = require("../auth.cjs");
    const req = {
      user: { id: "u1", trustLevel: "bronze", role: "", features: [] },
    };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();

    auth.requireDashboardWrite(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next when user has access", () => {
    const auth = require("../auth.cjs");
    const req = {
      user: { id: "u2", trustLevel: "gold", role: "", features: [] },
    };
    const res = {};
    const next = jest.fn();

    auth.requireDashboardWrite(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
