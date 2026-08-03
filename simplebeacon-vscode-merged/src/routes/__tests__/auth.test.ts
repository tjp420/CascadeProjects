import { handleAuthRoutes } from '../auth';
import assert from 'node:assert';
import { IncomingMessage, ServerResponse } from 'http';

function mockReq(method: string, url: string): IncomingMessage {
  const req = new IncomingMessage(null as any);
  req.method = method;
  req.url = url;
  return req;
}

function mockRes(): ServerResponse {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body = '';
  const res = {
    writeHead(code: number, hdrs: Record<string, string>) {
      statusCode = code;
      Object.assign(headers, hdrs);
      return this;
    },
    end(data: string) {
      body = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get headers() {
      return headers;
    },
  } as unknown as ServerResponse & { statusCode: number; body: string; headers: Record<string, string> };
  return res as ServerResponse;
}

describe('Auth route fallback', () => {
  it('returns false for non-auth paths', () => {
    const req = mockReq('GET', '/api/health');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/health');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });

  it('returns false for /api/auth/login (handled upstream)', () => {
    const req = mockReq('POST', '/api/auth/login');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/login');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });

  it('returns false for /api/auth/me (handled upstream)', () => {
    const req = mockReq('GET', '/api/auth/me');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/me');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });

  it('returns false for /api/auth/logout (handled upstream)', () => {
    const req = mockReq('POST', '/api/auth/logout');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/logout');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });

  it('returns false for /api/auth/check-token-password (handled upstream)', () => {
    const req = mockReq('POST', '/api/auth/check-token-password');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/check-token-password');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });

  it('returns false for /api/auth/set-token-password (handled upstream)', () => {
    const req = mockReq('POST', '/api/auth/set-token-password');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/set-token-password');
    assert.strictEqual(handleAuthRoutes(req, res, parsed), false);
  });
});
