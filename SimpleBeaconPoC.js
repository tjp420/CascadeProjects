// Compatibility wrapper to allow CommonJS callers to use the ESM PoC
module.exports.runSimpleBeaconAudit = (...args) =>
  import('./SimpleBeaconPoC.mjs').then((m) => m.runSimpleBeaconAudit(...args));
