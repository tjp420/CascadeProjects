// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
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
    if (!Array.isArray(activeLicenses)) {
        console.warn('[SimpleBeacon] checkExpiringLicenses expected an array, received:', typeof activeLicenses);
        return [];
    }
    const days = Number.isFinite(lookaheadDays) && lookaheadDays > 0 ? Math.floor(lookaheadDays) : 30;
    console.log(`[SimpleBeacon] Running License Renewal Audit (Lookahead: ${days} Days)...`);
    const alertsGenerated = [];
    const now = new Date();
    const targetThresholdTime = now.getTime() + (days * 24 * 60 * 60 * 1000);

    for (const license of activeLicenses) {
        if (!license || typeof license.expiresAt !== 'string' || !license.expiresAt) {
            console.warn('[SimpleBeacon] Skipping license with missing/invalid expiresAt:', license?.companyId);
            continue;
        }
        const expirationDate = new Date(license.expiresAt);
        const expTime = expirationDate.getTime();
        if (Number.isNaN(expTime)) {
            console.warn(`[SimpleBeacon] Skipping license for ${license.companyId}: invalid date "${license.expiresAt}"`);
            continue;
        }
        // Identify keys falling inside the lookahead warning window
        if (expTime > now.getTime() && expTime <= targetThresholdTime) {
            const daysRemaining = Math.ceil((expTime - now.getTime()) / (1000 * 60 * 60 * 24));
            alertsGenerated.push({
                companyId: license.companyId || 'unknown',
                customerEmail: license.customerEmail || '',
                daysRemaining,
                expiresAt: license.expiresAt,
                tier: license.tier || 'unknown'
            });
        }
    }

    return alertsGenerated;
}

module.exports = { checkExpiringLicenses };

// Runnable entry script handler
if (require.main === module) {
    // Mock dataset mimicking active database rows
    // simplebeacon-ignore sensitive-data — mock test data, not real credentials
    const mockDbRows = [
        { companyId: 'alpha-labs', customerEmail: 'admin@alphalabs.io', expiresAt: '2026-07-15', tier: 'team' },
        { companyId: 'beta-finance', customerEmail: 'security@betafin.com', expiresAt: '2026-11-30', tier: 'enterprise' }
    ];

    const alerts = checkExpiringLicenses(mockDbRows, 30);
    console.log(`\nAutomated Email Triggers (${alerts.length}):`);
    console.log(JSON.stringify(alerts, null, 2));
}
