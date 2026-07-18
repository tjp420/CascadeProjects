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
    const workspaceFolders: any[] = [];
    return {
      workspace: {
        workspaceFolders,
        getConfiguration: () => ({
          get: (key: string, def: any) => (key === 'dataServerPort' ? 0 : def),
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
        subscriptions: any[] = [];
        workspaceState = { get: () => undefined, update: async () => {} };
        globalState = { get: () => undefined, update: async () => {} };
        secrets = { get: async () => undefined, store: async () => {}, delete: async () => {} };
      },
    };
  },
  { virtual: true }
);

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
      res.on('data', (chunk) => { body += chunk; });
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
});
