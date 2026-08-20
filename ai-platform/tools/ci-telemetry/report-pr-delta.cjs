#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = process.env.GITHUB_REPOSITORY; // owner/repo
const [OWNER, REPO_NAME] = (REPO || "").split("/");
const TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER || process.argv[2];
const RUN_ID = process.env.GITHUB_RUN_ID;
const OUT_DIR = path.join(process.cwd(), "ai-platform", "test-results");
const REPORT_MARKER = "<!-- ci-telemetry-report -->";
const REGRESSION_PERCENT = Number(
  process.env.CI_TELEMETRY_REGRESSION_PERCENT || 10,
);
const REGRESSION_MS = Number(process.env.CI_TELEMETRY_REGRESSION_MS || 2000);
const TOP_N = Number(process.env.CI_TELEMETRY_TOP_N || 3);

if (!OWNER || !REPO_NAME || !TOKEN || !PR_NUMBER || !RUN_ID) {
  console.error(
    "Missing required env vars. Ensure GITHUB_REPOSITORY, GITHUB_TOKEN, PR_NUMBER, and GITHUB_RUN_ID are set.",
  );
  process.exit(2);
}

function ghApi(pathSuffix) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO_NAME}` + pathSuffix;
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
  const res = spawnSync(
    "curl",
    ["-sS", "-L", "-H", `Authorization: token ${TOKEN}`, url],
    { encoding: "buffer" },
  );
  if (res.status !== 0)
    throw new Error(`curl download failed: ${res.stderr.toString()}`);
  return res.stdout;
}

function unzipFileFromZipBuffer(zipBuffer, filename) {
  const tmp = path.join(process.cwd(), ".ci_telemetry_tmp.zip");
  fs.writeFileSync(tmp, zipBuffer);
  const res = spawnSync("unzip", ["-p", tmp, filename], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  fs.unlinkSync(tmp);
  if (res.status !== 0) return null;
  return res.stdout;
}

function upsertPrComment(prNumber, body) {
  const comments = ghApi(`/issues/${prNumber}/comments`);
  const existing = comments.find(
    (c) => c.body && c.body.includes(REPORT_MARKER),
  );
  if (existing) {
    // edit
    const patchUrl = `https://api.github.com/repos/${OWNER}/${REPO_NAME}/issues/comments/${existing.id}`;
    const res = spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "PATCH",
        "-H",
        `Authorization: token ${TOKEN}`,
        "-H",
        "Accept: application/vnd.github.v3+json",
        patchUrl,
        "-d",
        JSON.stringify({ body }),
      ],
      { encoding: "utf8" },
    );
    if (res.status !== 0)
      throw new Error(`Failed to edit comment: ${res.stderr}`);
    return JSON.parse(res.stdout);
  } else {
    const post = `https://api.github.com/repos/${OWNER}/${REPO_NAME}/issues/${prNumber}/comments`;
    const res = spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "POST",
        "-H",
        `Authorization: token ${TOKEN}`,
        "-H",
        "Accept: application/vnd.github.v3+json",
        post,
        "-d",
        JSON.stringify({ body }),
      ],
      { encoding: "utf8" },
    );
    if (res.status !== 0)
      throw new Error(`Failed to create comment: ${res.stderr}`);
    return JSON.parse(res.stdout);
  }
}

function safeNumber(v) {
  return typeof v === "number" ? v : v ? Number(v) : 0;
}

function computeBaseline(history, branch = "main", lookback = 7) {
  const filtered = history.filter((h) => h.branch === branch).slice(-lookback);
  if (!filtered.length) return null;
  const vals = filtered.map((h) =>
    safeNumber(h.summary && h.summary.runTimeMs),
  );
  const avg = vals.reduce((a, b) => a + (b || 0), 0) / vals.length;
  // per-file baseline map: filename -> avg
  const fileMap = {};
  for (const h of filtered) {
    if (!h.summary || !Array.isArray(h.summary.testFileSummaries)) continue;
    for (const tf of h.summary.testFileSummaries) {
      const name = tf.filePath ? path.basename(tf.filePath) : "unknown";
      fileMap[name] = fileMap[name] || [];
      fileMap[name].push(safeNumber(tf.runTimeMs));
    }
  }
  const fileAvg = {};
  for (const [k, v] of Object.entries(fileMap))
    fileAvg[k] = v.reduce((a, b) => a + (b || 0), 0) / v.length;
  return { avgRunMs: avg, fileAverages: fileAvg };
}

function formatPercent(deltaMs, baseMs) {
  if (!baseMs) return "N/A";
  const p = (deltaMs / baseMs) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

async function run() {
  // 1) download ci-test-metrics artifact for this run
  const artifacts = ghApi(`/actions/runs/${RUN_ID}/artifacts`);
  const artifact = (artifacts.artifacts || []).find(
    (a) => a.name === "ci-test-metrics",
  );
  if (!artifact) {
    console.log("No ci-test-metrics artifact found for this run. Exiting.");
    return;
  }
  const zipBuf = downloadArtifactZip(artifact.archive_download_url);
  const summaryContent = unzipFileFromZipBuffer(zipBuf, "ci-test-summary.json");
  if (!summaryContent) {
    console.log("ci-test-summary.json not found in artifact.");
    return;
  }
  const current = JSON.parse(summaryContent);

  // 2) download latest ci-telemetry-history from aggregate workflow
  // Find workflow id for workflow file 'ci-telemetry-aggregate.yml'
  const wfList = ghApi("/actions/workflows");
  const wf =
    wfList.workflows.find(
      (w) => w.path && w.path.endsWith("ci-telemetry-aggregate.yml"),
    ) ||
    wfList.workflows.find(
      (w) => w.name && w.name.includes("CI Telemetry Aggregation"),
    );
  let history = [];
  if (wf) {
    // find latest successful run
    const runs = ghApi(`/actions/workflows/${wf.id}/runs?per_page=20`);
    const run = (runs.workflow_runs || []).find(
      (r) => r.conclusion === "success",
    );
    if (run) {
      const arts = ghApi(`/actions/runs/${run.id}/artifacts`);
      const histArt = (arts.artifacts || []).find(
        (a) => a.name === "ci-telemetry-history",
      );
      if (histArt) {
        const zip = downloadArtifactZip(histArt.archive_download_url);
        const histContent = unzipFileFromZipBuffer(
          zip,
          "ci-telemetry-history.json",
        );
        if (histContent) history = JSON.parse(histContent);
      }
    }
  }

  // 3) compute baseline
  const baseline = computeBaseline(history, "main", 7);

  // 4) compute deltas
  const currentRunMs = safeNumber(current.runTimeMs || 0);
  let baselineMs = baseline ? baseline.avgRunMs : null;
  let deltaMs = baselineMs ? currentRunMs - baselineMs : null;
  let deltaPct =
    baselineMs && deltaMs !== null ? (deltaMs / baselineMs) * 100 : null;

  // top N slowest files current
  const files = Array.isArray(current.testFileSummaries)
    ? current.testFileSummaries.slice()
    : [];
  files.sort((a, b) => (b.runTimeMs || 0) - (a.runTimeMs || 0));
  const topFiles = files
    .slice(0, TOP_N)
    .map((f) => ({
      name: path.basename(f.filePath || ""),
      runMs: safeNumber(f.runTimeMs || 0),
    }));

  // for each top file compute baseline
  const fileRows = topFiles.map((f) => {
    const base =
      baseline && baseline.fileAverages && baseline.fileAverages[f.name]
        ? baseline.fileAverages[f.name]
        : null;
    const dms = base !== null ? f.runMs - base : null;
    const dpct = base !== null && base > 0 ? (dms / base) * 100 : null;
    return {
      name: f.name,
      runMs: f.runMs,
      baseMs: base,
      deltaMs: dms,
      deltaPct: dpct,
    };
  });

  // 5) build markdown
  const warning =
    deltaMs !== null &&
    (Math.abs(deltaPct) >= REGRESSION_PERCENT ||
      Math.abs(deltaMs) >= REGRESSION_MS);
  let md = `${REPORT_MARKER}\n**CI Telemetry — Test Runtime Delta**\n\n`;
  md += `- **Current run time**: **${currentRunMs} ms**\n`;
  if (baselineMs !== null) {
    md += `- **Baseline (main, avg last 7 runs)**: ${Math.round(baselineMs)} ms\n`;
    md += `- **Delta**: ${deltaMs >= 0 ? "+" : ""}${Math.round(deltaMs)} ms (${deltaPct !== null ? deltaPct.toFixed(1) : "N/A"}%) ${warning ? "⚠️ **REGRESSION**" : ""}\n`;
  } else {
    md += `- No baseline available (insufficient history).\n`;
  }
  md += `\n**Top ${TOP_N} slowest test files (current run)**\n\n`;
  md +=
    "| File | Current (ms) | Baseline (ms) | Delta |\n|---|---:|---:|---:|\n";
  for (const r of fileRows) {
    md += `| ${r.name} | ${Math.round(r.runMs)} | ${r.baseMs !== null ? Math.round(r.baseMs) : "N/A"} | ${r.deltaMs !== null ? (r.deltaMs >= 0 ? "+" : "") + Math.round(r.deltaMs) + " ms (" + (r.deltaPct !== null ? (r.deltaPct >= 0 ? "+" : "") + r.deltaPct.toFixed(1) + "%" : "N/A") + ")" : "N/A"} |\n`;
  }

  md +=
    "\n*This comment is auto-generated. It will be updated on subsequent runs.*\n";

  // 6) upsert comment
  upsertPrComment(PR_NUMBER, md);
  console.log("Posted telemetry report to PR", PR_NUMBER);
}

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
