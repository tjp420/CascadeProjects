/**
 * @module utils
 * Barrel re-export for the `js-es2018/utils-lib/` directory.
 * Provides named tree-shakeable exports and a grouped default namespace.
 */

import * as StringUtils  from './string.js';
import * as NumberUtils  from './number.js';
import * as AsyncUtils   from './async.js';
import * as ArrayUtils   from './array.js';
import * as ObjectUtils  from './object.js';
import * as UrlUtils     from './url.js';
import * as StorageUtils from './storage.js';
import * as AccessibilityUtils from './accessibility.js';
import * as DomUtils     from './dom.js';
import * as FormatUtils  from './format.js';
import * as TypeUtils    from './type.js';
import * as FunctionUtils from './function.js';
import * as CryptoUtils  from './crypto.js';
import * as ColorUtils   from './color.js';
import * as DownloadUtils from './download.js';
import * as FetchUtils   from './fetch.js';
import * as PrivacyUtils from './privacy.js';
import * as ClipboardUtils from './clipboard.js';
import * as VSCodeUtils  from './vscode.js';
import { deepFreeze } from '../utils/deep-freeze.js';
export { deepFreeze };

// ── String helpers ──
export const escapeHtml       = StringUtils.escapeHtml;
export const escapeRegExp     = StringUtils.escapeRegExp;
export const truncate         = StringUtils.truncate;
export const isBlank          = StringUtils.isBlank;
export const capitalize       = StringUtils.capitalize;
export const words            = StringUtils.words;
export const repeat           = StringUtils.repeat;
export const titleCase        = StringUtils.titleCase;
export const slugify          = StringUtils.slugify;
export const stripHtml        = StringUtils.stripHtml;
export const kebabCase        = StringUtils.kebabCase;
export const camelCase        = StringUtils.camelCase;
export const snakeCase        = StringUtils.snakeCase;
export const padStart         = StringUtils.padStart;
export const padEnd           = StringUtils.padEnd;

// ── Number helpers ──
export const formatNumber   = NumberUtils.formatNumber;
export const formatPercent  = NumberUtils.formatPercent;
export const formatBytes    = NumberUtils.formatBytes;
export const clamp          = NumberUtils.clamp;
export const roundTo        = NumberUtils.roundTo;
export const toFixedNumber  = NumberUtils.toFixedNumber;
export const formatDuration = NumberUtils.formatDuration;
export const sum            = NumberUtils.sum;
export const mean           = NumberUtils.mean;
export const maxBy          = NumberUtils.maxBy;
export const minBy          = NumberUtils.minBy;
export const safeParseInt   = NumberUtils.safeParseInt;
export const safeParseFloat = NumberUtils.safeParseFloat;
export const random         = NumberUtils.random;
export const randomId       = NumberUtils.randomId;
export const uid            = NumberUtils.uid;

// ── Async helpers ──
export const sleep         = AsyncUtils.sleep;
export const delay         = AsyncUtils.delay;
export const debounce      = AsyncUtils.debounce;
export const debounceAsync = AsyncUtils.debounceAsync;
export const debounceLeading = AsyncUtils.debounceLeading;
export const throttle      = AsyncUtils.throttle;
export const throttleAsync = AsyncUtils.throttleAsync;
export const once          = AsyncUtils.once;
export const memoize       = AsyncUtils.memoize;
export const memoizeAsync  = AsyncUtils.memoizeAsync;
export const withTimeout   = AsyncUtils.withTimeout;
export const retry         = AsyncUtils.retry;

// ── Array helpers ──
export const unique        = ArrayUtils.unique;
export const compact       = ArrayUtils.compact;
export const flatten       = ArrayUtils.flatten;
export const range         = ArrayUtils.range;
export const chunk         = ArrayUtils.chunk;
export const sample        = ArrayUtils.sample;
export const shuffle       = ArrayUtils.shuffle;
export const reverse       = ArrayUtils.reverse;
export const union         = ArrayUtils.union;
export const intersection  = ArrayUtils.intersection;
export const difference    = ArrayUtils.difference;
export const groupBy       = ArrayUtils.groupBy;
export const partition     = ArrayUtils.partition;
export const sortBy        = ArrayUtils.sortBy;
export const keyBy         = ArrayUtils.keyBy;
export const times         = ArrayUtils.times;
export const randomChoice  = ArrayUtils.randomChoice;
export const ensureArray   = ArrayUtils.ensureArray;
export const zip           = ArrayUtils.zip;
export const head          = ArrayUtils.head;
export const tail          = ArrayUtils.tail;
export const initial       = ArrayUtils.initial;
export const last          = ArrayUtils.last;
export const findIndex     = ArrayUtils.findIndex;
export const countBy       = ArrayUtils.countBy;

// ── Object helpers ──
export const deepClone    = ObjectUtils.deepClone;
export const clone        = ObjectUtils.clone;
export const deepEqual    = ObjectUtils.deepEqual;
export const pick         = ObjectUtils.pick;
export const omit         = ObjectUtils.omit;
export const defaults     = ObjectUtils.defaults;
export const merge        = ObjectUtils.merge;
export const invert       = ObjectUtils.invert;
export const mapValues    = ObjectUtils.mapValues;
export const mapKeys      = ObjectUtils.mapKeys;
export const has          = ObjectUtils.has;
export const get          = ObjectUtils.get;
export const set          = ObjectUtils.set;
export const zipObject    = ObjectUtils.zipObject;
export const identity     = ObjectUtils.identity;
export const constant     = ObjectUtils.constant;
export const at           = ObjectUtils.at;
export const unset        = ObjectUtils.unset;
export const defaultsDeep = ObjectUtils.defaultsDeep;

// ── URL helpers ──
export const parseQueryString    = UrlUtils.parseQueryString;
export const stringifyQueryString = UrlUtils.stringifyQueryString;
export const isValidUrl          = UrlUtils.isValidUrl;

// ── Storage helpers ──
export const localStorageGet       = StorageUtils.localStorageGet;
export const localStorageSet       = StorageUtils.localStorageSet;
export const localStorageRemove    = StorageUtils.localStorageRemove;
export const localStorageGetString = StorageUtils.localStorageGetString;
export const localStorageSetString = StorageUtils.localStorageSetString;
export const sessionStorageGet     = StorageUtils.sessionStorageGet;
export const sessionStorageSet     = StorageUtils.sessionStorageSet;

// ── Accessibility helpers ──
export const prefersReducedMotion = AccessibilityUtils.prefersReducedMotion;
export const prefersDarkMode    = AccessibilityUtils.prefersDarkMode;

// ── DOM helpers ──
export const showToast          = DomUtils.showToast;
export const removeToastContainer = DomUtils.removeToastContainer;
export const hasClass           = DomUtils.hasClass;
export const addClass           = DomUtils.addClass;
export const removeClass        = DomUtils.removeClass;
export const toggleClass        = DomUtils.toggleClass;
export const createElement      = DomUtils.createElement;
export const removeAllChildren  = DomUtils.removeAllChildren;
export const renderEmptyState   = DomUtils.renderEmptyState;
export const scrollToElement    = DomUtils.scrollToElement;
export const elementInViewport  = DomUtils.elementInViewport;

// ── Format helpers ──
export const formatDate             = FormatUtils.formatDate;
export const relativeTime           = FormatUtils.relativeTime;
export const redactPathForDisplay   = FormatUtils.redactPathForDisplay;
export const isRedactedPathDisplay  = FormatUtils.isRedactedPathDisplay;
export const formatPathLabel        = FormatUtils.formatPathLabel;
export const normalizeSlashes       = FormatUtils.normalizeSlashes;
export const formatPathInputValue   = FormatUtils.formatPathInputValue;
export const formatScanPathForDisplay = FormatUtils.formatScanPathForDisplay;
export const formatAiSummarySkipMessage = FormatUtils.formatAiSummarySkipMessage;

// ── Type guards ──
export const isDefined      = TypeUtils.isDefined;
export const isNull        = TypeUtils.isNull;
export const isUndefined   = TypeUtils.isUndefined;
export const isNil          = TypeUtils.isNil;
export const isSymbol      = TypeUtils.isSymbol;
export const isMap         = TypeUtils.isMap;
export const isSet         = TypeUtils.isSet;
export const isBoolean     = TypeUtils.isBoolean;
export const isNumber      = TypeUtils.isNumber;
export const isString      = TypeUtils.isString;
export const isArray       = TypeUtils.isArray;
export const isFunction    = TypeUtils.isFunction;
export const isObject      = TypeUtils.isObject;
export const isDate        = TypeUtils.isDate;
export const isRegExp      = TypeUtils.isRegExp;
export const isPromise     = TypeUtils.isPromise;
export const isError       = TypeUtils.isError;
export const noop           = TypeUtils.noop;
export const assertNever    = TypeUtils.assertNever;
export const parseJsonSafe  = TypeUtils.parseJsonSafe;

// ── Function helpers ──
export const seq           = FunctionUtils.seq;
export const flow          = FunctionUtils.flow;
export const negate        = FunctionUtils.negate;
export const zipWith       = FunctionUtils.zipWith;
export const curry         = FunctionUtils.curry;
export const partial       = FunctionUtils.partial;
export const tap           = FunctionUtils.tap;

// ── Crypto helpers ──
export const hash          = CryptoUtils.hash;

// ── Color helpers ──
export const hexToRgba     = ColorUtils.hexToRgba;
export const contrastColor = ColorUtils.contrastColor;

// ── Download helpers ──
export const downloadJson  = DownloadUtils.downloadJson;
export const downloadText  = DownloadUtils.downloadText;
export const downloadCsv   = DownloadUtils.downloadCsv;

// ── Fetch helpers ──
export const fetchWithTimeout = FetchUtils.fetchWithTimeout;

// ── Privacy helpers ──
export const sanitizePrivacyData = PrivacyUtils.sanitizePrivacyData;

// ── Clipboard helpers ──
export const copyToClipboard = ClipboardUtils.copyToClipboard;

// ── VS Code helpers ──
export const isVSCodeWebview = VSCodeUtils.isVSCodeWebview;
export const isStandalone    = VSCodeUtils.isStandalone;
export const getVSCodeApi    = VSCodeUtils.getVSCodeApi;

// Build flat exports dynamically from imported namespaces
const _nsMap = {
  string: StringUtils, number: NumberUtils, async: AsyncUtils, array: ArrayUtils,
  object: ObjectUtils, url: UrlUtils, storage: StorageUtils, accessibility: AccessibilityUtils,
  dom: DomUtils, format: FormatUtils, type: TypeUtils, fn: FunctionUtils,
  crypto: CryptoUtils, color: ColorUtils, download: DownloadUtils, fetch: FetchUtils,
  privacy: PrivacyUtils, clipboard: ClipboardUtils, vscode: VSCodeUtils
};

function _buildFlatExports() {
  const exports = {};
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const key of Object.keys(ns)) {
      if (!Object.prototype.hasOwnProperty.call(ns, key)) continue;
      exports[key] = ns[key];
    }
  }
  exports.deepFreeze = deepFreeze;
  return Object.freeze(exports);
}

/** @type {Readonly<Record<string, unknown>>|null} */
let _flatExports = null;
function _getFlatExports() {
  if (!_flatExports) {
    _flatExports = _buildFlatExports();
  }
  return _flatExports;
}

export const exportNames = Object.freeze(Object.keys(_getFlatExports()).concat(
  'exportNames', 'getExportNames', 'getNamespaceNames',
  'validateBarrelIntegrity', '__barrel__'
));

/** @returns {ReadonlyArray<string>} All flat named export keys from this barrel. */
export function getExportNames() {
  return exportNames;
}

const NAMESPACE_NAMES = Object.freeze([
  'string', 'number', 'async', 'array', 'object', 'url', 'storage',
  'accessibility', 'dom', 'format', 'type', 'fn', 'crypto',
  'color', 'download', 'fetch', 'privacy', 'clipboard', 'vscode'
]);

/** @returns {ReadonlyArray<string>} All namespace keys from this barrel. */
export function getNamespaceNames() {
  return NAMESPACE_NAMES;
}

const BARREL_TIMESTAMP = '2026-07-03T00:00:00.000Z';

const BARREL_REQUIRED_KEYS = Object.freeze([
  'name', 'description', 'moduleCount', 'exportCount', 'namespaceCount',
  'version', 'timestamp', 'exports', 'namespaces'
]);

export const __barrel__ = Object.freeze({
  name: 'simplebeacon-vscode-utils',
  description: 'Barrel re-export for js-es2018/utils-lib/ sub-modules',
  moduleCount: 19,
  exportCount: getExportNames().length,
  namespaceCount: getNamespaceNames().length,
  version: '1.0.0',
  timestamp: BARREL_TIMESTAMP,
  exports: getExportNames(),
  namespaces: getNamespaceNames()
});

const compositionNamespace = Object.freeze({
  /**
   * Sequential function composition (right-to-left).
   * @param {...Function} fns - Functions to compose.
   * @returns {Function} Composed function.
   * @throws {TypeError} If any argument is not a function.
   */
  seq: (...fns) => {
    fns.forEach((fn, i) => { if (typeof fn !== 'function') throw new TypeError(`seq: argument at index ${i} is not a function`); });
    return FunctionUtils.seq(...fns);
  },
  /**
   * Left-to-right function composition (pipe).
   * @param {...Function} fns - Functions to pipe.
   * @returns {Function} Piped function.
   * @throws {TypeError} If any argument is not a function.
   */
  flow: (...fns) => {
    fns.forEach((fn, i) => { if (typeof fn !== 'function') throw new TypeError(`flow: argument at index ${i} is not a function`); });
    return FunctionUtils.flow(...fns);
  },
  /**
   * Negate a predicate function.
   * @param {Function} fn - Predicate to negate.
   * @returns {Function} Negated predicate.
   * @throws {TypeError} If fn is not a function.
   */
  negate: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('negate: argument must be a function');
    return FunctionUtils.negate(fn);
  },
  /**
   * Zip two arrays with a combiner function.
   * @param {Array} a - First array.
   * @param {Array} b - Second array.
   * @param {Function} fn - Combiner function(a, b).
   * @returns {Array} Zipped result.
   * @throws {TypeError} If inputs are not arrays or fn is not a function.
   */
  zipWith: (a, b, fn) => {
    if (!Array.isArray(a)) throw new TypeError('zipWith: first argument must be an array');
    if (!Array.isArray(b)) throw new TypeError('zipWith: second argument must be an array');
    if (typeof fn !== 'function') throw new TypeError('zipWith: third argument must be a function');
    return FunctionUtils.zipWith(a, b, fn);
  },
  /**
   * Curry a function.
   * @param {Function} fn - Function to curry.
   * @returns {Function} Curried function.
   * @throws {TypeError} If fn is not a function.
   */
  curry: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('curry: argument must be a function');
    return FunctionUtils.curry(fn);
  },
  /**
   * Partial application.
   * @param {Function} fn - Function to partially apply.
   * @param {...*} args - Pre-filled arguments.
   * @returns {Function} Partially applied function.
   * @throws {TypeError} If fn is not a function.
   */
  partial: (fn, ...args) => {
    if (typeof fn !== 'function') throw new TypeError('partial: first argument must be a function');
    return FunctionUtils.partial(fn, ...args);
  },
  /**
   * Tap into a value for side effects, then return the value.
   * @param {Function} fn - Side-effect function.
   * @returns {Function} Tap wrapper.
   * @throws {TypeError} If fn is not a function.
   */
  tap: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('tap: argument must be a function');
    return FunctionUtils.tap(fn);
  },
  // Array
  groupBy: ArrayUtils.groupBy,
  partition: ArrayUtils.partition,
  chunk: ArrayUtils.chunk,
  unique: ArrayUtils.unique,
  compact: ArrayUtils.compact,
  flatten: ArrayUtils.flatten,
  sample: ArrayUtils.sample,
  shuffle: ArrayUtils.shuffle,
  union: ArrayUtils.union,
  intersection: ArrayUtils.intersection,
  difference: ArrayUtils.difference,
  sortBy: ArrayUtils.sortBy,
  keyBy: ArrayUtils.keyBy,
  times: ArrayUtils.times,
  randomChoice: ArrayUtils.randomChoice,
  ensureArray: ArrayUtils.ensureArray,
  zip: ArrayUtils.zip,
  head: ArrayUtils.head,
  tail: ArrayUtils.tail,
  initial: ArrayUtils.initial,
  last: ArrayUtils.last,
  findIndex: ArrayUtils.findIndex,
  countBy: ArrayUtils.countBy,
  range: ArrayUtils.range,
  reverse: ArrayUtils.reverse,
  // Object
  deepClone: ObjectUtils.deepClone,
  clone: ObjectUtils.clone,
  deepEqual: ObjectUtils.deepEqual,
  pick: ObjectUtils.pick,
  omit: ObjectUtils.omit,
  defaults: ObjectUtils.defaults,
  merge: ObjectUtils.merge,
  invert: ObjectUtils.invert,
  mapValues: ObjectUtils.mapValues,
  mapKeys: ObjectUtils.mapKeys,
  has: ObjectUtils.has,
  get: ObjectUtils.get,
  set: ObjectUtils.set,
  zipObject: ObjectUtils.zipObject,
  identity: ObjectUtils.identity,
  constant: ObjectUtils.constant,
  at: ObjectUtils.at,
  unset: ObjectUtils.unset,
  defaultsDeep: ObjectUtils.defaultsDeep,
  // Number
  formatNumber: NumberUtils.formatNumber,
  formatPercent: NumberUtils.formatPercent,
  formatBytes: NumberUtils.formatBytes,
  clamp: NumberUtils.clamp,
  roundTo: NumberUtils.roundTo,
  toFixedNumber: NumberUtils.toFixedNumber,
  formatDuration: NumberUtils.formatDuration,
  sum: NumberUtils.sum,
  mean: NumberUtils.mean,
  maxBy: NumberUtils.maxBy,
  minBy: NumberUtils.minBy,
  safeParseInt: NumberUtils.safeParseInt,
  safeParseFloat: NumberUtils.safeParseFloat,
  random: NumberUtils.random,
  randomId: NumberUtils.randomId,
  uid: NumberUtils.uid,
  // String
  escapeHtml: StringUtils.escapeHtml,
  escapeRegExp: StringUtils.escapeRegExp,
  truncate: StringUtils.truncate,
  isBlank: StringUtils.isBlank,
  capitalize: StringUtils.capitalize,
  words: StringUtils.words,
  repeat: StringUtils.repeat,
  titleCase: StringUtils.titleCase,
  slugify: StringUtils.slugify,
  stripHtml: StringUtils.stripHtml,
  kebabCase: StringUtils.kebabCase,
  camelCase: StringUtils.camelCase,
  snakeCase: StringUtils.snakeCase,
  padStart: StringUtils.padStart,
  padEnd: StringUtils.padEnd,
  // Async
  sleep: AsyncUtils.sleep,
  delay: AsyncUtils.delay,
  debounce: AsyncUtils.debounce,
  debounceAsync: AsyncUtils.debounceAsync,
  debounceLeading: AsyncUtils.debounceLeading,
  throttle: AsyncUtils.throttle,
  throttleAsync: AsyncUtils.throttleAsync,
  once: AsyncUtils.once,
  memoize: AsyncUtils.memoize,
  memoizeAsync: AsyncUtils.memoizeAsync,
  withTimeout: AsyncUtils.withTimeout,
  retry: AsyncUtils.retry,
  // Type
  isDefined: TypeUtils.isDefined,
  isNull: TypeUtils.isNull,
  isUndefined: TypeUtils.isUndefined,
  isNil: TypeUtils.isNil,
  isSymbol: TypeUtils.isSymbol,
  isMap: TypeUtils.isMap,
  isSet: TypeUtils.isSet,
  isBoolean: TypeUtils.isBoolean,
  isNumber: TypeUtils.isNumber,
  isString: TypeUtils.isString,
  isArray: TypeUtils.isArray,
  isFunction: TypeUtils.isFunction,
  isObject: TypeUtils.isObject,
  isDate: TypeUtils.isDate,
  isRegExp: TypeUtils.isRegExp,
  isPromise: TypeUtils.isPromise,
  isError: TypeUtils.isError,
  noop: TypeUtils.noop,
  assertNever: TypeUtils.assertNever,
  parseJsonSafe: TypeUtils.parseJsonSafe,
  // URL
  parseQueryString: UrlUtils.parseQueryString,
  stringifyQueryString: UrlUtils.stringifyQueryString,
  isValidUrl: UrlUtils.isValidUrl,
  // Others
  deepFreeze,
  hash: CryptoUtils.hash,
  hexToRgba: ColorUtils.hexToRgba,
  contrastColor: ColorUtils.contrastColor,
  fetchWithTimeout: FetchUtils.fetchWithTimeout,
  sanitizePrivacyData: PrivacyUtils.sanitizePrivacyData,
  copyToClipboard: ClipboardUtils.copyToClipboard
});

const defaultExport = deepFreeze({
  string: StringUtils,
  number: NumberUtils,
  async: AsyncUtils,
  array: ArrayUtils,
  object: ObjectUtils,
  url: UrlUtils,
  storage: StorageUtils,
  accessibility: AccessibilityUtils,
  dom: DomUtils,
  format: FormatUtils,
  type: TypeUtils,
  fn: FunctionUtils,
  crypto: CryptoUtils,
  color: ColorUtils,
  download: DownloadUtils,
  fetch: FetchUtils,
  privacy: PrivacyUtils,
  clipboard: ClipboardUtils,
  vscode: VSCodeUtils,
  composition: compositionNamespace,
  __barrel__
});

/**
 * Validate the barrel export structure.
 * Checks: namespaces exist, default export is frozen, metadata is complete,
 *         all flat exports are defined, all named exports are resolvable.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateBarrelIntegrity() {
  const errors = [];
  const nsKeys = getNamespaceNames();
  for (const key of nsKeys) {
    if (!defaultExport[key] || typeof defaultExport[key] !== 'object') {
      errors.push(`Namespace "${key}" is missing or not an object`);
    }
  }
  if (!Object.isFrozen(defaultExport)) {
    errors.push('Default export is not frozen');
  }
  if (!defaultExport.__barrel__) {
    errors.push('Missing __barrel__ metadata');
  } else {
    for (const metaKey of BARREL_REQUIRED_KEYS) {
      if (!(metaKey in defaultExport.__barrel__)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
  }
  // Verify every flat export is actually defined (not null/undefined)
  const flat = _getFlatExports();
  for (const key of Object.keys(flat)) {
    if (flat[key] == null) {
      errors.push(`Flat export "${key}" is null or undefined`);
    }
  }
  // Verify explicit named exports are present in the flat map
  const explicitNames = Object.keys(_nsMap).concat('deepFreeze');
  for (const name of explicitNames) {
    if (!(name in flat)) {
      errors.push(`Named export "${name}" missing from flat exports`);
    }
  }
  // Verify no duplicate keys snuck into the frozen object
  const rawKeys = Object.keys(flat);
  if (rawKeys.length !== exportNames.length) {
    const dupes = rawKeys.filter((k, i) => rawKeys.indexOf(k) !== i);
    if (dupes.length) {
      errors.push(`Duplicate keys detected in flat exports: ${[...new Set(dupes)].join(', ')}`);
    }
  }

  // Verify compositionNamespace exports are valid
  for (const key of Object.keys(compositionNamespace)) {
    const value = compositionNamespace[key];
    if (typeof value !== 'function' && typeof value !== 'object') {
      errors.push(`Composition namespace export "${key}" has unsupported type: ${typeof value}`);
    }
  }

  // Collision detection between namespaces
  const _collisionWarnings = new Set();
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const key of Object.keys(ns)) {
      if (!Object.prototype.hasOwnProperty.call(ns, key)) continue;
      if (key in compositionNamespace && !_collisionWarnings.has(key)) {
        _collisionWarnings.add(key);
        console.warn(`[utils] Collision: "${key}" from "${nsName}" also exists in composition namespace; composition wins.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run inline smoke tests for critical barrel utilities.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function integrityTest() {
  const failures = [];
  function assert(label, condition) { if (!condition) failures.push(label); }

  assert('seq identity', compositionNamespace.seq()(5) === 5);
  assert('flow pipes', compositionNamespace.flow((x) => x + 1, (x) => x * 2)(3) === 8);
  assert('negate', compositionNamespace.negate((x) => x > 0)(-1));
  assert('zipWith pairs', compositionNamespace.zipWith([1, 2], [3, 4], (a, b) => a + b)[0] === 4);
  assert('curry partial', compositionNamespace.curry((a, b) => a + b)(1)(2) === 3);
  assert('partial apply', compositionNamespace.partial((a, b) => a + b, 1)(2) === 3);
  assert('tap returns value', compositionNamespace.tap(() => undefined)(5) === 5);

  // Inline namespace parity tests
  assert('groupBy', JSON.stringify(compositionNamespace.groupBy([1, 2, 3], x => x % 2)) === JSON.stringify({ '1': [1, 3], '0': [2] }));
  assert('partition', JSON.stringify(compositionNamespace.partition([1, 2, 3], x => x > 1)) === JSON.stringify([[2, 3], [1]]));
  assert('chunk', JSON.stringify(compositionNamespace.chunk([1, 2, 3, 4], 2)) === JSON.stringify([[1, 2], [3, 4]]));
  assert('deepClone', compositionNamespace.deepClone({ a: 1 }).a === 1);
  assert('deepEqual', compositionNamespace.deepEqual({ a: 1 }, { a: 1 }));
  assert('pick', JSON.stringify(compositionNamespace.pick({ a: 1, b: 2 }, ['a'])) === JSON.stringify({ a: 1 }));
  assert('omit', JSON.stringify(compositionNamespace.omit({ a: 1, b: 2 }, ['b'])) === JSON.stringify({ a: 1 }));
  assert('clamp', compositionNamespace.clamp(15, 0, 10) === 10);
  assert('formatBytes', compositionNamespace.formatBytes(1024).includes('KB'));
  assert('formatNumber', compositionNamespace.formatNumber(1000).includes('1'));
  assert('escapeHtml', compositionNamespace.escapeHtml('<div>').includes('&lt;'));
  assert('truncate', compositionNamespace.truncate('hello world', 8) === 'hello...');
  assert('capitalize', compositionNamespace.capitalize('hello') === 'Hello');
  assert('isDefined', compositionNamespace.isDefined(0));
  assert('parseJsonSafe', compositionNamespace.parseJsonSafe('{"a":1}', null).a === 1);

  return { passed: failures.length === 0, failures };
}

export default defaultExport;
