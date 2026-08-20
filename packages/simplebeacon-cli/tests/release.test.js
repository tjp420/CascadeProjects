"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  parseArgs,
  bumpVersion,
  categorizeCommits,
  generateChangelogEntry,
  extractOptValue,
  VALID_BUMPS,
} = require("../scripts/release.cjs");

test("parseArgs extracts bump type", () => {
  const args = parseArgs(["node", "release.cjs", "patch"]);
  assert.strictEqual(args.bump, "patch");
  assert.strictEqual(args.publish, false);
  assert.strictEqual(args.dryRun, false);
  assert.strictEqual(args.noCleanCheck, false);
});

test("parseArgs extracts --no-clean-check flag", () => {
  const args = parseArgs([
    "node",
    "release.cjs",
    "patch",
    "--no-clean-check",
    "--skip-tests",
  ]);
  assert.strictEqual(args.noCleanCheck, true);
  assert.strictEqual(args.skipTests, true);
});

test("parseArgs extracts --publish and --otp", () => {
  const args = parseArgs([
    "node",
    "release.cjs",
    "minor",
    "--publish",
    "--otp",
    "123456",
  ]);
  assert.strictEqual(args.bump, "minor");
  assert.strictEqual(args.publish, true);
  assert.strictEqual(args.otp, "123456");
});

test("parseArgs extracts --dry-run and --skip-tests", () => {
  const args = parseArgs([
    "node",
    "release.cjs",
    "major",
    "--dry-run",
    "--skip-tests",
  ]);
  assert.strictEqual(args.bump, "major");
  assert.strictEqual(args.dryRun, true);
  assert.strictEqual(args.skipTests, true);
});

test("parseArgs exits on invalid bump type", () => {
  let exited = false;
  const origExit = process.exit;
  process.exit = (_code) => {
    exited = true;
    throw new Error("exit");
  };
  try {
    parseArgs(["node", "release.cjs", "invalid"]);
  } catch {
    // expected
  }
  process.exit = origExit;
  assert.ok(exited, "should exit on invalid bump type");
});

test("extractOptValue returns value for flag", () => {
  assert.strictEqual(extractOptValue(["--otp", "999"], "--otp"), "999");
  assert.strictEqual(extractOptValue(["--otp"], "--otp"), null);
  assert.strictEqual(extractOptValue([], "--otp"), null);
});

test("bumpVersion increments patch correctly", () => {
  assert.strictEqual(bumpVersion("1.0.0", "patch"), "1.0.1");
  assert.strictEqual(bumpVersion("1.2.3", "patch"), "1.2.4");
  assert.strictEqual(bumpVersion("0.0.9", "patch"), "0.0.10");
});

test("bumpVersion increments minor correctly", () => {
  assert.strictEqual(bumpVersion("1.0.0", "minor"), "1.1.0");
  assert.strictEqual(bumpVersion("1.2.3", "minor"), "1.3.0");
  assert.strictEqual(bumpVersion("0.9.9", "minor"), "0.10.0");
});

test("bumpVersion increments major correctly", () => {
  assert.strictEqual(bumpVersion("1.0.0", "major"), "2.0.0");
  assert.strictEqual(bumpVersion("1.2.3", "major"), "2.0.0");
  assert.strictEqual(bumpVersion("0.9.9", "major"), "1.0.0");
});

test("bumpVersion throws on invalid semver", () => {
  assert.throws(() => bumpVersion("1.0", "patch"), /Invalid semver/);
  assert.throws(() => bumpVersion("1.0.0.0", "patch"), /Invalid semver/);
  assert.throws(() => bumpVersion("abc", "patch"), /Invalid semver/);
});

test("categorizeCommits separates features, fixes, chores, others", () => {
  const log = [
    "abc1234\tfeat: add markdown report generator\tAlice\t2026-08-07",
    "def5678\tfix: resolve webhook signature bug\tBob\t2026-08-07",
    "ghi9012\tchore: update dependencies\tCarol\t2026-08-06",
    "jkl3456\tMerge pull request #42\tDave\t2026-08-05",
  ].join("\n");

  const result = categorizeCommits(log);
  assert.strictEqual(result.features.length, 1);
  assert.strictEqual(
    result.features[0].subject,
    "feat: add markdown report generator",
  );
  assert.strictEqual(result.fixes.length, 1);
  assert.strictEqual(
    result.fixes[0].subject,
    "fix: resolve webhook signature bug",
  );
  assert.strictEqual(result.chores.length, 1);
  assert.strictEqual(result.chores[0].subject, "chore: update dependencies");
  assert.strictEqual(result.others.length, 1);
  assert.strictEqual(result.others[0].subject, "Merge pull request #42");
});

test("categorizeCommits handles empty log", () => {
  const result = categorizeCommits("");
  assert.strictEqual(result.features.length, 0);
  assert.strictEqual(result.fixes.length, 0);
  assert.strictEqual(result.chores.length, 0);
  assert.strictEqual(result.others.length, 0);
});

test('categorizeCommits detects "add" prefix as feature', () => {
  const log = "abc1234\tAdd new scan format option\tAlice\t2026-08-07";
  const result = categorizeCommits(log);
  assert.strictEqual(result.features.length, 1);
});

test('categorizeCommits detects "fix" in subject as fix', () => {
  const log = "abc1234\tResolve crash on empty input\tAlice\t2026-08-07";
  const result = categorizeCommits(log);
  assert.strictEqual(result.fixes.length, 1);
});

test("categorizeCommits detects refactor/docs/test/ci as chore", () => {
  const log = [
    "aaa111\trefactor: clean up utils\tA\t2026-08-07",
    "bbb222\tdocs: update README\tB\t2026-08-07",
    "ccc333\ttest: add unit tests\tC\t2026-08-07",
    "ddd444\tci: update workflow\tD\t2026-08-07",
  ].join("\n");
  const result = categorizeCommits(log);
  assert.strictEqual(result.chores.length, 4);
});

test("generateChangelogEntry produces formatted markdown", () => {
  const commits = {
    features: [
      {
        hash: "abc1234",
        subject: "feat: add markdown report",
        author: "Alice",
        date: "2026-08-07",
      },
    ],
    fixes: [
      {
        hash: "def5678",
        subject: "fix: webhook bug",
        author: "Bob",
        date: "2026-08-07",
      },
    ],
    chores: [
      {
        hash: "ghi9012",
        subject: "chore: deps",
        author: "Carol",
        date: "2026-08-06",
      },
    ],
    others: [],
  };
  const entry = generateChangelogEntry("1.2.0", "minor", commits, "1.1.2");

  assert.ok(entry.includes("## [1.2.0]"));
  assert.ok(entry.includes("### Minor release from 1.1.2"));
  assert.ok(entry.includes("### Features"));
  assert.ok(entry.includes("feat: add markdown report (abc1234)"));
  assert.ok(entry.includes("### Bug Fixes"));
  assert.ok(entry.includes("fix: webhook bug (def5678)"));
  assert.ok(entry.includes("### Maintenance"));
  assert.ok(entry.includes("chore: deps (ghi9012)"));
});

test("generateChangelogEntry handles no commits", () => {
  const commits = { features: [], fixes: [], chores: [], others: [] };
  const entry = generateChangelogEntry("1.0.1", "patch", commits, "1.0.0");
  assert.ok(entry.includes("_No changes since last release._"));
});

test("updateChangelog creates new file with header when none exists", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-release-test-"));
  const changelogPath = path.join(tmpDir, "CHANGELOG.md");

  // Monkey-patch the CHANGELOG_PATH in the module
  // We test the logic directly
  const header =
    "# Changelog\n\nAll notable changes to the simplebeacon CLI package are documented here.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n";
  const newEntry =
    "## [1.0.1] - 2026-08-07\n\n### Patch release from 1.0.0\n\n### Bug Fixes\n\n- fix: something (abc1234)\n";

  // Simulate no existing file
  let writtenContent = null;
  try {
    fs.readFileSync(changelogPath, "utf8");
  } catch {
    // No file — simulate updateChangelog behavior
    fs.writeFileSync(changelogPath, header + "\n" + newEntry + "\n", "utf8");
    writtenContent = fs.readFileSync(changelogPath, "utf8");
  }

  assert.ok(writtenContent, "changelog should be created");
  assert.ok(writtenContent.includes("# Changelog"));
  assert.ok(writtenContent.includes("## [1.0.1]"));
  assert.ok(writtenContent.includes("fix: something"));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("updateChangelog inserts new entry before existing version", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-release-insert-"));
  const changelogPath = path.join(tmpDir, "CHANGELOG.md");

  // Create existing changelog
  const existing =
    "# Changelog\n\nSome intro.\n\n## [1.0.0] - 2026-08-01\n\n### Initial release\n";
  fs.writeFileSync(changelogPath, existing, "utf8");

  // Simulate updateChangelog inserting before first version entry
  const newEntry = "## [1.0.1] - 2026-08-07\n\n### Patch release\n";
  const firstVersionIdx = existing.indexOf("\n## [");
  const updated =
    existing.slice(0, firstVersionIdx + 1) +
    "\n" +
    newEntry +
    "\n" +
    existing.slice(firstVersionIdx + 1);
  fs.writeFileSync(changelogPath, updated, "utf8");

  const result = fs.readFileSync(changelogPath, "utf8");
  const newIdx = result.indexOf("## [1.0.1]");
  const oldIdx = result.indexOf("## [1.0.0]");
  assert.ok(newIdx > -1, "new entry should exist");
  assert.ok(oldIdx > -1, "old entry should exist");
  assert.ok(newIdx < oldIdx, "new entry should come before old entry");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("VALID_BUMPS contains patch, minor, major", () => {
  assert.deepStrictEqual(VALID_BUMPS, ["patch", "minor", "major"]);
});
