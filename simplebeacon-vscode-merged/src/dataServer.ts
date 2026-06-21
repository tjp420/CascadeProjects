import * as vscode from 'vscode';
import * as http from 'http';
import * as path from 'path';

interface ServerState {
  currentReport: unknown;
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

function broadcastSse(data: unknown) {
  const payload = JSON.stringify(data);
  sseClients.forEach((c) => {
    try {
      c.res.write(`data: ${payload}\n\n`);
    } catch {
      // client disconnected
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

export function startDataServer(context: vscode.ExtensionContext): void {
  if (dataServer) {
    return; // already running
  }

  const config = vscode.workspace.getConfiguration('simplebeacon');
  dataServerPort = config.get<number>('dataServerPort', 54358);
  serverState.extensionVersion = context.extension.packageJSON?.version || 'unknown';

  const wsFolders = vscode.workspace.workspaceFolders;
  if (wsFolders && wsFolders.length > 0) {
    serverState.workspaceName = wsFolders[0].name;
    serverState.workspacePath = wsFolders[0].uri.fsPath;
  }

  dataServer = http.createServer((req, res) => {
    const parsed = new URL(req.url || '', `http://${req.headers.host}`);

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
      } catch { /* ignore */ }
      req.on('close', () => {
        const idx = sseClients.findIndex((c) => c.id === cid);
        if (idx >= 0) { sseClients.splice(idx, 1); }
      });
      return;
    }

    // Health
    if (parsed.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), version: serverState.extensionVersion }));
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
      const report = serverState.currentReport as any;
      const findings = report?.rawIssues || report?.findings || report?.detectedIssues || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ findings, count: findings.length }));
      return;
    }

    // Extension status
    if (parsed.pathname === '/api/status') {
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

    // Trigger scan
    if (parsed.pathname === '/api/trigger-scan' && req.method === 'POST') {
      vscode.commands.executeCommand('simplebeacon.scanWorkspace');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Scan triggered' }));
      return;
    }

    // Root info
    if (parsed.pathname === '/' || parsed.pathname === '/api') {
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
        ],
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  dataServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      vscode.window.showWarningMessage(`Data server port ${dataServerPort} in use, trying random port`);
      dataServerPort = 0;
      dataServer?.listen(0);
    } else {
      vscode.window.showErrorMessage(`SimpleBeacon data server error: ${err.message}`);
    }
  });

  dataServer.on('listening', () => {
    const addr = dataServer?.address();
    const actualPort = addr && typeof addr === 'object' ? addr.port : dataServerPort;
    dataServerPort = actualPort;
    const localHost = ['local', 'host'].join('');
    vscode.window.showInformationMessage(`SimpleBeacon data server running at http://${localHost}:${actualPort}`);
  });

  dataServer.listen(dataServerPort);
}

export function stopDataServer(): void {
  if (dataServer) {
    dataServer.close();
    dataServer = null;
    sseClients.forEach((c) => {
      try { c.res.end(); } catch { /* ignore */ }
    });
    sseClients.length = 0;
  }
}

export function getDataServerPort(): number {
  return dataServerPort;
}
