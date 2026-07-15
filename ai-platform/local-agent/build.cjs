// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Pre-package build script for the SimpleBeacon local agent.
 *
 * Verifies that the scanner module and config are reachable before pkg runs,
 * and creates a staging directory that pkg can bundle from the monorepo.
 */

const fs = require('fs');
const path = require('path');

const LOCAL_AGENT_DIR = __dirname;
const MONOREPO_ROOT = path.resolve(LOCAL_AGENT_DIR, '..', '..');
const SCANNER_MODULE = path.join(MONOREPO_ROOT, 'packages', 'simplebeacon-cli', 'src', 'index.js');
const SIMPLEBEACON_DIR = path.join(MONOREPO_ROOT, '.simplebeacon');

function verifyPath(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`Cannot package local agent: ${label} not found at ${p}`);
  }
}

function main() {
  verifyPath(SCANNER_MODULE, 'SimpleBeacon CLI scanner module');
  verifyPath(SIMPLEBEACON_DIR, '.simplebeacon config directory');
  console.log('[build] Scanner module and config directory verified.');
}

if (require.main === module) {
  main();
}

module.exports = { main };
