'use strict';

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function readHtml(rel) {
  return fs.readFileSync(path.join(PUBLIC_DIR, rel), 'utf8');
}

const checks = [];
let failed = false;

function assert(rel, name, pattern) {
  const html = readHtml(rel);
  if (!pattern.test(html)) {
    checks.push(`FAIL: ${name} missing in ${rel}`);
    failed = true;
    return false;
  }
  checks.push(`PASS: ${name} found in ${rel}`);
  return true;
}

console.log('Running public build layout + PDF wiring audit...\n');

// Enterprise landing assertions
assert('index.html', 'hero H1 (auto-remediation)', /Auto-Remediate AI Code Debt Before It Becomes Audit Risk/);
assert('index.html', 'Free pricing tag', /Free — 5 browser scans\/mo/);
assert('index.html', 'Team pricing tag', /Team \/ Agency — \$49–\$99\/mo/);
assert('index.html', 'Enterprise pricing tag', /Enterprise Governance — \$499\+\/mo/);

// Pricing matrix assertions
assert('pricing.html', 'Free Preview tier', /Free Preview/);
assert('pricing.html', 'Team / Agency Suite tier', /Team \/ Agency Suite/);
assert('pricing.html', 'Enterprise Governance tier', /Enterprise Governance/);
assert('pricing.html', 'EU AI Act mention', /EU AI Act/);

// Sample report ROI metrics assertions
assert('sample-report.html', '14.5 hrs metric', /14\.5 hrs/);
assert('sample-report.html', '82% metric', /82%/);
assert('sample-report.html', '$124,000 metric', /\$124,000/);
assert('sample-report.html', 'Velocity ROI card', /Velocity ROI/);
assert('sample-report.html', 'Pipeline Efficiency card', /Pipeline Efficiency/);
assert('sample-report.html', 'Risk Compliance card', /Risk Compliance/);

// Roadmap + PDF export wiring assertions
assert('roadmap.html', 'auto-remediation roadmap hero', /From Detection to Automated Janitor/);
assert('roadmap.html', 'simplebeacon fix mention', /simplebeacon fix/);
assert('roadmap.html', 'html2pdf.js library loaded', /html2pdf\.js/);
assert('roadmap.html', 'PDF export button', /id="exportPdfBtn"/);

checks.forEach(c => console.log(c));

if (failed) {
  console.error('\nLayout/PDF wiring audit failed.');
  process.exit(1);
}

console.log('\nPASS: Public build layout and PDF wiring audit complete.');
process.exit(0);
