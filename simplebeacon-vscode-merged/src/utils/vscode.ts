// simplebeacon-ignore memory-leak, security — VS Code–specific utility functions
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { spawn } from 'child_process';

const RECENT_FOLDERS_KEY = 'simplebeacon.recentScanFolders';
const MAX_RECENT = 5;
let _statusGen = 0;
let _lastStatusItem: vscode.Disposable | null = null;
let _extensionVersion: string | undefined;

/**
 * Generate a random nonce for CSP or script injection.
 * @returns {string} Base64-encoded 16-byte random string.
 */
export function getNonce(): string {
  try {
    return crypto.randomBytes(16).toString('base64');
  } catch {
    const ts = Date.now().toString(36);
    const r1 = Math.random().toString(36).slice(2);
    const r2 = Math.random().toString(36).slice(2);
    return Buffer.from(`${ts}${r1}${r2}`).toString('base64').slice(0, 24);
  }
}

/**
 * Show a temporary status-bar message that auto-dismisses after `timeoutMs`.
 * Disposes any previous status item so only one message is visible at a time.
 * @param {string} message
 * @param {number} [timeoutMs=3000]
 * @returns {vscode.Disposable}
 */
export function showQuietMessage(message: string | null | undefined, timeoutMs = 3000): vscode.Disposable {
  const msg = message == null ? '' : String(message);
  const delay = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000;
  _lastStatusItem?.dispose();
  _lastStatusItem = vscode.window.setStatusBarMessage(msg);
  const gen = ++_statusGen;
  const timer = setTimeout(() => {
    if (_statusGen === gen) {
      _lastStatusItem?.dispose();
      _lastStatusItem = null;
    }
  }, delay);

  const disposable = {
    dispose: () => {
      clearTimeout(timer);
      if (_statusGen === gen) {
        _lastStatusItem?.dispose();
        _lastStatusItem = null;
      }
    }
  };

  return disposable;
}

/**
 * Shorthand for the SimpleBeacon workspace configuration.
 * @returns {vscode.WorkspaceConfiguration}
 */
export function getSbConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('simplebeacon');
}

/**
 * Retrieve the extension version from package.json, cached after first read.
 * @param {vscode.ExtensionContext} context
 * @returns {string}
 */
export function getExtensionVersion(context: vscode.ExtensionContext): string {
  if (!context || typeof context !== 'object' || typeof context.extensionPath !== 'string') return 'unknown';
  if (_extensionVersion !== undefined) {
    return _extensionVersion;
  }
  try {
    const extVersion = (context.extension as any)?.packageJSON?.version;
    if (typeof extVersion === 'string' && extVersion) {
      _extensionVersion = extVersion;
      return _extensionVersion;
    }
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
 * Spawns `npx simplebeacon --version` with an 8-second timeout.
 * @returns {Promise<boolean>}
 */
const CLI_CHECK_TIMEOUT_MS = 8000;

export async function checkCliAvailable(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('npx', ['simplebeacon', '--version'], { shell: true });
    } catch {
      resolve(false);
      return;
    }
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
    child.unref?.();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.removeAllListeners();
        try { child.kill('SIGTERM'); } catch { /* already exited */ }
        resolve(false);
      }
    }, CLI_CHECK_TIMEOUT_MS);

    function finish(result: boolean) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        child.removeAllListeners();
        try { child.kill('SIGTERM'); } catch { /* already exited */ }
        resolve(result);
      }
    }

    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
  });
}

/**
 * Return the directory of the currently active editor file, if any.
 * @returns {string | undefined}
 */
export function getCurrentFileDir(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    return undefined;
  }
  const fsPath = editor.document.uri.fsPath;
  return fsPath ? path.dirname(fsPath) : undefined;
}

/**
 * Open a file dialog to let the user select a folder to scan.
 * @returns {Promise<string | undefined>}
 */
export async function browseForFolder(): Promise<string | undefined> {
  try {
    const uri = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Scan Folder',
    });
    return uri?.[0]?.fsPath;
  } catch {
    return undefined;
  }
}

/** Quick-pick item shape used by folder selection UI. */
export interface PickerItem {
  label: string;
  description: string;
  value: string;
  kind?: vscode.QuickPickItemKind;
}

/** Mapping from a virtual/aliased path prefix to its real hardware equivalent. */
export interface PathMapping {
  prefix: string;
  replacement: string;
}

/**
 * Read the list of recently-scanned folders from workspace state.
 * @returns {string[]}
 */
export function getRecentFolders(): string[] {
  try {
    const raw = vscode.workspace.getConfiguration().get<string[]>(RECENT_FOLDERS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter((p) => {
      try { return fs.statSync(p).isDirectory(); } catch { return false; }
    });
  } catch {
    return [];
  }
}

/**
 * Add a folder to the top of the recently-scanned list, capping at MAX_RECENT entries.
 * @param {string} folderPath Absolute path to add.
 * @returns {Promise<void>}
 */
export async function addRecentFolder(folderPath: string): Promise<void> {
  if (typeof folderPath !== 'string' || !folderPath) return;
  try {
    const recent = getRecentFolders().filter((p) => p !== folderPath);
    recent.unshift(folderPath);
    await vscode.workspace.getConfiguration().update(RECENT_FOLDERS_KEY, recent.slice(0, MAX_RECENT), true);
  } catch {
    // Best-effort
  }
}

/**
 * Remove a folder from the recently-scanned list.
 * @param {string} folderPath Absolute path to remove.
 * @returns {Promise<void>}
 */
export async function removeRecentFolder(folderPath: string): Promise<void> {
  if (typeof folderPath !== 'string' || !folderPath) return;
  try {
    const recent = getRecentFolders().filter((p) => p !== folderPath);
    await vscode.workspace.getConfiguration().update(RECENT_FOLDERS_KEY, recent, true);
  } catch {
    // Best-effort
  }
}

/**
 * Prompt the user to pick a folder to scan.
 * @returns {Promise<string | undefined>}
 */
export async function pickWorkspaceFolder(): Promise<string | undefined> {
  const BROWSE = '__browse__';
  const CURRENT_FILE = '__current_file__';

  const configuredPath = getSbConfig().get<string>('projectPath', '');
  if (configuredPath) {
    try {
      if (fs.existsSync(configuredPath)) {
        const stats = fs.statSync(configuredPath);
        if (stats.isDirectory()) {
          return configuredPath;
        }
      }
    } catch {
      // fall through
    }
  }

  const items: PickerItem[] = [];

  function addSection(title: string, entries: PickerItem[]) {
    if (!Array.isArray(entries) || !entries.length) return;
    items.push({ label: title, description: '', value: '', kind: vscode.QuickPickItemKind.Separator });
    items.push(...entries);
  }

  addSection('Workspace Folders',
    (vscode.workspace.workspaceFolders || []).map((wf) => ({
      label: `$(folder) ${wf.name}`,
      description: wf.uri.fsPath,
      value: wf.uri.fsPath,
    }))
  );

  const currentFileDir = getCurrentFileDir();
  addSection('Current File',
    currentFileDir ? [{
      label: '$(file) Current file\'s directory',
      description: currentFileDir,
      value: CURRENT_FILE,
    }] : []
  );

  addSection('Recent Folders',
    getRecentFolders().map((folderPath) => ({
      label: `$(history) ${path.basename(folderPath)}`,
      description: folderPath,
      value: folderPath,
    }))
  );

  addSection('Browse', [{
    label: '$(folder-opened) Browse for any folder...',
    description: 'Select any folder on your system',
    value: BROWSE,
  }]);

  let choice;
  try {
    choice = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose a folder to scan with SimpleBeacon',
      title: 'Scan Folder',
      ignoreFocusOut: true,
    });
  } catch {
    return undefined;
  }

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

/**
 * Return the first workspace folder path, or undefined if no workspace is open.
 * @returns {string | undefined}
 */
export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Check whether any workspace folders are currently open.
 * @returns {boolean}
 */
export function isWorkspaceOpen(): boolean {
  return !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0);
}

/**
 * Return the workspace folder that contains the given file path.
 * @param {string} filePath Absolute file path.
 * @returns {string | undefined}
 */
export function getWorkspaceFolderForFile(filePath: string): string | undefined {
  if (typeof filePath !== 'string' || !filePath) return undefined;
  const uri = vscode.Uri.file(filePath);
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (folder) return folder.uri.fsPath;
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Return the workspace folder that contains the given URI.
 * @param {vscode.Uri} uri URI to look up.
 * @returns {vscode.WorkspaceFolder | undefined}
 */
export function getWorkspaceFolderForUri(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  if (!uri) return undefined;
  return vscode.workspace.getWorkspaceFolder(uri);
}

/**
 * Format an absolute file path as relative to its containing workspace folder.
 * @param {string} filePath Absolute file path.
 * @returns {string}
 */
export function formatRelativePath(filePath: string): string {
  if (typeof filePath !== 'string' || !filePath) return '';
  const ws = getWorkspaceFolderForFile(filePath);
  if (ws) {
    try {
      const rel = path.relative(ws, filePath);
      if (rel && !rel.startsWith('..')) return rel;
    } catch { /* ignore */ }
  }
  try { return path.basename(filePath); } catch { return filePath; }
}

/**
 * Check whether a file path lies inside any currently-open workspace folder.
 * @param {string} filePath Absolute file path.
 * @returns {boolean}
 */
export function isInsideWorkspace(filePath: string): boolean {
  if (typeof filePath !== 'string' || !filePath) return false;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return false;
  const resolved = path.resolve(filePath).toLowerCase();
  const sep = path.sep;
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    if (!root) continue;
    const resolvedRoot = path.resolve(root).toLowerCase();
    if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + sep)) {
      return true;
    }
  }
  return false;
}

/**
 * Reroute virtual/aliased paths to real hardware drive locations.
 * @param {string} incomingPath Raw path to correct.
 * @returns {string} Corrected path.
 */
export function correctScanPath(incomingPath: string): string {
  if (typeof incomingPath !== 'string' || !incomingPath) { return ''; }
  const mappings = getSbConfig().get<PathMapping[]>('pathMappings', []);
  if (!Array.isArray(mappings)) { return incomingPath; }
  const lower = incomingPath.toLowerCase();
  for (const map of mappings) {
    if (!map || typeof map !== 'object') { continue; }
    if (typeof map.prefix !== 'string' || typeof map.replacement !== 'string') { continue; }
    if (!map.prefix || !map.replacement) { continue; }
    const prefixLower = map.prefix.toLowerCase();
    if (lower.startsWith(prefixLower)) {
      return map.replacement + incomingPath.slice(map.prefix.length);
    }
    const basename = map.prefix.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
    if (!basename) continue;
    const segments = incomingPath.split(/[\\/]/);
    const idx = segments.map(s => s.toLowerCase()).indexOf(basename);
    if (idx !== -1) {
      const suffix = segments.slice(idx + 1);
      return suffix.length > 0 ? path.join(map.replacement, ...suffix) : map.replacement;
    }
  }
  return incomingPath;
}

/**
 * Run an async task with a VS Code progress notification in the status bar.
 * @param {string} title Progress notification title.
 * @param {(progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>} task Async task to run.
 * @param {vscode.ProgressLocation} [location]
 * @returns {Promise<T>}
 */
export async function runWithProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
  location = vscode.ProgressLocation.Window
): Promise<T> {
  return vscode.window.withProgress({ location, title }, task);
}

/**
 * Collect multiple vscode.Disposable objects and dispose them all at once.
 * @returns {Object}
 */
export function createDisposableStack(): { push(...items: vscode.Disposable[]): number; use<T>(fn: () => T & vscode.Disposable): T; dispose(): void; isDisposed: boolean } {
  const items: vscode.Disposable[] = [];
  let disposed = false;
  return {
    get isDisposed() { return disposed; },
    push(...newItems: vscode.Disposable[]) {
      if (disposed) {
        newItems.forEach(d => { try { d.dispose(); } catch { /* ignore */ } });
        return items.length;
      }
      items.push(...newItems);
      return items.length;
    },
    use<T>(fn: () => T & vscode.Disposable): T {
      const result = fn();
      items.push(result);
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      while (items.length) {
        const item = items.pop();
        if (item) { try { item.dispose(); } catch { /* ignore */ } }
      }
    }
  };
}
