/**
 * @module polling
 */

/**
 * Create a cancellable interval poller.
 * @param {Function} fn Function to call each interval.
 * @param {number} intervalMs Interval in milliseconds.
 * @param {Object} [opts]
 * @param {boolean} [opts.immediate=false] Call immediately before first interval.
 * @param {Function} [opts.onError] Error handler.
 * @param {number} [opts.maxRetries=0] Max consecutive errors before stopping (0 = never stop).
 * @returns {{start:Function,stop:Function,isRunning:Function}}
 */
export function createPoller(fn, intervalMs, opts = {}) {
  if (typeof fn !== 'function') throw new TypeError('createPoller requires a function');
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1000;
  let timer = null;
  let running = false;
  let errorCount = 0;
  const maxRetries = Number.isFinite(opts.maxRetries) ? Math.max(0, opts.maxRetries) : 0;

  const tick = async () => {
    if (!running) return;
    try {
      await fn();
      errorCount = 0;
    } catch (err) {
      errorCount++;
      if (typeof opts.onError === 'function') opts.onError(err, errorCount);
      if (maxRetries > 0 && errorCount >= maxRetries) {
        stop();
        return;
      }
    }
    if (running) {
      timer = setTimeout(tick, interval);
    }
  };

  const start = () => {
    if (running) return;
    running = true;
    errorCount = 0;
    if (opts.immediate) {
      tick();
    } else {
      timer = setTimeout(tick, interval);
    }
  };

  const stop = () => {
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const isRunning = () => running;

  return { start, stop, isRunning };
}
