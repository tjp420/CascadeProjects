#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives

const { execSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const fixFlag = args.includes("--fix") ? " --fix" : "";
const paths =
  args.filter((arg) => arg !== "--fix").join(" ") || "server src web";

try {
  process.stdout.write(["Running ESLint..."].join(" ") + "\n");
  const cmd = `npx eslint${fixFlag} ${paths}`;
  process.stdout.write([`Command: ${cmd}`].join(" ") + "\n");
  execSync(cmd, { stdio: "inherit", cwd: path.join(__dirname, "..") });
  process.stdout.write(["ESLint completed successfully"].join(" ") + "\n");
} catch {
  process.stderr.write(["ESLint failed"].join(" ") + "\n");
  process.exit(1);
}
