#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration via env / args
const OWNER = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[0]
  : process.argv[2];
const REPO = process.env.GITHUB_REPOSITORY
  ? process.env.GITHUB_REPOSITORY.split("/")[1]
  : process.argv[3];
const TOKEN = process.env.GITHUB_TOKEN || process.argv[4];
const OUT_DIR =
  process.argv[5] || path.join(process.cwd(), "ai-platform", "test-results");
const RETENTION_DAYS = Number(
  process.env.CI_TELEMETRY_RETENTION_DAYS || process.argv[6] || 30,
);
const BRANCH_FILTER =
  process.env.CI_TELEMETRY_BRANCHES || process.argv[7] || "all"; // comma-separated or 'all'
const MAX_RUNS = Number(
  process.env.CI_TELEMETRY_MAX_RUNS || process.argv[8] || 0,
); // 0 => no max

if (!OWNER || !REPO || !TOKEN) {
  console.error(
    "Usage: aggregate-artifacts.cjs <owner> <repo> <token> [outDir] [retentionDays] [branches] [maxRuns]",
  );
  console.error("Or set GITHUB_REPOSITORY and GITHUB_TOKEN env vars.");
  process.exit(2);
}

const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

function ghApi(pathSuffix) {
  const url = API_BASE + pathSuffix;
  const res = spawnSync(
    "curl",
    [
      "-sS",
      "-H",
      `Authorization: token ${TOKEN}`,
      "-H",
      "Accept: application/vnd.github.v3+json",
      url,
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) throw new Error(`curl failed: ${res.stderr}`);
  return JSON.parse(res.stdout);
}

function downloadArtifactZip(url) {
  // returns Buffer of zip
  const tmp = spawnSync(
    "curl",
    ["-sS", "-L", "-H", `Authorization: token ${TOKEN}`, url],
    { encoding: "buffer" },
  );
  if (tmp.status !== 0)
    throw new Error(`curl download failed: ${tmp.stderr.toString()}`);
  return tmp.stdout;
}

function unzipFileFromZipBuffer(zipBuffer, filename) {
  // Use 'unzip -p -' by writing buffer to temp file and using unzip -p
  const tmpPath = path.join(process.cwd(), ".ci_telemetry_tmp.zip");
  fs.writeFileSync(tmpPath, zipBuffer);
  const res = spawnSync("unzip", ["-p", tmpPath, filename], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  fs.unlinkSync(tmpPath);
  if (res.status !== 0) return null;
  return res.stdout;
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  ensureOutDir();
  console.log(
    `Aggregating artifacts for ${OWNER}/${REPO} (branches=${BRANCH_FILTER}, retentionDays=${RETENTION_DAYS}, maxRuns=${MAX_RUNS})`,
  );

  // list workflow runs (we'll page 1..5 max for now)
  let runs = [];
  for (let page = 1; page <= 5; page++) {
    const data = ghApi(`/actions/runs?per_page=100&page=${page}`);
    if (!data || !data.workflow_runs) break;
    runs = runs.concat(data.workflow_runs);
    if (data.workflow_runs.length === 0) break;
  }

  const now = new Date();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  // filter by branch
  let branches = [];
  if (BRANCH_FILTER !== "all")
    branches = BRANCH_FILTER.split(",").map((s) => s.trim());

  runs = runs.filter((r) => {
    if (branches.length && !branches.includes(r.head_branch)) return false;
    const created = new Date(r.created_at);
    if (now - created > retentionMs) return false;
    return true;
  });

  // sort by created_at ascending
  runs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (MAX_RUNS > 0 && runs.length > MAX_RUNS) runs = runs.slice(-MAX_RUNS);

  console.log(`Found ${runs.length} runs to inspect`);

  const historyFile = path.join(OUT_DIR, "ci-telemetry-history.json");
  let history = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, "utf8"));
    } catch (e) {
      history = [];
    }
  }

  const existingRunIds = new Set(history.map((h) => h.run_id));

  for (const r of runs) {
    if (existingRunIds.has(r.id)) continue;
    try {
      const artifacts = ghApi(`/actions/runs/${r.id}/artifacts`);
      if (!artifacts || !artifacts.artifacts) continue;
      const target = artifacts.artifacts.find(
        (a) => a.name === "ci-test-metrics",
      );
      if (!target) continue;
      console.log(
        `Downloading artifact for run ${r.id} (${r.head_branch} #${r.run_number})`,
      );
      const zipBuf = downloadArtifactZip(target.archive_download_url);
      // extract ci-test-summary.json
      const content = unzipFileFromZipBuffer(zipBuf, "ci-test-summary.json");
      if (!content) {
        console.warn(
          "ci-test-summary.json not found in artifact for run",
          r.id,
        );
        continue;
      }
      const parsed = JSON.parse(content);
      const entry = {
        run_id: r.id,
        run_number: r.run_number,
        head_sha: r.head_sha,
        html_url: r.html_url,
        branch: r.head_branch,
        created_at: r.created_at,
        summary: parsed,
      };
      history.push(entry);
      existingRunIds.add(r.id);
    } catch (e) {
      console.warn("Failed to extract artifact for run", r.id, e.message || e);
    }
  }

  // prune by retention days or max runs
  // first prune older than retention
  history = history.filter((h) => now - new Date(h.created_at) <= retentionMs);
  // then enforce max runs if set
  if (MAX_RUNS > 0 && history.length > MAX_RUNS) {
    history = history.slice(-MAX_RUNS);
  }

  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log("Wrote history ->", historyFile);

  // also write a compact CSV for quick consumption
  const csvFile = path.join(OUT_DIR, "ci-telemetry-history.csv");
  const rows = [
    "run_id,run_number,branch,created_at,totalTests,totalPassed,totalFailed,runTimeMs",
  ];
  for (const h of history) {
    const s = h.summary || {};
    rows.push(
      [
        h.run_id,
        h.run_number,
        h.branch,
        h.created_at,
        s.totalTests || 0,
        s.totalPassed || 0,
        s.totalFailed || 0,
        s.runTimeMs || 0,
      ].join(","),
    );
  }
  fs.writeFileSync(csvFile, rows.join("\n"));
  console.log("Wrote CSV ->", csvFile);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
