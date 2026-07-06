import { handleAuthRoutes } from '../auth';
import { describe, it } from 'node:test';
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
    get statusCode() { return statusCode; },
    get body() { return body; },
    get headers() { return headers; },
  } as unknown as ServerResponse & { statusCode: number; body: string; headers: Record<string, string> };
  return res as ServerResponse;
}

describe('Auth route stubs', () => {
  it('returns false for non-auth paths', () => {
    const req = mockReq('GET', '/api/health');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/health');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, false);
  });

  it('handles /api/auth/login', () => {
    const req = mockReq('POST', '/api/auth/login');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/login');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, true);
    assert.strictEqual((res as any).statusCode, 200);
    const body = JSON.parse((res as any).body);
    assert.strictEqual(body.success, true);
    assert.ok(body.token);
    assert.ok(body.user);
  });

  it('handles /api/auth/me', () => {
    const req = mockReq('GET', '/api/auth/me');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/me');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, true);
    assert.strictEqual((res as any).statusCode, 200);
    const body = JSON.parse((res as any).body);
    assert.strictEqual(body.success, true);
    assert.ok(body.user);
    assert.strictEqual(body.user.plan, 'pro');
  });

  it('handles /api/auth/logout', () => {
    const req = mockReq('POST', '/api/auth/logout');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/logout');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, true);
    assert.strictEqual((res as any).statusCode, 200);
    const body = JSON.parse((res as any).body);
    assert.strictEqual(body.success, true);
  });

  it('handles /api/auth/check-token-password', () => {
    const req = mockReq('POST', '/api/auth/check-token-password');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/check-token-password');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, true);
    assert.strictEqual((res as any).statusCode, 200);
    const body = JSON.parse((res as any).body);
    assert.strictEqual(body.hasPassword, false);
    assert.strictEqual(body.success, true);
  });

  it('handles /api/auth/set-token-password', () => {
    const req = mockReq('POST', '/api/auth/set-token-password');
    const res = mockRes();
    const parsed = new URL('http://localhost/api/auth/set-token-password');
    const handled = handleAuthRoutes(req, res, parsed);
    assert.strictEqual(handled, true);
    assert.strictEqual((res as any).statusCode, 200);
    const body = JSON.parse((res as any).body);
    assert.strictEqual(body.success, true);
  });
});
