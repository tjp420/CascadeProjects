/**
 * Send transactional mail via Resend (Cloudflare Pages Functions).
 */
export async function sendResendMail(env, options) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { sent: false, reason: 'missing_api_key' };

  const to = String(options.to || env.AUDIT_NOTIFY_TO || env.WAITLIST_NOTIFY_TO || '').trim();
  if (!to) return { sent: false, reason: 'missing_notify_to' };

  const from = String(options.from || env.AUDIT_NOTIFY_FROM || env.WAITLIST_NOTIFY_FROM || '').trim()
    || 'SimpleBeacon <onboarding@resend.dev>';

  const payload = {
    from,
    to: [to],
    subject: options.subject,
    text: options.text
  };

  if (options.replyTo) payload.reply_to = options.replyTo;

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!mailRes.ok) {
    const errorText = await mailRes.text().catch(() => '');
    let friendly = `Resend HTTP ${mailRes.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed && parsed.message) friendly = parsed.message;
    } catch {
      if (errorText) friendly = errorText.slice(0, 300);
    }
    if (/authorization header required/i.test(friendly)) {
      friendly = 'Resend API key missing or invalid — set RESEND_API_KEY in Cloudflare Pages secrets.';
    }
    throw new Error(friendly);
  }

  return { sent: true, to, from };
}
