// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Smoke tests for the SimpleBeacon local agent.
 *
 * These tests spin up the agent on a random ephemeral port and verify the
 * health and validation endpoints without running a full SimpleBeacon scan.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { app } = require('./agent.cjs');

function request(port, method, route, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function findPort() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function test() {
  const port = await findPort();
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    // Health check
    const health = await request(port, 'GET', '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.success, true);
    assert.strictEqual(health.body.agent, 'simplebeacon-local-agent');

    // Missing path
    const missing = await request(port, 'POST', '/scan', { projectPath: '' });
    assert.strictEqual(missing.status, 400);
    assert.ok(missing.body.error.includes('required'));

    // URL rejected
    const urlPath = await request(port, 'POST', '/scan', {
      projectPath: 'https://example.com/repo',
    });
    assert.strictEqual(urlPath.status, 400);
    assert.ok(urlPath.body.error.includes('URL'));

    // Non-existent absolute path
    const fake = await request(port, 'POST', '/scan', {
      projectPath: 'C:\\\\no-such-folder-12345',
    });
    assert.strictEqual(fake.status, 400);
    assert.ok(fake.body.error.includes('does not exist'));

    // Valid directory (agent's own directory)
    const valid = await request(port, 'POST', '/scan', { projectPath: path.resolve(__dirname) });
    if (valid.status === 200) {
      assert.strictEqual(valid.body.success, true);
      assert.ok(valid.body.report);
    } else {
      // Scanner may not be available in this environment; at least verify validation passed.
      assert.ok(
        valid.body.error.includes('scanner') || valid.body.error.includes('available'),
        valid.body.error
      );
    }

    console.log('agent tests passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
