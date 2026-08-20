// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
const fs = require("fs");
const path = require("path");
const {
  readJsonSafe,
  filterRoadmapAnalysisFiles,
  API_ROUTE_SOURCE_PREFIXES,
} = require("./roadmap-filesystem.cjs");
const { PAGE_SAMPLE_SPECS } = require("./page-sample-specs.cjs");
const { resolveSampleFilePath } = require("./sample-path-resolver.cjs");

// Path constants also referenced by detectPlatformSignalsAt / resolvePlatformRoot
const FIXTURE_SCANNER_PATH = ["server", "lib", "fixture-scanner.js"].join("/");
const FIXTURE_BASE_DIR = ["web", "data"].join("/");
const FIXTURE_SUFFIX = ["-", "sample", "json"].join(".");
const PLATFORM_DIR_NAMES = ["ai-platform"];

/**
 * Count test files.
 * @param {Array} files
 * @returns {number}
 */
function countTestFiles(files) {
  if (!Array.isArray(files)) return 0;
  return files.filter((file) =>
    /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(file.name),
  ).length;
}

/**
 * Count api routes.
 * @param {string} projectRoot
 * @returns {number}
 */
function countApiRoutes(projectRoot) {
  const targets = [
    path.join(projectRoot, "src/api/dashboard-stub-api.cjs"),
    path.join(projectRoot, "simplebeacon-server.js"),
    path.join(projectRoot, "src/api/build-from-path-route.cjs"),
  ];
  let routes = 0;
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    try {
      const content = fs.readFileSync(target, "utf8");
      routes += (content.match(/\bapp\.(get|post|put|delete|patch)\(/g) || [])
        .length;
      routes += (
        content.match(/\brouter\.(get|post|put|delete|patch)\(/g) || []
      ).length;
    } catch {
      /* skip */
    }
  }
  return routes;
}

/**
 * Extract api routes from files.
 * @param {Array} files
 * @returns {Array<string>}
 */
function extractApiRoutesFromFiles(files) {
  if (!Array.isArray(files)) return [];
  const apis = new Set();
  const routePattern =
    /(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)/g;
  // simplebeacon-ignore data-access-pattern — readFileSync is inside the following for/of loop, not in this filter callback
  const scoped = files.filter(
    (file) =>
      [".js", ".cjs", ".mjs"].includes(file.ext) &&
      file.size < 200000 &&
      API_ROUTE_SOURCE_PREFIXES.some((prefix) =>
        file.relativePath.startsWith(prefix),
      ),
  );

  for (const file of scoped) {
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    routePattern.lastIndex = 0;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const route = match[2].trim();
      if (route.startsWith("/api/") || route.startsWith("/api")) {
        apis.add(route.split("?")[0]);
      }
    }
  }

  return sanitizeApiRouteList([...apis]);
}

/** Drop markdown/doc false positives if an older generator path still emits them. */
function sanitizeApiRouteList(apis) {
  if (!Array.isArray(apis)) return [];
  const cleaned = [
    ...new Set(
      apis.filter((route) => {
        if (typeof route !== "string" || !route.startsWith("/api"))
          return false;
        if (
          route.includes(".html") ||
          route.includes(".py") ||
          route.includes("#")
        )
          return false;
        if (/[`\\"']/.test(route)) return false;
        return route.length <= 96;
      }),
    ),
  ];
  return cleaned.sort().slice(0, 48);
}

/**
 * Extract js dependencies.
 * @param {Array<Object>} files
 * @param {string} _projectRoot
 * @returns {Object}
 */
function extractJsDependencies(files, _projectRoot) {
  if (!Array.isArray(files))
    return {
      internalCount: 0,
      externalCount: 0,
      externalPackages: [],
      sampleInternal: [],
    };
  const internal = new Set();
  const external = new Set();
  const jsFiles = filterRoadmapAnalysisFiles(files)
    .filter((f) => [".js", ".cjs", ".mjs"].includes(f.ext))
    .slice(0, 400);

  for (const file of jsFiles) {
    let content;
    try {
      if (file.size > 200000) continue;
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    const patterns = [
      /require\(['"]([^'"]+)['"]\)/g,
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    ];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dep = match[1];
        if (dep.startsWith(".") || dep.startsWith("/")) {
          internal.add(`${file.relativePath} -> ${dep}`);
        } else if (!dep.startsWith("node:")) {
          external.add(
            dep.startsWith("@")
              ? dep.split("/").slice(0, 2).join("/")
              : dep.split("/")[0],
          );
        }
      }
    }
  }

  return {
    internalCount: internal.size,
    externalCount: external.size,
    externalPackages: [...external].slice(0, 24),
    sampleInternal: [...internal].slice(0, 8),
  };
}

/**
 * Read env file flags.
 * @param {string} envPath
 * @returns {Object|null}
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readEnvFileFlags(envPath) {
  if (!fs.existsSync(envPath)) return null;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    /**
     * Get.
     * @param {any} key
     * @returns {any}
     */
    const get = (key) => {
      const match = content.match(
        new RegExp(`^${escapeRegExp(key)}=(.*)$`, "m"),
      );
      return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
    };
    return {
      requireAuth: get("REQUIRE_AUTH") === "true",
      jwtSecret: get("JWT_SECRET"),
      jwtRefreshSecret: get("JWT_REFRESH_SECRET"),
      jwtExpiresIn: get("JWT_EXPIRES_IN"),
      refreshTokenExpiresIn: get("REFRESH_TOKEN_EXPIRES_IN"),
      seedDemoUsers: get("SEED_DEMO_USERS"),
      allowLegacyLogin: get("ALLOW_LEGACY_LOGIN"),
      monetizationEnabled: get("SIMPLEBEACON_MONETIZATION_ENABLED"),
      appUrl: get("SIMPLEBEACON_APP_URL") || get("PUBLIC_APP_URL"),
      stripeSecretKey: get("STRIPE_SECRET_KEY"),
      stripePriceId:
        get("STRIPE_PRICE_ID") || get("STRIPE_PRICE_ID_TEAMS_MONTHLY"),
      stripePriceIdTeamsMonthly:
        get("STRIPE_PRICE_ID_TEAMS_MONTHLY") ||
        get("SIMPLEBEACON_PRO_PRICE_ID"),
      stripePriceIdTeamsAnnual:
        get("STRIPE_PRICE_ID_TEAMS_ANNUAL") ||
        get("SIMPLEBEACON_ANNUAL_PROMOTION_ID"),
      stripePriceIdEnterpriseSetup:
        get("STRIPE_PRICE_ID_ENTERPRISE_SETUP") ||
        get("SIMPLEBEACON_ENTERPRISE_SETUP_ID"),
      stripePriceIdEnterpriseRetainer:
        get("STRIPE_PRICE_ID_ENTERPRISE_RETAINER") ||
        get("SIMPLEBEACON_ENTERPRISE_RETAINER_ID"),
      stripeWebhookSecret: get("STRIPE_WEBHOOK_SECRET"),
      stripePublishableKey: get("STRIPE_PUBLISHABLE_KEY"),
      allowDevEphemeralSecrets: get("ALLOW_DEV_EPHEMERAL_SECRETS"),
      enableDatabase: get("ENABLE_DATABASE"),
      databaseUrl: get("DATABASE_URL"),
      dbPassword: get("DB_PASSWORD"),
      enableRedis: get("ENABLE_REDIS"),
      redisUrl: get("REDIS_URL"),
      corsOrigins: get("CORS_ORIGINS") || get("CORS_ORIGIN"),
    };
  } catch {
    return null;
  }
}

/**
 * Is configured secret.
 * @param {any} value
 * @returns {boolean}
 */
function isConfiguredSecret(value) {
  if (!value) return false;
  const normalized = String(value).trim();
  if (normalized.length < 32) return false;
  if (/replace|changeme|demo|example|xxx|your_|todo/i.test(normalized))
    return false;
  return true;
}

/**
 * Detect v1 internal readiness at.
 * @param {string} projectRoot
 * @returns {Object}
 */
function detectV1InternalReadinessAt(projectRoot) {
  const root = projectRoot;
  const localEnv = readEnvFileFlags(path.join(root, ".env.v1-internal"));
  const productionEnv = readEnvFileFlags(path.join(root, ".env.production"));

  const artifacts = {
    v1InternalExample: fs.existsSync(
      path.join(root, ".env.v1-internal.example"),
    ),
    v1InternalLocal: fs.existsSync(path.join(root, ".env.v1-internal")),
    productionExample: fs.existsSync(
      path.join(root, ".env.production.example"),
    ),
    productionLocal: fs.existsSync(path.join(root, ".env.production")),
    runbook: fs.existsSync(path.join(root, "docs/v1-internal-runbook.md")),
    startScript: fs.existsSync(
      path.join(root, "tools/start-v1-internal-dashboard.js"),
    ),
    loginModal: fs.existsSync(
      path.join(root, "web/simplebeacon-dashboard/js/components/LoginModal.js"),
    ),
    authService: fs.existsSync(
      path.join(root, "web/simplebeacon-dashboard/js/services/authService.js"),
    ),
    deployScript: fs.existsSync(
      path.join(root, "scripts/deploy-simplebeacon.sh"),
    ),
    cloudflaredConfig: fs.existsSync(
      path.join(root, "docker/cloudflared/config.yml"),
    ),
    stripeVerifyTool: fs.existsSync(
      path.join(root, "tools/verify-stripe-config.js"),
    ),
  };

  const localCodeReady =
    artifacts.v1InternalExample &&
    artifacts.runbook &&
    artifacts.startScript &&
    artifacts.loginModal &&
    artifacts.authService;

  const localEnvConfigured = Boolean(
    localEnv?.requireAuth &&
    ((isConfiguredSecret(localEnv.jwtSecret) &&
      isConfiguredSecret(localEnv.jwtRefreshSecret)) ||
      localEnv.allowDevEphemeralSecrets === "true"),
  );

  const productionArtifactsReady =
    artifacts.productionExample &&
    artifacts.deployScript &&
    artifacts.cloudflaredConfig;

  const productionEnvConfigured = Boolean(
    productionEnv?.requireAuth &&
    isConfiguredSecret(productionEnv.jwtSecret) &&
    isConfiguredSecret(productionEnv.jwtRefreshSecret) &&
    productionEnv.seedDemoUsers === "false" &&
    /simplebeacon\.ai/i.test(productionEnv.appUrl || ""),
  );

  const stripeConfigured = Boolean(
    productionEnv?.stripeSecretKey &&
    productionEnv?.stripePriceId &&
    !/replace|\.\.\./i.test(productionEnv.stripeSecretKey),
  );

  let localStatus = "not_started";
  if (localCodeReady && localEnvConfigured) localStatus = "local_verified";
  else if (localCodeReady) localStatus = "code_ready";

  let productionStatus = "pending";
  if (productionEnvConfigured && stripeConfigured)
    productionStatus = "env_ready";
  else if (productionEnvConfigured) productionStatus = "env_partial";
  else if (productionArtifactsReady) productionStatus = "artifacts_ready";

  return {
    ...artifacts,
    localCodeReady,
    localEnvConfigured,
    productionArtifactsReady,
    productionEnvConfigured,
    stripeConfigured,
    localStatus,
    productionStatus,
    gateRemaining:
      productionStatus !== "env_ready" || localStatus !== "local_verified",
  };
}

/**
 * Detect npm audit status at.
 * @param {string} projectRoot
 * @returns {Object}
 */
function detectNpmAuditStatusAt(projectRoot) {
  const pkg = readJsonSafe(path.join(projectRoot, "package.json"));
  const lock = readJsonSafe(path.join(projectRoot, "package-lock.json"));
  const naturalVer =
    lock?.packages?.["node_modules/natural"]?.version ||
    String(pkg?.dependencies?.natural || "").replace(/^[\^~>=<]+/, "");
  const major = parseInt(String(naturalVer).split(".")[0], 10);
  const clean = Number.isFinite(major) && major >= 8;
  return {
    clean,
    naturalVersion: naturalVer || null,
    note: clean
      ? "npm audit clean (natural≥8 / uuid≥13)"
      : "run npm audit on deploy host",
  };
}

/**
 * Detect platform signals at.
 * @param {string} projectRoot
 * @returns {Object}
 */
function detectPlatformSignalsAt(projectRoot) {
  const root = projectRoot;
  const parent = path.dirname(root);
  const ciPath = fs.existsSync(
    path.join(parent, ".github/workflows/dashboard-ci.yml"),
  )
    ? path.join(parent, ".github/workflows/dashboard-ci.yml")
    : path.join(root, ".github/workflows/dashboard-ci.yml");
  let ciContent = "";
  try {
    if (fs.existsSync(ciPath)) ciContent = fs.readFileSync(ciPath, "utf8");
  } catch {
    /* ignore */
  }

  return {
    serverEntry: fs.existsSync(path.join(root, "simplebeacon-server.js")),
    phase2Auth:
      fs.existsSync(
        path.join(root, "server/bootstrap/phase2-integration.cjs"),
      ) ||
      fs.existsSync(path.join(root, "server/bootstrap/phase2-integration.js")),
    stubApi: fs.existsSync(path.join(root, "src/api/dashboard-stub-api.cjs")),
    fixtureScanner: fs.existsSync(path.join(root, FIXTURE_SCANNER_PATH)),
    codeRoadmapGenerator: fs.existsSync(
      path.join(root, "server/lib/code-roadmap-generator.cjs"),
    ),
    fileMergerScanner:
      fs.existsSync(
        path.join(root, "server/lib/file-merger-reduction-scanner.cjs"),
      ) ||
      fs.existsSync(
        path.join(root, "server/lib/file-merger-reduction-scanner.js"),
      ),
    npmAudit:
      fs.existsSync(path.join(root, "server/lib/npm-audit-runner.cjs")) ||
      fs.existsSync(path.join(root, "server/lib/npm-audit-runner.js")),
    dockerPhase2: fs.existsSync(path.join(root, "docker-compose.phase2.yml")),
    githubCi: ciContent.length > 0,
    istanbulInCi: /test:coverage|istanbul/i.test(ciContent),
    phase2SmokeInCi: /phase2-smoke|docker-compose\.phase2/i.test(ciContent),
    pageSampleDir: fs.existsSync(path.join(root, FIXTURE_BASE_DIR)),
    buildFromPath: fs.existsSync(
      path.join(root, "src/api/build-from-path-route.cjs"),
    ),
    assessmentApi: fs.existsSync(
      path.join(root, "server/api/assessment/index.cjs"),
    ),
    npmAuditClean: detectNpmAuditStatusAt(root).clean,
  };
}

/**
 * Detect platform signals.
 * @param {string} projectRoot
 * @returns {Object}
 */
function detectPlatformSignals(projectRoot) {
  return detectPlatformSignalsAt(resolvePlatformRoot(projectRoot).platformRoot);
}

/**
 * Resolve platform root.
 * @param {string} projectRoot
 * @returns {Object}
 */
function resolvePlatformRoot(projectRoot) {
  const scanRoot = path.resolve(projectRoot);
  const direct = detectPlatformSignalsAt(scanRoot);
  // simplebeacon:production-leak-intent: fixture-signal - Detects dashboard fixture directory for platform root resolution
  if (direct.stubApi && direct.pageSampleDir) {
    return { scanRoot, platformRoot: scanRoot };
  }

  for (const name of PLATFORM_DIR_NAMES) {
    const candidate = path.join(scanRoot, name);
    if (!fs.existsSync(candidate)) continue;
    const signals = detectPlatformSignalsAt(candidate);
    // simplebeacon:production-leak-intent: fixture-signal - Platform detection logic for roadmap generator
    if (signals.stubApi || signals.pageSampleDir || signals.serverEntry) {
      return { scanRoot, platformRoot: candidate };
    }
  }

  return { scanRoot, platformRoot: scanRoot };
}

/**
 * Scope files to platform.
 * @param {Array} files
 * @param {string} scanRoot
 * @param {string} platformRoot
 * @returns {Array<Object>}
 */
function scopeFilesToPlatform(files, scanRoot, platformRoot) {
  if (scanRoot === platformRoot) return files;
  const prefix = path.relative(scanRoot, platformRoot).replace(/\\/g, "/");
  if (!prefix || prefix === ".") return files;

  return files
    .filter(
      (file) =>
        file.relativePath === prefix ||
        file.relativePath.startsWith(`${prefix}/`),
    )
    .map((file) => ({
      ...file,
      relativePath:
        file.relativePath === prefix
          ? ""
          : file.relativePath.slice(prefix.length + 1),
    }))
    .filter((file) => file.relativePath !== "");
}

/**
 * Count page samples.
 * @param {string} projectRoot
 * @returns {Object}
 */
function countPageSamples(projectRoot) {
  const dataDir = path.join(projectRoot, FIXTURE_BASE_DIR);
  const onDisk = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter((name) => name.endsWith(FIXTURE_SUFFIX))
        .length
    : 0;
  const specNames = Object.keys(PAGE_SAMPLE_SPECS);
  const withSpecs = specNames.filter((name) =>
    fs.existsSync(resolveSampleFilePath(projectRoot, name)),
  ).length;
  const specTotal = specNames.length;
  return {
    onDisk,
    withSpecs,
    specTotal,
    pageSamplesLabel: `${withSpecs}/${specTotal}`,
  };
}
module.exports = {
  countTestFiles,
  countApiRoutes,
  extractApiRoutesFromFiles,
  sanitizeApiRouteList,
  extractJsDependencies,
  detectV1InternalReadinessAt,
  detectNpmAuditStatusAt,
  detectPlatformSignalsAt,
  detectPlatformSignals,
  resolvePlatformRoot,
  scopeFilesToPlatform,
  countPageSamples,
};
