"use strict";

const {
  normalizeForFuzzy,
  tokenJaccardSimilarity,
  lineHashJaccardSimilarity,
  combinedSimilarity,
  isCiLogFragmentPath,
  isCiLogFragmentPair,
  DEFAULT_FUZZY_THRESHOLD,
  MAX_FUZZY_PAIRS,
} = require("../fuzzy-content-matcher.cjs");

describe("fuzzy-content-matcher", () => {
  test("exports expected functions and constants", () => {
    expect(typeof normalizeForFuzzy).toBe("function");
    expect(typeof tokenJaccardSimilarity).toBe("function");
    expect(typeof lineHashJaccardSimilarity).toBe("function");
    expect(typeof combinedSimilarity).toBe("function");
    expect(typeof isCiLogFragmentPath).toBe("function");
    expect(typeof isCiLogFragmentPair).toBe("function");
    expect(DEFAULT_FUZZY_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_FUZZY_THRESHOLD).toBeLessThanOrEqual(1);
    expect(MAX_FUZZY_PAIRS).toBeGreaterThan(0);
  });

  test("normalizeForFuzzy strips comments and whitespace", () => {
    const input = "// comment\nconst x = 1; /* block */\n  const y = 2;";
    const result = normalizeForFuzzy(input);
    expect(result).not.toContain("//");
    expect(result).not.toContain("/*");
    expect(result).not.toContain("*/");
    expect(result).not.toContain("\n");
  });

  test("normalizeForFuzzy handles empty/null", () => {
    expect(normalizeForFuzzy(null)).toBe("");
    expect(normalizeForFuzzy(undefined)).toBe("");
    expect(normalizeForFuzzy("")).toBe("");
  });

  test("tokenJaccardSimilarity returns 1 for identical strings", () => {
    expect(tokenJaccardSimilarity("hello world foo", "hello world foo")).toBe(
      1,
    );
  });

  test("tokenJaccardSimilarity returns 0 for empty", () => {
    expect(tokenJaccardSimilarity("", "hello")).toBe(0);
    expect(tokenJaccardSimilarity("hello", "")).toBe(0);
  });

  test("tokenJaccardSimilarity returns partial for similar strings", () => {
    const score = tokenJaccardSimilarity(
      "hello world foo bar",
      "hello world baz bar",
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  test("lineHashJaccardSimilarity returns 1 for identical content", () => {
    const text = "line one\nline two\nline three";
    expect(lineHashJaccardSimilarity(text, text)).toBe(1);
  });

  test("lineHashJaccardSimilarity returns 0 for empty", () => {
    expect(lineHashJaccardSimilarity("", "text")).toBe(0);
  });

  test("combinedSimilarity returns max of token and line scores", () => {
    const a = "const hello = 1;\nconst world = 2;";
    const b = "const hello = 1;\nconst world = 2;";
    expect(combinedSimilarity(a, b)).toBe(1);
  });

  test("isCiLogFragmentPath detects CI log paths", () => {
    expect(isCiLogFragmentPath("docs/123-stdout.txt")).toBe(true);
    expect(isCiLogFragmentPath("docs/456-stderr-789.txt")).toBe(true);
    expect(isCiLogFragmentPath("src/index.js")).toBe(false);
  });

  test("isCiLogFragmentPair returns true when both are CI logs", () => {
    expect(isCiLogFragmentPair("docs/1-stdout.txt", "docs/2-stderr.txt")).toBe(
      true,
    );
    expect(isCiLogFragmentPair("docs/1-stdout.txt", "src/index.js")).toBe(
      false,
    );
  });
});
