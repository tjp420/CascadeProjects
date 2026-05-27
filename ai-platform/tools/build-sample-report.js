#!/usr/bin/env node
/**
 * Regenerate coming-soon/sample-report.html from the same template as paid audit PDFs.
 * Usage: node tools/build-sample-report.js
 */

const fs = require('fs');
const path = require('path');
const { buildSampleAuditReportHtml } = require('../server/lib/complete-scan-audit-report');

const OUT = path.join(__dirname, '..', '..', 'coming-soon', 'sample-report.html');
const FOOTER_SCRIPTS = `
  <script src="/site-config.js"></script>
  <script src="/app-links.js"></script>
`;

let html = buildSampleAuditReportHtml({ siteChrome: true });
html = html.replace('</body>', `${FOOTER_SCRIPTS}\n</body>`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT} (${html.length.toLocaleString()} bytes)`);
