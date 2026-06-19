// SPDX-License-Identifier: MIT
const assert = require('assert');
const { describe, it } = require('node:test');
const path = require('path');
const {
    loadReport,
    computeCrossReferenceConsistency,
    computeEnvKeyConsistency,
    computeMetadataConsistency,
    computeNamingConsistency,
    computeConsistencyScore
} = require('../consistency-score.cjs');

const REPORT_PATH = path.join(__dirname, '..', '.simplebeacon', 'report.json');

describe('consistency-score', () => {
    let report;

    it('loads the local report', () => {
        report = loadReport(REPORT_PATH);
        assert.ok(report);
        assert.strictEqual(report.type, 'simplebeacon-report');
    });

    it('computes cross-reference consistency', () => {
        const result = computeCrossReferenceConsistency(report);
        assert.strictEqual(typeof result.score, 'number');
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.strictEqual(result.label, 'cross-reference');
    });

    it('computes env-key consistency', () => {
        const result = computeEnvKeyConsistency(report);
        assert.strictEqual(typeof result.score, 'number');
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.strictEqual(result.label, 'env-key');
    });

    it('computes metadata consistency', () => {
        const result = computeMetadataConsistency(report);
        assert.strictEqual(typeof result.score, 'number');
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.strictEqual(result.label, 'metadata');
        assert.ok(Array.isArray(result.details));
    });

    it('computes naming consistency', () => {
        const result = computeNamingConsistency(report);
        assert.strictEqual(typeof result.score, 'number');
        assert.ok(result.score >= 0 && result.score <= 100);
        assert.strictEqual(result.label, 'naming');
    });

    it('computes overall consistency score', () => {
        const result = computeConsistencyScore(report);
        assert.strictEqual(typeof result.overallScore, 'number');
        assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
        assert.strictEqual(result.moduleLabel, 'Consistency Score');
        assert.ok(Array.isArray(result.dimensions));
        assert.strictEqual(result.dimensions.length, 4);
    });
});
