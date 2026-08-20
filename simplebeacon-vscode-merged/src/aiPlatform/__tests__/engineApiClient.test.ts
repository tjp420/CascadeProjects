/**
 * Tests for the EngineApiClient — verifies HTTP request construction,
 * health check caching, content scanning, and fallback behavior.
 *
 * These tests mock the http module to avoid requiring a running engine.
 */

import { EventEmitter } from 'events';

// Mock the http module with a factory — provides a mutable mock function
const mockRequestFn = jest.fn();
jest.mock('http', () => ({
  request: mockRequestFn,
}));

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: any) => {
        if (key === 'engineUrl') return 'http://localhost:3000';
        if (key === 'engineTimeoutMs') return 15000;
        return defaultValue;
      }),
    })),
  },
}));

function createMockRes(statusCode: number, data: string): any {
  const res: any = new EventEmitter();
  res.statusCode = statusCode;
  process.nextTick(() => {
    res.emit('data', Buffer.from(data));
    res.emit('end');
  });
  return res;
}

function createMockReq(): any {
  const req: any = new EventEmitter();
  req.write = jest.fn();
  req.end = jest.fn();
  req.destroy = jest.fn();
  return req;
}

describe('EngineApiClient', () => {
  let EngineApiClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    EngineApiClient = require('../engineApiClient').EngineApiClient;
  });

  describe('Health checking', () => {
    test('isAvailable returns true when engine responds with status ok', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        return createMockReq();
      });

      const available = await client.isAvailable();
      expect(available).toBe(true);
    });

    test('isAvailable returns false when engine is unreachable', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        const req = createMockReq();
        process.nextTick(() => req.emit('error', new Error('Connection refused')));
        return req;
      });

      const available = await client.isAvailable();
      expect(available).toBe(false);
    });

    test('isAvailable caches result for 30 seconds', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        return createMockReq();
      });

      await client.isAvailable();
      const callCountBefore = mockRequestFn.mock.calls.length;
      const available = await client.isAvailable();
      expect(available).toBe(true);
      expect(mockRequestFn.mock.calls.length).toBe(callCountBefore);
    });

    test('checkHealth bypasses the cache', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        return createMockReq();
      });

      await client.isAvailable();
      await client.checkHealth();
      expect(mockRequestFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('scanContent', () => {
    test('returns null when engine is unavailable', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        const req = createMockReq();
        process.nextTick(() => req.emit('error', new Error('Connection refused')));
        return req;
      });

      const result = await client.scanContent('const x = 1;', 'test.js');
      expect(result).toBeNull();
    });

    test('sends content to /api/realtime/scan-content', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      let callIndex = 0;
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        callIndex++;
        if (callIndex === 1) {
          cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        } else {
          expect(opts.path).toBe('/api/realtime/scan-content');
          expect(opts.method).toBe('POST');
          cb(
            createMockRes(
              200,
              JSON.stringify({
                success: true,
                filename: 'test.js',
                language: 'js',
                engineUsed: 'cli-38-engines',
                findingCount: 1,
                findings: [
                  {
                    id: 'SB-SEC-007a',
                    severity: 'high',
                    type: 'secret-password',
                    filePath: 'test.js',
                    line: 1,
                    column: 1,
                    description: 'Hardcoded password detected',
                    recommendedAction: 'Use process.env.PASSWORD',
                    pattern: 'password',
                    engine: 'cli',
                  },
                ],
                scannedAt: '2026-08-13T12:00:00.000Z',
              })
            )
          );
        }
        return createMockReq();
      });

      const result = await client.scanContent('const password = "secret"', 'test.js');
      expect(result).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.findingCount).toBe(1);
      expect(result.findings[0].id).toBe('SB-SEC-007a');
      expect(result.findings[0].severity).toBe('high');
    });

    test('rejects when engine returns non-200 status', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      let callIndex = 0;
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        callIndex++;
        if (callIndex === 1) {
          cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        } else {
          cb(createMockRes(500, 'Internal server error'));
        }
        return createMockReq();
      });

      await expect(client.scanContent('content', 'test.js')).rejects.toThrow('status 500');
    });

    test('handles timeout gracefully', async () => {
      const client = new EngineApiClient('http://localhost:3000', 1000);
      let callIndex = 0;
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        callIndex++;
        const req = createMockReq();
        if (callIndex === 1) {
          cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        } else {
          process.nextTick(() => req.emit('timeout'));
        }
        return req;
      });

      await expect(client.scanContent('content', 'test.js')).rejects.toThrow('timed out');
    });
  });

  describe('Configuration', () => {
    test('setBaseUrl updates the URL and resets health cache', async () => {
      const client = new EngineApiClient('http://localhost:3000');
      mockRequestFn.mockImplementation((opts: any, cb: (res: any) => void) => {
        cb(createMockRes(200, JSON.stringify({ status: 'ok' })));
        return createMockReq();
      });

      await client.isAvailable();
      expect(client.getBaseUrl()).toBe('http://localhost:3000');

      client.setBaseUrl('http://localhost:3001');
      expect(client.getBaseUrl()).toBe('http://localhost:3001');

      await client.isAvailable();
    });

    test('trailing slash is stripped from base URL', () => {
      const client = new EngineApiClient('http://localhost:3000/');
      expect(client.getBaseUrl()).toBe('http://localhost:3000');
    });
  });
});

describe('getEngineClient singleton', () => {
  test('returns the same instance on repeated calls', () => {
    jest.resetModules();
    const { getEngineClient } = require('../engineApiClient');
    const client1 = getEngineClient();
    const client2 = getEngineClient();
    expect(client1).toBe(client2);
  });

  test('resetEngineClient creates a new instance', () => {
    jest.resetModules();
    const { getEngineClient, resetEngineClient } = require('../engineApiClient');
    const client1 = getEngineClient();
    resetEngineClient();
    const client2 = getEngineClient();
    expect(client1).not.toBe(client2);
  });
});
