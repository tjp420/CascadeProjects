const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  RULE_CATALOG,
  scanDeploymentReadiness,
  findRenderYamlFiles,
  parseRenderYaml,
  parseWorkspaces,
  findServiceDirectories,
  findCreateTableStatements,
  extractEnvVarsFromSource,
  checkCorsApproach,
} = require("../src/rules/deployment-readiness-scanner");

/**
 * Create a temp repo with the given structure.
 * @param {Object} structure - { 'path/to/file': 'content' }
 * @returns {Promise<{dir:string, cleanup:Function}>}
 */
async function createTempRepo(structure) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sb-dep-test-"));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(dir, relPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content);
  }
  return {
    dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

const SAMPLE_RENDER_YAML = `databases:
  - name: test-db
    plan: free
    databaseName: testdb
    user: test_user

services:
  - type: web
    name: test-service
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: node server.cjs
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        fromDatabase:
          name: test-db
          property: connectionString
      - key: SECRET_KEY
        sync: false
`;

test("RULE_CATALOG has 6 rules with correct IDs", () => {
  assert.strictEqual(RULE_CATALOG.length, 6);
  const ids = RULE_CATALOG.map((r) => r.id);
  assert.ok(ids.includes("SB-DEP-001"));
  assert.ok(ids.includes("SB-DEP-002"));
  assert.ok(ids.includes("SB-DEP-003"));
  assert.ok(ids.includes("SB-DEP-004"));
  assert.ok(ids.includes("SB-DEP-005"));
  assert.ok(ids.includes("SB-DEP-006"));
});

test("findRenderYamlFiles discovers render.yaml files", async () => {
  const repo = await createTempRepo({
    "render.yaml": SAMPLE_RENDER_YAML,
    "api-server/render.yaml": SAMPLE_RENDER_YAML,
    "packages/cli/package.json":
      '{"name":"cli","scripts":{"start":"node cli.js"}}',
  });
  try {
    const files = findRenderYamlFiles(repo.dir);
    assert.ok(files.length >= 2);
    // Normalize path separators for cross-platform comparison
    const normalized = files.map((f) => f.replace(/\\/g, "/"));
    assert.ok(normalized.some((f) => f.endsWith("render.yaml")));
    assert.ok(normalized.some((f) => f.endsWith("api-server/render.yaml")));
  } finally {
    repo.cleanup();
  }
});

test("parseRenderYaml extracts services, databases, and env vars", async () => {
  const repo = await createTempRepo({
    "render.yaml": SAMPLE_RENDER_YAML,
  });
  try {
    const result = parseRenderYaml(path.join(repo.dir, "render.yaml"));
    assert.strictEqual(result.services.length, 1);
    assert.strictEqual(result.services[0].name, "test-service");
    assert.strictEqual(result.services[0].type, "web");
    assert.strictEqual(result.services[0].startCommand, "node server.cjs");
    assert.strictEqual(result.services[0].healthCheckPath, "/health");
    assert.strictEqual(result.services[0].envVars.length, 4);
    assert.strictEqual(result.services[0].envVars[0].key, "NODE_ENV");
    assert.strictEqual(result.services[0].envVars[0].value, "production");
    assert.strictEqual(result.services[0].envVars[3].key, "SECRET_KEY");
    assert.strictEqual(result.services[0].envVars[3].sync, false);
    assert.strictEqual(result.databases.length, 1);
    assert.strictEqual(result.databases[0].name, "test-db");
    assert.strictEqual(result.databases[0].databaseName, "testdb");
  } finally {
    repo.cleanup();
  }
});

test("parseWorkspaces expands glob patterns", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "test-repo",
      workspaces: ["packages/*", "api-server"],
    }),
    "packages/cli/package.json": '{"name":"cli"}',
    "packages/lib/package.json": '{"name":"lib"}',
    "api-server/package.json": '{"name":"api"}',
  });
  try {
    const workspaces = parseWorkspaces(repo.dir).map((w) =>
      w.replace(/\\/g, "/"),
    );
    assert.ok(workspaces.some((w) => w.includes("packages/cli")));
    assert.ok(workspaces.some((w) => w.includes("packages/lib")));
    assert.ok(workspaces.includes("api-server"));
  } finally {
    repo.cleanup();
  }
});

test("findServiceDirectories discovers dirs with start scripts", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "root",
      scripts: { start: "node index.js" },
    }),
    "api-server/package.json": JSON.stringify({
      name: "api",
      scripts: { start: "node server.cjs" },
    }),
    "api-server/render.yaml": SAMPLE_RENDER_YAML,
    "lib/package.json": JSON.stringify({
      name: "lib",
      scripts: { build: "tsc" },
    }), // no start script
  });
  try {
    const services = findServiceDirectories(repo.dir);
    assert.ok(services.some((s) => s.dir === "."));
    assert.ok(services.some((s) => s.dir === "api-server"));
    assert.ok(!services.some((s) => s.dir === "lib")); // no start script
  } finally {
    repo.cleanup();
  }
});

test("findCreateTableStatements finds CREATE TABLE in SQL files", async () => {
  const repo = await createTempRepo({
    "api-server/migrations/001-init.sql":
      "CREATE TABLE users (id UUID PRIMARY KEY);",
    "ai-platform/server/db/schema.sql":
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);",
  });
  try {
    const tables = findCreateTableStatements(repo.dir, "api-server");
    assert.ok(tables.some((t) => t.table === "users"));
    assert.ok(tables.every((t) => t.service === "api-server"));
  } finally {
    repo.cleanup();
  }
});

test("extractEnvVarsFromSource finds process.env references", async () => {
  const repo = await createTempRepo({
    "server.cjs":
      "const port = process.env.PORT || 3000; const key = process.env.SECRET_KEY;",
  });
  try {
    const vars = extractEnvVarsFromSource(path.join(repo.dir, "server.cjs"));
    assert.ok(vars.includes("PORT"));
    assert.ok(vars.includes("SECRET_KEY"));
  } finally {
    repo.cleanup();
  }
});

test("checkCorsApproach detects shared-cors-config", async () => {
  const repo = await createTempRepo({
    "api-server/server.cjs":
      'const { isAllowedOrigin } = require("./lib/cors-config.cjs");',
    "api-server/lib/cors-config.cjs": "function resolveCorsOptions() {}",
  });
  try {
    const approach = checkCorsApproach(repo.dir, "api-server");
    assert.ok(approach);
    assert.strictEqual(approach.approach, "shared-cors-config");
  } finally {
    repo.cleanup();
  }
});

test("checkCorsApproach detects inline-cors", async () => {
  const repo = await createTempRepo({
    "coming-soon/server.cjs":
      'app.use((req,res,next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });',
  });
  try {
    const approach = checkCorsApproach(repo.dir, "coming-soon");
    assert.ok(approach);
    assert.strictEqual(approach.approach, "inline-cors");
  } finally {
    repo.cleanup();
  }
});

test("scanDeploymentReadiness detects SB-DEP-003 schema conflict", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "test-repo",
      workspaces: ["api-server", "ai-platform"],
    }),
    "api-server/package.json": JSON.stringify({
      name: "api",
      scripts: { start: "node server.cjs" },
    }),
    "api-server/render.yaml": SAMPLE_RENDER_YAML,
    "api-server/server.cjs": "const port = process.env.PORT;",
    "api-server/migrations/001.sql":
      "CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid());",
    "ai-platform/package.json": JSON.stringify({
      name: "platform",
      scripts: { start: "node server.cjs" },
    }),
    "ai-platform/server/db/schema.sql":
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);",
  });
  try {
    const result = await scanDeploymentReadiness(repo.dir);
    const schemaConflict = result.issues.find(
      (i) => i.pattern === "SB-DEP-003",
    );
    assert.ok(schemaConflict, "Should detect SB-DEP-003 schema conflict");
    assert.ok(schemaConflict.description.includes("users"));
    assert.ok(schemaConflict.description.includes("api-server"));
    assert.ok(schemaConflict.description.includes("ai-platform"));
  } finally {
    repo.cleanup();
  }
});

test("scanDeploymentReadiness detects SB-DEP-001 workspace membership", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "test-repo",
      workspaces: ["api-server"], // missing ai-platform
    }),
    "api-server/package.json": JSON.stringify({
      name: "api",
      scripts: { start: "node server.cjs" },
    }),
    "ai-platform/package.json": JSON.stringify({
      name: "platform",
      scripts: { start: "node server.cjs" },
    }),
  });
  try {
    const result = await scanDeploymentReadiness(repo.dir);
    const workspaceIssue = result.issues.find(
      (i) => i.pattern === "SB-DEP-001" && i.metadata.service === "ai-platform",
    );
    assert.ok(
      workspaceIssue,
      "Should detect SB-DEP-001 for ai-platform not in workspaces",
    );
  } finally {
    repo.cleanup();
  }
});

test("scanDeploymentReadiness detects SB-DEP-002 missing env var", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "test-repo",
      workspaces: ["api-server"],
    }),
    "api-server/package.json": JSON.stringify({
      name: "api",
      scripts: { start: "node server.cjs" },
    }),
    "api-server/render.yaml": `services:
  - type: web
    name: api
    startCommand: node server.cjs
    envVars:
      - key: NODE_ENV
        value: production
`,
    "api-server/server.cjs":
      "const port = process.env.PORT || 3000; const key = process.env.MISSING_SECRET;",
  });
  try {
    const result = await scanDeploymentReadiness(repo.dir);
    const envIssue = result.issues.find(
      (i) =>
        i.pattern === "SB-DEP-002" && i.metadata.envVar === "MISSING_SECRET",
    );
    assert.ok(envIssue, "Should detect SB-DEP-002 for MISSING_SECRET");
    assert.ok(envIssue.description.includes("MISSING_SECRET"));
  } finally {
    repo.cleanup();
  }
});

test("scanDeploymentReadiness detects SB-DEP-004 CORS divergence", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({
      name: "test-repo",
      workspaces: ["api-server", "coming-soon"],
    }),
    "api-server/package.json": JSON.stringify({
      name: "api",
      scripts: { start: "node server.cjs" },
    }),
    "api-server/server.cjs":
      'const { isAllowedOrigin } = require("./lib/cors-config.cjs");',
    "api-server/lib/cors-config.cjs": "function resolveCorsOptions() {}",
    "coming-soon/package.json": JSON.stringify({
      name: "web",
      scripts: { start: "node server.cjs" },
    }),
    "coming-soon/server.cjs":
      'res.setHeader("Access-Control-Allow-Origin", "*");',
  });
  try {
    const result = await scanDeploymentReadiness(repo.dir);
    const corsIssue = result.issues.find((i) => i.pattern === "SB-DEP-004");
    assert.ok(corsIssue, "Should detect SB-DEP-004 CORS divergence");
    assert.ok(corsIssue.description.includes("shared-cors-config"));
    assert.ok(corsIssue.description.includes("inline-cors"));
  } finally {
    repo.cleanup();
  }
});

test("scanDeploymentReadiness returns correct result structure", async () => {
  const repo = await createTempRepo({
    "package.json": JSON.stringify({ name: "empty", workspaces: [] }),
  });
  try {
    const result = await scanDeploymentReadiness(repo.dir);
    assert.strictEqual(typeof result.scanned, "number");
    assert.strictEqual(typeof result.findings, "number");
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.patterns));
    assert.ok(result.patterns.includes("SB-DEP-001"));
  } finally {
    repo.cleanup();
  }
});
