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

const server = http.createServer((req, res) => {
  try {
    const baseUrl = new URL(req.url, 'http://localhost');
    let urlPath = decodeURIComponent(baseUrl.pathname);
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

      // SPA fallback to index.html
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
