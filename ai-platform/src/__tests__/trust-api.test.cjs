"use strict";

jest.mock("../../server/lib/trust-verification-payload.cjs", () => ({
  buildTrustVerificationPayload: jest.fn(),
  publishTrustVerification: jest.fn(),
  buildTrustBadgeSvg: jest.fn().mockReturnValue("<svg></svg>"),
  buildTrustVerifyHtml: jest.fn().mockReturnValue("<html></html>"),
  buildTrustVerifyCompact: jest.fn().mockReturnValue("<div></div>"),
  buildTrustBadgeHtml: jest.fn().mockReturnValue("<div></div>"),
}));
jest.mock("../../server/lib/trust-history-store.cjs", () => ({
  resolveTrustHistoryPath: jest.fn(),
  readTrustHistory: jest.fn().mockReturnValue([]),
  buildTrustTrend: jest.fn().mockReturnValue([]),
}));
jest.mock("../../server/lib/json-file-cache.cjs", () => ({
  readJsonFileCached: jest.fn().mockReturnValue(null),
}));
jest.mock("../lib/production-logger.cjs", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { setupTrustAPI, PUBLIC_TRUST_PATH } = require("../api/trust-api.cjs");

describe("trust-api", () => {
  test("exports expected functions and constants", () => {
    expect(typeof setupTrustAPI).toBe("function");
    expect(typeof PUBLIC_TRUST_PATH).toBe("string");
    expect(PUBLIC_TRUST_PATH).toContain("trust-verification.json");
  });

  test("setupTrustAPI registers routes on app", () => {
    const app = { get: jest.fn(), post: jest.fn() };
    setupTrustAPI(app, {});
    expect(app.get).toHaveBeenCalled();
    expect(app.post).toHaveBeenCalled();
  });
});
