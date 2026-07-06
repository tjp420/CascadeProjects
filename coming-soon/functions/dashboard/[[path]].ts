import type { PagesFunction } from '@cloudflare/workers-types';

/**
 * Proxy /dashboard/* requests to the Render backend so the dashboard appears
 * to be served under the same simplebeacon.ai domain.
 *
 * Set BACKEND_URL in the Cloudflare Pages dashboard (e.g. https://simplebeacon.onrender.com).
 */
export const onRequest: PagesFunction<{
  BACKEND_URL?: string;
}> = async (context) => {
  const { request, env, params } = context;
  const backendUrl = env.BACKEND_URL || 'https://simplebeacon.onrender.com';
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path as string) || '';
  const target = new URL(`/dashboard/${path}`, backendUrl.replace(/\/$/, ''));
  target.search = new URL(request.url).search;

  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
  };

  // Forward the original host so the backend can generate correct public URLs
  const headers = init.headers as Headers;
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-Host', new URL(request.url).host);

  try {
    const response = await fetch(target.toString(), init);
    const newHeaders = new Headers(response.headers);
    // Replace backend Set-Cookie Domain with the Pages domain if present
    const cookies = newHeaders.get('set-cookie');
    if (cookies) {
      newHeaders.set('set-cookie', cookies.replace(/Domain=[^;]+;?/gi, ''));
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response(
      `Dashboard backend unavailable: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502, headers: { 'Content-Type': 'text/plain' } }
    );
  }
};
