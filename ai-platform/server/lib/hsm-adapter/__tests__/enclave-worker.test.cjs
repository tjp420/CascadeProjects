const { EnclaveWorker } = require("../enclave-worker.cjs");

describe("EnclaveWorker", () => {
  test("schedules flush and rotate with intervals and calls manager methods", async () => {
    const manager = {
      flushPendingReplications: jest.fn(async () => {}),
      rotateKek: jest.fn(async () => {}),
    };

    const generateNewWrapFn = jest.fn(
      async () => async () => Buffer.from("newwrap"),
    );

    // Capture setInterval callbacks to invoke them directly
    const callbacks = [];
    const origSetInterval = global.setInterval;
    global.setInterval = function (fn, ms, ...args) {
      callbacks.push({ fn, ms, args });
      return { unref: () => {}, ref: () => {}, hasRef: () => false };
    };

    try {
      const worker = new EnclaveWorker(manager, {
        flushIntervalSec: 1,
        rotateIntervalSec: 5,
        jitterSec: 0,
        generateNewWrapFn,
      });
      worker.start();

      expect(callbacks.length).toBe(2);

      await callbacks[0].fn();
      expect(manager.flushPendingReplications).toHaveBeenCalled();

      await callbacks[1].fn();
      expect(generateNewWrapFn).toHaveBeenCalled();
      expect(manager.rotateKek).toHaveBeenCalled();

      worker.stop();
    } finally {
      global.setInterval = origSetInterval;
    }
  });
});
