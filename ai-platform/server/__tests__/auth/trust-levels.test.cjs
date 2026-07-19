const {
  trustLevels,
  getTrustLevelRateLimit,
  evaluateTrustLevel,
  authorize,
  requireTrustLevel,
  requireOwnership,
  requirePrivateAnalysis
} = require('../../lib/auth/trust-levels.cjs');

describe('trust-levels', () => {
  describe('trustLevels config', () => {
    test('has bronze, silver, gold', () => {
      expect(trustLevels.bronze.level).toBe(1);
      expect(trustLevels.silver.level).toBe(2);
      expect(trustLevels.gold.level).toBe(3);
    });

    test('gold requires mfa', () => {
      expect(trustLevels.gold.mfaRequired).toBe(true);
      expect(trustLevels.bronze.mfaRequired).toBe(false);
    });
  });

  describe('getTrustLevelRateLimit', () => {
    test('returns base 100 for bronze', () => {
      expect(getTrustLevelRateLimit('bronze')).toBe(100);
    });
    test('returns 200 for silver (2x)', () => {
      expect(getTrustLevelRateLimit('silver')).toBe(200);
    });
    test('returns 500 for gold (5x)', () => {
      expect(getTrustLevelRateLimit('gold')).toBe(500);
    });
    test('defaults to 100 for unknown', () => {
      expect(getTrustLevelRateLimit('unknown')).toBe(100);
    });
  });

  describe('evaluateTrustLevel', () => {
    test('returns bronze for null', () => {
      expect(evaluateTrustLevel(null)).toBe('bronze');
    });
    test('returns bronze for empty object', () => {
      expect(evaluateTrustLevel({})).toBe('bronze');
    });
    test('returns gold for high score', () => {
      const user = {
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        successfulAnalyses: 200,
        securityIncidents: 0,
        communityContributions: 100,
        verificationStatus: 'enterprise'
      };
      expect(evaluateTrustLevel(user)).toBe('gold');
    });
    test('returns silver for mid score', () => {
      const user = {
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        successfulAnalyses: 40,
        securityIncidents: 0,
        communityContributions: 5,
        verificationStatus: 'email'
      };
      expect(evaluateTrustLevel(user)).toBe('silver');
    });
  });

  describe('authorize middleware', () => {
    const mockRes = () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
      return res;
    };

    test('allows when all permissions present', () => {
      const req = { user: { permissions: ['read:own', 'write:own'] } };
      const res = mockRes();
      const next = jest.fn();
      authorize(['read:own'])(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects when permission missing', () => {
      const req = { user: { id: 'u1', permissions: ['read:own'] } };
      const res = mockRes();
      const next = jest.fn();
      authorize(['write:own'])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects when no user', () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      authorize(['read:own'])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireTrustLevel middleware', () => {
    const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

    test('allows gold user for silver requirement', () => {
      const req = { user: { trustLevel: 'gold' } };
      const res = mockRes();
      const next = jest.fn();
      requireTrustLevel('silver')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects bronze user for gold requirement', () => {
      const req = { user: { trustLevel: 'bronze' } };
      const res = mockRes();
      const next = jest.fn();
      requireTrustLevel('gold')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('rejects when no user', () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      requireTrustLevel('silver')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireOwnership middleware', () => {
    const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

    test('allows when ownerId matches userId', async () => {
      const req = { user: { id: 'u1', permissions: ['read:own'] } };
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => 'u1');
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects when ownerId does not match', async () => {
      const req = { user: { id: 'u1', permissions: ['read:own'] } };
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => 'u2');
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('admin bypasses ownership check', async () => {
      const req = { user: { id: 'u1', role: 'admin' } };
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => 'someone-else');
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('all_modules feature bypasses ownership check', async () => {
      const req = { user: { id: 'u1', features: ['all_modules'] } };
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => 'someone-else');
      await mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects when no user', async () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => 'u1');
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 500 when getOwnerId throws', async () => {
      const req = { user: { id: 'u1' } };
      const res = mockRes();
      const next = jest.fn();
      const mw = requireOwnership(async () => { throw new Error('DB error'); });
      await mw(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('requirePrivateAnalysis middleware', () => {
    const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

    test('allows user with analyze:private permission', () => {
      const req = { user: { id: 'u1', permissions: ['read:own', 'analyze:private'] } };
      const res = mockRes();
      const next = jest.fn();
      requirePrivateAnalysis(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects bronze user with only analyze:public', () => {
      const req = { user: { id: 'u1', permissions: ['read:own', 'analyze:public'], trustLevel: 'bronze', tier: 'community' } };
      const res = mockRes();
      const next = jest.fn();
      requirePrivateAnalysis(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'upgrade_required' }));
    });

    test('admin bypasses', () => {
      const req = { user: { id: 'u1', role: 'admin', permissions: ['read:own'] } };
      const res = mockRes();
      const next = jest.fn();
      requirePrivateAnalysis(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('all_modules feature bypasses', () => {
      const req = { user: { id: 'u1', features: ['all_modules'], permissions: ['read:own'] } };
      const res = mockRes();
      const next = jest.fn();
      requirePrivateAnalysis(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects when no user', () => {
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      requirePrivateAnalysis(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
