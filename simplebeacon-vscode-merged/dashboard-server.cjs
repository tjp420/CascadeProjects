const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = Number(process.env.SB_DASHBOARD_PORT) || 8081;
const HOST = process.env.SB_DASHBOARD_HOST || '127.0.0.1';

const DASHBOARD_DIR = path.join(__dirname, 'dashboard-web');
const DEFAULT_PROJECT = 'C:\\Users\\Trevor\\CascadeProjects_BACKUP_20260521';
const DEFAULT_REPORT_PATH = path.join(DEFAULT_PROJECT, '.simplebeacon', 'report.json');

let cachedReport;
try {
  cachedReport = JSON.parse(fs.readFileSync(DEFAULT_REPORT_PATH, 'utf8'));
  // simplebeacon-ignore: console-log — debug output for local dev server
  console.debug && console.debug(`[dashboard-server] loaded report: ${DEFAULT_REPORT_PATH}`);
} catch (err) {
  console.error(`[dashboard-server] could not load default report: ${err.message}`);
  cachedReport = {};
}

function loadReport(projectPath) {
  if (!projectPath) return cachedReport;
  try {
    const requested = path.resolve(projectPath).toLowerCase();
    const defaultRoot = (cachedReport.projectRoot || DEFAULT_PROJECT).toLowerCase();
    if (requested === path.resolve(defaultRoot).toLowerCase()) return cachedReport;
    const candidate = path.join(projectPath, '.simplebeacon', 'report.json');
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  } catch (err) {
    console.error(`[dashboard-server] could not load report for ${projectPath}: ${err.message}`);
  }
  return cachedReport;
}

function getInventory(projectPath) {
  const r = loadReport(projectPath);
  if (r.repositoryInventory && typeof r.repositoryInventory.totalFiles === 'number') {
    return r.repositoryInventory;
  }
  return {
    totalFiles: r.totalFiles || 0,
    totalFolders: r.repositoryFoldersTotal || 0,
    projectRoot: projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
  };
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function serveIndexHtml(res, filePath, req) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err || !html) {
      serveStatic(req, res, filePath);
      return;
    }
    if (!html.includes('id="sb-local-api-inject"')) {
      const inject = '<script id="sb-local-api-inject">(function(){var h=window.location.origin.replace(/\\/$/,"");try{localStorage.setItem("sb_api_host",h);sessionStorage.setItem("sb_api_base",h);sessionStorage.setItem("sb_notify_base",h);sessionStorage.setItem("sb_website_mode","1");}catch(e){}window.__SIMPLEBEACON_ENV__={API_BASE_URL:h,DASHBOARD_BASE_URL:h};window.__SB_API_HOST__=h;})();</script>';
      html = html.replace('<head>', `<head>\n${inject}`);
    }
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(html);
  });
}

function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;

  // API routes
  if (pathname === '/api/simplebeacon/report' || pathname === '/api/report') {
    const projectPath = parsed.searchParams.get('projectPath');
    const report = loadReport(projectPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return;
  }

  if (pathname === '/api/auth/login' && (req.method === 'POST' || req.method === 'GET')) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token: 'local-community-token',
          user: { id: 'local', email: data.email || 'local@simplebeacon.ai', name: data.email ? data.email.split('@')[0] : 'Local User' },
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/auth/register' && (req.method === 'POST' || req.method === 'GET')) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token: 'local-community-token',
          user: { id: 'local', email: data.email || 'local@simplebeacon.ai', name: data.name || data.email?.split('@')[0] || 'Local User' },
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/simplebeacon/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          scanning: false,
          projectPath: data.projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
          message: 'Scan completed (report served from cache)',
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/analyze/flexible' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const report = loadReport(payload.projectPath);
        const flexible = {
          ...report,
          projectPath: payload.projectPath || report.projectRoot || DEFAULT_PROJECT,
          repositoryFilesTotal: report.repositoryInventory?.totalFiles ?? report.totalFiles ?? 0,
          repositoryFoldersTotal: report.repositoryInventory?.totalFolders ?? report.repositoryFoldersTotal ?? 0,
          filesAnalyzed: report.filesAnalyzed ?? report.totalFiles ?? 0,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(flexible));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/simplebeacon/scan/progress' || pathname === '/api/scan/progress') {
    const projectPath = parsed.searchParams.get('projectPath');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      progress: { active: false, percent: 100, message: 'Ready', projectPath: projectPath || cachedReport.projectRoot || DEFAULT_PROJECT },
    }));
    return;
  }

  if (pathname === '/api/analyze/inventory') {
    const projectPath = parsed.searchParams.get('projectPath');
    const inventory = getInventory(projectPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      projectPath: projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
      profile: parsed.searchParams.get('profile') || 'all',
      fullDirectoryScan: parsed.searchParams.get('fullDirectoryScan') === 'true',
      inventory,
      scannedAt: new Date().toISOString(),
    }));
    return;
  }

  if (pathname === '/api/analyze/providers') {
    const roots = [cachedReport.projectRoot || DEFAULT_PROJECT, path.dirname(cachedReport.projectRoot || DEFAULT_PROJECT)];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      providers: [],
      allowedAnalysisRoots: roots,
      allowedAnalysisRootsSummary: roots.map((r) => ({ path: r, label: path.basename(r) })),
      defaultProjectPath: cachedReport.projectRoot || DEFAULT_PROJECT,
    }));
    return;
  }

  if (pathname === '/api/platform/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, online: true, authRequired: false, mode: 'local-dashboard-server', user: { id: 'local', email: 'local@simplebeacon.ai' } }));
    return;
  }

  if (pathname === '/api/simplebeacon/status' || pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      scanStatus: 'completed',
      scanMessage: 'Scan complete',
      lastScanTime: cachedReport.generatedAt ? new Date(cachedReport.generatedAt).getTime() : Date.now(),
      workspaceName: path.basename(cachedReport.projectRoot || DEFAULT_PROJECT),
      workspacePath: cachedReport.projectRoot || DEFAULT_PROJECT,
      version: 'local-dashboard-server',
    }));
    return;
  }

  // Static files
  if (pathname === '/') {
    // Do not force IDE/embed query flags by default; let callers opt-in.
    res.writeHead(302, { Location: `/dashboard/index.html?sb_api_base=http://${HOST}:${PORT}/api&sb_notify_base=http://${HOST}:${PORT}/api&sb_website_mode=1` });
    res.end();
    return;
  }

  if (pathname === '/favicon.ico' || pathname === '/favicon.png' || pathname === '/favicon.svg') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/dashboard/')) {
    const relative = pathname.slice('/dashboard/'.length);
    const clean = relative.split('?')[0];
    const filePath = path.join(DASHBOARD_DIR, clean || 'index.html');
    // prevent directory traversal
    if (!filePath.startsWith(DASHBOARD_DIR + path.sep) && filePath !== DASHBOARD_DIR) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const isIndex = !clean || clean === 'index.html';
    if (isIndex && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveIndexHtml(res, filePath, req);
    } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStatic(req, res, filePath);
    } else {
      // SPA fallback for hash routes
      serveIndexHtml(res, path.join(DASHBOARD_DIR, 'index.html'), req);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', path: pathname }));
});

server.listen(PORT, HOST, () => {
  // simplebeacon-ignore: console-log — debug output for local dev server
  console.debug && console.debug(`[dashboard-server] listening on http://${HOST}:${PORT}`);
  // simplebeacon-ignore: console-log — debug output for local dev server
  console.debug && console.debug(`[dashboard-server] open http://${HOST}:${PORT}/dashboard/index.html?sb_api_base=http://${HOST}:${PORT}/api&sb_notify_base=http://${HOST}:${PORT}/api&sb_website_mode=1`);
});
