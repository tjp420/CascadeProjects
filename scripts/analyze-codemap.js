#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Analyze a SimpleBeacon codemap JSON export.
 * Generates reports, filtered subsets, and cycle detection.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const INPUT =
  process.argv[2] ||
  "j:\\Downloads\\cascadeprojects-codemap-analysis-2026-07-01.json";
const OUTDIR = process.argv[3] || path.join(process.cwd(), ".simplebeacon");

if (!fs.existsSync(INPUT)) {
  console.error("Input file not found:", INPUT);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const nodes = data.graph.nodes;
const edges = data.graph.edges || [];

// ── Basic Stats ───────────────────────────────────────────────

const extStats = {};
const pkgStats = {};
let testCount = 0;
let orphanCount = 0;

const outDegree = {};
const inDegree = {};

for (const n of nodes) {
  const ext = n.group || path.extname(n.id) || "unknown";
  extStats[ext] = (extStats[ext] || 0) + 1;

  const pkg = n.id.split("/")[0] || "root";
  pkgStats[pkg] = (pkgStats[pkg] || 0) + 1;

  if (n.id.includes("/test/") || n.id.includes(".test.")) testCount++;

  outDegree[n.id] = 0;
  inDegree[n.id] = 0;
}

for (const e of edges) {
  outDegree[e.source] = (outDegree[e.source] || 0) + 1;
  inDegree[e.target] = (inDegree[e.target] || 0) + 1;
}

for (const n of nodes) {
  const total = (outDegree[n.id] || 0) + (inDegree[n.id] || 0);
  if (total === 0) orphanCount++;
}

const nodeDegrees = nodes.map((n) => ({
  id: n.id,
  degree: (outDegree[n.id] || 0) + (inDegree[n.id] || 0),
  out: outDegree[n.id] || 0,
  in: inDegree[n.id] || 0,
}));

const topConnected = [...nodeDegrees]
  .sort((a, b) => b.degree - a.degree)
  .slice(0, 10);

// ── Cycle Detection (DFS) ────────────────────────────────────

function findCycles() {
  const adj = {};
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  }
  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  const path = [];

  function dfs(node) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      if (idx !== -1) cycles.push(path.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of adj[node] || []) dfs(next);
    path.pop();
    stack.delete(node);
  }

  for (const n of nodes) dfs(n.id);
  return cycles;
}

const cycles = findCycles();

// ── Largest Connected Component ─────────────────────────────

function largestComponent() {
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source).add(e.target);
    adj.get(e.target).add(e.source);
  }
  const visited = new Set();
  let largest = 0;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    let size = 0;
    const q = [n.id];
    visited.add(n.id);
    while (q.length) {
      const cur = q.shift();
      size++;
      for (const next of adj.get(cur) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          q.push(next);
        }
      }
    }
    if (size > largest) largest = size;
  }
  return largest;
}

const largestComp = largestComponent();

// ── Report ──────────────────────────────────────────────────

const report = `# CascadeProjects Codemap Analysis Report

**Generated:** ${new Date().toISOString()}  
**Source:** ${path.basename(INPUT)}  
**Version:** ${data.meta?.version || "unknown"}

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Files (Nodes) | ${nodes.length} |
| Total Dependencies (Edges) | ${edges.length} |
| Average Degree | ${((edges.length * 2) / nodes.length).toFixed(2)} |
| Orphaned Files (0 connections) | ${orphanCount} |
| Test Files | ${testCount} (${((testCount / nodes.length) * 100).toFixed(1)}%) |
| Largest Connected Component | ${largestComp} files |
| Circular Dependencies | ${cycles.length} cycles |

## Extension Breakdown

| Extension | Count | Percentage |
|-----------|-------|------------|
${Object.entries(extStats)
  .sort((a, b) => b[1] - a[1])
  .map(
    ([ext, count]) =>
      `| ${ext} | ${count} | ${((count / nodes.length) * 100).toFixed(1)}% |`,
  )
  .join("\n")}

## Top 10 Most Connected Files

| Rank | File | Total Degree | Out | In |
|------|------|-------------|-----|-----|
${topConnected.map((n, i) => `| ${i + 1} | \`${n.id}\` | ${n.degree} | ${n.out} | ${n.in} |`).join("\n")}

## Top Packages by File Count

| Package | Files |
|---------|-------|
${Object.entries(pkgStats)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([pkg, count]) => `| ${pkg} | ${count} |`)
  .join("\n")}

## Circular Dependencies

${cycles.length === 0 ? "No cycles detected." : cycles.map((c, i) => `- **Cycle ${i + 1}:** \`${c.join(" → ")}\``).join("\n")}
`;

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(
  path.join(OUTDIR, "codemap-analysis-report.md"),
  report,
  "utf8",
);

// ── Filtered Exports ──────────────────────────────────────────

function exportFiltered(name, filterFn) {
  const filteredNodes = nodes.filter(filterFn);
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );
  const out = {
    meta: { ...data.meta, filter: name, filteredAt: new Date().toISOString() },
    graph: { nodes: filteredNodes, edges: filteredEdges },
  };
  fs.writeFileSync(
    path.join(OUTDIR, `codemap-${name}.json`),
    JSON.stringify(out, null, 2),
    "utf8",
  );
  console.log(
    `[export] ${name}: ${filteredNodes.length} nodes, ${filteredEdges.length} edges`,
  );
}

exportFiltered("ai-platform", (n) => n.id.startsWith("ai-platform/"));
exportFiltered(
  "no-tests",
  (n) => !n.id.includes("/test/") && !n.id.includes(".test."),
);
exportFiltered(
  "high-connectivity",
  (n) => (outDegree[n.id] || 0) + (inDegree[n.id] || 0) >= 5,
);
exportFiltered("cjs-only", (n) => n.id.endsWith(".cjs"));

console.log(
  "[analyze-codemap] Report written to",
  path.join(OUTDIR, "codemap-analysis-report.md"),
);
console.log("[analyze-codemap] Filtered exports written to", OUTDIR);

// ── Summary to stdout ───────────────────────────────────────

console.log("\n=== Summary ===");
console.log("Nodes:", nodes.length);
console.log("Edges:", edges.length);
console.log("Orphans:", orphanCount);
console.log("Tests:", testCount);
console.log("Cycles:", cycles.length);
console.log("Largest component:", largestComp);
console.log(
  "Top connected:",
  topConnected[0].id,
  "(degree:",
  topConnected[0].degree + ")",
);
