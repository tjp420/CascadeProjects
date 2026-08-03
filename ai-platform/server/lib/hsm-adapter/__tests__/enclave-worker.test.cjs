const { EnclaveWorker } = require('../enclave-worker.cjs');

describe('EnclaveWorker', () => {
  let worker;

  afterEach(() => {
    if (worker) { worker.stop(); worker = null; }
  });

  test('schedules flush and rotate with intervals and calls manager methods', async () => {
    const manager = {
      flushPendingReplications: jest.fn(async () => {}),
      rotateKek: jest.fn(async () => {}),
    };

    const generateNewWrapFn = jest.fn(async () => async () => Buffer.from('newwrap'));

    // Use real timers with very short intervals to avoid fake timer OOM
    worker = new EnclaveWorker(manager, { flushIntervalSec: 0.01, rotateIntervalSec: 0.05, jitterSec: 0, generateNewWrapFn });
    worker.start();

    // Wait long enough for flush to fire multiple times and rotate to fire once
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(manager.flushPendingReplications).toHaveBeenCalled();
    expect(generateNewWrapFn).toHaveBeenCalled();
    expect(manager.rotateKek).toHaveBeenCalled();

    worker.stop();
    worker = null;
  });
});
