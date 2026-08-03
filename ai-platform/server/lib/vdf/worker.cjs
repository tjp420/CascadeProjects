const { parentPort, workerData } = require('worker_threads');
const { seedBigIntFromParams, runSequentialIterations } = require('./utils.cjs');

(async () => {
  try {
    const params = workerData;
    // run the sequential time-lock (placeholder: repeated group mul)
    const result = await runSequentialIterations(params);
    parentPort.postMessage({ params, proof: result });
  } catch (err) {
    parentPort.postMessage({ error: String(err) });
    process.exit(1);
  }
})();