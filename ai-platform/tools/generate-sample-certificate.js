#!/usr/bin/env node
/** Generate static sample Code Hygiene Certificate for simplebeacon.ai marketing. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const reportPath = path.join(ROOT, '.simplebeacon', 'report.json');
const outPath = path.join(ROOT, '..', 'coming-soon', 'sample-certificate.html');

const { buildCertificateModel, renderCertificateHtml } = require('../server/lib/code-hygiene-certificate');

function sampleReport() {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      qualityScore: 100,
      issueCount: 0,
      gate: { pass: true },
      rawIssues: [],
      severityCounts: { critical: 0, high: 0, moderate: 0, low: 0 }
    };
  }
}

const model = buildCertificateModel({
  report: sampleReport(),
  milestone: 'beta',
  client_name: 'Northwind Retail',
  project_name: 'Customer Portal Rebuild',
  branding: {
    agency_name: 'Apex Digital Labs',
    brand_color_hex: '#2563EB',
    logo_data_url: null,
    contact_email: 'delivery@apexdigital.example'
  },
  certificate_id: 'sb_cert_sample_marketing',
  scan_id: 'sb_auth_sample_marketing'
});

const html = renderCertificateHtml(model);
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath);
