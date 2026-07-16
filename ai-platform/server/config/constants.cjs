// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
'use strict';

/**
 * @module constants
 * Shared constants facade. Re-exports time, network, sizes, limits, mock
 * constants, plus focused sub-modules for file types, HTTP, formatting,
 * environment, platform, trust, encoding, strings, arrays, objects,
 * type-guards, and paths.
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
const { deepFreeze } = require('./deep-freeze.cjs');
const logger = require('../lib/app-logger.cjs');

/**
 * Namespace collision detection and source mapping.
 * Throws if sub-modules export overlapping keys.
 * @returns {Map<string, string>} Map of export key -> originating module name.
 */
function buildExportSourceMap() {
  const seen = new Map();
  const modules = [
    { name: 'time', exports: time },
    { name: 'network', exports: network },
    { name: 'sizes', exports: sizes },
    { name: 'limits', exports: limits },
    { name: 'mock', exports: mock },
    { name: 'file-types', exports: fileTypes },
    { name: 'http', exports: http },
    { name: 'trust', exports: trust },
    { name: 'language', exports: language },
    { name: 'format', exports: format },
    { name: 'env', exports: env },
    { name: 'platform', exports: platform },
    { name: 'encoding', exports: encoding },
    { name: 'strings', exports: strings },
    { name: 'arrays', exports: arrays },
    { name: 'objects', exports: objects },
    { name: 'type-guards', exports: typeGuards },
    { name: 'paths', exports: paths }
  ];
  for (const mod of modules) {
    const src = mod.exports;
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      if (seen.has(key)) {
        throw new Error(
          `[constants.cjs] Namespace collision detected: "${key}" exists in both "${seen.get(key)}" and "${mod.name}". ` +
          'Overlapping keys between submodules are not allowed.'
        );
      } else {
        seen.set(key, mod.name);
      }
    }
  }
  return seen;
}
const exportSourceMap = buildExportSourceMap();

let exportNames = [];
let cachedStatistics = null;

const categories = deepFreeze({
  time: time,
  network: network,
  sizes: sizes,
  limits: limits,
  mock: mock,
  fileTypes: fileTypes,
  http: http,
  trust: trust,
  language: language,
  format: format,
  env: env,
  platform: platform,
  encoding: encoding,
  strings: strings,
  arrays: arrays,
  objects: objects,
  typeGuards: typeGuards,
  paths: paths
});

// Legacy flat-access deprecation shim — prefer categories.* or direct sub-module imports
const warned = new Set();
function warnOnce(key) {
  if (warned.has(key)) return;
  warned.add(key);
  if (process.env.SIMPLEBEACON_DEBUG) {
    logger.warn(`[constants.cjs] DEPRECATED: flat access to "${key}" — use categories.* or require('./config/<module>.cjs') directly`);
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
const legacyAliases = deepFreeze({
  CODE_EXTENSIONS: fileTypes.EXTENSIONS.CODE,
  CONFIG_EXTENSIONS: fileTypes.EXTENSIONS.CONFIG,
  MARKUP_EXTENSIONS: fileTypes.EXTENSIONS.MARKUP,
  DOCUMENT_EXTENSIONS: fileTypes.EXTENSIONS.DOCUMENT,
  DATA_EXTENSIONS: fileTypes.EXTENSIONS.DATA,
  STYLESHEET_EXTENSIONS: fileTypes.EXTENSIONS.STYLESHEET,
  IMAGE_EXTENSIONS: fileTypes.EXTENSIONS.IMAGE,
  MEDIA_EXTENSIONS: fileTypes.EXTENSIONS.MEDIA,
  BINARY_EXTENSIONS: fileTypes.EXTENSIONS.BINARY
});

// exportNames is auto-generated after exportObj is fully built (see end of file).

/**
 * @returns {ReadonlyArray<string>} All flat named export keys from this facade.
 */
function getExportNames() {
  return exportNames;
}

/**
 * @returns {ReadonlyArray<string>} All namespace keys from this facade.
 */
function getNamespaceNames() {
  return Object.freeze(Object.keys(categories));
}

/**
 * Validate facade integrity at runtime.
 * @param {object} [facade] Optional facade object to validate (defaults to module export).
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
function validateFacadeIntegrity(facade) {
  const target = facade || (typeof exportObj !== 'undefined' ? exportObj : null);
  if (!target) {
    return { valid: false, errors: ['Facade object not available'] };
  }
  const errors = [];
  const nsKeys = getNamespaceNames();
  for (const key of nsKeys) {
    if (!categories[key] || typeof categories[key] !== 'object') {
      errors.push(`Namespace "${key}" is missing or not an object`);
    } else if (!Object.isFrozen(categories[key])) {
      errors.push(`Namespace "${key}" is not frozen`);
    }
  }
  if (!Object.isFrozen(categories)) {
    errors.push('Categories object is not frozen');
  }
  if (!target.__facade__) {
    errors.push('Missing __facade__ metadata');
  } else {
    const requiredMetaKeys = ['name', 'description', 'moduleCount', 'exportCount', 'namespaceCount', 'version', 'timestamp', 'exports', 'namespaces'];
    for (const metaKey of requiredMetaKeys) {
      if (!(metaKey in target.__facade__)) {
        errors.push(`Missing __facade__ key: "${metaKey}"`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Look up a constant by name without triggering deprecation warnings.
 * Searches flat exports first, then legacy aliases.
 * @param {string} name
 * @returns {any|undefined}
 */
function resolve(name) {
  if (typeof name !== 'string') return undefined;
  if (name in flatSources) return flatSources[name];
  if (name in legacyAliases) return legacyAliases[name];
  return undefined;
}

/**
 * Check whether a named export exists in this facade.
 * @param {string} name
 * @returns {boolean}
 */
function hasExport(name) {
  if (typeof name !== 'string') return false;
  return name in flatSources || name in legacyAliases;
}

/**
 * Retrieve a specific namespace by name.
 * @param {string} name
 * @returns {object|undefined}
 */
function getNamespace(name) {
  if (typeof name !== 'string') return undefined;
  return categories[name];
}

/**
 * Return the originating submodule name for a given export key.
 * @param {string} name
 * @returns {string|undefined}
 */
function getExportSource(name) {
  if (typeof name !== 'string') return undefined;
  return exportSourceMap.get(name);
}

/**
 * Check whether a name is a valid namespace key.
 * @param {string} name
 * @returns {boolean}
 */
function isNamespace(name) {
  if (typeof name !== 'string') return false;
  return name in categories;
}

/**
 * Return all export keys that belong to a specific namespace.
 * @param {string} name
 * @returns {ReadonlyArray<string>}
 */
function getExportsByNamespace(name) {
  if (typeof name !== 'string') return Object.freeze([]);
  const ns = categories[name];
  if (!ns || typeof ns !== 'object') return Object.freeze([]);
  return Object.freeze(Object.keys(ns));
}

/**
 * Return aggregate statistics about the facade exports.
 * Computed once and cached since the module state never changes after load.
 * @returns {{ total: number, namespaces: number, functions: number, objects: number, arrays: number, primitives: number }}
 */
function getStatistics() {
  if (cachedStatistics) return cachedStatistics;
  const names = getExportNames();
  let functions = 0;
  let objects = 0;
  let arrays = 0;
  let primitives = 0;
  for (const name of names) {
    const value = resolve(name);
    const t = typeof value;
    if (t === 'function') functions++;
    else if (Array.isArray(value)) arrays++;
    else if (t === 'object' && value !== null) objects++;
    else primitives++;
  }
  cachedStatistics = Object.freeze({
    total: names.length,
    namespaces: getNamespaceNames().length,
    functions,
    objects,
    arrays,
    primitives
  });
  return cachedStatistics;
}

/**
 * Return a plain JSON-serializable snapshot of facade metadata.
 * Useful for logging or transmitting facade state without the full module.
 * @returns {object}
 */
function toJSON() {
  return Object.freeze({
    name: 'simplebeacon-server-config',
    version: '1.0.0',
    moduleCount: Object.keys(categories).length,
    exportCount: getExportNames().length,
    namespaceCount: getNamespaceNames().length,
    timestamp: new Date().toISOString(),
    namespaces: getNamespaceNames(),
    exports: getExportNames(),
    statistics: getStatistics()
  });
}

/**
 * Return a rich descriptor for a named export.
 * @param {string} name
 * @returns {{ name: string, type: string, namespace: string, source: string, value: any }|undefined}
 */
function describeExport(name) {
  if (typeof name !== 'string') return undefined;
  const value = resolve(name);
  if (value === undefined && !hasExport(name)) return undefined;
  const source = getExportSource(name);
  let namespace = source || 'legacy';
  if (legacyAliases[name] && !source) namespace = 'legacy';
  return Object.freeze({
    name,
    type: typeof value,
    namespace,
    source: source || 'legacy',
    value
  });
}

/**
 * Search exports by a case-insensitive substring.
 * @param {string} query
 * @returns {ReadonlyArray<string>}
 */
function searchExports(query) {
  if (typeof query !== 'string' || query.length === 0) return Object.freeze([]);
  const q = query.toLowerCase();
  const results = exportNames.filter((n) => n.toLowerCase().includes(q));
  return Object.freeze(results);
}

/**
 * Resolve multiple names at once.
 * @param {ReadonlyArray<string>} names
 * @returns {Map<string, any>}
 */
function batchResolve(names) {
  const map = new Map();
  if (!Array.isArray(names)) return map;
  for (const name of names) {
    if (typeof name === 'string') {
      const value = resolve(name);
      if (value !== undefined || hasExport(name)) {
        map.set(name, value);
      }
    }
  }
  return map;
}

/**
 * Return all export names whose resolved value matches a given typeof.
 * @param {string} type — e.g. 'function', 'object', 'string', 'number'
 * @returns {ReadonlyArray<string>}
 */
function getExportsByType(type) {
  if (typeof type !== 'string') return Object.freeze([]);
  const results = [];
  for (const name of exportNames) {
    const value = resolve(name);
    if (typeof value === type) results.push(name);
    else if (type === 'array' && Array.isArray(value)) results.push(name);
  }
  return Object.freeze(results);
}

/**
 * Validate facade integrity and throw if invalid.
 * @throws {Error} If integrity validation fails.
 */
function assertIntegrity() {
  const result = validateFacadeIntegrity();
  if (!result.valid) {
    throw new Error(result.errors.join('\n'));
  }
}

const exportObj = { ...legacyAliases, categories, getExportNames, getNamespaceNames, validateFacadeIntegrity, resolve, hasExport, getNamespace, getExportSource, isNamespace, getExportsByNamespace, getStatistics, toJSON, describeExport, searchExports, batchResolve, getExportsByType, assertIntegrity };
for (const key of Object.keys(allFlat)) {
  Object.defineProperty(exportObj, key, {
    enumerable: true,
    configurable: true,
    get() { return allFlat[key]; }
  });
}

// Auto-generate exportNames from the fully-built facade (minus __facade__ metadata)
exportNames = Object.freeze(Object.keys(exportObj).filter(k => k !== '__facade__'));
exportObj.exportNames = exportNames;

/** Frozen facade metadata for runtime introspection. */
exportObj.__facade__ = Object.freeze({
  name: 'simplebeacon-server-config',
  description: 'Shared constants facade. Re-exports time, network, sizes, limits, mock constants, plus focused sub-modules for file types, HTTP, formatting, environment, platform, trust, encoding, strings, arrays, objects, type-guards, and paths.',
  moduleCount: Object.keys(categories).length,
  exportCount: getExportNames().length,
  namespaceCount: getNamespaceNames().length,
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  exports: getExportNames(),
  namespaces: getNamespaceNames()
});

module.exports = Object.freeze(exportObj);
