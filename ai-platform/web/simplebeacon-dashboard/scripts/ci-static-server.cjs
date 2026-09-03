const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || process.argv[2] || 61455;
const root = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(root, 'index.html');

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
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // SPA fallback to index.html
      fs.readFile(indexPath, (rerr, data) => {
        if (rerr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('index.html not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });
  } catch (e) {
    console.error('ci-static-server error', e);
    try { res.writeHead(500); res.end('error'); } catch (__) {}
  }
});

server.listen(port, '127.0.0.1', () => console.log('CI static server listening on', port));

// keep process alive
setInterval(() => {}, 1e6);
