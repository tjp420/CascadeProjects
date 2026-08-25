const { Worker } = require("worker_threads");
const os = require("os");
const path = require("path");
const fs = require("fs");

const CPU_CORES = os.cpus().length;
const WORKER_COUNT = Math.max(1, CPU_CORES - 1);

console.log(
  `🧠 Launching Memory-Mapped Worker Pool with Active Progress Tracking across ${WORKER_COUNT} Cores...`,
);

function runOptimizedBenchmark(filePaths) {
  return new Promise((resolve, reject) => {
    // 4 Int32 slots: files, lines, errors, progress cursor
    const sharedBuffer = new SharedArrayBuffer(
      4 * Int32Array.BYTES_PER_ELEMENT,
    );
    const sharedIntArray = new Int32Array(sharedBuffer);

    const workerScript = path.join(__dirname, "optimized-worker.js");
    const chunkSize = Math.ceil(filePaths.length / WORKER_COUNT) || 1;
    let activeWorkers = 0;
    const startTime = process.hrtime.bigint();

    // Optional: Setup a real-time progress monitor interval during heavy workloads
    const progressTimer = setInterval(() => {
      try {
        const currentProgress = Atomics.load(sharedIntArray, 3);
        if (filePaths.length > 2000) {
          process.stdout.write(
            `⏳ Scan Progression: ${currentProgress} / ${filePaths.length} files parsed...\r`,
          );
        }
      } catch (e) {
        console.error("optimized-pool.js error:", e);
        // ignore sampling errors
      }
    }, 100);

    for (let i = 0; i < WORKER_COUNT; i++) {
      const sliceStart = i * chunkSize;
      const pathSlice = filePaths.slice(sliceStart, sliceStart + chunkSize);

      if (pathSlice.length === 0) continue;

      activeWorkers++;
      const worker = new Worker(workerScript);

      // Send only the path slice and the shared buffer (no big JSON blobs)
      worker.postMessage({ paths: pathSlice, sharedBuffer });

      worker.on("message", () => {
        // ask worker to terminate when it reports done
        worker.terminate().catch(() => {});
      });

      worker.on("error", (err) => {
        console.error("Worker error:", err);
        worker.terminate().catch(() => {});
      });

      worker.on("exit", () => {
        activeWorkers--;
        if (activeWorkers === 0) {
          clearInterval(progressTimer);
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1000000;

          resolve({
            totalFiles: Atomics.load(sharedIntArray, 0),
            totalLines: Atomics.load(sharedIntArray, 1),
            totalErrors: Atomics.load(sharedIntArray, 2),
            finalProgress: Atomics.load(sharedIntArray, 3),
            durationMs,
          });
        }
      });
    }

    // No workers were started (no workload) — resolve immediately
    if (activeWorkers === 0) {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;
      resolve({
        totalFiles: Atomics.load(sharedIntArray, 0),
        totalLines: Atomics.load(sharedIntArray, 1),
        totalErrors: Atomics.load(sharedIntArray, 2),
        finalProgress: Atomics.load(sharedIntArray, 3),
        durationMs,
      });
    }
  });
}

// Helper: recursively walk a directory and collect file paths
function walkSync(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walkSync(filePath, fileList);
        } else {
          fileList.push(filePath);
        }
      } catch (e) {
        console.error("optimized-pool.js error:", e);
        // skip unreadable entries
      }
    }
  } catch (e) {
    console.error("optimized-pool.js error:", e);
    // directory may not exist or be unreadable
  }
  return fileList;
}

// Main runner: accept --target <dir> or fall back to mock workload via BENCH_LIMIT
async function main() {
  console.log(
    `\n🧠 Launching Memory-Mapped Worker Pool across ${WORKER_COUNT} Background Threads...`,
  );

  const targetIndex = process.argv.indexOf("--target");
  let targetPaths = [];

  if (targetIndex !== -1 && process.argv[targetIndex + 1]) {
    const targetDir = path.resolve(process.argv[targetIndex + 1]);
    console.log(
      `📂 Harvesting physical file paths from target directory: ${targetDir}`,
    );
    if (!fs.existsSync(targetDir)) {
      console.error(
        `❌ Error: Specified target directory does not exist: ${targetDir}`,
      );
      process.exit(1);
    }
    targetPaths = walkSync(targetDir);
    console.log(
      `🌲 Successfully gathered ${targetPaths.length} unique paths for I/O thread processing.`,
    );
  } else {
    const targetCount = parseInt(process.env.BENCH_LIMIT || "5000", 10);
    console.log(
      `ℹ️ No target folder specified. Falling back to mock workload array (${targetCount} indices)...`,
    );
    targetPaths = Array.from({ length: targetCount }, () => __filename);
  }

  const res = await runOptimizedBenchmark(targetPaths);

  console.log(`\n📊 Memory-Mapped Progress Benchmark Results:`);
  console.log(`⏱️  Duration: ${res.durationMs.toFixed(2)} ms`);
  console.log(`📂 Files Scanned (Shared Memory): ${res.totalFiles}`);
  console.log(`📝 Lines Accumulated (Shared Memory): ${res.totalLines}`);
  console.log(`⚠️  Errors Logged (Shared Memory): ${res.totalErrors}`);
  console.log(`📈 Total Actions Tracked (Slot 3): ${res.finalProgress}`);
  console.log(
    `🧠 Heap Usage Footprint: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
