const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { classifyPath } = require("../src/lib/path-context");
const { partitionByLane } = require("../src/lib/finding-context");
const { getStandardsForFinding } = require("../src/lib/standards-map");

describe("path context lanes", () => {
  test("isolates test/mock/molecule/fixture paths to the quality lane", () => {
    assert.equal(classifyPath("securedrop/loaddata.py").lane, "quality");
    assert.equal(classifyPath("molecule/testinfra/test_pkg.py").lane, "quality");
    assert.equal(classifyPath("src/app/server.js").lane, "production");
    assert.equal(
      classifyPath("src/app/api/routes/admin.js").reachabilityHint,
      "http-surface-path",
    );
  });

  test("does not treat docs, lockfiles, or vendor bundles as production", () => {
    assert.equal(classifyPath("CODE_OF_CONDUCT.md").fileRole, "docs");
    assert.equal(classifyPath("CHANGELOG.md").lane, "quality");
    assert.equal(classifyPath("package-lock.json").fileRole, "generated");
    assert.equal(
      classifyPath("static/swagger-ui-bundle.js").fileRole,
      "vendor",
    );
    assert.equal(
      classifyPath("src/i18n/locales/en.json").class,
      "i18n",
    );
    assert.equal(
      classifyPath("backend/open_webui/socket/utils.py").reachabilityHint,
      "http-surface-path",
    );
    assert.equal(
      classifyPath("backend/open_webui/socket/utils.py").fileRole,
      "app",
    );
    assert.equal(classifyPath("models/user_test.go").fileRole, "test");
    assert.equal(classifyPath("options/locale/locale_en-US.json").class, "i18n");
  });

  test("partitionByLane keeps production alerts off the quality list", () => {
    const { production, quality } = partitionByLane([
      {
        id: "SB-SEC-044-src/app/api/client.py",
        filePath: "src/app/api/client.py",
        severity: "high",
      },
      {
        id: "SB-SEC-044-test/fixtures/client.py",
        filePath: "test/fixtures/client.py",
        severity: "high",
      },
    ]);
    assert.equal(production.length, 1);
    assert.equal(quality.length, 1);
    assert.equal(production[0].cwe, "CWE-295");
    assert.equal(quality[0].lane, "quality");
  });

  test("standards map covers SB-SEC-001 and fallback types", () => {
    assert.equal(
      getStandardsForFinding({ id: "SB-SEC-001-foo.js" }).cwe,
      "CWE-94",
    );
    assert.equal(
      getStandardsForFinding({ type: "sql-injection" }).cwe,
      "CWE-89",
    );
  });
});
