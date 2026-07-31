'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { decodeJwtEmail, resolveReferrerEmail } = require('../src/lib/referral-cli.js');

describe('referral-cli', () => {
  test('decodeJwtEmail extracts email claim', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ email: 'dev@simplebeacon.ai', tier: 'team' })
    ).toString('base64url');
    const token = `${header}.${payload}.signature`;
    assert.equal(decodeJwtEmail(token), 'dev@simplebeacon.ai');
  });

  test('resolveReferrerEmail prefers --from flag', () => {
    const original = process.env.SIMPLEBEACON_REFERRER_EMAIL;
    process.env.SIMPLEBEACON_REFERRER_EMAIL = 'env@example.com';
    try {
      assert.equal(resolveReferrerEmail({ from: 'Lead@Company.com' }), 'lead@company.com');
    } finally {
      if (original === undefined) delete process.env.SIMPLEBEACON_REFERRER_EMAIL;
      else process.env.SIMPLEBEACON_REFERRER_EMAIL = original;
    }
  });

  test('resolveReferrerEmail falls back to SIMPLEBEACON_REFERRER_EMAIL', () => {
    const original = process.env.SIMPLEBEACON_REFERRER_EMAIL;
    process.env.SIMPLEBEACON_REFERRER_EMAIL = 'Referrer@Co.com';
    try {
      assert.equal(resolveReferrerEmail({}), 'referrer@co.com');
    } finally {
      if (original === undefined) delete process.env.SIMPLEBEACON_REFERRER_EMAIL;
      else process.env.SIMPLEBEACON_REFERRER_EMAIL = original;
    }
  });
});
