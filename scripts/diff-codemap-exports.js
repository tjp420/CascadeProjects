#!/usr/bin/env node
/**
 * Diff two SimpleBeacon codemap exports.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const V1 = 'j:\\Downloads\\cascadeprojects-codemap-analysis-2026-07-01(1).json';
const V2 = 'j:\\Downloads\\cascadeprojects-codemap-analysis-2026-07-01(2).json';
const OUTDIR = path.join(process.cwd(), '.simplebeacon');

const v1 = JSON.parse(fs.readFileSync(V1, 'utf8'));
const v2 = JSON.parse(fs.readFileSync(V2, 'utf8'));

const v1Nodes = new Set(v1.graph.nodes.map((n) => n.id));
const v2Nodes = new Set(v2.graph.nodes.map((n) => n.id));
const v1Edges = new Set(v1.graph.edges.map((e) => `${e.source}|${e.target}`));
const v2Edges = new Set(v2.graph.edges.map((e) => `${e.source}|${e.target}`));

const addedNodes = [...v2Nodes].filter((id) => !v1Nodes.has(id));
const removedNodes = [...v1Nodes].filter((id) => !v2Nodes.has(id));
const addedEdges = [...v2Edges].filter((e) => !v1Edges.has(e));
const removedEdges = [...v1Edges].filter((e) => !v2Edges.has(e));

const diff = `# Codemap Export Diff Report

**v1 Exported:** ${v1.meta.exportedAt}  
**v2 Exported:** ${v2.meta.exportedAt}  

## Node Changes

| Metric | v1 | v2 | Change |
|--------|-----|-----|--------|
| Total Nodes | ${v1.graph.nodes.length} | ${v2.graph.nodes.length} | ${v2.graph.nodes.length - v1.graph.nodes.length} |
| Total Edges | ${v1.graph.edges.length} | ${v2.graph.edges.length} | ${v2.graph.edges.length - v1.graph.edges.length} |

**Added Nodes (${addedNodes.length}):**
${addedNodes.length === 0 ? '_None_' : addedNodes.map((id) => `- \`${id}\``).join('\n')}

**Removed Nodes (${removedNodes.length}):**
${removedNodes.length === 0 ? '_None_' : removedNodes.map((id) => `- \`${id}\``).join('\n')}

## Edge Changes

**Added Edges (${addedEdges.length}):**
${addedEdges.length === 0 ? '_None_' : addedEdges.slice(0, 20).map((e) => `- \`${e.replace('|', ' → ')}\``).join('\n')}
${addedEdges.length > 20 ? `\n_... and ${addedEdges.length - 20} more_` : ''}

**Removed Edges (${removedEdges.length}):**
${removedEdges.length === 0 ? '_None_' : removedEdges.slice(0, 20).map((e) => `- \`${e.replace('|', ' → ')}\``).join('\n')}
${removedEdges.length > 20 ? `\n_... and ${removedEdges.length - 20} more_` : ''}

## Summary

The two exports are **${addedNodes.length === 0 && removedNodes.length === 0 && addedEdges.length === 0 && removedEdges.length === 0 ? 'structurally identical' : 'structurally different'}**. ${v2.graph.nodes.length === v1.graph.nodes.length && v2.graph.edges.length === v1.graph.edges.length ? 'Only node positions (x/y coordinates) changed — the underlying graph topology is unchanged.' : ''}
`;

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'codemap-diff-report-v3.md'), diff, 'utf8');

console.log('[diff-codemap] Nodes:', v1.graph.nodes.length, '→', v2.graph.nodes.length, '(Δ', v2.graph.nodes.length - v1.graph.nodes.length, ')');
console.log('[diff-codemap] Edges:', v1.graph.edges.length, '→', v2.graph.edges.length, '(Δ', v2.graph.edges.length - v1.graph.edges.length, ')');
console.log('[diff-codemap] Added nodes:', addedNodes.length);
console.log('[diff-codemap] Removed nodes:', removedNodes.length);
console.log('[diff-codemap] Added edges:', addedEdges.length);
console.log('[diff-codemap] Removed edges:', removedEdges.length);
console.log('[diff-codemap] Report written to', path.join(OUTDIR, 'codemap-diff-report-v3.md'));
