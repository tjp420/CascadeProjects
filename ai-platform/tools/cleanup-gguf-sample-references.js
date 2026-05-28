#!/usr/bin/env node
/**
 * Replace GGUF/Cascade dashboard references in web/data sample JSON for Simplebeacon branding.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'web', 'data');
const replacements = [
  [/gguf-dashboard-server\.js/g, 'simplebeacon-server.js'],
  [/gguf-dashboard-server/g, 'simplebeacon-server'],
  [/gguf-development-roadmap-report/g, 'development-roadmap-report'],
  [/gguf-mock-data-analysis-report/g, 'mock-data-analysis-report'],
  [/gguf-mock-analysis-sample/g, 'mock-analysis-sample'],
  [/gguf-mock-analysis-report/g, 'mock-analysis-report'],
  [/gguf-roadmap-sample/g, 'master-roadmap-sample'],
  [/filesystem\+gguf-path/g, 'filesystem-scan'],
  [/gguf-development-roadmap-report/g, 'development-roadmap-report'],
  [/ggufAIInsights/g, 'mockAIInsights'],
  [/lastGgufAnalysisReport/g, 'lastMockAnalysisReport'],
  [/rpt-gguf-scan/g, 'rpt-mock-scan'],
  [/ggufStatus/g, 'scanStatus'],
  [/ggufReport/g, 'mockReport'],
  [/GGUF Dashboard/g, 'Simplebeacon dashboard'],
  [/GGUF Analysis/g, 'Mock data analysis'],
  [/GGUF Roadmap/g, 'Roadmap analysis'],
  [/GGUF/g, 'Simplebeacon scan'],
  [/gguf-analysis/g, 'analyze'],
  [/gguf-roadmap-enhanced/g, 'roadmap-enhanced'],
  [/"gguf":/g, '"measured":'],
  [/phi-2\.Q4_K_M\.gguf/g, 'phi-2.Q4_K_M (local model)'],
  [/\.gguf/g, ' model file'],
  [/gguf_/g, 'mock_'],
  [/gguf-issues-api/g, 'issue-resolution-api'],
  [/\/api\/gguf\//g, '/api/mock-scanner/'],
  [/ollama\+gguf-path/g, 'ollama+local-model'],
  [/gguf-mock-analysis/g, 'mock-analysis'],
  [/"gguf"/g, '"mock-scan"'],
  [/cat_gguf/g, 'cat_models'],
  [/col_gguf/g, 'col_models'],
  [/act_gguf/g, 'act_models']
];

let files = 0;
let hits = 0;

for (const name of fs.readdirSync(dataDir)) {
  if (!name.endsWith('.json')) continue;
  const filePath = path.join(dataDir, name);
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;
  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }
  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    files += 1;
    hits += (before.match(/gguf|GGUF/gi) || []).length;
  }
}

console.log(`Updated ${files} sample files (approx ${hits} legacy tokens replaced).`);
