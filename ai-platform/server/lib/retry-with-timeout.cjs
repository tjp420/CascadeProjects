/**
 * Executes a target async function with a per-attempt timeout and exponential backoff.
 * @param {Function} operation - Async function to run.
 * @param {Object} [options]
 * @param {number} [options.retries=3]
 * @param {number} [options.timeoutMs=5000]
 * @param {number} [options.baseDelayMs=100]
 * @param {number} [options.maxDelayMs=2000]
 * @param {number} [options.jitter=0.1]
 */
"use strict";

async function retryWithTimeout(operation, options = {}) {
  const retries = options.retries !== undefined ? options.retries : 3;
  const timeoutMs = options.timeoutMs || 5000;
  const baseDelay = options.baseDelayMs || 100;
  const maxDelay = options.maxDelayMs || 2000;
  const jitter = options.jitter !== undefined ? options.jitter : 0.1;

  let attempt = 0;

  while (true) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `ERR_EXECUTION_TIMEOUT: Operation exceeded the ${timeoutMs}ms limit.`,
          ),
        );
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      attempt++;

      if (attempt > retries) {
        throw error;
      }

      const rawDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitterOffset = rawDelay * jitter * (Math.random() * 2 - 1);
      const sleepTime = Math.max(0, rawDelay + jitterOffset);

      // best-effort log
      try {
        console.warn(
          `[RETRY SYSTEM] Attempt ${attempt} failed: ${error && error.message}. Retrying in ${Math.round(sleepTime)}ms...`,
        );
      } catch (e) {}
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
    }
  }
}

module.exports = { retryWithTimeout };
