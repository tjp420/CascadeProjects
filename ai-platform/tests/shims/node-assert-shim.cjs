'use strict';

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
    this.code = 'ERR_ASSERTION';
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

const assert = {
  ok(value, message) {
    if (value) return;
    throw new AssertionError(message || `expected value to be truthy`);
  },

  strictEqual(actual, expected, message) {
    if (actual === expected) return;
    throw new AssertionError(message || `Expected ${String(actual)} to equal ${String(expected)}`);
  },

  notStrictEqual(actual, expected, message) {
    if (actual !== expected) return;
    throw new AssertionError(
      message || `Expected ${String(actual)} to not equal ${String(expected)}`
    );
  },

  deepStrictEqual(actual, expected, message) {
    if (!deepEqual(actual, expected) || typeof actual !== typeof expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`
      );
    }
  },

  deepEqual(actual, expected, message) {
    if (!deepEqual(actual, expected)) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(actual)} to deeply equal ${JSON.stringify(expected)}`
      );
    }
  },

  notDeepStrictEqual(actual, expected, message) {
    if (deepEqual(actual, expected) && typeof actual === typeof expected) {
      throw new AssertionError(message || `Expected values to not be deeply equal`);
    }
  },

  throws(fn, expected, message) {
    if (typeof expected === 'string') {
      message = expected;
      expected = undefined;
    }
    let threw = false;
    let error;
    try {
      fn();
    } catch (e) {
      threw = true;
      error = e;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw');
    }
    if (expected instanceof RegExp) {
      if (!expected.test(error.message)) {
        throw new AssertionError(
          message || `Expected error message "${error.message}" to match ${expected}`
        );
      }
    }
  },

  doesNotThrow(fn, message) {
    try {
      fn();
    } catch (e) {
      throw new AssertionError(
        message || `Expected function not to throw, but threw: ${e.message}`
      );
    }
  },

  async rejects(promiseOrFn, expected, message) {
    let fn;
    if (typeof promiseOrFn === 'function') {
      fn = promiseOrFn;
    } else {
      fn = () => promiseOrFn;
    }
    let threw = false;
    let error;
    try {
      await fn();
    } catch (e) {
      threw = true;
      error = e;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected promise to reject');
    }
    if (expected instanceof RegExp) {
      if (!expected.test(error.message)) {
        throw new AssertionError(
          message || `Expected rejection message "${error.message}" to match ${expected}`
        );
      }
    }
  },

  ifError(err) {
    if (err) throw err;
  },

  fail(message) {
    throw new AssertionError(message || 'Assertion failed');
  },
};

module.exports = assert;
module.exports.AssertionError = AssertionError;
module.exports.strict = assert;
module.exports.default = assert;
