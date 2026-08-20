#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Mirror packages/simplebeacon-cli → .github-sync/simplebeacon (tjp420/simplebeacon).
 * Operator-only; not published to npm.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "packages", "simplebeacon-cli");
const DEST = path.join(ROOT, ".github-sync", "simplebeacon");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".simplebeacon",
  "coverage",
  "dist",
]);

const SKIP_FILES = new Set([
  "PUBLISH.md",
  "publish.ps1",
  "npm", // stray empty artifact — never mirror
]);

/** npm-only exclusions — still mirrored to the public GitHub repo */
const SKIP_REL_PREFIXES = [
  "docs/OUTREACH.md",
  "docs/examples/outreach-tracker.md",
];

function shouldSkip(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (SKIP_FILES.has(norm)) return true;
  for (const p of SKIP_REL_PREFIXES) {
    if (norm === p || norm.startsWith(p)) return true;
  }
  if (/simplebeacon-.*\.tgz$/i.test(norm)) return true;
  if (/\.jsonl$/i.test(norm)) return true;
  return false;
}

function* walk(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const rel = base ? `${base}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(abs, rel);
    } else if (!shouldSkip(rel)) {
      yield { rel, abs };
    }
  }
}

function* files() {
  yield* walk(SRC);
}

function copyFile(rel, abs) {
  const out = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(abs, out);
}

function pruneOrphans() {
  const srcSet = new Set();
  for (const { rel } of files()) srcSet.add(rel.replace(/\\/g, "/"));

  function walkDest(dir, base = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".git") continue;
      const rel = base ? `${base}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walkDest(abs, rel);
      } else {
        const norm = rel.replace(/\\/g, "/");
        if (!srcSet.has(norm) && !norm.startsWith(".git/")) {
          fs.unlinkSync(abs);
        }
      }
    }
  }

  walkDest(DEST);

  function removeEmptyDirs(dir) {
    if (!fs.existsSync(dir) || dir === path.join(DEST, ".git")) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) removeEmptyDirs(path.join(dir, ent.name));
    }
    if (dir !== DEST && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
  removeEmptyDirs(DEST);
}

function patchPublicReadme() {
  const readme = path.join(DEST, "README.md");
  if (!fs.existsSync(readme)) return;
  let text = fs.readFileSync(readme, "utf8");
  text = text.replace(
    /\[packages\/simplebeacon-intelligence\/README\.md\]\(\.\.\/simplebeacon-intelligence\/README\.md\)/,
    "[Structural intent (monorepo package)](https://github.com/tjp420/CascadeProjects/tree/main/ai-platform/packages/simplebeacon-intelligence)",
  );
  fs.writeFileSync(readme, text);
}

function main() {
  if (!fs.existsSync(SRC)) {
    process.stderr.write(["Source not found:", SRC].join(" ") + "\n");
    process.exit(1);
  }
  if (!fs.existsSync(DEST)) {
    process.stderr.write(
      [
        "Destination not found (clone tjp420/simplebeacon into .github-sync/simplebeacon):",
        DEST,
      ].join(" ") + "\n",
    );
    process.exit(1);
  }

  let copied = 0;
  for (const { rel, abs } of files()) {
    copyFile(rel, abs);
    copied += 1;
  }
  pruneOrphans();
  patchPublicReadme();
  process.stdout.write([`Synced ${copied} files → ${DEST}`].join(" ") + "\n");
}

main();
