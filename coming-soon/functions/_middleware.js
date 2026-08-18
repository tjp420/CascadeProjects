/**
 * Cloudflare Pages middleware — sets sb_ref cookie on ?ref= visits and
 * records attribution via the proxied backend API.
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');
  const response = await next();

  if (!ref) return response;

  const headers = new Headers(response.headers);
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 30);
  headers.append(
    'Set-Cookie',
    `sb_ref=${encodeURIComponent(ref)}; Path=/; Expires=${expirationDate.toUTCString()}; HttpOnly; Secure; SameSite=Lax`
  );

  const backendUrl = (env && env.BACKEND_URL) || 'https://simplebeacon.onrender.com';
  const captureUrl = new URL('/api/referral/capture', backendUrl.replace(/\/$/, ''));
  context.waitUntil(
    fetch(captureUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Forwarded-Proto': 'https'
      },
      body: JSON.stringify({ ref, channel: 'web' })
    }).catch(() => {})
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
