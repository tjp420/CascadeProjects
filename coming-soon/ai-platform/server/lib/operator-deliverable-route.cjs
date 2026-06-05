const path = require('path');
const {
  createDeliverableWorkspace,
  listProducts,
  vaultUrls,
  inferProductFromBooking
} = require('./operator-deliverable-service.cjs');
const { loadBookings } = require('./audit-booking-route.cjs');

function registerOperatorDeliverableRoute(app, options = {}) {
  const projectRoot = options.projectRoot || path.join(__dirname, '../..');
  const bookingsPath = options.bookingsPath
    || path.join(options.dataDir || path.join(projectRoot, 'data'), 'audit-bookings.json');

  app.get('/api/operator/products', (_req, res) => {
    res.json({ ok: true, products: listProducts() });
  });

  app.get('/api/operator/bootstrap', (_req, res) => {
    const urls = vaultUrls(projectRoot, { port: process.env.PORT });
    res.json({
      ok: true,
      internal: process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true',
      urls,
      defaultProduct: 'clearance499'
    });
  });

  app.post('/api/operator/deliverable', async (req, res) => {
    try {
      const body = req.body || {};
      let booking = body.booking || null;

      if (!booking && body.bookingKey) {
        const rows = await loadBookings({ dataDir: path.dirname(bookingsPath) });
        booking = rows.find((r) => r.receivedAt === body.bookingKey) || null;
      }

      if (!booking && body.bookingEmail) {
        const rows = await loadBookings({ dataDir: path.dirname(bookingsPath) });
        const email = String(body.bookingEmail).trim().toLowerCase();
        const matches = rows.filter((r) => String(r.contactEmail || '').toLowerCase() === email);
        booking = matches.length ? matches[matches.length - 1] : null;
      }

      const product = body.product || (booking ? inferProductFromBooking(booking) : 'clearance499');

      const result = await createDeliverableWorkspace(
        {
          product,
          booking,
          company: body.company || booking?.company,
          client: body.client,
          bookingEmail: body.bookingEmail || booking?.contactEmail,
          reportPath: body.reportPath || body.report,
          projectId: body.projectId,
          milestone: body.milestone
        },
        { projectRoot, bookingsPath }
      );

      if (!result.ok) {
        const status = result.error === 'unknown_product' ? 400
          : result.error === 'project_not_found' ? 404
          : 400;
        return res.status(status).json(result);
      }

      return res.status(201).json({
        ok: true,
        product: result.product.sku,
        label: result.product.label,
        workspaceDir: result.workspaceRelative,
        workspaceAbsolute: result.workspaceDir,
        gate: result.gate,
        gateWarning: result.gateWarning === true,
        urls: result.urls,
        vaultSteps: result.product.vaultSteps
      });
    } catch (err) {
      console.warn('[operator-deliverable] failed:', err.message);
      return res.status(500).json({ ok: false, error: 'workspace_failed', message: err.message });
    }
  });
}

module.exports = { registerOperatorDeliverableRoute };
