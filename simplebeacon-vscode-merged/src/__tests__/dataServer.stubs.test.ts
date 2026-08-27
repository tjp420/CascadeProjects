// simplebeacon-ignore: test fixture, dashboard code — integration test for stub endpoint contracts
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
  data?: object
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const port = getDataServerPort();
    const opts: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
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

/**
 * All known stub endpoints in dataServer.ts.
 * Online-only stubs return { success: false, reason: 'online-account-required' }.
 * Local stubs return { success: true, data: ... }.
 * This test catches regressions when stubs are replaced with real implementations.
 */
const ONLINE_ONLY_ENDPOINTS: Array<{ method: string; path: string; description: string }> = [
  { method: 'GET', path: '/api/security/npm-audit', description: 'npm audit (online-only)' },
  { method: 'GET', path: '/api/optimization/merge-preview', description: 'merge preview (online-only)' },
  { method: 'GET', path: '/api/optimization/analyze', description: 'optimization analysis (online-only)' },
  { method: 'GET', path: '/api/optimization/merge-execute', description: 'merge execution (online-only)' },
  { method: 'GET', path: '/api/simplebeacon/ci/telemetry/summary', description: 'CI telemetry (online-only)' },
  { method: 'GET', path: '/api/webauthn/status', description: 'WebAuthn status (online-only)' },
  { method: 'GET', path: '/api/admin/users', description: 'admin users (online-only)' },
  { method: 'GET', path: '/api/admin/sessions', description: 'admin sessions (online-only)' },
];

const LOCAL_STUB_ENDPOINTS: Array<{ method: string; path: string; description: string }> = [
  { method: 'GET', path: '/api/merger-tool/reduction-scan', description: 'merge reduction scan (local)' },
  { method: 'GET', path: '/api/platform/status', description: 'platform status (local)' },
];

describe('Stub endpoints return valid responses', () => {
  beforeAll(async () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-stub-test-'));
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

  for (const endpoint of ONLINE_ONLY_ENDPOINTS) {
    it(`${endpoint.method} ${endpoint.path} returns 200 with online-account-required`, async () => {
      const { status, body } = await request(endpoint.method, endpoint.path);
      expect(status).toBe(200);
      const json = JSON.parse(body);
      expect(json.success).toBe(false);
      expect(json.reason).toBe('online-account-required');
      expect(json.message).toBeTruthy();
    });
  }

  for (const endpoint of LOCAL_STUB_ENDPOINTS) {
    it(`${endpoint.method} ${endpoint.path} returns 200 with valid JSON`, async () => {
      const { status, body } = await request(endpoint.method, endpoint.path);
      expect(status).toBe(200);
      expect(() => JSON.parse(body)).not.toThrow();
      const json = JSON.parse(body);
      expect(json).toBeTruthy();
    });
  }

  it('GET /api/health returns 200 with service info', async () => {
    const { status, body } = await request('GET', '/api/health');
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.status).toBe('ok');
    expect(json.service).toBeTruthy();
    expect(json.port).toBeTruthy();
  });

  it('GET /api/ping returns 200', async () => {
    const { status, body } = await request('GET', '/api/ping');
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.online).toBe(true);
  });
});
