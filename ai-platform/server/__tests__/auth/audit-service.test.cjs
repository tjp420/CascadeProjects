const {
  isAuthDebugEnabled,
  authLog,
  authWarn,
  shouldWriteAuditEvents,
  auditAuth
} = require('../../lib/auth/audit-service.cjs');

describe('audit-service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LOG_AUTH;
    delete process.env.AUTH_DEBUG;
    delete process.env.AUDIT_AUTH_LOGS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAuthDebugEnabled', () => {
    test('returns false by default', () => {
      expect(isAuthDebugEnabled()).toBe(false);
    });
    test('returns true when LOG_AUTH=true', () => {
      process.env.LOG_AUTH = 'true';
      expect(isAuthDebugEnabled()).toBe(true);
    });
    test('returns true when AUTH_DEBUG=true', () => {
      process.env.AUTH_DEBUG = 'true';
      expect(isAuthDebugEnabled()).toBe(true);
    });
  });

  describe('shouldWriteAuditEvents', () => {
    test('returns true by default', () => {
      expect(shouldWriteAuditEvents()).toBe(true);
    });
    test('returns false when AUDIT_AUTH_LOGS=false', () => {
      process.env.AUDIT_AUTH_LOGS = 'false';
      expect(shouldWriteAuditEvents()).toBe(false);
    });
  });

  describe('auditAuth', () => {
    test('does not throw with minimal args', () => {
      expect(() => auditAuth('login')).not.toThrow();
    });
    test('does not throw with full args', () => {
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test' }, requestId: 'r1' };
      expect(() => auditAuth('login_success', { id: 'u1', email: 'a@b.com', trustLevel: 'gold' }, req)).not.toThrow();
    });
    test('ignores non-string action', () => {
      expect(() => auditAuth(123)).not.toThrow();
    });
  });
});
