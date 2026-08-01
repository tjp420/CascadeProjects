// SPDX-License-Identifier: MIT
/**
 * CI-only Jest config that overrides setupFilesAfterEnv to use an
 * absolute path. Jest 30 has a resolution issue where both
 * <rootDir>/tests/setup.js and ./tests/setup.js are reported as not
 * found in the CI environment even though the file exists and is
 * readable by Node.js. Using an absolute path via __dirname works
 * around this issue.
 *
 * @license MIT
 */

const path = require('path');
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  setupFilesAfterEnv: [path.join(__dirname, 'tests', 'setup.js')]
};
