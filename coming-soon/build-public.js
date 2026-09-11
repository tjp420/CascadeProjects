'use strict';
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname);
const dst = path.resolve(__dirname, 'public');

const {
    transformHtml: transformHtmlWithConfig,
    AUTH_TOKEN_KEYS
} = require('./lib/site-html.cjs');

const pageConfig = loadPageConfig();

function removeDirSafe(targetPath) {
    if (!targetPath || !fs.existsSync(targetPath)) {
        return;
    }
    try {
        fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (error) {
        if (error && error.code !== 'ENOENT') {
            throw error;
        }
    }
}

function loadPageConfig() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, 'page-metadata.json'), 'utf8');
        const json = JSON.parse(raw);
        return {
            origin: json.origin || 'https://simplebeacon.ai',
            ogImage: json.ogImage || '/favicon.svg',
            pages: json.pages || {}
        };
    } catch (e) {
        console.warn('page-metadata.json missing or invalid; skipping HTML transforms.');
        return { origin: 'https://simplebeacon.ai', ogImage: '/favicon.svg', pages: {} };
    }
}
function transformHtml(html, relPath) {
    return transformHtmlWithConfig(html, relPath, pageConfig);
}
function generateSitemap() {
    const urls = [];
    const lastmod = new Date().toISOString().split('T')[0];
    for (const [relPath, meta] of Object.entries(pageConfig.pages)) {
        if (!meta || !meta.sitemap) continue;
        const loc =
            relPath === 'index.html' ? pageConfig.origin + '/' : pageConfig.origin + '/' + relPath.replace(/\\/g, '/');
        urls.push(
            `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${meta.sitemap.changefreq}</changefreq>\n    <priority>${meta.sitemap.priority}</priority>\n  </url>`
        );
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
    fs.writeFileSync(path.join(dst, 'sitemap.xml'), xml, 'utf8');
    process.stdout.write('Generated sitemap.xml with ' + urls.length + ' URLs\n');
}

function shouldSkipPath(relPath) {
    if (!relPath) return false;
    const normalized = relPath.replace(/\\/g, '/').toLowerCase();
    return normalized.split('/').some(part => part === 'node_modules' || part === '.git' || part === 'dist');
}

function copyRecursive(srcDir, dstDir, relPrefix = '') {
    fs.mkdirSync(dstDir, { recursive: true });
    const items = fs.readdirSync(srcDir);
    for (const item of items) {
        if (item.endsWith('.exe')) continue;
        const relPath = relPrefix + item;
        if (shouldSkipPath(relPath)) continue;
        const srcPath = path.join(srcDir, item);
        const dstPath = path.join(dstDir, item);
        let stat;
        try {
            stat = fs.statSync(srcPath);
        } catch (e) {
            if (e && e.code === 'ENOENT') {
                continue;
            }
            throw e;
        }
        if (stat.isDirectory()) {
            copyRecursive(srcPath, dstPath, relPath + '/');
        } else if (item.endsWith('.html') && pageConfig.pages[relPath]) {
            try {
                const html = fs.readFileSync(srcPath, 'utf8');
                fs.writeFileSync(dstPath, transformHtml(html, relPath), 'utf8');
            } catch (e) {
                console.warn('Skipping copy of', relPath, ':', (e && e.message) || e);
            }
        } else {
            try {
                fs.copyFileSync(srcPath, dstPath);
            } catch (e) {
                console.warn('Skipping copy of', relPath, ':', (e && e.message) || e);
            }
        }
    }
}

// Create public dir
fs.mkdirSync(dst, { recursive: true });

// Copy individual files
const files = [
    'index.html',
    'landing.html',
    'pricing.html',
    'community.html',
    'contact.html',
    'contact.js',
    'certificate-upload.html',
    // cloud-scan.html is an intentional demo page for the marketing site
    'cloud-scan.html',
    'admin.html',
    'audit.html',
    'sample-certificate.html',
    'sample-report.html',
    'email-template-universal.html',
    'email-template-preview.html',
    'email-template-redesign.html',
    'faq.html',
    'privacy.html',
    'refund.html',
    'roadmap.html',
    'security.html',
    'terms.html',
    'unlock.html',
    'cloud-teams.html',
    'dashboard-preview.html',
    'terminal-walkthrough.html',
    'walkthrough-embed.html',
    'styles.css',
    'app-links.js',
    'site-config.js',
    'js/auth.js',
    'js/referral-capture.js',
    'js/roadmap-app.js',
    'js/scan-worker.js',
    'js/terminal-simulation.js',
    'js/token-entry-guard.js',
    'favicon.ico',
    'favicon.svg',
    'robots.txt',
    'sitemap.xml',
    '_headers',
    '_redirects'
];

const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=${JSON.stringify(AUTH_TOKEN_KEYS)};var USER_KEYS=['sb_user','sb-user','cascadeAuthUser'];function clearLocalStorageItems(keys){try{for(var i=0;i<keys.length;i++){localStorage.removeItem(keys[i]);}}catch(_){}}function clearCookies(keys){try{for(var i=0;i<keys.length;i++){document.cookie=keys[i]+'=;path=/;max-age=0;SameSite=Lax;';}}catch(_){}}function signOut(){clearLocalStorageItems(TOKEN_KEYS);clearLocalStorageItems(USER_KEYS);clearCookies(TOKEN_KEYS);try{sessionStorage.clear();}catch(_){}window.location.reload();}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.nav-links a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}window.SbAuth={signOut:signOut,propagateTokenToLinks:propagateTokenToLinks};})();`; // simplebeacon-ignore credential-pattern — generated auth JS template, token key names not secrets

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
    removeDirSafe(dashboardDst);
    fs.mkdirSync(dashboardDst, { recursive: true });
    copyRecursive(dashboardSrc, dashboardDst, 'dashboard/');
    // Duplicate index.html under a no-extension name so the Pages Function can serve the SPA
    // without Cloudflare stripping the extension or redirecting to a directory-style URL.
    const dashboardIndex = path.join(dashboardDst, 'index.html');
    const dashboardEntry = path.join(dashboardDst, '__entry');
    if (fs.existsSync(dashboardIndex)) {
        let dashHtml = fs.readFileSync(dashboardIndex, 'utf8');
        // Make marketing site config available to the dashboard for vsixDownloadUrl and pricing fallbacks.
        // Inject a minimal inline `site-config` fallback so the dashboard has
        // reasonable defaults if the external `site-config.js` hasn't propagated
        // to every CDN edge yet. The external script (when present) will override
        // these defaults after it loads.
        dashHtml = dashHtml.replace(
            /<\/head>/i,
            '  <script>window.__SB_SITE_CONFIG=window.__SB_SITE_CONFIG||{brand:{name:"SimpleBeacon",logo:"/favicon.svg"},vsixDownloadUrl:"https://marketplace.visualstudio.com/items?itemName=simplebeacon.simplebeacon-vscode",pricing:{plans:[]}};</script>\n  <script src="/site-config.js"></script>\n  <script src="/js-es2018/referral-capture.js" defer></script>\n</head>'
        );
        if (!/<title>/i.test(dashHtml)) {
            dashHtml = dashHtml.replace(/<head[^>]*>/i, '$&\n  <title>SimpleBeacon Dashboard</title>');
        }
        // Rewrite production asset paths with cache-bust for CF Pages
        const cacheBust = Date.now();
        const dashAssetsDir = path.join(dashboardDst, 'assets');
        let hashedMainJs = '';
        let hashedMainCss = '';
        if (fs.existsSync(dashAssetsDir)) {
            hashedMainJs = fs.readdirSync(dashAssetsDir).find(f => /^main-[A-Za-z0-9_-]+\.js$/.test(f)) || '';
            hashedMainCss = fs.readdirSync(dashAssetsDir).find(f => /^main-[A-Za-z0-9_-]+\.css$/.test(f)) || '';
            if (hashedMainJs) {
                fs.copyFileSync(path.join(dashAssetsDir, hashedMainJs), path.join(dashAssetsDir, 'main.js'));
                console.log(`Copied ${hashedMainJs} → main.js for non-hashed asset path`);
            }
            if (hashedMainCss) {
                fs.copyFileSync(path.join(dashAssetsDir, hashedMainCss), path.join(dashAssetsDir, 'main.css'));
                console.log(`Copied ${hashedMainCss} → main.css for non-hashed asset path`);
            }
            const workerFiles = [
                ['js-es2018/workers/scan-worker.js', 'scan-worker.js'],
                ['js-es2018/workers/scan-wasm-bridge.js', 'scan-wasm-bridge.js'],
                ['js-es2018/utils-lib/simplebeaconignore.browser.js', 'simplebeaconignore.browser.js'],
            ];
            for (const [rel, name] of workerFiles) {
                const from = path.join(dashboardSrc, rel);
                const to = path.join(dashAssetsDir, name);
                if (fs.existsSync(from)) {
                    fs.copyFileSync(from, to);
                    console.log(`Copied ${rel} → assets/${name}`);
                }
            }
        }
        dashHtml = dashHtml.replace(
            /href="\.?\/assets\/main\.css(?:\?[^"]*)?"/g,
            `href="/dashboard/assets/${hashedMainCss || 'main.css'}?v=${cacheBust}"`
        );
        dashHtml = dashHtml.replace(
            /src="\.?\/assets\/main(?:-[A-Za-z0-9_-]+)?\.js(?:\?[^"]*)?"/g,
            `src="/dashboard/assets/${hashedMainJs || 'main.js'}?v=${cacheBust}"`
        );
        // Also handle any leftover Vite dev script references
        dashHtml = dashHtml.replace(
            /<script type="module" src="\/src\/main\.tsx"><\/script>/,
            `<script type="module" src="/dashboard/dist/assets/main.js?v=${cacheBust}"></script>`
        );
        // Rewrite relative js/vendor paths to absolute /dashboard/js/vendor for CF Pages
        dashHtml = dashHtml.replace(/src="js\/vendor\//g, 'src="/dashboard/js/vendor/');
        try {
            fs.writeFileSync(dashboardIndex, dashHtml, 'utf8');
        } catch (e) {
            console.warn('Skipping write of dashboard/index.html:', (e && e.message) || e);
        }
        try {
            fs.copyFileSync(dashboardIndex, dashboardEntry);
        } catch (e) {
            console.warn('Skipping copy of dashboard/__entry:', (e && e.message) || e);
        }
    }

    // Also copy dashboard to /app/ — the CDN has a stuck cache on /dashboard/ and
    // cannot be purged without zone-level API permissions. /app/ is a fresh path
    // the CDN has never seen, so it will fetch the latest version.
    const appDst = path.join(dst, 'app');
    removeDirSafe(appDst);
    fs.mkdirSync(appDst, { recursive: true });
    copyRecursive(dashboardDst, appDst, 'app/');
    // Rewrite asset paths from /dashboard/ to /app/ in the /app/ copy
    const appIndex = path.join(appDst, 'index.html');
    const appEntry = path.join(appDst, '__entry');
    if (fs.existsSync(appIndex)) {
        let appHtml = fs.readFileSync(appIndex, 'utf8');
        appHtml = appHtml.replace(/\/dashboard\//g, '/app/');
        try {
            fs.writeFileSync(appIndex, appHtml, 'utf8');
        } catch (e) {
            console.warn('Skipping write of app/index.html:', (e && e.message) || e);
        }
        try {
            fs.copyFileSync(appIndex, appEntry);
        } catch (e) {
            console.warn('Skipping copy of app/__entry:', (e && e.message) || e);
        }
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
    const vsixFiles = fs.readdirSync(extRoot).filter(f => /^simplebeacon-vscode-.*\.vsix$/i.test(f));
    if (vsixFiles.length) {
        vsixFiles.sort(
            (a, b) => fs.statSync(path.join(extRoot, b)).mtimeMs - fs.statSync(path.join(extRoot, a)).mtimeMs
        );
        const latest = path.join(extRoot, vsixFiles[0]);
        const latestSize = fs.statSync(latest).size;
        if (latestSize > MAX_VSIX_BYTES) {
            console.warn(
                `VSIX ${vsixFiles[0]} is ${(latestSize / 1024 / 1024).toFixed(1)} MiB; skipping copy because Cloudflare Pages limits static assets to 25 MiB.`
            );
        } else {
            fs.copyFileSync(latest, path.join(vsixDir, 'simplebeacon.vsix'));
            // Also copy with version in filename — fresh URL bypasses CDN cache on updates
            const versionMatch = vsixFiles[0].match(/(\d+\.\d+\.\d+)\.vsix$/);
            if (versionMatch) {
                const versionedName = `simplebeacon-${versionMatch[1]}.vsix`;
                fs.copyFileSync(latest, path.join(vsixDir, versionedName));
                process.stdout.write(`Copied VSIX ${vsixFiles[0]} → public/downloads/${versionedName}\n`);
            }
            process.stdout.write(`Copied VSIX ${vsixFiles[0]} → public/downloads/simplebeacon.vsix\n`);
        }
    }
} catch (e) {
    console.warn('VSIX copy skipped:', (e && e.message) || e);
}

generateSitemap();

process.stdout.write('Public build complete\n');
