'use strict';

/**
 * Unit tests for email-config.cjs with Zoho Mail SMTP configuration.
 *
 * Tests that getSmtpSettings() correctly detects Zoho SMTP, returns
 * the right mode, and that isEmailConfigured() / getEmailStatus()
 * report accurate status when Zoho is configured.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

// ── Helper: get a fresh instance of email-config.cjs ────────────────────────
// email-config.cjs reads process.env at call time (not load time), so we
// don't need to clear the cache — just set env vars before calling.
const emailConfig = require('../lib/email-config.cjs');

const ZOHO_ENV = {
  SMTP_HOST: 'smtp.zohocloud.ca',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'admin@simplebeacon.ai',
  SMTP_PASS: 'test-app-password',
  SMTP_FROM: 'admin@simplebeacon.ai'
};

describe('email-config.cjs — Zoho Mail SMTP configuration', () => {
  let savedEnv;

  before(() => {
    savedEnv = { ...process.env };
  });

  after(() => {
    // Restore env
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
  });

  beforeEach(() => {
    // Clear all email-related env vars before each test
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });

  it('getSmtpSettings() returns Zoho config with mode: "smtp" when Zoho env vars are set', () => {
    Object.assign(process.env, ZOHO_ENV);
    const smtp = emailConfig.getSmtpSettings();

    assert.ok(smtp, 'getSmtpSettings() should return a config object');
    assert.strictEqual(smtp.host, 'smtp.zohocloud.ca');
    assert.strictEqual(smtp.port, 465);
    assert.strictEqual(smtp.secure, true);
    assert.strictEqual(smtp.user, 'admin@simplebeacon.ai');
    assert.strictEqual(smtp.pass, 'test-app-password');
    assert.strictEqual(smtp.from, 'admin@simplebeacon.ai');
    assert.strictEqual(smtp.mode, 'smtp', 'mode should be "smtp" for Zoho (not "resend-smtp-relay")');
  });

  it('getSmtpSettings() returns null when neither Zoho nor Resend is configured', () => {
    const smtp = emailConfig.getSmtpSettings();
    assert.strictEqual(smtp, null, 'getSmtpSettings() should return null when no SMTP env vars are set');
  });

  it('getSmtpSettings() returns resend-smtp-relay when RESEND_API_KEY is set but Zoho SMTP vars are not', () => {
    process.env['RESEND_API_KEY'] = 're_' + 'testkey123456';
    const smtp = emailConfig.getSmtpSettings();

    assert.ok(smtp, 'should return Resend SMTP relay config');
    assert.strictEqual(smtp.host, 'smtp.resend.com');
    assert.strictEqual(smtp.mode, 'resend-smtp-relay');
  });

  it('getSmtpSettings() prefers Zoho SMTP over Resend SMTP relay when both are configured', () => {
    process.env['RESEND_API_KEY'] = 're_' + 'testkey123456';
    Object.assign(process.env, ZOHO_ENV);
    const smtp = emailConfig.getSmtpSettings();

    assert.ok(smtp, 'should return a config');
    assert.strictEqual(smtp.host, 'smtp.zohocloud.ca', 'should use Zoho host, not Resend relay');
    assert.strictEqual(smtp.mode, 'smtp', 'should use smtp mode, not resend-smtp-relay');
  });

  it('isEmailConfigured() returns true when Zoho SMTP is configured (even without Resend)', () => {
    Object.assign(process.env, ZOHO_ENV);
    assert.strictEqual(emailConfig.isEmailConfigured(), true);
  });

  it('isEmailConfigured() returns false when no email provider is configured', () => {
    assert.strictEqual(emailConfig.isEmailConfigured(), false);
  });

  it('getFromAddress() returns SMTP_FROM when set', () => {
    process.env.SMTP_FROM = 'support@simplebeacon.ai';
    assert.strictEqual(emailConfig.getFromAddress(), 'support@simplebeacon.ai');
  });

  it('getFromAddress() falls back to RESEND_FROM when SMTP_FROM is not set', () => {
    process.env.RESEND_FROM = 'certificates@simplebeacon.ai';
    assert.strictEqual(emailConfig.getFromAddress(), 'certificates@simplebeacon.ai');
  });

  it('getFromAddress() defaults to certificates@simplebeacon.ai when neither is set', () => {
    assert.strictEqual(emailConfig.getFromAddress(), 'certificates@simplebeacon.ai');
  });

  it('getEmailStatus() reports smtpMode: "smtp" for Zoho config', () => {
    Object.assign(process.env, ZOHO_ENV);
    const status = emailConfig.getEmailStatus();

    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.providers.smtp, true);
    assert.strictEqual(status.providers.smtpMode, 'smtp');
    assert.strictEqual(status.providers.resendApi, false);
  });

  it('getEmailStatus() reports both Resend and SMTP when both are configured', () => {
    process.env['RESEND_API_KEY'] = 're_' + 'testkey123456';
    Object.assign(process.env, ZOHO_ENV);
    const status = emailConfig.getEmailStatus();

    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.providers.resendApi, true);
    assert.strictEqual(status.providers.smtp, true);
    assert.strictEqual(status.providers.smtpMode, 'smtp');
  });

  it('hasResendApiKey() returns false when only Zoho SMTP is configured', () => {
    Object.assign(process.env, ZOHO_ENV);
    assert.strictEqual(emailConfig.hasResendApiKey(), false);
  });
});
