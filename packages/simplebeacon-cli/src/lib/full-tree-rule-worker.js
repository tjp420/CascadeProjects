/**
 * Worker thread entry — runs runTextRulePasses on one file buffer (CPU-bound pass).
 */

const { parentPort, workerData } = require('worker_threads');
const { runTextRulePasses } = require('./full-tree-rule-pass');

try {
  const { relativePath, content, ext, options } = workerData;
  const result = runTextRulePasses(relativePath, content, ext, options || {});
  parentPort.postMessage({ ok: true, ...result });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    issues: [],
    counts: {},
    error: error.message || String(error),
  });
}
