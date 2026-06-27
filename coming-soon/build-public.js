'use strict';
const fs = require('fs');
const path = require('path');

const src = 'C:/Users/Trevor/CascadeProjects/coming-soon';
const dst = 'C:/Users/Trevor/CascadeProjects/coming-soon/public';

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
  // cloud-scan.html and sample-report.html are intentional demo pages for the marketing site
  'cloud-scan.html', 'sample-report.html',
  'sample-certificate.html', 'email-template-universal.html',
  'faq.html', 'privacy.html', 'refund.html', 'roadmap.html',
  'security.html', 'terms.html', 'unlock.html',
  'styles.css', 'app-links.js', 'site-config.js',
  'favicon.svg', 'robots.txt', 'sitemap.xml'
];

for (const f of files) {
  const s = path.join(src, f);
  const d = path.join(dst, f);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
  }
}

// Copy directories
const dirs = ['css', 'js', 'downloads', 'data', 'content', 'blog'];
for (const d of dirs) {
  const sp = path.join(src, d);
  const dp = path.join(dst, d);
  if (fs.existsSync(sp)) {
    copyRecursive(sp, dp);
  }
}

process.stdout.write('Public build complete\n');
