const http = require('http');

const TARGET_PORT = process.env.VITE_API_PORT || '59277';
const PROXY_PORT = process.env.JITTER_PROXY_PORT || '59278';
const BASE_LATENCY = parseInt(process.env.PROXY_BASE_LATENCY || '300', 10); // ms
const JITTER_RANGE = parseInt(process.env.PROXY_JITTER_RANGE || '150', 10); // ms
const ERROR_RATE = parseFloat(process.env.PROXY_ERROR_RATE || '0.02'); // 2% failure rate

console.log(`🌀 Starting Network Jitter Proxy on port ${PROXY_PORT} -> Target API: ${TARGET_PORT}`);
console.log(`⏱️  Config: Base Latency = ${BASE_LATENCY}ms, Jitter = ±${JITTER_RANGE}ms, Fault Injection = ${ERROR_RATE * 100}%`);

http.createServer((req, res) => {
  // Very small health endpoint passthrough for quick checks
  if (req.url === '/__proxy__health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, target: TARGET_PORT }));
    return;
  }

  // Inject transient faults based on ERROR_RATE
  if (Math.random() < ERROR_RATE) {
    console.warn(`💥 [Proxy] Injecting synthetic 429 Rate Limit Fault for: ${req.url}`);
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '2' });
    res.end(JSON.stringify({ error: 'Too Many Requests', message: 'Synthetic jitter fault injected.' }));
    return;
  }

  const currentJitter = (Math.random() * 2 - 1) * JITTER_RANGE;
  const targetDelay = Math.max(0, BASE_LATENCY + currentJitter);

  const options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  setTimeout(() => {
    const proxyReq = http.request(options, (proxyRes) => {
      // copy headers (but avoid invalid ones)
      const headers = Object.assign({}, proxyRes.headers);
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy] upstream error', err && err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', details: err.message }));
    });

    req.pipe(proxyReq, { end: true });
  }, targetDelay);
}).listen(PROXY_PORT, () => {
  console.log(`✅ Network Jitter Proxy listening on http://127.0.0.1:${PROXY_PORT}`);
});
