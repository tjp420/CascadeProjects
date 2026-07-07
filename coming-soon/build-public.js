'use strict';
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname);
const dst = path.resolve(__dirname, 'public');

function copyRecursive(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    const srcPath = path.join(srcDir, item);
    const dstPath = path.join(dstDir, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// Create public dir
fs.mkdirSync(dst, { recursive: true });

// Copy individual files
const files = [
  'index.html', 'landing.html', 'pricing.html', 'community.html',
  'contact.html', 'contact.js', 'certificate-upload.html', 'upload.html',
  // cloud-scan.html is an intentional demo page for the marketing site
  'cloud-scan.html',
  'admin.html',
  'audit.html',
  'sample-certificate.html', 'email-template-universal.html',
  'faq.html', 'privacy.html', 'refund.html', 'roadmap.html',
  'security.html', 'terms.html', 'unlock.html',
  'styles.css', 'app-links.js', 'site-config.js',
  'js/auth.js', 'js/roadmap-app.js', 'js/scan-worker.js', 'js/terminal-simulation.js',
  'favicon.svg', 'robots.txt', 'sitemap.xml'
];

for (const f of files) {
  const s = path.join(src, f);
  const d = path.join(dst, f);
  try {
    const stat = fs.statSync(s);
    if (stat.isFile()) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  } catch (e) {
    console.warn('Skipping copy of', f, ':', (e && e.message) || e);
  }
}

// Copy directories
const dirs = ['css', 'js/vendor', 'js-es2018', 'downloads', 'data', 'content', 'blog'];
for (const d of dirs) {
  const sp = path.join(src, d);
  const dp = path.join(dst, d);
  if (fs.existsSync(sp)) {
    copyRecursive(sp, dp);
  }
}

// Copy the full ai-platform dashboard app into public/dashboard
const dashboardSrc = path.resolve(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard');
const dashboardDst = path.join(dst, 'dashboard');
if (fs.existsSync(dashboardSrc)) {
  fs.rmSync(dashboardDst, { recursive: true, force: true });
  fs.mkdirSync(dashboardDst, { recursive: true });
  copyRecursive(dashboardSrc, dashboardDst);
}

process.stdout.write('Public build complete\n');
