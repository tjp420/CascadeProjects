#!/usr/bin/env node
'use strict';

/**
 * Send a test email via Zoho Mail SMTP (not Resend) to verify SMTP config.
 *
 * Usage:
 *   node tools/send-test-smtp-email.cjs --to you@example.com
 *   node tools/send-test-smtp-email.cjs --to you@example.com --from support@simplebeacon.ai
 *   node tools/send-test-smtp-email.cjs --verify   # connection check only, no email sent
 *
 * Required env vars (set in .env or export before running):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 *
 * If RESEND_API_KEY is set, this script still tests Zoho SMTP directly
 * (bypasses Resend) to isolate SMTP-specific issues.
 */

const path = require('path');

try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_err) {
    // dotenv optional when running from monorepo root
}

function parseArgs(argv) {
    const args = { to: '', from: '', verify: false };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--to' && argv[i + 1]) {
            args.to = argv[++i].trim();
        } else if (argv[i] === '--from' && argv[i + 1]) {
            args.from = argv[++i].trim();
        } else if (argv[i] === '--verify') {
            args.verify = true;
        } else if (argv[i] === '--help' || argv[i] === '-h') {
            console.log(
                'Usage: node tools/send-test-smtp-email.cjs --to you@example.com [--from from@domain] [--verify]'
            );
            console.log('  --to     Recipient email address');
            console.log('  --from   From address (defaults to SMTP_FROM env var)');
            console.log('  --verify Connection check only — no email sent');
            process.exit(0);
        }
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv);

    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || '').trim();
    const fromAddr = String(args.from || process.env.SMTP_FROM || 'admin@simplebeacon.ai').trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    console.log('\n=== SimpleBeacon Zoho SMTP Test ===\n');
    console.log('Host:', host || '(not set)');
    console.log('Port:', port);
    console.log('Secure:', secure);
    console.log('User:', user ? user : '(not set)');
    console.log('From:', fromAddr);
    console.log('Pass:', pass ? 'present (' + pass.length + ' chars)' : 'MISSING');

    const missing = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASS');
    if (missing.length > 0) {
        console.error('\nERROR: Missing required env vars:', missing.join(', '));
        console.error('Set them in coming-soon/.env or export before running.');
        console.error('\nFor Zoho Mail (Canadian data center):');
        console.error('  SMTP_HOST=smtp.zohocloud.ca');
        console.error('  SMTP_PORT=465');
        console.error('  SMTP_SECURE=true');
        console.error('  SMTP_USER=trevor@simplebeacon.ai');
        console.error('  SMTP_PASS=<zoho-app-specific-password>');
        console.error('  SMTP_FROM=admin@simplebeacon.ai');
        process.exit(2);
    }

    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch (_err) {
        console.error('\nERROR: nodemailer is not installed. Run: npm install nodemailer');
        process.exit(3);
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });

    // Step 1: Verify connection
    console.log('\nVerifying SMTP connection to', host + ':' + port + '...');
    try {
        await transporter.verify();
        console.log('Connection verified — SMTP server is reachable and credentials are valid.');
    } catch (err) {
        console.error('Connection verification FAILED:', err.message);
        console.error('\nCommon causes:');
        console.error('  - Wrong host/port (use smtp.zohocloud.ca:465 for Zoho Canada)');
        console.error('  - Wrong password (use app-specific password, not your login password)');
        console.error('  - SMTP not enabled for this Zoho user (check Zoho Mail settings)');
        console.error('  - Firewall blocking outbound port', port);
        process.exit(4);
    }

    if (args.verify) {
        console.log('\n--verify mode: connection check passed, no email sent.');
        process.exit(0);
    }

    // Step 2: Send test email
    if (!args.to || !args.to.includes('@')) {
        console.error('\nProvide a valid recipient: --to you@example.com');
        console.error('Or use --verify for connection check only.');
        process.exit(1);
    }

    const subject = 'SimpleBeacon SMTP test (' + new Date().toISOString() + ')';
    const text =
        'This is a test email from SimpleBeacon sent via Zoho Mail SMTP.\n\nIf you received this, SMTP is configured correctly.\n\nConfiguration:\n  Host: ' +
        host +
        '\n  Port: ' +
        port +
        '\n  User: ' +
        user +
        '\n  From: ' +
        fromAddr;
    const html =
        '<p>This is a test email from SimpleBeacon sent via <strong>Zoho Mail SMTP</strong>.</p><p>If you received this, SMTP is configured correctly.</p><hr><p><small>Host: ' +
        host +
        ':' +
        port +
        ' | User: ' +
        user +
        ' | From: ' +
        fromAddr +
        '</small></p>';

    console.log('\nSending test email to', args.to, 'from', fromAddr + '...');

    try {
        const info = await transporter.sendMail({
            from: fromAddr,
            to: args.to,
            subject,
            text,
            html
        });
        console.log('\nEmail sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response || '(none)');
        process.exit(0);
    } catch (err) {
        console.error('\nSend FAILED:', err.message);
        process.exit(5);
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
