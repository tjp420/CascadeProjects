#!/usr/bin/env node
/**
 * Build cloudflare-deploy/ from coming-soon/ after local verification.
 * Usage: node scripts/build-cloudflare-package.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'cloudflare-deploy');

const FILES = [
  'index.html',
  'pricing.html',
  'pricing.js',
  'terms.html',
  'privacy.html',
  'refund.html',
  'community.html',
  'styles.css',
  'site-config.js',
  'app-links.js',
  'audit-booking.js',
  'diagnostic-scanner.js',
  'diagnostic-bundle-lib.js',
  'sample-report.html',
  'operator-bookings.html',
  'favicon.svg',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'community/index.html'
];

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function copyFile(rel) {
  const src = path.join(ROOT, rel);
  const dest = path.join(OUT, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${rel}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function assertNoDraftLegal() {
  for (const page of ['terms.html', 'privacy.html', 'refund.html']) {
    const text = fs.readFileSync(path.join(OUT, page), 'utf8');
    if (/Draft\s*[—-]/i.test(text) || /counsel review/i.test(text)) {
      throw new Error(`${page} still contains draft/counsel warnings`);
    }
  }
}

function assertNoSecrets() {
  const secretPatterns = [
    /sk_live_[a-zA-Z0-9]+/,
    /sk_test_[a-zA-Z0-9]+/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /re_[a-zA-Z0-9]{20,}/
  ];
  const exampleAllowlist = [
    'AKIAIOSFODNN7EXAMPLE'
  ];
  for (const rel of FILES) {
    const filePath = path.join(OUT, rel);
    if (!fs.existsSync(filePath) || !/\.(html|js|css)$/i.test(rel)) continue;
    let text = fs.readFileSync(filePath, 'utf8');
    for (const example of exampleAllowlist) {
      text = text.split(example).join('');
    }
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) {
        throw new Error(`Possible secret in ${rel}`);
      }
    }
  }
}

function assertAssetsLinked() {
  const required = ['styles.css', 'site-config.js', 'app-links.js', 'favicon.svg'];
  for (const name of required) {
    if (!fs.existsSync(path.join(OUT, name))) {
      throw new Error(`Missing packaged asset: ${name}`);
    }
  }
  const index = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  if (!index.includes('/styles.css') || !index.includes('/site-config.js') || !index.includes('/diagnostic-scanner.js')) {
    throw new Error('index.html missing core asset references');
  }
}

function assertNoBrokenDashboardRefs() {
  const text = fs.readFileSync(path.join(OUT, '_redirects'), 'utf8');
  if (/simplebeacon-dashboard|\/signin/i.test(text)) {
    throw new Error('_redirects still references dashboard paths');
  }
  const index = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  if (/\/app#|href="\/signin"/i.test(index)) {
    throw new Error('index.html still links to /app or /signin');
  }
}

function writeManifest() {
  const lines = [
    '# Simplebeacon Cloudflare Pages package',
    `# Generated: ${new Date().toISOString()}`,
    '# Upload this directory via Cloudflare Pages → Direct Upload',
    '',
    'path\tbytes\tsha256'
  ];

  for (const rel of FILES) {
    const filePath = path.join(OUT, rel);
    const stat = fs.statSync(filePath);
    lines.push(`${rel.replace(/\\/g, '/')}\t${stat.size}\t${sha256(filePath)}`);
  }

  fs.writeFileSync(path.join(OUT, 'PACKAGE_MANIFEST.txt'), `${lines.join('\n')}\n`);
}

function main() {
  if (fs.existsSync(OUT)) {
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT, { recursive: true });

  for (const rel of FILES) {
    copyFile(rel);
  }

  assertNoDraftLegal();
  assertNoSecrets();
  assertAssetsLinked();
  assertNoBrokenDashboardRefs();
  writeManifest();

  console.log(`Package ready: ${OUT}`);
  console.log(`Files: ${FILES.length} (+ PACKAGE_MANIFEST.txt)`);
}

main();
