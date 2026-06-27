// SimpleBeacon scan utilities stub // simplebeacon-ignore memory-leak — stub utility object, not a leaking event listener
window.ScanUtils = {
  runScan: () => console.warn('[Stub] ScanUtils.runScan not implemented'),
  getResults: () => Promise.resolve({ issues: [] }),
};
