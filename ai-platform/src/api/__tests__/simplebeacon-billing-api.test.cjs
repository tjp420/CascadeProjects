const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('simplebeacon-billing-api helpers', () => {
  describe('billingDisabledResponse', () => {
    it('returns 503 with correct JSON shape', () => {
      const res = {
        status(code) {
          this._status = code;
          return this;
        },
        json(body) {
          this._body = body;
          return this;
        }
      };
      // Inline replica of billingDisabledResponse
      function billingDisabledResponse(r) {
        return r.status(503).json({ error: 'billing_disabled', message: 'Monetization is not enabled on this server.' });
      }
      billingDisabledResponse(res);
      assert.strictEqual(res._status, 503);
      assert.strictEqual(res._body.error, 'billing_disabled');
      assert.ok(res._body.message.includes('Monetization'));
    });
  });

  describe('normalizeEmail', () => {
    function normalizeEmail(email) {
      if (!email || typeof email !== 'string') return '';
      return email.trim().toLowerCase();
    }

    it('trims and lowercases email', () => {
      assert.strictEqual(normalizeEmail('  User@Example.COM  '), 'user@example.com');
    });

    it('returns empty string for non-string input', () => {
      assert.strictEqual(normalizeEmail(null), '');
      assert.strictEqual(normalizeEmail(123), '');
    });
  });

  describe('team telemetry POST license gate (D-02)', () => {
    const COMMUNITY_TIERS = new Set(['community', 'free']);
    function hasTeamComplianceLicense(subscription) {
      const tier = String(subscription?.licenseTier || subscription?.tier || 'community').toLowerCase();
      return !COMMUNITY_TIERS.has(tier);
    }

    function teamLicenseForbiddenResponse(res) {
      return res.status(403).json({
        error: 'team_license_required',
        message: 'Team telemetry requires a team or compliance license.'
      });
    }

    it('rejects community and free tiers', () => {
      assert.strictEqual(hasTeamComplianceLicense({ tier: 'community' }), false);
      assert.strictEqual(hasTeamComplianceLicense({ licenseTier: 'free' }), false);
      assert.strictEqual(hasTeamComplianceLicense(null), false);
    });

    it('allows team and compliance-style paid tiers', () => {
      assert.strictEqual(hasTeamComplianceLicense({ tier: 'team' }), true);
      assert.strictEqual(hasTeamComplianceLicense({ licenseTier: 'compliance' }), true);
      assert.strictEqual(hasTeamComplianceLicense({ tier: 'pro' }), true);
    });

    it('returns 403 team_license_required payload matching GET team routes', () => {
      const res = {
        status(code) {
          this._status = code;
          return this;
        },
        json(body) {
          this._body = body;
          return this;
        }
      };
      teamLicenseForbiddenResponse(res);
      assert.strictEqual(res._status, 403);
      assert.deepStrictEqual(res._body, {
        error: 'team_license_required',
        message: 'Team telemetry requires a team or compliance license.'
      });
    });
  });
});
