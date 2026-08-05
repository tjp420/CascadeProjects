/**
 * Downloads Bypass Worker — D-01
 * Proxies simplebeacon.ai/downloads* to simplebeacon.pages.dev so the
 * custom-domain Worker 404 does not mask the Pages static VSIX.
 */
const PAGES_ORIGIN = 'https://simplebeacon.pages.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/downloads')) {
      return fetch(request);
    }

    const originUrl = PAGES_ORIGIN + url.pathname + url.search;
    const headers = new Headers();
    for (const name of ['range', 'if-range', 'if-none-match', 'if-modified-since', 'user-agent', 'accept', 'accept-encoding']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstream = await fetch(originUrl, {
      method: request.method,
      headers,
      redirect: 'follow',
    });

    const out = new Headers(upstream.headers);
    if (url.pathname.toLowerCase().endsWith('.vsix')) {
      out.set('Content-Type', 'application/octet-stream');
    }
    out.set('X-Proxy-Origin', 'pages-engine-bridge');
    out.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  },
};
