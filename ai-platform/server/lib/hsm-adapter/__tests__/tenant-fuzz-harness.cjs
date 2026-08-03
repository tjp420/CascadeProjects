'use strict';

// Minimal fuzzing utilities for tenant-boundary saturation tests.
exports.makePrototypePollutionPolicy = function () {
  return {
    version: '0.0.0',
    default: {},
    tenants: {
      'malicious-tenant': {
        __proto__: { polluted: true },
        constructor: { prototype: { pollutedViaConstructor: true } },
      },
      'clean-tenant': {
        minimumKekBits: 256,
      },
    },
  };
};
