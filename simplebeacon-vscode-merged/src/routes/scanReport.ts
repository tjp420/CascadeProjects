import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import { getSbConfig } from '../utils/vscode';
import { listDirectories, ServerState } from '../dataServer';

function countLocalDirectoryInventory(projectPath: string, maxFiles = 100000): { totalFiles: number; totalFolders: number; projectRoot: string } | null {
  if (!projectPath || !fs.existsSync(projectPath)) { return null; }
  const skipDirs = new Set([
    '.git', '.github-cache', '.simplebeacon', '.vscode', '.vscode-test',
    'node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.cache',
    '__pycache__', '.venv', 'vendor', 'archive', 'docs', 'reports', 'logs'
  ]);
  let totalFiles = 0;
  let totalFolders = 0;
  const visited = new Set<string>();
  function walk(dir: string) {
    if (totalFiles >= maxFiles) { return; }
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (totalFiles >= maxFiles) { break; }
      if (entry.name.startsWith('.')) { continue; }
      if (skipDirs.has(entry.name)) { continue; }
      const full = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          if (!visited.has(full)) {
            visited.add(full);
            totalFolders++;
            walk(full);
          }
        } else if (entry.isFile()) {
          totalFiles++;
        }
      } catch { /* skip inaccessible entry */ }
    }
  }
  walk(projectPath);
  return { totalFiles, totalFolders, projectRoot: projectPath };
}

/**
 * Handle scan, report, status, config, workspace, and data routes.
 * @returns true if the request was handled.
 */
export function handleScanReportRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsed: URL,
  serverState: ServerState
): boolean {
  // Full report
  if (parsed.pathname === '/api/report') {
    const report = serverState.currentReport || {};
    if (!(report as any).projectRoot && serverState.workspacePath) {
      (report as any).projectRoot = serverState.workspacePath;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return true;
  }

  // All findings
  if (parsed.pathname === '/api/findings') {
    const report = serverState.currentReport;
    const findings = report?.rawIssues || report?.findings || report?.detectedIssues || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ findings, count: findings.length }));
    return true;
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
    return true;
  }

  // Extension config (sanitized)
  if (parsed.pathname === '/api/config') {
    const cfg = getSbConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      apiUrl: cfg.get<string>('apiUrl', ''),
      autoScanOnOpen: cfg.get<boolean>('autoScanOnOpen', false),
      autoOpenPreviewPanel: cfg.get<boolean>('autoOpenPreviewPanel', false),
      maxFiles: cfg.get<number>('maxFiles', 5000),
      dataServerPort: cfg.get<number>('dataServerPort', 54358),
    }));
    return true;
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
    return true;
  }

  // All data combined
  if (parsed.pathname === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(serverState));
    return true;
  }

  // SimpleBeacon report endpoint (dashboard compatibility)
  if (parsed.pathname === '/api/simplebeacon/report') {
    const report = serverState.currentReport || { success: true, rawIssues: [], findings: [] };
    if (!(report as any).projectRoot && serverState.workspacePath) {
      (report as any).projectRoot = serverState.workspacePath;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return true;
  }

  // Inventory / discovery — walk the local directory so the dashboard shows real file/folder counts
  if (parsed.pathname === '/api/analyze/inventory') {
    const projectPath = parsed.searchParams.get('projectPath') || serverState.workspacePath || '';
    const profile = parsed.searchParams.get('profile') || 'all';
    const fullDirectoryScan = parsed.searchParams.get('fullDirectoryScan') === 'true';
    const inventory = projectPath ? countLocalDirectoryInventory(projectPath) : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (!inventory) {
      res.end(JSON.stringify({
        success: true,
        pathMissing: true,
        projectPath,
        profile,
        fullDirectoryScan,
        scannedAt: new Date().toISOString(),
      }));
    } else {
      res.end(JSON.stringify({
        success: true,
        projectPath,
        profile,
        fullDirectoryScan,
        inventory,
        scannedAt: new Date().toISOString(),
      }));
    }
    return true;
  }

  // Directory browser listing for the analyze page
  if (parsed.pathname === '/api/analyze/list-directories') {
    const dirPath = parsed.searchParams.get('path') || '';
    const result = listDirectories(dirPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  return false;
}
