const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeScanHash,
    resolveCheckoutCancelUrl
} = require('../routes/checkout.cjs');

const ORIGIN = 'https://simplebeacon.ai';

test('sanitizeScanHash keeps lowercase hex fingerprints', () => {
    assert.equal(sanitizeScanHash('ABCDEF1234567890deadbeef'), 'abcdef1234567890deadbeef');
});

test('sanitizeScanHash rejects short or non-hex values', () => {
    assert.equal(sanitizeScanHash('abc'), '');
    assert.equal(sanitizeScanHash('not-a-hash'), '');
    assert.equal(sanitizeScanHash(''), '');
});

test('resolveCheckoutCancelUrl allowlists roadmap and pricing', () => {
    assert.equal(
        resolveCheckoutCancelUrl('/roadmap.html', ORIGIN),
        ORIGIN + '/roadmap.html?canceled=true'
    );
    assert.equal(
        resolveCheckoutCancelUrl('/roadmap', ORIGIN),
        ORIGIN + '/roadmap.html?canceled=true'
    );
    assert.equal(
        resolveCheckoutCancelUrl(undefined, ORIGIN),
        ORIGIN + '/pricing.html?canceled=true'
    );
});

test('resolveCheckoutCancelUrl blocks open redirects', () => {
    assert.equal(
        resolveCheckoutCancelUrl('https://evil.example/phish', ORIGIN),
        ORIGIN + '/pricing.html?canceled=true'
    );
    assert.equal(
        resolveCheckoutCancelUrl('/admin', ORIGIN),
        ORIGIN + '/pricing.html?canceled=true'
    );
});
