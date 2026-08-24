import * as vscode from 'vscode';
import * as http from 'http';
import { getDataServerPort } from './dataServer';

export class AiChatbotProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'simplebeacon-ai-chatbot';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'copy') {
        await vscode.env.clipboard.writeText(message.text || '');
        vscode.window.showInformationMessage('AI context copied to clipboard');
      } else if (message.command === 'openContext') {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          const contextPath = vscode.Uri.joinPath(ws.uri, '.simplebeacon', 'ai-context.md');
          await vscode.commands.executeCommand('vscode.open', contextPath);
        }
      } else if (message.command === 'requestContext') {
        const port = getDataServerPort();
        if (!port) {
          this._view?.webview.postMessage({
            command: 'setContext',
            context: null,
            content: '',
            error: 'Data server is not running',
          });
          return;
        }
        const req = http.get(`http://127.0.0.1:${port}/api/ai-context`, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              this._view?.webview.postMessage({
                command: 'setContext',
                context: data.context,
                content: data.content,
                error: data.success ? undefined : data.error,
              });
            } catch {
              this._view?.webview.postMessage({
                command: 'setContext',
                context: null,
                content: '',
                error: 'Invalid response from data server',
              });
            }
          });
        });
        req.on('error', (err) => {
          this._view?.webview.postMessage({ command: 'setContext', context: null, content: '', error: err.message });
        });
        req.setTimeout(5000, () => {
          req.destroy();
          this._view?.webview.postMessage({
            command: 'setContext',
            context: null,
            content: '',
            error: 'Request timed out',
          });
        });
      }
    });

    // Push the current data server port so the panel polls the correct endpoint
    this.postPort(getDataServerPort());
  }

  private _getHtml(webview: vscode.Webview): string {
    const port = getDataServerPort();
    const csp = webview.cspSource;
    const nonce = this._getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src http://127.0.0.1:${port} ${csp}; script-src 'nonce-${nonce}'; style-src ${csp} 'unsafe-inline'; img-src ${csp} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    color: var(--vscode-foreground, #ccc);
    background: var(--vscode-editor-background, #1e1e1e);
    margin: 0; padding: 12px;
    font-size: 13px;
    line-height: 1.5;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
  }
  .title { font-weight: 600; font-size: 14px; }
  .status { font-size: 11px; color: var(--vscode-descriptionForeground, #858585); }
  .empty {
    padding: 20px 12px; text-align: center; color: var(--vscode-descriptionForeground, #858585);
    border: 1px dashed var(--vscode-panel-border, #3c3c3c); border-radius: 6px;
  }
  .content {
    white-space: pre-wrap; font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 12px; padding: 12px; border-radius: 6px;
    background: var(--vscode-panel-background, #252526);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    max-height: calc(100vh - 140px); overflow-y: auto;
  }
  .actions {
    display: flex; gap: 8px; margin-top: 12px;
  }
  button {
    flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    cursor: pointer; font-size: 12px;
  }
  button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground, #3c3c3c);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #4a4a4a); }
  .toast {
    margin-top: 12px;
    padding: 8px 12px; border-radius: 6px; font-size: 12px;
    background: var(--vscode-inputValidation-infoBackground, rgba(17,143,208,0.1));
    color: var(--vscode-inputValidation-infoForeground, #3794ff);
    border: 1px solid var(--vscode-inputValidation-infoBorder, rgba(55,148,255,0.3));
    display: none;
  }
  .toast.show { display: block; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">AI Coding Agent</div>
    <div class="status" id="status">Waiting for context…</div>
  </div>
  <div class="empty" id="empty">
    <div>No AI context available yet.</div>
    <div>Run a scan or analysis in the dashboard and click <strong>Send to AI</strong>, or click the button below.</div>
    <button id="loadBtn" class="secondary" style="margin-top: 12px; max-width: 160px;">Load Context</button>
  </div>
  <div class="content" id="content" style="display:none;"></div>
  <div class="actions" id="actions" style="display:none;">
    <button id="copyBtn">Copy to Clipboard</button>
    <button id="openBtn" class="secondary">Open as File</button>
  </div>
  <div class="toast" id="toast"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const statusEl = document.getElementById('status');
    const emptyEl = document.getElementById('empty');
    const contentEl = document.getElementById('content');
    const actionsEl = document.getElementById('actions');
    const copyBtn = document.getElementById('copyBtn');
    const openBtn = document.getElementById('openBtn');
    const loadBtn = document.getElementById('loadBtn');
    const toastEl = document.getElementById('toast');

    let currentMarkdown = '';

    function showToast(message) {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 2500);
    }

    function clearError() {
      const errorEl = document.getElementById('errorDetail');
      if (errorEl) errorEl.remove();
    }

    function showError(message) {
      statusEl.textContent = 'Context load failed';
      emptyEl.style.display = 'block';
      contentEl.style.display = 'none';
      actionsEl.style.display = 'none';
      let errorEl = document.getElementById('errorDetail');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'errorDetail';
        errorEl.style.color = 'var(--vscode-errorForeground, #f48771)';
        errorEl.style.fontSize = '11px';
        errorEl.style.marginTop = '8px';
        emptyEl.appendChild(errorEl);
      }
      errorEl.textContent = message;
    }

    function renderContext(data) {
      if (data && data.error) {
        showError(data.error);
        return;
      }
      if (!data || !data.context) {
        clearError();
        emptyEl.style.display = 'block';
        contentEl.style.display = 'none';
        actionsEl.style.display = 'none';
        statusEl.textContent = 'Waiting for context…';
        return;
      }
      clearError();
      emptyEl.style.display = 'none';
      contentEl.style.display = 'block';
      actionsEl.style.display = 'flex';
      currentMarkdown = data.content || '';
      contentEl.textContent = currentMarkdown;
      const reportType = data.context.reportType || 'scan-summary';
      const issueCount = Array.isArray(data.context.issues) ? data.context.issues.length : 0;
      statusEl.textContent = 'Received: ' + reportType + (issueCount ? ' (' + issueCount + ' findings)' : '');
      showToast('New AI context received');
    }

    function loadContext() {
      statusEl.textContent = 'Loading context…';
      vscode.postMessage({ command: 'requestContext' });
    }

    // Handle extension messages that push current context
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || !msg.command) return;
      if (msg.command === 'setContext') {
        renderContext(msg);
      }
    });

    copyBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'copy', text: currentMarkdown });
    });

    openBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'openContext' });
    });

    loadBtn.addEventListener('click', () => {
      loadContext();
    });

    // Poll for updates every 2 seconds
    loadContext();
    setInterval(loadContext, 2000);
  </script>
</body>
</html>`;
  }

  public postPort(port: number): void {
    this._view?.webview.postMessage({ command: 'setPort', port });
  }

  public postContext(context: unknown, content: string): void {
    this._view?.webview.postMessage({ command: 'setContext', context, content });
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
