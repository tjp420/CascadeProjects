'use strict';

/**
 * Request timing middleware — records latency, status code, and method
 * for each HTTP request. Feeds metrics to log-stream-metrics aggregator.
 *
 * Metrics are recorded on the response 'finish' event (non-blocking).
 */

const { recordRequest } = require('../lib/log-stream-metrics.cjs');

/**
 * Express middleware that tracks request timing.
 * Sets req.startTime and records metrics when response finishes.
 */
function requestTiming(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - req.startTime;
    recordRequest({
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

module.exports = { requestTiming };
