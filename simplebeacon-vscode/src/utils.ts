import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let _extensionVersion: string | undefined;

export function getExtensionVersion(context: vscode.ExtensionContext): string {
  if (_extensionVersion) { return _extensionVersion; }
  try {
    const pkgPath = path.join(context.extensionPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    _extensionVersion = (pkg.version as string) || 'unknown';
  } catch {
    _extensionVersion = 'unknown';
  }
  return _extensionVersion;
}

export async function checkCliAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn('npx', ['simplebeacon', '--version'], { shell: true, timeout: 8000 });
    let found = false;
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(found || code === 0));
    child.stdout.on('data', () => { found = true; });
    child.stderr.on('data', () => { found = true; });
  });
}

export async function browseForFolder(): Promise<string | undefined> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Scan Folder'
  });
  return uri && uri[0] ? uri[0].fsPath : undefined;
}

export async function pickWorkspaceFolder(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) { return browseForFolder(); }

  const BROWSE = '__browse__';
  const items = folders.map(wf => ({
    label: wf.name,
    description: wf.uri.fsPath,
    value: wf.uri.fsPath
  }));
  items.push({ label: 'Browse for another folder...', description: 'Select a different folder to scan', value: BROWSE });

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: 'Choose a folder to scan with SimpleBeacon',
    title: 'Scan Workspace'
  });

  if (!choice) { return undefined; }
  if (choice.value === BROWSE) { return browseForFolder(); }
  return choice.value;
}
