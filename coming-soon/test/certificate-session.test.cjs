const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    isStripeCheckoutSessionId,
    isHydratableLicenseToken,
    fetchSessionToken
} = require('../public/js-es2018/certificate-session.js');

test('accepts Stripe Checkout session ids only', () => {
    assert.equal(isStripeCheckoutSessionId('cs_test_a1B2c3D4e5F6g7H8'), true);
    assert.equal(isStripeCheckoutSessionId('cs_live_abcdefghijklmnop'), true);
    assert.equal(isStripeCheckoutSessionId('../etc/passwd'), false);
    assert.equal(isStripeCheckoutSessionId('sb_hash_abc123xyz789'), false);
    assert.equal(isStripeCheckoutSessionId(''), false);
});

test('license tokens must look like signed JWTs', () => {
    assert.equal(isHydratableLicenseToken('aaa.bbb.ccc.dddddddddddd'), true);
    assert.equal(isHydratableLicenseToken('<script>alert(1)</script>'), false);
    assert.equal(isHydratableLicenseToken('short'), false);
    assert.equal(isHydratableLicenseToken('no-dots-but-long-enough-token-value'), false);
});

test('fetchSessionToken retries 404 then hydrates a valid token', async () => {
    let calls = 0;
    const token = 'license.header.payload.signaturepaddingxx';
    const fetchImpl = async () => {
        calls += 1;
        if (calls < 3) {
            return { ok: false, status: 404, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, token }) };
    };
    const result = await fetchSessionToken('', 'cs_test_abcdefghijklmnop', {
        fetchImpl,
        attempts: 5,
        delaysMs: [0, 0, 0, 0],
        timeoutMs: 50
    });
    assert.equal(result.ok, true);
    assert.equal(result.token, token);
    assert.equal(calls, 3);
});

test('fetchSessionToken does not hydrate HTML or empty tokens', async () => {
    const fetchImpl = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, token: '<img src=x>' })
    });
    const result = await fetchSessionToken('', 'cs_test_abcdefghijklmnop', {
        fetchImpl,
        attempts: 1,
        delaysMs: [0]
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_token');
});
