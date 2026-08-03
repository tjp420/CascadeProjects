const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Integration script body: run as a plain Node child so audit-logger env is fresh.
if (typeof test !== 'function') {
  // Use a test-scoped audit file to avoid polluting production logs
  const TEST_AUDIT_PATH = path.join(process.cwd(), '.simplebeacon', 'audit-test.json');
  process.env.AUDIT_LOG_PATH = TEST_AUDIT_PATH;
  delete process.env.SIEM_ENDPOINT; // force stderr fallback

  // Ensure the directory exists for the test audit file
  try { fs.mkdirSync(path.dirname(TEST_AUDIT_PATH), { recursive: true }); } catch (e) {}

  // Load audit logger after env set so tamper-detector reads the correct path
  const audit = require('../audit-logger.cjs');

  // capture stderr output
  const origErr = console.error;
  const captured = [];
  console.error = function (...args) {
    try { captured.push(args.map(String).join(' ')); } catch (e) {}
    try { return origErr.apply(console, args); } catch (e) {}
  };

  // Clean any previous test file
  try { if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH); } catch (e) {}

  const payloadHash = 'deadbeefcafef00d000000000000000000000000000000000000000000000000';

  function makeParams(i) {
    return {
      orgId: 'test-org',
      actorId: `tester-${i}`,
      actorEmail: `tester+${i}@example.com`,
      action: 'PROOF_VERIFY_FAILED',
      entity: 'partial_share_proof',
      entityId: '',
      metadata: { payloadHash, reason: 'signature_invalid' },
    };
  }

  // Write three failure entries to trip the detector
  for (let i = 0; i < 3; i++) {
    audit.log(makeParams(i));
  }

  // Small sleep to ensure any async SIEM writes bounce through (should be immediate)
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  (async () => {
    await sleep(200);

    // Restore console.error
    console.error = origErr;

    // Check captured stderr for PROOF_TAMPER_ALERT
    const found = captured.some((s) => s.includes('PROOF_TAMPER_ALERT'));
    if (!found) {
      console.error('ERROR: expected PROOF_TAMPER_ALERT on stderr, captured:', captured);
      process.exit(2);
    }

    // Check audit file contains a PROOF_TAMPER_ALERT entry
    let store = { entries: {} };
    try {
      const raw = fs.readFileSync(TEST_AUDIT_PATH, 'utf8');
      store = JSON.parse(raw);
    } catch (e) {
      console.error('ERROR: failed to read audit test file', e && e.message);
      process.exit(3);
    }

    const alerts = Object.values(store.entries || {}).filter((e) => e && e.action === 'PROOF_TAMPER_ALERT' && e.metadata && e.metadata.payloadHash === payloadHash);
    if (alerts.length === 0) {
      console.error('ERROR: expected PROOF_TAMPER_ALERT entry in audit log');
      process.exit(4);
    }

    // success
    console.log('OK: tamper detector triggered and alert recorded');

    // cleanup
    try { fs.unlinkSync(TEST_AUDIT_PATH); } catch (e) {}
    process.exit(0);
  })();
} else {
  // Jest wrapper: spawn the same file as a plain Node script
  test('tamper detector integration triggers PROOF_TAMPER_ALERT', (done) => {
    const runner = path.resolve(__filename);
    execFile(process.execPath, [runner], { env: process.env }, (err, stdout, stderr) => {
      // The integration runner exits 0 on success and prints the OK message
      if (err) {
        done(new Error(`integration runner failed: ${err.message}\nstdout: ${stdout}\nstderr: ${stderr}`));
        return;
      }
      expect(stdout).toContain('OK: tamper detector triggered and alert recorded');
      expect(stderr).toContain('PROOF_TAMPER_ALERT');
      done();
    });
  });
}
