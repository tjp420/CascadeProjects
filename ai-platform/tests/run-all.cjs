'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 3999;
const SERVER_PATH = path.join(__dirname, '..', 'simplebeacon-server.cjs');
const TESTS_DIR = __dirname;

const TEST_SUITES = [
  { name: 'Alerts', file: 'test-alerts.cjs' },
  { name: 'Guardrails', file: 'test-guardrails.cjs' },
  { name: 'RBAC', file: 'test-rbac.cjs' },
  { name: 'Compliance', file: 'test-compliance.cjs' },
];

function waitForServer(maxWaitMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > maxWaitMs) {
        reject(new Error(`Server did not start within ${maxWaitMs}ms`));
        return;
      }
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 404) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      });
      req.on('error', () => setTimeout(check, 1000));
      req.setTimeout(3000, () => { req.destroy(); setTimeout(check, 1000); });
    }
    check();
  });
}

function runTestSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(TESTS_DIR, file)], {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Simplebeacon Platform Integration Test Runner         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Verify server file exists
  if (!fs.existsSync(SERVER_PATH)) {
    console.error('ERROR: Server file not found at', SERVER_PATH);
    process.exit(1);
  }

  // Start server
  console.log(`Starting server on port ${PORT}...`);
  const server = spawn(process.execPath, [SERVER_PATH], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
    cwd: path.join(__dirname, '..'),
  });

  let serverOutput = '';
  server.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) serverOutput += line + '\n';
  });
  server.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) serverOutput += line + '\n';
  });

  // Wait for server to be ready
  try {
    await waitForServer();
    console.log('Server is ready.\n');
  } catch (err) {
    console.error('Failed to start server:', err.message);
    console.error('Server output:\n', serverOutput);
    server.kill('SIGKILL');
    process.exit(1);
  }

  // Run test suites
  let totalPass = 0;
  let totalFail = 0;
  const results = [];

  for (const suite of TEST_SUITES) {
    console.log(`\n── Running ${suite.name} Suite (${suite.file}) ──`);
    const passed = await runTestSuite(suite.file);
    results.push({ name: suite.name, passed });
    if (!passed) totalFail++;
    else totalPass++;
  }

  // Shutdown server
  console.log('\nShutting down server...');
  server.kill('SIGKILL');

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Suite Summary                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const padding = ' '.repeat(Math.max(0, 44 - r.name.length - status.length));
    console.log(`║  ${r.name}${padding}${status}  ║`);
  }
  console.log('╠════════════════════════════════════════════════════════════╣');
  const summary = `${totalPass}/${totalPass + totalFail} suites passed`;
  const summaryPad = ' '.repeat(Math.max(0, 44 - summary.length));
  console.log(`║  ${summary}${summaryPad}  ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
