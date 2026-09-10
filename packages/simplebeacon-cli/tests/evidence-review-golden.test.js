/**
 * Golden fixtures: .simplebeacon/evidence-review/*-evidence.json
 * Gate 1 — local click-through contract. Do not change product logic
 * to make these pass; fix regressions if they fail.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FIXTURE_DIR = path.resolve(
  __dirname,
  "../../../.simplebeacon/evidence-review",
);

const EXPECTED = {
  "open-webui-evidence.json": {
    signalsAnalyzed: 182,
    automaticallyDismissed: 177,
    requireReview: 4,
    verifiedVulnerabilities: 0,
    mustDismissPath: "open-webui/backend/open_webui/socket/utils.py",
    mustDismissReason: /Redis EVAL|hardcoded Lua/i,
    mustNotLabelRce: true,
  },
  "gitea-evidence.json": {
    signalsAnalyzed: 712,
    automaticallyDismissed: 689,
    requireReview: 22,
    verifiedVulnerabilities: 0,
    mustDismissPath: "gitea/modules/util/sanitize.go",
    mustHaveXssCluster: true,
  },
  "immich-evidence.json": {
    signalsAnalyzed: 245,
    automaticallyDismissed: 233,
    requireReview: 11,
    verifiedVulnerabilities: 0,
    mustHaveLocalOperatorCli: true,
    mustInvestigateMlEval: "immich/machine-learning/ann/export/run.py",
  },
};

function loadFixture(name) {
  const full = path.join(FIXTURE_DIR, name);
  assert.ok(fs.existsSync(full), `missing golden fixture: ${full}`);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

describe("evidence-review golden fixtures (Gate 1)", () => {
  for (const [name, expect] of Object.entries(EXPECTED)) {
    test(`${name} headline matches fixture contract`, () => {
      const report = loadFixture(name);
      const h = report.maintainerHeadline;
      assert.ok(h, "maintainerHeadline required");
      assert.equal(h.signalsAnalyzed, expect.signalsAnalyzed);
      assert.equal(h.automaticallyDismissed, expect.automaticallyDismissed);
      assert.equal(h.requireReview, expect.requireReview);
      assert.equal(h.verifiedVulnerabilities, expect.verifiedVulnerabilities);
      assert.equal((report.verification?.verified || []).length, 0);
      assert.match(h.summary, /0 verified vulnerabilities/);
      assert.equal(h.summary.includes("vulnerabilities found"), false);
    });
  }

  test("Open WebUI redis.eval is a notable dismissal, not a vulnerability", () => {
    const report = loadFixture("open-webui-evidence.json");
    const dismissed = report.verification?.dismissed || [];
    const hit = dismissed.find((d) =>
      String(d.filePath || "").includes("socket/utils.py"),
    );
    assert.ok(hit, "socket/utils.py must appear in verification.dismissed");
    assert.match(String(hit.verificationReason || ""), /Redis EVAL|hardcoded Lua/i);
    const investigate = report.verification?.investigate || [];
    assert.equal(
      investigate.some((i) => String(i.filePath || "").includes("socket/utils.py")),
      false,
      "dismissed Redis Lua must not remain in investigate",
    );
  });

  test("Gitea XSS is clustered and sanitize.go is dismissed", () => {
    const report = loadFixture("gitea-evidence.json");
    const dismissed = report.verification?.dismissed || [];
    assert.ok(
      dismissed.some((d) => String(d.filePath || "").includes("sanitize.go")),
      "sanitize.go must be dismissed",
    );
    const investigate = report.verification?.investigate || [];
    const xss = investigate.filter(
      (i) =>
        i.category === "xss" ||
        /xss|innerhtml/i.test(String(i.type || i.category || "")),
    );
    assert.ok(xss.length >= 1, "expected XSS investigation clusters");
    assert.ok(
      xss.some((i) => (i.clusterSize || 1) > 1),
      "at least one XSS cluster should group multiple sinks",
    );
    for (const row of xss) {
      assert.notEqual(row.verification, "verified");
    }
  });

  test("Immich CLI secret logging keeps local-operator-cli; ML eval stays investigate", () => {
    const report = loadFixture("immich-evidence.json");
    const investigate = report.verification?.investigate || [];
    const cli = investigate.filter((i) =>
      /commands\/(password-login|reset-admin-password)/i.test(
        String(i.filePath || ""),
      ),
    );
    assert.ok(cli.length >= 1, "expected CLI password logging investigations");
    assert.ok(
      cli.every(
        (i) =>
          i.answers?.privilegesRequired === "local-operator-cli" ||
          /local-operator-cli|not a remote/i.test(
            String(i.verificationReason || ""),
          ),
      ),
      "CLI cases must carry local-operator context",
    );
    const ml = investigate.find((i) =>
      String(i.filePath || "").includes("machine-learning/ann/export/run.py"),
    );
    assert.ok(ml, "ML eval must remain investigate");
    assert.equal(ml.verification, "investigate");
    assert.notEqual(ml.verification, "verified");
    assert.match(
      String(ml.verificationReason || ml.answers?.attackPath || ""),
      /attacker control|not established|unknown/i,
    );
  });

  test("Critical/High detector severity never increases Verified count", () => {
    for (const name of Object.keys(EXPECTED)) {
      const report = loadFixture(name);
      const raw = report.rawIssues || [];
      const highish = raw.filter((i) => {
        const s = String(i.severity || "").toLowerCase();
        return s === "critical" || s === "high";
      });
      assert.ok(
        highish.length > 0 || name.includes("open-webui"),
        `${name}: expected some high/critical detector matches in rawIssues`,
      );
      assert.equal(
        report.maintainerHeadline.verifiedVulnerabilities,
        0,
        `${name}: Verified must stay 0 despite ${highish.length} high/critical signals`,
      );
      assert.equal((report.verification?.verified || []).length, 0);
    }
  });

  test("contactGrade.emailReady stays false on golden fixtures", () => {
    for (const name of Object.keys(EXPECTED)) {
      const report = loadFixture(name);
      assert.equal(report.contactGrade?.emailReady, false);
    }
  });
});
