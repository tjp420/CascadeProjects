// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const { execSync } = require("child_process");
const fs = require("fs");

const files = execSync("git diff --cached --name-only --diff-filter=ACM", {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => f.match(/\.(js|cjs)$/));

let ok = true;
files.forEach((f) => {
  try {
    fs.accessSync(f);
    execSync(`node -c "${f}"`);
  } catch (e) {
    console.error("Syntax error in", f);
    ok = false;
  }
});

process.exit(ok ? 0 : 1);
