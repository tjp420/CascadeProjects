import * as vscode from 'vscode';
import { getSbConfig } from '../utils';
import { getDataServerPort } from '../dataServer';
import { AccountTracker } from '../accountTracker';

const TOKEN_KEY = 'simplebeacon.apiToken';
const PASSWORD_KEY = 'simplebeacon.apiPassword';
const USER_EMAIL_KEY = 'simplebeacon.userEmail';
const USER_NAME_KEY = 'simplebeacon.userName';
const SERVER_URL_KEY = 'simplebeacon.apiServerUrl';
function getDefaultServerUrl(): string {
  return getSbConfig().get<string>('apiUrl', 'http://127.0.0.1:3000');
}

/**
 * Authentication manager for SimpleBeacon server API.
 * Stores token securely in VS Code secret storage (or globalState fallback).
 */
export class AuthManager {
  private context: vscode.ExtensionContext;
  private tracker: AccountTracker;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.tracker = new AccountTracker(context);
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

    const config = getSbConfig();
    const settingsToken = config.get<string>('apiToken', '');
    if (settingsToken) return settingsToken;

    const globalToken = this.context.globalState.get<string>(TOKEN_KEY);
    return globalToken;
  }

  /**
   * Store the API token securely.
   */
  async setToken(token: string): Promise<void> {
    await this.context.secrets.store(TOKEN_KEY, token);
    try { await this.tracker.recordLogin(token, 'extension', 'tokenStored'); } catch {}
  }

  /**
   * Clear the stored token.
   */
  async clearToken(): Promise<void> {
    const existing = await this.getToken();
    await this.context.secrets.delete(TOKEN_KEY);
    if (existing) {
      try { await this.tracker.recordLogout(existing, 'extension', 'tokenCleared'); } catch {}
    }
  }

  /**
   * Get the stored API password.
   */
  async getPassword(): Promise<string | undefined> {
    try {
      const secret = await this.context.secrets.get(PASSWORD_KEY);
      if (secret) return secret;
    } catch {
      // Fallback to globalState if secrets not available
    }
    const globalPassword = this.context.globalState.get<string>(PASSWORD_KEY);
    return globalPassword;
  }

  /**
   * Store the API password securely.
   */
  async setPassword(password: string): Promise<void> {
    await this.context.secrets.store(PASSWORD_KEY, password);
  }

  /**
   * Clear the stored password.
   */
  async clearPassword(): Promise<void> {
    await this.context.secrets.delete(PASSWORD_KEY);
  }

  /**
   * Get the stored user email.
   */
  async getUserEmail(): Promise<string | undefined> {
    try {
      const secret = await this.context.secrets.get(USER_EMAIL_KEY);
      if (secret) return secret;
    } catch {}
    return this.context.globalState.get<string>(USER_EMAIL_KEY);
  }

  /**
   * Store the user email.
   */
  async setUserEmail(email: string): Promise<void> {
    await this.context.secrets.store(USER_EMAIL_KEY, email);
  }

  /**
   * Get the stored user name.
   */
  async getUserName(): Promise<string | undefined> {
    try {
      const secret = await this.context.secrets.get(USER_NAME_KEY);
      if (secret) return secret;
    } catch {}
    return this.context.globalState.get<string>(USER_NAME_KEY);
  }

  /**
   * Store the user name.
   */
  async setUserName(name: string): Promise<void> {
    await this.context.secrets.store(USER_NAME_KEY, name);
  }

  /**
   * Return true if a token is currently stored.
   */
  async isSignedIn(): Promise<boolean> {
    return !!(await this.getToken());
  }

  /**
   * Get the configured API server URL.
   */
  getServerUrl(): string {
    const config = getSbConfig();
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
    const raw = await vscode.window.showInputBox({
      title: 'SimpleBeacon API Token',
      prompt: 'Paste your token from the dashboard (localStorage "cascadeAuthToken")',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        const trimmed = (value || '').trim();
        if (!trimmed || trimmed.length < 10) {
          return 'Token looks too short — copy the full JWT from your browser';
        }
        const parts = trimmed.split('.');
        if (parts.length !== 2 && parts.length !== 3) {
          return 'Token must be a JWT (3 dots) or license key (1 dot) — ensure you copied only the token value, not the full JSON response';
        }
        return undefined;
      },
    });

    const token = raw ? raw.trim() : undefined;
    if (!token) { return undefined; }

    // Check if this token is already registered on the server
    try {
      const port = getDataServerPort();
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/token-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json() as { registered?: boolean };
        if (data.registered) {
          vscode.window.showErrorMessage('This token is already registered. Use a different token or sign in with the existing one.');
          return undefined;
        }
      }
    } catch {
      // Data server not running; allow local-only registration
    }

    // Also check local storage to prevent overwriting the same token
    const existingToken = await this.getToken();
    if (existingToken === token) {
      vscode.window.showErrorMessage('This token is already saved locally.');
      return undefined;
    }

    await this.setToken(token);
    vscode.window.showInformationMessage('SimpleBeacon API token saved — complete registration in the panel that opens');
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
      const config = getSbConfig();
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
