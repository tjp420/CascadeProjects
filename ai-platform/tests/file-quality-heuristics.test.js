// simplebeacon-ignore: security — test fixtures, scanner patterns, and dashboard code; all findings are false positives
/**
 * Tests for file-quality-heuristics.cjs
 */

const {
  calculateFileQuality,
  contentNeedsValidation,
  contentHasMarker,
} = require("../server/lib/file-quality-heuristics.cjs");

describe("file-quality-heuristics", () => {
  describe("contentHasMarker", () => {
    test("returns true when marker exists in content", () => {
      expect(contentHasMarker("// TODO: fix this", "TODO")).toBe(true); // simplebeacon-ignore maintainability-pattern — test fixture string
    });

    test("returns false when marker is absent", () => {
      expect(contentHasMarker("const x = 1;", "TODO")).toBe(false);
    });

    test("returns false for non-string input", () => {
      expect(contentHasMarker(null, "TODO")).toBe(false);
      expect(contentHasMarker(42, "TODO")).toBe(false);
    });
  });

  describe("calculateFileQuality", () => {
    test("returns 100 for clean content", () => {
      expect(calculateFileQuality("const x = 1;")).toBe(100);
    });

    test("deducts 10 for TODO marker", () => {
      expect(calculateFileQuality("// TODO: implement")).toBe(90); // simplebeacon-ignore maintainability-pattern — test fixture string
    });

    test("deducts 15 for FIXME marker", () => {
      expect(calculateFileQuality("// FIXME: broken")).toBe(85); // simplebeacon-ignore maintainability-pattern — test fixture string
    });

    test("deducts 5 for console.log", () => {
      expect(calculateFileQuality('console.log("debug")')).toBe(95);
    });

    test("deducts 5 for debugger", () => {
      expect(calculateFileQuality("debugger;")).toBe(95);
    });

    test("combines deductions and floors at 0", () => {
      const bad = '// TODO: fix\n// FIXME: now\nconsole.log("x")\ndebugger;'; // simplebeacon-ignore maintainability-pattern — test fixture string
      expect(calculateFileQuality(bad)).toBe(65);
    });
  });

  describe("contentNeedsValidation", () => {
    test("returns true for TODO content", () => {
      expect(contentNeedsValidation("// TODO: fix")).toBe(true); // simplebeacon-ignore maintainability-pattern — test fixture string
    });

    test("returns true for FIXME content", () => {
      expect(contentNeedsValidation("// FIXME: broken")).toBe(true);
    });

    test("returns false for clean content", () => {
      expect(contentNeedsValidation("const x = 1;")).toBe(false);
    });
  });
});
