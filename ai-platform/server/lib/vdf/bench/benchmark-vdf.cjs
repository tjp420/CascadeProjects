#!/usr/bin/env node
// Benchmark harness for the prototype vdf squaring addon / fallback.
// Usage: node benchmark-vdf.cjs --workers 4 --iterations 1000 --size 1024 --saturation

const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
const path = require('path');
const { squaringInPlace, _native } = require(path.join('..', 'native', 'index.cjs'));

function parseArgs() {
  const args = require('minimist')(process.argv.slice(2));
  return {
    workers: Number(args.workers || os.cpus().length),
    iterations: Number(args.iterations || 1000),
    size: Number(args.size || 1024), // bytes
    saturation: args.saturation === undefined ? true : !!args.saturation
  };
}

async function runWorkerTask(iterations, size) {
  const buf = Buffer.alloc(size);
  // seed buffer with some non-zero values
  for (let i = 0; i < buf.length; i += 8) buf.writeBigUInt64LE(BigInt(i + 1), i);
  const t0 = process.hrtime.bigint();
  squaringInPlace(iterations, buf);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6; // ms
}

async function main() {
  const opts = parseArgs();
  console.log('Benchmark options', opts);

  // optionally measure saturation: spawn as many workers as requested concurrently
  const workers = opts.workers;
  const tasks = [];
  const start = Date.now();
  for (let i = 0; i < workers; ++i) {
    tasks.push(runWorkerTask(opts.iterations, opts.size));
  }

  const results = await Promise.all(tasks);
  const end = Date.now();
  const totalMs = end - start;
  console.log(`Workers: ${workers}, total wall time: ${totalMs}ms`);
  results.forEach((r, idx) => console.log(`worker[${idx}] CPU work time: ${r.toFixed(3)} ms`));
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  console.log(`avg per-worker CPU time: ${avg.toFixed(3)} ms`);
  if (opts.saturation) {
    console.log('Saturation check enabled: compare total wall time vs sum of CPU times to detect scheduler contention.');
  }
}

if (require.main === module) main().catch(err => {
  console.error(err);
  process.exit(1);
});
