const path = require('path');
const validate = require('../../packages/simplebeacon-cli/scripts/validate-custom-rules.js');

// Minimal smoke harness: require the validator and run it programmatically against the example rules
(async function run() {
  try {
    // call the script exported function if present, otherwise run as CLI
    if (typeof validate === 'function') {
      await validate({ rulesDir: path.resolve(__dirname, '..') });
      console.log('Validator completed (function export).');
      process.exit(0);
    }
  } catch (err) {
    console.error('Validator failed:', err);
    process.exit(2);
  }
  // fallback: spawn node CLI
  const { spawnSync } = require('child_process');
  const res = spawnSync('node', [path.resolve(__dirname, '../../packages/simplebeacon-cli/scripts/validate-custom-rules.js'), '--rules-dir', path.resolve(__dirname, '..')], { stdio: 'inherit' });
  process.exit(res.status || 0);
})();
