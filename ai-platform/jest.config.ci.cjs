// SPDX-License-Identifier: MIT
/**
 * CI-only Jest config (placeholder for diagnostics).
 *
 * Currently identical to the base config. The CI workflow uses this
 * config to allow CI-specific overrides without affecting local dev.
 *
 * @license MIT
 */

const base = require('./jest.config.cjs');

module.exports = {
  ...base
};
