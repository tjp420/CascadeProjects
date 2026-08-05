/**
 * Custom-domain bridge for /downloads/* (D-01).
 *
 * pages.dev already serves public/downloads/* as static assets. On
 * simplebeacon.ai a Worker-style text/plain 404 was observed; this
 * middleware proxies those hosts to the live Pages origin without
 * forwarding Host (which would break the origin fetch).
 */
const PAGES_ORIGIN = 'https://simplebeacon.pages.dev';

/**
 * Exact apex + www only (not a wildcard subdomain regex).
 * Wildcarding *.simplebeacon.ai would turn this into an open proxy to pages.dev.
 * Trailing-dot FQDN forms are normalized; pages.dev / *.pages.dev never match.
 */
function isCustomDomain(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'simplebeacon.pages.dev' || host.endsWith('.pages.dev')) {
    return false;
  }
  return host === 'simplebeacon.ai' || host === 'www.simplebeacon.ai';
}

function buildUpstreamHeaders(request) {
  const headers = new Headers();
  const forward = [
    'range',
    'if-range',
    'if-none-match',
    'if-modified-since',
    'user-agent',
    'accept',
    'accept-encoding',
  ];
  for (const name of forward) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (isCustomDomain(url.hostname)) {
    const originUrl = `${PAGES_ORIGIN}${url.pathname}${url.search}`;
    const upstream = await fetch(originUrl, {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      redirect: 'follow',
    });

    const headers = new Headers(upstream.headers);
    if (url.pathname.toLowerCase().endsWith('.vsix')) {
      headers.set('Content-Type', 'application/octet-stream');
    }
    headers.set('X-Proxy-Origin', 'pages-engine-bridge');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  if (env && env.ASSETS) {
    const asset = await env.ASSETS.fetch(request);
    if (asset && asset.ok) return asset;
  }

  return next();
}
