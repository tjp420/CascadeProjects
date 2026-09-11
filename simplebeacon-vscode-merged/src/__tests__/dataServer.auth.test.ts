// simplebeacon-ignore: test fixture, dashboard code — integration test for auth-me contract
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startDataServer, stopDataServer, getDataServerPort } from '../dataServer';

let tempWorkspace: string;

jest.mock(
  'vscode',
  () => {
    const workspaceFolders: unknown[] = [];
    return {
      workspace: {
        workspaceFolders,
        getConfiguration: () => ({
          get: (key: string, def: unknown) => (key === 'dataServerPort' ? 0 : def),
          has: () => false,
          update: async () => {},
        }),
      },
      window: {
        showOpenDialog: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        createOutputChannel: () => ({ appendLine: jest.fn(), append: jest.fn() }),
      },
      commands: { executeCommand: jest.fn() },
      Uri: { file: (p: string) => ({ fsPath: p }) },
      ExtensionContext: class {
        extensionPath = process.cwd();
        extension = { packageJSON: { version: '0.0.0' } };
        subscriptions: unknown[] = [];
        workspaceState = { get: () => undefined, update: async () => {} };
        globalState = { get: () => undefined, update: async () => {} };
        secrets = { get: async () => undefined, store: async () => {}, delete: async () => {} };
      },
    };
  },
  { virtual: true }
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

function waitForServer(): Promise<void> {
  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout | null = null;
    const interval = setInterval(() => {
      try {
        const port = getDataServerPort();
        if (port > 0) {
          clearInterval(interval);
          if (timeout) clearTimeout(timeout);
          resolve();
        }
      } catch {
        // not listening yet
      }
    }, 100);
    timeout = setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 5000);
  });
}

function request(
  method: string,
  pathname: string,
  data?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const port = getDataServerPort();
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers,
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    if (data) {
      const payload = JSON.stringify(data);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

describe('/api/auth/me contract', () => {
  beforeAll(async () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ds-test-'));
    vscode.workspace.workspaceFolders.push({
      name: 'test',
      uri: vscode.Uri.file(tempWorkspace),
    });
    const context = new vscode.ExtensionContext();
    startDataServer(context);
    await waitForServer();
  });

  afterAll(async () => {
    stopDataServer();
    http.globalAgent.destroy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('returns the unauthenticated contract', async () => {
    const { status, body } = await request('GET', '/api/auth/me');
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    expect(json.authenticated).toBe(false);
    expect(json.user).toBeNull();
  });

  it('returns the authenticated contract with all dashboard fields after login', async () => {
    const login = await request('POST', '/api/auth/login', { email: 'admin@simplebeacon.ai', password: 'admin123' });
    expect(login.status).toBe(200);
    const loginJson = JSON.parse(login.body);
    expect(loginJson.token).toBeTruthy();

    const { status, body } = await request('GET', '/api/auth/me', undefined, {
      Authorization: `Bearer ${loginJson.token}`,
    });
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    expect(json.authenticated).toBe(true);
    expect(json.user).toBeTruthy();
    expect(json.user.id).toBeTruthy();
    expect(json.user.email).toBe('admin@simplebeacon.ai');
    expect(json.user.name).toBeTruthy();
    expect(json.user.tier).toBeTruthy();
    expect(json.user.plan).toBeTruthy();
    expect(json.user.role).toBe('admin');
    expect(Array.isArray(json.user.features)).toBe(true);
    expect(json.user.trustLevel).toBe('gold');
  });

  it('refreshes a local JWT instead of 404', async () => {
    const login = await request('POST', '/api/auth/login', {
      email: 'admin@simplebeacon.ai',
      password: 'admin123',
    });
    const loginJson = JSON.parse(login.body);
    const refresh = await request(
      'POST',
      '/api/auth/refresh',
      { longLived: true },
      { Authorization: `Bearer ${loginJson.token}` }
    );
    expect(refresh.status).toBe(200);
    const json = JSON.parse(refresh.body);
    expect(json.success).toBe(true);
    expect(json.token).toBeTruthy();
  });

  it('returns found:false for SSO and whitelabel on the local data server', async () => {
    const sso = await request('GET', '/api/sso/resolve?email=admin%40simplebeacon.ai');
    expect(sso.status).toBe(200);
    expect(JSON.parse(sso.body).found).toBe(false);
    const brand = await request('GET', '/api/whitelabel/resolve?domain=127.0.0.1');
    expect(brand.status).toBe(200);
    expect(JSON.parse(brand.body).found).toBe(false);
  });

  it('returns local empty payloads for cloud-only dashboard APIs', async () => {
    const interdiction = await request('GET', '/api/audit/interdiction/stream/status');
    expect(interdiction.status).toBe(200);
    const interdictionJson = JSON.parse(interdiction.body);
    expect(interdictionJson.success).toBe(true);
    expect(interdictionJson.enabled).toBe(false);

    const quarantine = await request('GET', '/api/audit/quarantine');
    expect(quarantine.status).toBe(200);
    expect(JSON.parse(quarantine.body).entries).toEqual([]);

    const failover = await request('GET', '/api/provider-failover/stats');
    expect(failover.status).toBe(200);
    expect(JSON.parse(failover.body).success).toBe(true);

    const subscription = await request('GET', '/api/user/subscription');
    expect(subscription.status).toBe(200);
    expect(JSON.parse(subscription.body).success).toBe(true);
  });

  it('keeps the default dashboard theme dark and does not toggle on empty POST', async () => {
    const first = await request('GET', '/api/theme');
    expect(first.status).toBe(200);
    expect(JSON.parse(first.body).theme).toBe('dark');

    const emptyPost = await request('POST', '/api/theme', {});
    expect(emptyPost.status).toBe(200);
    expect(JSON.parse(emptyPost.body).theme).toBe('dark');

    const setLight = await request('POST', '/api/theme', { theme: 'light' });
    expect(JSON.parse(setLight.body).theme).toBe('light');
    const setDark = await request('POST', '/api/theme', { theme: 'dark' });
    expect(JSON.parse(setDark.body).theme).toBe('dark');
  });

  it('serves hashed dashboard chunks from assets/ instead of HTML', async () => {
    const chunk = await request('GET', '/dashboard/v2-TeamMetricsView-B3qlOqlW.js');
    expect(chunk.status).toBe(200);
    expect(chunk.body.startsWith('<!doctype html>')).toBe(false);
    expect(chunk.body).toMatch(/TeamMetricsView|function|export/i);
  });

  it('proxies unknown credentials to the hosted login API', async () => {
    const origFetch = global.fetch;
    const cloudToken = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InJlYWxAZXhhbXBsZS5jb20ifQ.sig';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, token: cloudToken, user: { email: 'real@example.com', tier: 'developer' } }),
    }) as unknown as typeof fetch;
    try {
      const login = await request('POST', '/api/auth/login', {
        email: 'real@example.com',
        password: 'correct-horse',
      });
      expect(login.status).toBe(200);
      const json = JSON.parse(login.body);
      expect(json.token).toBe(cloudToken);
      expect(json.user.email).toBe('real@example.com');
      expect(global.fetch).toHaveBeenCalled();
    } finally {
      global.fetch = origFetch;
    }
  });
});
