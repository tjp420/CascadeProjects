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
import * as EventUtils   from './event.js';
import * as PathUtils    from './path.js';
import * as PollingUtils from './polling.js';
import * as ThemeUtils   from './theme.js';
import { deepFreeze } from '../utils/deep-freeze.js';
export { deepFreeze };

// Small local helpers for functions expected by the barrel API but not exported by the js-es2018 sub-modules.
const toFixedNumberImpl = (num, digits = 0) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return NaN;
  const d = Math.max(0, Math.min(20, Math.floor(Number(digits) || 0)));
  return Number(n.toFixed(d));
};
const zipObjectImpl = (keys, values) => {
  const out = {};
  const len = Math.min(keys.length, values.length);
  for (let i = 0; i < len; i++) out[keys[i]] = values[i];
  return out;
};
const delayImpl = (ms, value) => AsyncUtils.sleep(ms).then(() => value);
const throttleAsyncImpl = (fn, wait) => AsyncUtils.throttle(fn, wait);

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
export const formatNumber   = FormatUtils.formatNumber;
export const formatPercent  = FormatUtils.formatPercent;
export const formatBytes    = FormatUtils.formatBytes;
export const clamp          = NumberUtils.clamp;
export const roundTo        = NumberUtils.roundTo;
export const toFixedNumber  = toFixedNumberImpl;
export const formatDuration = FormatUtils.formatDuration;
export const sum            = ArrayUtils.sum;
export const mean           = ArrayUtils.mean;
export const maxBy          = ArrayUtils.maxBy;
export const minBy          = ArrayUtils.minBy;
export const safeParseInt   = NumberUtils.safeParseInt;
export const safeParseFloat = NumberUtils.safeParseFloat;
export const inRange        = NumberUtils.inRange;
export const random         = CryptoUtils.random;
export const randomId       = CryptoUtils.randomId;
export const uid            = CryptoUtils.uid;

// ── Async helpers ──
export const sleep         = AsyncUtils.sleep;
export const delay         = delayImpl;
export const debounce      = AsyncUtils.debounce;
export const debounceAsync = AsyncUtils.debounceAsync;
export const debounceLeading = AsyncUtils.debounceLeading;
export const throttle      = AsyncUtils.throttle;
export const throttleAsync = throttleAsyncImpl;
export const once          = AsyncUtils.once;
export const memoize       = AsyncUtils.memoize;
export const memoizeAsync  = AsyncUtils.memoizeAsync;
export const withTimeout   = AsyncUtils.withTimeout;
export const retry         = AsyncUtils.retry;
export const pMap          = AsyncUtils.pMap;
export const poll          = AsyncUtils.poll;
export const waitForAsync  = AsyncUtils.waitForAsync;

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
export const ensureArray   = ObjectUtils.ensureArray;
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
export const zipObject    = zipObjectImpl;
export const identity     = FunctionUtils.identity;
export const constant     = FunctionUtils.constant;
export const at           = ObjectUtils.at;
export const unset        = ObjectUtils.unset;
export const defaultsDeep = ObjectUtils.defaultsDeep;
export const isEmpty      = ObjectUtils.isEmpty;

// ── URL helpers ──
export const parseQueryString    = UrlUtils.parseQueryString;
export const stringifyQueryString = UrlUtils.stringifyQueryString;
export const isValidUrl          = UrlUtils.isValidUrl;
export const apiBaseUrl          = UrlUtils.apiBaseUrl;
export const apiUrl              = UrlUtils.apiUrl;

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
export const createElement      = DomUtils.createElement;
export const removeAllChildren  = DomUtils.removeAllChildren;
export const renderEmptyState   = DomUtils.renderEmptyState;
export const scrollToElement    = DomUtils.scrollToElement;
export const elementInViewport  = DomUtils.elementInViewport;
export const hasClass           = DomUtils.hasClass;
export const addClass           = DomUtils.addClass;
export const removeClass        = DomUtils.removeClass;
export const toggleClass        = DomUtils.toggleClass;

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
export const noop           = FunctionUtils.noop;
export const assertNever    = FunctionUtils.assertNever;
export const parseJsonSafe  = ObjectUtils.safeJSONParse;

// ── Function helpers ──
export const seq           = FunctionUtils.seq;
export const flow          = FunctionUtils.flow;
export const negate        = FunctionUtils.negate;
export const zipWith       = FunctionUtils.zipWith;
export const curry         = FunctionUtils.curry;
export const partial       = FunctionUtils.partial;
export const tap           = FunctionUtils.tap;
export const tryFn         = FunctionUtils.tryFn;

// ── Crypto helpers ──
export const hash          = CryptoUtils.hash;
export const getNonce      = CryptoUtils.getNonce;

// ── Color helpers ──
export const hexToRgba     = ColorUtils.hexToRgba;
export const contrastColor = ColorUtils.contrastColor;
export const shadeColor    = ColorUtils.shadeColor;

// ── Download helpers ──
export const downloadJson   = DownloadUtils.downloadJson;
export const downloadText   = DownloadUtils.downloadText;
export const downloadCsv    = DownloadUtils.downloadCsv;
export const downloadBlob   = DownloadUtils.downloadBlob;
export const normalDownload = DownloadUtils.normalDownload;

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

// ── Event helpers ──
export const createEventBus        = EventUtils.createEventBus;
export const createBroadcastChannel = EventUtils.createBroadcastChannel;

// ── Path helpers ──
export const resolveDashboardProjectPath = PathUtils.resolveDashboardProjectPath;

// ── Polling helpers ──
export const createPoller = PollingUtils.createPoller;

// ── Theme helpers ──
export const getCssVar = ThemeUtils.getCssVar;
export const setCssVar = ThemeUtils.setCssVar;

// Build flat exports dynamically from imported namespaces
const _nsMap = {
  string: StringUtils, number: NumberUtils, async: AsyncUtils, array: ArrayUtils,
  object: ObjectUtils, url: UrlUtils, storage: StorageUtils, accessibility: AccessibilityUtils,
  dom: DomUtils, format: FormatUtils, type: TypeUtils, fn: FunctionUtils,
  crypto: CryptoUtils, color: ColorUtils, download: DownloadUtils, fetch: FetchUtils,
  privacy: PrivacyUtils, clipboard: ClipboardUtils, vscode: VSCodeUtils,
  event: EventUtils, path: PathUtils, polling: PollingUtils, theme: ThemeUtils
};

const KNOWN_COLLISIONS = new Set([
  'escapeHtml',
  'normalizeSlashes',
  'redactPathForDisplay',
  'isRedactedPathDisplay',
  'formatPathInputValue',
  'formatPathLabel',
  'formatScanPathForDisplay',
  'seq', 'flow', 'negate', 'zipWith', 'curry', 'partial', 'tap',
  'contrastColor', 'hexToRgba', 'shadeColor',
  'prefersDarkMode', 'prefersReducedMotion'
]);

function _buildFlatExports() {
  const flatExports = {};
  const seen = new Set();
  const collisions = [];
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const key of Object.keys(ns)) {
      if (!Object.prototype.hasOwnProperty.call(ns, key)) continue;
      if (seen.has(key)) {
        if (flatExports[key] !== ns[key]) {
          collisions.push({ key, nsName });
        }
        continue;
      }
      seen.add(key);
      flatExports[key] = ns[key];
    }
  }
  flatExports.deepFreeze = deepFreeze;
  const unexpectedCollisions = collisions.filter(c => !KNOWN_COLLISIONS.has(c.key));
  if (unexpectedCollisions.length && typeof console !== 'undefined' && typeof console.warn === 'function') {
    for (const { key, nsName } of unexpectedCollisions) {
      console.warn(`[utils-lib] Skipped duplicate flat export "${key}" from "${nsName}" with a different value; first source wins.`);
    }
  }
  return Object.freeze(flatExports);
}

/** @type {Readonly<Record<string, unknown>>|null} */
let _flatExports = null;
function _getFlatExports() {
  if (!_flatExports) {
    _flatExports = _buildFlatExports();
  }
  return _flatExports;
}

export const exportNames = Object.freeze(Object.keys(_getFlatExports()).filter((name) => name !== 'safeJSONParse').concat(
  'parseJsonSafe', 'toFixedNumber', 'zipObject', 'delay', 'throttleAsync',
  'exportNames', 'getExportNames', 'getNamespaceNames',
  'validateBarrelIntegrity', 'integrityTest', '__barrel__', 'composition'
));

/** @returns {ReadonlyArray<string>} All flat named export keys from this barrel. */
export function getExportNames() {
  return exportNames;
}

const NAMESPACE_NAMES = Object.freeze(Object.keys(_nsMap));

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
  moduleCount: Object.keys(_nsMap).length,
  exportCount: getExportNames().length,
  namespaceCount: getNamespaceNames().length,
  version: '1.0.0',
  timestamp: BARREL_TIMESTAMP,
  exports: getExportNames(),
  namespaces: getNamespaceNames()
});

const COMPOSITION_ALIASES = {
  deepFreeze,
  parseJsonSafe: ObjectUtils.safeJSONParse,
  toFixedNumber: toFixedNumberImpl,
  zipObject: zipObjectImpl,
  delay: delayImpl,
  throttleAsync: throttleAsyncImpl
};

const VALIDATED_WRAPPERS = {
  /**
   * Sequential function composition (left-to-right).
   * @param {...Function} fns
   * @returns {Function}
   * @throws {TypeError}
   */
  seq: (...fns) => {
    fns.forEach((fn, i) => { if (typeof fn !== 'function') throw new TypeError('seq: argument at index ' + i + ' is not a function'); });
    return FunctionUtils.seq(...fns);
  },
  /**
   * Right-to-left function composition (compose).
   * @param {...Function} fns
   * @returns {Function}
   * @throws {TypeError}
   */
  flow: (...fns) => {
    fns.forEach((fn, i) => { if (typeof fn !== 'function') throw new TypeError('flow: argument at index ' + i + ' is not a function'); });
    return FunctionUtils.flow(...fns);
  },
  /**
   * Negate a predicate function.
   * @param {Function} fn
   * @returns {Function}
   * @throws {TypeError}
   */
  negate: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('negate: argument must be a function');
    return FunctionUtils.negate(fn);
  },
  /**
   * Zip two arrays with a combiner function.
   * @param {Array} a
   * @param {Array} b
   * @param {Function} fn
   * @returns {Array}
   * @throws {TypeError}
   */
  zipWith: (a, b, fn) => {
    if (!Array.isArray(a)) throw new TypeError('zipWith: first argument must be an array');
    if (!Array.isArray(b)) throw new TypeError('zipWith: second argument must be an array');
    if (typeof fn !== 'function') throw new TypeError('zipWith: third argument must be a function');
    return FunctionUtils.zipWith(a, b, fn);
  },
  /**
   * Curry a function.
   * @param {Function} fn
   * @returns {Function}
   * @throws {TypeError}
   */
  curry: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('curry: argument must be a function');
    return FunctionUtils.curry(fn);
  },
  /**
   * Partial application.
   * @param {Function} fn
   * @param {...*} args
   * @returns {Function}
   * @throws {TypeError}
   */
  partial: (fn, ...args) => {
    if (typeof fn !== 'function') throw new TypeError('partial: first argument must be a function');
    return FunctionUtils.partial(fn, ...args);
  },
  /**
   * Tap into a value for side effects, then return the value.
   * @param {Function} fn
   * @returns {Function}
   * @throws {TypeError}
   */
  tap: (fn) => {
    if (typeof fn !== 'function') throw new TypeError('tap: argument must be a function');
    return (value) => FunctionUtils.tap(value, fn);
  }
};

const compositionNamespace = Object.freeze(
  Object.entries(_nsMap).reduce((comp, [nsName, ns]) => {
    if (!ns || typeof ns !== 'object') return comp;
    for (const key of Object.keys(ns)) {
      if (!Object.prototype.hasOwnProperty.call(ns, key)) continue;
      if (Object.prototype.hasOwnProperty.call(comp, key)) continue;
      comp[key] = ns[key];
    }
    return comp;
  }, { ...COMPOSITION_ALIASES, ...VALIDATED_WRAPPERS })
);
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
  event: EventUtils,
  path: PathUtils,
  polling: PollingUtils,
  theme: ThemeUtils,
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
    const meta = defaultExport.__barrel__;
    for (const metaKey of BARREL_REQUIRED_KEYS) {
      if (!(metaKey in meta)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
    if (meta.moduleCount !== Object.keys(_nsMap).length) {
      errors.push(`__barrel__.moduleCount (${meta.moduleCount}) does not match namespace count (${Object.keys(_nsMap).length})`);
    }
    if (meta.exportCount !== exportNames.length) {
      errors.push(`__barrel__.exportCount (${meta.exportCount}) does not match exportNames.length (${exportNames.length})`);
    }
    if (meta.namespaceCount !== nsKeys.length) {
      errors.push(`__barrel__.namespaceCount (${meta.namespaceCount}) does not match namespace count (${nsKeys.length})`);
    }
    if (!Array.isArray(meta.exports) || meta.exports.length !== exportNames.length) {
      errors.push('__barrel__.exports array is invalid');
    }
    if (!Array.isArray(meta.namespaces) || meta.namespaces.length !== nsKeys.length) {
      errors.push('__barrel__.namespaces array is invalid');
    }
  }

  // Verify every flat export is actually defined (not null/undefined)
  const flat = _getFlatExports();
  for (const key of Object.keys(flat)) {
    if (flat[key] == null) {
      errors.push(`Flat export "${key}" is null or undefined`);
    }
  }

  // Verify all namespace names are represented in the default export
  for (const nsName of nsKeys) {
    if (!(nsName in defaultExport)) {
      errors.push(`Namespace "${nsName}" missing from default export`);
    }
  }

  // Verify all named exports are accounted for and have a non-null value
  const barrelBuiltins = { exportNames, getExportNames, getNamespaceNames, validateBarrelIntegrity, integrityTest, __barrel__ };
  const barrelAliases = {
    parseJsonSafe: ObjectUtils.safeJSONParse,
    toFixedNumber: toFixedNumberImpl,
    zipObject: zipObjectImpl,
    delay: delayImpl,
    throttleAsync: throttleAsyncImpl,
    composition: compositionNamespace
  };
  const expectedExportNames = new Set([
    ...Object.keys(flat).filter((name) => name !== 'safeJSONParse'),
    ...Object.keys(barrelBuiltins),
    ...Object.keys(barrelAliases)
  ]);
  const exportNameSet = new Set(exportNames);
  if (exportNameSet.size !== exportNames.length) {
    const dupes = exportNames.filter((k, i) => exportNames.indexOf(k) !== i);
    errors.push(`Duplicate named exports detected: ${[...new Set(dupes)].join(', ')}`);
  }
  for (const name of exportNames) {
    let value;
    if (name in barrelBuiltins) {
      value = barrelBuiltins[name];
    } else if (name in barrelAliases) {
      value = barrelAliases[name];
    } else {
      value = flat[name];
    }
    if (value == null) {
      errors.push(`Named export "${name}" is null or undefined`);
    }
  }
  for (const name of expectedExportNames) {
    if (!exportNameSet.has(name)) {
      errors.push(`Missing export name: "${name}"`);
    }
  }

  // Verify compositionNamespace exports are valid
  for (const key of Object.keys(compositionNamespace)) {
    const value = compositionNamespace[key];
    if (typeof value !== 'function' && typeof value !== 'object') {
      errors.push(`Composition namespace export "${key}" has unsupported type: ${typeof value}`);
    }
  }

  // Collision detection between namespaces and composition namespace
  const _collisionWarnings = new Set();
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const key of Object.keys(ns)) {
      if (!Object.prototype.hasOwnProperty.call(ns, key)) continue;
      if (key in compositionNamespace && !_collisionWarnings.has(key) && !KNOWN_COLLISIONS.has(key)) {
        const compValue = compositionNamespace[key];
        const nsValue = ns[key];
        if (typeof compValue === 'function' && typeof nsValue === 'function' && compValue !== nsValue) {
          _collisionWarnings.add(key);
          console.warn(`[utils] Collision: "${key}" from "${nsName}" is overridden by composition namespace with a different implementation.`);
        }
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
  assert('seq pipes left-to-right', compositionNamespace.seq((x) => x + 1, (x) => x * 2)(3) === 8);
  assert('flow composes right-to-left', compositionNamespace.flow((x) => x + 1, (x) => x * 2)(3) === 7);
  assert('negate', compositionNamespace.negate((x) => x > 0)(-1));
  assert('zipWith pairs', compositionNamespace.zipWith([1, 2], [3, 4], (a, b) => a + b)[0] === 4);
  assert('curry partial', compositionNamespace.curry((a, b) => a + b)(1)(2) === 3);
  assert('partial apply', compositionNamespace.partial((a, b) => a + b, 1)(2) === 3);
  assert('tap returns value', compositionNamespace.tap(() => undefined)(5) === 5);

  // Inline namespace parity tests
  const groupByResult = compositionNamespace.groupBy([1, 2, 3], x => x % 2);
  assert('groupBy', groupByResult instanceof Map && groupByResult.get(1).length === 2 && groupByResult.get(0).length === 1);
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
  assert('truncate', compositionNamespace.truncate('hello world', 8) === 'hello w…');
  assert('capitalize', compositionNamespace.capitalize('hello') === 'Hello');
  assert('isDefined', compositionNamespace.isDefined(0));
  assert('parseJsonSafe', compositionNamespace.parseJsonSafe('{"a":1}', null).a === 1);

  return { passed: failures.length === 0, failures };
}

export const composition = compositionNamespace;

export default defaultExport;
