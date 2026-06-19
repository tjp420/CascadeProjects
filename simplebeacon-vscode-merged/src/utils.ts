import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const RECENT_FOLDERS_KEY = 'simplebeacon.recentScanFolders';
const MAX_RECENT = 5;

let _extensionVersion: string | undefined;

/**
 * Retrieve the extension version from package.json, cached after first read.
 * @param context - VS Code extension context.
 * @returns Extension version string.
 */
export function getExtensionVersion(context: vscode.ExtensionContext): string {
  if (_extensionVersion) {
    return _extensionVersion;
  }
  try {
    const pkgPath = path.join(context.extensionPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    _extensionVersion = (pkg.version as string) || 'unknown';
  } catch {
    _extensionVersion = 'unknown';
  }
  return _extensionVersion;
}

/**
 * Check whether the SimpleBeacon CLI is available in the environment.
 * @returns True if the CLI is installed and accessible.
 */
export async function checkCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['simplebeacon', '--version'], { shell: true, timeout: 8000 });
    let found = false;
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(found || code === 0));
    child.stdout.on('data', () => {
      found = true;
    });
    child.stderr.on('data', () => {
      found = true;
    });
  });
}

/**
 * Open a file dialog to let the user select a folder to scan.
 * @returns Selected folder path, or undefined if cancelled.
 */
export async function browseForFolder(): Promise<string | undefined> {
  const uri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Scan Folder',
  });
  return uri && uri[0] ? uri[0].fsPath : undefined;
}

function getRecentFolders(): string[] {
  try {
    const raw = vscode.workspace.getConfiguration().get<string[]>(RECENT_FOLDERS_KEY, []);
    return raw.filter((p) => fs.existsSync(p));
  } catch {
    return [];
  }
}

async function addRecentFolder(folderPath: string): Promise<void> {
  try {
    const recent = getRecentFolders().filter((p) => p !== folderPath);
    recent.unshift(folderPath);
    await vscode.workspace.getConfiguration().update(RECENT_FOLDERS_KEY, recent.slice(0, MAX_RECENT), true);
  } catch {
    // best-effort
  }
}

function getCurrentFileDir(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return path.dirname(editor.document.uri.fsPath);
  }
  return undefined;
}

/**
 * Prompt the user to pick a folder to scan.
 * Supports workspace folders, recent folders, current file's directory,
 * or browsing any folder on the system.
 * @returns Selected folder path, or undefined if cancelled.
 */
export async function pickWorkspaceFolder(): Promise<string | undefined> {
  const BROWSE = '__browse__';
  const CURRENT_FILE = '__current_file__';

  type PickerItem = { label: string; description: string; value: string; kind?: vscode.QuickPickItemKind };
  const items: PickerItem[] = [];

  // Workspace folders
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    items.push({
      label: 'Workspace Folders',
      description: '',
      value: '',
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const wf of folders) {
      items.push({
        label: `$(folder) ${wf.name}`,
        description: wf.uri.fsPath,
        value: wf.uri.fsPath,
      });
    }
  }

  // Current file's directory
  const currentFileDir = getCurrentFileDir();
  if (currentFileDir) {
    items.push({
      label: 'Current File',
      description: '',
      value: '',
      kind: vscode.QuickPickItemKind.Separator,
    });
    items.push({
      label: '$(file) Current file\'s directory',
      description: currentFileDir,
      value: CURRENT_FILE,
    });
  }

  // Recent folders
  const recent = getRecentFolders();
  if (recent.length > 0) {
    items.push({
      label: 'Recent Folders',
      description: '',
      value: '',
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const folderPath of recent) {
      items.push({
        label: `$(history) ${path.basename(folderPath)}`,
        description: folderPath,
        value: folderPath,
      });
    }
  }

  // Browse option
  items.push({
    label: 'Browse',
    description: '',
    value: '',
    kind: vscode.QuickPickItemKind.Separator,
  });
  items.push({
    label: '$(folder-opened) Browse for any folder...',
    description: 'Select any folder on your system',
    value: BROWSE,
  });

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: 'Choose a folder to scan with SimpleBeacon',
    title: 'Scan Folder',
    ignoreFocusOut: true,
  });

  if (!choice) {
    return undefined;
  }

  let result: string | undefined;
  if (choice.value === BROWSE) {
    result = await browseForFolder();
  } else if (choice.value === CURRENT_FILE) {
    result = currentFileDir;
  } else {
    result = choice.value;
  }

  if (result) {
    await addRecentFolder(result);
  }
  return result;
}
