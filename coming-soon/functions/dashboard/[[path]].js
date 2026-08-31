/**
 * Serve the SimpleBeacon dashboard SPA from Cloudflare Pages static assets.
 *
 * Static asset requests (CSS, JS, images, fonts) are passed through to the
 * Pages asset handler. All other /dashboard/* routes return the dashboard
 * entry HTML so the client-side router can render the requested view.
 *
 * Cache-bust version: 20260831attestfix1
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i)) {
        // Intercept old main.js and serve the current build with no-cache headers
        if (pathname.endsWith('/assets/main.js')) {
            // Try hashed filenames first (newest build), fall back to main.js
            const hashedCandidates = [
                '/assets/main-C2YsRA62.js',
            ];
            for (const candidate of hashedCandidates) {
                const newUrl = new URL(pathname.replace('/assets/main.js', candidate), url.origin);
                const newReq = new Request(newUrl.toString(), request);
                const assetResp = await env.ASSETS.fetch(newReq);
                if (assetResp.ok) {
                    const headers = new Headers(assetResp.headers);
                    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                    headers.set('CDN-Cache-Control', 'no-store');
                    headers.set('Surrogate-Control', 'no-store');
                    return new Response(assetResp.body, { status: assetResp.status, headers });
                }
            }
            // Fall back to serving main.js directly with no-cache headers
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
        if (pathname.endsWith('/assets/scan-worker.js') ||
            pathname.endsWith('/assets/scan-worker-v2.js') ||
            pathname.endsWith('/assets/scan-wasm-bridge.js') ||
            pathname.includes('/utils-lib/simplebeaconignore.browser.js')) {
            const assetResp = await env.ASSETS.fetch(request);
            if (assetResp.ok) {
                const headers = new Headers(assetResp.headers);
                headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
                headers.set('CDN-Cache-Control', 'no-store');
                headers.set('Surrogate-Control', 'no-store');
                return new Response(assetResp.body, { status: assetResp.status, headers });
            }
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
    const nonce = `<!-- sb-${Date.now()}-${Math.random().toString(36).slice(2,8)} -->`;
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
    headers.set('X-Deploy-Version', '20260828-v2');
    // When embedded in VS Code (detect via sb_parent_urlbar or sb_website_mode),
    // override frame-ancestors so the webview iframe can load the page.
    if (url.searchParams.has('sb_parent_urlbar') || url.searchParams.has('sb_website_mode')) {
        const csp = headers.get('Content-Security-Policy');
        if (csp) {
            headers.set('Content-Security-Policy', csp.replace(/frame-ancestors\s+'none'\s*;/, 'frame-ancestors *;'));
        }
    }
    return new Response(html, { status: response.status, headers });
}
