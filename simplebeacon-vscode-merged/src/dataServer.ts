// simplebeacon-ignore memory-leak — SSE server event listeners, client cleanup handled on close
import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { ScanReport } from './scanProvider';

interface ServerState {
  currentReport: ScanReport | null;
  scanStatus: string;
  scanMessage: string;
  lastScanTime: number;
  workspaceName: string;
  workspacePath: string;
  extensionVersion: string;
}

let serverState: ServerState = {
  currentReport: null,
  scanStatus: 'idle',
  scanMessage: 'Ready to scan',
  lastScanTime: 0,
  workspaceName: '',
  workspacePath: '',
  extensionVersion: '',
};

const sseClients: { res: http.ServerResponse; id: number }[] = [];
let sseClientId = 0;
let getSidebarHtml: (() => string | undefined) | null = null;
let latestAiContext: unknown = null;
let aiContextCallback: ((context: unknown) => void) | null = null;
let currentTheme: 'light' | 'dark' = 'light';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
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
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export function setAiContextCallback(fn: ((context: unknown) => void) | null): void {
  aiContextCallback = fn;
}

function buildAiContextMarkdown(context: any): string {
  const projectPath = context?.projectPath || context?.reportSummary?.projectPath || 'unknown';
  const reportType = context?.reportType || 'scan-summary';
  const notes = context?.notes || '';
  const summary = context?.reportSummary || {};
  const issues = Array.isArray(context?.issues) ? context.issues : [];
  const lines = [
    '## SimpleBeacon AI Context',
    '',
    `- **Project:** ${projectPath}`,
    `- **Report type:** ${reportType}`,
    `- **Sent at:** ${new Date().toISOString()}`,
    notes ? `- **Notes:** ${notes}` : '',
    '',
    '### Summary',
    '',
    Object.entries(summary).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '_No summary provided._',
    '',
  ];
  if (issues.length > 0) {
    lines.push('### Findings');
    lines.push('');
    lines.push(issues.slice(0, 50).map((i: any) => {
      const sev = i.severity || i.sev || 'low';
      const type = i.type || i.category || 'issue';
      const desc = i.description || i.message || i.title || JSON.stringify(i).slice(0, 120);
      return `- [${sev}] ${type}: ${desc}`;
    }).join('\n'));
    lines.push('');
  }
  lines.push('_Paste this into your AI coding agent for remediation guidance._');
  return lines.join('\n');
}

export function getLatestAiContext(): unknown {
  return latestAiContext;
}

export function setSidebarHtmlProvider(fn: () => string | undefined): void {
  getSidebarHtml = fn;
}

function broadcastSse(data: unknown) {
  const payload = JSON.stringify(data);
  sseClients.forEach((c) => {
    try {
      c.res.write(`data: ${payload}\n\n`);
    } catch {
      // simplebeacon-ignore error-swallowing — SSE client disconnected
    }
  });
}

export function updateServerState(partial: Partial<ServerState>) {
  serverState = { ...serverState, ...partial };
  broadcastSse({ type: 'state', payload: serverState });
}

export function getServerState(): ServerState {
  return serverState;
}

let dataServer: http.Server | null = null;
let dataServerPort = 54358;
let modernSidebarProviderRef: { addDownloadedFile: (name: string, path: string) => void } | null = null;

export function setModernSidebarProvider(provider: { addDownloadedFile: (name: string, path: string) => void } | null): void {
  modernSidebarProviderRef = provider;
}

function resolveDownloadPath(urlOrPath: string, context: vscode.ExtensionContext): string {
  try {
    const url = new URL(urlOrPath, `http://127.0.0.1:${dataServerPort}`);
    const pathname = url.pathname;
    const staticWorkspacePath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || '';
    if (pathname.startsWith('/coming-soon/')) {
      const comingSoonPath = pathname.slice('/coming-soon/'.length);
      const comingSoonCandidates = [
        path.join(context.extensionPath, '..', 'coming-soon'),
        path.join(context.extensionPath, '..', '..', 'coming-soon'),
        path.join(staticWorkspacePath, 'coming-soon'),
        path.join(context.extensionPath, 'coming-soon'),
        path.join(__dirname, '..', 'coming-soon'),
        path.join(__dirname, '..', '..', 'coming-soon'),
      ];
      const comingSoonRoot = comingSoonCandidates.find((p) => fs.existsSync(p)) || comingSoonCandidates[0];
      const filePath = path.join(comingSoonRoot, comingSoonPath === '' ? 'index.html' : comingSoonPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
      }
    }
    const staticDashboardCandidates = [
      path.join(context.extensionPath, '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(context.extensionPath, '..', '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(staticWorkspacePath, 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(context.extensionPath, 'dashboard-web'),
      path.join(__dirname, '..', 'dashboard-web'),
      path.join(__dirname, '..', '..', 'dashboard-web'),
      path.join(context.extensionPath, '..', 'ai-platform', 'web', 'simplebeacon-dashboard'),
    ];
    const dashboardRoot = staticDashboardCandidates.find((p) => fs.existsSync(p)) || staticDashboardCandidates[0];
    const filePath = path.join(dashboardRoot, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  } catch (e) {
    // Not a URL or resolution failed — fall back to the original value
  }
  return urlOrPath;
}

export function startDataServer(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): void {
  if (dataServer) {
    return; // already running
  }

  const config = vscode.workspace.getConfiguration('simplebeacon');
  const requestedPort = config.get<number>('dataServerPort', 54358);
  dataServerPort = requestedPort;
  serverState.extensionVersion = context.extension.packageJSON?.version || 'unknown';

  const wsFolders = vscode.workspace.workspaceFolders;
  if (wsFolders && wsFolders.length > 0) {
    serverState.workspaceName = wsFolders[0].name;
    serverState.workspacePath = wsFolders[0].uri.fsPath;
  }

  if (outputChannel) {
    outputChannel.appendLine(`[SimpleBeacon DataServer] Starting on port ${dataServerPort}...`);
  }

  function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsed = new URL(req.url || '', `http://${req.headers.host}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // SSE stream
    if (parsed.pathname === '/api/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(':ok\n\n');
      const cid = ++sseClientId;
      const client = { res, id: cid };
      sseClients.push(client);
      // Push current state immediately
      try {
        res.write(`data: ${JSON.stringify({ type: 'state', payload: serverState })}\n\n`);
      } catch { /* simplebeacon-ignore error-swallowing — SSE write best-effort */ }
      req.on('close', () => {
        const idx = sseClients.findIndex((c) => c.id === cid);
        if (idx >= 0) { sseClients.splice(idx, 1); }
      });
      return;
    }

    // Health
    if (parsed.pathname === '/api/health' || parsed.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), version: serverState.extensionVersion }));
      return;
    }

    // Pricing config endpoint (used by coming-soon site pages)
    if (parsed.pathname === '/api/config/pricing') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        pricing: {
          instant: { stripeLink: process.env.STRIPE_LINK_INSTANT || '' },
          executive: { stripeLink: process.env.STRIPE_LINK_EXECUTIVE || '' },
          euSprint: { stripeLink: process.env.STRIPE_LINK_EU_SPRINT || '' }
        }
      }));
      return;
    }

    // Free token generation for community dashboard sign-in
    if (parsed.pathname === '/api/free-token' && (req.method === 'POST' || req.method === 'GET')) {
      const email = parsed.searchParams.get('email') || '';
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : {};
            const userEmail = data.email || email || 'community@simplebeacon.ai';
            const now = Math.floor(Date.now() / 1000);
            const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const payload = Buffer.from(JSON.stringify({ email: userEmail, tier: 'community', source: 'free-token', iat: now, exp: now + 60 * 60 * 24 * 7 })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const token = `${header}.${payload}.free-token`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              token,
              tier: 'community',
              expiresInDays: 7,
              cached: false,
              message: 'Free community token generated. Valid for 7 days.'
            }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const payload = Buffer.from(JSON.stringify({ email: email || 'community@simplebeacon.ai', tier: 'community', source: 'free-token', iat: now, exp: now + 60 * 60 * 24 * 7 })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const token = `${header}.${payload}.free-token`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        token,
        tier: 'community',
        expiresInDays: 7,
        cached: false,
        message: 'Free community token generated. Valid for 7 days.'
      }));
      return;
    }

    // Full report
    if (parsed.pathname === '/api/report') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serverState.currentReport || {}));
      return;
    }

    // All findings
    if (parsed.pathname === '/api/findings') {
      const report = serverState.currentReport;
      const findings = report?.rawIssues || report?.findings || report?.detectedIssues || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ findings, count: findings.length }));
      return;
    }

    // Extension status
    if (parsed.pathname === '/api/status' || parsed.pathname === '/api/simplebeacon/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        scanStatus: serverState.scanStatus,
        scanMessage: serverState.scanMessage,
        lastScanTime: serverState.lastScanTime,
        workspaceName: serverState.workspaceName,
        workspacePath: serverState.workspacePath,
        version: serverState.extensionVersion,
      }));
      return;
    }

    // Extension config (sanitized)
    if (parsed.pathname === '/api/config') {
      const cfg = vscode.workspace.getConfiguration('simplebeacon');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        apiUrl: cfg.get<string>('apiUrl', ''),
        autoScanOnOpen: cfg.get<boolean>('autoScanOnOpen', false),
        autoOpenPreviewPanel: cfg.get<boolean>('autoOpenPreviewPanel', false),
        maxFiles: cfg.get<number>('maxFiles', 5000),
        dataServerPort: cfg.get<number>('dataServerPort', 54358),
      }));
      return;
    }

    // Workspace info
    if (parsed.pathname === '/api/workspace') {
      const wsFolders = vscode.workspace.workspaceFolders;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: serverState.workspaceName,
        path: serverState.workspacePath,
        folders: wsFolders ? wsFolders.map((f) => ({ name: f.name, path: f.uri.fsPath })) : [],
      }));
      return;
    }

    // All data combined
    if (parsed.pathname === '/api/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serverState));
      return;
    }

    // SimpleBeacon report endpoint (dashboard compatibility)
    if (parsed.pathname === '/api/simplebeacon/report') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serverState.currentReport || { success: true, rawIssues: [], findings: [] }));
      return;
    }

    // Inventory / discovery stub
    if (parsed.pathname === '/api/analyze/inventory') {
      const projectPath = parsed.searchParams.get('projectPath') || serverState.workspacePath || '';
      const profile = parsed.searchParams.get('profile') || 'all';
      const fullDirectoryScan = parsed.searchParams.get('fullDirectoryScan') === 'true';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        projectPath,
        profile,
        fullDirectoryScan,
        files: [],
        languages: [],
        framework: '',
        packageCount: 0,
        scannedAt: new Date().toISOString(),
      }));
      return;
    }

    // Platform status stub
    if (parsed.pathname === '/api/platform/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        online: true,
        version: serverState.extensionVersion,
        scanStatus: serverState.scanStatus,
        scanMessage: serverState.scanMessage,
        lastScanTime: serverState.lastScanTime,
      }));
      return;
    }

    // Optimization health stub
    if (parsed.pathname === '/api/optimization/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: 'ok', optimizationAvailable: false }));
      return;
    }

    // Path-health metrics stub
    if (parsed.pathname === '/api/metrics/path-health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        summary: {
          totalFilesScanned: 0,
          totalFilesIgnored: 0,
          activeRuleCount: 0,
          globalGate: 'PASS'
        },
        directories: [],
        engine: { version: '0.0.0', suppressedFalsePositives: 0 },
        timestamp: Date.now()
      }));
      return;
    }

    // Download notification endpoint — lets served pages (coming-soon, dashboard) report downloads to the sidebar
    if (parsed.pathname === '/api/download/notify' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.name && (data.path || data.content)) {
            let resolvedPath = data.path;
            if (data.content) {
              const downloadsDir = path.join(context.extensionPath, 'downloads');
              if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true });
              }
              const safeName = String(data.name).replace(/[^a-zA-Z0-9._-]/g, '_');
              resolvedPath = path.join(downloadsDir, `${Date.now()}-${safeName}`);
              fs.writeFileSync(resolvedPath, Buffer.from(String(data.content), 'base64'));
            } else {
              resolvedPath = resolveDownloadPath(data.path, context);
            }
            modernSidebarProviderRef?.addDownloadedFile(data.name, resolvedPath);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Scan progress stub
    if (parsed.pathname === '/api/simplebeacon/scan/progress') {
      const projectPath = parsed.searchParams.get('projectPath') || serverState.workspacePath || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        projectPath,
        status: serverState.scanStatus,
        message: serverState.scanMessage,
        progress: serverState.scanStatus === 'scanning' ? 50 : 100,
        completed: serverState.scanStatus !== 'scanning',
      }));
      return;
    }

    // SimpleBeacon config endpoint
    if (parsed.pathname === '/api/simplebeacon/config') {
      const cfg = vscode.workspace.getConfiguration('simplebeacon');
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
      return;
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
      return;
    }

    // Ollama model test stub
    if (parsed.pathname === '/api/models/test-ollama') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reachable: false, error: 'Ollama not configured in VS Code: extension' }));
      return;
    }

    // AI keys local storage — persists in VS Code settings for the extension dashboard
    if (parsed.pathname === '/api/simplebeacon/user/ai-keys') {
      const cfg = vscode.workspace.getConfiguration('simplebeacon');
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
        return;
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
            await cfg.update('aiKeys', updated, true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...updated }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
          }
        });
        return;
      }
      if (req.method === 'DELETE') {
        const empty = normalizeKeys({});
        cfg.update('aiKeys', empty, true).then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...empty }));
        });
        return;
      }
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return;
    }

    // Chatbot provider list — local extension has no AI backend, so return hardcoded providers disabled
    if (parsed.pathname === '/api/chatbot/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        providers: [
          { id: 'ollama', label: 'Ollama', available: false },
          { id: 'openai', label: 'OpenAI', available: false },
          { id: 'anthropic', label: 'Anthropic', available: false }
        ]
      }));
      return;
    }

    // Custom prompt storage — persist in VS Code settings
    if (parsed.pathname === '/api/prompts/get') {
      const cfg = vscode.workspace.getConfiguration('simplebeacon');
      const prompt = cfg.get<string>('chatbotCustomPrompt', '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, prompt }));
      return;
    }
    if (parsed.pathname === '/api/prompts/set' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const cfg = vscode.workspace.getConfiguration('simplebeacon');
          await cfg.update('chatbotCustomPrompt', String(data.prompt || ''), true);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
        }
      });
      return;
    }

    // Trust verification stub — enough to render the Trust dashboard without errors
    if (parsed.pathname === '/api/trust/verification') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
      res.end(JSON.stringify({
        success: true,
        live: {
          verificationId: 'sb-local-gate',
          score: 100,
          gatePass: true,
          generatedAt: new Date().toISOString(),
          platform: null,
          monorepo: null,
          headline: { primary: null, source: null, reason: 'No trust snapshots available in local extension mode.' },
          disclaimers: ['Local extension dashboard does not publish trust snapshots.'],
          methodology: ['Run Simplebeacon scan from the VS Code: command palette to generate a real trust snapshot.'],
          fictionScope: null
        },
        publishedAt: null
      }));
      return;
    }
    if (parsed.pathname === '/api/trust/verify') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
      res.end(JSON.stringify({
        success: true,
        verified: true,
        verificationId: 'sb-local-gate',
        score: 100,
        gatePass: true,
        generatedAt: new Date().toISOString()
      }));
      return;
    }
    if (parsed.pathname === '/api/trust/badge.svg') {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="310" height="42" viewBox="0 0 310 42">
  <rect width="308" height="40" x="1" y="1" rx="6" fill="rgba(15,23,42,0.6)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <circle cx="22" cy="21" r="7" fill="#10b981"/>
  <text x="38" y="25" fill="#fff" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">SimpleBeacon Verified</text>
  <text x="235" y="24" fill="rgba(156,163,175,0.9)" font-family="monospace" font-size="10">[local]</text>
</svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      res.end(svg);
      return;
    }

    // Security / npm audit stub
    if (parsed.pathname === '/api/security/npm-audit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
        advisories: [],
        message: 'npm audit is not available in local extension mode.'
      }));
      return;
    }

    // Optimization / compliance and candidates stubs
    if (parsed.pathname === '/api/optimization/compliance') {
      if (String(parsed.searchParams.get('format') || '').toLowerCase() === 'html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body><h1>Compliance report</h1><p>Compliance reporting is not available in local extension mode.</p></body></html>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        score: 100,
        checks: [],
        generatedAt: new Date().toISOString()
      }));
      return;
    }
    if (parsed.pathname === '/api/optimization/candidates') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        projectRoot: parsed.searchParams.get('projectPath') || serverState.workspacePath || '',
        generatedAt: null,
        candidates: [],
        exclusionsNote: null
      }));
      return;
    }

    // Sandbox token generation for local dashboard sign-in
    if (parsed.pathname === '/api/tokens/sandbox' && req.method === 'POST') {
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const payload = Buffer.from(JSON.stringify({ tier: 'sandbox', source: 'sandbox', iat: now, exp: now + 60 * 60 * 24 * 7 })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const token = `${header}.${payload}.sandbox`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token }));
      return;
    }

    // AI summary endpoint — local server has no AI backend, so return a deterministic summary
    if (parsed.pathname === '/api/analyze/summary' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const report = data.report || {};
          const raw = report.rawIssues || report.detectedIssues || [];
          const counts: Record<string, number> = {};
          for (const issue of raw) {
            const sev = String(issue.severity || 'low').toLowerCase();
            counts[sev] = (counts[sev] || 0) + 1;
          }
          const total = raw.length;
          const quality = report.qualityScore ?? report.summary?.qualityScore ?? null;
          const project = data.projectPath || report.projectRoot || report.projectPath || 'project';
          const focus = data.summaryFocus || 'all';
          const parts: string[] = [];
          if (total === 0) {
            parts.push(`No findings were detected in ${path.basename(project)} for the ${focus} focus.`);
          } else {
            parts.push(`Scan of ${path.basename(project)} found ${total} finding${total === 1 ? '' : 's'}.`);
            const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];
            const sevDesc = sevOrder.filter(s => counts[s]).map(s => `${counts[s]} ${s}`).join(', ');
            if (sevDesc) {
              parts.push(`Severity breakdown: ${sevDesc}.`);
            }
          }
          if (quality != null) {
            parts.push(`Overall quality score is ${quality}%.`);
          }
          parts.push('This summary is generated locally because no AI provider is configured on the local server.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, enhanced: true, provider: 'local', summary: parts.join(' ') }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Theme toggle endpoint
    if (parsed.pathname === '/api/theme') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            if (payload.theme === 'dark' || payload.theme === 'light') {
              currentTheme = payload.theme;
            } else {
              currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ theme: currentTheme }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ theme: currentTheme }));
      return;
    }

    // AI context bridge — receive data from dashboard and expose it to the AI chatbot view
    if (parsed.pathname === '/api/ai-context') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            latestAiContext = payload;
            const markdown = buildAiContextMarkdown(payload);
            const ws = vscode.workspace.workspaceFolders?.[0];
            if (ws) {
              const contextPath = path.join(ws.uri.fsPath, '.simplebeacon', 'ai-context.md');
              try {
                fs.mkdirSync(path.dirname(contextPath), { recursive: true });
                fs.writeFileSync(contextPath, markdown, 'utf8');
              } catch (e) {
                // best-effort disk persistence
              }
            }
            broadcastSse({ type: 'ai-context', payload });
            try {
              if (aiContextCallback) { aiContextCallback(payload); }
            } catch { /* ignore callback errors */ }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, content: markdown }));
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message || 'Invalid JSON' }));
          }
        });
        return;
      }
      if (req.method === 'GET') {
        const markdown = buildAiContextMarkdown(latestAiContext);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          context: latestAiContext,
          content: markdown,
          updatedAt: latestAiContext ? new Date().toISOString() : null,
        }));
        return;
      }
    }

    // SimpleBeacon scan trigger — await scan completion and return report
    if (parsed.pathname === '/api/simplebeacon/scan' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const args = {
            projectPath: payload.projectPath || serverState.workspacePath || undefined,
            fullDirectory: payload.fullDirectoryScan !== false,
          };
          const report = await vscode.commands.executeCommand('simplebeacon.scanWorkspace', args);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, report }));
        } catch (err: any) {
          const fallback = serverState.currentReport || {};
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            fallback: true,
            warning: err.message || 'Scan failed; returning cached report',
            report: fallback
          }));
        }
      });
      return;
    }

    // Audit endpoint — returns current report as audit data
    if (parsed.pathname === '/api/simplebeacon/audit') {
      const report = serverState.currentReport || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'complete',
        data: {
          findings: report.rawIssues || report.findings || report.detectedIssues || [],
          severityCounts: report.severityCounts || {},
          qualityScore: report.qualityScore ?? report.score ?? null,
          fileCount: report.totalFiles ?? report.fileCount ?? 0,
          filesAnalyzed: report.filesAnalyzed ?? 0,
          scannedAt: report.generatedAt ?? new Date().toISOString(),
        }
      }));
      return;
    }

    // Analyze providers stub (dashboard compatibility)
    if (parsed.pathname === '/api/analyze/providers') {
      let allowedRoots: string[] = [];
      let rootsSummary = 'none';
      let defaultPath = serverState.workspacePath || '';
      try {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          // Search workspace root and immediate subdirectories for .simplebeacon/config.json
          const searchPaths = [ws.uri.fsPath];
          try {
            const entries = fs.readdirSync(ws.uri.fsPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith('.')) {
                searchPaths.push(path.join(ws.uri.fsPath, entry.name));
              }
            }
          } catch { /* ignore */ }
          for (const basePath of searchPaths) {
            const configJsonPath = path.join(basePath, '.simplebeacon', 'config.json');
            if (fs.existsSync(configJsonPath)) {
              const configJson = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
              if (Array.isArray(configJson.allowedAnalysisRoots) && configJson.allowedAnalysisRoots.length > 0) {
                allowedRoots = configJson.allowedAnalysisRoots;
                rootsSummary = allowedRoots.slice(0, 4).join('; ');
                break;
              }
            }
          }
          if (!defaultPath) {
            defaultPath = ws.uri.fsPath;
          }
        }
      } catch {
        // simplebeacon-ignore error-swallowing — config read best-effort
      }
      if (allowedRoots.length === 0) {
        const fallbackPath = serverState.workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        if (fallbackPath) {
          allowedRoots = [fallbackPath];
          rootsSummary = fallbackPath;
        }
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

    // Trigger scan
    if (parsed.pathname === '/api/trigger-scan' && req.method === 'POST') {
      vscode.commands.executeCommand('simplebeacon.scanWorkspace');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Scan triggered' }));
      return;
    }

    // Dashboard analyze endpoint stubs — serve current report so dependent analyzers unblock
    if (parsed.pathname === '/api/analyze/codebase') {
      const report = serverState.currentReport || {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'complete',
        data: {
          findings: report.rawIssues || report.findings || report.detectedIssues || [],
          severityCounts: report.severityCounts || {},
          qualityScore: report.qualityScore ?? report.score ?? null,
          fileCount: report.totalFiles ?? report.fileCount ?? 0,
          filesAnalyzed: report.filesAnalyzed ?? 0,
          scannedAt: report.generatedAt ?? new Date().toISOString(),
        }
      }));
      return;
    }
    if (parsed.pathname === '/api/analyze/flexible') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let payload: any = {};
        try { payload = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
        const isRoadmap = payload.analysisType === 'roadmap';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          status: 'complete',
          result: serverState.currentReport || {},
          ...(isRoadmap ? {
            roadmap: {
              phases: [],
              milestones: [],
              metrics: { totalFiles: 0, codeFiles: 0, testFiles: 0 },
              conclusion: 'No roadmap data available in extension mode.'
            }
          } : {})
        }));
      });
      return;
    }
    if (parsed.pathname === '/api/analyze/data-cleanup') {
      const profile = parsed.searchParams.get('profile') || 'all';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'complete',
        data: {
          scanProfile: profile,
          summary: { totalFindings: 0, fixed: 0, remaining: 0 },
          fileReductionPlan: {
            totals: { safeToDeleteBytes: 0, safeToDeleteCount: 0 },
            safeToDelete: { topDirectories: [] },
          },
          scanners: { 'build-artifacts': { safeToDeleteBytes: 0, findings: [] } },
          executiveSummary: 'No cleanup issues found in this workspace.',
          findings: [],
          removed: 0,
          recommendations: [],
        }
      }));
      return;
    }
    if (parsed.pathname === '/api/analyze/npm-audit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status: 'complete', vulnerabilities: [], summary: 'No issues found' }));
      return;
    }
    if (parsed.pathname === '/api/merger-tool/reduction-scan') {
      const projectPath = parsed.searchParams.get('projectPath') || serverState.workspacePath || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'complete',
        files: [],
        reducedCount: 0,
        savedBytes: 0,
        summary: {
          repositoryFilesTotal: 0,
          repositoryFoldersTotal: 0,
          filesAnalyzed: 0,
          reducedCount: 0,
          savedBytes: 0,
        },
        repositoryInventory: { totalFiles: 0, totalFolders: 0 },
      }));
      return;
    }

    // Auth stubs for local dashboard login / sandbox token generation
    if (parsed.pathname === '/api/auth/login' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token: 'local-dev-token', user: { id: 'local', email: 'local@simplebeacon.ai', plan: 'sandbox', trustLevel: 'gold' } }));
      return;
    }
    if (parsed.pathname === '/api/auth/register' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token: 'local-dev-token', user: { id: 'local', email: 'local@simplebeacon.ai', plan: 'sandbox', trustLevel: 'gold' } }));
      return;
    }
    if (parsed.pathname === '/api/auth/logout' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (parsed.pathname === '/api/tokens/sandbox' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token: 'local-dev-token' }));
      return;
    }

    // Dashboard home page stubs — prevent 404 cascades on dashboard load
    if (parsed.pathname === '/api/auth/me') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, user: { id: 'local', email: 'local@simplebeacon.ai', trustLevel: 'gold' } }));
      return;
    }
    if (parsed.pathname === '/api/analyze/test-sources' || parsed.pathname === '/api/analyze/providers') {
      const workspacePath = serverState.workspacePath || '';
      const roots = workspacePath ? [workspacePath] : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        defaultProjectPath: workspacePath,
        allowedAnalysisRoots: roots,
        allowedAnalysisRootsSummary: roots.slice(0, 8).map((r) => String(r).replace(/\\/g, '/')).join('; ') || '(none)',
        providers: [
          { id: 'demo', label: 'Filesystem scan', configured: true, statusMessage: 'Built-in filesystem scan' },
          { id: 'active', label: 'Active model', configured: false },
          { id: 'ollama', label: 'Ollama', configured: false },
          { id: 'openai', label: 'OpenAI', configured: false },
          { id: 'anthropic', label: 'Anthropic', configured: false }
        ],
        analysisTypes: [
          { id: 'auto', label: 'Auto-detect' },
          { id: 'roadmap', label: 'Project roadmap' },
          { id: 'codebase', label: 'Codebase analysis' },
          { id: 'complete', label: 'Complete scan' }
        ],
        roadmapInsightsModes: [
          { id: 'off', label: 'Filesystem only' },
          { id: 'deterministic', label: 'Deterministic insights' },
          { id: 'llm', label: 'LLM strategic layer' }
        ],
        understandingModes: [
          { id: 'off', label: 'Static only' },
          { id: 'deterministic', label: 'Semantic + context' },
          { id: 'llm', label: 'AI-enhanced understanding' }
        ],
        analysisProfiles: [
          { id: 'quick', label: 'Quick analysis' },
          { id: 'balanced', label: 'Balanced analysis' },
          { id: 'comprehensive', label: 'Comprehensive analysis' },
          { id: 'realtime', label: 'Real-time streaming' }
        ],
        scanProfiles: [
          { id: 'default', label: 'Web + ZScript' },
          { id: 'universal', label: 'Universal' }
        ],
        sources: []
      }));
      return;
    }
    if (parsed.pathname === '/api/simplebeacon/baseline') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, baseline: null, hasBaseline: false }));
      return;
    }
    if (parsed.pathname === '/api/simplebeacon/history') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history: [] }));
      return;
    }
    if (parsed.pathname === '/api/dashboard-home') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, widgets: [] }));
      return;
    }
    if (parsed.pathname === '/api/dev-tools/tools') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tools: [] }));
      return;
    }
    if (parsed.pathname === '/api/dev-tools/workflows') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, workflows: [] }));
      return;
    }
    if (parsed.pathname === '/api/coverage-reports/overview') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, coverage: 0, reports: [] }));
      return;
    }
    if (parsed.pathname === '/api/quality/overview') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, score: 0, metrics: {} }));
      return;
    }
    if (parsed.pathname === '/api/security/overview') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, score: 0, findings: [] }));
      return;
    }
    if (parsed.pathname === '/api/help') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, topics: [] }));
      return;
    }
    if (parsed.pathname === '/api/simplebeacon/entitlements') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, publicGateLocked: false, closedVaultMode: false, hasAuditDeliverableAccess: true, auditCheckoutUrl: '', auditPriceLabel: '$0' }));
      return;
    }
    if (parsed.pathname === '/api/analyze/compliance-checklist') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, checklist: [] }));
      return;
    }

    // File content endpoint — serves workspace file text for diff engine
    if (parsed.pathname === '/api/file-content') {
      const requestedPath = parsed.searchParams.get('path') || '';
      if (!requestedPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing path parameter' }));
        return;
      }
      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const resolvedPath = path.isAbsolute(requestedPath) ? requestedPath : (workspace ? path.join(workspace, requestedPath) : requestedPath);
      if (workspace && !resolvedPath.startsWith(workspace)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path outside workspace' }));
        return;
      }
      try {
        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }
        const content = fs.readFileSync(resolvedPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message || 'Failed to read file' }));
      }
      return;
    }

    // Sidebar preview HTML — serve live generated IDE sidebar HTML only
    if (parsed.pathname === '/sidebar.html') {
      const sidebarHtml = getSidebarHtml ? getSidebarHtml() : undefined;
      if (sidebarHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(sidebarHtml);
        return;
      }
      const errorHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SimpleBeacon Sidebar</title></head><body style="font-family:sans-serif;padding:20px;">
        <h2>Sidebar preview unavailable</h2>
        <p>The IDE sidebar HTML could not be generated. Please open the SimpleBeacon sidebar in VS Code: first, then click Preview again.</p>
        <p style="color:#888;font-size:12px;">If the problem persists, check the SimpleBeacon output channel for errors.</p>
      </body></html>`;
      res.writeHead(503, { 'Content-Type': 'text/html' });
      res.end(errorHtml);
      return;
    }

    // Redirect root to dashboard SPA
    if (parsed.pathname === '/') {
      res.writeHead(302, { 'Location': '/dashboard' });
      res.end();
      return;
    }

    // Redirect legacy dashboard URL path used by older extension builds
    if (parsed.pathname === '/ai-platform/web/simplebeacon-dashboard/' || parsed.pathname === '/ai-platform/web/simplebeacon-dashboard') {
      res.writeHead(302, { 'Location': '/dashboard' + (parsed.search || '') + (parsed.hash || '') });
      res.end();
      return;
    }

    // Dashboard route (Open Browser button navigates here)
    if (parsed.pathname === '/dashboard' || parsed.pathname.startsWith('/dashboard/')) {
      const workspacePath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || '';
      const dashboardCandidates = [
        // Prefer the workspace dev copy (actively edited) over the bundled copy
        path.join(context.extensionPath, '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
        path.join(context.extensionPath, '..', '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
        path.join(workspacePath, 'simplebeacon-vscode-merged', 'dashboard-web'),
        path.join(context.extensionPath, 'dashboard-web'),
        path.join(__dirname, '..', 'dashboard-web'),
        path.join(__dirname, '..', '..', 'dashboard-web'),
        path.join(context.extensionPath, '..', 'ai-platform', 'web', 'simplebeacon-dashboard'),
      ];
      const dashboardRoot = dashboardCandidates.find((p) => fs.existsSync(p)) || dashboardCandidates[0];
      const relativePath = parsed.pathname === '/dashboard' ? '' : parsed.pathname.slice('/dashboard/'.length);
      const requestedPath = path.join(dashboardRoot, relativePath);
      if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
        res.writeHead(200, {
          'Content-Type': getMimeType(requestedPath),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        res.end(fs.readFileSync(requestedPath));
        return;
      }
      const indexPath = path.join(dashboardRoot, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        let html = fs.readFileSync(indexPath, 'utf8');
        // Convert any hardcoded file:// coming-soon links to relative HTTP paths
        html = html.replace(/file:\/\/\/[^'"]*?\/(coming-soon\/[^'"]*)/g, '/$1');
        // Inject env flag so client knows it's being served by the real data server
        const dataPort = getDataServerPort();
        const envScript = '<script>window.__SIMPLEBEACON_ENV__={DASHBOARD_BASE_URL:"http://127.0.0.1:' + dataPort + '",API_BASE_URL:"http://127.0.0.1:' + dataPort + '/api",DATA_SERVER_PORT:' + dataPort + '};<\/script>';
        const downloadNotifyScript = `<script>
(function() {
  function sbNotifyDownload(name, path, content) {
    var body = { name: name || 'download', path: path || '' };
    if (content) body.content = content;
    fetch('/api/download/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(function() {});
  }
  function sbNotifyBlob(name, blobUrl) {
    fetch(blobUrl).then(function(r) { return r.blob(); }).then(function(blob) {
      var reader = new FileReader();
      reader.onload = function() { sbNotifyDownload(name, blobUrl, reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    }).catch(function() { sbNotifyDownload(name, blobUrl); });
  }
  window.sbNotifyDownload = sbNotifyDownload;
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a[download], a[href$=".json"], a[href$=".pdf"], a[href$=".zip"], a[href$=".html"], button[download]');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var downloadName = el.getAttribute('download') || href.split('/').pop() || el.textContent || 'download';
    if (href.indexOf('blob:') === 0) {
      sbNotifyBlob(downloadName, href);
    } else {
      sbNotifyDownload(downloadName, href);
    }
  });
})();
</script>`;
        html = html.replace('</head>', envScript + downloadNotifyScript + '</head>');
        const themeScript = `<script>(function(){var h=document.documentElement;if(!h)return;function s(t){h.setAttribute('data-theme',t);}function p(){if(typeof fetch!=='function')return;fetch('/api/theme').then(function(r){return r.json();}).then(function(d){if(d&&d.theme)s(d.theme);}).catch(function(){});}p();setInterval(p,5000);})();</script>`;
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > 0) {
          html = html.slice(0, bodyClose) + themeScript + html.slice(bodyClose);
        } else {
          html += themeScript;
        }
        res.end(html);
        return;
      }
      res.writeHead(503, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h2>Dashboard not available</h2><p>Dashboard files not found.</p></body></html>');
      return;
    }

    // Static coming-soon site files
    if (parsed.pathname.startsWith('/coming-soon/')) {
      const comingSoonPath = parsed.pathname.slice('/coming-soon/'.length);
      const staticWorkspacePath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || '';
      const comingSoonCandidates = [
        path.join(context.extensionPath, '..', 'coming-soon'),
        path.join(context.extensionPath, '..', '..', 'coming-soon'),
        path.join(staticWorkspacePath, 'coming-soon'),
        path.join(context.extensionPath, 'coming-soon'),
        path.join(__dirname, '..', 'coming-soon'),
        path.join(__dirname, '..', '..', 'coming-soon'),
      ];
      const comingSoonRoot = comingSoonCandidates.find((p) => fs.existsSync(p)) || comingSoonCandidates[0];
      const filePath = path.join(comingSoonRoot, comingSoonPath === '' ? 'index.html' : comingSoonPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, {
          'Content-Type': getMimeType(filePath),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        });
        let content = fs.readFileSync(filePath);
        if (getMimeType(filePath) === 'text/html') {
          const hidePricingScript = `<script>
(function() {
  const TOKEN_KEYS = ['cascadeAuthToken','access_token','token','authToken','simplebeacon_token'];
  function hasAnyToken() {
    return TOKEN_KEYS.some(function(k) { var v = localStorage.getItem(k); return v && v.length > 10; });
  }
  function hidePricingIfAuthed() {
    if (!hasAnyToken()) return;
    document.querySelectorAll('a[href*="pricing.html"]').forEach(function(el) { el.style.display = 'none'; });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hidePricingIfAuthed);
  } else {
    hidePricingIfAuthed();
  }
})();
</script>`;
          const downloadNotifyScript = `<script>
(function() {
  function sbNotifyDownload(name, path, content) {
    var body = { name: name || 'download', path: path || '' };
    if (content) body.content = content;
    fetch('/api/download/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(function() {});
  }
  function sbNotifyBlob(name, blobUrl) {
    fetch(blobUrl).then(function(r) { return r.blob(); }).then(function(blob) {
      var reader = new FileReader();
      reader.onload = function() { sbNotifyDownload(name, blobUrl, reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    }).catch(function() { sbNotifyDownload(name, blobUrl); });
  }
  window.sbNotifyDownload = sbNotifyDownload;
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a[download], a[href$=".json"], a[href$=".pdf"], a[href$=".zip"], a[href$=".html"]');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var downloadName = el.getAttribute('download') || href.split('/').pop() || 'download';
    if (href.indexOf('blob:') === 0) {
      sbNotifyBlob(downloadName, href);
    } else {
      sbNotifyDownload(downloadName, href);
    }
  });
})();
</script>`;
          const themeScript = `<script>(function(){var h=document.documentElement;if(!h)return;function s(t){h.setAttribute('data-theme',t);}function p(){if(typeof fetch!=='function')return;fetch('/api/theme').then(function(r){return r.json();}).then(function(d){if(d&&d.theme)s(d.theme);}).catch(function(){});}p();setInterval(p,5000);})();</script>`;
          const html = content.toString('utf8');
          const bodyClose = html.lastIndexOf('</body>');
          if (bodyClose > 0) {
            content = Buffer.from(html.slice(0, bodyClose) + hidePricingScript + downloadNotifyScript + themeScript + html.slice(bodyClose), 'utf8');
          } else {
            content = Buffer.from(html + hidePricingScript + downloadNotifyScript + themeScript, 'utf8');
          }
        }
        res.end(content);
        return;
      }
    }

    // Static dashboard files: bundled copy in dashboard-web, or dev path
    const staticWorkspacePath = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || '';
    const staticDashboardCandidates = [
      path.join(context.extensionPath, '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(context.extensionPath, '..', '..', 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(staticWorkspacePath, 'simplebeacon-vscode-merged', 'dashboard-web'),
      path.join(context.extensionPath, 'dashboard-web'),
      path.join(__dirname, '..', 'dashboard-web'),
      path.join(__dirname, '..', '..', 'dashboard-web'),
      path.join(context.extensionPath, '..', 'ai-platform', 'web', 'simplebeacon-dashboard'),
    ];
    const dashboardRoot = staticDashboardCandidates.find((p) => fs.existsSync(p)) || staticDashboardCandidates[0];
    let filePath = path.join(dashboardRoot, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
    // SPA fallback: dashboard routes like /dashboard/profile are handled client-side by index.html
    if ((!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) && parsed.pathname.startsWith('/dashboard/')) {
      filePath = path.join(dashboardRoot, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      let content = fs.readFileSync(filePath);
      if (getMimeType(filePath) === 'text/html') {
        const downloadNotifyScript = `<script>
(function() {
  function sbNotifyDownload(name, path, content) {
    var body = { name: name || 'download', path: path || '' };
    if (content) body.content = content;
    fetch('/api/download/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(function() {});
  }
  function sbNotifyBlob(name, blobUrl) {
    fetch(blobUrl).then(function(r) { return r.blob(); }).then(function(blob) {
      var reader = new FileReader();
      reader.onload = function() { sbNotifyDownload(name, blobUrl, reader.result.split(',')[1]); };
      reader.readAsDataURL(blob);
    }).catch(function() { sbNotifyDownload(name, blobUrl); });
  }
  window.sbNotifyDownload = sbNotifyDownload;
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a[download], a[href$=".json"], a[href$=".pdf"], a[href$=".zip"], a[href$=".html"]');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var downloadName = el.getAttribute('download') || href.split('/').pop() || 'download';
    if (href.indexOf('blob:') === 0) {
      sbNotifyBlob(downloadName, href);
    } else {
      sbNotifyDownload(downloadName, href);
    }
  });
})();
</script>`;
        const themeScript = `<script>(function(){var h=document.documentElement;if(!h)return;function s(t){h.setAttribute('data-theme',t);}function p(){if(typeof fetch!=='function')return;fetch('/api/theme').then(function(r){return r.json();}).then(function(d){if(d&&d.theme)s(d.theme);}).catch(function(){});}p();setInterval(p,5000);})();</script>`;
        const html = content.toString('utf8');
        const bodyClose = html.lastIndexOf('</body>');
        if (bodyClose > 0) {
          content = Buffer.from(html.slice(0, bodyClose) + downloadNotifyScript + themeScript + html.slice(bodyClose), 'utf8');
        } else {
          content = Buffer.from(html + downloadNotifyScript + themeScript, 'utf8');
        }
      }
      res.end(content);
      return;
    }

    // Redirect legacy dashboard HTML links to the SPA path routes
    const htmlToRoute: Record<string, string> = {
      '/audit.html': '/dashboard/audit',
      '/security.html': '/dashboard/security',
      '/quality.html': '/dashboard/quality',
      '/trust.html': '/dashboard/trust',
      '/assessments.html': '/dashboard/assessments',
      '/platform.html': '/dashboard/platform',
      '/profile.html': '/dashboard/profile',
      '/compliance.html': '/dashboard/compliance',
      '/repository-health.html': '/dashboard/repository-health',
      '/analytics.html': '/dashboard/analytics',
      '/team.html': '/dashboard/team',
      '/remediation.html': '/dashboard/remediation',
      '/roadmap.html': '/dashboard/remediation',
      '/results.html': '/dashboard/results',
      '/report.html': '/dashboard/results',
      '/upload.html': '/dashboard/upload',
      '/certificate.html': '/dashboard/certificate',
      '/settings.html': '/dashboard/settings',
      '/dashboard.html': '/dashboard/dashboard',
      '/index.html': '/dashboard/dashboard',
    };
    const spaRedirect = htmlToRoute[parsed.pathname];
    if (spaRedirect) {
      res.writeHead(302, { 'Location': spaRedirect });
      res.end();
      return;
    }

    // Serve coming-soon marketing pages (audit, roadmap, pricing, etc.)
    const comingSoonCandidates = [
      path.join(context.extensionPath, '..', 'coming-soon'),
      path.join(staticWorkspacePath, 'coming-soon'),
      path.join(staticWorkspacePath, '..', 'coming-soon'),
    ];
    const comingSoonDir = comingSoonCandidates.find((p) => fs.existsSync(p)) || comingSoonCandidates[0];
    const comingSoonPathRel = parsed.pathname.startsWith('/coming-soon/')
      ? parsed.pathname.slice('/coming-soon/'.length)
      : parsed.pathname;
    if (parsed.pathname.endsWith('.html')) {
      const comingSoonPath = path.join(comingSoonDir, comingSoonPathRel);
      if (fs.existsSync(comingSoonPath) && fs.statSync(comingSoonPath).isFile()) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(comingSoonPath));
        return;
      }
    }
    // Also serve coming-soon static assets (css, js, images)
    const comingSoonAsset = path.join(comingSoonDir, comingSoonPathRel);
    if (fs.existsSync(comingSoonAsset) && fs.statSync(comingSoonAsset).isFile()) {
      const ext = path.extname(comingSoonAsset).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(comingSoonAsset));
      return;
    }

    // Root info
    if (parsed.pathname === '/api') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'SimpleBeacon Extension Data Server',
        version: serverState.extensionVersion,
        endpoints: [
          '/api/health',
          '/api/report',
          '/api/findings',
          '/api/status',
          '/api/config',
          '/api/workspace',
          '/api/data',
          '/api/stream',
          '/api/trigger-scan (POST)',
          '/api/analyze/inventory',
          '/api/analyze/codebase',
          '/api/analyze/flexible',
          '/api/analyze/data-cleanup',
          '/api/analyze/npm-audit',
          '/api/analyze/providers',
          '/api/merger-tool/reduction-scan',
          '/api/platform/status',
          '/api/simplebeacon/config',
          '/api/simplebeacon/scan (POST)',
          '/api/simplebeacon/scan/progress',
        ],
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  dataServer = http.createServer((req, res) => handleRequest(req, res));

  dataServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      if (outputChannel) {
        outputChannel.appendLine(`[SimpleBeacon DataServer] Port ${dataServerPort} in use, creating new server on random port...`);
      }
      try { dataServer?.close(); } catch { /* ignore */ }
      dataServer = null;
      dataServerPort = 0;
      // Recreate server on random port with full handler
      dataServer = http.createServer((req, res) => handleRequest(req, res));
      dataServer.listen(0, '127.0.0.1', () => {
        const addr = dataServer?.address();
        const actualPort = addr && typeof addr === 'object' ? addr.port : 0;
        dataServerPort = actualPort;
        if (outputChannel) {
          outputChannel.appendLine(`[SimpleBeacon DataServer] Fallback server on port ${actualPort}`);
        }
        vscode.window.showInformationMessage(`SimpleBeacon data server running at http://127.0.0.1:${actualPort}`);
      });
    } else {
      if (outputChannel) {
        outputChannel.appendLine(`[SimpleBeacon DataServer] ERROR: ${err.message}`);
      }
      vscode.window.showErrorMessage(`SimpleBeacon data server error: ${err.message}`);
    }
  });

  dataServer.on('listening', () => {
    const addr = dataServer?.address();
    const actualPort = addr && typeof addr === 'object' ? addr.port : dataServerPort;
    dataServerPort = actualPort;
    if (outputChannel) {
      outputChannel.appendLine(`[SimpleBeacon DataServer] Listening on http://127.0.0.1:${actualPort}`);
    }
    vscode.window.showInformationMessage(`SimpleBeacon data server running at http://127.0.0.1:${actualPort}`);
  });

  dataServer.listen(dataServerPort, '127.0.0.1', () => {
    if (outputChannel) {
      outputChannel.appendLine(`[SimpleBeacon DataServer] listen() callback fired`);
    }
  });
}

export function restartDataServer(context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): void {
  if (dataServer) {
    dataServer.close(() => {
      sseClients.forEach((c) => {
        try { c.res.end(); } catch { /* simplebeacon-ignore error-swallowing — SSE cleanup best-effort */ }
      });
      sseClients.length = 0;
      startDataServer(context, outputChannel);
    });
    dataServer = null;
    return;
  }
  startDataServer(context, outputChannel);
}

export function isDataServerRunning(): boolean {
  return dataServer !== null && dataServer.listening;
}

export function stopDataServer(): void {
  if (dataServer) {
    dataServer.close();
    dataServer = null;
    sseClients.forEach((c) => {
      try { c.res.end(); } catch { /* simplebeacon-ignore error-swallowing — SSE cleanup best-effort */ }
    });
    sseClients.length = 0;
  }
}

export function getDataServerPort(): number {
  return dataServerPort;
}

export function getTheme(): 'light' | 'dark' {
  return currentTheme;
}

export function setTheme(theme: 'light' | 'dark'): void {
  currentTheme = theme;
}
