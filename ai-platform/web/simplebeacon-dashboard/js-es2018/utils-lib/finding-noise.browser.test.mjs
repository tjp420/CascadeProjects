import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  isNoisePath,
  partitionScanFindings,
  selectVerifiedFindings,
} from "./finding-noise.browser.js";

describe("browser finding-noise filter", () => {
  test("treats Open WebUI false-positive paths as noise", () => {
    assert.equal(isNoisePath("CODE_OF_CONDUCT.md"), true);
    assert.equal(isNoisePath("CHANGELOG.md"), true);
    assert.equal(isNoisePath("package-lock.json"), true);
    assert.equal(isNoisePath("src/i18n/locales/en.json"), true);
    assert.equal(isNoisePath("static/swagger-ui-bundle.js"), true);
    assert.equal(isNoisePath("backend/open_webui/socket/utils.py"), false);
    assert.equal(isNoisePath("e2e/src/api/login.spec.ts"), true);
    assert.equal(isNoisePath("models/user_test.go"), true);
    assert.equal(isNoisePath("options/locale/locale_en-US.json"), true);
  });

  test("headline partition drops noise and keeps evalDanger", () => {
    const { production, noise } = partitionScanFindings([
      {
        rule: "sensitiveData",
        severity: "high",
        filePath: "CODE_OF_CONDUCT.md",
        line: 12,
      },
      {
        rule: "evalDanger",
        severity: "high",
        filePath: "backend/open_webui/socket/utils.py",
        line: 58,
      },
      {
        rule: "weakCryptography",
        severity: "high",
        filePath: "src/i18n/locales/de.json",
        line: 4,
      },
    ]);
    assert.equal(noise.length, 2);
    assert.equal(production.length, 1);
    assert.equal(production[0].filePath, "backend/open_webui/socket/utils.py");
    const verified = selectVerifiedFindings([...noise, ...production]);
    assert.equal(verified.length, 1);
    assert.equal(verified[0].filePath, "backend/open_webui/socket/utils.py");
  });
});
