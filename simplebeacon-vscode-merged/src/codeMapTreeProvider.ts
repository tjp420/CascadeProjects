import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { escapeHtml } from './utils';

interface CodeMapTreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: CodeMapTreeNode[];
  ext?: string;
  lines?: number;
  size?: number;
  viewable?: boolean;
}

export class CodeMapTreeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-codemap-tree';
  private static _instance?: CodeMapTreeProvider;
  private _view?: vscode.WebviewView;
  private _cachedTree?: CodeMapTreeNode[];
  private _cachedProjectName = 'Code Map';

  constructor(private readonly _extensionUri: vscode.Uri) {
    CodeMapTreeProvider._instance = this;
  }

  public static get instance(): CodeMapTreeProvider | undefined {
    return CodeMapTreeProvider._instance;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);
    this._loadTreeData();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'selectFile': {
          const targetPath = message.path as string;
          if (!targetPath) break;
          const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!workspace) break;
          const fullPath = path.join(workspace, targetPath);
          if (fs.existsSync(fullPath)) {
            vscode.workspace.openTextDocument(fullPath).then((doc) => {
              vscode.window.showTextDocument(doc, { preview: true });
            });
          }
          // Also notify the main codemap panel to highlight this node
          vscode.commands.executeCommand('simplebeacon.highlightCodeMapNode', targetPath);
          break;
        }
        case 'refreshTree':
          this._loadTreeData();
          break;
        case 'generateCodeMap':
          vscode.commands.executeCommand('simplebeacon.generateCodeMap');
          break;
        case 'openCodeMapPanel':
          vscode.commands.executeCommand('simplebeacon.openCodeMapHtml');
          break;
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = this._getNonce();
    const csp = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data:; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 13px;
  color: var(--vscode-foreground, #ccc);
  background: var(--vscode-sideBar-background, #1e1e1e);
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(128,128,128,0.3) transparent;
}
body::-webkit-scrollbar { width: 6px; }
body::-webkit-scrollbar-track { background: transparent; }
body::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
  background: var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.02));
}
.header-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.header-actions { display: flex; gap: 4px; }
.icon-btn {
  background: transparent; border: none; color: var(--vscode-foreground, #ccc);
  cursor: pointer; padding: 3px 6px; border-radius: 4px; font-size: 13px;
}
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1)); }
.search-box {
  width: calc(100% - 16px);
  margin: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
  background: var(--vscode-input-background, rgba(255,255,255,0.05));
  color: var(--vscode-input-foreground, #ccc);
  font-family: inherit; font-size: 12px;
}
.search-box:focus { outline: none; border-color: var(--vscode-focusBorder, #007acc); }
.tree-node {
  display: flex; align-items: center;
  padding: 3px 8px 3px 0;
  cursor: pointer; font-size: 12px; gap: 4px;
  white-space: nowrap; user-select: none;
  color: var(--vscode-foreground, #ccc);
}
.tree-node:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06)); }
.tree-node.selected { background: var(--vscode-list-activeSelectionBackground, rgba(0,122,204,0.2)); color: var(--vscode-list-activeSelectionForeground, #fff); }
.tree-node .toggle {
  width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: var(--vscode-descriptionForeground, #858585);
  cursor: pointer; flex-shrink: 0;
}
.tree-node .toggle-spacer { width: 14px; flex-shrink: 0; }
.tree-node .node-icon { flex-shrink: 0; font-size: 13px; width: 16px; text-align: center; }
.tree-node .node-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.tree-node .node-meta { color: var(--vscode-descriptionForeground, #858585); font-size: 10px; flex-shrink: 0; margin-left: 4px; }
/* Viewable / non-viewable file distinction */
.tree-node.viewable .node-name { color: var(--vscode-foreground, #ccc); }
.tree-node.non-viewable { opacity: 0.5; cursor: not-allowed; }
.tree-node.non-viewable .node-name { text-decoration: line-through; color: var(--vscode-descriptionForeground, #858585); }
.tree-node.non-viewable .node-icon::after { content: '🔒'; font-size: 9px; margin-left: 2px; vertical-align: super; }
.tree-node.non-viewable .node-meta { opacity: 0.6; }
/* Clickable distinction */
.tree-node.clickable .node-name { color: var(--vscode-foreground, #ccc); }
.tree-node:not(.clickable) { opacity: 0.6; }
.tree-node:not(.clickable) .node-name { color: var(--vscode-descriptionForeground, #858585); }
.tree-children { overflow: hidden; }
.tree-children.collapsed { display: none; }
.empty-state {
  padding: 20px 12px; text-align: center; color: var(--vscode-descriptionForeground, #858585); font-size: 12px;
}
.generate-btn {
  display: block; width: calc(100% - 24px); margin: 8px 12px;
  padding: 6px; border-radius: 4px; border: none;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  font-family: inherit; font-size: 12px; cursor: pointer;
}
.generate-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
.filter-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06)); }
.filter-bar label { display: flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 5px; border-radius: 3px; background: var(--vscode-badge-background, rgba(255,255,255,0.08)); color: var(--vscode-badge-foreground, #ccc); cursor: pointer; white-space: nowrap; }
.filter-bar label input { margin: 0; }
.filter-bar label.active { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); }
</style>
</head>
<body>
<div class="header">
  <span class="header-title" id="projectTitle">Code Map</span>
  <div class="header-actions">
    <button class="icon-btn" title="Refresh" id="refreshBtn">&#x1f504;</button>
    <button class="icon-btn" title="Open Graph" id="openBtn">&#x1f5fa;</button>
  </div>
</div>
<input type="text" class="search-box" id="searchBox" placeholder="Search files...">
<div class="filter-bar" id="filterBar"></div>
<div id="treeRoot"><div class="empty-state">No code map generated yet.<br><button class="generate-btn" id="generateBtn">Generate Code Map</button></div></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let treeData = [];

function renderTree(nodes, level = 0, container = document.getElementById('treeRoot')) {
  if (!nodes || !nodes.length) return;
  const frag = document.createDocumentFragment();
  nodes.forEach(node => {
    const el = document.createElement('div');
    const isViewable = node.type === 'file' ? (node.viewable !== false) : false;
    const viewableCls = node.type === 'file' ? (isViewable ? 'clickable viewable' : 'clickable non-viewable') : '';
    el.className = 'tree-node ' + viewableCls;
    el.style.paddingLeft = (4 + level * 14) + 'px';
    el.dataset.path = node.path || '';
    el.dataset.type = node.type;
    el.dataset.ext = node.ext || '';
    el.dataset.viewable = String(isViewable);
    const hasChildren = node.children && node.children.length > 0;
    const toggle = hasChildren ? '<span class="toggle">&#x25B6;</span>' : '<span class="toggle-spacer"></span>';
    const icon = node.type === 'dir' ? '&#x1f4c1;' : (getFileIcon(node.ext));
    const meta = node.type === 'file' && node.lines ? (node.lines + ' lines') : '';
    const tooltip = node.type === 'file' ? (isViewable ? 'Viewable file' : 'Non-viewable file (binary or unreadable)') : 'Directory';
    el.innerHTML = toggle + '<span class="node-icon">' + icon + '</span><span class="node-name" title="' + escapeHtml(node.path) + ' — ' + tooltip + '">' + escapeHtml(node.name) + '</span>' + (meta ? '<span class="node-meta">' + meta + '</span>' : '');
    frag.appendChild(el);
    if (hasChildren) {
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children collapsed';
      childWrap.dataset.parent = node.path;
      renderTree(node.children, level + 1, childWrap);
      frag.appendChild(childWrap);
    }
  });
  if (level === 0) { container.textContent = ''; }
  container.appendChild(frag);
}

function getFileIcon(ext) {
  const map = {
    '.js': '&#x1f4dc;', '.ts': '&#x1f4d8;', '.tsx': '&#x269b;', '.jsx': '&#x269b;',
    '.cjs': '&#x1f4dc;', '.mjs': '&#x1f4dc;', '.py': '&#x1f40d;',
    '.json': '&#x1f4cb;', '.md': '&#x1f4dd;', '.html': '&#x1f310;',
    '.css': '&#x1f3a8;', '.scss': '&#x1f3a8;', '.go': '&#x1f42f;',
    '.java': '&#x2615;', '.rs': '&#x2699;', '.cpp': '&#x1f527;',
    '.c': '&#x1f527;', '.cs': '&#x1f537;', '.php': '&#x1f418;',
    '.rb': '&#x1f48e;', '.swift': '&#x1f989;', '.kt': '&#x1f7e3;'
  };
  return map[ext] || '&#x1f4c4;';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Toggle expand/collapse
document.getElementById('treeRoot').addEventListener('click', (e) => {
  const toggle = e.target.closest('.toggle');
  if (toggle) {
    e.stopPropagation();
    const node = toggle.closest('.tree-node');
    const children = node.nextElementSibling;
    if (children && children.classList.contains('tree-children')) {
      const isCollapsed = children.classList.contains('collapsed');
      children.classList.toggle('collapsed', !isCollapsed);
      toggle.innerHTML = isCollapsed ? '&#x25BC;' : '&#x25B6;';
    }
    return;
  }
  const nodeEl = e.target.closest('.tree-node');
  if (nodeEl && nodeEl.dataset.type === 'file') {
    if (nodeEl.dataset.viewable !== 'true') return;
    document.querySelectorAll('.tree-node.selected').forEach(n => n.classList.remove('selected'));
    nodeEl.classList.add('selected');
    vscode.postMessage({ command: 'selectFile', path: nodeEl.dataset.path });
  }
});

// Search
document.getElementById('searchBox').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.tree-node').forEach(node => {
    const name = node.querySelector('.node-name');
    if (!name) return;
    const match = name.textContent.toLowerCase().includes(q);
    node.style.display = match ? 'flex' : 'none';
    if (match && node.dataset.type === 'file') {
      let parent = node.parentElement;
      while (parent && parent.classList.contains('tree-children')) {
        parent.classList.remove('collapsed');
        const prev = parent.previousElementSibling;
        if (prev) { const t = prev.querySelector('.toggle'); if (t) t.innerHTML = '&#x25BC;'; }
        parent = parent.parentElement;
      }
    }
  });
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  vscode.postMessage({ command: 'refreshTree' });
});
document.getElementById('openBtn').addEventListener('click', () => {
  vscode.postMessage({ command: 'openCodeMapPanel' });
});
document.getElementById('generateBtn')?.addEventListener('click', () => {
  vscode.postMessage({ command: 'generateCodeMap' });
});

// Build filter bar from tree data
function buildFilterBar(nodes) {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
  bar.textContent = '';
  const exts = new Map();
  function collectExts(nList) {
    nList.forEach(n => {
      if (n.type === 'file') {
        const ext = n.ext || '(no ext)';
        exts.set(ext, (exts.get(ext) || 0) + 1);
      }
      if (n.children && n.children.length) collectExts(n.children);
    });
  }
  collectExts(nodes);
  if (exts.size === 0) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  const sorted = [...exts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  sorted.forEach(([ext, count]) => {
    const label = document.createElement('label');
    label.className = 'active';
    label.innerHTML = '<input type="checkbox" checked data-ext="' + ext + '"> ' + ext + ' (' + count + ')';
    label.querySelector('input').addEventListener('change', () => {
      label.classList.toggle('active', label.querySelector('input').checked);
      applyFilters();
    });
    bar.appendChild(label);
  });
  const dirLabel = document.createElement('label');
  dirLabel.className = 'active';
  dirLabel.innerHTML = '<input type="checkbox" checked data-dirs="1"> &#x1f4c1; dirs';
  dirLabel.querySelector('input').addEventListener('change', () => {
    dirLabel.classList.toggle('active', dirLabel.querySelector('input').checked);
    applyFilters();
  });
  bar.appendChild(dirLabel);
}

function applyFilters() {
  const checkedExts = new Set([...document.querySelectorAll('.filter-bar input[data-ext]:checked')].map(i => i.dataset.ext));
  const showDirs = document.querySelector('.filter-bar input[data-dirs]')?.checked ?? true;
  document.querySelectorAll('.tree-node').forEach((node) => {
    const type = node.dataset.type;
    if (type === 'dir') {
      node.style.display = showDirs ? '' : 'none';
    } else {
      const ext = node.dataset.ext || '(no ext)';
      node.style.display = checkedExts.has(ext) ? '' : 'none';
    }
  });
  document.querySelectorAll('.tree-children').forEach((container) => {
    const visible = [...container.children].some(c => c.style.display !== 'none');
    container.style.display = visible ? '' : 'none';
    const prev = container.previousElementSibling;
    if (prev) prev.style.display = visible ? '' : 'none';
  });
}

// Handle messages from extension
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.command === 'updateTree') {
    treeData = msg.tree || [];
    const titleEl = document.getElementById('projectTitle');
    if (msg.projectName) titleEl.textContent = msg.projectName;
    const root = document.getElementById('treeRoot');
    if (!treeData.length) {
      root.innerHTML = '<div class="empty-state">No files found.<br><button class="generate-btn" id="generateBtn">Generate Code Map</button></div>';
      document.getElementById('generateBtn')?.addEventListener('click', () => vscode.postMessage({ command: 'generateCodeMap' }));
    } else {
      renderTree(treeData);
      buildFilterBar(treeData);
      // Auto-expand first 2 levels
      setTimeout(() => {
        document.querySelectorAll('.tree-children').forEach(el => {
          const depth = el.parentElement.closest('.tree-children') ? 2 : 1;
          if (depth <= 2) {
            el.classList.remove('collapsed');
            const prev = el.previousElementSibling;
            if (prev) { const t = prev.querySelector('.toggle'); if (t) t.innerHTML = '&#x25BC;'; }
          }
        });
      }, 0);
    }
  }
});

// Request tree on load
vscode.postMessage({ command: 'refreshTree' });
</script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _loadTreeData() {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspace || !this._view) return;
    const treeJsonPath = path.join(workspace, '.simplebeacon', 'codemap-tree.json');
    let tree: CodeMapTreeNode[] = [];
    let projectName = 'Code Map';
    try {
      if (fs.existsSync(treeJsonPath)) {
        const raw = JSON.parse(fs.readFileSync(treeJsonPath, 'utf8'));
        tree = raw.tree || [];
        projectName = raw.projectName || projectName;
      }
    } catch {
      // ignore
    }
    this._cachedTree = tree;
    this._cachedProjectName = projectName;
    this._view.webview.postMessage({ command: 'updateTree', tree, projectName });
  }

  public refresh() {
    this._loadTreeData();
  }

  public static refreshInstance() {
    CodeMapTreeProvider._instance?.refresh();
  }
}
