const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateFormat, selectPayload } = require('../../src/lib/format-utils');

describe('format-utils', () => {
  describe('validateFormat', () => {
    it('accepts text format', () => {
      assert.doesNotThrow(() => validateFormat('text'));
    });

    it('accepts json format', () => {
      assert.doesNotThrow(() => validateFormat('json'));
    });

    it('accepts action-plan format', () => {
      assert.doesNotThrow(() => validateFormat('action-plan'));
    });

    it('throws for invalid format', () => {
      assert.throws(() => validateFormat('xml'), /Invalid --format/);
    });
  });

  describe('selectPayload', () => {
    it('returns JSON string for json format', () => {
      const report = { gatePass: true };
      const gateResult = { pass: true };
      const jsonReport = { summary: 'ok' };
      const result = selectPayload(report, gateResult, jsonReport, 'json');
      assert.strictEqual(result, JSON.stringify(jsonReport, null, 2));
    });
  });
});
