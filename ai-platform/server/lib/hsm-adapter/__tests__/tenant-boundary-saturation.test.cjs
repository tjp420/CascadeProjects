'use strict';

const { CryptoPolicyEngine, DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
const { makePrototypePollutionPolicy } = require('./tenant-fuzz-harness.cjs');

describe('Tenant boundary saturation (minimal FUZZ-01)', () => {
  test('FUZZ-01: prototype pollution attack on tenant merge is blocked', () => {
    // Ensure clean starting state
    delete Object.prototype.polluted;
    delete Object.prototype.pollutedViaConstructor;

    const malicious = makePrototypePollutionPolicy();

    // Construct the engine with the malicious tenant blob
    const engine = new CryptoPolicyEngine(malicious, { strict: true });

    // The DEFAULT_POLICY must remain unpolluted
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(Object.prototype).not.toHaveProperty('pollutedViaConstructor');

    // The resolved tenant policy for a clean tenant must not contain polluted keys
    const clean = engine.getPolicy('clean-tenant');
    expect(clean).toBeDefined();
    expect(clean).not.toHaveProperty('polluted');
    expect(clean).not.toHaveProperty('pollutedViaConstructor');

    // The malicious tenant's resolved policy should not have injected prototype keys
    const maliciousResolved = engine.getPolicy('malicious-tenant');
    expect(maliciousResolved).toBeDefined();
    expect(maliciousResolved).not.toHaveProperty('polluted');
    expect(maliciousResolved).not.toHaveProperty('pollutedViaConstructor');
  });
});
