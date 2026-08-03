'use strict';

/**
 * Parallel test suite runner used by run-all-tracks.cjs.
 *
 * Executes Jest suites concurrently and aggregates results.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveBaseTestFile(pattern) {
  const __dirname = path.dirname(__filename);
  const files = fs.readdirSync(__dirname)
    .filter((f) =>
      f.endsWith('.test.cjs') &&
      !f.includes('-extensions') &&
      !f.includes('-stress') &&
      f.replace(/\.test\.cjs$/, '').includes(pattern)
    )
    .sort((a, b) => a.length - b.length);
  return files[0] ? `server/lib/hsm-adapter/__tests__/${files[0]}` : pattern;
}

function runSuite(pattern) {
  const target = resolveBaseTestFile(pattern);
  const cwd = path.resolve(__dirname, '../../..');
  const start = Date.now();
  return new Promise((resolve) => {
    exec(`npx jest ${target} --silent --coverage=false`, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }, (err, stdout, stderr) => {
      const durationMs = Date.now() - start;
      const output = err ? (err.stdout || err.message) : stdout;
      const status = err ? 'FAIL' : 'PASS';
      resolve({ pattern, status, durationMs, output });
    });
  });
}

async function runSuitesParallel(suites, options = {}) {
  const progress = options.progress || false;
  const concurrency = options.concurrency || os.cpus().length;
  const start = Date.now();
  const results = [];

  for (let i = 0; i < suites.length; i += concurrency) {
    const chunk = suites.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((pattern) => runSuite(pattern)));
    if (progress) {
      for (const r of chunkResults) {
        console.log(`  [${results.length + chunkResults.indexOf(r) + 1}/${suites.length}] ${r.pattern.toLowerCase().replace(/\s+/g, '-')} -> ${r.status} (${r.durationMs}ms) [${results.length + chunkResults.indexOf(r) + 1} ${r.status === 'PASS' ? 'PASS' : 'FAIL'}, 0 FAIL] ${((Date.now() - start) / 1000).toFixed(1)}s`);
      }
    }
    results.push(...chunkResults);
  }

  const totalMs = Date.now() - start;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const throughput = passed / (totalMs / 1000);
  return { results, totalMs, passed, failed, throughput };
}

module.exports = { runSuitesParallel };
