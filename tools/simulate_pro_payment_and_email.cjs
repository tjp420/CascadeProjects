#!/usr/bin/env node
// Simulate a Pro-tier payment and email the user.
// Usage:
// 1) Dry-run (safe): node tools/simulate_pro_payment_and_email.cjs --email=granny.cee48@hushmail.com --name="Granny Cee"
// 2) Send for real (requires email provider env vars): SEND_EMAIL=true node tools/simulate_pro_payment_and_email.cjs --email=granny.cee48@hushmail.com --name="Granny Cee"

const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const sendEmail = require(path.join(__dirname, '..', 'ai-platform', 'server', 'lib', 'email-service.cjs')).sendEmail;

async function main() {
  const email = argv.email || argv.to;
  const name = argv.name || 'Customer';
  const tier = argv.tier || 'Pro';
  if (!email) {
    console.error('Error: --email is required');
    process.exit(1);
  }

  const invoiceId = `inv_${Date.now()}`;
  const subject = `Your ${tier} subscription is active — SimpleBeacon`;
  const text = `Hi ${name},\n\nThanks — we received your payment and your ${tier} subscription is now active.\n\nInvoice: ${invoiceId}\nPlan: ${tier}\nBilling date: ${new Date().toISOString()}\n\nIf you did not expect this charge, contact support@simplebeacon.ai.\n\n— The SimpleBeacon Team`;
  const html = `<p>Hi ${name},</p><p>Thanks — we received your payment and your <strong>${tier}</strong> subscription is now active.</p><p><b>Invoice:</b> ${invoiceId}<br/><b>Plan:</b> ${tier}<br/><b>Billing date:</b> ${new Date().toISOString()}</p><p>If you did not expect this charge, contact support@simplebeacon.ai.</p><p>— The SimpleBeacon Team</p>`;

  const dryRun = !(process.env.SEND_EMAIL === 'true');
  console.log(`Simulating Pro payment for ${email} (name=${name}, tier=${tier})`);
  console.log(dryRun ? 'Dry-run mode: no email will be sent. Set SEND_EMAIL=true to actually send.' : 'SEND_EMAIL=true detected — attempting to send email via configured provider.');

  if (dryRun) {
    console.log('--- Email preview ---');
    console.log('To:', email);
    console.log('Subject:', subject);
    console.log('Text:', text);
    process.exit(0);
  }

  try {
    const result = await sendEmail({ to: email, subject, text, html });
    console.log('Send result:', result);
    if (result.sent) {
      console.log('Email sent successfully.');
    } else if (result.queued) {
      console.log('Email queued to disk:', result.queuePath || '(unknown path)');
    } else {
      console.log('Email not sent:', result.error || JSON.stringify(result));
    }
  } catch (err) {
    console.error('Failed to send email:', err && err.message ? err.message : String(err));
    process.exit(2);
  }
}

main();
