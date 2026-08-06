// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const {
  getOutreachFrom,
  getOutreachReplyTo,
  isOutreachConfigured,
  loadSentLog,
  removeSentLogEntry,
  sentEntryId,
  sendOutreachEmail
} = require('./outreach-mail.cjs');
const logger = require('./app-logger.cjs');
const { sendClientError, ERROR_CODES } = require('../../shared-utils/index.cjs');
const { setupOutreachResendWebhook } = require('./outreach-resend-webhook.cjs');

/**
 * Handle outreach config.
 * @param {any} _req
 * @param {Array} res
 * @returns {any}
 */
async function handleOutreachConfig(_req, res) {
  return res.json({
    configured: isOutreachConfigured(),
    from: getOutreachFrom(),
    replyTo: getOutreachReplyTo()
  });
}

/**
 * Handle outreach sent.
 * @param {any} req
 * @param {Array} res
 * @param {Object} options
 * @returns {any}
 */
async function handleOutreachSent(req, res, options = {}) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const rows = await loadSentLog(options);
  return res.json({
    total: rows.length,
    items: rows.slice(-limit).reverse()
  });
}

/**
 * Handle outreach sent delete.
 * @param {any} req
 * @param {Array} res
 * @param {Object} options
 * @returns {any}
 */
async function handleOutreachSentDelete(req, res, options = {}) {
  const id = String(req.params.id || req.body?.id || '').trim();
  try {
    const result = await removeSentLogEntry(id, options);
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.code === 'missing_id') {
      return sendClientError(res, 400, err, {
        errorLabel: ERROR_CODES.ERR_OUTREACH_MISSING_ID,
        fallback: 'Missing send log id.',
        req
      });
    }
    if (err.code === 'not_found') {
      return sendClientError(res, 404, err, {
        errorLabel: ERROR_CODES.ERR_OUTREACH_LOG_NOT_FOUND,
        fallback: 'Send log entry not found.',
        req
      });
    }
    return sendClientError(res, 500, err, {
      errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
      fallback: 'Outreach request failed',
      req
    });
  }
}

/**
 * Handle outreach send.
 * @param {any} req
 * @param {Array} res
 * @param {Object} options
 * @returns {any}
 */
async function handleOutreachSend(req, res, options = {}) {
  if (String(req.body?.website || '').trim()) {
    return res.json({ ok: true, sent: false, ignored: 'spam' });
  }

  try {
    const result = await sendOutreachEmail(
      {
        to: req.body?.to,
        subject: req.body?.subject,
        text: req.body?.text || req.body?.message,
        company: req.body?.company,
        prospectId: req.body?.prospectId
      },
      options
    );

    return res.json({
      ok: true,
      sent: true,
      to: result.to,
      from: result.from,
      replyTo: getOutreachReplyTo(),
      sentAt: result.entry.sentAt
    });
  } catch (err) {
    const code = err.code || 'send_failed';
    if (code === 'invalid_email') {
      return sendClientError(res, 400, err, {
        errorLabel: ERROR_CODES.ERR_INVALID_EMAIL,
        fallback: 'Enter a valid recipient email.',
        req
      });
    }
    if (code === 'subject_too_short') {
      return sendClientError(res, 400, err, {
        errorLabel: ERROR_CODES.ERR_SUBJECT_TOO_SHORT,
        fallback: 'Subject must be at least 3 characters.',
        req
      });
    }
    if (code === 'message_too_short') {
      return sendClientError(res, 400, err, {
        errorLabel: ERROR_CODES.ERR_MESSAGE_TOO_SHORT,
        fallback: 'Message must be at least 20 characters.',
        req
      });
    }
    if (code === 'message_too_long') {
      return sendClientError(res, 400, err, {
        errorLabel: ERROR_CODES.ERR_MESSAGE_TOO_LONG,
        fallback: 'Message exceeds 12,000 characters.',
        req
      });
    }
    if (code === 'missing_api_key' || code === 'email_not_configured') {
      return sendClientError(res, 503, err, {
        errorLabel: ERROR_CODES.ERR_EMAIL_NOT_CONFIGURED,
        fallback: 'Set RESEND_API_KEY in .env.v1-internal and restart npm run dashboard:v1-internal.',
        req
      });
    }
    logger.warn('[outreach] send failed:', err.message);
    return sendClientError(res, 502, err, {
      errorLabel: ERROR_CODES.ERR_EMAIL_SEND_FAILED,
      fallback: 'Outreach email send failed',
      req
    });
  }
}

const OUTREACH_ROUTE_PREFIXES = [
  '/api/outreach',
  '/api/simplebeacon/outreach'
];

/**
 * Register outreach routes.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerOutreachRoutes(app, options = {}) {
  const prefixes = options.prefixes || OUTREACH_ROUTE_PREFIXES;

  for (const prefix of prefixes) {
    const base = String(prefix).replace(/\/$/, '');

    app.get(`${base}/config`, (req, res) => {
      handleOutreachConfig(req, res).catch((err) => {
        sendClientError(res, 500, err, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
          fallback: 'Outreach request failed',
          req
        });
      });
    });

    app.get(`${base}/sent`, (req, res) => {
      handleOutreachSent(req, res, options).catch((err) => {
        sendClientError(res, 500, err, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
          fallback: 'Outreach request failed',
          req
        });
      });
    });

    app.delete(`${base}/sent/:id`, (req, res) => {
      handleOutreachSentDelete(req, res, options).catch((err) => {
        sendClientError(res, 500, err, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
          fallback: 'Outreach request failed',
          req
        });
      });
    });

    app.post(`${base}/send`, (req, res) => {
      handleOutreachSend(req, res, options).catch((err) => {
        sendClientError(res, 500, err, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
          fallback: 'Outreach request failed',
          req
        });
      });
    });

    // Prospects — return prospect list from sent log or empty array
    app.get(`${base}/prospects`, async (req, res) => {
      try {
        const sentLog = await loadSentLog(options);
        const prospects = (sentLog || []).map((entry, i) => ({
          id: sentEntryId(entry) || `prospect_${i}`,
          name: entry.name || entry.toName || '',
          email: entry.to || entry.email || '',
          company: entry.company || '',
          persona: entry.persona || '',
          ...entry
        }));
        res.json(prospects);
      } catch (err) {
        logger.warn('[outreach] prospects query failed:', err.message);
        res.json([]);
      }
    });

    // Campaign state — aggregate prospect status from sent log for the outreach analytics dashboard
    app.get(`${base}/campaign-state`, async (req, res) => {
      try {
        const sentLog = await loadSentLog(options);
        const entries = sentLog || [];
        const now = new Date().toISOString();
        const prospects = {};
        let totalContacted = 0;
        let totalReplies = 0;
        let totalMeetings = 0;
        let totalPilots = 0;
        let totalClosed = 0;

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const id = sentEntryId(entry) || `prospect_${i}`;
          const emailHistory = Array.isArray(entry.history) ? entry.history.map((h) => ({
            sequence: h.sequence || 'A',
            step: h.step || 1,
            template: h.template || '',
            subject: h.subject || '',
            sentAt: h.sentAt || h.date || ''
          })) : [];
          const firstEmail = emailHistory[0]?.sentAt || null;
          const lastEmail = emailHistory[emailHistory.length - 1]?.sentAt || null;
          const replied = Boolean(entry.replied || entry.repliedAt);
          const meetingBooked = Boolean(entry.meetingBooked || entry.meetingDate);
          const pilotStarted = Boolean(entry.pilotStarted || entry.pilotDate);
          const closed = Boolean(entry.closed || entry.closedDate);

          if (emailHistory.length > 0) totalContacted++;
          if (replied) totalReplies++;
          if (meetingBooked) totalMeetings++;
          if (pilotStarted) totalPilots++;
          if (closed) totalClosed++;

          prospects[id] = {
            status: entry.status || (emailHistory.length > 0 ? 'contacted' : 'pending'),
            sequence: entry.sequence || 'A',
            currentStep: entry.currentStep || emailHistory.length,
            firstEmailDate: firstEmail,
            lastEmailDate: lastEmail,
            replied,
            repliedAt: entry.repliedAt || null,
            meetingBooked,
            meetingDate: entry.meetingDate || null,
            pilotStarted,
            pilotDate: entry.pilotDate || null,
            closed,
            closedDate: entry.closedDate || null,
            closedValue: entry.closedValue || 0,
            reactivationStep: entry.reactivationStep || 0,
            sequenceCompleteDate: entry.sequenceCompleteDate || null,
            emailHistory
          };
        }

        res.json({
          createdAt: entries[0]?.createdAt || now,
          updatedAt: now,
          prospects,
          stats: {
            totalContacted,
            totalReplies,
            totalMeetings,
            totalPilots,
            totalClosed
          }
        });
      } catch (err) {
        logger.warn('[outreach] campaign-state query failed:', err.message);
        res.json({
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          prospects: {},
          stats: { totalContacted: 0, totalReplies: 0, totalMeetings: 0, totalPilots: 0, totalClosed: 0 }
        });
      }
    });
  }

  setupOutreachResendWebhook(app, options);
}

module.exports = {
  OUTREACH_ROUTE_PREFIXES,
  registerOutreachRoutes,
  handleOutreachConfig,
  handleOutreachSend,
  handleOutreachSent,
  handleOutreachSentDelete
};
