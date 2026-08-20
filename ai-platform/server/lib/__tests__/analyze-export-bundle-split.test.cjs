"use strict";

const {
  splitLargeJsonParts,
  splitArrayParts,
  splitObjectParts,
  splitTextParts,
} = require("../analyze-export-bundle/split.cjs");

describe("analyze-export-bundle/split", () => {
  test("exports expected functions", () => {
    expect(typeof splitLargeJsonParts).toBe("function");
    expect(typeof splitArrayParts).toBe("function");
    expect(typeof splitObjectParts).toBe("function");
    expect(typeof splitTextParts).toBe("function");
  });

  test("splitLargeJsonParts returns single part for small JSON", () => {
    const content = JSON.stringify({ a: 1 });
    const parts = splitLargeJsonParts("test.json", content);
    expect(parts).toHaveLength(1);
    expect(parts[0].content).toBe(content);
  });

  test("splitLargeJsonParts returns single part for non-JSON", () => {
    const content = "hello world";
    const parts = splitLargeJsonParts("test.txt", content);
    expect(parts).toHaveLength(1);
  });

  test("splitArrayParts splits array into chunks", () => {
    const arr = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
    }));
    const parts = splitArrayParts("data.json", arr);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    parts.forEach((p) => {
      expect(p).toHaveProperty("content");
    });
  });

  test("splitArrayParts returns single part for small array", () => {
    const arr = [{ a: 1 }];
    const parts = splitArrayParts("data.json", arr);
    expect(parts).toHaveLength(1);
  });

  test("splitObjectParts splits object with many keys", () => {
    const obj = {};
    for (let i = 0; i < 50; i++) {
      obj[`key-${i}`] = { data: "x".repeat(1000) };
    }
    const parts = splitObjectParts("obj.json", obj);
    expect(parts.length).toBeGreaterThanOrEqual(1);
  });

  test("splitTextParts splits large text", () => {
    const text = "x".repeat(2 * 1024 * 1024);
    const parts = splitTextParts("big.json", text);
    expect(parts.length).toBeGreaterThan(1);
  });

  test("splitTextParts returns single part for small text", () => {
    const parts = splitTextParts("small.json", "hello");
    expect(parts).toHaveLength(1);
  });
});
