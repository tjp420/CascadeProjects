#!/usr/bin/env node
/**
 * Zoho SMTP Test Utility
 *
 * Tests direct SMTP delivery through Zoho Mail (smtp.zohocloud.ca:465).
 * Sends a test message to all six operational mailboxes and reports
 * success/failure for each.
 *
 * Usage:
 *   node scripts/test-zoho-smtp.cjs                    # Uses env vars
 *   node scripts/test-zoho-smtp.cjs --password <pass>  # Override password
 *   node scripts/test-zoho-smtp.cjs --from admin@simplebeacon.ai
 *
 * Required environment variables:
 *   SMTP_PASS (or --password)  — Zoho app-specific password
 *   SMTP_USER (default: admin@simplebeacon.ai)
 *   SMTP_FROM (default: admin@simplebeacon.ai)
 *
 * Optional environment variables:
 *   SMTP_HOST (default: smtp.zohocloud.ca)
 *   SMTP_PORT (default: 465)
 *   SMTP_SECURE (default: true)
 */

'use strict';

const nodemailer = require('nodemailer');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf('--' + name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

const HOST = getArg('host') || process.env.SMTP_HOST || 'smtp.zohocloud.ca';
const PORT = parseInt(getArg('port') || process.env.SMTP_PORT || '465', 10);
const SECURE = (getArg('secure') || process.env.SMTP_SECURE || 'true') !== 'false';
const USER = getArg('user') || process.env.SMTP_USER || 'admin@simplebeacon.ai';
const FROM = getArg('from') || process.env.SMTP_FROM || USER;
const PASS = getArg('password') || process.env.SMTP_PASS;

if (!PASS || PASS === 'your Zoho app password') {
  console.error('');
  console.error('ERROR: No Zoho app password provided.');
  console.error('');
  console.error('Set SMTP_PASS env var or pass --password <password>');
  console.error('');
  console.error('To generate a Zoho app password:');
  console.error('  1. Go to https://accounts.zoho.com');
  console.error('  2. Enable Two-Factor Authentication if not already on');
  console.error('  3. Navigate to App Passwords / Application-specific Passwords');
  console.error('  4. Generate a new password for "Render Production"');
  console.error('');
  process.exit(1);
}

const RECIPIENTS = [
  'admin@simplebeacon.ai',
  'hello@simplebeacon.ai',
  'billing@simplebeacon.ai',
  'security@simplebeacon.ai',
  'support@simplebeacon.ai',
  'no-reply@simplebeacon.ai',
];

const transporter = nodemailer.createTransport({
  host: HOST,
  port: PORT,
  secure: SECURE,
  auth: { user: USER, pass: PASS },
});

async function verifyConnection() {
  console.log('');
  console.log('Zoho SMTP Test Utility');
  console.log('======================');
  console.log('');
  console.log('Configuration:');
  console.log('  Host:    ' + HOST + ':' + PORT + ' (secure: ' + SECURE + ')');
  console.log('  User:    ' + USER);
  console.log('  From:    ' + FROM);
  console.log('  Pass:    ' + '*'.repeat(Math.min(PASS.length, 16)));
  console.log('');

  console.log('Step 1: Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('  [PASS] SMTP connection verified successfully');
  } catch (err) {
    console.log('  [FAIL] SMTP connection failed: ' + err.message);
    console.log('');
    console.log('  Common causes:');
    console.log('    - Wrong app password (must be Zoho app-specific, not account password)');
    console.log('    - 2FA not enabled on the Zoho account');
    console.log('    - Wrong host (should be smtp.zohocloud.ca for custom domains)');
    console.log('    - Network/firewall blocking port ' + PORT);
    process.exit(1);
  }
  console.log('');

  console.log('Step 2: Sending test emails to ' + RECIPIENTS.length + ' mailboxes...');
  let delivered = 0;
  let failed = 0;

  for (const to of RECIPIENTS) {
    const subject = 'Zoho SMTP Test — ' + new Date().toISOString();
    const text = [
      'This is an automated test from the SimpleBeacon Zoho SMTP test utility.',
      '',
      'Timestamp: ' + new Date().toISOString(),
      'Recipient: ' + to,
      'Sender:    ' + FROM,
      'Host:      ' + HOST + ':' + PORT,
      '',
      'If you received this email, direct Zoho SMTP delivery is working correctly.',
    ].join('\n');

    try {
      const info = await transporter.sendMail({
        from: FROM,
        to,
        subject,
        text,
      });
      console.log('  [PASS] ' + to + ' — messageId: ' + info.messageId);
      delivered++;
    } catch (err) {
      console.log('  [FAIL] ' + to + ' — ' + err.message);
      failed++;
    }
  }

  console.log('');
  console.log('Results: ' + delivered + '/' + RECIPIENTS.length + ' delivered, ' + failed + ' failed');
  console.log('');

  if (failed === 0) {
    console.log('All test emails delivered successfully. Zoho SMTP is ready for production.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set SMTP_USER=admin@simplebeacon.ai on Render');
    console.log('  2. Set SMTP_PASS=<this password> on Render');
    console.log('  3. (Optional) Remove RESEND_API_KEY to force direct SMTP');
    console.log('  4. Check /api/health/email — smtpMode should report "smtp"');
    process.exit(0);
  } else {
    console.log('Some deliveries failed. Check the error messages above.');
    process.exit(1);
  }
}

verifyConnection().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
