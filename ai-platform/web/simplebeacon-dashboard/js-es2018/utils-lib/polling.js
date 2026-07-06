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
export function createPoller(fn, intervalMs, opts) {
  opts = opts || {};
  if (typeof fn !== 'function') throw new TypeError('createPoller requires a function');
  var interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1000;
  var timer = null;
  var running = false;
  var errorCount = 0;
  var maxRetries = Number.isFinite(opts.maxRetries) ? Math.max(0, opts.maxRetries) : 0;

  var tick = function() {
    if (!running) return;
    try {
      var result = fn();
      if (result && typeof result.then === 'function') {
        result.then(function() {
          errorCount = 0;
          if (running) { timer = setTimeout(tick, interval); }
        }).catch(function(err) {
          errorCount++;
          if (typeof opts.onError === 'function') opts.onError(err, errorCount);
          if (maxRetries > 0 && errorCount >= maxRetries) { stop(); return; }
          if (running) { timer = setTimeout(tick, interval); }
        });
        return;
      }
      errorCount = 0;
    } catch (err) {
      errorCount++;
      if (typeof opts.onError === 'function') opts.onError(err, errorCount);
      if (maxRetries > 0 && errorCount >= maxRetries) { stop(); return; }
    }
    if (running) {
      timer = setTimeout(tick, interval);
    }
  };

  var start = function() {
    if (running) return;
    running = true;
    errorCount = 0;
    if (opts.immediate) {
      tick();
    } else {
      timer = setTimeout(tick, interval);
    }
  };

  var stop = function() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
  };

  var isRunning = function() { return running; };

  return { start: start, stop: stop, isRunning: isRunning };
}
