const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  toVerifiedFinding,
  selectVerifiedFindings,
  attachVerifiedFindings,
} = require("../src/lib/finding-validation");
const { compileGateStatus } = require("../src/scan");

function fakeOpenWebuiScan() {
  return [
    {
      type: "sensitiveData",
      severity: "high",
      filePath: "CODE_OF_CONDUCT.md",
      line: 12,
      description: "email address in community policy",
    },
    {
      type: "sensitiveData",
      severity: "high",
      filePath: "CHANGELOG.md",
      line: 40,
      description: "token-shaped string in changelog",
    },
    {
      type: "weakCryptography",
      severity: "high",
      filePath: "package-lock.json",
      line: 8801,
      description: "md5 mentioned in lockfile integrity metadata",
    },
    {
      type: "prototypePollution",
      severity: "high",
      filePath: "static/swagger-ui-bundle.js",
      line: 2,
      description: "__proto__ merge in vendored swagger bundle",
    },
    {
      type: "evalDanger",
      severity: "high",
      filePath: "backend/open_webui/socket/utils.py",
      line: 58,
      description: "eval() on decoded websocket payload",
    },
    {
      type: "innerHtmlXss",
      severity: "high",
      filePath: "src/app/components/MessageView.tsx",
      line: 91,
      description: "innerHTML assignment of message body",
    },
    {
      type: "eu-ai-act",
      severity: "medium",
      filePath: "README.md",
      line: 3,
      description: "AI system mentioned in documentation",
    },
  ];
}

describe("contact-grade finding validation", () => {
  test("docs and vendor matches are not interrupt-worthy", () => {
    const coc = toVerifiedFinding(fakeOpenWebuiScan()[0]);
    const swagger = toVerifiedFinding(fakeOpenWebuiScan()[3]);
    assert.equal(coc.fileRole, "docs");
    assert.equal(coc.interruptWorthy, false);
    assert.equal(swagger.fileRole, "vendor");
    assert.equal(swagger.interruptWorthy, false);
  });

  test("eval() on a socket handler is interrupt-worthy", () => {
    const finding = toVerifiedFinding(fakeOpenWebuiScan()[4]);
    assert.equal(finding.interruptWorthy, true);
    assert.equal(finding.reachability, "Likely");
    assert.match(finding.title, /remote code execution/i);
    assert.equal(finding.questions.real, true);
    assert.equal(finding.questions.relevant, true);
    assert.equal(finding.questions.actionable, true);
    assert.equal(finding.questions.consequential, true);
    assert.equal(finding.questions.interrupt, true);
  });

  test("collapses a noisy scan to a handful of contact-grade findings", () => {
    const selected = selectVerifiedFindings(fakeOpenWebuiScan(), { max: 10 });
    assert.equal(selected.scannedCount, 7);
    assert.ok(selected.verifiedCount <= 2);
    assert.ok(selected.verifiedCount >= 1);
    assert.deepEqual(
      selected.findings.map((f) => f.filePath),
      [
        "backend/open_webui/socket/utils.py",
        "src/app/components/MessageView.tsx",
      ],
    );
  });

  test("compileGateStatus keeps CoC noise off the production gate and attaches verified findings", () => {
    const report = compileGateStatus({
      rawIssues: fakeOpenWebuiScan(),
    });
    const productionPaths = (report.rawIssues || []).map((i) => i.filePath);
    assert.equal(productionPaths.includes("CODE_OF_CONDUCT.md"), false);
    assert.equal(report.contactGrade.emailReady, true);
    assert.ok(report.verifiedFindings.length >= 1);
    assert.equal(report.signal.pipeline[0], "scan");
    assert.ok(report.signal.investigateCount >= 1);
    assert.match(report.signal.note, /not a confirmed vulnerability/);
    assert.ok(
      report.verifiedFindings.some(
        (f) => f.filePath === "backend/open_webui/socket/utils.py",
      ),
    );
  });

  test("attachVerifiedFindings records the commercial pipeline", () => {
    const report = attachVerifiedFindings({}, fakeOpenWebuiScan());
    assert.deepEqual(report.contactGrade.pipeline, [
      "scan",
      "filter",
      "understand",
      "verify",
      "rank",
      "contact",
    ]);
  });
});
