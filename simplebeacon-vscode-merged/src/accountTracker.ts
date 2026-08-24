import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const LOG_FILE_NAME = 'simplebeacon-accounts.jsonl';
const MAX_LINES = 10000;

export interface AccountEvent {
  timestamp: string;
  event:
    | 'login'
    | 'logout'
    | 'tokenStored'
    | 'tokenCleared'
    | 'licenseStored'
    | 'autoToken'
    | 'preExisting'
    | 'webviewLogin'
    | 'webviewLogout';
  source: 'extension' | 'webview';
  accountId: string;
  email: string;
  tier: string;
  tokenType: 'jwt' | 'license' | 'free-community' | 'unknown';
  details?: string;
}

/**
 * Lightweight append-only account audit tracker.
 * Stores SHA-256 hashed token previews (never raw tokens) in a JSON Lines file
 * inside the extension's global storage directory.
 */
export class AccountTracker {
  private logPath: string;

  constructor(contextOrPath: vscode.ExtensionContext | string) {
    let dir: string;
    if (typeof contextOrPath === 'string') {
      dir = contextOrPath;
    } else if (contextOrPath.globalStorageUri) {
      dir = contextOrPath.globalStorageUri.fsPath;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      dir = path.join(require('os').tmpdir(), 'simplebeacon');
    }
    this.logPath = path.join(dir, LOG_FILE_NAME);
    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  /** Hash a token for safe correlation without storing the raw value. */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
  }

  /** Decode JWT payload to extract email and tier. Returns null for non-JWT tokens. */
  decodeJwtPayload(token: string): { email?: string; tier?: string } | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64url = parts[1];
    try {
      const base64 = payloadBase64url.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = Buffer.from(base64 + padding, 'base64').toString('utf8');
      const payload = JSON.parse(decoded);
      const email =
        payload.email || payload.sub || payload.username || payload.preferred_username || payload.name || '';
      const tier = payload.tier || payload.plan || payload.product || '';
      return { email, tier };
    } catch {
      return null;
    }
  }

  /** Determine token type from string format. */
  getTokenType(token: string): AccountEvent['tokenType'] {
    if (!token) return 'unknown';
    const parts = token.split('.');
    if (parts.length === 3 && parts.every((p) => p.length > 0)) return 'jwt';
    if (parts.length === 2 && parts.every((p) => p.length > 0)) return 'license';
    return 'unknown';
  }

  /** Record a login or token-storage event. */
  async recordLogin(
    token: string,
    source: AccountEvent['source'],
    eventType: AccountEvent['event'],
    details?: string
  ): Promise<void> {
    const accountId = this.hashToken(token);
    const jwtInfo = this.decodeJwtPayload(token);
    const tokenType = this.getTokenType(token);
    const event: AccountEvent = {
      timestamp: new Date().toISOString(),
      event: eventType,
      source,
      accountId,
      email: jwtInfo?.email || '',
      tier: jwtInfo?.tier || (tokenType === 'license' ? 'license' : ''),
      tokenType,
      details,
    };
    await this.appendEvent(event);
  }

  /** Record a logout or token-clear event. */
  async recordLogout(tokenOrHash: string, source: AccountEvent['source'], details?: string): Promise<void> {
    const accountId = tokenOrHash.includes('.') ? this.hashToken(tokenOrHash) : tokenOrHash;
    const event: AccountEvent = {
      timestamp: new Date().toISOString(),
      event: 'logout',
      source,
      accountId,
      email: '',
      tier: '',
      tokenType: 'unknown',
      details,
    };
    await this.appendEvent(event);
  }

  /** Return tracked events, newest first. */
  async getHistory(limit = 100): Promise<AccountEvent[]> {
    try {
      if (!fs.existsSync(this.logPath)) return [];
      const data = fs.readFileSync(this.logPath, 'utf8');
      const lines = data.split('\n').filter((line) => line.trim());
      const events: AccountEvent[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
      return events.reverse().slice(0, limit);
    } catch {
      return [];
    }
  }

  /** Export history to a target file path. */
  async exportToFile(targetPath: string): Promise<void> {
    try {
      if (!fs.existsSync(this.logPath)) {
        fs.writeFileSync(targetPath, '', 'utf8');
        return;
      }
      fs.copyFileSync(this.logPath, targetPath);
    } catch (err) {
      throw new Error('Failed to export account history: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  /** Append a single event to the JSONL file, rotating if needed. */
  private async appendEvent(event: AccountEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, 'utf8');
    } catch {
      // If append fails, try creating the file
      fs.writeFileSync(this.logPath, line, 'utf8');
    }
    await this.maybeRotate();
  }

  /** Rotate file if it exceeds MAX_LINES. */
  private async maybeRotate(): Promise<void> {
    try {
      const stats = fs.statSync(this.logPath);
      if (stats.size < 1024 * 100) return; // Skip check for small files
      const data = fs.readFileSync(this.logPath, 'utf8');
      const lines = data.split('\n').filter((l) => l.trim());
      if (lines.length <= MAX_LINES) return;
      // Keep the newest 50% of lines
      const keep = lines.slice(Math.floor(lines.length / 2));
      fs.writeFileSync(this.logPath, keep.join('\n') + '\n', 'utf8');
    } catch {
      // Ignore rotation errors
    }
  }
}

let _trackerInstance: AccountTracker | undefined;

/** Singleton accessor for the account tracker. */
export function getAccountTracker(context?: vscode.ExtensionContext): AccountTracker {
  if (!_trackerInstance && context) {
    _trackerInstance = new AccountTracker(context);
  }
  if (!_trackerInstance) {
    throw new Error('AccountTracker not initialized — pass ExtensionContext first');
  }
  return _trackerInstance;
}
