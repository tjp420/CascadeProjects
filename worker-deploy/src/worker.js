/**
 * SimpleBeacon Dashboard Worker
 * Serves static assets (landing page + dashboard) and proxies API requests to Render.
 */

const PROD_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' https://simplebeacon.onrender.com https://*.onrender.com http://127.0.0.1:3456 http://localhost:3456 http://127.0.0.1:55000 http://localhost:55000 http://127.0.0.1:3000 http://localhost:3000 http://127.0.0.1:3001 http://localhost:3001 http://127.0.0.1:3002 http://localhost:3002 http://127.0.0.1:4000 http://localhost:4000 http://127.0.0.1:8080 http://localhost:8080 http://127.0.0.1:5000 http://localhost:5000 http://127.0.0.1:38000 http://localhost:38000 http://127.0.0.1:50559 http://localhost:50559 http://127.0.0.1:54358 http://localhost:54358 http://127.0.0.1:55432 http://localhost:55432 http://127.0.0.1:11434 http://localhost:11434; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

function applyCspHeaders(res) {
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    const newRes = new Response(res.body, res);
    // Remove any existing CSP headers (Cloudflare static assets adds its own)
    newRes.headers.delete('Content-Security-Policy');
    newRes.headers.set('Content-Security-Policy', PROD_CSP);
    // Prevent caching of HTML so new deploys are immediately visible
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
      // Try to serve the static asset first
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) {
        return applyCspHeaders(assetRes);
      }
      // SPA fallback: serve dashboard/index.html for client-side routing
      const spaReq = new Request(new URL('/dashboard/index.html', url.origin), request);
      return applyCspHeaders(await env.ASSETS.fetch(spaReq));
    }

    // Clean URL rewrite for marketing pages (e.g. /audit -> /audit.html)
    if (!url.pathname.startsWith('/dashboard') && !url.pathname.includes('.')) {
      let cleanPath = url.pathname;
      if (cleanPath.endsWith('/')) cleanPath = cleanPath.slice(0, -1);
      if (cleanPath) {
        const htmlReq = new Request(new URL(cleanPath + '.html', url.origin), request);
        const htmlRes = await env.ASSETS.fetch(htmlReq);
        if (htmlRes.status === 200) {
          return applyCspHeaders(htmlRes);
        }
      }
    }

    // Serve all other static assets (landing page, etc.)
    const res = await env.ASSETS.fetch(request);
    return applyCspHeaders(res);
  }
};
