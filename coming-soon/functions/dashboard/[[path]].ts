/**
 * Serve the SimpleBeacon dashboard SPA from Cloudflare Pages static assets.
 *
 * Static asset requests (CSS, JS, images, fonts) are passed through to the
 * Pages asset handler. All other /dashboard/* routes return the dashboard
 * entry HTML so the client-side router can render the requested view.
 */
export const onRequest = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Pass static dashboard assets straight through to the asset handler.
  if (pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i)) {
    let assetResponse = await env.ASSETS.fetch(request);
    if (!assetResponse.ok && /\/assets\/js\/.+\.js$/i.test(pathname)) {
      const altUrl = new URL(pathname.replace('/assets/js/', '/assets/'), url.origin);
      assetResponse = await env.ASSETS.fetch(new Request(altUrl.toString(), request));
    }
    if (!assetResponse.ok && /\.js$/i.test(pathname)) {
      return new Response(`/* SimpleBeacon: missing asset ${pathname} — hard-refresh the dashboard */`, {
        status: 404,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return assetResponse;
  }

  // Serve the dashboard SPA for every other /dashboard/* route.
  // Use the duplicated __entry file (no extension) so Cloudflare does not strip the
  // extension and redirect, and force the response Content-Type to text/html.
  // Serve SPA entry for /dashboard (no trailing slash) without a redirect so
  // ?sb_api_base=…&sb_notify_base=… query params survive (VS Code embed bridge).
  const entryCandidates = ['/dashboard/__entry', '/dashboard/index.html'];
  let response: Response | null = null;
  for (const entryPath of entryCandidates) {
    const assetUrl = new URL(entryPath, url.origin);
    const candidate = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    if (candidate.ok) {
      response = candidate;
      break;
    }
  }
  if (!response) {
    return new Response('Dashboard entry not found', { status: 404 });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Surrogate-Control', 'no-store');
  if (url.searchParams.has('sb_parent_urlbar') || url.searchParams.has('sb_website_mode')) {
    const csp = headers.get('Content-Security-Policy');
    if (csp) {
      headers.set('Content-Security-Policy', csp.replace(/frame-ancestors\s+'none'\s*;/, "frame-ancestors *;"));
    }
  }
  return new Response(response.body, { status: response.status, headers });
};
