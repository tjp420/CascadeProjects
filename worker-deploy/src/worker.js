/**
 * SimpleBeacon Dashboard Worker
 * Serves static assets (landing page + dashboard) and proxies API requests to Render.
 */

// simplebeacon-ignore SECURITY_HEADER_PATTERN

// Minimal default CSP. In production, inject a stricter policy via the `PROD_CSP` binding.
const DEFAULT_CSP = "default-src 'self';";

const HSTS_MAX_AGE_SECONDS = 31536000; // 1 year — standard HSTS duration

function applyCspHeaders(res, prodCsp) {
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    const newRes = new Response(res.body, res);
    // Avoid removing existing security headers. Only set headers if missing.
    // simplebeacon-ignore security-header-pattern — intentionally set headers only when missing to avoid duplicate headers from hosting/edge layers
    const existingCsp = newRes.headers.get('Content-Security-Policy');
    if (!existingCsp) newRes.headers.set('Content-Security-Policy', prodCsp || DEFAULT_CSP);
    if (!newRes.headers.get('X-Frame-Options')) newRes.headers.set('X-Frame-Options', 'DENY');
    if (!newRes.headers.get('X-Content-Type-Options')) newRes.headers.set('X-Content-Type-Options', 'nosniff');
    if (!newRes.headers.get('Strict-Transport-Security')) newRes.headers.set('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload`);
    if (!newRes.headers.get('Referrer-Policy')) newRes.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return newRes;
  }
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Allow overriding CSP via environment binding `PROD_CSP`.
    const PROD_CSP = env && env.PROD_CSP ? env.PROD_CSP : DEFAULT_CSP;

    // Proxy API requests to the Render backend
    if (url.pathname.startsWith('/api/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Token-Password',
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
        newRes.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Token-Password');
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
        return applyCspHeaders(assetRes, PROD_CSP);
      }
      // No file extension — SPA route, serve dashboard/index.html
      const spaReq = new Request(new URL('/dashboard/index.html', url.origin), request);
      return applyCspHeaders(await env.ASSETS.fetch(spaReq), PROD_CSP);
    }

    // Clean URL rewrite for marketing pages (e.g. /audit -> /audit.html)
    if (!url.pathname.startsWith('/dashboard') && !url.pathname.includes('.')) {
      let cleanPath = url.pathname;
      if (cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
      if (cleanPath) {
        const htmlReq = new Request(new URL(cleanPath + '.html', url.origin), request);
        const htmlRes = await env.ASSETS.fetch(htmlReq);
        if (htmlRes.status === 200) {
          return applyCspHeaders(htmlRes, PROD_CSP);
        }
      }
    }

    // Serve all other static assets (landing page, etc.)
    const res = await env.ASSETS.fetch(request);
    return applyCspHeaders(res, PROD_CSP);
  }
};
