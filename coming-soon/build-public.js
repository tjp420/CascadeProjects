'use strict';
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname);
const dst = path.resolve(__dirname, 'public');

const pageConfig = loadPageConfig();

function loadPageConfig() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'page-metadata.json'), 'utf8');
    const json = JSON.parse(raw);
    return { origin: json.origin || 'https://simplebeacon.ai', ogImage: json.ogImage || '/favicon.svg', pages: json.pages || {} };
  } catch (e) {
    console.warn('page-metadata.json missing or invalid; skipping HTML transforms.');
    return { origin: 'https://simplebeacon.ai', ogImage: '/favicon.svg', pages: {} };
  }
}
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function canonicalFor(relPath) {
  if (relPath === 'index.html') return pageConfig.origin + '/';
  return pageConfig.origin + '/' + relPath.replace(/\\/g, '/');
}
function ogImageUrl() {
  const img = pageConfig.ogImage || '';
  if (!img) return '';
  if (img.startsWith('http')) return img;
  return pageConfig.origin + (img.startsWith('/') ? img : '/' + img);
}
function buildHeadBlock(meta, relPath) {
  const canonical = canonicalFor(relPath);
  const robots = meta.noindex ? 'noindex, nofollow' : 'index, follow';
  const lines = [`    <title>${escapeHtml(meta.title)}</title>`];
  if (meta.description) {
    lines.push(`    <meta name="description" content="${escapeHtml(meta.description)}">`);
  }
  lines.push(`    <link rel="canonical" href="${canonical}">`);
  lines.push(`    <meta name="robots" content="${robots}">`);
  const ogTitle = meta.ogTitle || meta.title || '';
  const ogDesc = meta.ogDescription || meta.description || '';
  if (ogTitle) lines.push(`    <meta property="og:title" content="${escapeHtml(ogTitle)}">`);
  if (ogDesc) lines.push(`    <meta property="og:description" content="${escapeHtml(ogDesc)}">`);
  lines.push(`    <meta property="og:type" content="website">`);
  lines.push(`    <meta property="og:url" content="${canonical}">`);
  const ogImage = ogImageUrl();
  if (ogImage) lines.push(`    <meta property="og:image" content="${ogImage}">`);
  lines.push(`    <meta name="twitter:card" content="summary">`);
  if (ogTitle) lines.push(`    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">`);
  if (ogDesc) lines.push(`    <meta name="twitter:description" content="${escapeHtml(ogDesc)}">`);
  return lines.join('\n');
}
function navHtml() {
  const links = [
    { href: '/index.html', label: 'Home' },
    { href: '/pricing.html', label: 'Pricing' },
    { href: '/audit.html', label: 'Audit' },
    { href: '/roadmap.html', label: 'Roadmap' },
    { href: '/community.html', label: 'Install' },
    { href: '/contact.html', label: 'Contact' },
    { href: '/faq.html', label: 'FAQ' },
    { href: '/blog/case-study-ai-slop-1-25m.html', label: 'Blog' }
  ];
  const inner = links.map(l => `<a href="${l.href}" style="color:#9CA3AF;text-decoration:none;margin-left:18px;font-size:0.9rem;white-space:nowrap;">${l.label}</a>`).join('');
  return `<nav style="background:#0B0F19;border-bottom:1px solid #1E293B;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;box-sizing:border-box;">\n  <a href="/index.html" style="color:#F3F4F6;text-decoration:none;font-weight:700;font-size:1.05rem;">SimpleBeacon</a>\n  <div style="display:flex;flex-wrap:wrap;align-items:center;">${inner}</div>\n</nav>`;
}
function footerHtml() {
  return `<footer style="background:#0B0F19;border-top:1px solid #1E293B;padding:32px 24px;text-align:center;color:#9CA3AF;font-size:0.85rem;">\n  <p style="margin:0 0 12px;color:#F3F4F6;">&copy; 2026 SimpleBeacon. All rights reserved.</p>\n  <p style="margin:0;">\n    <a href="/sample-report.html" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Sample report</a> &middot;\n    <a href="/pricing.html" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Pricing</a> &middot;\n    <a href="/contact.html" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Contact</a> &middot;\n    <a href="/terms.html" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Terms</a> &middot;\n    <a href="/privacy.html" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Privacy</a>\n  </p>\n</footer>`;
}
function transformHtml(html, relPath) {
  const meta = pageConfig.pages[relPath];
  if (!meta) return html;
  // Strip old SEO tags we are about to regenerate
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]*property=["']og:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]*name=["']robots["'][^>]*>/gi, '');
  // Normalize favicon to absolute path
  html = html.replace(/<link[^>]*rel=["']icon["'][^>]*href=["'][^"']*favicon\.svg["'][^>]*>/gi, '<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  // Ensure viewport
  if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta[^>]*charset[^>]*>/i, '$&\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }
  // Inject fresh head block immediately after charset so title/description appear early
  const headBlock = buildHeadBlock(meta, relPath);
  html = html.replace(/(<meta[^>]*charset[^>]*>)/i, '$1\n' + headBlock + '\n');
  // H1
  if (meta.h1) {
    if (/<h1[^>]*>/i.test(html)) {
      html = html.replace(/(<h1[^>]*>)[\s\S]*?<\/h1>/i, (match, tag) => `${tag}${escapeHtml(meta.h1)}</h1>`);
    } else {
      html = html.replace(/<body[^>]*>/i, '$&\n    <h1 style="text-align:center;margin:24px 0 0;font-size:1.75rem;">' + escapeHtml(meta.h1) + '</h1>');
    }
  }
  // Nav
  if (meta.includeNav && !/<nav\b/i.test(html)) {
    html = html.replace(/<body[^>]*>/i, '$&\n' + navHtml());
  }
  // Footer
  if (meta.includeFooter && !/<footer\b/i.test(html)) {
    html = html.replace(/<\/body>/i, footerHtml() + '\n</body>');
  }
  return html;
}
function generateSitemap() {
  const urls = [];
  const lastmod = new Date().toISOString().split('T')[0];
  for (const [relPath, meta] of Object.entries(pageConfig.pages)) {
    if (!meta || !meta.sitemap) continue;
    const loc = relPath === 'index.html' ? pageConfig.origin + '/' : pageConfig.origin + '/' + relPath.replace(/\\/g, '/');
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${meta.sitemap.changefreq}</changefreq>\n    <priority>${meta.sitemap.priority}</priority>\n  </url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(dst, 'sitemap.xml'), xml, 'utf8');
  process.stdout.write('Generated sitemap.xml with ' + urls.length + ' URLs\n');
}

function copyRecursive(srcDir, dstDir, relPrefix = '') {
  fs.mkdirSync(dstDir, { recursive: true });
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    if (item.endsWith('.exe')) continue;
    const srcPath = path.join(srcDir, item);
    const dstPath = path.join(dstDir, item);
    const stat = fs.statSync(srcPath);
    const relPath = relPrefix + item;
    if (stat.isDirectory()) {
      copyRecursive(srcPath, dstPath, relPath + '/');
    } else if (item.endsWith('.html') && pageConfig.pages[relPath]) {
      const html = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(dstPath, transformHtml(html, relPath), 'utf8');
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
  'sample-certificate.html', 'sample-report.html', 'email-template-universal.html',
  'email-template-preview.html', 'email-template-redesign.html',
  'faq.html', 'privacy.html', 'refund.html', 'roadmap.html',
  'security.html', 'terms.html', 'unlock.html',
  'cloud-teams.html', 'dashboard-preview.html', 'terminal-walkthrough.html', 'walkthrough-embed.html',
  'styles.css', 'app-links.js', 'site-config.js',
  'js/auth.js', 'js/roadmap-app.js', 'js/scan-worker.js', 'js/terminal-simulation.js', 'js/token-entry-guard.js',
  'favicon.ico', 'favicon.svg', 'robots.txt', 'sitemap.xml', '_headers', '_redirects'
];

const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=['cascadeAuthToken','cascadeAuthUser','access_token','token','authToken','simplebeacon_token','sb-token-vault'];function clearLocalStorageItems(keys){try{for(var i=0;i<keys.length;i++){localStorage.removeItem(keys[i]);}}catch(_){}}function clearCookies(keys){try{for(var i=0;i<keys.length;i++){document.cookie=keys[i]+'=;path=/;max-age=0;SameSite=Lax;';}}catch(_){}}function signOut(){clearLocalStorageItems(TOKEN_KEYS);clearCookies(TOKEN_KEYS);try{sessionStorage.clear();}catch(_){}window.location.reload();}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.nav-links a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}window.SbAuth={signOut:signOut,propagateTokenToLinks:propagateTokenToLinks};})();`; // simplebeacon-ignore credential-pattern — generated auth JS template, token key names not secrets

function processFile(f) {
  const s = path.join(src, f);
  const d = path.join(dst, f);
  try {
    const stat = fs.statSync(s);
    if (!stat.isFile()) return;
    fs.mkdirSync(path.dirname(d), { recursive: true });
    if (f.endsWith('.html') && pageConfig.pages[f]) {
      const html = fs.readFileSync(s, 'utf8');
      fs.writeFileSync(d, transformHtml(html, f), 'utf8');
    } else if (f === 'js/auth.js') {
      try {
        fs.copyFileSync(s, d);
      } catch (_) {
        fs.writeFileSync(d, minimalAuthJs, 'utf8');
        console.warn('Source js/auth.js missing; wrote minimal fallback to public/js/auth.js'); // simplebeacon-ignore debug-artifact — build script diagnostic
      }
    } else {
      fs.copyFileSync(s, d);
    }
  } catch (e) {
    if (f === 'js/auth.js') {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.writeFileSync(d, minimalAuthJs, 'utf8');
      console.warn('Source js/auth.js missing; wrote minimal fallback to public/js/auth.js'); // simplebeacon-ignore debug-artifact — build script diagnostic
    } else {
      console.warn('Skipping copy of', f, ':', (e && e.message) || e);
    }
  }
}

for (const f of files) {
  processFile(f);
}

// Copy directories
const dirs = [
  { dir: 'css', prefix: '' },
  { dir: 'js/vendor', prefix: '' },
  { dir: 'js-es2018', prefix: '' },
  { dir: 'downloads', prefix: '' },
  { dir: 'data', prefix: '' },
  { dir: 'content', prefix: '' },
  { dir: 'blog', prefix: 'blog/' }
];
for (const { dir, prefix } of dirs) {
  const sp = path.join(src, dir);
  const dp = path.join(dst, dir);
  if (fs.existsSync(sp)) {
    copyRecursive(sp, dp, prefix);
  }
}

// Audit page scripts live under js/dashboard — mirror to js-es2018/dashboard for Pages
const auditDashSrc = path.join(src, 'js', 'dashboard');
const auditDashDst = path.join(dst, 'js-es2018', 'dashboard');
if (fs.existsSync(auditDashSrc)) {
  fs.mkdirSync(auditDashDst, { recursive: true });
  copyRecursive(auditDashSrc, auditDashDst, 'js-es2018/dashboard/');
}

// Copy the full ai-platform dashboard app into public/dashboard
const dashboardSrc = path.resolve(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard');
const dashboardDst = path.join(dst, 'dashboard');
if (fs.existsSync(dashboardSrc)) {
  fs.rmSync(dashboardDst, { recursive: true, force: true });
  fs.mkdirSync(dashboardDst, { recursive: true });
  copyRecursive(dashboardSrc, dashboardDst, 'dashboard/');
  // Duplicate index.html under a no-extension name so the Pages Function can serve the SPA
  // without Cloudflare stripping the extension or redirecting to a directory-style URL.
  const dashboardIndex = path.join(dashboardDst, 'index.html');
  const dashboardEntry = path.join(dashboardDst, '__entry');
  if (fs.existsSync(dashboardIndex)) {
    let dashHtml = fs.readFileSync(dashboardIndex, 'utf8');
    // Make marketing site config available to the dashboard for vsixDownloadUrl and pricing fallbacks.
    dashHtml = dashHtml.replace(/<\/head>/i, '  <script src="/site-config.js"></script>\n</head>');
    // Rewrite production asset paths to /dashboard/dist/assets for CF Pages
    const cacheBust = Date.now();
    dashHtml = dashHtml.replace(/href="\/assets\/main\.css(?:\?[^"]*)?"/g, `href="/dashboard/dist/assets/main.css?v=${cacheBust}"`);
    dashHtml = dashHtml.replace(/src="\/assets\/main\.js(?:\?[^"]*)?"/g, `src="/dashboard/dist/assets/main.js?v=${cacheBust}"`);
    // Also handle any leftover Vite dev script references
    dashHtml = dashHtml.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, `<script type="module" src="/dashboard/dist/assets/main.js?v=${cacheBust}"></script>`);
    // Rewrite relative js/vendor paths to absolute /dashboard/js/vendor for CF Pages
    dashHtml = dashHtml.replace(/src="js\/vendor\//g, 'src="/dashboard/js/vendor/');
    fs.writeFileSync(dashboardIndex, dashHtml, 'utf8');
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

const dashboardMain = path.join(dashboardDst, 'js-es2018', 'main.js');
if (!fs.existsSync(dashboardMain)) {
  console.error('FATAL: dashboard js-es2018/main.js missing after copy — Analyze page will not load.');
  process.exit(1);
}

// Copy latest VSIX into public/downloads when packaged (gitignored at source).
// Cloudflare Pages rejects static assets over 25 MiB, so we skip oversized VSIXs.
const MAX_VSIX_BYTES = 25 * 1024 * 1024;
try {
  const vsixDir = path.join(dst, 'downloads');
  fs.mkdirSync(vsixDir, { recursive: true });
  const extRoot = path.resolve(__dirname, '..', 'simplebeacon-vscode-merged');
  const vsixFiles = fs.readdirSync(extRoot).filter((f) => /^simplebeacon-vscode-.*\.vsix$/i.test(f));
  if (vsixFiles.length) {
    vsixFiles.sort((a, b) => fs.statSync(path.join(extRoot, b)).mtimeMs - fs.statSync(path.join(extRoot, a)).mtimeMs);
    const latest = path.join(extRoot, vsixFiles[0]);
    const latestSize = fs.statSync(latest).size;
    if (latestSize > MAX_VSIX_BYTES) {
      console.warn(`VSIX ${vsixFiles[0]} is ${(latestSize / 1024 / 1024).toFixed(1)} MiB; skipping copy because Cloudflare Pages limits static assets to 25 MiB.`);
    } else {
      fs.copyFileSync(latest, path.join(vsixDir, 'simplebeacon.vsix'));
      process.stdout.write(`Copied VSIX ${vsixFiles[0]} → public/downloads/simplebeacon.vsix\n`);
    }
  }
} catch (e) {
  console.warn('VSIX copy skipped:', (e && e.message) || e);
}

generateSitemap();

process.stdout.write('Public build complete\n');
