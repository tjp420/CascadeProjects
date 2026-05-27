/**
 * Cloudflare Pages Function — POST /api/waitlist
 * Optional bindings:
 * - WAITLIST_KV: persist signups/count
 * - WAITLIST_WEBHOOK: forward payload to Zapier/Make/Formspree
 * - RESEND_API_KEY + WAITLIST_NOTIFY_TO (+ WAITLIST_NOTIFY_FROM): email notifications
 */
export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid_email' }, 400);
  }

  const entry = {
    email,
    source: body.source || 'landing',
    ts: body.ts || new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  const kv = context.env.WAITLIST_KV;
  if (kv) {
    try {
      const existing = await kv.get(`email:${email}`);
      if (!existing) {
        await kv.put(`email:${email}`, JSON.stringify(entry));
        const countRaw = await kv.get('waitlist:count');
        const count = countRaw ? parseInt(countRaw, 10) || 0 : 0;
        await kv.put('waitlist:count', String(count + 1));
      }
    } catch (err) {
      console.warn('[waitlist] KV persist failed:', err.message);
    }
  }

  const hook = context.env.WAITLIST_WEBHOOK;
  const notifications = sendNotifications(context, entry, hook).catch((err) => {
    console.warn('[waitlist] notification failed:', err.message);
  });

  if (typeof context.waitUntil === 'function') {
    context.waitUntil(notifications);
  } else {
    await notifications;
  }

  return json({ ok: true, email });
}

export async function onRequestGet(context) {
  const kv = context.env.WAITLIST_KV;
  if (!kv) return json({ count: null });
  try {
    const countRaw = await kv.get('waitlist:count');
    return json({ count: countRaw ? parseInt(countRaw, 10) || 0 : 0 });
  } catch {
    return json({ count: null });
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

async function sendNotifications(context, entry, hook) {
  if (hook) {
    try {
      const hookRes = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!hookRes.ok) {
        throw new Error(`waitlist_webhook_http_${hookRes.status}`);
      }
    } catch (err) {
      console.warn('[waitlist] webhook failed:', err.message);
    }
  }

  const resendApiKey = String(context.env.RESEND_API_KEY || '').trim();
  const notifyTo = String(context.env.WAITLIST_NOTIFY_TO || '').trim();
  if (!resendApiKey || !notifyTo) return;

  const notifyFrom = String(context.env.WAITLIST_NOTIFY_FROM || '').trim()
    || 'SimpleBeacon <noreply@simplebeacon.ai>';
  const source = entry.source || 'landing';
  const submittedAt = entry.receivedAt || new Date().toISOString();

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: notifyFrom,
      to: [notifyTo],
      subject: `New waitlist signup: ${entry.email}`,
      text: [
        'New waitlist signup received.',
        '',
        `Email: ${entry.email}`,
        `Source: ${source}`,
        `Submitted: ${submittedAt}`
      ].join('\n')
    })
  });

  if (!mailRes.ok) {
    const errorText = await mailRes.text().catch(() => '');
    throw new Error(`resend_http_${mailRes.status}${errorText ? `: ${errorText.slice(0, 300)}` : ''}`);
  }
}
