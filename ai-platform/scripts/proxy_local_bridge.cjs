// simplebeacon-ignore: debugArtifacts — dev proxy script uses console.log for request logging
// proxy_local_bridge.cjs
// Lightweight proxy to forward requests from common dev ports to the main
// ai-platform server on port 58000, injecting CORS and Private Network Access headers.

const http = require('http');
const { URL } = require('url');

const TARGET = process.env.TARGET || 'http://127.0.0.1:58000';
const PORTS = process.env.PORTS ? process.env.PORTS.split(',').map(Number) : [3001,54358];

const GLOBAL_DEBUG = process.env.PROXY_DEBUG === '1';

function reqDebug(enabled, ...args) {
  if (!enabled) return;
  try { console.log.apply(console, args); } catch (e) {}
}

function makeHandler(port) {
  return async (req, res) => {
    try {
      const perReqDebug = GLOBAL_DEBUG || req.headers['x-sb-debug'] === '1';
      reqDebug(perReqDebug, '[proxy] incoming', req.method, req.url, req.headers && { host: req.headers.host, origin: req.headers.origin, 'x-sb-debug': req.headers['x-sb-debug'] });
      // Handle preflight
      if (req.method === 'OPTIONS') {
        const origin = req.headers.origin || '*';
        res.writeHead(204, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization,Access-Control-Request-Private-Network',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Private-Network': 'true',
          'Access-Control-Max-Age': '86400'
        });
        return res.end();
      }

      const url = new URL(req.url, TARGET);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() === 'host') continue;
        headers[k] = v;
      }

      const bodyChunks = [];
      req.on('data', c => bodyChunks.push(c));
      await new Promise(r => req.on('end', r));
      const body = Buffer.concat(bodyChunks);

      reqDebug(perReqDebug, '[proxy] forward to target', { hostname: url.hostname, port: url.port || 80, path: url.pathname + (url.search || ''), method: req.method, headersCount: Object.keys(headers).length, bodyLength: body.length });

      // Use native http.request to avoid intermittent global fetch ECONNREFUSED
      const opts = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + (url.search || ''),
        method: req.method,
        headers
      };

      const proxyReq = http.request(opts, targetRes => {
        reqDebug(perReqDebug, '[proxy] upstream response', { statusCode: targetRes.statusCode, headers: targetRes.headers });
        res.statusCode = targetRes.statusCode;
        // Copy response headers except hop-by-hop
        for (const [k, v] of Object.entries(targetRes.headers)) {
          if (['connection','keep-alive','transfer-encoding','content-encoding'].includes(k.toLowerCase())) continue;
          try { res.setHeader(k, v); } catch (e) {}
        }

        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization,Access-Control-Request-Private-Network');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        targetRes.pipe(res);
      });

      proxyReq.on('error', err => {
        reqDebug(perReqDebug, '[proxy] upstream error', String(err), err && err.stack);
        res.writeHead(502, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'proxy_error', message: String(err) }));
      });

      if (body.length) proxyReq.write(body);
      proxyReq.end();
    } catch (err) {
      console.error('[proxy] handler error', err && err.stack || String(err));
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'proxy_error', message: String(err) }));
    }
  };
}

for (const p of PORTS) {
  const server = http.createServer(makeHandler(p));
  server.listen(p, '127.0.0.1', () => {
    console.log(`proxy_local_bridge listening on http://127.0.0.1:${p} -> ${TARGET}`);
  });
  server.on('error', e => console.error(`proxy error on ${p}:`, e && e.message));
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
