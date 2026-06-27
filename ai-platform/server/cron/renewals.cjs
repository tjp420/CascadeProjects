const { checkExpiringLicenses } = require('../../../sales/license/renewal-tracker.js');

/**
 * Dispatch automated 30-day renewal alert emails via Resend.
 *
 * @param {Array<{companyId:string,customerEmail:string,expiresAt:string,tier:string}>} databaseRecords
 */
async function dispatchAutomatedRenewalEmails(databaseRecords) {
    const lookaheadAlerts = checkExpiringLicenses(databaseRecords, 30);

    for (const alert of lookaheadAlerts) {
        const capitalizedTier = alert.tier.charAt(0).toUpperCase() + alert.tier.slice(1);

        try {
            await fetch('https://resend.com', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'billing@simplebeacon.ai',
                    to: alert.customerEmail,
                    subject: `Action Required: Your SimpleBeacon ${capitalizedTier} License Key is expiring soon`,
                    html: `
                        <p>Dear Team,</p>
                        <p>This is an automated notification to let you know that your <strong>SimpleBeacon ${capitalizedTier} Plan</strong> subscription for company instance <strong>${alert.companyId}</strong> is scheduled to expire in exactly 30 days on <strong>${alert.expiresAt}</strong>.</p>
                        <p>To prevent any interruptions to your release hygiene monitoring pipelines, VS Code real-time diagnostics, and automated CI gate checks, please verify your payment profiles ahead of the renewal date.</p>
                        <p><strong>Action Required:</strong> None if you have an active credit card on file. Your account will automatically renew for another 12-month billing period.</p>
                        <p>If you need to update corporate card info or download past invoices, visit your <a href="https://simplebeacon.ai">billing management console</a>.</p>
                        <p>Best regards,<br>The SimpleBeacon Billing Systems Team</p>
                    `
                })
            });
        } catch (err) {
            console.error(`[Renewal Alert] Failed to send email for ${alert.companyId}: ${err.message}`);
        }
    }
}

module.exports = { dispatchAutomatedRenewalEmails };

// Runnable entry point for cron scheduling
if (require.main === module) {
    // Example: load records from your database or JSON file before dispatching
    const mockDbRows = [
        { companyId: 'alpha-labs', customerEmail: 'admin@alphalabs.io', expiresAt: '2026-07-15', tier: 'team' },
        { companyId: 'beta-finance', customerEmail: 'security@betafin.com', expiresAt: '2026-11-30', tier: 'enterprise' }
    ];

    dispatchAutomatedRenewalEmails(mockDbRows).then(() => {
        console.log('[Renewal Alert] Dispatch cycle complete.');
    });
}
