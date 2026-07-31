# Architecture Spec: Multi-Threaded Monorepo Scan Orchestration

## 1. Problem Statement

The current core scan loop runs on a single main thread. While highly performant for standard codebases (<5,000 files), scanning large enterprise monorepos forces deep regular expression execution pools across thousands of text files sequentially. This blocks the loop and degrades terminal or pre-commit hook runtimes.

---

## 2. Target Architecture (Worker Thread Pool Model)

SimpleBeacon will transition to a Master/Worker architecture using Node.js `worker_threads` to process repository files concurrently without blocking event routines.

```
[ Main CLI Thread ] ──► [ File Walker Queue ] ──► [ Batch Work Allocator ]
│
┌───────────────────┬─────────────────────┴───────────────────┐
▼                   ▼                   ▼
[ Worker Thread 1 ] [ Worker Thread 2 ] [ Worker Thread N ]
(Executes Regex)     (Executes Regex)     (Executes Regex)
│                   │                   │
└───────────────────┼─────────────────────────────────────────┘
                    ▼
        [ Consolidated Report Object ]
```

---

## 3. Implementation Details

### A. The Orchestration Manager (`src/scanOrchestrator.js`)

The orchestrator reads available system hardware resources and provisions a thread pool size calculated dynamically as `os.cpus().length - 1`.

```javascript
const { Worker } = require('worker_threads');
const os = require('os');

async function parallelScan(filePaths, rulesCatalog) {
  const cpuCount = os.cpus().length;
  const workerCount = Math.max(1, cpuCount - 1);
  console.log(`Provisioning multi-threaded scan pool across ${workerCount} worker cores...`);

  // Chunk total file array into balanced buckets for worker allocation
  const chunks = chunkArray(filePaths, workerCount);

  const workerPromises = chunks.map((chunk) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(require.resolve('./scanWorker.js'), {
        workerData: { files: chunk, rules: rulesCatalog },
      });

      worker.on('message', (findings) => resolve(findings));
      worker.on('error', (err) => reject(err));
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  });

  const resultsMatrix = await Promise.all(workerPromises);
  return resultsMatrix.flat();
}

function chunkArray(array, size) {
  const result = [];
  const chunkSize = Math.ceil(array.length / size);
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

module.exports = { parallelScan };
```

### B. The Isolated Scan Worker (`src/scanWorker.js`)

Workers handle intensive CPU execution, scanning text lines using hardcoded regex patterns without interacting with network APIs or file writes.

```javascript
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');

const { files, rules } = workerData;
const findings = [];

files.forEach((filePath) => {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');

    rules.forEach((rule) => {
      const regex = new RegExp(rule.pattern, 'g');
      let match;

      while ((match = regex.exec(text)) !== null) {
        findings.push({
          file: filePath,
          ruleId: rule.id,
          index: match.index,
        });
      }
    });
  } catch (e) {
    // Suppress or catch file permission reading exceptions safely
  }
});

parentPort.postMessage(findings);
```

---

## 4. Expected Performance Bounds

| Repository Footprint                    | Single-Thread Runtime |  Multi-Thread Target Runtime  | Expected Performance Gain |
| :-------------------------------------- | :-------------------: | :---------------------------: | :-----------------------: |
| **Small Workspace** (<1,000 files)      |        ~220ms         | ~260ms (Thread spawn penalty) | -15% (Use single thread)  |
| **Midsize Repository** (5,000 files)    |         ~1.4s         |            ~450ms             | **+67% Execution Speed**  |
| **Enterprise Monorepo** (38,000+ files) |        ~11.8s         |             ~2.1s             | **+82% Execution Speed**  |

_Note: The orchestrator will bypass worker thread initialization for projects containing fewer than 2,000 files to dodge the underlying system execution spawning penalty._
