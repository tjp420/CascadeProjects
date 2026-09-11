#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reporterPath = path.join(
  process.cwd(),
  'packages',
  'simplebeacon-cli',
  'src',
  'reporters',
  'client-deliverable.js',
);

if (!fs.existsSync(reporterPath)) {
  console.error('Cannot find client-deliverable reporter at', reporterPath);
  process.exit(2);
}

const reporter = require(reporterPath);

const input = process.argv[2] || path.join(process.cwd(), 'simplebeacon-vscode-merged', 'simplebeacon-report.json');
const outDir = process.argv[3] || path.join(process.cwd(), '.simplebeacon', 'executive-export');

if (!fs.existsSync(input)) {
  console.error('Report file not found:', input);
  process.exit(3);
}

console.log('Reading report:', input);
const raw = fs.readFileSync(input, 'utf8');
let report;
try {
  report = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse report JSON:', e.message);
  process.exit(4);
}

try {
  const files = reporter.buildClientDeliverable(report, { client: report.projectPath || report.projectRoot || 'project' });
  // ensure outDir
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, body, 'utf8');
    console.log('Wrote', p);
  }
  // also write the model separately for quick inspection
  try {
    const model = reporter.buildExecutiveBriefModel(report, { client: report.projectPath || report.projectRoot || 'project' });
    const modelPath = path.join(outDir, 'executive-report.json');
    fs.writeFileSync(modelPath, JSON.stringify(model, null, 2) + '\n', 'utf8');
    console.log('Wrote model', modelPath);
  } catch (e) {
    // ignore
  }

  // write a success marker
  fs.writeFileSync(path.join(outDir, '_SUCCESS'), '');
  console.log('\nExecutive export complete. Directory:', outDir);
  const list = fs.readdirSync(outDir);
  console.log('Files:', list.join(', '));
} catch (e) {
  console.error('Failed to build client deliverable:', e && e.stack ? e.stack : e);
  process.exit(5);
}
