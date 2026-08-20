"use strict";

jest.mock("../json-file-cache.cjs", () => ({
  readJsonFileCached: jest.fn().mockReturnValue(null),
}));

const {
  DEFAULT_RELATIVE_PATH,
  loadJestCoverageSummary,
  normalizeRelativePath,
  resolveSummaryPath,
  roundCoveragePercentage,
} = require("../jest-coverage-reader.cjs");

describe("jest-coverage-reader", () => {
  test("exports expected functions and constants", () => {
    expect(typeof DEFAULT_RELATIVE_PATH).toBe("string");
    expect(DEFAULT_RELATIVE_PATH).toContain("coverage-summary.json");
    expect(typeof loadJestCoverageSummary).toBe("function");
    expect(typeof normalizeRelativePath).toBe("function");
    expect(typeof resolveSummaryPath).toBe("function");
    expect(typeof roundCoveragePercentage).toBe("function");
  });

  test("normalizeRelativePath returns null for empty or total", () => {
    expect(normalizeRelativePath("", "/base")).toBeNull();
    expect(normalizeRelativePath("total", "/base")).toBeNull();
  });

  test("normalizeRelativePath strips base dir prefix", () => {
    const path = require("path");
    const base = path.resolve("/base");
    const file = path.join(base, "src", "file.js");
    const result = normalizeRelativePath(file, base);
    expect(result).toBe("src/file.js");
  });

  test("normalizeRelativePath returns path when not under base", () => {
    const result = normalizeRelativePath("/other/file.js", "/base");
    expect(result).toContain("other");
    expect(result).toContain("file.js");
  });

  test("roundCoveragePercentage rounds to 1 decimal", () => {
    expect(roundCoveragePercentage(85.56)).toBe(85.6);
    expect(roundCoveragePercentage(100)).toBe(100);
  });

  test("roundCoveragePercentage returns null for invalid input", () => {
    expect(roundCoveragePercentage(null)).toBeNull();
    expect(roundCoveragePercentage(NaN)).toBeNull();
  });

  test("resolveSummaryPath returns absolute path as-is", () => {
    expect(
      resolveSummaryPath("/base", { relativePath: "/absolute/path.json" }),
    ).toBe("/absolute/path.json");
  });

  test("resolveSummaryPath joins relative path with base", () => {
    const result = resolveSummaryPath("/base", {
      relativePath: "coverage/summary.json",
    });
    expect(result).toContain("coverage");
    expect(result).toContain("summary.json");
  });

  test("loadJestCoverageSummary returns unavailable when no file", () => {
    const result = loadJestCoverageSummary("/nonexistent");
    expect(result.available).toBe(false);
  });
});
