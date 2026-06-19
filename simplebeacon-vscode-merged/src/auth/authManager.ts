import * as vscode from 'vscode';

const TOKEN_KEY = 'simplebeacon.apiToken';
const SERVER_URL_KEY = 'simplebeacon.apiServerUrl';
function getDefaultServerUrl(): string {
  return vscode.workspace.getConfiguration('simplebeacon').get<string>('apiUrl', 'http://127.0.0.1:3000');
}

/**
 * Authentication manager for SimpleBeacon server API.
 * Stores token securely in VS Code secret storage (or globalState fallback).
 */
export class AuthManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get the stored API token.
   * Priority: secretStorage > globalState > settings.
   */
  async getToken(): Promise<string | undefined> {
    try {
      const secret = await this.context.secrets.get(TOKEN_KEY);
      if (secret) return secret;
    } catch {
      // Fallback to globalState if secrets not available
    }

    const config = vscode.workspace.getConfiguration('simplebeacon');
    const settingsToken = config.get<string>('apiToken', '');
    if (settingsToken) return settingsToken;

    const globalToken = this.context.globalState.get<string>(TOKEN_KEY);
    return globalToken;
  }

  /**
   * Store the API token securely.
   */
  async setToken(token: string): Promise<void> {
    try {
      await this.context.secrets.store(TOKEN_KEY, token);
    } catch {
      this.context.globalState.update(TOKEN_KEY, token);
    }
  }

  /**
   * Clear the stored token.
   */
  async clearToken(): Promise<void> {
    try {
      await this.context.secrets.delete(TOKEN_KEY);
    } catch {
      // ignore
    }
    this.context.globalState.update(TOKEN_KEY, undefined);
  }

  /**
   * Get the configured API server URL.
   */
  getServerUrl(): string {
    const config = vscode.workspace.getConfiguration('simplebeacon');
    return config.get<string>('apiServerUrl', getDefaultServerUrl()).replace(/\/$/, '');
  }

  /**
   * Build Authorization header if token exists.
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Show a prompt to enter the API token.
   */
  async promptForToken(): Promise<string | undefined> {
    const token = await vscode.window.showInputBox({
      title: 'SimpleBeacon API Token',
      prompt: 'Paste your token from the dashboard (localStorage "cascadeAuthToken")',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.length < 10) {
          return 'Token looks too short — copy the full JWT from your browser';
        }
        return undefined;
      },
    });

    if (token) {
      await this.setToken(token);
      vscode.window.showInformationMessage('SimpleBeacon API token saved');
    }
    return token;
  }

  /**
   * Prompt for server URL if not set.
   */
  async promptForServerUrl(): Promise<string> {
    const current = this.getServerUrl();
    const url = await vscode.window.showInputBox({
      title: 'SimpleBeacon API Server URL',
      prompt: 'Enter host:port or full URL (e.g. http://my-server:8080)',
      value: current,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) return 'URL cannot be empty';
        const trimmed = value.trim();
        // Allow bare host:port patterns
        if (/^[\w.-]+:\d+$/.test(trimmed)) return undefined;
        // Allow full URLs
        try {
          new URL(trimmed);
          return undefined;
        } catch {
          return 'Invalid — use host:port or full URL';
        }
      },
    });

    if (url) {
      let normalized = url.trim();
      // Auto-prepend http:// for bare host:port
      if (/^[\w.-]+:\d+$/.test(normalized) && !/^https?:\/\//.test(normalized)) {
        normalized = 'http://' + normalized;
      }
      normalized = normalized.replace(/\/$/, '');
      const config = vscode.workspace.getConfiguration('simplebeacon');
      await config.update('apiServerUrl', normalized, true);
      vscode.window.showInformationMessage(`SimpleBeacon server URL set to ${normalized}`);
      return normalized;
    }
    return current;
  }

  /**
   * Check if token is present and show UI if not.
   */
  async ensureToken(): Promise<string | undefined> {
    const token = await this.getToken();
    if (token) return token;

    const choice = await vscode.window.showWarningMessage(
      'No SimpleBeacon API token configured. Higher-tier features require authentication.',
      'Enter Token',
      'Skip'
    );

    if (choice === 'Enter Token') {
      return this.promptForToken();
    }
    return undefined;
  }
}
