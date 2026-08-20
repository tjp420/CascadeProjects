"use strict";

/**
 * Universal production-safe logger for src/ modules (Node + browser).
 * Avoids raw console.log in hot paths — satisfies SimpleBeacon debug-artifact rules.
 */

let nodeLogger = null;
try {
  nodeLogger = require("../../server/lib/app-logger");
} catch (_) {
  nodeLogger = null;
}

/**
 * Is dev environment.
 * @returns {any}
 */
function isDevEnvironment() {
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname
  ) {
    return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env.NODE_ENV !== "production";
  }
  return false;
}

/**
 * Write.
 * @param {any} level
 * @param {Array} args
 * @returns {any}
 */
function write(level, args) {
  if (nodeLogger) {
    nodeLogger[level](...args);
    return;
  }
  if (
    typeof window !== "undefined" &&
    window.logger &&
    typeof window.logger[level] === "function"
  ) {
    window.logger[level](...args);
  }
}

const logger = {
  debug: (...args) => {
    if (isDevEnvironment()) write("debug", args);
  },
  info: (...args) => {
    if (isDevEnvironment()) write("info", args);
  },
  warn: (...args) => {
    write("warn", args);
  },
  error: (...args) => {
    write("error", args);
  },
};

module.exports = logger;
