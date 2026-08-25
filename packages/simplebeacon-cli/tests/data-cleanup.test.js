// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * @file Data-cleanup analyzer integration tests.
 *
 * Covers config management, dependency health, environment variables,
 * data freshness, privacy, lineage, consistency, and access-pattern scanners.
 * Each test creates a temporary project via {@link makeTempProject}, runs the
 * relevant analyzer, and asserts on the returned findings structure.
 *
 * @module data-cleanup.test
 */

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  ConfigManagementAnalyzer,
} = require("../src/analyzers/data-cleanup/config-management-analyzer");
const {
  DependencyHealthAnalyzer,
} = require("../src/analyzers/data-cleanup/dependency-health-analyzer");
const {
  EnvironmentVariableAnalyzer,
} = require("../src/analyzers/data-cleanup/environment-variable-analyzer");
const {
  DataFreshnessAnalyzer,
} = require("../src/analyzers/data-cleanup/data-freshness-analyzer");
const {
  DataAccessPatternAnalyzer,
} = require("../src/analyzers/data-cleanup/data-access-pattern-analyzer");
const {
  DataPrivacyAnalyzer,
  scanPiiContent,
} = require("../src/analyzers/data-cleanup/data-privacy-analyzer");
const {
  DataLineageAnalyzer,
} = require("../src/analyzers/data-cleanup/data-lineage-analyzer");
const {
  DataConsistencyAnalyzer,
} = require("../src/analyzers/data-cleanup/data-consistency-analyzer");
const {
  BuildArtifactScanner,
} = require("../src/analyzers/file-reduction/build-artifact-scanner");
const { aggregateCleanupFindings } = require("../src/lib/result-aggregator");
const { buildExecutiveSummary } = require("../src/lib/executive-summary");
const { buildScannerStatistics } = require("../src/lib/scanner-statistics");
const { enrichCleanupReport } = require("../src/lib/enrich-cleanup-report");
const { triagePrivacyFindings } = require("../src/lib/privacy-triage");
const {
  crossReferenceScannerResults,
} = require("../src/lib/cross-analyzer-intelligence");
const {
  walkProjectFiles,
} = require("../src/analyzers/file-reduction/utils/project-walker");

const _tempRoots = [];

/**
 * Create a temporary project directory, write the given file tree,
 * and register the root for automatic cleanup after tests finish.
 * @param {Object<string,string>} structure Map of relative paths to file contents.
 * @returns {string} Absolute path to the temporary project root.
 */
function makeTempProject(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-cleanup-"));
  _tempRoots.push(root);
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }
  return root;
}

/**
 * Clean up all temporary project directories created during the test run.
 */
after(() => {
  for (const root of _tempRoots) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
  _tempRoots.length = 0;
});

test("ConfigManagementAnalyzer flags env sprawl and profile-local inconsistencies", async () => {
  const root = makeTempProject({
    ".env": "DB_HOST=localhost\nAPI_URL=http://localhost\n",
    ".env.example": "DB_HOST=template-db\nAPI_URL=http://localhost\n",
    ".env.production": "DB_HOST=prod-db\nAPI_URL=https://prod.example\n",
    ".env.development": "DB_HOST=dev-db\n",
    ".env.local": "DB_HOST=local-db\n",
    "webpack.config.js": "module.exports = {};\n",
    "vite.config.js": "export default {};\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new ConfigManagementAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(result.findings.some((f) => f.type === "config-sprawl"));
  assert.ok(
    result.findings.some(
      (f) => f.type === "env-inconsistency" && f.metadata.key === "DB_HOST",
    ),
  );
  assert.ok(
    !result.findings.some(
      (f) =>
        f.type === "env-inconsistency" &&
        f.metadata.key === "API_URL" &&
        f.metadata.values.some((entry) => entry.file === ".env.production") &&
        f.metadata.values.some((entry) => entry.file === ".env"),
    ),
    "API_URL should not be flagged when .env and .env.production both match localhost",
  );
  assert.ok(
    result.findings.some((f) => f.type === "duplicate-config-type"),
    "should detect duplicate config tools (webpack + vite)",
  );
});

test("DependencyHealthAnalyzer detects duplicate sections and version drift", async () => {
  const root = makeTempProject({
    "apps/a/package.json": JSON.stringify({
      dependencies: { lodash: "^4.17.0", express: "^4.18.0" },
      devDependencies: { express: "^4.19.0" },
    }),
    "apps/a/index.js": "const express = require('express');\n",
    "apps/b/package.json": JSON.stringify({
      dependencies: { lodash: "^5.0.0" },
    }),
    "apps/b/index.js": "const _ = require('lodash');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DependencyHealthAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some(
      (f) =>
        f.type === "duplicate-dependency" &&
        f.metadata.dependency === "express",
    ),
    "should detect duplicate express dependency",
  );
  assert.ok(
    result.findings.some(
      (f) => f.type === "version-drift" && f.metadata.dependency === "lodash",
    ),
    "should detect lodash version drift",
  );
});

test("EnvironmentVariableAnalyzer detects missing and unused env keys", async () => {
  const root = makeTempProject({
    ".env": "PORT=3000\nLEGACY_FLAG=1\n",
    "server.js":
      "const port = process.env.PORT;\nconst api = process.env.API_BASE;\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new EnvironmentVariableAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some(
      (f) => f.type === "missing-env-key" && f.metadata.key === "API_BASE",
    ),
    "should flag API_BASE as missing",
  );
  assert.ok(
    result.findings.some(
      (f) => f.type === "unused-env-key" && f.metadata.key === "LEGACY_FLAG",
    ),
    "should flag LEGACY_FLAG as unused",
  );
});

test("EnvironmentVariableAnalyzer treats OS-injected env keys as runtime-provided", async () => {
  const root = makeTempProject({
    "tools/restore.js":
      "const home = process.env.USERPROFILE || process.env.HOME;\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new EnvironmentVariableAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) => f.type === "missing-env-key" && f.metadata.key === "USERPROFILE",
    ),
    "OS-injected keys should not be flagged",
  );
});

test("EnvironmentVariableAnalyzer skips phase-2 SSO example keys", async () => {
  const root = makeTempProject({
    ".env.example.phase2-sso": "SAML_ENABLED=false\nLDAP_URL=ldap://test\n",
    ".env.example": "PORT=3000\n",
    "server.js": "const port = process.env.PORT;\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new EnvironmentVariableAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) => f.type === "unused-env-key" && f.metadata.key === "SAML_ENABLED",
    ),
    "phase-2 SSO example keys should be skipped",
  );
  assert.ok(
    !result.findings.some(
      (f) => f.type === "unused-env-key" && f.metadata.key === "LDAP_URL",
    ),
    "phase-2 SSO example keys should be skipped",
  );
});

test("EnvironmentVariableAnalyzer skips optional store keys with code defaults", async () => {
  const root = makeTempProject({
    ".env": "PORT=3000\n",
    "server/lib/commission-store.js":
      "const p = process.env.SIMPLEBEACON_SALES_COMMISSIONS_STORE || '.simplebeacon/commissions.json';\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new EnvironmentVariableAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) =>
        f.type === "missing-env-key" &&
        f.metadata.key === "SIMPLEBEACON_SALES_COMMISSIONS_STORE",
    ),
    "optional store keys with code defaults should not be flagged",
  );
});

test("ConfigManagementAnalyzer ignores example-vs-production feature flag drift", async () => {
  const root = makeTempProject({
    ".env.production": "SIMPLEBEACON_MONETIZATION_ENABLED=true\n",
    ".env.production.example": "SIMPLEBEACON_MONETIZATION_ENABLED=false\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new ConfigManagementAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) =>
        f.type === "env-inconsistency" &&
        f.metadata.key === "SIMPLEBEACON_MONETIZATION_ENABLED",
    ),
    "example-vs-production feature flag drift should be ignored",
  );
});

test("EnvironmentVariableAnalyzer detects get() and resolveCredential env references", async () => {
  const root = makeTempProject({
    ".env": "STRIPE_PUBLISHABLE_KEY=pk_test_x\n",
    "server/config.js":
      "function get(k){return process.env[k]} const pk = get('STRIPE_PUBLISHABLE_KEY');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new EnvironmentVariableAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) =>
        f.type === "unused-env-key" &&
        f.metadata.key === "STRIPE_PUBLISHABLE_KEY",
    ),
    "get() / resolveCredential env references should count",
  );
});

test("DependencyHealthAnalyzer detects tools/ requires before file cap", async () => {
  const root = makeTempProject({
    "package.json": JSON.stringify({
      dependencies: { archiver: "^6.0.1", express: "^4.18.0" },
    }),
    "index.js": "const express = require('express');\n",
    "tools/bundle.js": "const archiver = require('archiver');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DependencyHealthAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some(
      (f) =>
        f.type === "unused-dependency" && f.metadata.dependency === "archiver",
    ),
    "tools/ requires should count before file cap",
  );
});

test("DependencyHealthAnalyzer ignores node_modules package manifests", async () => {
  const root = makeTempProject({
    "apps/a/package.json": JSON.stringify({
      dependencies: { express: "^4.18.0" },
    }),
    "apps/a/index.js": "const express = require('express');\n",
    "node_modules/lodash/package.json": JSON.stringify({
      dependencies: { "unused-dep": "^1.0.0" },
    }),
    "node_modules/lodash/index.js": "module.exports = {};\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DependencyHealthAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(result.summary.packageJsonFiles, 1);
  assert.ok(
    !result.findings.some((f) => String(f.path).includes("node_modules")),
    "node_modules should be ignored",
  );
});

test("ConfigManagementAnalyzer ignores node_modules config files", async () => {
  const root = makeTempProject({
    ".env": "PORT=3000\n",
    "tsconfig.json": "{}\n",
    "node_modules/foo/tsconfig.json": "{}\n",
    "node_modules/foo/package.json": "{}\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new ConfigManagementAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(result.summary.packageJsonFiles, 0);
  assert.ok(
    result.summary.configFiles <= 2,
    "configFiles should only count root-level configs",
  );
});

test("buildExecutiveSummary categorizes credential findings", () => {
  const report = {
    generatedAt: new Date().toISOString(),
    scanProfile: "data-quality",
    scanners: {
      "data-privacy": { credentialHits: 2, piiHits: 3 },
      "dependency-health": {
        packageJsonFiles: 12,
        unusedDependencies: 4,
        versionDrift: 2,
      },
      "config-management": { envFiles: 5, inconsistentEnvKeys: 3 },
      "environment-variables": { missingKeys: 2, unusedKeys: 10 },
      "data-consistency": { shapeDriftGroups: 1 },
      "data-access-patterns": { patternFindings: 5 },
      "data-lineage": { orphanedDataFiles: 8 },
    },
    findings: {
      dataPrivacy: [
        {
          path: "tests/fixtures/simplebeacon-toxic-fixtures/src/server/auth-mock.js",
          reason: "Credential pattern (aws-access-key) in data file",
          metadata: { line: 2, patternId: "aws-access-key" },
        },
        {
          path: "docs/reports/MOCK_DATA_PREVENTION_GUIDELINES.md",
          reason: "Possible realistic email in data file",
          metadata: { line: 10, patternId: "realistic-email" },
        },
      ],
    },
    summary: { reclaimableBytes: 0 },
  };
  const summary = buildExecutiveSummary(report);
  assert.equal(summary.security.credentials.length, 1);
  assert.equal(summary.security.credentialsNeedingReview, 0);
  assert.equal(summary.security.piiNeedingReview, 0);
  assert.ok(
    summary.notes.some(
      (note) => note.includes("test fixtures") || note.includes("mock/sample"),
    ),
    "summary should mention test fixture context",
  );
});

test("buildScannerStatistics exposes workspace-scoped scanner counts", () => {
  const report = {
    projectRoot: "/tmp/project",
    durationMs: 1000,
    inventory: { totalFiles: 100, totalDirectories: 10 },
    scanners: {
      "config-management": {
        configFiles: 5,
        envFiles: 2,
        packageJsonFiles: 2,
        sprawlFindings: 1,
        inconsistentEnvKeys: 3,
      },
      "dependency-health": {
        packageJsonFiles: 2,
        uniqueDependencies: 10,
        unusedDependencies: 1,
        duplicateDependencies: 0,
        versionDrift: 0,
      },
    },
    findings: {
      configManagement: [
        { type: "config-sprawl" },
        { type: "env-inconsistency" },
        { type: "env-inconsistency" },
        { type: "env-inconsistency" },
      ],
      dependencyHealth: [{ type: "unused-dependency" }],
    },
  };
  const stats = buildScannerStatistics(report);
  assert.equal(stats.scanners["config-management"].stats.packageJsonFiles, 2);
  assert.equal(stats.scanners["dependency-health"].stats.unusedDependencies, 1);
  assert.equal(stats.findingsBreakdown.configManagement.envInconsistencies, 3);
});

test("enrichCleanupReport preserves dependency-health stats when findings are clean", () => {
  const enriched = enrichCleanupReport(
    {
      projectRoot: "/tmp/project",
      durationMs: 500,
      inventory: { totalFiles: 100, totalDirectories: 10 },
      scanners: {
        "dependency-health": {
          packageJsonFiles: 2,
          uniqueDependencies: 24,
          unusedDependencies: 0,
          duplicateDependencies: 0,
          versionDrift: 0,
        },
        "config-management": {
          configFiles: 5,
          envFiles: 2,
          packageJsonFiles: 2,
        },
      },
      findings: {
        configManagement: [],
        dependencyHealth: [],
        environmentVariables: [],
      },
      summary: { totalFindings: 0 },
    },
    { profile: "data-quality" },
  );

  assert.equal(enriched.scanners["dependency-health"].packageJsonFiles, 2);
  assert.equal(enriched.scanners["dependency-health"].uniqueDependencies, 24);
  assert.equal(enriched.executiveSummary.workspace.packageJsonFiles, 2);
});

test("triagePrivacyFindings groups PII by category", () => {
  const triaged = triagePrivacyFindings([
    {
      path: "docs/reports/MOCK_DATA_GUIDE.md",
      reason: "Possible realistic email in data file",
      metadata: { line: 1 },
    },
    {
      path: "web/data/users-sample.json",
      reason: "Possible realistic email in data file",
      metadata: { line: 2 },
    },
    {
      path: "src/server/users.js",
      reason: "Possible realistic email in data file",
      metadata: { line: 3 },
    },
  ]);
  assert.equal(triaged.byCategory.documentation, 1);
  assert.equal(triaged.byCategory["mock-sample-data"], 1);
  assert.equal(triaged.piiNeedingReview, 1);
});

test("aggregateCleanupFindings dedupes and sorts by severity", () => {
  const aggregated = aggregateCleanupFindings([
    { type: "env-secret", path: ".env", reason: "a", severity: "high" },
    { type: "env-secret", path: ".env", reason: "a", severity: "high" },
    { type: "unused-env-key", path: ".env", reason: "b", severity: "low" },
  ]);
  assert.equal(aggregated.findings.length, 2);
  assert.equal(aggregated.findings[0].severity, "high");
});

test("DataFreshnessAnalyzer flags old mock data files", async () => {
  const root = makeTempProject({
    "web/data/users-sample.json": '{"users":[]}\n',
  });
  const filePath = path.join(root, "web/data/users-sample.json");
  const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
  fs.utimesSync(filePath, oldDate, oldDate);

  const inventory = await walkProjectFiles(root);
  const scanner = new DataFreshnessAnalyzer({ staleDays: 90 });
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some((f) => f.type === "stale-data"),
    "files older than staleDays should be flagged",
  );
});

test("DataAccessPatternAnalyzer skips intentional CLI sync readers", async () => {
  const root = makeTempProject({
    "packages/simplebeacon-cli/src/lib/scan-history.js":
      "const x = JSON.parse(fs.readFileSync(p));\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataAccessPatternAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(
    result.findings.length,
    0,
    "CLI sync readers should be skipped as intentional",
  );
});

test("DataPrivacyAnalyzer skips docker-compose comment placeholders", async () => {
  const root = makeTempProject({
    "docker-compose.simplebeacon.yml":
      [
        "services:",
        "  dashboard:",
        "    environment:",
        "      DATABASE_URL: ${DATABASE_URL:-}",
        "# DATABASE_URL=postgresql://user:pass@localhost/db",
      ].join("\n") + "\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataPrivacyAnalyzer();
  const result = await scanner.scan(root, { inventory, useCache: false });
  assert.equal(
    result.findings.filter((f) => f.reason.includes("Credential")).length,
    0,
    "docker-compose comment placeholders should be skipped",
  );
});

test("DataAccessPatternAnalyzer flags sync reads in route handlers", async () => {
  const root = makeTempProject({
    "server/routes/data.js":
      "router.get('/x', (req,res)=>{ const x = JSON.parse(fs.readFileSync('data.json')); res.json(x); });\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataAccessPatternAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some((f) => f.type === "data-access-pattern"),
    "sync reads in route handlers should be flagged",
  );
});

test("DataAccessPatternAnalyzer flags raw SQL via AST", async () => {
  const root = makeTempProject({
    "server/routes/users.js":
      "router.get('/:id', (req,res)=>{ db.query('SELECT * FROM users WHERE id = ' + req.params.id); });\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataAccessPatternAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some(
      (f) =>
        f.type === "data-access-pattern" &&
        f.metadata?.patternId === "raw-sql-ast",
    ),
    "raw SQL via AST should be flagged",
  );
});

test("DataPrivacyAnalyzer skips protected web/data sample paths", async () => {
  const root = makeTempProject({
    "web/data/billing-system-sample.json": '{"email":"dev@cascade.ai"}\n',
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataPrivacyAnalyzer();
  const result = await scanner.scan(root, { inventory, useCache: false });
  assert.equal(
    result.findings.length,
    0,
    "protected web/data sample paths should be skipped",
  );
});

test("BuildArtifactScanner ignores empty log files", async () => {
  const root = makeTempProject({
    "logs/audit.log": "",
    "logs/runtime.log": "entry\n",
  });
  const scanner = new BuildArtifactScanner();
  const result = await scanner.scan(root);
  assert.equal(
    result.findings.some((f) => f.path === "logs/audit.log"),
    false,
    "empty log files should be ignored",
  );
  assert.ok(
    result.findings.some((f) => f.path === "logs/runtime.log"),
    "non-empty log files should be included",
  );
});

test("DataPrivacyAnalyzer flags PII in non-protected mock data", async () => {
  const root = makeTempProject({
    "reports/users-mock.json": '{"email":"john.doe@company.com"}\n',
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataPrivacyAnalyzer();
  const result = await scanner.scan(root, { inventory, useCache: false });
  assert.ok(
    result.findings.some((f) => f.type === "data-privacy"),
    "PII in non-protected mock data should be flagged",
  );
  const hit = result.findings.find(
    (f) => f.metadata?.patternId === "realistic-email",
  );
  assert.ok(
    hit.metadata.confidenceScore >= 0.3,
    "realistic-email hit should have confidence >= 0.3",
  );
});

test("scanPiiContent skips comment and documentation example contexts", () => {
  const docFindings = scanPiiContent(
    "docs/MOCK_DATA_GUIDE.md",
    [
      "// contact admin@example.com for help",
      "See admin@company.com in production only",
    ].join("\n"),
  );
  assert.equal(docFindings.length, 0);

  const codeFindings = scanPiiContent(
    "server/config.js",
    ["const owner = 'ops@company.com';"].join("\n"),
  );
  assert.ok(
    codeFindings.some((f) => f.metadata.patternId === "realistic-email"),
    "realistic emails in code should be flagged",
  );
});

test("DataLineageAnalyzer detects runtime fetch references to data files", async () => {
  const root = makeTempProject({
    "web/data/users.json": '{"users":[]}\n',
    "server/routes/users.js":
      "fetch('web/data/users.json').then(r => r.json());\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataLineageAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(
    result.findings.length,
    0,
    "referenced data files should not produce lineage findings",
  );
  assert.ok(
    result.metadata.lineage.some(
      (entry) =>
        entry.path.includes("web/data/users.json") && entry.consumerCount >= 1,
    ),
    "lineage should record consumer references",
  );
});

test("crossReferenceScannerResults boosts PII severity for orphaned data files", () => {
  const results = crossReferenceScannerResults({
    "data-privacy": {
      findings: [
        {
          type: "data-privacy",
          path: "reports/orphan-mock.json",
          severity: "medium",
          metadata: { patternId: "realistic-email", line: 1 },
        },
      ],
    },
    "data-lineage": {
      findings: [
        {
          type: "orphaned-data",
          path: "reports/orphan-mock.json",
          metadata: { consumerCount: 0 },
        },
      ],
    },
  });
  const boosted = results["data-privacy"].findings[0];
  assert.equal(boosted.severity, "high");
  assert.equal(boosted.metadata.crossAnalyzerBoost, "orphaned-data-with-pii");
});

test("ConfigManagementAnalyzer flags unreferenced non-root configs", async () => {
  const root = makeTempProject({
    "tools/vite.config.js": "export default {};\n",
    "server/index.js": "console.log('no vite refs');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new ConfigManagementAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some(
      (f) =>
        f.type === "unused-config" && f.path.includes("tools/vite.config.js"),
    ),
    "unreferenced non-root configs should be flagged",
  );
});

test("DataLineageAnalyzer marks unreferenced mock json as orphaned", async () => {
  const root = makeTempProject({
    "reports/orphan-mock.json": '{"ok":true}\n',
    "server/index.js": "console.log('no data refs');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataLineageAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    result.findings.some((f) => f.path.includes("orphan-mock.json")),
    "unreferenced mock json should be flagged as orphaned",
  );
});

test("DataLineageAnalyzer skips allowlisted runtime sample paths", async () => {
  const root = makeTempProject({
    "web/data/dashboard-home-sample.json": '{"ok":true}\n',
    "data/mock/report.json": '{"ok":true}\n',
    "server/index.js": "console.log('no static refs');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataLineageAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(
    result.findings.length,
    0,
    "allowlisted runtime sample paths should be skipped",
  );
  assert.equal(
    result.summary.orphanedDataFiles,
    0,
    "allowlisted runtime sample paths should not count as orphaned",
  );
});

test("DataLineageAnalyzer skips nested tests/fixtures paths (monorepo layout)", async () => {
  const root = makeTempProject({
    "ai-platform/tests/fixtures/core/core-flow.json": '{"ok":true}\n',
    "server/index.js": "console.log('no static refs');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataLineageAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(
    result.findings.length,
    0,
    "tests/fixtures paths should be skipped",
  );
  assert.equal(
    result.summary.orphanedDataFiles,
    0,
    "tests/fixtures paths should not count as orphaned",
  );
});

test("DataConsistencyAnalyzer ignores intentional mock sample shape differences", async () => {
  const root = makeTempProject({
    "web/data/a-sample.json": '{"type":"a","items":[]}\n',
    "web/data/b-sample.json": '{"type":"b","rows":[]}\n',
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataConsistencyAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.ok(
    !result.findings.some((f) => f.type === "data-shape-drift"),
    "intentional mock sample shape differences should be ignored",
  );
});

test("aggregateCleanupFindings handles empty array", () => {
  const aggregated = aggregateCleanupFindings([]);
  assert.equal(aggregated.findings.length, 0);
  assert.deepStrictEqual(aggregated.bySeverity, {
    critical: [],
    high: [],
    medium: [],
    low: [],
  });
});

test("buildExecutiveSummary handles minimal empty report", () => {
  const summary = buildExecutiveSummary({
    generatedAt: new Date().toISOString(),
    scanProfile: "data-quality",
    scanners: {},
    findings: {},
    summary: { reclaimableBytes: 0 },
  });
  assert.equal(summary.security.credentials.length, 0);
  assert.equal(summary.security.piiNeedingReview, 0);
});

test("DataConsistencyAnalyzer topLevelKeys returns null for invalid JSON", () => {
  const {
    topLevelKeys,
  } = require("../src/analyzers/data-cleanup/data-consistency-analyzer");
  assert.strictEqual(topLevelKeys("not json"), null);
  assert.deepStrictEqual(topLevelKeys('{"a":1}'), ["a"]);
  assert.deepStrictEqual(topLevelKeys("[1,2,3]"), []);
});

test("DataLineageAnalyzer tracks referenced data files without findings", async () => {
  const root = makeTempProject({
    "web/data/users.json": '{"users":[]}\n',
    "server/routes/users.js":
      "const data = require('../../web/data/users.json');\n",
  });
  const inventory = await walkProjectFiles(root);
  const scanner = new DataLineageAnalyzer();
  const result = await scanner.scan(root, { inventory });
  assert.equal(
    result.findings.length,
    0,
    "referenced data files should not produce findings",
  );
  assert.ok(
    result.metadata.lineage.some((e) => e.path.includes("web/data/users.json")),
    "lineage should include referenced file",
  );
});

test("scanPiiContent flags realistic credit card numbers in code", () => {
  const findings = scanPiiContent(
    "server/payment.js",
    ["const card = '5555555555554444';"].join("\n"),
  );
  assert.ok(
    findings.some((f) => f.metadata.patternId === "credit-card"),
    "realistic credit card numbers should be flagged",
  );
});

test("crossReferenceScannerResults leaves clean findings unchanged", () => {
  const results = crossReferenceScannerResults({
    "data-privacy": {
      findings: [
        {
          type: "data-privacy",
          path: "reports/users.json",
          severity: "medium",
          metadata: { patternId: "realistic-email", line: 1 },
        },
      ],
    },
    "data-lineage": {
      findings: [],
    },
  });
  assert.equal(results["data-privacy"].findings[0].severity, "medium");
  assert.equal(
    results["data-privacy"].findings[0].metadata.crossAnalyzerBoost,
    undefined,
  );
});
