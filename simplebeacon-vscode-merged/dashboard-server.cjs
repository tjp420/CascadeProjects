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

const COMPLIANCE_REPORT_FALLBACKS = [
  process.env.SB_COMPLIANCE_REPORT,
  path.join('C:\\Users\\Trevor', 'Downloads', 'simplebeacon-report.json'),
  DEFAULT_REPORT_PATH,
].filter(Boolean);

function findComplianceReport() {
  for (const p of COMPLIANCE_REPORT_FALLBACKS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadComplianceReport() {
  const p = findComplianceReport();
  if (!p) return cachedReport;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`[dashboard-server] could not load compliance report ${p}: ${err.message}`);
    return cachedReport;
  }
}

function escapeHtmlCompliance(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderComplianceHtml(report) {
  const c = report.compliance || {};
  const projectRoot = report.projectRoot || DEFAULT_PROJECT;
  const generatedAt = report.generatedAt || new Date().toISOString();
  const qualityScore = report.qualityScore != null ? report.qualityScore : '—';
  const gatePass = report.gate && report.gate.pass ? 'PASS' : 'FAIL';
  const issueCount = report.issueCount != null ? report.issueCount : '—';
  const licenseCount = c.licenseCount != null ? c.licenseCount : 0;
  const securityCount = c.securityCount != null ? c.securityCount : 0;
  const summary = c.summary || 'No additional compliance summary was provided in this scan.';
  const remediation = c.remediation || 'No remediation notes were provided.';
  const eu = report.euAiActSummary || {};
  const severity = report.severityCounts || {};
  const severityRows = Object.entries(severity)
    .map(([k, v]) => `<tr><td>${escapeHtmlCompliance(k)}</td><td>${escapeHtmlCompliance(String(v))}</td></tr>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Report</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1120; color: #f1f5f9; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { margin: 0 0 0.25rem; font-size: 1.875rem; }
    .subtitle { color: #64748b; margin: 0 0 1.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 0.75rem; padding: 1rem; }
    .metric { font-size: 1.75rem; font-weight: 700; }
    .label { font-size: 0.875rem; color: #64748b; }
    .pass { color: #10b981; }
    .fail { color: #ef4444; }
    section { margin: 1.5rem 0; }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { line-height: 1.6; margin: 0.5rem 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
    th, td { padding: 0.5rem; border-bottom: 1px solid #1e293b; text-align: left; }
    pre { white-space: pre-wrap; background: #1e293b; padding: 1rem; border-radius: 0.5rem; font-family: 'JetBrains Mono', ui-monospace, monospace; }
    code { font-family: 'JetBrains Mono', ui-monospace, monospace; background: #1e293b; padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <h1>Compliance Report</h1>
  <p class="subtitle">${escapeHtmlCompliance(projectRoot)} · ${escapeHtmlCompliance(generatedAt)} · Tier ${escapeHtmlCompliance(report.tier || '—')}</p>

  <div class="grid">
    <div class="card"><div class="metric">${escapeHtmlCompliance(String(qualityScore))}</div><div class="label">Quality</div></div>
    <div class="card"><div class="metric ${gatePass === 'PASS' ? 'pass' : 'fail'}">${escapeHtmlCompliance(gatePass)}</div><div class="label">Gate</div></div>
    <div class="card"><div class="metric">${escapeHtmlCompliance(String(issueCount))}</div><div class="label">Issues</div></div>
    <div class="card"><div class="metric">${escapeHtmlCompliance(String(licenseCount))}</div><div class="label">License findings</div></div>
    <div class="card"><div class="metric">${escapeHtmlCompliance(String(securityCount))}</div><div class="label">Security findings</div></div>
  </div>

  <section>
    <h2>Summary</h2>
    <p>${escapeHtmlCompliance(summary)}</p>
  </section>

  <section>
    <h2>Remediation</h2>
    <p>${escapeHtmlCompliance(remediation)}</p>
  </section>

  ${severityRows ? `<section><h2>Severity counts</h2><table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody>${severityRows}</tbody></table></section>` : ''}

  ${eu && (eu.riskLevel || eu.classification) ? `<section><h2>EU AI Act</h2><p><strong>Risk level:</strong> ${escapeHtmlCompliance(eu.riskLevel || '—')} · <strong>Classification:</strong> ${escapeHtmlCompliance(eu.classification || '—')}</p><p>${escapeHtmlCompliance(eu.summary || '')}</p></section>` : ''}
</body>
</html>`;
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
      // Inject a small local-environment bootstrap that:
      // - sets local API/notify hosts
      // - marks embed/parent-urlbar flags when present
      // - installs resilient CSS + a defensive cleanup for host-set inline heights
      const inject = `<script id="sb-local-api-inject">(function(){try{var h=window.location.origin.replace(/\\/$/,"");try{localStorage.setItem("sb_api_host",h);sessionStorage.setItem("sb_api_base",h);sessionStorage.setItem("sb_notify_base",h);sessionStorage.setItem("sb_website_mode","1");}catch(e){}window.__SIMPLEBEACON_ENV__={API_BASE_URL:h,DASHBOARD_BASE_URL:h};window.__SB_API_HOST__=h;var params=new URLSearchParams(location.search||"");if(params.get("sb_parent_urlbar")==='1'){document.documentElement.setAttribute("data-parent-urlbar","1");}if(params.get("sb_website_mode")==='1'){document.documentElement.setAttribute("data-embed-mode","1");}if((window.self!==window.top)||typeof window.acquireVsCodeApi==='function'){document.documentElement.setAttribute("data-ide-embed","1");}
      // resilient CSS: only inject when embed flags are NOT present (host/IDE embeds manage layout)
      try{
        var _params = new URLSearchParams(location.search || '');
        var _isEmbedFlag = _params.get('sb_parent_urlbar') === '1' || _params.get('sb_website_mode') === '1';
        if (!_isEmbedFlag) {
          if (!document.querySelector('style[data-sb-resilient]')) {
            var s = document.createElement('style');
            s.setAttribute('data-sb-resilient', '1');
            s.appendChild(document.createTextNode('\nhtml:not([data-ide-embed="1"]) #root, html:not([data-ide-embed="1"]) #app-main, html:not([data-ide-embed="1"]) .app-main { position: fixed !important; inset: 0 !important; overflow: auto !important; -webkit-overflow-scrolling: touch !important; background: inherit !important; }\n'));
            (document.head || document.documentElement).appendChild(s);
          }
        }
      } catch (e) {}
      // defensive cleanup: strip height style when possible
      try{function stripHeight(s){return (s||"").replace(/\\bheight\\s*:\\s*[^;!]*!important;?/gi,'').replace(/\\bheight\\s*:\\s*[^;]*;?/gi,'');}
      var cleanup=function(){try{if(document.documentElement){document.documentElement.style.removeProperty('height');var a=document.documentElement.getAttribute('style');if(a&&/height\\s*:/i.test(a))document.documentElement.setAttribute('style',stripHeight(a));}if(document.body){document.body.style.removeProperty('height');var b=document.body.getAttribute('style');if(b&&/height\\s*:/i.test(b))document.body.setAttribute('style',stripHeight(b));}}catch(e){}};cleanup();
      if(window.MutationObserver){try{var mo=new MutationObserver(cleanup);mo.observe(document.documentElement,{attributes:true,attributeFilter:['style']});if(document.body)mo.observe(document.body,{attributes:true,attributeFilter:['style']});}catch(e){}
      }
      // short aggressive loop to counter hosts that set heights shortly after load
      try{var stop=Date.now()+3000;(function loop(){cleanup(); if(Date.now()<stop)requestAnimationFrame(loop);})();var iv=setInterval(cleanup,150);setTimeout(function(){clearInterval(iv);},5000);}catch(e){}
      }catch(e){} })();</script>`;
      html = html.replace('<head>', `<head>\n${inject}`);
    }
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
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
      Pragma: 'no-cache',
      Expires: '0',
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
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            token: 'local-community-token',
            user: {
              id: 'local',
              email: data.email || 'local@simplebeacon.ai',
              name: data.email ? data.email.split('@')[0] : 'Local User',
            },
          })
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/auth/register' && (req.method === 'POST' || req.method === 'GET')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            token: 'local-community-token',
            user: {
              id: 'local',
              email: data.email || 'local@simplebeacon.ai',
              name: data.name || data.email?.split('@')[0] || 'Local User',
            },
          })
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/simplebeacon/scan' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            scanning: false,
            projectPath: data.projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
            message: 'Scan completed (report served from cache)',
          })
        );
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/analyze/flexible' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
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
    res.end(
      JSON.stringify({
        success: true,
        progress: {
          active: false,
          percent: 100,
          message: 'Ready',
          projectPath: projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
        },
      })
    );
    return;
  }

  if (pathname === '/api/analyze/inventory') {
    const projectPath = parsed.searchParams.get('projectPath');
    const inventory = getInventory(projectPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        projectPath: projectPath || cachedReport.projectRoot || DEFAULT_PROJECT,
        profile: parsed.searchParams.get('profile') || 'all',
        fullDirectoryScan: parsed.searchParams.get('fullDirectoryScan') === 'true',
        inventory,
        scannedAt: new Date().toISOString(),
      })
    );
    return;
  }

  if (pathname === '/api/analyze/providers') {
    const roots = [
      cachedReport.projectRoot || DEFAULT_PROJECT,
      path.dirname(cachedReport.projectRoot || DEFAULT_PROJECT),
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        providers: [],
        allowedAnalysisRoots: roots,
        allowedAnalysisRootsSummary: roots.map((r) => ({ path: r, label: path.basename(r) })),
        defaultProjectPath: cachedReport.projectRoot || DEFAULT_PROJECT,
      })
    );
    return;
  }

  if (pathname === '/api/platform/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        online: true,
        authRequired: false,
        mode: 'local-dashboard-server',
        user: { id: 'local', email: 'local@simplebeacon.ai' },
      })
    );
    return;
  }

  if (pathname === '/api/theme') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ theme: 'dark' }));
    return;
  }

  if (pathname === '/api/trust/verification') {
    const trustPath = path.join(DASHBOARD_DIR, 'trust-verification.json');
    fs.readFile(trustPath, 'utf8', (err, data) => {
      if (err || !data) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err ? err.message : 'missing trust verification data' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/api/simplebeacon/status' || pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        scanStatus: 'completed',
        scanMessage: 'Scan complete',
        lastScanTime: cachedReport.generatedAt ? new Date(cachedReport.generatedAt).getTime() : Date.now(),
        workspaceName: path.basename(cachedReport.projectRoot || DEFAULT_PROJECT),
        workspacePath: cachedReport.projectRoot || DEFAULT_PROJECT,
        version: 'local-dashboard-server',
      })
    );
    return;
  }

  if (pathname === '/api/optimization/compliance' || pathname === '/optimization/compliance') {
    const format = parsed.searchParams.get('format') || 'json';
    const report = loadComplianceReport();
    if (format === 'html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(renderComplianceHtml(report));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          {
            success: true,
            compliance: report.compliance || {},
            projectRoot: report.projectRoot,
            qualityScore: report.qualityScore,
            gate: report.gate,
            generatedAt: report.generatedAt,
          },
          null,
          2
        )
      );
    }
    return;
  }

  // Static files
  if (pathname === '/') {
    // Do not force IDE/embed query flags by default; let callers opt-in.
    res.writeHead(302, {
      Location: `/dashboard/index.html?sb_api_base=http://${HOST}:${PORT}/api&sb_notify_base=http://${HOST}:${PORT}/api&sb_website_mode=1`,
    });
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
    const vanillaPath = path.join(DASHBOARD_DIR, 'index.vanilla.html');
    // prevent directory traversal
    const filePath = path.join(DASHBOARD_DIR, clean || 'index.html');
    if (!filePath.startsWith(DASHBOARD_DIR + path.sep) && filePath !== DASHBOARD_DIR) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const isIndex = !clean || clean === 'index.html';
    if (isIndex && fs.existsSync(vanillaPath) && fs.statSync(vanillaPath).isFile()) {
      serveIndexHtml(res, vanillaPath, req);
    } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStatic(req, res, filePath);
    } else if (fs.existsSync(vanillaPath) && fs.statSync(vanillaPath).isFile()) {
      serveIndexHtml(res, vanillaPath, req);
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
  console.debug &&
    console.debug(
      `[dashboard-server] open http://${HOST}:${PORT}/dashboard/index.html?sb_api_base=http://${HOST}:${PORT}/api&sb_notify_base=http://${HOST}:${PORT}/api&sb_website_mode=1`
    );
});
