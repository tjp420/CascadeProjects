#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Regenerate .simplebeacon/codemap.html with updated export and visibility features.
 * This patches the existing codemap.html with the new features from extension.ts changes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CODEMAP_JSON = path.join(process.cwd(), '.simplebeacon', 'codemap.json');
const CODEMAP_HTML = path.join(process.cwd(), '.simplebeacon', 'codemap.html');

if (!fs.existsSync(CODEMAP_JSON)) {
  console.error('[codemap] Error: .simplebeacon/codemap.json not found.');
  process.exit(1);
}
if (!fs.existsSync(CODEMAP_HTML)) {
  console.error('[codemap] Error: .simplebeacon/codemap.html not found.');
  process.exit(1);
}

const codemap = JSON.parse(fs.readFileSync(CODEMAP_JSON, 'utf8'));
let html = fs.readFileSync(CODEMAP_HTML, 'utf8');

// Determine which files are in the dependency graph
const graphNodeIds = new Set((codemap.dependencyGraph?.nodes || []).map(n => n.id));

// 1. Inject graph-dot CSS after the tree-node .node-meta rule
const cssInsertAfter = `.tree-node .node-meta{color:#64748b;font-size:10px;flex-shrink:0;max-width:90px;overflow:hidden;text-overflow:ellipsis}`;
const cssToAdd = `.graph-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;flex-shrink:0}.graph-dot.in-graph{background:#22c55e}.graph-dot.not-in-graph{background:#334155}`;
if (html.includes(cssInsertAfter) && !html.includes('.graph-dot.in-graph')) {
  html = html.replace(cssInsertAfter, cssInsertAfter + '\n' + cssToAdd);
  console.log('[codemap] Added graph-dot CSS.');
}

// 2. Inject treeData script tag after graphData
const graphDataScript = '<script type="application/json" id="graphData">';
const treeDataPayload = JSON.stringify(codemap.dependencyGraph || { nodes: [], edges: [] });
const treeDataScript = `<script type="application/json" id="treeData">${treeDataPayload}</script>`;
if (html.includes(graphDataScript) && !html.includes('id="treeData"')) {
  html = html.replace(graphDataScript, treeDataScript + '\n' + graphDataScript);
  console.log('[codemap] Added treeData script tag.');
}

// 3. Add TREE constant parsing after GRAPH
if (html.includes('const GRAPH = JSON.parse') && !html.includes('const TREE =')) {
  html = html.replace(
    'const GRAPH = JSON.parse(document.getElementById(\'graphData\').textContent);',
    'const GRAPH = JSON.parse(document.getElementById(\'graphData\').textContent);\nconst TREE = JSON.parse(document.getElementById(\'treeData\')?.textContent || \'{}\');'
  );
  console.log('[codemap] Added TREE constant.');
}

// 4. Update legend with JS/TS-only note
const legendEnd = '<div class="graph-legend-item"><div class="graph-legend-dot" style="background:#64748b"></div>Other</div>';
const legendNote = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #334155;font-size:10px;color:#94a3b8;line-height:1.4">
          <span style="color:#22c55e">&#9679;</span> In graph &nbsp; <span style="color:#64748b">&#9679;</span> Not in graph<br>
          Graph shows JS/TS modules only.
        </div>`;
if (html.includes(legendEnd) && !html.includes('Graph shows JS/TS modules only')) {
  html = html.replace(legendEnd, legendEnd + '\n        ' + legendNote);
  console.log('[codemap] Updated legend.');
}

// 5. Add PNG export button to graph controls
const exportGraphBtnOld = `<button id="toggleSidebarBtn" class="sidebar-toggle" title="Toggle Sidebar">☰</button><button id="exportGraphBtn" title="Export graph data">⤓</button>`;
const exportGraphBtnNew = `<button id="toggleSidebarBtn" class="sidebar-toggle" title="Toggle Sidebar">☰</button>
        <button id="exportGraphBtn" title="Export graph JSON">⤓</button>
        <button id="exportPngBtn" title="Export graph PNG">🖼</button>`;
if (html.includes(exportGraphBtnOld)) {
  html = html.replace(exportGraphBtnOld, exportGraphBtnNew);
  console.log('[codemap] Added PNG export button to controls.');
}

// 6. Add PNG export button to analysis section
const analysisExportsOld = `<button class="export-btn" id="exportJsonBtn">&#x1f4be; Export JSON</button>
      <button class="export-btn" id="exportCsvBtn">&#x1f4c8; Export CSV</button>`;
const analysisExportsNew = `<button class="export-btn" id="exportJsonBtn">&#x1f4be; Export JSON</button>
      <button class="export-btn" id="exportCsvBtn">&#x1f4c8; Export CSV</button>
      <button class="export-btn" id="exportPngBtn2">&#x1f5bc; Export PNG</button>`;
if (html.includes(analysisExportsOld)) {
  html = html.replace(analysisExportsOld, analysisExportsNew);
  console.log('[codemap] Added PNG export button to analysis section.');
}

// 7. Patch tree nodes to add graph dots
// Find all tree-node file divs and add data-path + data-in-graph + dot
// Tolerates re-runs: strips existing data-in-graph/data-path, reads clean path from data-path or title
const fileNodeRegex = /<div class="tree-node clickable (viewable|non-viewable)" data-type="file" data-viewable="([^"]*)"(?: data-in-graph="[^"]*")?(?: data-path="[^"]*")? style="padding-left:([^"]+)">\s*<span class="toggle-spacer"><\/span><span class="node-icon" style="color:([^"]+)">([^<]+)<\/span>\s*<span class="node-name" title="([^"]+)">([^<]+)<\/span>/g;

let match;
let patchedCount = 0;
html = html.replace(fileNodeRegex, (fullMatch, viewableCls, viewable, padding, color, icon, titlePath, name) => {
  // Use data-path if already present (clean path), otherwise strip suffix from title
  const cleanPath = titlePath.split(' — ')[0].trim();
  const filePath = cleanPath;
  const inGraph = graphNodeIds.has(filePath);
  const dotHtml = inGraph
    ? '<span class="graph-dot in-graph" title="In dependency graph"></span>'
    : `<span class="graph-dot not-in-graph" title="Not in dependency graph — file type not parsed for imports"></span>`;
  const newTitle = `${filePath} — ${inGraph ? 'In dependency graph' : 'Not in dependency graph'}`;
  const dataPath = ` data-path="${filePath}"`;
  const dataInGraph = ` data-in-graph="${inGraph}"`;

  patchedCount++;
  return `<div class="tree-node clickable ${viewableCls}" data-type="file" data-viewable="${viewable}"${dataPath}${dataInGraph} style="padding-left:${padding}">
        <span class="toggle-spacer"></span><span class="node-icon" style="color:${color}">${icon}</span>
        <span class="node-name" title="${newTitle}">${name}</span>
        ${dotHtml}`;
});
console.log(`[codemap] Patched ${patchedCount} tree-node files with graph dots.`);

// 8. Inject export handlers before "// Theme + layout selectors"
const themeSelectAnchor = '// Theme + layout selectors';
const exportHandlers = `
// Graph-toolbar export (full topology JSON)
document.getElementById('exportGraphBtn')?.addEventListener('click', () => {
  let analysis = {};
  try { analysis = JSON.parse(document.getElementById('analysisData')?.textContent || '{}'); } catch (e) {}
  const payload = {
    meta: { exportedAt: new Date().toISOString(), project: document.querySelector('.subtitle')?.textContent || 'project' },
    tree: TREE,
    graph: { nodes: GRAPH.nodes, edges: GRAPH.edges },
    cycles: CYCLES, entryPoints: ENTRIES, leafModules: LEAVES, mostConnected: CONNECTED,
    analysis: { summary: analysis.summary || {}, issues: analysis.issues || [], improvements: analysis.improvements || [], recommendations: analysis.recommendations || [] }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const proj = (document.querySelector('.subtitle')?.textContent || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  a.download = proj + '-codemap-full-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

// PNG export — canvas screenshot
function exportPng() {
  const canvas = document.getElementById('graphCanvas');
  if (!canvas) return;
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const proj = (document.querySelector('.subtitle')?.textContent || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = proj + '-codemap-graph-' + new Date().toISOString().slice(0, 10) + '.png';
    a.click();
  } catch (e) { console.error('PNG export failed', e); }
}
document.getElementById('exportPngBtn')?.addEventListener('click', exportPng);
document.getElementById('exportPngBtn2')?.addEventListener('click', exportPng);

`;

if (html.includes(themeSelectAnchor) && !html.includes('Graph-toolbar export (full topology JSON)')) {
  html = html.replace(themeSelectAnchor, exportHandlers + themeSelectAnchor);
  console.log('[codemap] Added export handlers.');
}

// 9. Update the existing exportJsonBtn handler to include tree data
if (html.includes("const payload = {\n      meta: {\n        exportedAt: new Date().toISOString(),") && !html.includes('tree: TREE,')) {
  html = html.replace(
    'graph: { nodes: allNodes.map(n => ({ id: n.id, label: n.label, group: n.group, x: n.x, y: n.y, radius: n.radius })), edges: allEdges.map(e => ({ source: e.source, target: e.target })) },',
    'tree: TREE,\n      graph: { nodes: allNodes.map(n => ({ id: n.id, label: n.label, group: n.group, x: n.x, y: n.y, radius: n.radius })), edges: allEdges.map(e => ({ source: e.source, target: e.target })) },'
  );
  console.log('[codemap] Updated exportJsonBtn to include tree.');
}

// 10. Update exportCsvBtn to include In Graph column
const csvHeaderOld = "let csv = 'File Path,Lines,Size (KB),Connections,In Cycle,Is Orphan,Missing Tests,Very Large,Needs Work Reason\\n';";
const csvHeaderNew = `// Flatten TREE to get inGraph status for every file
    const treeInGraph = {};
    function flattenTree(nodes) {
      for (const n of (nodes || [])) {
        if (n.type === 'file') treeInGraph[n.path] = n.inGraph || false;
        if (n.children) flattenTree(n.children);
      }
    }
    flattenTree(TREE);
    let csv = 'File Path,Lines,Size (KB),Connections,In Graph,In Cycle,Is Orphan,Missing Tests,Very Large,Needs Work Reason\\n';`;
if (html.includes(csvHeaderOld)) {
  html = html.replace(csvHeaderOld, csvHeaderNew);
  console.log('[codemap] Updated CSV header to include In Graph.');
}

// Also update the CSV row generation to include inGraph
const csvRowOld = `const connections = connCounts[fp] || 0;
      const cycle = inCycle.has(fp) ? 'Yes' : 'No';`;
const csvRowNew = `const connections = connCounts[fp] || 0;
      const inGraph = treeInGraph[fp] ? 'Yes' : 'No';
      const cycle = inCycle.has(fp) ? 'Yes' : 'No';`;
if (html.includes(csvRowOld)) {
  html = html.replace(csvRowOld, csvRowNew);
  console.log('[codemap] Updated CSV row generation.');
}

const csvLineOld = `csv += '"' + fp + '",' + lines + ',' + size + ',' + connections + ',' + cycle + ',' + orphan + ',' + missing + ',' + veryLarge + ',"' + reason + '"\\n';`;
const csvLineNew = `csv += '"' + fp + '",' + lines + ',' + size + ',' + connections + ',' + inGraph + ',' + cycle + ',' + orphan + ',' + missing + ',' + veryLarge + ',"' + reason + '"\\n';`;
if (html.includes(csvLineOld)) {
  html = html.replace(csvLineOld, csvLineNew);
  console.log('[codemap] Updated CSV line format.');
}

fs.writeFileSync(CODEMAP_HTML, html, 'utf8');
console.log('[codemap] .simplebeacon/codemap.html regenerated successfully.');
