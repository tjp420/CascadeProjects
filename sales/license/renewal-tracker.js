const fs = require('fs');
const path = require('path');

/**
 * Scan active licenses for expiring tokens within a lookahead window.
 *
 * @param {Array<{companyId:string,customerEmail:string,expiresAt:string,tier:string}>} activeLicenses
 * @param {number} lookaheadDays — Days ahead to warn (default: 30)
 * @returns {Array<{companyId:string,customerEmail:string,daysRemaining:number,expiresAt:string,tier:string}>}
 */
function checkExpiringLicenses(activeLicenses, lookaheadDays = 30) {
    console.log(`[SimpleBeacon] Running License Renewal Audit (Lookahead: ${lookaheadDays} Days)...`);
    const alertsGenerated = [];
    const now = new Date();

    const targetThresholdTime = now.getTime() + (lookaheadDays * 24 * 60 * 60 * 1000);

    activeLicenses.forEach(license => {
        const expirationDate = new Date(license.expiresAt);
        const expTime = expirationDate.getTime();

        // Identify keys falling inside the lookahead warning window
        if (expTime > now.getTime() && expTime <= targetThresholdTime) {
            const daysRemaining = Math.ceil((expTime - now.getTime()) / (1000 * 60 * 60 * 24));

            alertsGenerated.push({
                companyId: license.companyId,
                customerEmail: license.customerEmail,
                daysRemaining,
                expiresAt: license.expiresAt,
                tier: license.tier
            });
        }
    });

    return alertsGenerated;
}

module.exports = { checkExpiringLicenses };

// Runnable entry script handler
if (require.main === module) {
    // Mock dataset mimicking active database rows
    const mockDbRows = [
        { companyId: 'alpha-labs', customerEmail: 'admin@alphalabs.io', expiresAt: '2026-07-15', tier: 'team' },
        { companyId: 'beta-finance', customerEmail: 'security@betafin.com', expiresAt: '2026-11-30', tier: 'enterprise' }
    ];

    const alerts = checkExpiringLicenses(mockDbRows, 30);
    console.log(`\nAutomated Email Triggers (${alerts.length}):`);
    console.log(JSON.stringify(alerts, null, 2));
}
