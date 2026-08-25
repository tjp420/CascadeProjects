"use strict";

jest.mock("../mock-data-helpers.cjs", () => ({
  analyzeFileContent: jest
    .fn()
    .mockReturnValue({ issues: [], needsValidation: false }),
  ALLOWED_EXTENSIONS: /\.json$/,
}));

const fs = require("fs");
const path = require("path");
const os = require("os");
const { scanForMockFiles } = require("../mock-data-file-scanner.cjs");

describe("mock-data-file-scanner", () => {
  test("exports scanForMockFiles function", () => {
    expect(typeof scanForMockFiles).toBe("function");
  });

  test("scanForMockFiles returns object with files and issues arrays", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-scan-test-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "data.json"), '{"test":true}');
      const result = await scanForMockFiles(tmpDir);
      expect(result).toHaveProperty("files");
      expect(result).toHaveProperty("issues");
      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.issues)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("scanForMockFiles handles empty directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-scan-empty-"));
    try {
      const result = await scanForMockFiles(tmpDir);
      expect(result.files).toEqual([]);
      expect(result.issues).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("scanForMockFiles skips non-matching extensions", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-scan-ext-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "readme.txt"), "hello");
      const result = await scanForMockFiles(tmpDir);
      expect(result.files).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
