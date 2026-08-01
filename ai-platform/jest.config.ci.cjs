// SPDX-License-Identifier: MIT
/**
 * CI-only Jest config that overrides setupFilesAfterEnv to use a
 * relative path instead of <rootDir>. Jest 30 has a resolution issue
 * where <rootDir>/tests/setup.js is not found even when the file exists.
 * Using a relative path (./tests/setup.js) works around this issue.
 *
 * @license MIT
 */

const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  setupFilesAfterEnv: ['./tests/setup.js']
};
