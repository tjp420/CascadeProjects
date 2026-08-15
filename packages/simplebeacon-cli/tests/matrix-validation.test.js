'use strict';

/**
 * node:test integration for the true-positive matrix validation suite.
 *
 * This wraps run-matrix-validation.cjs as a node:test test so it runs
 * alongside the existing test suite via `npm test`.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

test('true-positive matrix validation: all engines detect expected findings', () => {
    const runner = path.join(__dirname, 'fixtures', 'true-positives', 'run-matrix-validation.cjs');
    try {
        const output = execFileSync('node', [runner], {
            encoding: 'utf8',
            timeout: 60000,
            stdio: 'pipe'
        });
        // Verify recall = 1.0 in the output
        assert.match(output, /Recall:\s+1\b/, 'Suite recall should be 1.0');
        assert.match(output, /RESULT:\s+ALL\s+PASS/, 'All fixtures should pass');
    } catch (err) {
        if (err.stdout) {
            console.log(err.stdout);
        }
        if (err.stderr) {
            console.error(err.stderr);
        }
        throw new Error(
            'Matrix validation failed — one or more engines missed expected findings.\n' +
            'Run `node tests/fixtures/true-positives/run-matrix-validation.cjs` for details.'
        );
    }
});
