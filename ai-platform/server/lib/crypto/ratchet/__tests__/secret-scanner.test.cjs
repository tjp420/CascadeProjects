const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanFiles } = require('../secret-scanner.cjs');

function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scn-'));
  const file = path.join(tmp, 'leak.js');
  // Insert a fake TRACK113_KEK assignment and a high-entropy base64 string
  const fakeKek = 'TRACK113_KEK = "' + 'a'.repeat(40) + '";';
  fs.writeFileSync(file, `// test\n${fakeKek}\n`);

  const findings = scanFiles([file]);
  assert.ok(findings.length >= 1, 'scanner should detect the fake KEK assignment');

  // cleanup
  try { fs.rmSync(tmp, { recursive: true }); } catch (e) {}
  console.log('secret-scanner test OK');
}

if (require.main === module) run();

test('secret scanner run to completion', run);

module.exports = { run };
