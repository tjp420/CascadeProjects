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
    let allowedRoots = [];
    let rootsSummary = 'none';
    let defaultPath = '';
    try {
      const projectRoot = path.join(ROOT, '..');
      const searchPaths = [projectRoot];
      const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          searchPaths.push(path.join(projectRoot, entry.name));
        }
      }
      for (const basePath of searchPaths) {
        const configJsonPath = path.join(basePath, '.simplebeacon', 'config.json');
        if (fs.existsSync(configJsonPath)) {
          const configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
          if (Array.isArray(configJson.allowedAnalysisRoots) && configJson.allowedAnalysisRoots.length > 0) {
            allowedRoots = configJson.allowedAnalysisRoots;
            rootsSummary = allowedRoots.slice(0, 4).join('; ');
            defaultPath = configJson.defaultProjectPath || basePath;
            break;
          }
        }
      }
    } catch { /* ignore */ }
    if (allowedRoots.length === 0) {
      const fallbackPath = path.join(ROOT, '..');
      allowedRoots = [fallbackPath];
      rootsSummary = fallbackPath;
      defaultPath = fallbackPath;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      providers: [
        { id: 'simplebeacon', name: 'SimpleBeacon', configured: true },
        { id: 'openai', name: 'OpenAI', configured: false },
        { id: 'ollama', name: 'Ollama', configured: false },
      ],
      allowedAnalysisRoots: allowedRoots,
      allowedAnalysisRootsSummary: rootsSummary,
      defaultProjectPath: defaultPath,
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
