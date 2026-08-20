// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
"use strict";

jest.mock("../../../server/lib/simplebeacon-proxy.cjs", () => ({
  generateLicenseToken: jest.fn(),
  verifyLicenseToken: jest.fn(),
}));

const {
  validateProjectToken,
} = require("../../../src/api/billing/validate-project-token.cjs");
const {
  verifyLicenseToken,
} = require("../../../server/lib/simplebeacon-proxy.cjs");

function mockReqRes(headers = {}, body = {}, query = {}) {
  const req = { headers, body, query };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe("validate-project-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure license secret is set so middleware calls verifyLicenseToken
    process.env.SIMPLEBEACON_LICENSE_SECRET =
      process.env.SIMPLEBEACON_LICENSE_SECRET || "test-secret";
  });
  afterEach(() => {
    delete process.env.SIMPLEBEACON_LICENSE_SECRET;
  });

  test("exports validateProjectToken function", () => {
    expect(typeof validateProjectToken).toBe("function");
  });

  test("returns 401 when no token provided", () => {
    const { req, res, next } = mockReqRes();
    validateProjectToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "missing_token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 when token is invalid", () => {
    verifyLicenseToken.mockReturnValue(null);
    const { req, res, next } = mockReqRes({
      authorization: "Bearer bad-token",
    });
    validateProjectToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next and sets req.licensePayload on valid token", () => {
    const payload = {
      email: "test@example.com",
      tier: "executive",
      features: ["audit"],
      projectName: "proj",
      clientName: "client",
      iat: 1,
      exp: 2,
    };
    verifyLicenseToken.mockReturnValue(payload);
    const { req, res, next } = mockReqRes({
      authorization: "Bearer good-token",
    });
    validateProjectToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.licensePayload).toBe(payload);
    expect(req.projectContext).toEqual(
      expect.objectContaining({
        email: "test@example.com",
        tier: "executive",
        features: ["audit"],
        projectName: "proj",
      }),
    );
  });

  test("accepts token from body.licenseToken", () => {
    const payload = { email: "a@b.com", tier: "dev", features: [] };
    verifyLicenseToken.mockReturnValue(payload);
    const { req, res, next } = mockReqRes({}, { licenseToken: "body-token" });
    validateProjectToken(req, res, next);
    expect(verifyLicenseToken).toHaveBeenCalledWith(
      "body-token",
      expect.any(String),
    );
    expect(next).toHaveBeenCalled();
  });

  test("accepts token from query.licenseToken", () => {
    const payload = { email: "a@b.com", tier: "dev", features: [] };
    verifyLicenseToken.mockReturnValue(payload);
    const { req, res, next } = mockReqRes(
      {},
      {},
      { licenseToken: "query-token" },
    );
    validateProjectToken(req, res, next);
    expect(verifyLicenseToken).toHaveBeenCalledWith(
      "query-token",
      expect.any(String),
    );
    expect(next).toHaveBeenCalled();
  });
});
