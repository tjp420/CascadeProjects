'use strict';
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname);
const dst = path.resolve(__dirname, 'public');

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
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    const primaryLinks = [
        { href: '/audit', label: 'Audit' },
        { href: '/app/', label: 'Dashboard' }
    ];
    const moreLinks = [
        {
            href: '/roadmap',
            label: 'Roadmap',
            icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L9 3'
        },
        { href: '/pricing', label: 'Pricing', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
        {
            href: '/community',
            label: 'Install',
            icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2-8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-7l-2-2z'
        },
        {
            href: '/blog/case-study-ai-slop-1-25m',
            label: 'Blog',
            icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
        },
        {
            href: '/faq',
            label: 'FAQ',
            icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        {
            href: '/contact',
            label: 'Contact',
            icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
        }
    ];
    const primaryStyle =
        'color:#F3F4F6;text-decoration:none;margin-left:14px;font-size:0.9rem;font-weight:600;white-space:nowrap;padding:6px 12px;border-radius:8px;transition:background 0.2s;';
    const primaryHtml = primaryLinks
        .map(
            l =>
                `<a href="${l.href}" style="${primaryStyle}" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">${l.label}</a>`
        )
        .join('');
    const moreHtml = moreLinks
        .map(
            l =>
                `<a href="${l.href}" class="sb-nav-more-link" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#9CA3AF;text-decoration:none;font-size:0.875rem;white-space:nowrap;transition:background 0.15s,color 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.06)';this.style.color='#F3F4F6'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;flex-shrink:0"><path d="${l.icon}"/></svg>${l.label}</a>`
        )
        .join('\n    ');
    const navCss =
        '.iframe-embed .sb-site-nav{display:none!important;}.sb-nav-more-wrap{position:relative;}.sb-nav-more-toggle{display:none;}.sb-nav-more-label{display:flex;align-items:center;gap:6px;margin-left:6px;padding:6px 12px;background:transparent;color:#9CA3AF;font-size:0.9rem;font-weight:600;cursor:pointer;border:1px solid #30363d;border-radius:8px;transition:background 0.2s,color 0.2s;user-select:none;}.sb-nav-more-label:hover{background:rgba(255,255,255,0.06);color:#F3F4F6;}.sb-nav-more-arrow{transition:transform 0.2s;display:inline-block;}.sb-nav-more-menu{display:none;position:absolute;top:calc(100% + 6px);right:0;min-width:200px;background:#111827;border:1px solid #1E293B;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.4);padding:6px;z-index:200;overflow:hidden;}.sb-nav-more-toggle:checked~.sb-nav-more-menu{display:block;}.sb-nav-more-toggle:checked~.sb-nav-more-label .sb-nav-more-arrow{transform:rotate(180deg);}.sb-nav-more-toggle:checked~.sb-nav-more-label{background:rgba(255,255,255,0.06);color:#F3F4F6;}';
    return `<nav class="sb-site-nav" style="background:#0B0F19;border-bottom:1px solid #1E293B;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;box-sizing:border-box;">\n  <a href="/" style="color:#F3F4F6;text-decoration:none;font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>SimpleBeacon</a>\n  <div style="display:flex;align-items:center;gap:4px;">${primaryHtml}\n    <div class="sb-nav-more-wrap">\n      <input type="checkbox" id="sb-nav-more-toggle" class="sb-nav-more-toggle">\n      <label for="sb-nav-more-toggle" class="sb-nav-more-label">More<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sb-nav-more-arrow"><path d="M6 9l6 6 6-6"/></svg></label>\n      <div class="sb-nav-more-menu">\n    ${moreHtml}\n      </div>\n    </div>\n    <button type="button" id="nav-signin-btn" style="display:none;margin-left:10px;padding:6px 14px;background:#6366f1;color:white;font-size:0.85rem;font-weight:600;cursor:pointer;border:none;border-radius:8px;">Sign in</button>\n    <button type="button" id="nav-signout-btn" style="display:none;margin-left:10px;padding:6px 14px;background:transparent;color:#9CA3AF;font-size:0.85rem;font-weight:500;cursor:pointer;border:1px solid #374151;border-radius:8px;">Sign out</button>\n  </div>\n</nav>\n<style>${navCss}</style>\n<script>(function(){var TOKEN_KEYS=['sb_token','cascadeAuthToken','access_token','token','authToken','simplebeacon_token','sb-token-vault'];var USER_KEYS=['sb_user','sb-user','cascadeAuthUser'];var FREE_TIERS=['free','community','sandbox',''];function getCookieVal(n){var m=document.cookie.match('(?:^|; )'+n.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&')+'=([^;]*)');return m?decodeURIComponent(m[1]):'';}function isJwtExpired(t){try{var parts=t.split('.');if(parts.length!==3)return false;var p=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));return !!(p.exp&&p.exp*1000<Date.now());}catch(_){return false;}}function hasAnyToken(){try{for(var i=0;i<TOKEN_KEYS.length;i++){var k=TOKEN_KEYS[i];var v=localStorage.getItem(k)||getCookieVal(k);if(!v)continue;if(isJwtExpired(v)){try{localStorage.removeItem(k);}catch(_){}clearCookie(k);continue;}return true;}}catch(_){}return false;}function getUserTier(){try{var u=null;for(var i=0;i<USER_KEYS.length;i++){u=localStorage.getItem(USER_KEYS[i]);if(u)break;}if(!u)return '';var p=JSON.parse(u);var role=String(p.role||'').toLowerCase();if(role==='admin'||role==='superuser')return 'enterprise';return (p.tier||p.plan||'').toLowerCase();}catch(_){}return '';}function isPaidTier(){var t=getUserTier();return t&&FREE_TIERS.indexOf(t)===-1;}function clearCookie(k){document.cookie=k+'=;path=/;max-age=0;SameSite=Lax;';}function updateAuthNav(){var authed=hasAnyToken();var paid=isPaidTier();var signinBtn=document.getElementById('nav-signin-btn');var signoutBtn=document.getElementById('nav-signout-btn');if(signinBtn)signinBtn.style.display=authed?'none':'inline-block';if(signoutBtn)signoutBtn.style.display=authed?'inline-block':'none';var pricingLinks=document.querySelectorAll('.sb-nav-more-link[href="/pricing"]');for(var i=0;i<pricingLinks.length;i++){pricingLinks[i].style.display=paid?'none':'flex';}}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.sb-site-nav a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}function initSignout(){var signoutBtn=document.getElementById('nav-signout-btn');if(signoutBtn){signoutBtn.addEventListener('click',function(){for(var i=0;i<TOKEN_KEYS.length;i++){try{localStorage.removeItem(TOKEN_KEYS[i]);}catch(_){}clearCookie(TOKEN_KEYS[i]);}for(var i=0;i<USER_KEYS.length;i++){try{localStorage.removeItem(USER_KEYS[i]);}catch(_){}clearCookie(USER_KEYS[i]);}try{sessionStorage.clear();}catch(_){}window.location.reload();});}}function initDropdownClose(){document.addEventListener('click',function(e){var toggle=document.getElementById('sb-nav-more-toggle');if(!toggle||!toggle.checked)return;var wrap=toggle.parentNode;if(wrap&&!wrap.contains(e.target))toggle.checked=false;});document.addEventListener('keydown',function(e){if(e.key==='Escape'){var toggle=document.getElementById('sb-nav-more-toggle');if(toggle)toggle.checked=false;}});}function initSignIn(){var signinBtn=document.getElementById('nav-signin-btn');if(!signinBtn)return;signinBtn.addEventListener('click',function(){var overlay=document.getElementById('auth-modal-overlay');if(overlay){overlay.style.display='flex';overlay.classList.add('active');return;}var signinOverlay=document.getElementById('signinOverlay');if(signinOverlay){signinOverlay.style.display='flex';return;}window.location.href='/app/#/signin';});}function initStorageSync(){window.addEventListener('storage',function(e){if(e.key===null||(TOKEN_KEYS.indexOf(e.key)!==-1&&!e.newValue)||(USER_KEYS.indexOf(e.key)!==-1&&!e.newValue)){updateAuthNav();}});}function init(){updateAuthNav();propagateTokenToLinks();initSignout();initSignIn();initDropdownClose();initStorageSync();}if(document.readyState==='loading'){window.addEventListener('DOMContentLoaded',init);}else{init();}})();</script>`;
}
function footerHtml() {
    return `<footer style="background:#0B0F19;border-top:1px solid #1E293B;padding:32px 24px;text-align:center;color:#9CA3AF;font-size:0.85rem;">\n  <p style="margin:0 0 12px;color:#F3F4F6;">&copy; 2026 SimpleBeacon. All rights reserved.</p>\n  <p style="margin:0;">\n    <a href="/sample-report" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Sample report</a> &middot;\n    <a href="/pricing" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Pricing</a> &middot;\n    <a href="/contact" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Contact</a> &middot;\n    <a href="/faq" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">FAQ</a> &middot;\n    <a href="/blog/case-study-ai-slop-1-25m" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Blog</a> &middot;\n    <a href="/roadmap" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Roadmap</a> &middot;\n    <a href="/terms" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Terms</a> &middot;\n    <a href="/privacy" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Privacy</a>\n  </p>\n</footer>`;
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
    html = html.replace(
        /<link[^>]*rel=["']icon["'][^>]*href=["'][^"']*favicon\.svg["'][^>]*>/gi,
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
    );
    // Ensure viewport
    if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
        html = html.replace(
            /<meta[^>]*charset[^>]*>/i,
            '$&\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">'
        );
    }
    // Inject fresh head block immediately after charset so title/description appear early
    const headBlock = buildHeadBlock(meta, relPath);
    html = html.replace(/(<meta[^>]*charset[^>]*>)/i, match => match + '\n' + headBlock + '\n');
    // H1
    if (meta.h1) {
        if (/<h1[^>]*>/i.test(html)) {
            html = html.replace(/(<h1[^>]*>)[\s\S]*?<\/h1>/i, (match, tag) => `${tag}${escapeHtml(meta.h1)}</h1>`);
        } else {
            html = html.replace(
                /<body[^>]*>/i,
                '$&\n    <h1 style="text-align:center;margin:24px 0 0;font-size:1.75rem;">' +
                    escapeHtml(meta.h1) +
                    '</h1>'
            );
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
    // Referral attribution capture on marketing pages
    if (meta.includeNav && !/referral-capture\.js/i.test(html)) {
        html = html.replace(/<\/body>/i, '  <script src="/js-es2018/referral-capture.js" defer></script>\n</body>');
    }
    return html;
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

const minimalAuthJs = `(function(){'use strict';var TOKEN_KEYS=['sb_token','cascadeAuthToken','cascadeAuthUser','access_token','token','authToken','simplebeacon_token','sb-token-vault'];var USER_KEYS=['sb_user','sb-user','cascadeAuthUser'];function clearLocalStorageItems(keys){try{for(var i=0;i<keys.length;i++){localStorage.removeItem(keys[i]);}}catch(_){}}function clearCookies(keys){try{for(var i=0;i<keys.length;i++){document.cookie=keys[i]+'=;path=/;max-age=0;SameSite=Lax;';}}catch(_){}}function signOut(){clearLocalStorageItems(TOKEN_KEYS);clearLocalStorageItems(USER_KEYS);clearCookies(TOKEN_KEYS);try{sessionStorage.clear();}catch(_){}window.location.reload();}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.nav-links a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}window.SbAuth={signOut:signOut,propagateTokenToLinks:propagateTokenToLinks};})();`; // simplebeacon-ignore credential-pattern — generated auth JS template, token key names not secrets

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

    // Vite produces hashed filenames (main-[hash].js) but index.html references
    // the unhashed name (main.js). Copy the hashed file to the unhashed name so
    // the HTML reference resolves correctly. Also copy source maps so browser
    // devtools can resolve the source map reference in the unhashed alias.
    const assetsDir = path.join(dashboardDst, 'assets');
    if (fs.existsSync(assetsDir)) {
        const hashedMainJs = fs.readdirSync(assetsDir).find(f => /^main-[a-zA-Z0-9_-]+\.js$/.test(f));
        if (hashedMainJs) {
            fs.copyFileSync(path.join(assetsDir, hashedMainJs), path.join(assetsDir, 'main.js'));
            console.log(`Copied ${hashedMainJs} → main.js (unhashed alias for index.html)`);
            // Copy the source map too so devtools doesn't 404 on main.js.map
            const hashedMapJs = hashedMainJs + '.map';
            if (fs.existsSync(path.join(assetsDir, hashedMapJs))) {
                fs.copyFileSync(path.join(assetsDir, hashedMapJs), path.join(assetsDir, 'main.js.map'));
                console.log(`Copied ${hashedMapJs} → main.js.map (source map alias)`);
            }
        }
        const hashedMainCss = fs.readdirSync(assetsDir).find(f => /^main-[a-zA-Z0-9_-]+\.css$/.test(f));
        if (hashedMainCss) {
            fs.copyFileSync(path.join(assetsDir, hashedMainCss), path.join(assetsDir, 'main.css'));
            console.log(`Copied ${hashedMainCss} → main.css (unhashed alias for index.html)`);
        }

        // Copy scan-worker.js and its dependencies from pages-publish/assets
        // (Vite doesn't bundle these — they're loaded dynamically as Web Workers)
        const pagesPublishAssets = path.join(dashboardSrc, 'pages-publish', 'assets');
        const workerFiles = [
            'scan-worker.js',
            'scan-wasm-bridge.js',
            'simplebeaconignore.browser.js',
        ];
        for (const wf of workerFiles) {
            const src1 = path.join(pagesPublishAssets, wf);
            const dst1 = path.join(assetsDir, wf);
            if (fs.existsSync(src1)) {
                fs.copyFileSync(src1, dst1);
                console.log(`Copied ${wf} → assets/${wf} (web worker)`);
            } else {
                // Fallback: try js-es2018/workers/
                const altSrc = path.join(dashboardSrc, 'js-es2018', 'workers', wf);
                if (fs.existsSync(altSrc)) {
                    fs.copyFileSync(altSrc, dst1);
                    console.log(`Copied ${wf} → assets/${wf} (from js-es2018/workers)`);
                }
            }
        }
    }

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
        // Rewrite production asset paths with cache-bust query parameter.
        // Match both absolute (/assets/...), /dashboard/assets/..., and relative (./assets/...) paths.
        const cacheBust = Date.now();
        dashHtml = dashHtml.replace(
            /href="\.?\/?assets\/main\.css(?:\?[^"]*)?"/g,
            `href="/dashboard/assets/main.css?v=${cacheBust}"`
        );
        dashHtml = dashHtml.replace(
            /src="\.?\/?assets\/main\.js(?:\?[^"]*)?"/g,
            `src="/dashboard/assets/main.js?v=${cacheBust}"`
        );
        dashHtml = dashHtml.replace(
            /src="\/dashboard\/assets\/main\.js(?:\?[^"]*)?"/g,
            `src="/dashboard/assets/main.js?v=${cacheBust}"`
        );
        // Also handle any leftover Vite dev script references
        dashHtml = dashHtml.replace(
            /<script type="module" src="\/src\/main\.tsx"><\/script>/,
            `<script type="module" src="/dashboard/assets/main.js?v=${cacheBust}"></script>`
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
    // and add cache-bust so the CDN fetches fresh assets
    const appIndex = path.join(appDst, 'index.html');
    const appEntry = path.join(appDst, '__entry');
    if (fs.existsSync(appIndex)) {
        let appHtml = fs.readFileSync(appIndex, 'utf8');
        appHtml = appHtml.replace(/\/dashboard\//g, '/app/');
        // Add cache-bust to /app/ asset references (same as /dashboard/ above)
        const appCacheBust = Date.now();
        appHtml = appHtml.replace(
            /src="\/app\/assets\/main\.js(?:\?[^"]*)?"/g,
            `src="/app/assets/main.js?v=${appCacheBust}"`
        );
        appHtml = appHtml.replace(
            /href="\/app\/assets\/main\.css(?:\?[^"]*)?"/g,
            `href="/app/assets/main.css?v=${appCacheBust}"`
        );
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

    // Also copy dashboard to /d2/ — a fresh CDN path that bypasses stuck cache on
    // both /dashboard/ and /app/. Use this URL when the CDN can't be purged.
    const d2Dst = path.join(dst, 'd2');
    removeDirSafe(d2Dst);
    fs.mkdirSync(d2Dst, { recursive: true });
    copyRecursive(dashboardDst, d2Dst, 'd2/');
    const d2Index = path.join(d2Dst, 'index.html');
    const d2Entry = path.join(d2Dst, '__entry');
    if (fs.existsSync(d2Index)) {
        let d2Html = fs.readFileSync(d2Index, 'utf8');
        d2Html = d2Html.replace(/\/dashboard\//g, '/d2/');
        const d2CacheBust = Date.now();
        d2Html = d2Html.replace(
            /src="\/d2\/assets\/main\.js(?:\?[^"]*)?"/g,
            `src="/d2/assets/main.js?v=${d2CacheBust}"`
        );
        d2Html = d2Html.replace(
            /href="\/d2\/assets\/main\.css(?:\?[^"]*)?"/g,
            `href="/d2/assets/main.css?v=${d2CacheBust}"`
        );
        try {
            fs.writeFileSync(d2Index, d2Html, 'utf8');
        } catch (e) {
            console.warn('Skipping write of d2/index.html:', (e && e.message) || e);
        }
        try {
            fs.copyFileSync(d2Index, d2Entry);
        } catch (e) {
            console.warn('Skipping copy of d2/__entry:', (e && e.message) || e);
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
