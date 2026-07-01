#!/usr/bin/env node
/**
 * Inject exported graph data into .simplebeacon/codemap.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const EXPORTED = 'j:\\Downloads\\cascadeprojects-codemap-analysis-2026-07-01(2).json';
const HTML = path.join(process.cwd(), '.simplebeacon', 'codemap.html');

const exported = JSON.parse(fs.readFileSync(EXPORTED, 'utf8'));
const graphData = JSON.stringify({ nodes: exported.graph.nodes, edges: exported.graph.edges });

let html = fs.readFileSync(HTML, 'utf8');

html = html.replace(
    /<script type="application\/json" id="graphData">[\s\S]*?<\/script>/,
    '<script type="application/json" id="graphData">' + graphData + '</script>'
);

fs.writeFileSync(HTML, html, 'utf8');
console.log('[codemap] Graph data injected:', exported.graph.nodes.length, 'nodes,', exported.graph.edges.length, 'edges');
