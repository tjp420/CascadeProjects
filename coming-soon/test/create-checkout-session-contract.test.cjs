const { test } = require('node:test');
const assert = require('node:assert/strict');
const { previewCreateCheckoutSession } = require('../routes/checkout.cjs');

const ORIGIN = 'https://simplebeacon.ai';

test('playbook curl body is rejected (missing email and scans[])', () => {
    const preview = previewCreateCheckoutSession(
        {
            productType: 'executive_clearance',
            scanHash: 'sb_hash_abc123xyz789',
            projectName: 'Local Architecture Verify',
            issueCount: 4
        },
        { publicUrl: ORIGIN }
    );
    assert.equal(preview.ok, false);
    assert.equal(preview.status, 400);
});

test('roadmap $499 body builds payment session for executive_clearance', () => {
    const hex = 'abcdef0123456789abcdef0123456789';
    const preview = previewCreateCheckoutSession(
        {
            email: 'dryrun@example.com',
            projectName: 'Local Architecture Verify',
            clientName: 'dryrun@example.com',
            scans: ['executive_clearance'],
            total: 499,
            product: 'executive_clearance',
            scanHash: hex,
            cancelUrl: ORIGIN + '/roadmap.html'
        },
        { publicUrl: ORIGIN }
    );
    assert.equal(preview.ok, true);
    const p = preview.stripeParams;
    assert.equal(p.mode, 'payment');
    assert.match(p.success_url, /\/certificate-upload\.html\?session_id=\{CHECKOUT_SESSION_ID\}$/);
    assert.equal(p.cancel_url, ORIGIN + '/roadmap.html?canceled=true');
    assert.equal(p.metadata.product, 'executive_clearance');
    assert.equal(p.metadata.scans, 'executive_clearance');
    assert.equal(p.metadata.scanHash, hex);
    assert.equal(p.line_items.length, 1);
    assert.equal(p.line_items[0].price_data.unit_amount, 49900);
    assert.equal(p.line_items[0].price_data.currency, 'usd');
});

test('non-hex scanHash is omitted from metadata', () => {
    const preview = previewCreateCheckoutSession(
        {
            email: 'dryrun@example.com',
            projectName: 'Local Architecture Verify',
            scans: ['executive_clearance'],
            total: 499,
            product: 'executive_clearance',
            scanHash: 'sb_hash_abc123xyz789'
        },
        { publicUrl: ORIGIN }
    );
    assert.equal(preview.ok, true);
    assert.equal(preview.stripeParams.metadata.scanHash, undefined);
});
