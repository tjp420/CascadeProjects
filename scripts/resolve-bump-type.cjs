#!/usr/bin/env node
"use strict";

/**
 * Resolve semver bump type from PR labels and commit messages.
 *
 * Priority:
 *   1. PR labels (release:patch, release:minor, release:major) — explicit team control
 *   2. Commit message conventions (breaking: → major, feat: → minor, fix: → patch)
 *   3. No match → no release
 *
 * Also resolves release scope:
 *   - release:cli-only     → only CLI package
 *   - release:vscode-only  → only VS Code extension
 *   - (default)            → both packages
 *
 * Usage:
 *   node scripts/resolve-bump-type.cjs --labels "release:minor,release:cli-only" --commits "feat: add x\nfix: fix y"
 *   node scripts/resolve-bump-type.cjs --labels "[]" --commits "feat: new thing"
 *
 * Outputs JSON to stdout:
 *   { "shouldRelease": true, "bumpType": "minor", "scope": "cli" }
 *   { "shouldRelease": false, "bumpType": null, "scope": "both" }
 *
 * Exit codes:
 *   0 — resolution successful (check JSON for shouldRelease)
 *   1 — invalid arguments
 */

/**
 * Parse the --labels argument into an array of label names.
 * Accepts JSON array string or comma-separated string.
 * @param {string} raw - Raw labels argument
 * @returns {string[]} Array of lowercase label names
 */
function parseLabels(raw) {
  if (!raw || raw === "[]" || raw === '""') return [];

  // Try JSON parse first (from GitHub Actions toJSON)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((l) => String(l).toLowerCase().trim());
    }
  } catch {
    // Not JSON — treat as comma-separated
  }

  return raw
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Parse the --commits argument into an array of commit subjects.
 * Accepts newline-separated or literal \n string.
 * @param {string} raw - Raw commits argument
 * @returns {string[]} Array of commit subject lines
 */
function parseCommits(raw) {
  if (!raw) return [];

  // Handle literal \n in the string
  const lines = raw.replace(/\\n/g, "\n").split("\n");
  return lines.map((l) => l.trim()).filter(Boolean);
}

/**
 * Determine bump type from PR labels.
 * @param {string[]} labels - Lowercase label names
 * @returns {string|null} 'patch', 'minor', 'major', or null
 */
function bumpFromLabels(labels) {
  if (labels.includes("release:patch")) return "patch";
  if (labels.includes("release:minor")) return "minor";
  if (labels.includes("release:major")) return "major";
  return null;
}

/**
 * Determine bump type from commit message conventions.
 * @param {string[]} commits - Commit subject lines
 * @returns {string|null} 'major', 'minor', 'patch', or null
 */
function bumpFromCommits(commits) {
  if (commits.length === 0) return null;

  const hasBreaking = commits.some(
    (msg) =>
      /^(breaking|break|major):/i.test(msg) ||
      /\bBREAKING[ -]CHANGE\b/i.test(msg) ||
      /!.:/i.test(msg),
  );
  if (hasBreaking) return "major";

  const hasFeature = commits.some(
    (msg) => /^(feat|feature|add)[:(]/i.test(msg) || /^feat\b/i.test(msg),
  );
  if (hasFeature) return "minor";

  const hasFix = commits.some(
    (msg) =>
      /^(fix|bugfix|hotfix|resolve|patch)[:(]/i.test(msg) ||
      /^fix\b/i.test(msg),
  );
  if (hasFix) return "patch";

  return null;
}

/**
 * Determine release scope from PR labels.
 * @param {string[]} labels - Lowercase label names
 * @returns {string} 'both', 'cli', or 'vscode'
 */
function scopeFromLabels(labels) {
  if (labels.includes("release:cli-only")) return "cli";
  if (labels.includes("release:vscode-only")) return "vscode";
  return "both";
}

/**
 * Resolve bump type using hybrid priority: labels first, then commits.
 * @param {string[]} labels - Lowercase label names
 * @param {string[]} commits - Commit subject lines
 * @returns {{ shouldRelease: boolean, bumpType: string|null, scope: string, source: string }}
 */
function resolveBump(labels, commits) {
  const scope = scopeFromLabels(labels);

  // Step 1: Check PR labels (highest priority)
  const labelBump = bumpFromLabels(labels);
  if (labelBump) {
    return { shouldRelease: true, bumpType: labelBump, scope, source: "label" };
  }

  // Step 2: Fall back to commit message conventions
  const commitBump = bumpFromCommits(commits);
  if (commitBump) {
    return {
      shouldRelease: true,
      bumpType: commitBump,
      scope,
      source: "commit",
    };
  }

  // Step 3: No release trigger
  return { shouldRelease: false, bumpType: null, scope, source: "none" };
}

/**
 * Bump a semver version string.
 * @param {string} current - Current version (e.g. "1.2.3")
 * @param {string} bumpType - 'patch', 'minor', or 'major'
 * @returns {string} New version
 */
function bumpVersion(current, bumpType) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid semver: ${current}`);
  }
  let [major, minor, patch] = parts;
  if (bumpType === "major") {
    major++;
    minor = 0;
    patch = 0;
  } else if (bumpType === "minor") {
    minor++;
    patch = 0;
  } else {
    patch++;
  }
  return `${major}.${minor}.${patch}`;
}

// ── CLI entry point ──
function main() {
  const args = process.argv.slice(2);

  function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  }

  const labelsRaw = getArg("--labels") || "[]";
  const commitsRaw = getArg("--commits") || "";
  const dryRun = args.includes("--dry-run");

  const labels = parseLabels(labelsRaw);
  const commits = parseCommits(commitsRaw);
  const result = resolveBump(labels, commits);

  if (dryRun) {
    console.error(`[dry-run] Labels: ${JSON.stringify(labels)}`);
    console.error(`[dry-run] Commits: ${JSON.stringify(commits)}`);
    console.error(`[dry-run] Result: ${JSON.stringify(result)}`);
  }

  // Output JSON to stdout for GitHub Actions
  console.log(JSON.stringify(result));
}

module.exports = {
  parseLabels,
  parseCommits,
  bumpFromLabels,
  bumpFromCommits,
  scopeFromLabels,
  resolveBump,
  bumpVersion,
};

if (require.main === module) {
  main();
}
