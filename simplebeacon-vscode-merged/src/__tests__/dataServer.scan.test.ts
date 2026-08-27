// simplebeacon-ignore: test fixture, dashboard code — integration test for scan endpoint contract
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
    const executeCommand = jest.fn();
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
      commands: { executeCommand },
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

const MOCK_REPORT = {
  totalFiles: 5,
  totalLines: 200,
  issueCount: 2,
  gate: { pass: false, blockingCount: 1, warningCount: 1 },
  detectedIssues: [
    { severity: 'high', type: 'test-issue', filePath: 'test.js', line: 10, description: 'Test finding' },
  ],
  generatedAt: new Date().toISOString(),
};

describe('/api/analyze/flexible scan endpoint', () => {
  beforeAll(async () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-scan-test-'));
    vscode.workspace.workspaceFolders.push({
      name: 'test',
      uri: vscode.Uri.file(tempWorkspace),
    });
    vscode.commands.executeCommand.mockReset();
    vscode.commands.executeCommand.mockResolvedValue(MOCK_REPORT);
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

  afterEach(() => {
    vscode.commands.executeCommand.mockClear();
  });

  it('invokes simplebeacon.scanWorkspace when projectPath is provided', async () => {
    const { status, body } = await request('POST', '/api/analyze/flexible', {
      projectPath: tempWorkspace,
      analysisType: 'full',
    });
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    expect(json.status).toBe('complete');
    expect(json.report).toBeTruthy();
    expect(json.report.totalFiles).toBe(5);
    expect(json.report.gate.pass).toBe(false);

    // Verify the extension scan command was called with the correct args
    expect(vscode.commands.executeCommand).toHaveBeenCalled();
    const callArgs = vscode.commands.executeCommand.mock.calls[0];
    expect(callArgs[0]).toBe('simplebeacon.scanWorkspace');
    expect(callArgs[1]).toMatchObject({ projectPath: tempWorkspace });
  });

  it('returns the actual scan report, not stale cached data', async () => {
    vscode.commands.executeCommand.mockResolvedValueOnce({
      ...MOCK_REPORT,
      totalFiles: 999,
      gate: { pass: true, blockingCount: 0, warningCount: 0 },
    });

    const { body } = await request('POST', '/api/analyze/flexible', {
      projectPath: tempWorkspace,
    });
    const json = JSON.parse(body);
    expect(json.report.totalFiles).toBe(999);
    expect(json.report.gate.pass).toBe(true);
  });

  it('falls back to cached report when scan command returns undefined', async () => {
    vscode.commands.executeCommand.mockResolvedValueOnce(undefined);

    const { status, body } = await request('POST', '/api/analyze/flexible', {
      projectPath: tempWorkspace,
    });
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    // Fallback returns cached report (may be empty object if no prior scan)
    expect(json.report).toBeDefined();
  });

  it('falls back to cached report when scan command throws', async () => {
    vscode.commands.executeCommand.mockRejectedValueOnce(new Error('scan failed'));

    const { status, body } = await request('POST', '/api/analyze/flexible', {
      projectPath: tempWorkspace,
    });
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    expect(json.report).toBeDefined();
  });

  it('returns roadmap data when analysisType is roadmap', async () => {
    const { status, body } = await request('POST', '/api/analyze/flexible', {
      projectPath: tempWorkspace,
      analysisType: 'roadmap',
    });
    expect(status).toBe(200);
    const json = JSON.parse(body);
    expect(json.success).toBe(true);
    expect(json.roadmap).toBeDefined();
    // Roadmap should not trigger a scan
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });
});
