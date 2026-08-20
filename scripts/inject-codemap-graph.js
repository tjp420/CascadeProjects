#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Regenerate .simplebeacon/codemap.html data from .simplebeacon/codemap.json
 */

"use strict";

const fs = require("fs");
const path = require("path");

const CODEMAP_JSON = path.join(process.cwd(), ".simplebeacon", "codemap.json");
const HTML_VS = path.join(
  process.cwd(),
  "simplebeacon-vscode-merged",
  "simplebeacon-codemap.html",
);
const HTML_ROOT = path.join(process.cwd(), ".simplebeacon", "codemap.html");

if (!fs.existsSync(CODEMAP_JSON)) {
  console.error(
    "[codemap] Error: .simplebeacon/codemap.json not found. Run scan first.",
  );
  process.exit(1);
}
if (!fs.existsSync(HTML_VS) && !fs.existsSync(HTML_ROOT)) {
  console.error("[codemap] Error: codemap.html not found.");
  process.exit(1);
}

const codemap = JSON.parse(fs.readFileSync(CODEMAP_JSON, "utf8"));
const graph = codemap.dependencyGraph || { nodes: [], edges: [] };

// Compute leaves: nodes with no outgoing edges
const sourceSet = new Set(graph.edges.map((e) => e.source));
const leaves = graph.nodes
  .filter((n) => !sourceSet.has(n.id))
  .map((n) => n.label || n.id);

// Build data payloads
const graphData = JSON.stringify({ nodes: graph.nodes, edges: graph.edges });
const cyclesData = JSON.stringify(codemap.cycles || []);
const entriesData = JSON.stringify(codemap.entryPoints || []);
const leavesData = JSON.stringify(leaves);
const connectedData = JSON.stringify(codemap.mostConnected || []);

function injectInto(htmlPath) {
  let html = fs.readFileSync(htmlPath, "utf8");
  function inject(id, payload) {
    const re = new RegExp(
      `<script type="application/json" id="${id}">[\\s\\S]*?</script>`,
    );
    const replacement = `<script type="application/json" id="${id}">${payload}</script>`;
    if (!re.test(html)) {
      console.error(
        `[codemap] Error: <script id="${id}"> not found in ${htmlPath}.`,
      );
      return false;
    }
    html = html.replace(re, replacement);
    return true;
  }

  let ok = true;
  ok = inject("graphData", graphData) && ok;
  ok = inject("cyclesData", cyclesData) && ok;
  ok = inject("entriesData", entriesData) && ok;
  ok = inject("leavesData", leavesData) && ok;
  ok = inject("connectedData", connectedData) && ok;

  if (!ok) {
    console.error("[codemap] Injection failed. " + htmlPath + " not modified.");
    return false;
  }

  fs.writeFileSync(htmlPath, html, "utf8");
  return true;
}

const targets = [];
if (fs.existsSync(HTML_VS)) targets.push(HTML_VS);
if (fs.existsSync(HTML_ROOT)) targets.push(HTML_ROOT);

for (const target of targets) {
  if (injectInto(target)) {
    process.stdout.write(
      "[codemap] Data injected into " +
        target +
        ":\n" +
        "  - " +
        graph.nodes.length +
        " nodes, " +
        graph.edges.length +
        " edges\n" +
        "  - " +
        (codemap.cycles || []).length +
        " cycles\n" +
        "  - " +
        (codemap.entryPoints || []).length +
        " entry points\n" +
        "  - " +
        leaves.length +
        " leaves\n" +
        "  - " +
        (codemap.mostConnected || []).length +
        " most connected\n",
    );
  }
}
