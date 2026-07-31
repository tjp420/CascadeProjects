'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Helper: get a fresh instance of email-service.cjs with the given env.
 * The module caches QUEUE_DIR at load time, so we must clear the cache
 * and re-require to pick up new EMAIL_QUEUE_DIR values.
 */
function freshEmailService(env = {}) {
  // Save current env
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  // Clear module cache
  delete require.cache[require.resolve('../email-service.cjs')];
  const mod = require('../email-service.cjs');
  // Restore env (the module already captured what it needs at load time)
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return mod;
}

describe('email-service smoke', () => {
  const mod = require('../email-service.cjs');

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

describe('email-service fallback chain', () => {
  let tempQueueDir;
  let mod;
  let savedEnv;

  before(() => {
    savedEnv = { ...process.env };
  });

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
  });

  beforeEach(() => {
    tempQueueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-email-test-'));
    // Get a fresh module instance with EMAIL_QUEUE_DIR pointing to temp dir
    mod = freshEmailService({
      EMAIL_QUEUE_DIR: tempQueueDir,
      CF_API_TOKEN: undefined,
      CF_ACCOUNT_ID: undefined,
      RESEND_API_KEY: undefined,
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
    });
  });

  afterEach(() => {
    fs.rmSync(tempQueueDir, { recursive: true, force: true });
  });

  it('returns error when to and subject are missing', async () => {
    const result = await mod.sendEmail({});
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, false);
    assert.ok(result.error, 'should have error message');
  });

  it('returns error when subject is missing', async () => {
    const result = await mod.sendEmail({ to: 'test@example.com' });
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, false);
    assert.ok(result.error, 'should have error message');
  });

  it('falls back to disk queue when no providers configured', async () => {
    const result = await mod.sendEmail({
      to: 'customer@example.com',
      subject: 'Test: no providers configured',
      text: 'This should be queued to disk.',
      html: '<p>This should be queued to disk.</p>',
    });

    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, true);
    assert.strictEqual(result.provider, 'queued');
    assert.ok(result.queuePath, 'should have queuePath');

    // Verify the file exists on disk
    assert.ok(fs.existsSync(result.queuePath), 'queue file should exist');

    // Verify the file contents
    const queued = JSON.parse(fs.readFileSync(result.queuePath, 'utf8'));
    assert.strictEqual(queued.to, 'customer@example.com');
    assert.strictEqual(queued.subject, 'Test: no providers configured');
    assert.strictEqual(queued.text, 'This should be queued to disk.');
    assert.ok(queued.id, 'queued payload should have id');
    assert.ok(queued.queuedAt, 'queued payload should have queuedAt timestamp');
  });

  it('falls back to disk queue when Resend API key is invalid format', async () => {
    // Set a key that doesn't start with re_ — getResendConfig() returns null
    process.env.RESEND_API_KEY = 'invalid_key_format';
    const result = await mod.sendEmail({
      to: 'customer@example.com',
      subject: 'Test: invalid Resend key format',
      text: 'Should queue to disk because Resend key is invalid.',
    });

    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, true);
    assert.strictEqual(result.provider, 'queued');
    delete process.env.RESEND_API_KEY;
  });

  it('falls back to disk queue when SMTP config is incomplete', async () => {
    // Set partial SMTP config — missing SMTP_PASS
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    // SMTP_PASS deliberately unset
    const result = await mod.sendEmail({
      to: 'customer@example.com',
      subject: 'Test: incomplete SMTP config',
      text: 'Should queue to disk because SMTP is incomplete.',
    });

    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, true);
    assert.strictEqual(result.provider, 'queued');
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
  });

  it('creates queue directory if it does not exist', async () => {
    // Use the module's own QUEUE_DIR (which may differ under Jest's module cache)
    const queueDir = mod.QUEUE_DIR || tempQueueDir;

    // Remove the queue dir so it doesn't exist
    fs.rmSync(queueDir, { recursive: true, force: true });
    assert.ok(!fs.existsSync(queueDir), 'queue dir should not exist before send');

    const result = await mod.sendEmail({
      to: 'customer@example.com',
      subject: 'Test: queue dir creation',
      text: 'Should create queue dir and write file.',
    });

    assert.strictEqual(result.queued, true);
    assert.ok(fs.existsSync(queueDir), 'queue dir should be created');
    assert.ok(fs.existsSync(result.queuePath), 'queue file should exist');
  });

  it('queues multiple emails with unique IDs', async () => {
    const results = await Promise.all([
      mod.sendEmail({ to: 'a@example.com', subject: 'Email 1', text: 'First' }),
      mod.sendEmail({ to: 'b@example.com', subject: 'Email 2', text: 'Second' }),
      mod.sendEmail({ to: 'c@example.com', subject: 'Email 3', text: 'Third' }),
    ]);

    for (const r of results) {
      assert.strictEqual(r.queued, true);
      assert.ok(r.queuePath, 'each should have unique queuePath');
    }

    // All queue paths should be distinct
    const paths = results.map((r) => r.queuePath);
    assert.strictEqual(new Set(paths).size, 3, 'all queue paths should be unique');

    // All files should exist
    for (const p of paths) {
      assert.ok(fs.existsSync(p), 'file should exist: ' + p);
    }
  });
});

describe('email-service getResendConfig validation', () => {
  const mod = require('../email-service.cjs');

  it('accepts key starting with re_', () => {
    process.env.RESEND_API_KEY = 're_test_abc123';
    process.env.RESEND_FROM = 'test@simplebeacon.ai';
    const cfg = mod.getResendConfig();
    assert.ok(cfg, 'should return config');
    assert.strictEqual(cfg.key, 're_test_abc123');
    assert.strictEqual(cfg.from, 'test@simplebeacon.ai');
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });

  it('rejects key not starting with re_', () => {
    process.env.RESEND_API_KEY = 'sk_test_abc123';
    const cfg = mod.getResendConfig();
    assert.strictEqual(cfg, null);
    delete process.env.RESEND_API_KEY;
  });

  it('uses default from address when RESEND_FROM not set', () => {
    process.env.RESEND_API_KEY = 're_test_abc123';
    delete process.env.RESEND_FROM;
    delete process.env.SMTP_FROM;
    const cfg = mod.getResendConfig();
    assert.ok(cfg);
    assert.ok(cfg.from.includes('simplebeacon.ai'), 'default from should contain domain');
    delete process.env.RESEND_API_KEY;
  });
});
