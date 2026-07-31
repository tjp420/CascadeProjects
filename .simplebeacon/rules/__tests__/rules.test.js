const path = require('path');
const { spawnSync } = require('child_process');

// Run the validator CLI against the example rules directory.
const scriptPath = path.resolve(__dirname, '..', '..', '..', 'packages', 'simplebeacon-cli', 'scripts', 'validate-custom-rules.js');
const rulesDir = path.resolve(__dirname, '..');
const res = spawnSync(process.execPath, [scriptPath, '--rules-dir', rulesDir], { stdio: 'inherit' });
process.exit(res.status || 0);
