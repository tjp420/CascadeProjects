/**
 * Serve the SimpleBeacon dashboard SPA from Cloudflare Pages static assets.
 *
 * Static asset requests (CSS, JS, images, fonts) are passed through to the
 * Pages asset handler. All other /dashboard/* routes return the dashboard
 * entry HTML so the client-side router can render the requested view.
 *
 * Cache-bust version: auto (timestamp-based)
 *
 * Vite `base` is `/dashboard/` but `outDir` is `assets/`, so dynamic imports
 * request `/dashboard/v2-foo.js` while the file is at `/dashboard/assets/v2-foo.js`.
 * Pages then serves SPA HTML (text/html) and the browser blocks the module.
 */
function dashboardAssetUrl(url) {
    const rewritten = new URL(url);
    if (/^\/dashboard\/(?!assets\/)[^/]+\.(js|mjs|css|map)$/i.test(rewritten.pathname)) {
        rewritten.pathname = rewritten.pathname.replace(/^\/dashboard\//, '/dashboard/assets/');
    }
    return rewritten;
}

function looksLikeHtml(response) {
    const type = (response.headers.get('content-type') || '').toLowerCase();
    return type.includes('text/html');
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i)) {
        const assetUrl = dashboardAssetUrl(url);
        const assetRequest = assetUrl.pathname === url.pathname ? request : new Request(assetUrl.toString(), request);
        // Serve main.js and main.css with no-cache headers to prevent stale edge-cached copies
        if (pathname.endsWith('/assets/main.js') || pathname.endsWith('/assets/main.css')) {
            const assetResp = await env.ASSETS.fetch(request);
            if (assetResp.ok) {
                const headers = new Headers(assetResp.headers);
                headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                headers.set('CDN-Cache-Control', 'no-store');
                headers.set('Surrogate-Control', 'no-store');
                return new Response(assetResp.body, { status: assetResp.status, headers });
            }
        }
        // Serve scan-worker.js and its dependencies with no-cache headers to prevent
        // stale edge-cached copies from breaking the browser-local scan.
        if (
            pathname.endsWith('/assets/scan-worker.js') ||
            pathname.endsWith('/assets/scan-worker-v2.js') ||
            pathname.endsWith('/assets/scan-wasm-bridge.js') ||
            pathname.includes('/utils-lib/simplebeaconignore.browser.js') ||
            pathname.endsWith('/assets/simplebeaconignore.browser.js')
        ) {
            let assetResp = await env.ASSETS.fetch(request);
            if (!assetResp.ok) {
                const fallbacks = {
                    '/dashboard/assets/scan-worker.js': '/dashboard/js-es2018/workers/scan-worker.js',
                    '/dashboard/assets/scan-wasm-bridge.js': '/dashboard/js-es2018/workers/scan-wasm-bridge.js',
                    '/dashboard/assets/simplebeaconignore.browser.js':
                        '/dashboard/js-es2018/utils-lib/simplebeaconignore.browser.js',
                };
                const fallbackPath = fallbacks[pathname];
                if (fallbackPath) {
                    const fallbackUrl = new URL(fallbackPath, url.origin);
                    const fallbackResp = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), { method: 'GET' }));
                    if (fallbackResp.ok) assetResp = fallbackResp;
                }
            }
            if (assetResp.ok) {
                const headers = new Headers(assetResp.headers);
                headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                headers.set('CDN-Cache-Control', 'no-store');
                headers.set('Surrogate-Control', 'no-store');
                headers.set('Content-Type', 'text/javascript; charset=utf-8');
                return new Response(assetResp.body, { status: assetResp.status, headers });
            }
        }
        const assetResp = await env.ASSETS.fetch(assetRequest);
        if (assetResp.ok && !looksLikeHtml(assetResp)) {
            return assetResp;
        }
        if (assetUrl.pathname !== url.pathname) {
            return new Response('Dashboard asset not found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
        return env.ASSETS.fetch(request);
    }

    // Serve SPA entry for /dashboard (no trailing slash) without a redirect so
    // ?sb_api_base=…&sb_notify_base=… query params survive (VS Code embed bridge).
    // Append a cache-bust param to the asset URL so the CDN always fetches the
    // latest index.html instead of serving a stale edge-cached copy.
    const cacheBust = `${Date.now()}`;
    const entryCandidates = ['/dashboard/__entry', '/dashboard/index.html'];
    let response = null;
    for (const entryPath of entryCandidates) {
        const assetUrl = new URL(entryPath, url.origin);
        assetUrl.searchParams.set('_cb', cacheBust);
        const candidate = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        if (candidate.ok) {
            response = candidate;
            break;
        }
    }
    if (!response) {
        return new Response('Dashboard entry not found', { status: 404 });
    }
    // Read the body and inject a dynamic nonce to prevent CDN caching
    let html = await response.text();
    // Inject a unique comment before </head> to bust CDN cache
    const nonce = `<!-- sb-${Date.now()}-${Math.random().toString(36).slice(2, 8)} -->`;
    if (html.includes('</head>')) {
        html = html.replace('</head>', `${nonce}</head>`);
    } else if (html.includes('</body>')) {
        html = html.replace('</body>', `${nonce}</body>`);
    }
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('CDN-Cache-Control', 'no-store, max-age=0');
    headers.set('Surrogate-Control', 'no-store');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('X-Deploy-Version', '20260910-evidence-rc');
    // Force evidence-RC bundle even if a stale entry HTML is edge-cached upstream.
    html = html.replace(
        /\/dashboard\/assets\/main(?:-[A-Za-z0-9_-]+)?\.js(?:\?[^"']*)?/g,
        '/dashboard/assets/main-DFCoPisA.js?v=evidence-rc-20260910'
    );
    let csp = headers.get('Content-Security-Policy') || '';
    html = html
        .replace(/<script\b[^>]*\bsrc=["'][^"']*static\.cloudflareinsights\.com\/beacon\.min\.js[^"']*["'][^>]*>\s*<\/script>/gi, '')
        .replace(/<script\b[^>]*\bdata-cf-beacon=[^>]*>\s*<\/script>/gi, '');
    // When embedded in VS Code (detect via sb_parent_urlbar or sb_website_mode),
    // override frame-ancestors so the webview iframe can load the page.
    if (url.searchParams.has('sb_parent_urlbar') || url.searchParams.has('sb_website_mode')) {
        if (csp) {
            csp = csp.replace(/frame-ancestors\s+'none'\s*;/, 'frame-ancestors *;');
        }
    }
    if (csp) headers.set('Content-Security-Policy', csp);
    return new Response(html, { status: response.status, headers });
}
