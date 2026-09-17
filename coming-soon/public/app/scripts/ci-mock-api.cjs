// Lightweight CI mock API server for Playwright runs
// Listens on 127.0.0.1:53900, logs requests to mock-api.log (stdout redirected in CI)

const http = require('http');
const url = require('url');
const port = process.env.CI_MOCK_API_PORT || 53900;

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || req.url;
    // simple request logging
    console.log(new Date().toISOString(), req.method, pathname);

    // Common endpoints expected by the dashboard
    if (pathname === '/api/health') {
      return json(res, 200, { ok: true, env: 'mock' });
    }

    if (pathname === '/api/config' || pathname === '/api/config/pricing') {
      return json(res, 200, { pricing: [], features: {}, auth: {sso: false} });
    }

    if (pathname === '/api/auth/providers' || pathname === '/api/auth') {
      return json(res, 200, { providers: ['email'], sso: false });
    }

    if (pathname === '/api/session') {
      // no session in CI
      return json(res, 401, { authenticated: false });
    }

    if (pathname.startsWith('/api/')) {
      return json(res, 200, { mock: true, path: pathname });
    }

    // not an API path, return 404 text
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    console.error('mock-api error', e && e.stack ? e.stack : e);
    res.writeHead(500);
    res.end('error');
  }
});

server.listen(port, '127.0.0.1', () => console.log('Mock API listening on', port));
// Keep process alive
setInterval(() => {}, 1e6);
