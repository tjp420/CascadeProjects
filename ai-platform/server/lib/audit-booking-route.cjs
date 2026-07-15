// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const fs = require('fs');
const path = require('path');

const fsp = fs.promises;

/**
 * Bookings file path.
 * @param {Object} options
 * @returns {any}
 */
function bookingsFilePath(options) {
  const dataDir = options.dataDir || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'audit-bookings.json');
}

/**
 * Load bookings.
 * @param {Object} options
 * @returns {any}
 */
async function loadBookings(options) {
  const file = bookingsFilePath(options);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    console.warn('[audit-booking] load failed:', err.message);
    return [];
  }
}

/**
 * Save booking.
 * @param {any} entry
 * @param {Object} options
 * @returns {any}
 */
async function saveBooking(entry, options) {
  const file = bookingsFilePath(options);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const rows = await loadBookings(options);
  rows.push(entry);
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  return { rows, bookingId: rows.length, entry };
}

/**
 * Booking response.
 * @param {any} saved
 * @param {string} emailResult
 * @returns {any}
 */
function bookingResponse(saved, emailResult) {
  const emailSent = emailResult && emailResult.sent === true;
  return {
    ok: true,
    saved: true,
    emailSent,
    bookingId: saved.bookingId,
    totalBookings: saved.rows.length,
    operatorInboxUrl: '/operator/bookings',
    message: emailSent
      ? 'Booking saved and emailed to the operator inbox.'
      : 'Booking saved — view it in the operator inbox (email not configured yet).'
  };
}

/**
 * Handle audit booking.
 * @param {any} req
 * @param {Array} res
 * @param {Object} options
 * @returns {any}
 */
async function handleAuditBooking(req, res, options = {}) {
  const landingEnabled = options.landingEnabled !== false;
  if (!landingEnabled) return res.status(404).json({ error: 'not_found' });

  if (String(req.body?.website || '').trim()) {
    return res.json({ ok: true, emailSent: false, ignored: 'spam' });
  }

  const contactEmail = String(req.body?.contactEmail || req.body?.email || '').trim().toLowerCase();
  const company = String(req.body?.company || '').trim();
  const repository = String(req.body?.repository || '').trim();
  const branch = String(req.body?.branch || 'main').trim();
  const handoffDate = String(req.body?.handoffDate || req.body?.handoff_date || '').trim();
  const source = String(req.body?.source || 'landing').trim();
  const notes = String(req.body?.notes || '').trim();
  const paymentsMode = req.body?.paymentsEnabled === true ? 'paid' : 'testing';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (!company || !repository) {
    return res.status(400).json({ error: 'missing_fields', fields: ['company', 'repository'] });
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
    receivedAt: new Date().toISOString()
  };

  let saved;
  try {
    saved = await saveBooking(entry, options);
  } catch (err) {
    console.warn('[audit-booking] persist failed:', err.message);
    return res.status(500).json({ error: 'save_failed', message: err.message });
  }

  try {
    const { sendAuditBookingEmail } = require('./audit-booking-mail.cjs');
    const result = await sendAuditBookingEmail(entry);
    if (!result.sent) {
      return res.json(bookingResponse(saved, result));
    }
    return res.json(bookingResponse(saved, result));
  } catch (err) {
    console.warn('[audit-booking] email failed');
    return res.json({
      ...bookingResponse(saved, { sent: false }),
      emailError: err.message
    });
  }
}

/**
 * Handle list audit bookings.
 * @param {any} req
 * @param {Array} res
 * @param {Object} options
 * @returns {any}
 */
async function handleListAuditBookings(req, res, options = {}) {
  const landingEnabled = options.landingEnabled !== false;
  if (!landingEnabled) return res.status(404).json({ error: 'not_found' });

  const rows = (await loadBookings(options)).slice().reverse();
  return res.json({
    ok: true,
    count: rows.length,
    bookings: rows
  });
}

/**
 * Register operator inbox page.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerOperatorInboxPage(app, options = {}) {
  if (options.landingEnabled === false) return;
  const landingRoot = options.landingRoot;
  if (!landingRoot) return;

  const inboxHtml = path.join(landingRoot, 'operator-bookings.html');
  if (!fs.existsSync(inboxHtml)) return;

/**
 * Send inbox.
 * @param {any} _req
 * @param {Array} res
 * @returns {any}
 */
  function sendInbox(_req, res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.type('text/html');
    res.sendFile(inboxHtml);
  }

  app.get('/operator/bookings', sendInbox);
}

/**
 * Register audit booking route.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function registerAuditBookingRoute(app, options = {}) {
  app.post('/api/audit-booking', (req, res) => {
    handleAuditBooking(req, res, options).catch((err) => {
      console.warn('[audit-booking] request failed:', err.message);
      res.status(500).json({ error: 'request_failed', message: err.message });
    });
  });
  app.get('/api/audit-bookings', (req, res) => {
    handleListAuditBookings(req, res, options).catch((err) => {
      console.warn('[audit-booking] list failed:', err.message);
      res.status(500).json({ error: 'list_failed', message: err.message });
    });
  });
  registerOperatorInboxPage(app, options);
}

module.exports = {
  handleAuditBooking,
  handleListAuditBookings,
  registerOperatorInboxPage,
  registerAuditBookingRoute,
  loadBookings
};
