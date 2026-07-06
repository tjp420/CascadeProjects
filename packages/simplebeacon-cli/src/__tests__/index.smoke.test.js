'use strict';

/**
 * Smoke test for packages/simplebeacon-cli/src/index.js
 * Verifies deep freeze, collision detection, and namespace lazy loading.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const simplebeacon = require('../index.js');

describe('index.js smoke', () => {
    it('exports version', () => {
        assert.strictEqual(typeof simplebeacon.version, 'string');
        assert.ok(simplebeacon.version.length > 0);
    });

    it('flat object is deeply frozen', () => {
        assert.strictEqual(Object.isFrozen(simplebeacon), true);
    });

    it('namespace object is deeply frozen', () => {
        assert.strictEqual(Object.isFrozen(simplebeacon.Simplebeacon), true);
    });

    it('namespace scan is a Proxy (lazy)', () => {
        const scan = simplebeacon.Simplebeacon.scan;
        assert.ok(scan);
        assert.strictEqual(typeof scan.runScan, 'function');
    });

    it('namespace gate is a Proxy (lazy)', () => {
        const gate = simplebeacon.Simplebeacon.gate;
        assert.ok(gate);
        assert.strictEqual(typeof gate.evaluateGate, 'function');
    });

    it('flat export contains scan function', () => {
        assert.strictEqual(typeof simplebeacon.runScan, 'function');
    });

    it('flat export contains gate function', () => {
        assert.strictEqual(typeof simplebeacon.evaluateGate, 'function');
    });

    it('helper functions are present', () => {
        assert.strictEqual(typeof simplebeacon.resolveMockDataScanPaths, 'function');
        assert.strictEqual(typeof simplebeacon.getRepositoryAuditBaseline, 'function');
        assert.strictEqual(typeof simplebeacon.getConsistencyAnchorSamples, 'function');
    });

    it('mutation is prevented on flat export', () => {
        assert.throws(() => {
            simplebeacon.version = '9.9.9';
        });
    });
});
