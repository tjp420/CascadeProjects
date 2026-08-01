#!/usr/bin/env node
// send-test-resend-email.cjs
// Sends a simple test email via Resend REST API using RESEND_API_KEY.
// Usage:
//   RESEND_API_KEY=re_xxx RESEND_FROM=certificates@simplebeacon.ai RESEND_TO=you@example.com node send-test-resend-email.cjs

const main = async () => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || 'certificates@simplebeacon.ai').trim();
  const to = String(process.env.RESEND_TO || process.argv[2] || '').trim();
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY is not set. Export RESEND_API_KEY=re_xxx');
    process.exit(2);
  }
  if (!to) {
    console.error('ERROR: Recipient not provided. Set RESEND_TO or pass recipient as first arg.');
    process.exit(2);
  }

  const subject = 'SimpleBeacon test email (Resend)';
  const html = `<p>This is a test email from SimpleBeacon sent at ${new Date().toISOString()}.</p><p>If you received this, Resend API is configured correctly.</p>`;

  const payload = {
    from,
    to: [to],
    subject,
    html
  };

  console.log('Sending test email via Resend to', to);

  if (typeof fetch === 'undefined') {
    console.error('ERROR: global fetch is not available in this Node runtime. Use Node 18+ or install node-fetch.');
    process.exit(3);
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      // reasonable timeout handled by Node runtime / fetch implementation
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }

    if (res.ok) {
      console.log('Resend API responded OK:', res.status);
      console.log(JSON.stringify(json, null, 2));
      process.exit(0);
    } else {
      console.error('Resend API error:', res.status, res.statusText);
      console.error(JSON.stringify(json, null, 2));
      process.exit(4);
    }
  } catch (err) {
    console.error('Request failed:', err.message);
    process.exit(5);
  }
};

main();
