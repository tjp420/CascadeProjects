// SPDX-License-Identifier: MIT
/**
 * CI-only Jest config that uses a custom resolver to work around
 * a Jest 30 / unrs-resolver bug on Linux where setupFilesAfterEnv
 * modules are reported as "not found" even though the files exist.
 *
 * See: https://github.com/jestjs/jest/issues/15923
 *
 * @license MIT
 */

const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  resolver: '<rootDir>/tests/shims/jest-resolver-shim.cjs'
};
