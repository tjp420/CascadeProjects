const { EnclaveWorker } = require('../enclave-worker.cjs');

jest.useFakeTimers();

describe('EnclaveWorker', () => {
  test('schedules flush and rotate with intervals and calls manager methods', async () => {
    const manager = {
      flushPendingReplications: jest.fn(async () => {}),
      rotateKek: jest.fn(async () => {}),
    };

    const generateNewWrapFn = jest.fn(async () => async () => Buffer.from('newwrap'));

    const worker = new EnclaveWorker(manager, { flushIntervalSec: 1, rotateIntervalSec: 5, jitterSec: 0, generateNewWrapFn });
    worker.start();

    // advance timers to trigger flush 3 times and rotate once
    jest.advanceTimersByTime(1000 * 3 + 100); // 3.1s
    expect(manager.flushPendingReplications).toHaveBeenCalled();

    jest.advanceTimersByTime(1000 * 2); // now total ~5.1s
    // allow pending promises from async callbacks to resolve
    await Promise.resolve();
    // rotate should have been called once
    expect(generateNewWrapFn).toHaveBeenCalled();
    expect(manager.rotateKek).toHaveBeenCalled();

    worker.stop();
  });
});
