/**
 * SimpleBeacon Dashboard Worker
 * Serves static assets (landing page + dashboard) and proxies API requests to Render.
 */

// Default CSP used only when no environment override is provided. Prefer setting
// `PROD_CSP` as an environment binding for each deployment to avoid config-drift.
const DEFAULT_CSP = "default-src 'self'; frame-ancestors 'none'; base-uri 'self';";

const HSTS_MAX_AGE_SECONDS = 31536000; // 1 year — standard HSTS duration

function applyCspHeaders(res, prodCsp) {
  prodCsp = prodCsp || DEFAULT_CSP;
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    const newRes = new Response(res.body, res);
    // Always set CSP idempotently from configured binding or the default.
    newRes.headers.set('Content-Security-Policy', prodCsp);
    newRes.headers.set('X-Frame-Options', 'DENY');
    newRes.headers.set('X-Content-Type-Options', 'nosniff');
    newRes.headers.set('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload`);
    newRes.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Prevent caching of HTML so new deploys are immediately visible
    newRes.headers.set('Cache-Control', 'no-cache, no-transform');
    return newRes;
  }
  // Also prevent caching of JS modules so cache-bust version changes take effect immediately
  if (contentType.includes('javascript') || contentType.includes('module')) {
    const newRes = new Response(res.body, res);
    newRes.headers.set('Cache-Control', 'no-cache, no-transform');
    return newRes;
  }
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy API requests to the Render backend
    if (url.pathname.startsWith('/api/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      const backendUrl = new URL(url.pathname + url.search, env.API_BACKEND);
      const proxyReq = new Request(backendUrl, request);
      try {
        const res = await fetch(proxyReq);
        const newRes = new Response(res.body, res);
        newRes.headers.set('Access-Control-Allow-Origin', '*');
        newRes.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        newRes.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        newRes.headers.set('Cache-Control', 'no-store');
        return newRes;
      } catch (err) {
        return new Response(JSON.stringify({ error: 'API backend unavailable', message: 'The Render backend is currently offline. Please try again later.' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
        });
      }
    }

    // Dashboard SPA: serve dashboard/index.html for /dashboard/* paths that don't match a static file
    if (url.pathname.startsWith('/dashboard')) {
      // Check if this looks like a static asset (has a file extension)
      const lastSegment = url.pathname.split('/').pop() || '';
      const hasExtension = lastSegment.includes('.') && !lastSegment.endsWith('/');
      if (hasExtension) {
        // Static asset — serve directly
        const assetRes = await env.ASSETS.fetch(request);
        return applyCspHeaders(assetRes, env.PROD_CSP);
      }
      // No file extension — SPA route, serve dashboard/index.html
      const spaReq = new Request(new URL('/dashboard/index.html', url.origin), request);
      return applyCspHeaders(await env.ASSETS.fetch(spaReq), env.PROD_CSP);
    }

    // Clean URL rewrite for marketing pages (e.g. /audit -> /audit.html)
    if (!url.pathname.startsWith('/dashboard') && !url.pathname.includes('.')) {
      let cleanPath = url.pathname;
      if (cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
      if (cleanPath) {
        const htmlReq = new Request(new URL(cleanPath + '.html', url.origin), request);
        const htmlRes = await env.ASSETS.fetch(htmlReq);
        if (htmlRes.status === 200) {
            return applyCspHeaders(htmlRes, env.PROD_CSP);
          }
      }
    }

    // Serve all other static assets (landing page, etc.)
    const res = await env.ASSETS.fetch(request);
    return applyCspHeaders(res, env.PROD_CSP);
  }
};
