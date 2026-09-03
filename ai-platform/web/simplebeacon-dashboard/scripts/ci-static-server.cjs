const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || process.argv[2] || 61455;
// Prefer dist but fall back to assets (vite config uses outDir: 'assets')
const candidates = [
  path.resolve(__dirname, '..', 'dist'),
  path.resolve(__dirname, '..', 'assets')
];
let root = candidates.find(p => {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}) || path.resolve(__dirname, '..', 'dist');
let indexPath = path.join(root, 'index.html');
// If index.html isn't in the detected outDir, also try the project root (some builds emit index.html to project root)
if (!fs.existsSync(indexPath)) {
  const projectRoot = path.resolve(__dirname, '..');
  const projectIndex = path.join(projectRoot, 'index.html');
  if (fs.existsSync(projectIndex)) {
    console.log('index.html not found in outDir; falling back to project root index.html at', projectIndex);
    root = projectRoot;
    indexPath = projectIndex;
  }
}
console.log('CI static server root:', root);

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/octet-stream',
  '.wasm': 'application/wasm'
};

// Configure API proxy target (the CI mock API listens on this host:port)
const API_PROXY_HOST = '127.0.0.1';
const API_PROXY_PORT = process.env.CI_MOCK_API_PORT || 53900;

function proxyRequest(req, res, targetHost, targetPort) {
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  const proxy = http.request(options, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res, { end: true });
  });
  proxy.on('error', (err) => {
    console.error('[PROXY] error proxying to %s:%s %s', targetHost, targetPort, err && err.stack ? err.stack : err);
    try { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Bad gateway'); } catch (__) {}
  });
  // Pipe request body
  req.pipe(proxy, { end: true });
}

const server = http.createServer((req, res) => {
  try {
    const baseUrl = new URL(req.url, 'http://localhost');
    let urlPath = decodeURIComponent(baseUrl.pathname);

    // If the request appears to be an API call, proxy it to the CI mock API so
    // the frontend can fetch JSON from the same origin in CI without modifying
    // application code. This mirrors the dev server proxy used locally.
    if (urlPath.startsWith('/api')) {
      console.log('[PROXY] %s %s -> proxy to %s:%s', req.method, urlPath, API_PROXY_HOST, API_PROXY_PORT);
      return proxyRequest(req, res, API_PROXY_HOST, API_PROXY_PORT);
    }

    // Strip the Vite base prefix ('/dashboard/') so that asset requests
    // like /dashboard/assets/index-[hash].js resolve to <root>/assets/index-[hash].js
    // instead of <root>/dashboard/assets/index-[hash].js (which misses and
    // triggers an incorrect text/html SPA fallback for a .js module).
    const BASE_PREFIX = '/dashboard/';
    if (urlPath.startsWith(BASE_PREFIX)) {
      urlPath = urlPath.slice(BASE_PREFIX.length);
    } else if (urlPath === '/dashboard') {
      urlPath = '/';
    }

    // normalize and prevent path traversal
    let filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      console.log('[HTTP] %s %s -> 403 (forbidden)', req.method, urlPath);
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        console.log('[HTTP] %s %s -> 200 (file)', req.method, urlPath);
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Only SPA-fallback for extensionless routes (e.g. /signin, /reports/123).
      // Requests for files with extensions that are missing must return 404
      // so the browser does not interpret an HTML payload as JavaScript
      // (which triggers "Expected a JavaScript-or-Wasm module script" errors).
      const ext = path.extname(urlPath).toLowerCase();
      if (ext) {
        console.log('[HTTP] %s %s -> 404 (missing file with extension)', req.method, urlPath);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }

      // SPA fallback to index.html for client-side routes
      fs.readFile(indexPath, (rerr, data) => {
        if (rerr) {
          console.error('[HTTP] %s %s -> 500 (index read error)', req.method, urlPath, rerr && rerr.stack ? rerr.stack : rerr);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('index.html not found');
        }
        console.log('[HTTP] %s %s -> 200 (index fallback)', req.method, urlPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });
  } catch (e) {
    console.error('ci-static-server error', e && e.stack ? e.stack : e);
    try { res.writeHead(500); res.end('error'); } catch (__) {}
  }
});

server.listen(port, '127.0.0.1', () => console.log('CI static server listening on', port));

// keep process alive
setInterval(() => {}, 1e6);
