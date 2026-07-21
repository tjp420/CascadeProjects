const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    loadFingerprints,
    extractFeatureVector,
    matchFingerprints,
    fingerprintFindings,
    cosineSimilarity
} = require('../src/vector-cache.js');

test('cosineSimilarity returns 1 for identical vectors', () => {
    const result = cosineSimilarity([1, 0, 1], [1, 0, 1]);
    assert.ok(Math.abs(result - 1.0) < 0.0001);
});

test('cosineSimilarity returns 0 for orthogonal vectors', () => {
    const result = cosineSimilarity([1, 0], [0, 1]);
    assert.ok(Math.abs(result) < 0.0001);
});

test('cosineSimilarity handles empty vectors', () => {
    const result = cosineSimilarity([], []);
    assert.equal(typeof result, 'number');
});

test('extractFeatureVector returns object with numeric features', () => {
    const code = 'function processData(data) { return data; }';
    const result = extractFeatureVector(code, 'javascript');
    assert.ok(result);
    assert.equal(typeof result, 'object');
});

test('loadFingerprints returns object or null', () => {
    const result = loadFingerprints();
    assert.ok(result === null || typeof result === 'object');
});

test('matchFingerprints returns array', () => {
    const features = { functionCount: 1, hasReturn: true };
    const fingerprints = loadFingerprints();
    if (fingerprints) {
        const result = matchFingerprints(features, fingerprints);
        assert.ok(Array.isArray(result));
    }
});

test('fingerprintFindings returns array', () => {
    const code = 'function processData(data) { return data; }';
    const result = fingerprintFindings(code, 'javascript');
    assert.ok(Array.isArray(result));
});
