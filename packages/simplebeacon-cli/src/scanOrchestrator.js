// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

const SINGLE_THREAD_THRESHOLD = 2000;

/**
 * Dynamically chunk an array into roughly equal parts.
 */
function chunkArray(array, size) {
  const result = [];
  const chunkSize = Math.ceil(array.length / size);
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

/**
 * Execute a parallel scan across a pool of worker threads.
 *
 * @param {string[]} filePaths — Files to scan
 * @param {Array<{id:string,pattern:string}>} rulesCatalog — Regex rules
 * @returns {Promise<Array>} Flattened findings
 */
async function parallelScan(filePaths, rulesCatalog) {
  if (filePaths.length < SINGLE_THREAD_THRESHOLD) {
    // Small repos: skip worker overhead and run single-threaded
    return singleThreadScan(filePaths, rulesCatalog);
  }

  const cpuCount = os.cpus().length;
  const workerCount = Math.max(1, cpuCount - 1);
  console.log(`Provisioning multi-threaded scan pool across ${workerCount} worker cores...`);

  const chunks = chunkArray(filePaths, workerCount);

  const workerPromises = chunks.map((chunk) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'scanWorker.js'), {
        workerData: { files: chunk, rules: rulesCatalog },
      });

      worker.on('message', (findings) => resolve(findings));
      worker.on('error', (err) => reject(err));
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });

  const resultsMatrix = await Promise.all(workerPromises);
  return resultsMatrix.flat();
}

/**
 * Fallback single-threaded scan for small repositories.
 */
function singleThreadScan(filePaths, rulesCatalog) {
  const fs = require('fs');
  const findings = [];

  for (const filePath of filePaths) {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      for (const rule of rulesCatalog) {
        const regex = new RegExp(rule.pattern, 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
          findings.push({
            file: filePath,
            ruleId: rule.id,
            index: match.index,
          });
        }
      }
    } catch (e) {
      // Suppress file permission errors safely
    }
  }

  return findings;
}

module.exports = { parallelScan, singleThreadScan };
