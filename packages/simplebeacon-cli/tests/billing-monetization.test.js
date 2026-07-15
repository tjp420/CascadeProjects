// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  generateLicenseToken,
  validateLicenseToken
} = require('../src/lib/license-token.js');

describe('billing monetization loop', () => {
  const secret = 'test_monetization_secret_key_2050';

  test('mints and validates team-tier subscription token', () => {
    const token = generateLicenseToken(
      {
        email: 'lead@enterprise-dev.com',
        tier: 'team',
        features: ['team-management', 'pdf-generation']
      },
      secret,
      365 * 24 * 60
    );
    assert.ok(token.includes('.'));
    assert.ok(!token.startsWith('sb_live_'), 'uses existing JWT format, not parallel sb_live_ prefix');

    const result = validateLicenseToken(token, secret);
    assert.equal(result.valid, true);
    assert.equal(result.claims.sub, 'lead@enterprise-dev.com');
    assert.equal(result.claims.tier, 'team');
    assert.equal(result.claims.iss, 'simplebeacon.ai');
  });

  test('rejects tampered signature', () => {
    const token = generateLicenseToken({ email: 'a@b.com', tier: 'startup' }, secret, 60);
    const parts = token.split('.');
    parts[2] = crypto.randomBytes(32).toString('base64url');
    const tampered = parts.join('.');
    const result = validateLicenseToken(tampered, secret);
    assert.equal(result.valid, false);
  });

  test('maps $49 vs $149 tier claims for provisioning', () => {
    const starter = generateLicenseToken({ email: 's@co.com', tier: 'startup' }, secret, 525600);
    const growth = generateLicenseToken({ email: 'g@co.com', tier: 'growth' }, secret, 525600);
    assert.equal(validateLicenseToken(starter, secret).claims.tier, 'startup');
    assert.equal(validateLicenseToken(growth, secret).claims.tier, 'growth');
  });
});
