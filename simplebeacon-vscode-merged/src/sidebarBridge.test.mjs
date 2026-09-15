import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSidebarTrackedDownloadPath } from "./sidebarBridge.ts";

describe("sidebar download paths", () => {
  test("rejects empty and browser:// placeholders", () => {
    assert.equal(isSidebarTrackedDownloadPath(""), false);
    assert.equal(isSidebarTrackedDownloadPath("browser://report.json?t=1"), false);
  });

  test("accepts real saved paths", () => {
    assert.equal(isSidebarTrackedDownloadPath("C:\\Users\\user\\report.json"), true);
    assert.equal(isSidebarTrackedDownloadPath("/tmp/simplebeacon-report.json"), true);
  });
});
