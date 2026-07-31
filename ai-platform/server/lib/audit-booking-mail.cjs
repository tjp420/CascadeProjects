/**
 * Local dev + dashboard server — audit booking email via Resend.
 *
 * @license MIT
 */
async function sendResendMail(options) {
  try {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return { sent: false, reason: 'missing_api_key' };

    const to = String(
      options.to || process.env.AUDIT_NOTIFY_TO || process.env.WAITLIST_NOTIFY_TO || ''
    ).trim();
    if (!to) return { sent: false, reason: 'missing_notify_to' };

    const from = String(
      options.from || process.env.AUDIT_NOTIFY_FROM || process.env.WAITLIST_NOTIFY_FROM || ''
    ).trim();
    if (!from) return { sent: false, reason: 'missing_notify_from' };

    const payload = {
      from,
      to: [to],
      subject: options.subject,
      text: options.text,
    };

    if (options.replyTo) payload.reply_to = options.replyTo;

    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
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
        friendly =
          'Resend API key missing or invalid — set RESEND_API_KEY in .env.v1-internal and restart the server.';
      }
      throw new Error(friendly);
    }

    return { sent: true, to, from };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/**
 * Format a booking email body from a booking entry.
 * @param {Object} entry - Booking entry.
 * @returns {string} Formatted email body.
 */
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
    `Received: ${entry.receivedAt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Send an audit booking email for a given entry.
 * @param {Object} entry - Booking entry.
 * @returns {Promise<{sent:boolean,to:string,from:string}>}
 */
async function sendAuditBookingEmail(entry) {
  return sendResendMail({
    subject: `[SimpleBeacon] Audit booking — ${entry.company}`,
    replyTo: entry.contactEmail,
    text: formatBookingEmail(entry),
  });
}

module.exports = { sendAuditBookingEmail, formatBookingEmail };
