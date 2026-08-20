#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives

/**
 * v1-Internal Profile Verification Script
 *
 * This script verifies that the v1-internal environment is properly configured
 * and ready for production-grade deployment.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: path.join(process.cwd(), ".env.v1-internal"),
});

const REQUIRED_VARS = [
  "PORT",
  "REQUIRE_AUTH",
  "SIMPLEBEACON_INTERNAL_DASHBOARD",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
];

const OPTIONAL_VARS = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "CORS_ORIGIN",
  "STRIPE_SECRET_KEY",
  "ANALYZE_ALLOWED_ROOTS",
];

const PHASE2_VARS = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
];

function checkEnvironmentVariable(name, required = true) {
  const value = process.env[name];

  if (!value) {
    if (required) {
      process.stderr.write(
        [`❌ REQUIRED: ${name} is not set`].join(" ") + "\n",
      );
      return false;
    } else {
      process.stderr.write(
        [`⚠️  OPTIONAL: ${name} is not set`].join(" ") + "\n",
      );
      return true;
    }
  }

  // Check for placeholder values
  if (
    value.includes("your-") ||
    value.includes("change-in-production") ||
    value.includes("replace-with")
  ) {
    if (required) {
      process.stderr.write(
        [`❌ REQUIRED: ${name} contains placeholder value: "${value}"`].join(
          " ",
        ) + "\n",
      );
      return false;
    } else {
      process.stderr.write(
        [`⚠️  OPTIONAL: ${name} contains placeholder value: "${value}"`].join(
          " ",
        ) + "\n",
      );
      return true;
    }
  }

  // Check JWT secrets length
  if (name.includes("JWT_SECRET") && value.length < 32) {
    process.stderr.write(
      [
        `❌ REQUIRED: ${name} must be at least 32 characters (current: ${value.length})`,
      ].join(" ") + "\n",
    );
    return false;
  }

  process.stdout.write([`✅ ${name} is configured`].join(" ") + "\n");
  return true;
}

function checkFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      process.stdout.write(
        [`✅ ${description} exists: ${filePath}`].join(" ") + "\n",
      );
      return true;
    } else {
      process.stderr.write(
        [`❌ ${description} missing: ${filePath}`].join(" ") + "\n",
      );
      return false;
    }
  } catch (error) {
    process.stderr.write(
      [`❌ Error checking ${description}: ${error.message}`].join(" ") + "\n",
    );
    return false;
  }
}

function checkDockerCompose() {
  const dockerComposePath = path.join(
    process.cwd(),
    "docker-compose.phase2.yml",
  );

  if (!fs.existsSync(dockerComposePath)) {
    process.stderr.write(
      [`⚠️  Phase 2 Docker Compose file not found: ${dockerComposePath}`].join(
        " ",
      ) + "\n",
    );
    process.stderr.write(
      ['    Run "npm run phase2:infra" to create Phase 2 infrastructure'].join(
        " ",
      ) + "\n",
    );
    return false;
  }

  process.stdout.write(
    [`✅ Phase 2 Docker Compose file exists: ${dockerComposePath}`].join(" ") +
      "\n",
  );
  return true;
}

function checkAuthConfiguration() {
  const requireAuth = process.env.REQUIRE_AUTH;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (requireAuth === "true") {
    if (!jwtSecret || jwtSecret.length < 32) {
      process.stderr.write(
        ["❌ REQUIRE_AUTH=true requires JWT_SECRET (32+ characters)"].join(
          " ",
        ) + "\n",
      );
      return false;
    }

    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      process.stderr.write(
        [
          "❌ REQUIRE_AUTH=true requires JWT_REFRESH_SECRET (32+ characters)",
        ].join(" ") + "\n",
      );
      return false;
    }

    process.stdout.write(
      ["✅ Authentication configuration is valid"].join(" ") + "\n",
    );
    return true;
  }

  process.stdout.write(
    ["ℹ️  Authentication is not required (REQUIRE_AUTH != true)"].join(" ") +
      "\n",
  );
  return true;
}

function checkPhase2Readiness() {
  const phase2Vars = PHASE2_VARS.filter((varName) => process.env[varName]);

  if (phase2Vars.length === 0) {
    process.stderr.write(
      [
        "⚠️  No Phase 2 variables configured - Phase 2 features will be disabled",
      ].join(" ") + "\n",
    );
    return false;
  }

  const allPhase2VarsSet = PHASE2_VARS.every((varName) => process.env[varName]);

  if (allPhase2VarsSet) {
    process.stdout.write(
      ["✅ All Phase 2 variables configured"].join(" ") + "\n",
    );
    return true;
  } else {
    process.stderr.write(
      [
        "⚠️  Some Phase 2 variables missing - Phase 2 features may be limited",
      ].join(" ") + "\n",
    );
    return false;
  }
}

function main() {
  process.stdout.write(
    ["🔍 Verifying v1-Internal Profile Configuration\n"].join(" ") + "\n",
  );

  let allChecksPassed = true;

  // Check required environment variables
  process.stdout.write(
    ["📋 Checking required environment variables:"].join(" ") + "\n",
  );
  for (const varName of REQUIRED_VARS) {
    if (!checkEnvironmentVariable(varName, true)) {
      allChecksPassed = false;
    }
  }

  process.stdout.write(
    ["\n📋 Checking optional environment variables:"].join(" ") + "\n",
  );
  for (const varName of OPTIONAL_VARS) {
    checkEnvironmentVariable(varName, false);
  }

  process.stdout.write(["\n📁 Checking required files:"].join(" ") + "\n");
  if (!checkFileExists(".env.v1-internal", "v1-internal environment file")) {
    allChecksPassed = false;
  }

  if (!checkFileExists("server/index.cjs", "Server entry point")) {
    allChecksPassed = false;
  }

  if (!checkFileExists("docs/v1-internal-runbook.md", "v1-internal runbook")) {
    allChecksPassed = false;
  }

  process.stdout.write(
    ["\n🔧 Checking authentication configuration:"].join(" ") + "\n",
  );
  if (!checkAuthConfiguration()) {
    allChecksPassed = false;
  }

  process.stdout.write(
    ["\n🐳 Checking Phase 2 infrastructure:"].join(" ") + "\n",
  );
  checkDockerCompose();
  checkPhase2Readiness();

  process.stdout.write(["\n📊 Summary:"].join(" ") + "\n");
  if (allChecksPassed) {
    process.stdout.write(
      ["✅ All critical checks passed - v1-internal profile is ready!"].join(
        " ",
      ) + "\n",
    );
    process.stdout.write(["\n🚀 Next steps:"].join(" ") + "\n");
    process.stdout.write(
      ["   1. Start Phase 2 infrastructure: npm run phase2:infra"].join(" ") +
        "\n",
    );
    process.stdout.write(
      ["   2. Start the platform: npm run dashboard:v1-internal"].join(" ") +
        "\n",
    );
    process.stdout.write(
      ["   3. Run smoke tests: npm run smoke:test"].join(" ") + "\n",
    );
    process.exit(0);
  } else {
    process.stderr.write(
      ["❌ Some checks failed - please fix the issues above"].join(" ") + "\n",
    );
    process.stdout.write(["\n📚 Documentation:"].join(" ") + "\n");
    process.stdout.write(
      ["   - Read: docs/v1-internal-runbook.md"].join(" ") + "\n",
    );
    process.stdout.write(
      ["   - Reference: .env.v1-internal.example"].join(" ") + "\n",
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentVariable,
  checkAuthConfiguration,
  checkPhase2Readiness,
};
