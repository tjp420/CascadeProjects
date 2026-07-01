'use strict';

/**
 * @module constants
 * Shared constants facade.
 * Re-exports time, network, sizes, limits, mock constants,
 * plus focused sub-modules for file types, HTTP, formatting, environment,
 * platform, trust, encoding, strings, arrays, objects, type-guards, and paths.
 *
 * @example <caption>Flat access (backward-compatible)</caption>
 * const constants = require('./constants.cjs');
 * constants.HTTP_STATUS.OK;
 * constants.EXTENSIONS.CODE.includes('.js');
 *
 * @example <caption>Grouped namespace access (frozen for immutability)</caption>
 * const constants = require('./constants.cjs');
 * constants.categories.http.HTTP_STATUS.OK;
 * constants.categories.fileTypes.EXTENSIONS.IMAGE.includes('.png');
 * Object.isFrozen(constants.categories); // true
 * Object.isFrozen(constants.categories.http); // true
 *
 * @example <caption>Legacy aliases</caption>
 * const constants = require('./constants.cjs');
 * constants.CODE_EXTENSIONS; // => ['.js', '.jsx', ...]
 *
 * @file server/config/constants.cjs
 */

const time = require('./time.cjs');
const network = require('./network.cjs');
const sizes = require('./sizes.cjs');
const limits = require('./limits.cjs');
const mock = require('./mock.cjs');
const fileTypes = require('./file-types.cjs');
const http = require('./http.cjs');
const trust = require('./trust.cjs');
const language = require('./language.cjs');
const format = require('./format.cjs');
const env = require('./env.cjs');
const platform = require('./platform.cjs');
const encoding = require('./encoding.cjs');
const strings = require('./strings.cjs');
const arrays = require('./arrays.cjs');
const objects = require('./objects.cjs');
const typeGuards = require('./type-guards.cjs');
const paths = require('./paths.cjs');

// Namespace collision detection: throw if sub-modules export overlapping keys
function detectExportCollisions() {
  const seen = new Map();
  const sources = [time, network, sizes, limits, mock, fileTypes, http, trust, language, format, env, platform, encoding, strings, arrays, objects, typeGuards, paths];
  const sourceNames = ['time', 'network', 'sizes', 'limits', 'mock', 'file-types', 'http', 'trust', 'language', 'format', 'env', 'platform', 'encoding', 'strings', 'arrays', 'objects', 'type-guards', 'paths'];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      if (seen.has(key)) {
        throw new Error(
          `[constants.cjs] Namespace collision detected: "${key}" exists in both "${seen.get(key)}" and "${sourceNames[i]}". ` +
          'Overlapping keys between submodules are not allowed.'
        );
      } else {
        seen.set(key, sourceNames[i]);
      }
    }
  }
}
detectExportCollisions();

const categories = Object.freeze({
  time: Object.freeze(time),
  network: Object.freeze(network),
  sizes: Object.freeze(sizes),
  limits: Object.freeze(limits),
  mock: Object.freeze(mock),
  fileTypes: Object.freeze(fileTypes),
  http: Object.freeze(http),
  trust: Object.freeze(trust),
  language: Object.freeze(language),
  format: Object.freeze(format),
  env: Object.freeze(env),
  platform: Object.freeze(platform),
  encoding: Object.freeze(encoding),
  strings: Object.freeze(strings),
  arrays: Object.freeze(arrays),
  objects: Object.freeze(objects),
  typeGuards: Object.freeze(typeGuards),
  paths: Object.freeze(paths)
});

// Legacy flat-access deprecation shim — prefer categories.* or direct sub-module imports
const warned = new Set();
function warnOnce(key) {
  if (warned.has(key)) return;
  warned.add(key);
  if (process.env.SIMPLEBEACON_DEBUG) {
    console.warn(`[constants.cjs] DEPRECATED: flat access to "${key}" — use categories.* or require('./config/<module>.cjs') directly`);
  }
}

const allFlat = {};
const flatSources = { ...time, ...network, ...sizes, ...limits, ...mock, ...fileTypes, ...http, ...trust, ...language, ...format, ...env, ...platform, ...encoding, ...strings, ...arrays, ...objects, ...typeGuards, ...paths };
for (const key of Object.keys(flatSources)) {
  Object.defineProperty(allFlat, key, {
    enumerable: true,
    configurable: true,
    get() { warnOnce(key); return flatSources[key]; }
  });
}

// Legacy aliases for backward compatibility
const legacyAliases = {
  CODE_EXTENSIONS: fileTypes.EXTENSIONS.CODE,
  CONFIG_EXTENSIONS: fileTypes.EXTENSIONS.CONFIG,
  MARKUP_EXTENSIONS: fileTypes.EXTENSIONS.MARKUP,
  DOCUMENT_EXTENSIONS: fileTypes.EXTENSIONS.DOCUMENT,
  DATA_EXTENSIONS: fileTypes.EXTENSIONS.DATA,
  STYLESHEET_EXTENSIONS: fileTypes.EXTENSIONS.STYLESHEET,
  IMAGE_EXTENSIONS: fileTypes.EXTENSIONS.IMAGE,
  MEDIA_EXTENSIONS: fileTypes.EXTENSIONS.MEDIA,
  BINARY_EXTENSIONS: fileTypes.EXTENSIONS.BINARY
};

module.exports = Object.freeze({
  ...allFlat,
  ...legacyAliases,
  categories
});
