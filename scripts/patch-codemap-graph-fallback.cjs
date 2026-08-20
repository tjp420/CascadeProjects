// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
"use strict";
const fs = require("fs");
const path = require("path");

const LOADER = `function buildGraphFromTree(items, parentPath) {
  const nodes = [], edges = [];
  const seenN = new Set(), seenE = new Set();
  function addNode(id, label, group, size) {
    if (!id || seenN.has(id)) return;
    seenN.add(id);
    nodes.push({ id, label, group, size: size || 1 });
  }
  function addEdge(source, target) {
    const k = source + '->' + target;
    if (source && target && source !== target && !seenE.has(k)) { seenE.add(k); edges.push({ source, target }); }
  }
  function walk(list, parent) {
    for (const item of list || []) {
      if (item.type === 'dir') {
        addNode(item.path, item.name, 'dir', 0);
        if (parent) addEdge(parent, item.path);
        walk(item.children, item.path);
      } else if (item.type === 'file') {
        if (/\\.(bak\\d?|back\\d+|working)$/i.test(item.name)) continue;
        addNode(item.path, item.name, item.ext || '.other', item.lines || 1);
        if (parent) addEdge(parent, item.path);
      }
    }
  }
  walk(items, parentPath || null);
  return { nodes, edges, mode: 'folder' };
}
function loadGraphPayload() {
  const raw = JSON.parse(document.getElementById('graphData').textContent);
  if (raw.nodes && raw.nodes.length) return { ...raw, mode: 'imports' };
  const tree = JSON.parse(document.getElementById('treeData').textContent);
  return buildGraphFromTree(tree, '');
}
const TREE = JSON.parse(document.getElementById('treeData').textContent);
const GRAPH = loadGraphPayload();
const GRAPH_MODE = GRAPH.mode || 'imports';
delete GRAPH.mode;`;

const OLD = `const GRAPH = JSON.parse(document.getElementById('graphData').textContent);
const TREE = JSON.parse(document.getElementById('treeData').textContent);`;

const OLD_EARLY_RETURN = "if (!canvas || GRAPH.nodes.length === 0) return;";
const NEW_EARLY_RETURN = `if (!canvas) return;
  const wrap = canvas.parentElement;
  if (GRAPH.nodes.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'empty-state';
    msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#94a3b8;font-size:13px;line-height:1.5';
    msg.textContent = 'No files to map — run a scan on a folder with source files.';
    wrap.appendChild(msg);
    return;
  }
  if (GRAPH_MODE === 'folder') {
    const hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;top:48px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);border:1px solid #334155;border-radius:8px;padding:8px 14px;font-size:11px;color:#94a3b8;z-index:12;pointer-events:none';
    hint.textContent = 'Folder layout graph (no JS/TS imports detected)';
    wrap.appendChild(hint);
  }`;

const targets = process.argv.slice(2);
for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.warn("skip missing", file);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes('id="graphData"')) {
    console.warn("skip (no graphData)", file);
    continue;
  }
  if (html.includes("loadGraphPayload")) {
    console.log("already patched", file);
    continue;
  }
  if (!html.includes(OLD)) {
    console.warn("skip (unexpected script layout)", file);
    continue;
  }
  html = html.replace(OLD, LOADER);
  if (html.includes(OLD_EARLY_RETURN)) {
    html = html.replace(OLD_EARLY_RETURN, NEW_EARLY_RETURN);
    // Remove duplicate wrap assignment if present after patch
    html = html.replace(
      /\n  const wrap = canvas\.parentElement;\n  const detailsPanel/g,
      "\n  const detailsPanel",
    );
  }
  html = html.replace(
    "Graph shows JS/TS modules only.",
    "JS/TS: import graph. Other stacks: folder tree.",
  );
  fs.writeFileSync(file, html, "utf8");
  console.log("patched", file);
}
