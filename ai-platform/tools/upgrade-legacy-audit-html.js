#!/usr/bin/env node
/**
 * Upgrade legacy light-theme audit HTML exports to the current dark template
 * (same CSS as localhost /sample-report paid deliverables).
 *
 * Usage: node tools/upgrade-legacy-audit-html.js path/to/SB-AUD-....html
 */

const fs = require('fs');
const path = require('path');
const { getAuditReportStyles } = require('../server/lib/complete-scan-audit-report');

function isLegacyAuditHtml(html) {
    return /--ink:\s*#0b1220/.test(html)
        || /background:\s*#fff;\s*font-size:\s*11pt/.test(html)
        || !/color-scheme:\s*dark/.test(html);
}

function extractTitle(html) {
    const match = html.match(/<title>([\s\S]*?)<\/title>/i);
    return match ? match[1].trim() : 'SimpleBeacon Pre-Launch Code Audit';
}

function buildModernHead(title) {
    return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0d1117">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${getAuditReportStyles()}
  </style>
</head>`;
}

function upgradeLegacyAuditHtml(html) {
    if (!isLegacyAuditHtml(html)) {
        return { html, changed: false, reason: 'already_modern' };
    }
    const title = extractTitle(html);
    const upgraded = html.replace(/<head>[\s\S]*?<\/head>/i, buildModernHead(title));
    return { html: upgraded, changed: true, reason: 'upgraded_theme' };
}

function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage: node tools/upgrade-legacy-audit-html.js <audit.html>');
        process.exit(1);
    }
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
    }

    const original = fs.readFileSync(resolved, 'utf8');
    const { html, changed, reason } = upgradeLegacyAuditHtml(original);
    if (!changed) {
        console.log(`No changes needed (${reason}): ${resolved}`);
        return;
    }

    const backupPath = `${resolved}.legacy-backup.html`;
    if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, original, 'utf8');
    }
    fs.writeFileSync(resolved, html, 'utf8');
    console.log(`Upgraded dark theme: ${resolved}`);
    console.log(`Backup saved: ${backupPath}`);
    console.log('Note: Re-download from the dashboard for Section 03 recipe columns and Section 05 sign-off.');
}

if (require.main === module) {
    main();
}

module.exports = {
    isLegacyAuditHtml,
    upgradeLegacyAuditHtml
};
