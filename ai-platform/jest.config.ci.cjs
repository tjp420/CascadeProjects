// SPDX-License-Identifier: MIT
/**
 * CI-only Jest config that removes setupFilesAfterEnv from the config
 * to avoid Jest 30's broken config validation. The setup file is
 * passed via the --setupFilesAfterEnv CLI flag instead, which bypasses
 * the validation that uses unrs-resolver (which has a bug on Linux
 * where it can't resolve absolute paths).
 *
 * See: https://github.com/jestjs/jest/issues/15923
 *
 * @license MIT
 */

const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  setupFilesAfterEnv: []
};
