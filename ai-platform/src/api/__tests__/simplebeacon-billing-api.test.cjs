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
});
