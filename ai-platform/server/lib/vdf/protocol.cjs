const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');
const { deriveParams, hashToBigInt, verifyWesolowski } = require('./utils.cjs');

const DEFAULT_THREADS = Math.max(1, os.cpus().length - 1);

class VDFManager {
  constructor(opts = {}) {
    this.useWorkers = opts.useWorkers !== false;
    this.threadPoolSize = opts.threadPoolSize || DEFAULT_THREADS;
    this.workerPool = [];
    this.tasks = new Map();
  }

  async generateTimeLock({ seed, difficulty, group, taskId } = {}) {
    const params = deriveParams({ seed, difficulty, group });
    // choose worker path
    if (this.useWorkers && Worker) {
      const workerPath = path.join(__dirname, 'worker.cjs');
      return new Promise((resolve, reject) => {
        const w = new Worker(workerPath, { workerData: params });
        w.once('message', (msg) => {
          resolve(msg);
        });
        w.once('error', (err) => reject(err));
        w.once('exit', (code) => { if (code !== 0) reject(new Error('Worker exit ' + code)); });
      });
    }

    // fallback: synchronous loop
    const { seedBigInt, difficultyIter, p, g } = params;
    // naive repeated squaring placeholder (replace with real VDF op)
    let y = 1n;
    for (let i = 0; i < difficultyIter; i++) {
      y = (y * g) % p;
    }
    const proof = { y: y.toString(), iter: difficultyIter };
    return { params, proof };
  }

  async verifyTimeLock({ seed, difficulty, group, proof }) {
    const params = deriveParams({ seed, difficulty, group });
    return verifyWesolowski(params, proof);
  }
}

module.exports = { VDFManager };