/**
 * Proxy /api/* requests to the Render backend so the frontend can call the API
 * from the same simplebeacon.ai origin.
 *
 * Set BACKEND_URL in the Cloudflare Pages dashboard (e.g. https://cascadeprojects-yzzd.onrender.com).
 */

/** Allowed CORS origins for API responses. */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(?:[a-z0-9-]+\.)?simplebeacon\.pages\.dev$/,
  /^https:\/\/simplebeacon\.ai$/,
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/,
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/,
];

/** Standard CORS headers for API responses. */
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization,X-Token-Password',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

/**
 * Resolve the Access-Control-Allow-Origin value for a given request origin.
 * @param {string|null} origin
 * @returns {string|null}
 */
function resolveAllowOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return origin;
  return null;
}

/**
 * Build a CORS preflight response (204 No Content).
 * @param {Request} request
 * @returns {Response}
 */
function buildPreflightResponse(request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = resolveAllowOrigin(origin);
  const headers = { ...CORS_HEADERS };
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }
  return new Response(null, { status: 204, headers });
}

/**
 * Add CORS headers to a proxied response.
 * @param {Response} response
 * @param {Request} request
 * @returns {Response}
 */
function withCorsHeaders(response, request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = resolveAllowOrigin(origin);
  if (!allowOrigin) return response;
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', allowOrigin);
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const backendUrl = (env && env.BACKEND_URL) || 'https://cascadeprojects-yzzd.onrender.com';
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');

  // Handle CORS preflight for ALL /api/* paths before _redirects can intercept.
  // Without this, Cloudflare Pages' _redirects proxy returns incomplete CORS
  // headers (missing Access-Control-Allow-Origin) on OPTIONS requests.
  if (request.method === 'OPTIONS') {
    return buildPreflightResponse(request);
  }

  // The VS Code: extension's local data-server /api/notify bridge is not available on the
  // hosted site. Swallow these requests so the dashboard does not log 404s/401s.
  if (path === 'notify' || path.startsWith('notify/')) {
    return new Response(JSON.stringify({ success: true, hosted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const target = new URL(`/api/${path}`, backendUrl.replace(/\/$/, ''));
  target.search = new URL(request.url).search;

  const init = {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
  };

  init.headers.set('X-Forwarded-Proto', 'https');
  init.headers.set('X-Forwarded-Host', new URL(request.url).host);

  try {
    const response = await fetch(target.toString(), init);
    const newHeaders = new Headers(response.headers);
    const cookies = newHeaders.get('set-cookie');
    if (cookies) {
      newHeaders.set('set-cookie', cookies.replace(/Domain=[^;]+;?/gi, ''));
    }
    const proxiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    return withCorsHeaders(proxiedResponse, request);
  } catch (err) {
    return new Response(
      `API backend unavailable: ${err && err.message ? err.message : String(err)}`,
      { status: 502, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}

