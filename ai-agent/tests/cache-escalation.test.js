'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    cacheKey,
    tryCache,
    storeCache,
    getCacheStats,
    buildEscalationPrompt,
    logEscalation,
    getEscalationSummary,
    shouldEscalate,
} = require('../plugins/cache-escalation.cjs');

// ─── Cache tests ────────────────────────────────────────────────────────────

test('cacheKey produces deterministic keys', () => {
    const key1 = cacheKey(['a.js', 'b.js'], 'fix the bug');
    const key2 = cacheKey(['b.js', 'a.js'], 'fix the bug'); // different order
    const key3 = cacheKey(['a.js', 'b.js'], 'fix the bug');
    assert.equal(key1, key3); // same files + prompt = same key
    assert.equal(key1, key2); // order-independent (sorted internally)
});

test('cacheKey differs for different prompts', () => {
    const key1 = cacheKey(['a.js'], 'fix bug A');
    const key2 = cacheKey(['a.js'], 'fix bug B');
    assert.notEqual(key1, key2);
});

test('tryCache returns miss on first lookup', () => {
    const result = tryCache(['test.js'], 'unique prompt ' + Date.now());
    assert.ok(!result.hit);
    assert.ok(result.key);
});

test('storeCache + tryCache returns hit', () => {
    const prompt = 'test prompt for caching ' + Math.random();
    const result = tryCache(['file.js'], prompt);
    assert.ok(!result.hit);

    storeCache(result.key, { patch: 'some response' });

    const result2 = tryCache(['file.js'], prompt);
    assert.ok(result2.hit);
    assert.deepEqual(result2.response, { patch: 'some response' });
});

test('getCacheStats returns size and hit rate', () => {
    const stats = getCacheStats();
    assert.ok(typeof stats.size === 'number');
    assert.ok(typeof stats.hitRate === 'number');
    assert.ok(stats.maxSize === 500);
});

// ─── Escalation tests ───────────────────────────────────────────────────────

test('buildEscalationPrompt includes intent, context, and request', () => {
    const prompt = buildEscalationPrompt({
        intent: 'Fix the auth bug',
        summaryText: '## auth.js\n- L10: function login(user, pass)',
        attemptedPatches: ['const x = 1;'],
        lastTestOutput: 'AssertionError: expected 200 got 401',
        reasoningTrace: 'Attempt 1: tried changing the token check',
    });

    assert.ok(prompt.includes('Fix the auth bug'));
    assert.ok(prompt.includes('auth.js'));
    assert.ok(prompt.includes('Attempt 1'));
    assert.ok(prompt.includes('AssertionError'));
    assert.ok(prompt.includes('unified diff'));
});

test('buildEscalationPrompt handles minimal params', () => {
    const prompt = buildEscalationPrompt({ intent: 'test' });
    assert.ok(prompt.includes('test'));
    assert.ok(prompt.includes('no summaries provided'));
});

test('logEscalation stores entries', () => {
    const before = getEscalationSummary().totalEscalations;
    logEscalation({ intent: 'test', attempts: 3, tokensUsed: 500, success: false });
    const after = getEscalationSummary();
    assert.ok(after.totalEscalations >= before + 1);
});

test('getEscalationSummary returns stats', () => {
    logEscalation({ intent: 'test1', attempts: 2, tokensUsed: 300, success: true });
    logEscalation({ intent: 'test2', attempts: 4, tokensUsed: 600, success: false });
    const summary = getEscalationSummary();
    assert.ok(summary.totalEscalations >= 2);
    assert.ok(typeof summary.successRate === 'number');
    assert.ok(typeof summary.avgAttempts === 'number');
    assert.ok(typeof summary.avgTokens === 'number');
});

test('shouldEscalate returns true when max attempts reached', () => {
    assert.ok(shouldEscalate({ attempts: 3, maxAttempts: 3 }));
    assert.ok(shouldEscalate({ attempts: 5, maxAttempts: 3 }));
});

test('shouldEscalate returns false when under max attempts', () => {
    assert.ok(!shouldEscalate({ attempts: 1, maxAttempts: 3 }));
    assert.ok(!shouldEscalate({ attempts: 0, maxAttempts: 3 }));
});

test('shouldEscalate escalates early for high complexity', () => {
    assert.ok(shouldEscalate({ attempts: 1, maxAttempts: 3, taskComplexity: 'high' }));
    assert.ok(!shouldEscalate({ attempts: 0, maxAttempts: 3, taskComplexity: 'high' }));
});

test('shouldEscalate escalates on repeated syntax errors', () => {
    assert.ok(shouldEscalate({
        attempts: 2,
        maxAttempts: 3,
        lastError: 'SyntaxError: unexpected token'
    }));
    assert.ok(!shouldEscalate({
        attempts: 1,
        maxAttempts: 3,
        lastError: 'SyntaxError: unexpected token'
    }));
});
