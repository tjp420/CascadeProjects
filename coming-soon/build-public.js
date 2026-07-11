'use strict';
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname);
const dst = path.resolve(__dirname, 'public');

function copyRecursive(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    if (item.endsWith('.exe')) continue;
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
  'contact.html', 'contact.js', 'certificate-upload.html',
  // cloud-scan.html is an intentional demo page for the marketing site
  'cloud-scan.html',
  'admin.html',
  'audit.html',
  'sample-certificate.html', 'email-template-universal.html',
  'faq.html', 'privacy.html', 'refund.html', 'roadmap.html',
  'security.html', 'terms.html', 'unlock.html',
  'styles.css', 'app-links.js', 'site-config.js',
  'js/auth.js', 'js/roadmap-app.js', 'js/scan-worker.js', 'js/terminal-simulation.js',
  'favicon.svg', 'robots.txt', 'sitemap.xml', '_redirects'
];

const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=['cascadeAuthToken','cascadeAuthUser','access_token','token','authToken','simplebeacon_token','sb-token-vault'];function clearLocalStorageItems(keys){try{for(var i=0;i<keys.length;i++){localStorage.removeItem(keys[i]);}}catch(_){}}function clearCookies(keys){try{for(var i=0;i<keys.length;i++){document.cookie=keys[i]+'=;path=/;max-age=0;SameSite=Lax;';}}catch(_){}}function signOut(){clearLocalStorageItems(TOKEN_KEYS);clearCookies(TOKEN_KEYS);try{sessionStorage.clear();}catch(_){}window.location.reload();}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.nav-links a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}window.SbAuth={signOut:signOut,propagateTokenToLinks:propagateTokenToLinks};})();`;

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
    if (f === 'js/auth.js') {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.writeFileSync(d, minimalAuthJs, 'utf8');
      console.warn('Source js/auth.js missing; wrote minimal fallback to public/js/auth.js');
    } else {
      console.warn('Skipping copy of', f, ':', (e && e.message) || e);
    }
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
  // Duplicate index.html under a no-extension name so the Pages Function can serve the SPA
  // without Cloudflare stripping the extension or redirecting to a directory-style URL.
  const dashboardIndex = path.join(dashboardDst, 'index.html');
  const dashboardEntry = path.join(dashboardDst, '__entry');
  if (fs.existsSync(dashboardIndex)) {
    fs.copyFileSync(dashboardIndex, dashboardEntry);
  }
}

// Ensure the marketing terminal-simulation widget is also available under /dashboard/js/
// so any cached/embedded view resolving it under the dashboard path gets real JS instead of HTML.
const terminalSimSrc = path.join(src, 'js', 'terminal-simulation.js');
const dashboardJsDst = path.join(dashboardDst, 'js', 'terminal-simulation.js');
if (fs.existsSync(terminalSimSrc) && fs.existsSync(dashboardDst)) {
  fs.mkdirSync(path.dirname(dashboardJsDst), { recursive: true });
  fs.copyFileSync(terminalSimSrc, dashboardJsDst);
}

process.stdout.write('Public build complete\n');
