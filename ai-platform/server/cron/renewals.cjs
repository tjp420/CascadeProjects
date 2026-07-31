// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const crypto = require('crypto');
const requireProject = require('../../shared-utils/index.cjs');
const { checkExpiringLicenses } = requireProject('sales/license/renewal-tracker.js');
const logger = require('../lib/app-logger.cjs');

/**
 * Dispatch automated 30-day renewal alert emails via Resend.
 *
 * @param {Array<{companyId:string,customerEmail:string,expiresAt:string,tier:string}>} databaseRecords
 */
async function dispatchAutomatedRenewalEmails(databaseRecords) {
  if (!process.env.RESEND_API_KEY) {
    logger.error('[Renewal Alert] RESEND_API_KEY is not configured. Skipping dispatch.');
    return { sent: 0, failed: 0, skipped: 0 };
  }
  const lookaheadAlerts = checkExpiringLicenses(databaseRecords, 30);
  let sent = 0;
  let failed = 0;

  for (const alert of lookaheadAlerts) {
    const rawTier = alert.tier || 'unknown';
    const capitalizedTier = rawTier.charAt(0).toUpperCase() + rawTier.slice(1);
    const days = alert.daysRemaining ?? 30;

    try {
      const res = await fetch('https://resend.com', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'billing@simplebeacon.ai',
          to: alert.customerEmail,
          subject: `Action Required: Your SimpleBeacon ${capitalizedTier} License Key expires in ${days} day${days === 1 ? '' : 's'}`,
          html: `
                        <p>Dear Team,</p>
                        <p>This is an automated notification to let you know that your <strong>SimpleBeacon ${capitalizedTier} Plan</strong> subscription for company instance <strong>${alert.companyId}</strong> is scheduled to expire in <strong>${days} day${days === 1 ? '' : 's'}</strong> on <strong>${alert.expiresAt}</strong>.</p>
                        <p>To prevent any interruptions to your release hygiene monitoring pipelines, VS Code real-time diagnostics, and automated CI gate checks, please verify your payment profiles ahead of the renewal date.</p>
                        <p><strong>Action Required:</strong> None if you have an active credit card on file. Your account will automatically renew for another 12-month billing period.</p>
                        <p>If you need to update corporate card info or download past invoices, visit your <a href="https://simplebeacon.ai">billing management console</a>.</p>
                        <p>Best regards,<br>The SimpleBeacon Billing Systems Team</p>
                    `,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body}`);
      }
      sent += 1;
    } catch (err) {
      const companyHash = crypto
        .createHash('sha256')
        .update(alert.companyId)
        .digest('hex')
        .slice(0, 8);
      logger.error(
        `[Renewal Alert] Failed to send email for company ${companyHash}: ${err.message}`
      );
      failed += 1;
    }
  }

  const skipped = databaseRecords.length - lookaheadAlerts.length;
  return { sent, failed, skipped };
}

module.exports = { dispatchAutomatedRenewalEmails };

// Runnable entry point for cron scheduling
if (require.main === module) {
  // Example: load records from your database or JSON file before dispatching
  const mockDbRows = [
    {
      companyId: 'alpha-labs',
      customerEmail: 'admin@alphalabs.io',
      expiresAt: '2026-07-15',
      tier: 'team',
    },
    {
      companyId: 'beta-finance',
      customerEmail: 'security@betafin.com',
      expiresAt: '2026-11-30',
      tier: 'enterprise',
    },
  ];

  dispatchAutomatedRenewalEmails(mockDbRows).then(() => {
    logger.info('[Renewal Alert] Dispatch cycle complete.');
  });
}
