'use strict';

/** Token keys used by audit, dashboard, and pricing sign-in. Marketing nav must check all of them. */
const AUTH_TOKEN_KEYS = [
    'sb_auth_token',
    'sb-token',
    'sb_token',
    'cascadeAuthToken',
    'access_token',
    'token',
    'authToken',
    'simplebeacon_token',
    'sb-token-vault'
];

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function canonicalFor(pageConfig, relPath) {
    if (relPath === 'index.html') return pageConfig.origin + '/';
    return pageConfig.origin + '/' + relPath.replace(/\\/g, '/');
}

function ogImageUrl(pageConfig) {
    const img = pageConfig.ogImage || '';
    if (!img) return '';
    if (img.startsWith('http')) return img;
    return pageConfig.origin + (img.startsWith('/') ? img : '/' + img);
}

/**
 * First-script Cloudflare beacon neutralize.
 * Integrity must be stripped BEFORE src. Removing src while SRI remains
 * hashes empty content (sha512 of "") and logs a console error.
 */
function beaconNeutralizeScript() {
    return `<script data-sb-beacon-neutralize="1">(function(){function isBeacon(el){if(!el||el.tagName!=='SCRIPT')return false;var src=el.src||el.getAttribute('src')||'';var cf=el.getAttribute('data-cf-beacon');return src.indexOf('static.cloudflareinsights.com/beacon.min.js')!==-1||(cf&&cf.length>0)}function neutralize(el){if(!isBeacon(el))return;try{el.removeAttribute('integrity')}catch(e){}try{el.removeAttribute('crossorigin')}catch(e){}try{el.type='text/plain'}catch(e){}try{el.removeAttribute('src')}catch(e){}}var origCreate=document.createElement.bind(document);document.createElement=function(tag){var el=origCreate(tag);if(typeof tag==='string'&&tag.toLowerCase()==='script'){var origSet=el.setAttribute.bind(el);el.setAttribute=function(name,value){var beacon=(typeof value==='string'&&value.indexOf('static.cloudflareinsights.com/beacon.min.js')!==-1)||(typeof el.src==='string'&&el.src.indexOf('static.cloudflareinsights.com/beacon.min.js')!==-1);if(beacon&&(name==='integrity'||name==='crossorigin'))return;if(name==='src'&&typeof value==='string'&&value.indexOf('static.cloudflareinsights.com/beacon.min.js')!==-1){try{el.removeAttribute('integrity')}catch(e){}try{el.removeAttribute('crossorigin')}catch(e){}}return origSet(name,value)}}return el};if(window.MutationObserver){var mo=new MutationObserver(function(records){records.forEach(function(record){if(record.type==='attributes'&&record.target)neutralize(record.target);Array.prototype.forEach.call(record.addedNodes||[],function(node){if(node.nodeType===1){if(node.tagName==='SCRIPT')neutralize(node);if(node.querySelectorAll)Array.prototype.forEach.call(node.querySelectorAll('script'),neutralize)}})})});mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','integrity','crossorigin']})}function sweep(){Array.prototype.forEach.call(document.querySelectorAll('script'),neutralize)}sweep();document.addEventListener('DOMContentLoaded',sweep)})();</script>`;
}

function navAuthScript() {
    const keysLiteral = AUTH_TOKEN_KEYS.map(k => `'${k}'`).join(',');
    return (
        `<script>(function(){var TOKEN_KEYS=[${keysLiteral}];` +
        `var USER_KEYS=['sb_user','sb-user','cascadeAuthUser'];` +
        `var FREE_TIERS=['free','community','sandbox',''];` +
        `function getCookieVal(n){var esc=String(n).replace(/[-/\\\\^$*+?.()|[\\]{}]/g,function(ch){return '\\\\'+ch;});var m=document.cookie.match('(?:^|; )'+esc+'=([^;]*)');return m?decodeURIComponent(m[1]):'';}` +
        `function isJwtExpired(t){try{var parts=t.split('.');if(parts.length!==3)return false;var p=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));return !!(p.exp&&p.exp*1000<Date.now());}catch(_){return false;}}` +
        `function hasAnyToken(){try{for(var i=0;i<TOKEN_KEYS.length;i++){var k=TOKEN_KEYS[i];var v=localStorage.getItem(k)||getCookieVal(k);if(!v)continue;if(isJwtExpired(v)){try{localStorage.removeItem(k);}catch(_){}clearCookie(k);continue;}return true;}}catch(_){}return false;}` +
        `function getUserTier(){try{var u=null;for(var i=0;i<USER_KEYS.length;i++){u=localStorage.getItem(USER_KEYS[i]);if(u)break;}if(!u)return '';var p=JSON.parse(u);var role=String(p.role||'').toLowerCase();if(role==='admin'||role==='superuser')return 'enterprise';return (p.tier||p.plan||'').toLowerCase();}catch(_){}return '';}` +
        `function isPaidTier(){var t=getUserTier();return t&&FREE_TIERS.indexOf(t)===-1;}` +
        `function clearCookie(k){document.cookie=k+'=;path=/;max-age=0;SameSite=Lax;';}` +
        `function updateAuthNav(){var authed=hasAnyToken();var paid=isPaidTier();var signinBtn=document.getElementById('nav-signin-btn');var signoutBtn=document.getElementById('nav-signout-btn');if(signinBtn)signinBtn.style.display=authed?'none':'inline-block';if(signoutBtn)signoutBtn.style.display=authed?'inline-block':'none';var pricingLinks=document.querySelectorAll('.sb-nav-more-link[href="/pricing"]');for(var i=0;i<pricingLinks.length;i++){pricingLinks[i].style.display=paid?'none':'flex';}}` +
        `function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.sb-site-nav a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}` +
        `function initSignout(){var signoutBtn=document.getElementById('nav-signout-btn');if(signoutBtn){signoutBtn.addEventListener('click',function(){for(var i=0;i<TOKEN_KEYS.length;i++){try{localStorage.removeItem(TOKEN_KEYS[i]);}catch(_){}clearCookie(TOKEN_KEYS[i]);}for(var i=0;i<USER_KEYS.length;i++){try{localStorage.removeItem(USER_KEYS[i]);}catch(_){}clearCookie(USER_KEYS[i]);}try{sessionStorage.clear();}catch(_){}window.location.reload();});}}` +
        `function initDropdownClose(){document.addEventListener('click',function(e){var toggle=document.getElementById('sb-nav-more-toggle');if(!toggle||!toggle.checked)return;var wrap=toggle.parentNode;if(wrap&&!wrap.contains(e.target))toggle.checked=false;});document.addEventListener('keydown',function(e){if(e.key==='Escape'){var toggle=document.getElementById('sb-nav-more-toggle');if(toggle)toggle.checked=false;}});}` +
        `function initSignIn(){var signinBtn=document.getElementById('nav-signin-btn');if(!signinBtn)return;signinBtn.addEventListener('click',function(){var overlay=document.getElementById('auth-modal-overlay');if(overlay){overlay.style.display='flex';overlay.classList.add('active');return;}var signinOverlay=document.getElementById('signinOverlay');if(signinOverlay){signinOverlay.style.display='flex';return;}window.location.href='/app/#/signin';});}` +
        `function initStorageSync(){window.addEventListener('storage',function(e){if(e.key===null||(TOKEN_KEYS.indexOf(e.key)!==-1&&!e.newValue)||(USER_KEYS.indexOf(e.key)!==-1&&!e.newValue)){updateAuthNav();}});}` +
        `function init(){updateAuthNav();propagateTokenToLinks();initSignout();initSignIn();initDropdownClose();initStorageSync();}if(document.readyState==='loading'){window.addEventListener('DOMContentLoaded',init);}else{init();}})();</script>`
    );
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
    return `<nav class="sb-site-nav" style="background:#0B0F19;border-bottom:1px solid #1E293B;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:100;box-sizing:border-box;">\n  <a href="/" style="color:#F3F4F6;text-decoration:none;font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>SimpleBeacon</a>\n  <div style="display:flex;align-items:center;gap:4px;">${primaryHtml}\n    <div class="sb-nav-more-wrap">\n      <input type="checkbox" id="sb-nav-more-toggle" class="sb-nav-more-toggle">\n      <label for="sb-nav-more-toggle" class="sb-nav-more-label">More<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sb-nav-more-arrow"><path d="M6 9l6 6 6-6"/></svg></label>\n      <div class="sb-nav-more-menu">\n    ${moreHtml}\n      </div>\n    </div>\n    <button type="button" id="nav-signin-btn" style="display:none;margin-left:10px;padding:6px 14px;background:#6366f1;color:white;font-size:0.85rem;font-weight:600;cursor:pointer;border:none;border-radius:8px;">Sign in</button>\n    <button type="button" id="nav-signout-btn" style="display:none;margin-left:10px;padding:6px 14px;background:transparent;color:#9CA3AF;font-size:0.85rem;font-weight:500;cursor:pointer;border:1px solid #374151;border-radius:8px;">Sign out</button>\n  </div>\n</nav>\n<style>${navCss}</style>\n${navAuthScript()}`;
}

function footerHtml() {
    return `<footer style="background:#0B0F19;border-top:1px solid #1E293B;padding:32px 24px;text-align:center;color:#9CA3AF;font-size:0.85rem;">\n  <p style="margin:0 0 12px;color:#F3F4F6;">&copy; 2026 SimpleBeacon. All rights reserved.</p>\n  <p style="margin:0;">\n    <a href="/sample-report" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Sample report</a> &middot;\n    <a href="/pricing" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Pricing</a> &middot;\n    <a href="/contact" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Contact</a> &middot;\n    <a href="/faq" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">FAQ</a> &middot;\n    <a href="/blog/case-study-ai-slop-1-25m" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Blog</a> &middot;\n    <a href="/roadmap" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Roadmap</a> &middot;\n    <a href="/terms" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Terms</a> &middot;\n    <a href="/privacy" style="color:#9CA3AF;text-decoration:none;margin:0 6px;">Privacy</a>\n  </p>\n</footer>`;
}

function buildHeadBlock(pageConfig, meta, relPath) {
    const canonical = canonicalFor(pageConfig, relPath);
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
    const ogImage = ogImageUrl(pageConfig);
    if (ogImage) lines.push(`    <meta property="og:image" content="${ogImage}">`);
    lines.push(`    <meta name="twitter:card" content="summary">`);
    if (ogTitle) lines.push(`    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">`);
    if (ogDesc) lines.push(`    <meta name="twitter:description" content="${escapeHtml(ogDesc)}">`);
    return lines.join('\n');
}

function transformHtml(html, relPath, pageConfig) {
    const meta = pageConfig.pages[relPath];
    if (!meta) return html;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
    html = html.replace(/<meta[^>]*name=["']description["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*property=["']og:[^"']+["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '');
    html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*name=["']robots["'][^>]*>/gi, '');
    html = html.replace(
        /<link[^>]*rel=["']icon["'][^>]*href=["'][^"']*favicon\.svg["'][^>]*>/gi,
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'
    );
    if (!/<meta[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
        html = html.replace(/<meta[^>]*charset[^>]*>/i, function (match) {
            return match + '\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">';
        });
    }
    const headBlock = buildHeadBlock(pageConfig, meta, relPath);
    html = html.replace(/(<meta[^>]*charset[^>]*>)/i, function (match) {
        return match + '\n' + headBlock + '\n';
    });
    if (!html.includes('data-sb-beacon-neutralize=')) {
        html = html.replace(/(<meta[^>]*charset[^>]*>)/i, function (match) {
            return match + '\n    ' + beaconNeutralizeScript();
        });
    }
    if (meta.h1) {
        if (/<h1[^>]*>/i.test(html)) {
            html = html.replace(/(<h1[^>]*>)[\s\S]*?<\/h1>/i, function (_match, tag) {
                return `${tag}${escapeHtml(meta.h1)}</h1>`;
            });
        } else {
            html = html.replace(/<body[^>]*>/i, function (match) {
                return (
                    match +
                    '\n    <h1 style="text-align:center;margin:24px 0 0;font-size:1.75rem;">' +
                    escapeHtml(meta.h1) +
                    '</h1>'
                );
            });
        }
    }
    if (meta.includeNav && !/<nav\b/i.test(html)) {
        html = html.replace(/<body[^>]*>/i, function (match) {
            return match + '\n' + navHtml();
        });
    }
    if (meta.includeFooter && !/<footer\b/i.test(html)) {
        html = html.replace(/<\/body>/i, function () {
            return footerHtml() + '\n</body>';
        });
    }
    if (meta.includeNav && !/referral-capture\.js/i.test(html)) {
        html = html.replace(/<\/body>/i, function () {
            return '  <script src="/js-es2018/referral-capture.js" defer></script>\n</body>';
        });
    }
    return html;
}

function stripCloudflareBeaconHtml(html) {
    if (!html) return html;
    return html
        .replace(/<script\b[^>]*\bsrc=["'][^"']*static\.cloudflareinsights\.com\/beacon\.min\.js[^"']*["'][^>]*>\s*<\/script>/gi, '')
        .replace(/<script\b[^>]*\bdata-cf-beacon=[^>]*>\s*<\/script>/gi, '');
}

module.exports = {
    AUTH_TOKEN_KEYS,
    escapeHtml,
    beaconNeutralizeScript,
    navAuthScript,
    navHtml,
    footerHtml,
    transformHtml,
    stripCloudflareBeaconHtml
};
