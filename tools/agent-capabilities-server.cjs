#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { loadPlugins } = require(path.join(__dirname, '..', 'ai-agent', 'plugins.cjs'));

const PORT = process.env.AGENT_CAPABILITIES_PORT ? parseInt(process.env.AGENT_CAPABILITIES_PORT, 10) : 3007;

function buildFakeApi() {
  const capabilities = [];
  const pluginsMeta = [];
  const handlers = [];
  return {
    registerCapability: (c) => { capabilities.push(c); },
    registerPlugin: (m) => { pluginsMeta.push(m); },
    sandbox: { writeTemp: () => null },
    debug: () => {},
    on: (ev, fn, opts = {}) => {
      handlers.push({ ev, fnName: fn && fn.name, opts: Object.assign({}, opts), failures: 0, trippedUntil: 0 });
    },
    off: (ev, fn) => {
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i].ev === ev && (!fn || handlers[i].fnName === (fn && fn.name))) handlers.splice(i, 1);
      }
    },
    emit: () => {},
    _collect: () => ({ capabilities: capabilities.slice(), plugins: pluginsMeta.slice(), handlers: handlers.slice() })
  };
}

function requestHandler(req, res) {
  return (async () => {
    if (req.method === 'GET' && req.url && req.url.startsWith('/capabilities')) {
      try {
        // If METRICS_AUTH_TOKEN is set, require Authorization: Bearer <token>
        const expected = process.env.METRICS_AUTH_TOKEN;
        if (expected) {
          const auth = req.headers['authorization'] || '';
          if (!auth.startsWith('Bearer ') || auth.slice(7) !== expected) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized' }));
            return;
          }
        }
        const fake = buildFakeApi();
        const pluginDir = path.join(__dirname, '..', 'ai-agent', 'plugins');
        try { loadPlugins(pluginDir, fake); } catch (e) { /* continue */ }
        const out = fake._collect();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out, null, 2));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
    // metrics endpoint to inspect handler state and circuit trips
    if (req.method === 'GET' && req.url && req.url.startsWith('/metrics')) {
      try {
        const u = new URL(req.url, `http://${req.headers.host}`);
        const format = u.searchParams.get('format') || (req.headers.accept && req.headers.accept.includes('text/plain') ? 'prometheus' : 'json');
        const runtime = u.searchParams.get('runtime') === '1' || process.env.AGENT_RUNTIME_METRICS_TARGET;

        let handlers = null;
        if (runtime) {
          // try fetching runtime metrics from a running agent
          const target = process.env.AGENT_RUNTIME_METRICS_TARGET || u.searchParams.get('target') || 'http://localhost:3008/runtime-metrics';
          try {
            handlers = await new Promise((resolve, reject) => {
              const httpLib = target.startsWith('https') ? require('https') : require('http');
              const opts = new URL(target);
              // forward auth token if present
              const authToken = process.env.METRICS_AUTH_TOKEN;
              const requestOpts = { hostname: opts.hostname, port: opts.port, path: opts.pathname + (opts.search || ''), method: 'GET', headers: {} };
              if (authToken) requestOpts.headers['Authorization'] = 'Bearer ' + authToken;
              httpLib.get(requestOpts, (r) => {
                let buf = '';
                r.setEncoding('utf8');
                r.on('data', (c) => buf += c);
                r.on('end', () => {
                  try { const j = JSON.parse(buf); resolve(j.handlers || []); } catch (e) { reject(e); }
                });
              }).on('error', reject).end();
            });
          } catch (e) {
            // fall back to fake
            handlers = null;
          }
        }

        if (!handlers) {
          const fake = buildFakeApi();
          const pluginDir = path.join(__dirname, '..', 'ai-agent', 'plugins');
          try { loadPlugins(pluginDir, fake); } catch (e) { /* continue */ }
          handlers = fake._collect().handlers;
        }

        if (format === 'prometheus') {
          // produce simple Prometheus exposition
          const lines = [];
          lines.push('# HELP ai_agent_handler_failures_total Number of handler failures');
          lines.push('# TYPE ai_agent_handler_failures_total counter');
          lines.push('# HELP ai_agent_handler_tripped Gauge indicating handler circuit is tripped (1=true)');
          lines.push('# TYPE ai_agent_handler_tripped gauge');
          for (const h of handlers) {
            const labels = `ev="${h.ev}",handler="${h.fnName || ''}"`;
            lines.push(`ai_agent_handler_failures_total{${labels}} ${h.failures || 0}`);
            const tripped = (h.trippedUntil && h.trippedUntil > Date.now()) ? 1 : 0;
            lines.push(`ai_agent_handler_tripped{${labels}} ${tripped}`);
          }
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
          res.end(lines.join('\n'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ handlers }, null, 2));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
    }

    // lightweight health endpoint for readiness probes
    if (req.method === 'GET' && req.url && req.url.startsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', now: Date.now() }, null, 2));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  })();
}

// create server (http or https depending on TLS env vars)
let server;
try {
  const certPath = process.env.AGENT_CAPABILITIES_TLS_CERT;
  const keyPath = process.env.AGENT_CAPABILITIES_TLS_KEY;
  const pfxPath = process.env.AGENT_CAPABILITIES_TLS_PFX;
  if ((certPath && keyPath) || pfxPath) {
    // create HTTPS server
    let creds = {};
    if (pfxPath) {
      creds.pfx = fs.readFileSync(pfxPath);
      if (process.env.AGENT_CAPABILITIES_TLS_PFX_PASS) creds.passphrase = process.env.AGENT_CAPABILITIES_TLS_PFX_PASS;
    } else {
      creds.cert = fs.readFileSync(certPath);
      creds.key = fs.readFileSync(keyPath);
    }
    server = https.createServer(creds, requestHandler);
    console.log('Agent capabilities server starting in HTTPS mode');
  } else {
    server = http.createServer(requestHandler);
  }
} catch (e) {
  console.error('Failed to start server with TLS configuration, falling back to HTTP', e && e.message);
  server = http.createServer(requestHandler);
}

server.listen(PORT, () => {
  console.log(`Agent capabilities server listening on http://localhost:${PORT}/capabilities`);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
