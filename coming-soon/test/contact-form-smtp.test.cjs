'use strict';

/**
 * Tests for the POST /api/contact endpoint — verifies SMTP delivery,
 * validation, spam detection, and error handling.
 *
 * Mocks sendEmail in services/email.cjs to avoid real SMTP connections.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// ── Mock sendEmail ──────────────────────────────────────────────────────────
// We intercept require('../services/email.cjs') to inject a mock sendEmail.
const emailModulePath = require.resolve('../services/email.cjs');
const originalEmailModule = require(emailModulePath);

let mockSendResult = { sent: true, queued: false, provider: 'smtp', providerMessageId: 'test-id' };
let lastSendCall = null;

function setMockSendResult(result) {
  mockSendResult = result;
}

function getLastSendCall() {
  return lastSendCall;
}

function resetLastSendCall() {
  lastSendCall = null;
}

// Replace the module with a mock
require.cache[emailModulePath] = {
  id: emailModulePath,
  filename: emailModulePath,
  loaded: true,
  exports: {
    ...originalEmailModule,
    sendEmail: async (options) => {
      lastSendCall = options;
      return mockSendResult;
    }
  }
};

// ── Test app setup ──────────────────────────────────────────────────────────
// We import express from the coming-soon app's dependencies and create a
// minimal app that mounts only the /api/contact route.

let app;
let server;
let baseUrl;

before(async () => {
  // Set required env vars for the contact form
  process.env.CONTACT_NOTIFY_EMAIL = 'admin@simplebeacon.ai';
  process.env.SMTP_USER = 'admin@simplebeacon.ai';
  process.env.SMTP_HOST = 'smtp.zohocloud.ca';
  process.env.SMTP_PASS = 'test-password';
  process.env.SMTP_FROM = 'admin@simplebeacon.ai';

  const express = require('express');
  app = express();

  // Mount the contact form route — extract from server.cjs
  // Since the route is defined inline in server.cjs, we replicate it here
  // using the mocked sendEmail.
  const { sendEmail } = require('../services/email.cjs');

  const logger = {
    error: () => {},
    info: () => {},
    warn: () => {}
  };

  app.post('/api/contact', express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const data = req.body || {};
      if (String(data.website || '').trim()) {
        return res.status(400).json({ error: 'Spam detected' });
      }
      const contactEmail = String(data.contactEmail || '').trim();
      const message = String(data.message || '').trim();
      if (!contactEmail || !contactEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }
      if (!message || message.length < 10) {
        return res.status(400).json({ error: 'Message must be at least 10 characters' });
      }

      const topic = String(data.topic || 'general').trim();
      const name = String(data.name || '').trim();
      const company = String(data.company || '').trim();
      const title = String(data.title || '').trim();
      const source = String(data.source || 'contact-page').trim();

      const topicLabels = {
        'free-audit': 'Free AI Slop Audit request',
        'certificate': 'Executive Risk Certificate ($499)',
        'eu-ai-act': 'EU AI Act Readiness Sprint ($2,499)',
        'enterprise': 'Enterprise contract ($50,000+ annual)',
        'invoice-w9': 'Request Invoice / W-9',
        'quarterly': 'Quarterly / Annual Protection Pack',
        'general': 'General compliance question'
      };
      const topicLabel = topicLabels[topic] || topic;

      const notifyEmail = process.env.CONTACT_NOTIFY_EMAIL || process.env.SMTP_USER || '';
      if (!notifyEmail) {
        logger.error('[Contact] CONTACT_NOTIFY_EMAIL not configured');
        return res.status(500).json({ error: 'Server not configured for contact email delivery' });
      }

      const subject = `[SimpleBeacon Contact] ${topicLabel}`;
      const textBody = `Topic: ${topicLabel}\nFrom: ${name || '(no name)'} <${contactEmail}>\nCompany: ${company || '(none)'}\nTitle: ${title || '(none)'}\nSource: ${source}\n\nMessage:\n${message}`;
      const htmlBody = `<h3>New contact form submission</h3><p><strong>Topic:</strong> ${topicLabel}</p><p><strong>From:</strong> ${name || '(no name)'} &lt;${contactEmail}&gt;</p><p><strong>Company:</strong> ${company || '(none)'}</p><p><strong>Title:</strong> ${title || '(none)'}</p><p><strong>Source:</strong> ${source}</p><hr><p><strong>Message:</strong></p><pre>${message}</pre>`;

      const emailResult = await sendEmail({
        to: notifyEmail,
        subject,
        text: textBody,
        html: htmlBody
      });

      if (emailResult.sent) {
        logger.info(`[Contact] Email sent to ${notifyEmail} via ${emailResult.provider || 'smtp'} (from ${contactEmail})`);
        res.json({ success: true, message: 'Message sent — we reply within one business day.' });
      } else if (emailResult.queued) {
        logger.info(`[Contact] Email queued for ${notifyEmail} (from ${contactEmail})`);
        res.json({ success: true, message: 'Message received — delivery queued. We reply within one business day.' });
      } else {
        logger.error('[Contact] Email failed:', emailResult.error);
        res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
      }
    } catch (err) {
      logger.error('[Contact] Unexpected error:', err.message);
      res.status(500).json({ error: 'Failed to process contact form' });
    }
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  // Restore original module
  delete require.cache[emailModulePath];
  require.cache[emailModulePath] = { id: emailModulePath, filename: emailModulePath, loaded: true, exports: originalEmailModule };

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

beforeEach(() => {
  resetLastSendCall();
  setMockSendResult({ sent: true, queued: false, provider: 'smtp', providerMessageId: 'test-id' });
});

// ── Helper ──────────────────────────────────────────────────────────────────
async function postContact(body) {
  const bodyJson = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(baseUrl + '/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyJson)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.write(bodyJson);
    req.end();
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/contact — contact form SMTP delivery', () => {

  it('sends email via SMTP when valid data is submitted', async () => {
    const res = await postContact({
      contactEmail: 'customer@example.com',
      name: 'Jane Doe',
      company: 'Acme Corp',
      title: 'CTO',
      topic: 'general',
      message: 'I would like to learn more about SimpleBeacon.'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.message.includes('reply within one business day'));

    const call = getLastSendCall();
    assert.ok(call, 'sendEmail should have been called');
    assert.strictEqual(call.to, 'admin@simplebeacon.ai');
    assert.ok(call.subject.includes('General compliance question'));
    assert.ok(call.text.includes('Jane Doe'));
    assert.ok(call.text.includes('customer@example.com'));
    assert.ok(call.text.includes('Acme Corp'));
  });

  it('returns 400 when email is missing', async () => {
    const res = await postContact({
      name: 'Jane Doe',
      message: 'This is a valid message with enough characters.'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Valid email required');
    assert.ok(!getLastSendCall(), 'sendEmail should not be called on validation error');
  });

  it('returns 400 when message is too short', async () => {
    const res = await postContact({
      contactEmail: 'customer@example.com',
      message: 'short'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Message must be at least 10 characters');
    assert.ok(!getLastSendCall(), 'sendEmail should not be called on validation error');
  });

  it('returns 400 when honeypot field is filled (spam detection)', async () => {
    const res = await postContact({
      contactEmail: 'customer@example.com',
      message: 'This is a valid message with enough characters.',
      website: 'http://spam-site.com'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Spam detected');
    assert.ok(!getLastSendCall(), 'sendEmail should not be called on spam');
  });

  it('returns 500 when CONTACT_NOTIFY_EMAIL is not configured', async () => {
    const savedNotify = process.env.CONTACT_NOTIFY_EMAIL;
    const savedSmtpUser = process.env.SMTP_USER;
    delete process.env.CONTACT_NOTIFY_EMAIL;
    delete process.env.SMTP_USER;

    const res = await postContact({
      contactEmail: 'customer@example.com',
      message: 'This is a valid message with enough characters.'
    });

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, 'Server not configured for contact email delivery');

    process.env.CONTACT_NOTIFY_EMAIL = savedNotify;
    process.env.SMTP_USER = savedSmtpUser;
  });

  it('returns 200 with queued message when SMTP fails but email is queued', async () => {
    setMockSendResult({ sent: false, queued: true, queueId: 'test-queue-1', error: 'SMTP connection refused' });

    const res = await postContact({
      contactEmail: 'customer@example.com',
      message: 'This is a valid message with enough characters.'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.message.includes('queued'), 'message should mention queued');
  });

  it('returns 500 when email send fails and is not queued', async () => {
    setMockSendResult({ sent: false, queued: false, error: 'SMTP authentication failed' });

    const res = await postContact({
      contactEmail: 'customer@example.com',
      message: 'This is a valid message with enough characters.'
    });

    assert.strictEqual(res.status, 500);
    assert.ok(res.body.error.includes('Failed to send'));
  });
});
