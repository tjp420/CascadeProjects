/**
 * Parallel full-tree text rule passes via worker_threads (I/O stays on main thread).
 */

const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_SCRIPT = path.join(__dirname, 'full-tree-rule-worker.js');
const DEFAULT_MIN_FILES = 48;
const DEFAULT_MAX_WORKERS = 8;

function finiteOption(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveWorkerCount(fileCount, options = {}) {
  if (options.parallel === false) return 0;
  if (process.env.SIMPLEBEACON_PARALLEL === '0') return 0;
  const minFiles =
    options.parallelMinFiles != null
      ? finiteOption(options.parallelMinFiles, DEFAULT_MIN_FILES)
      : finiteOption(process.env.SIMPLEBEACON_PARALLEL_MIN_FILES, DEFAULT_MIN_FILES);
  if (fileCount < minFiles) return 0;

  const cap =
    options.parallelMaxWorkers != null
      ? finiteOption(options.parallelMaxWorkers, DEFAULT_MAX_WORKERS)
      : finiteOption(process.env.SIMPLEBEACON_PARALLEL_MAX_WORKERS, DEFAULT_MAX_WORKERS);
  const cpus = os.cpus()?.length || 4;
  return Math.max(1, Math.min(cap, cpus, fileCount));
}

function runWorkerTask(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SCRIPT, { workerData: payload });
    let settled = false;
    worker.on('message', (msg) => {
      settled = true;
      resolve(msg);
      worker.terminate().catch(() => {});
    });
    worker.on('error', (error) => {
      if (!settled) reject(error);
    });
    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`full-tree worker exited with code ${code}`));
      }
    });
  });
}

async function runTextRulePassesParallel(jobs, options = {}) {
  const workerCount = resolveWorkerCount(jobs.length, options);
  if (!workerCount) {
    const { runTextRulePasses } = require('./full-tree-rule-pass');
    return jobs.map((job) => ({
      ok: true,
      ...runTextRulePasses(job.relativePath, job.content, job.ext, job.options),
    }));
  }

  const results = new Array(jobs.length);
  let cursor = 0;

  async function workerLoop() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= jobs.length) return;
      const job = jobs[index];
      try {
        results[index] = await runWorkerTask({
          relativePath: job.relativePath,
          content: job.content,
          ext: job.ext,
          options: job.options,
        });
      } catch (error) {
        results[index] = {
          ok: false,
          issues: [],
          counts: {},
          error: error.message || String(error),
        };
      }
    }
  }

  const loops = Array.from({ length: workerCount }, () => workerLoop());
  await Promise.all(loops);
  return results;
}

module.exports = {
  runTextRulePassesParallel,
  resolveWorkerCount,
  DEFAULT_MIN_FILES,
  DEFAULT_MAX_WORKERS,
};
