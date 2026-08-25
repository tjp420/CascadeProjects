const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CPU_CORES = os.cpus().length || 2;
const WORKER_COUNT = Math.max(1, CPU_CORES - 1);

console.log(`🚀 Initializing Experimental Worker Pool across ${WORKER_COUNT} background threads...`);

function collectSampleFilePaths(rootDir, limit = 5000) {
  const collected = [];
  const stack = [rootDir];
  while (stack.length && collected.length < limit) {
    const p = stack.pop();
    try {
      const dirents = fs.readdirSync(p, { withFileTypes: true });
      for (const d of dirents) {
        const full = path.join(p, d.name);
        if (d.isFile()) {
          collected.push(full);
          if (collected.length >= limit) break;
        } else if (d.isDirectory()) {
          stack.push(full);
        }
      }
    } catch (e) {
      console.error('experimental-pool.js error:', e);
      // ignore permission errors
    }
  }
  return collected;
}

function runBenchmark(filePaths) {
  return new Promise((resolve) => {
    const workerScript = path.join(__dirname, 'worker.js');
    const chunkSize = Math.ceil((filePaths.length || 0) / WORKER_COUNT) || 1;
    let activeWorkers = WORKER_COUNT;

    let totalFiles = 0;
    let totalLines = 0;
    const startTime = process.hrtime.bigint();

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = new Worker(workerScript);
      const sliceStart = i * chunkSize;
      const pathSlice = filePaths.slice(sliceStart, sliceStart + chunkSize);

      worker.postMessage({ paths: pathSlice });

      worker.on('message', (msg) => {
        if (msg.type === 'result') {
          totalFiles += msg.filesProcessed || 0;
          totalLines += msg.linesCounted || 0;
          // terminate when result received
          worker.terminate().catch(() => {});
        } else if (msg.type === 'error') {
          console.warn(`⚠️ [Worker Error] ${msg.error} on path: ${msg.path}`);
        } else if (msg.type === 'warn') {
          // best-effort
        }
      });

      worker.on('exit', () => {
        activeWorkers--;
        if (activeWorkers === 0) {
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1000000;
          resolve({ totalFiles, totalLines, durationMs });
        }
      });
    }
  });
}

// Self-executing runner: sample files under the current repo to benchmark
const repoRoot = path.resolve(__dirname, '..');
const sampleFiles = collectSampleFilePaths(repoRoot, Number(process.env.BENCH_LIMIT || 5000));

if (!sampleFiles.length) {
  console.error('No sample files found to benchmark. Try running from repository root or increase BENCH_LIMIT.');
  process.exit(1);
}

runBenchmark(sampleFiles).then((res) => {
  console.log(`\n📊 Benchmark Results:`);
  console.log(`⏱️  Duration: ${res.durationMs.toFixed(2)} ms`);
  console.log(`📂 Files Scanned: ${res.totalFiles}`);
  console.log(`📝 Lines Accumulated: ${res.totalLines}`);
  console.log(`🧠 Memory Overhead: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
});
