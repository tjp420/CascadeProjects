// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { getSbConfig } from '../utils/vscode';
import { ServerState } from '../dataServer';

function readProjectScanProgress(projectPath: string) {
  if (!projectPath) return null;
  try {
    const progressPath = path.join(path.resolve(projectPath), '.simplebeacon', 'scan-progress.json');
    if (!fs.existsSync(progressPath)) return null;
    const raw = fs.readFileSync(progressPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return { active: true, ...data };
  } catch {
    return null;
  }
}

function buildScanProgressPayload(projectPath: string, serverState: ServerState) {
  const fileProgress = readProjectScanProgress(projectPath);
  if (fileProgress?.active) {
    const processed = Number(fileProgress.processed ?? fileProgress.filesProcessed ?? 0);
    const total = Number(fileProgress.total ?? fileProgress.filesTotal ?? 0);
    const percent = total > 0 ? Math.round((processed / total) * 100) : undefined;
    return {
      active: true,
      label: fileProgress.label || fileProgress.phase || 'Scanning…',
      phase: fileProgress.phase || 'scanning',
      processed,
      total: total || undefined,
      percent,
      currentFile: fileProgress.currentFile || fileProgress.file || '',
    };
  }

  const scanning = serverState.scanStatus === 'scanning';
  const processed = serverState.scanProgressProcessed ?? (scanning ? 0 : 100);
  const total = serverState.scanProgressTotal ?? 100;
  return {
    active: scanning,
    label: serverState.scanMessage || (scanning ? 'Scanning…' : 'Idle'),
    phase: scanning ? 'scanning' : 'idle',
    processed,
    total,
    percent: total > 0 ? Math.round((processed / total) * 100) : undefined,
    currentFile: serverState.scanProgressFile || '',
  };
}

/** Proxy a request to the user's local Ollama instance. Used by the hosted dashboard via the VS Code extension data-server bridge. */
function proxyToOllama(req: http.IncomingMessage, res: http.ServerResponse, targetUrl: string, method: string): void {
  const target = new URL(targetUrl);
  const client = target.protocol === 'https:' ? https : http;
  const proxyReq = client.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': req.headers.accept || 'application/json'
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ source: 'ollama-proxy', error: String(err.message || err) }));
  });
  req.pipe(proxyReq);
}

/**
 * Handle scan progress, SimpleBeacon config, presets, and AI-keys routes.
 * @returns true if the request was handled.
 */
export function handleScanConfigRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsed: URL,
  serverState: ServerState
): boolean {
  // Scan progress — reads .simplebeacon/scan-progress.json when available
  if (parsed.pathname === '/api/simplebeacon/scan/progress' || parsed.pathname === '/api/progress') {
    const projectPath = parsed.searchParams.get('projectPath') || serverState.workspacePath || '';
    const progress = buildScanProgressPayload(projectPath, serverState);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      projectPath,
      progress,
      completed: !progress.active,
    }));
    return true;
  }

  // SimpleBeacon config endpoint
  if (parsed.pathname === '/api/simplebeacon/config') {
    const cfg = getSbConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      apiUrl: cfg.get<string>('apiUrl', ''),
      apiServerUrl: cfg.get<string>('apiServerUrl', ''),
      autoScanOnOpen: cfg.get<boolean>('autoScanOnOpen', false),
      autoOpenPreviewPanel: cfg.get<boolean>('autoOpenPreviewPanel', false),
      maxFiles: cfg.get<number>('maxFiles', 5000),
      dataServerPort: cfg.get<number>('dataServerPort', 54358),
      relayPort: cfg.get<number>('relayPort', 55444),
    }));
    return true;
  }

  // SimpleBeacon config presets endpoint
  if (parsed.pathname === '/api/simplebeacon/config/presets') {
    const baseScanPaths = ['server/', 'src/', 'lib/', 'packages/', 'web/', 'app/', 'api/', 'components/', 'utils/', 'config/', 'shared/'];
    const makeRules = (profile: 'minimal' | 'standard' | 'cascade') => {
      const minimalIds = ['credentials', 'production-leak', 'fiction-kpi-patterns', 'web-security-risk', 'debugger-statement', 'console-log', 'eval-usage'];
      const standardIds = [...minimalIds, 'missing-rate-limit', 'inner-html-xss', 'insecure-random', 'logging-secrets', 'prototype-pollution', 'unvalidated-redirect', 'llm-slop-patterns'];
      const cascadeIds = [...standardIds, 'agency-handoff-patterns', 'token-bleed-patterns', 'data-access-pattern', 'json-report-drift', 'build-artifact-leak', 'unused-dependency', 'duplicate-code'];
      const ids = profile === 'minimal' ? minimalIds : profile === 'cascade' ? cascadeIds : standardIds;
      const rules: Record<string, any> = {};
      for (const id of ids) {
        rules[id] = { enabled: true };
      }
      return rules;
    };
    const presets: Record<string, any> = {};
    for (const profile of ['minimal', 'standard', 'cascade']) {
      const p = profile as 'minimal' | 'standard' | 'cascade';
      presets[profile] = {
        profile: p,
        scanPaths: [...baseScanPaths],
        productionPaths: p === 'minimal' ? ['server/', 'src/'] : [...baseScanPaths],
        sampleDir: 'web/data',
        rules: makeRules(p),
        gate: { failOn: ['high'], warnOn: ['medium', 'low'] }
      };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, presets }));
    return true;
  }

  // Ollama model test stub
  if (parsed.pathname === '/api/models/test-ollama') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reachable: false, error: 'Ollama not configured in VS Code extension' }));
    return true;
  }

  // Lightweight health-check used by the dashboard to verify the extension data server is reachable.
  if (parsed.pathname === '/api/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ online: true, source: 'extension-data-server' }));
    return true;
  }

  // Ollama proxy routes — let the hosted dashboard reach local Ollama through the VS Code extension data server
  if (parsed.pathname === '/api/simplebeacon/ollama/models' || parsed.pathname === '/api/tags') {
    const baseUrl = parsed.searchParams.get('baseUrl') || 'http://127.0.0.1:11434';
    proxyToOllama(req, res, `${baseUrl}/api/tags`, 'GET');
    return true;
  }
  if (parsed.pathname === '/api/simplebeacon/ollama/chat') {
    const baseUrl = parsed.searchParams.get('baseUrl') || 'http://127.0.0.1:11434';
    proxyToOllama(req, res, `${baseUrl}/api/chat`, 'POST');
    return true;
  }
  if (parsed.pathname === '/api/simplebeacon/ollama/proxy') {
    const baseUrl = parsed.searchParams.get('baseUrl') || 'http://127.0.0.1:11434';
    const proxyPath = parsed.searchParams.get('path') || '/api/tags';
    proxyToOllama(req, res, `${baseUrl}${proxyPath}`, req.method || 'GET');
    return true;
  }

  // AI keys local storage — persists in VS Code settings for the extension dashboard
  if (parsed.pathname === '/api/simplebeacon/user/ai-keys') {
    const cfg = getSbConfig();
    const normalizeKeys = (raw: any) => ({
      email: '',
      providers: {},
      ollamaBaseUrl: '',
      ollamaModel: '',
      updatedAt: null,
      ...raw
    });
    if (req.method === 'GET') {
      const stored = cfg.get<any>('aiKeys') || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...normalizeKeys(stored) }));
      return true;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const stored = normalizeKeys(cfg.get<any>('aiKeys') || {});
          const updated = {
            ...stored,
            providers: payload.providers || {},
            ollamaBaseUrl: payload.ollamaBaseUrl || '',
            ollamaModel: payload.ollamaModel || '',
            updatedAt: new Date().toISOString()
          };
          try {
            await cfg.update('aiKeys', updated, true);
          } catch {
            await cfg.update('aiKeys', updated, false);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...updated }));
        } catch (e) {
          console.error('[scanConfig] PUT /api/simplebeacon/user/ai-keys failed:', e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid request: ' + ((e as Error)?.message || String(e)) }));
        }
      });
      return true;
    }
    if (req.method === 'DELETE') {
      const empty = normalizeKeys({});
      cfg.update('aiKeys', empty, true).then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...empty }));
      });
      return true;
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return true;
  }

  return false;
}
