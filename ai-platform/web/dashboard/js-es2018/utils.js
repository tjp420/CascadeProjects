"use strict";
/**
 * @module utils
 * Barrel re-export for the `js/utils-lib/` directory.
 *
 * @example <caption>Named exports (tree-shakeable)</caption>
 * import { escapeHtml, clamp, deepClone } from './utils.js';
 *
 * @example <caption>Grouped namespace access</caption>
 * import Utils from './utils.js';
 * Utils.string.escapeHtml('<div>');
 *
 * @example <caption>Discovery helpers</caption>
 * getExportNames();    // ['escapeHtml', 'clamp', 'deepClone', ...]
 * getNamespaceNames(); // ['string', 'number', 'async', ...]
 *
 * @example <caption>Integrity check</caption>
 * validateBarrelIntegrity(); // { valid: true, errors: [] }
 *
 * @example <caption>Metadata</caption>
 * __barrel__.name;        // 'simplebeacon-dashboard-utils'
 * __barrel__.moduleCount; // dynamic
 *
 * @example <caption>Composition utilities</caption>
 * compose(f, g)(x); // f(g(x))
 * pipe(f, g)(x);    // g(f(x))
 *
 * @example <caption>Inline namespace</caption>
 * Utils.inline.compose(double, add1)(3); // 8
 * Utils.inline.zipWith([1,2], [3,4], (a,b) => a + b); // [4, 6]
 *
 * @example <caption>Theme helpers</caption>
 * Utils.theme.prefersDarkMode();    // true / false
 * Utils.theme.prefersReducedMotion(); // true / false
 *
 * @example <caption>Storage helpers</caption>
 * Utils.storage.localStorageGet('key');
 * Utils.storage.localStorageSet('key', value);
 *
 * @example <caption>JSON utilities</caption>
 * parseJsonSafe('{"a":1}', {});       // { a: 1 }
 * parseJsonSafe('invalid', null);     // null
 * await parseResponseJson(response);  // Parsed JSON or {}
 *
 * @example <caption>Dynamic exportNames</caption>
 * getExportNames().includes('compose'); // true
 * getNamespaceNames().length;           // dynamic
 */
// ── Namespace imports (used for flat re-exports and Utils default) ──
import * as StringUtils from "./utils-lib/string.js";
import * as NumberUtils from "./utils-lib/number.js";
import * as AsyncUtils from "./utils-lib/async.js";
import * as ArrayUtils from "./utils-lib/array.js";
import * as ObjectUtils from "./utils-lib/object.js";
import * as UrlUtils from "./utils-lib/url.js";
import * as StorageUtils from "./utils-lib/storage.js";
import * as ThemeUtils from "./utils-lib/theme.js";
import * as DomUtils from "./utils-lib/dom.js?v=20260721corsfix1";
import * as FormatUtils from "./utils-lib/format.js";
import * as TypeUtils from "./utils-lib/type.js";
import * as AccessibilityUtils from "./utils-lib/accessibility.js";
import * as ClipboardUtils from "./utils-lib/clipboard.js";
import * as CryptoUtils from "./utils-lib/crypto.js";
import * as DownloadUtils from "./utils-lib/download.js?v=20260721corsfix1";
import * as FetchUtils from "./utils-lib/fetch.js";
import * as FunctionUtils from "./utils-lib/function.js";
import * as PathUtils from "./utils-lib/path.js";
import * as PrivacyUtils from "./utils-lib/privacy.js";
import * as VSCodeUtils from "./utils-lib/vscode.js";
import * as EventUtils from "./utils-lib/event.js";
import * as PollingUtils from "./utils-lib/polling.js";
/**
 * Barrel metadata shape.
 * @typedef {Object} BarrelMeta
 * @property {string} name
 * @property {string} description
 * @property {number} moduleCount
 * @property {number} exportCount
 * @property {number} namespaceCount
 * @property {string} version
 * @property {string} timestamp
 * @property {ReadonlyArray<string>} exports
 * @property {ReadonlyArray<string>} namespaces
 */
// ── String helpers ───────────────────────────────────────────────
export const escapeHtml = StringUtils.escapeHtml;
export const escapeRegExp = StringUtils.escapeRegExp;
export const normalizeSlashes = StringUtils.normalizeSlashes;
export const truncate = StringUtils.truncate;
export const capitalize = StringUtils.capitalize;
export const hash = StringUtils.hash;
export const kebabCase = StringUtils.kebabCase;
export const camelCase = StringUtils.camelCase;
export const snakeCase = StringUtils.snakeCase;
export const padStart = StringUtils.padStart;
export const padEnd = StringUtils.padEnd;
export const stripHtml = StringUtils.stripHtml;
export const pluralize = StringUtils.pluralize;
// ── Path helpers ─────────────────────────────────────────────────
export const resolveDashboardProjectPath =
  PathUtils.resolveDashboardProjectPath;
// ── Number helpers ─────────────────────────────────────────────
export const formatNumber = NumberUtils.formatNumber;
export const formatPercent = NumberUtils.formatPercent;
export const formatBytes = NumberUtils.formatBytes;
export const clamp = NumberUtils.clamp;
export const roundTo = NumberUtils.roundTo;
export const toFixedNumber = NumberUtils.toFixedNumber;
export const formatDuration = NumberUtils.formatDuration;
export const sum = NumberUtils.sum;
export const mean = NumberUtils.mean;
export const maxBy = NumberUtils.maxBy;
export const minBy = NumberUtils.minBy;
export const safeParseInt = NumberUtils.safeParseInt;
export const safeParseFloat = NumberUtils.safeParseFloat;
export const random = NumberUtils.random;
export const randomId = NumberUtils.randomId;
export const uid = NumberUtils.uid;
// ── Async helpers ──────────────────────────────────────────────
export const sleep = AsyncUtils.sleep;
export const delay = AsyncUtils.delay;
export const debounce = AsyncUtils.debounce;
export const debounceAsync = AsyncUtils.debounceAsync;
export const debounceLeading = AsyncUtils.debounceLeading;
export const throttle = AsyncUtils.throttle;
export const throttleAsync = AsyncUtils.throttleAsync;
export const once = AsyncUtils.once;
export const memoize = AsyncUtils.memoize;
export const memoizeAsync = AsyncUtils.memoizeAsync;
export const withTimeout = AsyncUtils.withTimeout;
export const tryFn = AsyncUtils.tryFn;
export const seq = AsyncUtils.seq;
export const flow = AsyncUtils.flow;
export const negate = AsyncUtils.negate;
export const retry = AsyncUtils.retry;
// ── Array helpers ────────────────────────────────────────────────
export const unique = ArrayUtils.unique;
export const compact = ArrayUtils.compact;
export const flatten = ArrayUtils.flatten;
export const range = ArrayUtils.range;
export const chunk = ArrayUtils.chunk;
export const sample = ArrayUtils.sample;
export const shuffle = ArrayUtils.shuffle;
export const reverse = ArrayUtils.reverse;
export const union = ArrayUtils.union;
export const intersection = ArrayUtils.intersection;
export const difference = ArrayUtils.difference;
export const groupBy = ArrayUtils.groupBy;
export const partition = ArrayUtils.partition;
export const sortBy = ArrayUtils.sortBy;
export const keyBy = ArrayUtils.keyBy;
export const times = ArrayUtils.times;
export const randomChoice = ArrayUtils.randomChoice;
export const ensureArray = ArrayUtils.ensureArray;
export const countBy = ArrayUtils.countBy;
// ── Object helpers ─────────────────────────────────────────────
export const deepClone = ObjectUtils.deepClone;
export const clone = ObjectUtils.clone;
export const deepEqual = ObjectUtils.deepEqual;
export const pick = ObjectUtils.pick;
export const omit = ObjectUtils.omit;
export const defaults = ObjectUtils.defaults;
export const merge = ObjectUtils.merge;
export const invert = ObjectUtils.invert;
export const mapValues = ObjectUtils.mapValues;
export const mapKeys = ObjectUtils.mapKeys;
export const has = ObjectUtils.has;
export const get = ObjectUtils.get;
export const set = ObjectUtils.set;
export const zipObject = ObjectUtils.zipObject;
export const identity = ObjectUtils.identity;
export const constant = ObjectUtils.constant;
export const at = ObjectUtils.at;
export const unset = ObjectUtils.unset;
export const defaultsDeep = ObjectUtils.defaultsDeep;
// ── URL helpers ──────────────────────────────────────────────────
export const apiBaseUrl = UrlUtils.apiBaseUrl;
export const apiUrl = UrlUtils.apiUrl;
export const fetchWithTimeout = UrlUtils.fetchWithTimeout;
export const parseQueryString = UrlUtils.parseQueryString;
export const stringifyQueryString = UrlUtils.stringifyQueryString;
export const getQueryParam = UrlUtils.getQueryParam;
export const setQueryParam = UrlUtils.setQueryParam;
export const buildUrl = UrlUtils.buildUrl;
export const isValidUrl = UrlUtils.isValidUrl;
export const isUrl = UrlUtils.isUrl;
// ── Storage helpers ────────────────────────────────────────────
export const localStorageGet = StorageUtils.localStorageGet;
export const localStorageSet = StorageUtils.localStorageSet;
export const localStorageRemove = StorageUtils.localStorageRemove;
export const localStorageGetString = StorageUtils.localStorageGetString;
export const localStorageSetString = StorageUtils.localStorageSetString;
export const sessionStorageGet = StorageUtils.sessionStorageGet;
export const sessionStorageSet = StorageUtils.sessionStorageSet;
export const sessionStorageRemove = StorageUtils.sessionStorageRemove;
// ── Theme helpers ────────────────────────────────────────────────
export const hexToRgba = ThemeUtils.hexToRgba;
export const shadeColor = ThemeUtils.shadeColor;
export const contrastColor = ThemeUtils.contrastColor;
export const getCssVar = ThemeUtils.getCssVar;
export const setCssVar = ThemeUtils.setCssVar;
export const prefersReducedMotion = ThemeUtils.prefersReducedMotion;
export const prefersDarkMode = ThemeUtils.prefersDarkMode;
// ── DOM helpers ──────────────────────────────────────────────────
export const showToast = DomUtils.showToast;
export const removeToastContainer = DomUtils.removeToastContainer;
export const downloadFile = DomUtils.downloadFile;
export const downloadJson = DomUtils.downloadJson;
export const downloadBlob = DomUtils.downloadBlob;
export const downloadText = DomUtils.downloadText;
export const downloadCsv = DomUtils.downloadCsv;
export const hasClass = DomUtils.hasClass;
export const addClass = DomUtils.addClass;
export const removeClass = DomUtils.removeClass;
export const toggleClass = DomUtils.toggleClass;
export const getFocusableElements = DomUtils.getFocusableElements;
export const focusFirst = DomUtils.focusFirst;
export const createElement = DomUtils.createElement;
export const removeAllChildren = DomUtils.removeAllChildren;
export const scrollToElement = DomUtils.scrollToElement;
export const elementInViewport = DomUtils.elementInViewport;
export const observeIntersection = DomUtils.observeIntersection;
export const preloadImage = DomUtils.preloadImage;
export const copyToClipboard = DomUtils.copyToClipboard;
export const renderEmptyState = DomUtils.renderEmptyState;
export const setHtml = DomUtils.setHtml;
// ── Format helpers ─────────────────────────────────────────────
export const formatDate = FormatUtils.formatDate;
export const relativeTime = FormatUtils.relativeTime;
export const redactPathForDisplay = FormatUtils.redactPathForDisplay;
export const isRedactedPathDisplay = FormatUtils.isRedactedPathDisplay;
export const formatPathInputValue = FormatUtils.formatPathInputValue;
export const formatScanPathForDisplay = FormatUtils.formatScanPathForDisplay;
export const formatPathLabel = FormatUtils.formatPathLabel;
export const formatAiSummarySkipMessage =
  FormatUtils.formatAiSummarySkipMessage;
export const sanitizePrivacyData = FormatUtils.sanitizePrivacyData;
// ── Type guards ─────────────────────────────────────────────────
export const isBlank = TypeUtils.isBlank;
export const isEmail = TypeUtils.isEmail;
export const isNumeric = TypeUtils.isNumeric;
export const isInteger = TypeUtils.isInteger;
export const isHexColor = TypeUtils.isHexColor;
export const isEmpty = TypeUtils.isEmpty;
export const isDefined = TypeUtils.isDefined;
export const noop = TypeUtils.noop;
export const assertNever = TypeUtils.assertNever;
export const parseJsonSafe = TypeUtils.parseJsonSafe;
export const parseResponseJson = TypeUtils.parseResponseJson;
export const isOnline = TypeUtils.isOnline;
export const isVSCodeWebview = TypeUtils.isVSCodeWebview;
export const isStandalone = TypeUtils.isStandalone;
export const getVSCodeApi = TypeUtils.getVSCodeApi;
export const getNonce = TypeUtils.getNonce;
export const isNull = TypeUtils.isNull;
export const isUndefined = TypeUtils.isUndefined;
export const isNil = TypeUtils.isNil;
export const isSymbol = TypeUtils.isSymbol;
export const isMap = TypeUtils.isMap;
export const isSet = TypeUtils.isSet;
// ── Function helpers (additional) ────────────────────────────
export const compose = FunctionUtils.compose;
export const pipe = FunctionUtils.pipe;
export const zipWith = FunctionUtils.zipWith;
export const curry = FunctionUtils.curry;
export const partial = FunctionUtils.partial;
export const tap = FunctionUtils.tap;
export const deepFreeze = FunctionUtils.deepFreeze;
// ── Inline utilities (API parity with js-es2018/utils.js) ───────
export function tryCatch(fn, handler) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      return handler(e);
    }
  };
}
export function defaultTo(defaultValue, value) {
  return value == null || (typeof value === "number" && Number.isNaN(value))
    ? defaultValue
    : value;
}
export function prop(key, obj) {
  if (obj == null) return undefined;
  if (
    typeof key !== "string" &&
    typeof key !== "number" &&
    typeof key !== "symbol"
  )
    return undefined;
  return obj[key];
}
export function getPath(keys, obj) {
  if (keys == null) return undefined;
  const keyList = Array.isArray(keys) ? keys : String(keys).split(".");
  let val = obj;
  for (const k of keyList) {
    if (val == null) return undefined;
    val = val[k];
  }
  return val;
}
export function pathOr(defaultValue, keys, obj) {
  const result = getPath(keys, obj);
  return result === undefined ? defaultValue : result;
}
export function when(pred, fn, value) {
  if (typeof pred !== "function" || typeof fn !== "function") return value;
  return pred(value) ? fn(value) : value;
}
export function unless(pred, fn, value) {
  if (typeof pred !== "function" || typeof fn !== "function") return value;
  return pred(value) ? value : fn(value);
}
export function ifElse(pred, onTrue, onFalse, value) {
  if (
    typeof pred !== "function" ||
    typeof onTrue !== "function" ||
    typeof onFalse !== "function"
  )
    return value;
  return pred(value) ? onTrue(value) : onFalse(value);
}
export function cond(pairs) {
  if (!Array.isArray(pairs)) return () => undefined;
  return (value) => {
    for (const [p, fn] of pairs) {
      if (typeof p !== "function" || typeof fn !== "function") continue;
      if (p(value)) return fn(value);
    }
    return undefined;
  };
}
export function allPass(preds) {
  if (!Array.isArray(preds)) return () => false;
  return (value) => preds.every((p) => typeof p === "function" && p(value));
}
export function anyPass(preds) {
  if (!Array.isArray(preds)) return () => false;
  return (value) => preds.some((p) => typeof p === "function" && p(value));
}
export function complement(pred) {
  if (typeof pred !== "function") return () => true;
  return (...args) => !pred(...args);
}
export function always(value) {
  return () => value;
}
export function T() {
  return () => true;
}
export function F() {
  return () => false;
}
export function flip(fn) {
  return (b, a) => fn(a, b);
}
export function head(list) {
  if (list == null || typeof list.length !== "number") return undefined;
  return list[0];
}
export function tail(list) {
  if (list == null || typeof list.length !== "number") return [];
  return Array.prototype.slice.call(list, 1);
}
export function last(list) {
  if (list == null || typeof list.length !== "number") return undefined;
  return list[list.length - 1];
}
export function init(list) {
  if (list == null || typeof list.length !== "number") return [];
  return Array.prototype.slice.call(list, 0, -1);
}
export function take(n, list) {
  if (list == null || typeof list.length !== "number") return [];
  return typeof list === "string"
    ? list.slice(0, n)
    : Array.prototype.slice.call(list, 0, n);
}
export function drop(n, list) {
  if (list == null || typeof list.length !== "number") return [];
  return typeof list === "string"
    ? list.slice(n)
    : Array.prototype.slice.call(list, n);
}
export function takeLast(n, list) {
  if (list == null || typeof list.length !== "number") return [];
  return typeof list === "string"
    ? list.slice(-n)
    : Array.prototype.slice.call(list, -n);
}
export function dropLast(n, list) {
  if (list == null || typeof list.length !== "number") return [];
  return typeof list === "string"
    ? list.slice(0, -n)
    : Array.prototype.slice.call(list, 0, -n);
}
export function pluck(key, list) {
  if (list == null || typeof list.length !== "number") return [];
  return Array.prototype.map.call(list, (obj) =>
    obj == null ? undefined : obj[key],
  );
}
export function find(pred, list) {
  if (typeof pred !== "function") return undefined;
  if (list == null || typeof list.length !== "number") return undefined;
  return Array.prototype.find.call(list, pred);
}
export function findIndex(pred, list) {
  if (typeof pred !== "function") return -1;
  if (list == null || typeof list.length !== "number") return -1;
  return Array.prototype.findIndex.call(list, pred);
}
export function propEq(key, val, obj) {
  if (obj == null || typeof obj !== "object") return false;
  return obj[key] === val;
}
export function pathEq(keys, val, obj) {
  return getPath(keys, obj) === val;
}
export function contains(value, list) {
  if (list == null || typeof list.length !== "number") return false;
  return Array.prototype.indexOf.call(list, value) >= 0;
}
export function isPlainObject(value) {
  return (
    value != null && Object.prototype.toString.call(value) === "[object Object]"
  );
}
export function isElement(value) {
  return (
    value != null &&
    typeof value === "object" &&
    typeof value.nodeType === "number" &&
    value.nodeType === 1
  );
}
export function isPromise(value) {
  return (
    value != null &&
    (value instanceof Promise ||
      Object.prototype.toString.call(value) === "[object Promise]")
  );
}
export function isFormData(value) {
  return (
    value != null &&
    Object.prototype.toString.call(value) === "[object FormData]"
  );
}
export function isBlob(value) {
  return (
    value != null && Object.prototype.toString.call(value) === "[object Blob]"
  );
}
export function isFile(value) {
  return (
    value != null && Object.prototype.toString.call(value) === "[object File]"
  );
}
export function isArrayLike(value) {
  return value != null && typeof value.length === "number" && value.length >= 0;
}
export function evolve(transformations, obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (transformations == null || typeof transformations !== "object")
    return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    const fn = transformations[key];
    result[key] = typeof fn === "function" ? fn(obj[key]) : obj[key];
  }
  return result;
}
export function dissoc(key, obj) {
  if (obj == null || typeof obj !== "object") return {};
  const result = {};
  for (const k of Object.keys(obj)) {
    if (k !== key) result[k] = obj[k];
  }
  return result;
}
export function mergeDeepLeft(a, b) {
  if (a == null || typeof a !== "object") return b;
  if (b == null || typeof b !== "object") return a;
  if (Array.isArray(a) || Array.isArray(b)) return a;
  const result = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (
      k in a &&
      k in b &&
      a[k] != null &&
      typeof a[k] === "object" &&
      b[k] != null &&
      typeof b[k] === "object"
    ) {
      result[k] = mergeDeepLeft(a[k], b[k]);
    } else {
      result[k] = k in a ? a[k] : b[k];
    }
  }
  return result;
}
export function mergeDeepRight(a, b) {
  if (a == null || typeof a !== "object") return b;
  if (b == null || typeof b !== "object") return a;
  if (Array.isArray(a) || Array.isArray(b)) return b;
  const result = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (
      k in a &&
      k in b &&
      a[k] != null &&
      typeof a[k] === "object" &&
      b[k] != null &&
      typeof b[k] === "object"
    ) {
      result[k] = mergeDeepRight(a[k], b[k]);
    } else {
      result[k] = k in b ? b[k] : a[k];
    }
  }
  return result;
}
export function project(keys, list) {
  if (!Array.isArray(keys)) return [];
  if (list == null || typeof list.length !== "number") return [];
  return Array.prototype.map.call(list, (obj) => {
    const result = {};
    for (const k of keys) {
      if (k in obj) result[k] = obj[k];
    }
    return result;
  });
}
export function memoizeBy(fn, keyFn) {
  if (typeof fn !== "function" || typeof keyFn !== "function") return fn;
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
// ── Event helpers ──────────────────────────────────────────────
export const createEventBus = EventUtils.createEventBus;
export const createBroadcastChannel = EventUtils.createBroadcastChannel;
// ── Polling helpers ────────────────────────────────────────────
export const createPoller = PollingUtils.createPoller;
// Build flat exports dynamically from imported namespaces to avoid manual maintenance
const _nsMap = {
  string: StringUtils,
  number: NumberUtils,
  async: AsyncUtils,
  array: ArrayUtils,
  object: ObjectUtils,
  url: UrlUtils,
  storage: StorageUtils,
  theme: ThemeUtils,
  dom: DomUtils,
  format: FormatUtils,
  type: TypeUtils,
  accessibility: AccessibilityUtils,
  clipboard: ClipboardUtils,
  crypto: CryptoUtils,
  download: DownloadUtils,
  fetch: FetchUtils,
  fn: FunctionUtils,
  path: PathUtils,
  privacy: PrivacyUtils,
  vscode: VSCodeUtils,
  event: EventUtils,
  polling: PollingUtils,
};
let _flatExportsCache = null;
function _buildFlatExports() {
  if (_flatExportsCache) return _flatExportsCache;
  const exports = {};
  const seen = new Set();
  const hasOwn = Object.prototype.hasOwnProperty;
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    for (const key of Object.keys(ns)) {
      if (!hasOwn.call(ns, key)) continue;
      if (seen.has(key)) {
        // Collision: the inline namespace will override same-named sub-module exports below.
        continue;
      }
      seen.add(key);
      exports[key] = ns[key];
    }
  }
  // Inline namespace helpers (these override any same-named function-namespace exports)
  const inlineKeys = Object.keys(inlineNamespace);
  for (const key of inlineKeys) {
    if (hasOwn.call(inlineNamespace, key)) {
      exports[key] = inlineNamespace[key];
    }
  }
  _flatExportsCache = Object.freeze(exports);
  return _flatExportsCache;
}
// ── Collision detection ──────────────────────────────────────
function _checkExportCollisions() {
  // Collision detection is kept as a no-op: the inline namespace intentionally overrides
  // same-named sub-module exports. Warnings are disabled to avoid noisy test/runtime output.
}
let _collisionsChecked = false;
let _exportNamesCache = null;
function _getExportNames() {
  if (!_exportNamesCache) {
    _exportNamesCache = Object.freeze([
      ...new Set(
        Object.keys(_buildFlatExports()).concat(
          "getExportNames",
          "exportNames",
          "getNamespaceNames",
          "getBarrelMeta",
          "validateBarrelIntegrity",
          "__barrel__",
          "default",
        ),
      ),
    ]);
  }
  if (!_collisionsChecked) {
    _collisionsChecked = true;
    _checkExportCollisions();
  }
  return _exportNamesCache;
}
/**
 * @returns {ReadonlyArray<string>} All flat named export keys from this barrel.
 */
export function getExportNames() {
  return _getExportNames();
}
/**
 * Shorter alias for {@link getExportNames}.
 * @returns {ReadonlyArray<string>}
 */
export const exportNames = getExportNames;
/**
 * @returns {BarrelMeta} Frozen barrel metadata object.
 */
export function getBarrelMeta() {
  return __barrel__;
}
/**
 * @returns {ReadonlyArray<string>} All namespace keys from this barrel.
 */
export function getNamespaceNames() {
  return Object.freeze(Object.keys(_nsMap).concat("inline"));
}
/**
 * Recursively freeze a plain object and its nested objects.
 * Safely handles Date, RegExp, Map, Set, WeakMap, WeakSet, Promise, and Error.
 * @param {Object} obj
 * @returns {Object}
 */
export function freezeNamespace(obj, _seen = new WeakSet()) {
  if (obj == null || typeof obj !== "object") return obj;
  if (_seen.has(obj)) return obj;
  if (Object.isFrozen(obj)) return obj;
  const ctor = obj.constructor;
  if (
    ctor === Date ||
    ctor === RegExp ||
    ctor === WeakMap ||
    ctor === WeakSet ||
    ctor === Promise ||
    ctor === Error
  )
    return obj;
  _seen.add(obj);
  if (ctor === Map) {
    const frozenMap = new Map();
    for (const [k, v] of obj) frozenMap.set(k, freezeNamespace(v, _seen));
    try {
      Object.freeze(frozenMap);
    } catch (/* some engines can't freeze Maps */ _a) {
      console.error("utils.js error:", _a); /* some engines can't freeze Maps */
    }
    return frozenMap;
  }
  if (ctor === Set) {
    const frozenSet = new Set();
    for (const v of obj) frozenSet.add(freezeNamespace(v, _seen));
    try {
      Object.freeze(frozenSet);
    } catch (/* some engines can't freeze Sets */ _b) {
      console.error("utils.js error:", _b); /* some engines can't freeze Sets */
    }
    return frozenSet;
  }
  if (Array.isArray(obj)) {
    const frozenArr = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      frozenArr[i] = freezeNamespace(obj[i], _seen);
    }
    try {
      Object.freeze(frozenArr);
    } catch (/* arrays are freezeable in standard engines */ _c) {
      console.error(
        "utils.js error:",
        _c,
      ); /* arrays are freezeable in standard engines */
    }
    return frozenArr;
  }
  const frozenObj = Object.create(
    Object.getPrototypeOf(obj) || Object.prototype,
  );
  for (const key of Object.keys(obj)) {
    frozenObj[key] = freezeNamespace(obj[key], _seen);
  }
  try {
    Object.freeze(frozenObj);
  } catch (_d) {
    return obj;
  }
  return frozenObj;
}
/** Safely stringify a value, returning a fallback on circular references or errors. */
export const stringifySafe = (obj, fallback = null) => {
  try {
    return JSON.stringify(obj);
  } catch (_) {
    return fallback;
  }
};
const inlineNamespace = Object.freeze({
  compose,
  pipe,
  zipWith,
  curry,
  partial,
  tap,
  deepFreeze,
  freezeNamespace,
  tryCatch,
  defaultTo,
  prop,
  getPath,
  pathOr,
  when,
  unless,
  ifElse,
  cond,
  allPass,
  anyPass,
  complement,
  always,
  T,
  F,
  flip,
  head,
  tail,
  last,
  init,
  take,
  drop,
  takeLast,
  dropLast,
  pluck,
  find,
  findIndex,
  propEq,
  pathEq,
  contains,
  isPlainObject,
  isElement,
  isPromise,
  isFormData,
  isBlob,
  isFile,
  isArrayLike,
  evolve,
  dissoc,
  mergeDeepLeft,
  mergeDeepRight,
  project,
  memoizeBy,
  groupBy,
  partition,
  chunk,
  deepClone,
  deepEqual,
  pick,
  omit,
  clamp,
  formatBytes,
  formatNumber,
  escapeHtml,
  truncate,
  capitalize,
  sleep,
  debounce,
  throttle,
  retry,
  isDefined,
  parseJsonSafe,
  parseResponseJson,
  stringifySafe,
});
const BARREL_REQUIRED_KEYS = Object.freeze([
  "name",
  "description",
  "moduleCount",
  "exportCount",
  "namespaceCount",
  "version",
  "timestamp",
  "exports",
  "namespaces",
]);
export function validateBarrelIntegrity() {
  const errors = [];
  const nsKeys = getNamespaceNames();
  for (const key of nsKeys) {
    if (!defaultExport[key] || typeof defaultExport[key] !== "object") {
      errors.push(`Namespace "${key}" is missing or not an object`);
    } else if (!Object.isFrozen(defaultExport[key])) {
      errors.push(`Namespace "${key}" is not frozen`);
    }
  }
  if (!Object.isFrozen(defaultExport)) {
    errors.push("Default export is not frozen");
  }
  if (!Object.isFrozen(__barrel__)) {
    errors.push("__barrel__ metadata is not frozen");
  }
  if (!defaultExport.__barrel__) {
    errors.push("Missing __barrel__ metadata");
  } else {
    for (const metaKey of BARREL_REQUIRED_KEYS) {
      if (!(metaKey in defaultExport.__barrel__)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
  }
  const flat = _buildFlatExports();
  for (const name of getExportNames()) {
    if (name === "default") continue;
    if (!(name in flat) && !(name in defaultExport)) {
      errors.push(
        `Export "${name}" missing from flat exports and default export`,
      );
    }
  }
  for (const key of Object.keys(flat)) {
    if (typeof flat[key] !== "function" && typeof flat[key] !== "object") {
      errors.push(`Export "${key}" has unsupported type: ${typeof flat[key]}`);
    }
  }
  const inlineKeys = Object.keys(inlineNamespace);
  for (const key of inlineKeys) {
    if (
      typeof inlineNamespace[key] !== "function" &&
      typeof inlineNamespace[key] !== "object"
    ) {
      errors.push(
        `Inline utility "${key}" has unsupported type: ${typeof inlineNamespace[key]}`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}
/** Frozen barrel metadata for runtime introspection. */
export const __barrel__ = Object.freeze({
  name: "simplebeacon-dashboard-utils",
  description: "Barrel re-export for js/utils-lib/ sub-modules",
  get moduleCount() {
    return getNamespaceNames().length;
  },
  get exportCount() {
    return getExportNames().length;
  },
  get namespaceCount() {
    return getNamespaceNames().length;
  },
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  get exports() {
    return getExportNames();
  },
  get namespaces() {
    return getNamespaceNames();
  },
});
const defaultExport = freezeNamespace({
  string: StringUtils,
  number: NumberUtils,
  async: AsyncUtils,
  array: ArrayUtils,
  object: ObjectUtils,
  url: UrlUtils,
  storage: StorageUtils,
  theme: ThemeUtils,
  dom: DomUtils,
  format: FormatUtils,
  type: TypeUtils,
  accessibility: AccessibilityUtils,
  clipboard: ClipboardUtils,
  crypto: CryptoUtils,
  download: DownloadUtils,
  fetch: FetchUtils,
  fn: FunctionUtils,
  path: PathUtils,
  privacy: PrivacyUtils,
  vscode: VSCodeUtils,
  event: EventUtils,
  polling: PollingUtils,
  inline: inlineNamespace,
  getExportNames,
  exportNames,
  getNamespaceNames,
  getBarrelMeta,
  validateBarrelIntegrity,
  freezeNamespace,
  stringifySafe,
  __barrel__,
});
export default defaultExport;
