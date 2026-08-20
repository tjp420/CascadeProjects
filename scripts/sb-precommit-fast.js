#!/usr/bin/env node
const { spawnSync } = require("child_process");
const fs = require("fs");

// Lightweight staged-only scanner: prefer gitleaks, fallback to regex.
const SKIP_GLOBS = [
  "docs/**",
  "**/*.md",
  "node_modules/**",
  "dist/**",
  "build/**",
  "**/*.png",
  "**/*.jpg",
];

function run(cmd, args) {
  try {
    return spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    return { error: e };
  }
}

function globToRegex(glob) {
  let g = glob.replace(/\*\*/g, "<<DS>>");
  g = g.replace(/([.+^=!:${}()|\\[\\]\/\\\\])/g, "\\$1");
  g = g.replace(/\*/g, "[^/]*");
  g = g.replace(/<<DS>>/g, ".*");
  g = g.replace(/\?/g, ".");
  return new RegExp("^" + g + "$", "i");
}

const SKIP_REGEXES = SKIP_GLOBS.map(globToRegex);

function isSkipped(file) {
  return SKIP_REGEXES.some((r) => r.test(file));
}

function listStagedFiles() {
  const r = run("git", ["diff", "--cached", "--name-only"]);
  if (r.error) return [];
  return r.stdout ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function hasCmd(cmd) {
  const r = run(cmd, ["--version"]);
  return !r.error && r.status === 0;
}

const REGEX_PATTERNS = [
  { id: "AWS_ACCESS_KEY_ID", re: /AKIA[0-9A-Z]{16}/g },
  { id: "GCP_API_KEY", re: /AIza[0-9A-Za-z\-_]{35}/g },
  { id: "SLACK_TOKEN", re: /xox[baprs]-[0-9a-zA-Z-]+/g },
  { id: "GITHUB_TOKEN", re: /ghp_[A-Za-z0-9_]{36,}/g },
  { id: "PRIVATE_KEY", re: /-----BEGIN (RSA |)?PRIVATE KEY-----/g },
];

function regexScanFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return [];
    const buf = fs.readFileSync(filePath, { encoding: "utf8" });
    const findings = [];
    for (const p of REGEX_PATTERNS) {
      const m = buf.match(p.re);
      if (m && m.length)
        findings.push({
          id: p.id,
          matches: Array.from(new Set(m)).slice(0, 3),
        });
    }
    return findings;
  } catch (e) {
    return [];
  }
}

function runGitleaks(files) {
  const attempts = [];
  if (hasCmd("gitleaks"))
    attempts.push({ cmd: "gitleaks", args: ["detect", "--source"] });
  attempts.push({ cmd: "npx", args: ["gitleaks", "detect", "--source"] });

  for (const at of attempts) {
    let out = "";
    let failed = false;
    for (const f of files) {
      const r = run(at.cmd, at.args.concat([f, "--redact"]));
      if (r.error && r.error.code === "ENOENT") {
        failed = true;
        break;
      }
      out += (r.stdout || "") + (r.stderr || "");
      if (r.status && r.status !== 0) return { found: true, output: out };
    }
    if (!failed) return { found: false, output: out };
  }
  return { found: false, output: "" };
}

function main() {
  const staged = listStagedFiles().filter((f) => !isSkipped(f));
  if (staged.length === 0) {
    console.log("ℹ️ No staged files to scan.");
    process.exit(0);
  }
  console.log(`ℹ️ Scanning ${staged.length} staged file(s) for secrets...`);

  const g = runGitleaks(staged);
  if (g.found) {
    console.error("\n💥 gitleaks found secrets in staged files:\n", g.output);
    process.exit(1);
  }

  const findings = [];
  for (const f of staged) {
    const r = regexScanFile(f);
    if (r.length) findings.push({ file: f, issues: r });
  }
  if (findings.length) {
    console.error("\n💥 SECRET FINDINGS (regex fallback):");
    for (const it of findings) {
      console.error(`- ${it.file}`);
      for (const issue of it.issues)
        console.error(`  - ${issue.id}: ${issue.matches.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("✅ No findings in staged files. Fast pre-commit gate passed.");
  process.exit(0);
}

main();
