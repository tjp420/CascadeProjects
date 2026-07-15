import * as http from 'http';
import * as vscode from 'vscode';
import { getSbConfig } from '../utils/vscode';
import { listDirectories, ServerState } from '../dataServer';

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(serverState.currentReport || {}));
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(serverState.currentReport || { success: true, rawIssues: [], findings: [] }));
    return true;
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
