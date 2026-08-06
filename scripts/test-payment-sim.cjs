'use strict';
/**
 * Payment simulation: verifies that the new tier names (developer, team_pro)
 * correctly map to the right price constants in subscriptions-billing.cjs.
 *
 * Stubs out stripe.checkout.sessions.create so no real API call is made.
 * Tests both monthly and annual billing for each tier.
 */
const http = require('http');
const path = require('path');
const Module = require('module');
const express = require('express');

// --- Unified module stubbing ---
const stripeCallLog = [];
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    // Stub stripe
    if (id === 'stripe') {
        return function () {
            return {
                customers: {
                    create: async () => ({ id: 'cus_test_' + Date.now() })
                },
                checkout: {
                    sessions: {
                        create: async (params) => {
                            stripeCallLog.push(params);
                            return { id: 'cs_test_123', url: 'https://checkout.stripe.com/test/abc123' };
                        }
                    }
                }
            };
        };
    }
    // Stub db
    if (id === '../lib/db.cjs' || id === './lib/db.cjs' || id.includes('lib/db.cjs')) {
        return {
            getOrCreateCustomer: () => ({ id: 1, email: 'test@example.com', subscription_status: 'inactive', stripe_customer_id: null, tier: 'community' }),
            updateCustomerSubscription: () => {},
            updateCustomerStripeId: () => {},
            getDb: () => ({ prepare: () => ({ all: () => [] }) })
        };
    }
    // Stub referral-webhook
    if (id.includes('referral-webhook')) {
        return { buildReferralCheckoutMetadata: () => ({}), processStripeReferralAttribution: () => {} };
    }
    // Stub license-utils
    if (id.includes('license-utils')) {
        return { generateLicenseToken: () => 'test-token-123' };
    }
    return originalRequire.apply(this, arguments);
};

// Now require the router
const routerPath = path.resolve(__dirname, '..', 'coming-soon', 'routes', 'subscriptions-billing.cjs');
const routerModule = require(routerPath);
const router = routerModule.router || routerModule;

// Build a minimal express app
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use('/', router);

const server = app.listen(0, () => {
    const port = server.address().port;
    console.log('[sim] Test server on port ' + port);

    const testCases = [
        { tier: 'developer', mode: 'monthly',  expectedCents: 4900,   label: 'Developer monthly ($49/mo)' },
        { tier: 'developer', mode: 'annual',   expectedCents: 49000,  label: 'Developer annual ($490/yr)' },
        { tier: 'team_pro',  mode: 'monthly',  expectedCents: 14900,  label: 'Team Pro monthly ($149/mo)' },
        { tier: 'team_pro',  mode: 'annual',   expectedCents: 149000, label: 'Team Pro annual ($1490/yr)' },
        { tier: 'pro',       mode: 'monthly',  expectedCents: 900,    label: 'Legacy Pro monthly ($9/mo, backward compat)' },
        // Extra seat add-on tests
        { tier: 'team_pro',  mode: 'monthly',  expectedCents: 14900,  label: 'Team Pro monthly + 3 extra seats ($149 + 3×$15 = $194/mo)',
          extraSeats: 3, expectedSeatCents: 1500, expectedSeatQty: 3 },
        { tier: 'team_pro',  mode: 'annual',   expectedCents: 149000, label: 'Team Pro annual + 5 extra seats ($1490 + 5×$150 = $2240/yr)',
          extraSeats: 5, expectedSeatCents: 15000, expectedSeatQty: 5 },
        { tier: 'team_pro',  mode: 'monthly',  expectedCents: 14900,  label: 'Team Pro monthly + 0 extra seats (no add-on line item)',
          extraSeats: 0, expectNoSeatItem: true },
        { tier: 'developer', mode: 'monthly',  expectedCents: 4900,   label: 'Developer monthly + extraSeats ignored (not team_pro)',
          extraSeats: 5, expectNoSeatItem: true },
    ];

    let passed = 0;
    let failed = 0;

    function runNext(idx) {
        if (idx >= testCases.length) {
            console.log('\n========================================');
            console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
            console.log('========================================');
            if (stripeCallLog.length > 0) {
                console.log('\nStripe session.create call log:');
                stripeCallLog.forEach((c, i) => {
                    const li = c.line_items || [];
                    console.log('  Call ' + (i+1) + ': ' + li.length + ' line item(s)' +
                        ' | base=' + li[0]?.price_data?.unit_amount + ' ' + li[0]?.price_data?.recurring?.interval +
                        ' "' + li[0]?.price_data?.product_data?.name + '"' +
                        (li[1] ? ' | add-on=' + li[1]?.price_data?.unit_amount + ' ×' + li[1]?.quantity + ' "' + li[1]?.price_data?.product_data?.name + '"' : ''));
                });
            }
            server.close();
            process.exit(failed > 0 ? 1 : 0);
            return;
        }

        const tc = testCases[idx];
        const payload = {
            email: 'test@example.com',
            projectName: 'test-project',
            clientName: 'Test Co',
            tier: tc.tier,
            mode: tc.mode
        };
        if (tc.extraSeats !== undefined) {
            payload.extraSeats = tc.extraSeats;
        }

        const body = JSON.stringify(payload);
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/api/create-subscription-session',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-Forwarded-For': '10.0.0.' + (idx + 1)
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const stripeCall = stripeCallLog[stripeCallLog.length - 1];
                const actualCents = stripeCall?.line_items?.[0]?.price_data?.unit_amount;
                const actualInterval = stripeCall?.line_items?.[0]?.price_data?.recurring?.interval;
                const actualName = stripeCall?.line_items?.[0]?.price_data?.product_data?.name;
                const expectedInterval = tc.mode === 'annual' ? 'year' : 'month';

                const centsOk = actualCents === tc.expectedCents;
                const intervalOk = actualInterval === expectedInterval;
                let responseOk = false;
                try { responseOk = res.statusCode === 200 && JSON.parse(data).success === true; } catch (_e) {}

                // Check extra seat line item
                let seatOk = true;
                const seatItem = stripeCall?.line_items?.[1];
                if (tc.expectNoSeatItem) {
                    seatOk = !seatItem; // should NOT have a second line item
                } else if (tc.expectedSeatCents) {
                    seatOk = seatItem &&
                        seatItem.price_data?.unit_amount === tc.expectedSeatCents &&
                        seatItem.quantity === tc.expectedSeatQty &&
                        seatItem.price_data?.recurring?.interval === expectedInterval;
                }

                const pass = centsOk && intervalOk && responseOk && seatOk;
                if (pass) { passed++; } else { failed++; }

                console.log('\n[' + (pass ? 'PASS' : 'FAIL') + '] ' + tc.label);
                console.log('  Payload: tier=' + tc.tier + ', mode=' + tc.mode + (tc.extraSeats !== undefined ? ', extraSeats=' + tc.extraSeats : ''));
                console.log('  Expected: ' + tc.expectedCents + ' cents, interval=' + expectedInterval);
                console.log('  Actual:   ' + actualCents + ' cents, interval=' + actualInterval + ', name="' + actualName + '"');
                if (tc.expectedSeatCents) {
                    console.log('  Seat item: expected ' + tc.expectedSeatCents + ' cents × ' + tc.expectedSeatQty + ', got ' + (seatItem ? seatItem.price_data?.unit_amount + ' × ' + seatItem.quantity : 'NONE'));
                } else if (tc.expectNoSeatItem) {
                    console.log('  Seat item: expected none, got ' + (seatItem ? 'PRESENT' : 'none'));
                }
                console.log('  HTTP ' + res.statusCode + ': ' + (responseOk ? 'success=true' : data.substring(0, 200)));

                runNext(idx + 1);
            });
        });

        req.on('error', (e) => {
            console.log('[ERROR] ' + tc.label + ': ' + e.message);
            failed++;
            runNext(idx + 1);
        });

        req.write(body);
        req.end();
    }

    runNext(0);
});
