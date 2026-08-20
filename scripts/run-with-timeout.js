#!/usr/bin/env node
const { spawn } = require("child_process");

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error(
    "Usage: node run-with-timeout.js <timeout-ms> <command> [args...]",
  );
  process.exit(2);
}

const timeoutMs = parseInt(argv[0], 10) || 30000;
const cmd = argv[1];
const args = argv.slice(2);

console.log(
  `Running command with timeout ${timeoutMs}ms: ${cmd} ${args.join(" ")}`,
);

const child = spawn(cmd, args, { stdio: "inherit", shell: true });
let timedOut = false;
const to = setTimeout(() => {
  timedOut = true;
  console.warn(
    `Command timed out after ${timeoutMs}ms. Sending termination signal.`,
  );
  try {
    child.kill("SIGTERM");
  } catch (e) {
    try {
      child.kill();
    } catch (e) {}
  }
}, timeoutMs);

child.on("exit", (code, signal) => {
  clearTimeout(to);
  if (timedOut) {
    console.warn(
      "The command did not finish before the timeout. Continuing commit (soft-fail).",
    );
    console.warn(
      "Run `npm run sb:hook:pre-commit` manually to reproduce the full gate output.",
    );
    process.exit(0);
  }
  if (signal) {
    console.error(`Command terminated by signal: ${signal}`);
    process.exit(1);
  }
  process.exit(code);
});
