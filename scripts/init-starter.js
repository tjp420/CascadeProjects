#!/usr/bin/env node
// scripts/init-starter.js
// Convenience helper to scaffold SimpleBeacon starter files in a repository.
// It calls into the local simplebeacon-cli developer-onboarding module
// to write MCP configs, Cursor rules, and a GitHub Actions scan workflow.

const path = require("path");
const projectRoot = process.cwd();

try {
  // Require the onboarding helper from the local packages folder
  const onboarding = require(
    path.join(
      projectRoot,
      "packages",
      "simplebeacon-cli",
      "src",
      "lib",
      "developer-onboarding.js",
    ),
  );

  console.log("[*] Running SimpleBeacon init --starter");
  const opts = {
    withMcp: true,
    withVscode: true,
    withCi: true,
    force: false,
    mode: "npx-local",
  };
  const result = onboarding.installDeveloperStack(projectRoot, opts);

  console.log("[+] Install result:", result);
  console.log("\nNext steps:");
  console.log(
    "  - Open your editor (VS Code / Cursor) and confirm MCP server is configured.",
  );
  console.log(
    "  - Commit the generated files (if any) and open a PR to let the pipeline run the first gate.",
  );
} catch (err) {
  console.error(
    "[!] Failed to run init-starter:",
    err && err.message ? err.message : err,
  );
  process.exit(1);
}
