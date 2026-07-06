'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../email-service.cjs');

describe('email-service smoke', () => {
  it('exports expected functions', () => {
    assert.strictEqual(typeof mod.sendEmail, 'function', 'sendEmail should be exported');
  });

  it('getCloudflareConfig returns null when env missing', () => {
    delete process.env.CF_API_TOKEN;
    delete process.env.CF_ACCOUNT_ID;
    const cfg = mod.getCloudflareConfig ? mod.getCloudflareConfig() : null;
    assert.strictEqual(cfg, null);
  });

  it('getResendConfig returns null when env missing', () => {
    delete process.env.RESEND_API_KEY;
    const cfg = mod.getResendConfig ? mod.getResendConfig() : null;
    assert.strictEqual(cfg, null);
  });
});
