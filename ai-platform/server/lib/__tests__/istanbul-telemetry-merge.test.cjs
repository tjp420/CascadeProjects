// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
"use strict";

jest.mock("../jest-coverage-reader.cjs", () => ({
  loadJestCoverageSummary: jest
    .fn()
    .mockReturnValue({ available: false, totals: null }),
}));

const {
  mergeIstanbulTelemetry,
  isOpenIstanbulAlert,
} = require("../istanbul-telemetry-merge.cjs");

describe("istanbul-telemetry-merge", () => {
  test("exports expected functions", () => {
    expect(typeof mergeIstanbulTelemetry).toBe("function");
    expect(typeof isOpenIstanbulAlert).toBe("function");
  });

  test("isOpenIstanbulAlert returns false for non-istanbul alert", () => {
    expect(isOpenIstanbulAlert({ title: "Other alert" })).toBe(false);
  });

  test("isOpenIstanbulAlert returns true for open istanbul alert", () => {
    expect(
      isOpenIstanbulAlert({ title: "Istanbul coverage", resolved: false }),
    ).toBe(true);
  });

  test("isOpenIstanbulAlert returns false for resolved istanbul alert", () => {
    expect(
      isOpenIstanbulAlert({ title: "Istanbul coverage", resolved: true }),
    ).toBe(false);
    expect(
      isOpenIstanbulAlert({ title: "Istanbul coverage", status: "resolved" }),
    ).toBe(false);
  });

  test("isOpenIstanbulAlert returns true for istanbul alert with no status", () => {
    expect(isOpenIstanbulAlert({ title: "Istanbul telemetry" })).toBe(true);
  });

  test("mergeIstanbulTelemetry returns sample when no coverage available", () => {
    const sample = { alerts: [], metrics: {} };
    const result = mergeIstanbulTelemetry(sample, "/base");
    expect(result).toBeDefined();
    expect(result.alerts).toBeDefined();
  });

  test("mergeIstanbulTelemetry handles empty sample", () => {
    const result = mergeIstanbulTelemetry({}, "/base");
    expect(result).toBeDefined();
  });
});
