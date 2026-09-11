/**
 * Serve the SimpleBeacon /app SPA from Cloudflare Pages static assets.
 *
 * Mirrors functions/dashboard/[[path]].js. Static asset requests pass
 * through to ASSETS; all other /app/* routes return the SPA entry HTML.
 * Uses env.ASSETS.fetch (not same-origin fetch) to avoid recursion.
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i)) {
        if (/^\/app\/(?!assets\/)[^/]+\.(js|mjs|css|map)$/i.test(pathname)) {
            const rewritten = new URL(url);
            rewritten.pathname = pathname.replace(/^\/app\//, '/app/assets/');
            const assetResp = await env.ASSETS.fetch(new Request(rewritten.toString(), request));
            const type = (assetResp.headers.get('content-type') || '').toLowerCase();
            if (assetResp.ok && !type.includes('text/html')) {
                return assetResp;
            }
            return new Response('App asset not found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
        return env.ASSETS.fetch(request);
    }

    const cacheBust = `${Date.now()}`;
    const entryCandidates = ['/app/__entry', '/app/index.html'];
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
        return new Response('App entry not found', { status: 404 });
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Surrogate-Control', 'no-store');
    headers.set('X-SPA-Engine', 'pages-functions-router');

    if (url.searchParams.has('sb_parent_urlbar') || url.searchParams.has('sb_website_mode')) {
        const csp = headers.get('Content-Security-Policy');
        if (csp) {
            headers.set('Content-Security-Policy', csp.replace(/frame-ancestors\s+'none'\s*;/, 'frame-ancestors *;'));
        }
    }

    return new Response(response.body, { status: response.status, headers });
}
