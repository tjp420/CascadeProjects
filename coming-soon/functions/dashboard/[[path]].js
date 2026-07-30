/**
 * Serve the SimpleBeacon dashboard SPA from Cloudflare Pages static assets.
 *
 * Static asset requests (CSS, JS, images, fonts) are passed through to the
 * Pages asset handler. All other /dashboard/* routes return the dashboard
 * entry HTML so the client-side router can render the requested view.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.match(/\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest|wasm)$/i)) {
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
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Surrogate-Control', 'no-store');
  // When embedded in VS Code (detect via sb_parent_urlbar or sb_website_mode),
  // override frame-ancestors so the webview iframe can load the page.
  if (url.searchParams.has('sb_parent_urlbar') || url.searchParams.has('sb_website_mode')) {
    const csp = headers.get('Content-Security-Policy');
    if (csp) {
      headers.set('Content-Security-Policy', csp.replace(/frame-ancestors\s+'none'\s*;/, "frame-ancestors *;"));
    }
  }
  return new Response(response.body, { status: response.status, headers });
}
