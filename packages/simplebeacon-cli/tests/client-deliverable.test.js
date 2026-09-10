const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  classifyIssue,
  collectIssues,
  buildClientDeliverable,
  buildExecutiveEngineeringReport,
  buildExecutiveBriefModel,
  writeClientDeliverableFolder,
} = require("../src/reporters/client-deliverable");
const {
  projectExecutiveFinding,
} = require("../src/reporters/executive-brief-core");

test("classifyIssue separates test, dev, and production findings", () => {
  assert.equal(
    classifyIssue({ filePath: "src/server/payments.js", message: "staging URL" }),
    "production-review",
  );
  assert.equal(
    classifyIssue({
      filePath: "src/__tests__/foo.test.js",
      message: "fixture path",
    }),
    "test-suite",
  );
  assert.equal(
    classifyIssue({
      filePath: "package.json",
      message: "listed under devDependencies",
    }),
    "dev-only",
  );
});

test("buildClientDeliverable writes action plan without ANSI and includes triage", () => {
  const report = {
    projectRoot: "/tmp/example",
    qualityScore: 80,
    gate: { pass: false, blockingCount: 1 },
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    rawIssues: [
      {
        severity: "high",
        filePath: "src/api/handler.js",
        line: 12,
        message: "Production fallback points to staging",
      },
      {
        severity: "low",
        filePath: "src/__tests__/handler.test.js",
        message: "sample fixture",
      },
    ],
  };
  const files = buildClientDeliverable(report, {
    company: "Acme",
    client: "payments-api",
    assessor: "Reviewer",
  });
  assert.ok(files["README.md"].includes("Prepared for:** Acme"));
  assert.ok(files["README.md"].includes("bug-bounty"));
  assert.match(files["EXECUTIVE-REPORT.md"], /MERGE BLOCKED/);
  assert.match(files["EXECUTIVE-REPORT.md"], /Finding 1:/);
  assert.match(files["EXECUTIVE-REPORT.md"], /The Solution Blueprint/);
  assert.match(files["EXECUTIVE-REPORT.md"], /src\/api\/handler\.js:12/);
  assert.equal(files["EXECUTIVE-REPORT.md"].includes("$2,570,000"), false);
  assert.match(files["FIX-PATTERNS.md"], /process\.env\.API_KEY/);
  assert.equal(files["FIX-PATTERNS.md"].includes("AIza"), false);
  assert.match(files["ACTION-PLAN.md"], /Simplebeacon Action Plan/);
  assert.equal(files["ACTION-PLAN.md"].includes("\u001b["), false);
  assert.match(files["TRIAGE.md"], /Production-path review \(1\)/);
  assert.match(files["TRIAGE.md"], /Test-suite \/ fixture noise \(1\)/);
  assert.ok(files["executive-report.json"]);
  const model = JSON.parse(files["executive-report.json"]);
  assert.equal(model.projectPath, "/tmp/example");
  assert.equal(model.findings.length, 1);
  assert.equal(model.findings[0].filePath, "src/api/handler.js");
});

test("buildExecutiveEngineeringReport walks nested GitHub complete-scan issues", () => {
  const report = {
    qualityScore: 88,
    repositoryFilesTotal: 5285,
    gate: { pass: false, blockingCount: 1 },
    results: {
      simplebeacon: {
        rawIssues: [
          {
            severity: "high",
            type: "credentials",
            filePath: "app/src/main/java/org/microg/tools/SecretStore.java",
            description: "Hardcoded API key pattern in application source",
            line: 44,
          },
          {
            severity: "low",
            filePath: "src/__tests__/noise.test.js",
            message: "fixture sample",
          },
        ],
      },
    },
    fileReduction: {
      summary: { reclaimableBytes: 1600000 },
    },
  };
  const md = buildExecutiveEngineeringReport(report, { client: "microg" });
  assert.match(md, /Finding 1:/);
  assert.match(md, /SecretStore\.java/);
  assert.match(md, /1\.5 MB/);
  assert.doesNotMatch(md, /noise\.test\.js/);
  assert.equal(collectIssues(report).length, 2);
});

test("buildClientDeliverable requires a report object", () => {
  assert.throws(() => buildClientDeliverable(null), /report object is required/);
});

test("executive brief does not mutate source findings and normalizes paths only", () => {
  const source = {
    filePath: "src\\api\\secrets.js",
    line: 9,
    type: "credentials",
    severity: "critical",
    description: "pattern match only",
    lane: "production",
    fileClass: "app",
    decision: "investigate",
    score: 88,
    category: "credentials",
    pathReason: "app source",
    nextAction: "Confirm live secret",
    verification: "investigate",
    secretValue: "SHOULD_NEVER_COPY",
  };
  const frozen = JSON.parse(JSON.stringify(source));
  const projected = projectExecutiveFinding(source);
  assert.deepEqual(source, frozen);
  assert.equal(projected.filePath, "src/api/secrets.js");
  assert.equal(projected.lane, "production");
  assert.equal(projected.fileClass, "app");
  assert.equal(projected.decision, "investigate");
  assert.equal(projected.score, 88);
  assert.equal(projected.category, "credentials");
  assert.equal(projected.pathReason, "app source");
  assert.equal(projected.nextAction, "Confirm live secret");
  assert.equal(projected.verification, "investigate");
  assert.equal(
    Object.prototype.hasOwnProperty.call(projected, "secretValue"),
    false,
  );
});

test("signal dismiss rows are excluded; projectPath preserved; deterministic", () => {
  const report = {
    projectPath: "C:\\Corporate Space\\gitea-fork",
    gate: { pass: false, blockingCount: 1 },
    signal: {
      pipeline: ["scan", "classify", "score", "triage", "investigate"],
      scannedCount: 3,
      dismissedCount: 1,
      reviewCount: 1,
      investigateCount: 1,
      investigate: [
        {
          filePath: "pkg\\auth\\token.go",
          line: 40,
          type: "credentials",
          scannerSeverity: "critical",
          decision: "investigate",
          lane: "production",
          fileClass: "app",
          score: 90,
          category: "credentials",
          pathReason: "app",
          nextAction: "Confirm",
          description: "credential pattern",
        },
      ],
      review: [
        {
          filePath: "cmd/server/main.go",
          line: 12,
          type: "authBypass",
          scannerSeverity: "high",
          decision: "review",
          lane: "production",
          fileClass: "app",
          score: 50,
          category: "authBypass",
          description: "auth gate",
        },
      ],
    },
  };
  const a = buildExecutiveBriefModel(report, { client: "gitea" });
  const b = buildExecutiveBriefModel(report, { client: "gitea" });
  assert.equal(a.projectPath, "C:\\Corporate Space\\gitea-fork");
  assert.equal(a.findings.length, 2);
  assert.ok(a.findings.every((f) => f.decision !== "dismiss"));
  assert.equal(a.findings[0].filePath.includes("\\"), false);
  assert.deepEqual(a, b);
});

test("writeClientDeliverableFolder publishes _SUCCESS only after artifacts exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-exec-"));
  try {
    const report = {
      projectRoot: "/tmp/example",
      gate: { pass: true, blockingCount: 0 },
      rawIssues: [
        {
          severity: "high",
          filePath: "src/main.js",
          message: "eval(userInput)",
          type: "evalDanger",
        },
      ],
    };
    const { outDir, files } = writeClientDeliverableFolder(dir, report, {
      client: "demo",
    });
    assert.ok(files.includes("_SUCCESS"));
    assert.ok(fs.existsSync(path.join(outDir, "_SUCCESS")));
    assert.ok(fs.existsSync(path.join(outDir, "EXECUTIVE-REPORT.md")));
    assert.ok(fs.existsSync(path.join(outDir, "TRIAGE.md")));
    assert.ok(fs.existsSync(path.join(outDir, "executive-report.json")));
    const model = JSON.parse(
      fs.readFileSync(path.join(outDir, "executive-report.json"), "utf8"),
    );
    assert.ok(Array.isArray(model.findings));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
