// simplebeacon-ignore: debugArtifacts — dev proxy script uses console.log for request logging
// proxy_local_bridge.js
// Lightweight proxy to forward requests from common dev ports to the main
// ai-platform server on port 58000, injecting CORS and Private Network Access headers.

const http = require('http');
const { URL } = require('url');

const TARGET = process.env.TARGET || 'http://127.0.0.1:58000';
const PORTS = process.env.PORTS ? process.env.PORTS.split(',').map(Number) : [3001, 54358];

function makeHandler(port) {
  return async (req, res) => {
    try {
      // Handle preflight
      if (req.method === 'OPTIONS') {
        const origin = req.headers.origin || '*';
        res.writeHead(204, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type,Accept,Authorization,Access-Control-Request-Private-Network',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Private-Network': 'true',
          'Access-Control-Max-Age': '86400',
        });
        return res.end();
      }

      const url = new URL(req.url, TARGET);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        // Remove host header to avoid mismatches
        if (k.toLowerCase() === 'host') continue;
        headers[k] = v;
      }

      const bodyChunks = [];
      req.on('data', (c) => bodyChunks.push(c));
      await new Promise((r) => req.on('end', r));
      const body = Buffer.concat(bodyChunks);

      const fetchOpts = {
        method: req.method,
        headers,
        body: body.length ? body : undefined,
        redirect: 'manual',
      };

      const out = await fetch(url.toString(), fetchOpts);
      // Copy status
      res.statusCode = out.status;
      // Copy response headers
      out.headers.forEach((v, k) => {
        // Avoid hop-by-hop
        if (['connection', 'keep-alive', 'transfer-encoding'].includes(k.toLowerCase())) return;
        res.setHeader(k, v);
      });

      // Inject CORS + PNA headers for browser requests
      const origin = req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type,Accept,Authorization,Access-Control-Request-Private-Network'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      // Stream body
      const buffer = await out.arrayBuffer();
      res.end(Buffer.from(buffer));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy_error', message: String(err) }));
    }
  };
}

for (const p of PORTS) {
  const server = http.createServer(makeHandler(p));
  server.listen(p, '127.0.0.1', () => {
    console.log(`proxy_local_bridge listening on http://127.0.0.1:${p} -> ${TARGET}`);
  });
  server.on('error', (e) => console.error(`proxy error on ${p}:`, e && e.message));
}

// Keep process alive
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
