/**
 * Cloudflare Pages Function — POST /api/audit-booking
 * Sends booking requests to your inbox via Resend.
 *
 * Secrets (Cloudflare Pages → Settings → Variables):
 * - RESEND_API_KEY
 * - AUDIT_NOTIFY_TO (or WAITLIST_NOTIFY_TO) e.g. trevor_punt@live.com
 * - AUDIT_NOTIFY_FROM (optional) e.g. SimpleBeacon <noreply@simplebeacon.ai>
 */
import { sendResendMail } from '../_lib/resend-mail.js';

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (String(body.website || '').trim()) {
    return json({ ok: true, emailSent: false, ignored: 'spam' });
  }

  const contactEmail = String(body.contactEmail || body.email || '').trim().toLowerCase();
  const company = String(body.company || '').trim();
  const repository = String(body.repository || '').trim();
  const branch = String(body.branch || 'main').trim();
  const handoffDate = String(body.handoffDate || body.handoff_date || '').trim();
  const source = String(body.source || 'landing').trim();
  const notes = String(body.notes || '').trim();
  const paymentsMode = body.paymentsEnabled === true ? 'paid' : 'testing';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return json({ error: 'invalid_email' }, 400);
  }
  if (!company || !repository) {
    return json({ error: 'missing_fields', fields: ['company', 'repository'] }, 400);
  }

  const entry = {
    contactEmail,
    company,
    repository,
    branch,
    handoffDate,
    source,
    notes,
    paymentsMode,
    receivedAt: new Date().toISOString(),
    host: context.request.headers.get('cf-connecting-ip') || ''
  };

  const kv = context.env.AUDIT_BOOKING_KV || context.env.WAITLIST_KV;
  if (kv) {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await kv.put(`audit-booking:${id}`, JSON.stringify(entry));
    } catch (err) {
      console.warn('[audit-booking] KV persist failed:', err.message);
    }
  }

  let emailSent = false;
  try {
    const result = await sendResendMail(context.env, {
      subject: `[SimpleBeacon] Audit booking — ${company}`,
      replyTo: contactEmail,
      text: formatBookingEmail(entry)
    });
    emailSent = result.sent === true;
  } catch (err) {
    console.warn('[audit-booking] email failed:', err.message);
    return json({ error: 'email_failed', message: err.message }, 502);
  }

  if (!emailSent) {
    return json({ error: 'email_not_configured' }, 503);
  }

  return json({ ok: true, emailSent: true });
}

function formatBookingEmail(entry) {
  return [
    'New pre-launch audit booking request',
    '',
    `Contact email: ${entry.contactEmail}`,
    `Agency / company: ${entry.company}`,
    `Repository: ${entry.repository}`,
    `Branch: ${entry.branch || 'main'}`,
    `Client handoff date: ${entry.handoffDate || '(not provided)'}`,
    `Source: ${entry.source}`,
    `Payments mode: ${entry.paymentsMode}`,
    entry.notes ? `Notes: ${entry.notes}` : '',
    '',
    `Received: ${entry.receivedAt}`
  ].filter(Boolean).join('\n');
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
