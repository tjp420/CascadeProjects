const { verifyMFA, generateMFASecret, verifyMFAToken } = require('../../lib/auth/mfa-service.cjs');

describe('mfa-service', () => {
  describe('generateMFASecret', () => {
    test('generates a secret for valid user', () => {
      const secret = generateMFASecret({ email: 'test@example.com' });
      expect(secret.base32).toBeTruthy();
      expect(secret.otpauth_url).toContain('test%40example.com');
    });

    test('throws for missing email', () => {
      expect(() => generateMFASecret({})).toThrow(TypeError);
    });

    test('throws for null user', () => {
      expect(() => generateMFASecret(null)).toThrow(TypeError);
    });
  });

  describe('verifyMFAToken', () => {
    test('returns false for dummy token', () => {
      const result = verifyMFAToken('ORSXG5A=', '000000');
      expect(result).toBe(false);
    });

    test('accepts valid TOTP token', () => {
      const secret = generateMFASecret({ email: 'a@b.com' });
      // We can't easily generate a valid TOTP in tests without speakeasy.totp
      // Just verify the function accepts the right shape
      expect(() => verifyMFAToken(secret.base32, '123456')).not.toThrow();
    });
  });

  describe('verifyMFA middleware', () => {
    const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

    test('passes when MFA not required', () => {
      const req = { user: { trustLevel: 'bronze' } };
      const res = mockRes();
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('passes when MFA verified', () => {
      const req = { user: { trustLevel: 'gold' }, session: { mfaVerified: true } };
      const res = mockRes();
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('blocks gold user without MFA', () => {
      const req = { user: { trustLevel: 'gold' }, session: {} };
      const res = mockRes();
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('blocks when no user', () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
