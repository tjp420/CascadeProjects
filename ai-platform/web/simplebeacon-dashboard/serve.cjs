const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const ROOT = __dirname;
const AUDIT_ROOT = path.join(__dirname, '..', '..', '..', 'coming-soon');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Stub API endpoints for dashboard functionality
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }
  if (urlPath === '/api/simplebeacon/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, features: { scan: true, analyze: true }, env: 'local' }));
    return;
  }
  if (urlPath === '/api/dashboard-home') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { metrics: {}, recentScans: [] } }));
    return;
  }
  if (urlPath === '/api/simplebeacon/user/ai-keys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, providers: { openai: { available: true, models: ['gpt-4', 'gpt-3.5-turbo'] } }, ollamaBaseUrl: '', ollamaModel: '' }));
    return;
  }
  if (urlPath === '/api/dev-tools/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tools: [] }));
    return;
  }
  if (urlPath === '/api/coverage-reports/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, coverage: { overall: 0 } }));
    return;
  }
  if (urlPath === '/api/security/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, vulnerabilities: [] }));
    return;
  }
  if (urlPath === '/api/quality/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, issues: [] }));
    return;
  }
  if (urlPath === '/api/help') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, topics: [] }));
    return;
  }
  if (urlPath === '/api/models/test-ollama') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ok: true, availableModels: ['llama3.2:latest'], message: 'Ollama connected' }));
    return;
  }
  if (urlPath === '/api/analyze/providers') {
    // Load allowed roots from project root .simplebeacon/config.json, or fallback to sensible defaults
    let allowedRoots = [];
    let defaultProjectPath = '';
    const repoRoot = path.resolve(path.join(__dirname, '..', '..', '..', '..'));
    try {
      const configPath = path.join(repoRoot, '.simplebeacon', 'config.json');
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      allowedRoots = Array.isArray(cfg.allowedAnalysisRoots) ? cfg.allowedAnalysisRoots : [];
      defaultProjectPath = Array.isArray(allowedRoots) && allowedRoots[0] ? allowedRoots[0] : repoRoot;
    } catch {
      allowedRoots = [repoRoot];
      defaultProjectPath = repoRoot;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      providers: [],
      allowedAnalysisRoots: allowedRoots,
      allowedAnalysisRootsSummary: allowedRoots.slice(0, 3).join('; '),
      defaultProjectPath
    }));
    return;
  }
  if (urlPath === '/audit.html') {
    const auditPath = path.join(AUDIT_ROOT, 'audit.html');
    fs.readFile(auditPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('audit.html not found');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  let filePath = path.join(ROOT, urlPath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        // SPA fallback: serve index.html for unknown routes
        fs.readFile(path.join(ROOT, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error: ' + err.code);
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT);
