// simplebeacon-ignore: Test file — NODE_ENV assignments are test fixtures, not production config
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

let logger;

function loadLogger(env = {}) {
  const originalEnv = process.env.NODE_ENV;
  if (env.NODE_ENV !== undefined) {
    process.env.NODE_ENV = env.NODE_ENV;
  }
  delete require.cache[require.resolve('./production-logger.cjs')];
  const mod = require('./production-logger.cjs');
  if (env.NODE_ENV !== undefined) {
    process.env.NODE_ENV = originalEnv;
  }
  return mod;
}

describe('production-logger', () => {
  beforeEach(() => {
    logger = loadLogger({ NODE_ENV: 'test' });
  });

  afterEach(() => {
    delete require.cache[require.resolve('./production-logger.cjs')];
  });

  it('exports a logger with debug, info, warn, and error methods', () => {
    assert.strictEqual(typeof logger.debug, 'function');
    assert.strictEqual(typeof logger.info, 'function');
    assert.strictEqual(typeof logger.warn, 'function');
    assert.strictEqual(typeof logger.error, 'function');
  });

  it('warn and error always write when no node logger is present', () => {
    const calls = [];
    global.window = {
      logger: {
        warn: (...args) => calls.push(['warn', args]),
        error: (...args) => calls.push(['error', args]),
      },
    };
    logger.warn('a warning');
    logger.error('an error');
    delete global.window;
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls[0], ['warn', ['a warning']]);
    assert.deepStrictEqual(calls[1], ['error', ['an error']]);
  });

  it('debug and info are silent in production', () => {
    delete require.cache[require.resolve('./production-logger.cjs')];
    process.env.NODE_ENV = 'production';
    const prodLogger = require('./production-logger.cjs');
    const calls = [];
    global.window = {
      logger: { debug: () => calls.push('debug'), info: () => calls.push('info') },
    };
    prodLogger.debug('debug message');
    prodLogger.info('info message');
    delete global.window;
    process.env.NODE_ENV = 'test';
    assert.strictEqual(calls.length, 0);
  });
});
