const path = require('path');
const fs = require('fs');
const { buildCoverageReportsModel } = require('../server/lib/coverage-reports-builder');

const ROOT = path.join(__dirname, '..');
const samplePath = path.join(ROOT, 'web/data/coverage-reports-sample.json');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
const merged = buildCoverageReportsModel(ROOT, sample);

fs.writeFileSync(samplePath, `${JSON.stringify(merged, null, 2)}\n`);

console.log('updated web/data/coverage-reports-sample.json');
console.log('istanbul line coverage:', merged.overview?.lineCoverage ?? 'n/a');
