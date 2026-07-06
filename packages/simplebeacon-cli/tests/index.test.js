'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const index = require('../src/index');
const { Simplebeacon } = index;

describe('index.js public API', () => {
    it('exports a frozen object', () => {
        assert.strictEqual(Object.isFrozen(index), true);
    });

    it('has version string', () => {
        assert.strictEqual(typeof index.version, 'string');
        assert.ok(index.version.length > 0);
    });

    it('exposes core scan functions', () => {
        assert.strictEqual(typeof index.runScan, 'function');
        assert.strictEqual(typeof index.scanMockDataDirectories, 'function');
        assert.strictEqual(typeof index.evaluateGate, 'function');
    });

    it('exposes reporter functions', () => {
        assert.strictEqual(typeof index.formatJsonReport, 'function');
        assert.strictEqual(typeof index.formatTextReport, 'function');
        assert.strictEqual(typeof index.buildAssessmentReport, 'function');
    });

    it('exposes sanitizer functions', () => {
        assert.strictEqual(typeof index.sanitizeScanReport, 'function');
        assert.strictEqual(typeof index.redactSecretsInString, 'function');
    });

    it('exposes utility functions', () => {
        assert.strictEqual(typeof index.sleep, 'function');
        assert.strictEqual(typeof index.retry, 'function');
        assert.strictEqual(typeof index.memoize, 'function');
        assert.strictEqual(typeof index.camelCase, 'function');
        assert.strictEqual(typeof index.noop, 'function');
    });

    it('exposes error classes', () => {
        assert.strictEqual(typeof index.SimplebeaconError, 'function');
        assert.strictEqual(typeof index.ConfigError, 'function');
        assert.strictEqual(typeof index.ScanError, 'function');
        assert.strictEqual(typeof index.PathError, 'function');
    });

    it('aliases point to same function as canonical names', () => {
        assert.strictEqual(index.loadSamplebeaconConfig, index.loadSimplebeaconConfig);
        assert.strictEqual(Simplebeacon.config.initSamplebeacon, Simplebeacon.config.initSimplebeacon);
    });

    it('Simplebeacon namespace exists and is frozen', () => {
        assert.ok(Simplebeacon);
        assert.strictEqual(Object.isFrozen(Simplebeacon), true);
    });

    it('Simplebeacon.config contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.config.loadSimplebeaconConfig, 'function');
        assert.strictEqual(typeof Simplebeacon.config.resolveMockDataScanPaths, 'function');
        assert.strictEqual(Simplebeacon.config.loadSamplebeaconConfig, Simplebeacon.config.loadSimplebeaconConfig);
        assert.strictEqual(Simplebeacon.config.initSamplebeacon, Simplebeacon.config.initSimplebeacon);
        assert.strictEqual(Object.isFrozen(Simplebeacon.config), true);
    });

    it('Simplebeacon.scan contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.scan.runScan, 'function');
        assert.strictEqual(typeof Simplebeacon.scan.evaluateGate, 'undefined');
    });

    it('Simplebeacon.gate contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.gate.evaluateGate, 'function');
    });

    it('Simplebeacon.report contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.report.formatJsonReport, 'function');
        assert.strictEqual(typeof Simplebeacon.report.capitalize, 'function');
        assert.strictEqual(typeof Simplebeacon.report.pluralize, 'function');
        assert.strictEqual(typeof Simplebeacon.report.truncate, 'function');
    });

    it('Simplebeacon.utils contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.utils.sleep, 'function');
        assert.strictEqual(typeof Simplebeacon.utils.capitalize, 'function');
        assert.strictEqual(typeof Simplebeacon.utils.pluralize, 'function');
        assert.strictEqual(typeof Simplebeacon.utils.truncate, 'function');
        assert.strictEqual(typeof Simplebeacon.utils.debounceAsync, 'function');
        assert.strictEqual(typeof Simplebeacon.utils.memoizeAsync, 'function');
    });

    it('Simplebeacon.errors contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.errors.SimplebeaconError, 'function');
        assert.strictEqual(Object.isFrozen(Simplebeacon.errors), true);
    });

    it('Simplebeacon.mcp contains expected keys', () => {
        assert.strictEqual(typeof Simplebeacon.mcp.createMcpStdioServer, 'function');
        assert.strictEqual(typeof Simplebeacon.mcp.TOOL_DEFINITIONS, 'object');
    });
});
