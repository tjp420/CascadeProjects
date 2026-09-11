const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const serverScript = path.join(repoRoot, 'api-server', 'server.cjs');
const mockVaultDir = path.join(repoRoot, 'secure_bounty_vault');
const mockHistoryPath = path.join(mockVaultDir, 'scan_history_store.json');

test('Prometheus /metrics Endpoint Router End-to-End Integration Contract', async (t) => {
  // Prepare mock history
  if (!fs.existsSync(mockVaultDir)) fs.mkdirSync(mockVaultDir, { recursive: true });
  const dummyHistoryPayload = [
    {
      scanId: 'integration_test_run',
      date: new Date().toISOString(),
      gate_pass: false,
      severityCounts: { critical: 0, high: 2, medium: 5, low: 10 },
    },
  ];
  fs.writeFileSync(mockHistoryPath, JSON.stringify(dummyHistoryPayload, null, 2), 'utf8');

  let serverProcess;

  await t.test('1. Spin up transient api-server instance layer', () => {
    return new Promise((resolve, reject) => {
      serverProcess = spawn(process.execPath, [serverScript], {
        env: { ...process.env, PORT: '58123', NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const onData = (data) => {
        const s = String(data);
        if (s.includes('SimpleBeacon API server running') || s.match(/listening/i)) {
          serverProcess.stdout.off('data', onData);
          resolve();
        }
      };

      serverProcess.stdout.on('data', onData);
      serverProcess.stderr.on('data', (d) => {
        // collect but don't fail on stderr unless process exits
      });

      serverProcess.on('error', (err) => reject(err));

      // Fallback timeout in case stdout readiness isn't emitted
      setTimeout(() => resolve(), 2000);
    });
  });

  await t.test('2. Query /metrics endpoint and assert content-type schema constraints', async () => {
    const fetchUrl = 'http://127.0.0.1:58123/metrics';
    let lastErr = null;
    let res = null;
    // retry loop: try for up to ~5 seconds
    for (let i = 0; i < 25; i++) {
      try {
        res = await fetch(fetchUrl, { method: 'GET' });
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!res) {
      assert.fail(`Network pipeline connection rejected after retries: ${lastErr && lastErr.message ? lastErr.message : String(lastErr)}`);
    }
    assert.strictEqual(res.status, 200, 'Server did not respond 200');
    const ct = res.headers.get('content-type') || '';
    assert.match(ct, /text\/plain/, 'Invalid Content-Type header');
    const text = await res.text();
    assert.match(text, /simplebeacon_scans_total 1/, 'missing scans_total metric');
    assert.match(text, /simplebeacon_gate_failures_total 1/, 'missing gate_failures metric');
    assert.match(text, /simplebeacon_exposed_vulnerabilities_current\{severity="high"\} 2/, 'missing high severity gauge');
  });

  // Teardown
  if (serverProcess) {
    try {
      serverProcess.kill('SIGKILL');
    } catch (e) {
      // ignore
    }
  }
  if (fs.existsSync(mockHistoryPath)) fs.unlinkSync(mockHistoryPath);
});
