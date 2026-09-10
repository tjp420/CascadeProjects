const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyFinding,
  triageFindings,
  DECISIONS,
} = require("../src/lib/signal-engine");

describe("signal engine triage", () => {
  test("Immich-style evalDanger in app code is INVESTIGATE, not a confirmed vuln", () => {
    const row = classifyFinding({
      type: "evalDanger",
      severity: "critical",
      filePath: "server/src/utils/machine-learning.util.ts",
      line: 58,
      description: "eval() on decoded payload",
    });
    assert.equal(row.decision, DECISIONS.INVESTIGATE);
    assert.match(row.nextAction, /untrusted input/i);
    assert.match(row.reason, /not a confirmed vulnerability/i);
    assert.ok(row.score >= 70);
  });

  test("Gitea Go tests and Immich E2E credentials are dismissed", () => {
    assert.equal(
      classifyFinding({
        type: "credentials",
        severity: "critical",
        filePath: "models/user_test.go",
        line: 40,
      }).decision,
      DECISIONS.DISMISS,
    );
    assert.equal(
      classifyFinding({
        type: "sensitiveData",
        severity: "critical",
        filePath: "options/locale/locale_en-US.json",
        line: 12,
      }).decision,
      DECISIONS.DISMISS,
    );
    assert.equal(
      classifyFinding({
        type: "credentials",
        severity: "critical",
        filePath: "e2e/src/utils/login.ts",
        line: 8,
      }).decision,
      DECISIONS.DISMISS,
    );
  });

  test("docs, translations, and vendor bundles are dismissed", () => {
    assert.equal(
      classifyFinding({
        type: "sensitiveData",
        severity: "high",
        filePath: "CODE_OF_CONDUCT.md",
        line: 4,
      }).decision,
      DECISIONS.DISMISS,
    );
    assert.equal(
      classifyFinding({
        type: "weakCryptography",
        severity: "high",
        filePath: "src/i18n/locales/de.json",
        line: 9,
      }).decision,
      DECISIONS.DISMISS,
    );
    assert.equal(
      classifyFinding({
        type: "prototypePollution",
        severity: "high",
        filePath: "static/swagger-ui-bundle.js",
        line: 2,
      }).decision,
      DECISIONS.DISMISS,
    );
  });

  test("TODO / AI-slop / compliance markers are dismissed even in app paths", () => {
    assert.equal(
      classifyFinding({
        type: "llmSlop",
        severity: "high",
        filePath: "backend/open_webui/main.py",
        line: 10,
      }).decision,
      DECISIONS.DISMISS,
    );
    assert.equal(
      classifyFinding({
        type: "eu-ai-act",
        severity: "high",
        filePath: "backend/open_webui/app.py",
        line: 3,
      }).decision,
      DECISIONS.DISMISS,
    );
  });

  test("Open WebUI socket eval stays a candidate; 7 noisy hits collapse", () => {
    const result = triageFindings([
      {
        type: "evalDanger",
        severity: "high",
        filePath: "backend/open_webui/socket/utils.py",
        line: 58,
      },
      {
        type: "credentials",
        severity: "critical",
        filePath: "e2e/fixtures/user.json",
        line: 1,
      },
      {
        type: "sensitiveData",
        severity: "high",
        filePath: "CHANGELOG.md",
        line: 40,
      },
      {
        type: "todoDensity",
        severity: "medium",
        filePath: "src/app.ts",
        line: 2,
      },
      {
        type: "innerHtmlXss",
        severity: "high",
        filePath: "src/app/components/MessageView.tsx",
        line: 91,
      },
    ]);
    assert.equal(result.investigateCount, 2);
    assert.equal(result.dismissedCount, 3);
    assert.deepEqual(
      result.investigate.map((r) => r.filePath).sort(),
      [
        "backend/open_webui/socket/utils.py",
        "src/app/components/MessageView.tsx",
      ].sort(),
    );
  });
});
