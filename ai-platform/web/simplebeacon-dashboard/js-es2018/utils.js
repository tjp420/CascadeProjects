'use strict';
/**
 * @module utils
 * Barrel re-export for the `js/utils-lib/` directory.
 * Named exports are tree-shakeable; default export provides frozen namespaces.
 */

// ── Import every submodule once as a namespace ────────────────
import * as string      from './utils-lib/string.js';
import * as number      from './utils-lib/number.js';
import * as async       from './utils-lib/async.js';
import * as array       from './utils-lib/array.js';
import * as object      from './utils-lib/object.js';
import * as url         from './utils-lib/url.js';
import * as storage     from './utils-lib/storage.js';
import * as theme       from './utils-lib/theme.js';
import * as dom         from './utils-lib/dom.js';
import * as format      from './utils-lib/format.js';
import * as type        from './utils-lib/type.js';
import * as fetch       from './utils-lib/fetch.js';
import * as function_   from './utils-lib/function.js';
import * as accessibility from './utils-lib/accessibility.js';
import * as clipboard   from './utils-lib/clipboard.js';
import * as crypto      from './utils-lib/crypto.js';
import * as download    from './utils-lib/download.js';
import * as path        from './utils-lib/path.js';
import * as privacy     from './utils-lib/privacy.js';
import * as vscode      from './utils-lib/vscode.js';
import * as event       from './utils-lib/event.js';
import * as polling     from './utils-lib/polling.js';

// ── Dashboard API base ─────────────────────────────────────────────
/**
 * Resolve the dashboard backend API base URL from localStorage or default to same-origin.
 * Useful when the static dashboard is served from a different host/port than the API server.
 * @returns {string}
 */
export function dashboardApiBase() {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('sb_api_host');
        if (stored) return stored;
    }
    return '';
}

// ── String helpers ───────────────────────────────────────────────
/** @param {string} str @returns {string} */
export const escapeHtml       = string.escapeHtml;
/** @param {string} str @returns {string} */
export const escapeRegExp     = string.escapeRegExp;
/** @param {string} str @returns {string} */
export const normalizeSlashes = string.normalizeSlashes;
/**
 * Truncate a string to a maximum length with an optional suffix.
 * @param {string} str
 * @param {number} maxLength
 * @param {string} [suffix='…']
 * @returns {string}
 */
export const truncate         = string.truncate;
/**
 * Capitalize the first character of a string.
 * @param {string} str
 * @returns {string}
 */
export const capitalize       = string.capitalize;
/** @param {string} str @returns {number} */
export const hash             = string.hash;
/** @param {string} str @returns {string} */
export const kebabCase        = string.kebabCase;
/** @param {string} str @returns {string} */
export const camelCase        = string.camelCase;
/** @param {string} str @returns {string} */
export const snakeCase        = string.snakeCase;
/** @param {string} str @param {number} length @returns {string} */
export const padStart         = string.padStart;
/** @param {string} str @param {number} length @returns {string} */
export const padEnd           = string.padEnd;
/** @param {string} str @returns {string} */
export const stripHtml        = string.stripHtml;
/** @param {string} word @param {number} count @returns {string} */
export const pluralize        = string.pluralize;

// ── Number helpers ─────────────────────────────────────────────
/** @param {number} n @returns {string} */
export const formatNumber  = number.formatNumber;
export const formatPercent = number.formatPercent;
/**
 * Format a byte count as human-readable (e.g. 1.5 KB).
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes   = number.formatBytes;
/**
 * Clamp a number between a minimum and maximum inclusive.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clamp         = number.clamp;
/** @param {number} num @param {number} precision @returns {number} */
export const roundTo       = number.roundTo;
/** @param {number} num @param {number} decimals @returns {number} */
export const toFixedNumber = number.toFixedNumber;
/** @param {number} ms @returns {string} */
export const formatDuration = number.formatDuration;
/** @param {number[]} nums @returns {number} */
export const sum           = number.sum;
/** @param {number[]} nums @returns {number} */
export const mean          = number.mean;
/** @param {Array} arr @param {Function|string} iteratee @returns {any} */
export const maxBy         = number.maxBy;
/** @param {Array} arr @param {Function|string} iteratee @returns {any} */
export const minBy         = number.minBy;
/** @param {string} str @param {number} [radix=10] @returns {number|null} */
export const safeParseInt  = number.safeParseInt;
/** @param {string} str @returns {number|null} */
export const safeParseFloat = number.safeParseFloat;
/** @param {number} min @param {number} max @returns {number} */
export const random        = number.random;
/** @returns {string} */
export const randomId      = number.randomId;
/** @returns {string} */
export const uid           = number.uid;

// ── Async helpers ──────────────────────────────────────────────
/** @param {number} ms @returns {Promise<void>} */
export const sleep          = async.sleep;
export const delay          = async.delay;
/**
 * Debounce a function so it fires only after `wait` ms of inactivity.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export const debounce       = async.debounce;
export const debounceAsync  = async.debounceAsync;
export const debounceLeading = async.debounceLeading;
/**
 * Throttle a function so it fires at most once per `limit` ms.
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export const throttle      = async.throttle;
/** @param {Function} fn @param {number} limit @returns {Function} */
export const throttleAsync = async.throttleAsync;
/** @param {Function} fn @returns {Function} */
export const once           = async.once;
/** @param {Function} fn @returns {Function} */
export const memoize        = async.memoize;
/** @param {Function} fn @returns {Function} */
export const memoizeAsync   = async.memoizeAsync;
/** @param {Function} fn @param {number} ms @returns {Function} */
export const withTimeout    = async.withTimeout;
/** @param {Function} fn @returns {Function} */
export const tryFn          = async.tryFn;
/** @param {Function[]} fns @returns {Function} */
export const seq            = async.seq;
/** @param {Function[]} fns @returns {Function} */
export const flow           = async.flow;
/** @param {Function} fn @returns {Function} */
export const negate         = async.negate;

// ── Array helpers ────────────────────────────────────────────────
/** @template T @param {T[]} arr @returns {T[]} */
export const unique        = array.unique;
export const compact       = array.compact;
/**
 * Recursively flatten an array of arrays into a single flat array.
 * @param {Array} arr
 * @returns {Array}
 */
export const flatten       = array.flatten;
export const range         = array.range;
export const chunk         = array.chunk;
export const sample        = array.sample;
export const shuffle       = array.shuffle;
export const reverse       = array.reverse;
export const union         = array.union;
export const intersection  = array.intersection;
export const difference    = array.difference;
/**
 * Group array items by the result of an iteratee function.
 * @param {Array} arr
 * @param {Function|string} iteratee
 * @returns {Object<string, Array>}
 */
export const groupBy       = array.groupBy;
export const partition     = array.partition;
export const sortBy        = array.sortBy;
export const keyBy         = array.keyBy;
export const times         = array.times;
export const randomChoice  = array.randomChoice;
export const ensureArray   = array.ensureArray;
export const countBy       = array.countBy;

// ── Object helpers ─────────────────────────────────────────────
/**
 * Deep-clone a plain object, array, Date, RegExp, Map, or Set.
 * @param {any} obj
 * @returns {any}
 */
export const deepClone   = object.deepClone;
export const clone       = object.clone;
/**
 * Recursively compare two values for deep equality.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export const deepEqual   = object.deepEqual;
/**
 * Return a shallow clone of `obj` containing only the specified `keys`.
 * @param {string[]} keys
 * @param {object} obj
 * @returns {object}
 */
export const pick        = object.pick;
/**
 * Return a shallow clone of `obj` excluding the specified `keys`.
 * @param {string[]} keys
 * @param {object} obj
 * @returns {object}
 */
export const omit        = object.omit;
export const defaults    = object.defaults;
/**
 * Deep-merge two objects. Nested objects are recursively merged.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
export const merge       = object.merge;
export const invert      = object.invert;
export const mapValues   = object.mapValues;
export const mapKeys     = object.mapKeys;
export const has         = object.has;
export const get         = object.get;
export const set         = object.set;
export const zipObject   = object.zipObject;
export const identity    = object.identity;
export const constant    = object.constant;
export const at          = object.at;
export const unset       = object.unset;
export const defaultsDeep = object.defaultsDeep;

// ── URL helpers ──────────────────────────────────────────────────
export const apiBaseUrl        = url.apiBaseUrl;
export const apiUrl            = url.apiUrl;
export const fetchWithTimeout  = url.fetchWithTimeout;
export const parseQueryString  = url.parseQueryString;
export const stringifyQueryString = url.stringifyQueryString;
export const getQueryParam     = url.getQueryParam;
export const setQueryParam     = url.setQueryParam;
export const buildUrl          = url.buildUrl;
export const isValidUrl        = url.isValidUrl;
export const isUrl             = url.isUrl;

// ── Storage helpers ────────────────────────────────────────────
export const localStorageGet       = storage.localStorageGet;
export const localStorageSet       = storage.localStorageSet;
export const localStorageRemove    = storage.localStorageRemove;
export const localStorageGetString = storage.localStorageGetString;
export const localStorageSetString = storage.localStorageSetString;
export const sessionStorageGet     = storage.sessionStorageGet;
export const sessionStorageSet     = storage.sessionStorageSet;
export const sessionStorageRemove  = storage.sessionStorageRemove;

// ── Theme helpers ────────────────────────────────────────────────
export const hexToRgba           = theme.hexToRgba;
export const shadeColor          = theme.shadeColor;
export const contrastColor       = theme.contrastColor;
export const getCssVar           = theme.getCssVar;
export const setCssVar           = theme.setCssVar;
export const prefersReducedMotion = theme.prefersReducedMotion;
export const prefersDarkMode     = theme.prefersDarkMode;

// ── DOM helpers ──────────────────────────────────────────────────
/**
 * Display a temporary toast notification.
 * @param {string} message
 * @param {string} [type='info']
 * @param {number} [duration=3000]
 */
export const showToast           = dom.showToast;
export const removeToastContainer = dom.removeToastContainer;
export const downloadFile        = dom.downloadFile;
export const downloadJson        = dom.downloadJson;
export const downloadBlob        = dom.downloadBlob;
export const downloadText        = dom.downloadText;
export const downloadCsv         = dom.downloadCsv;
export const hasClass            = dom.hasClass;
export const addClass            = dom.addClass;
export const removeClass         = dom.removeClass;
export const toggleClass         = dom.toggleClass;
export const getFocusableElements = dom.getFocusableElements;
export const focusFirst          = dom.focusFirst;
export const createElement       = dom.createElement;
export const removeAllChildren   = dom.removeAllChildren;
export const scrollToElement     = dom.scrollToElement;
export const elementInViewport   = dom.elementInViewport;
export const observeIntersection = dom.observeIntersection;
export const preloadImage        = dom.preloadImage;
export const copyToClipboard     = dom.copyToClipboard;
export const renderEmptyState    = dom.renderEmptyState;

// ── Format helpers ─────────────────────────────────────────────
/**
 * Format a Date or timestamp into a locale-aware string.
 * @param {Date|number|string} value
 * @param {object} [options]
 * @returns {string}
 */
export const formatDate                = format.formatDate;
/**
 * Return a human-readable relative time string (e.g. "2 hours ago").
 * @param {Date|number|string} date
 * @returns {string}
 */
export const relativeTime              = format.relativeTime;
export const redactPathForDisplay      = format.redactPathForDisplay;
export const isRedactedPathDisplay     = format.isRedactedPathDisplay;
export const formatPathInputValue      = format.formatPathInputValue;
export const formatScanPathForDisplay  = format.formatScanPathForDisplay;
export const formatPathLabel           = format.formatPathLabel;
export const formatAiSummarySkipMessage = format.formatAiSummarySkipMessage;
export const sanitizePrivacyData       = format.sanitizePrivacyData;

// ── Type guards ─────────────────────────────────────────────────
/**
 * Check if a value is blank: null, undefined, empty string, empty array, or empty object.
 * @param {any} value
 * @returns {boolean}
 */
export const isBlank        = type.isBlank;
export const isEmail        = type.isEmail;
export const isNumeric      = type.isNumeric;
export const isInteger      = type.isInteger;
export const isHexColor     = type.isHexColor;
/**
 * Check if a value is empty: empty string, empty array, empty object, zero, or false.
 * @param {any} value
 * @returns {boolean}
 */
export const isEmpty        = type.isEmpty;
/**
 * Check if a value is neither `null` nor `undefined`.
 * @param {any} value
 * @returns {boolean}
 */
export const isDefined      = type.isDefined;
export const noop           = type.noop;
export const assertNever    = type.assertNever;
export const parseJsonSafe     = type.parseJsonSafe;
export const parseResponseJson = type.parseResponseJson;
export const isOnline          = type.isOnline;
export const isVSCodeWebview   = type.isVSCodeWebview;
export const isStandalone      = type.isStandalone;
export const getVSCodeApi      = type.getVSCodeApi;
export const getNonce          = type.getNonce;
export const isNull            = type.isNull;
export const isUndefined       = type.isUndefined;
export const isNil             = type.isNil;
export const isSymbol          = type.isSymbol;
export const isMap             = type.isMap;
export const isSet             = type.isSet;

// ── Event helpers ──────────────────────────────────────────────
export const createEventBus         = event.createEventBus;
export const createBroadcastChannel = event.createBroadcastChannel;

// ── Polling helpers ────────────────────────────────────────────
export const createPoller = polling.createPoller;

/**
 * Compose functions right-to-left.
 * `compose(f, g, h)(x)` is equivalent to `f(g(h(x)))`.
 * Returns identity when called with no arguments.
 * @param {...Function} fns
 * @returns {Function}
 */
export function compose(...fns) {
  return fns.length === 0
    ? (value) => value
    : (value) => fns.reduceRight((acc, fn) => fn(acc), value);
}

/**
 * Pipe functions left-to-right.
 * `pipe(f, g, h)(x)` is equivalent to `h(g(f(x)))`.
 * Returns identity when called with no arguments.
 * @param {...Function} fns
 * @returns {Function}
 */
export function pipe(...fns) {
  return fns.length === 0
    ? (value) => value
    : (value) => fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * Zip two arrays with a custom combiner function.
 * @param {Array} arr1
 * @param {Array} arr2
 * @param {Function} fn
 * @returns {Array}
 */
export function zipWith(arr1, arr2, fn) {
  if (!arr1 || typeof arr1.length !== 'number' || !arr2 || typeof arr2.length !== 'number') {
    return [];
  }
  const len = Math.min(arr1.length, arr2.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = fn(arr1[i], arr2[i]);
  }
  return result;
}

/**
 * Curry a function so it can be called with one argument at a time.
 * @param {Function} fn
 * @returns {Function}
 */
export function curry(fn) {
  const curried = (...args) =>
    args.length >= fn.length ? fn(...args) : (...nextArgs) => curried(...args.concat(nextArgs));
  return curried;
}

/**
 * Create a partial application of a function with preset arguments.
 * @param {Function} fn
 * @param {...any} presetArgs
 * @returns {Function}
 */
export function partial(fn, ...presetArgs) {
  return (...args) => fn(...presetArgs.concat(args));
}

/**
 * Execute a side-effect function on a value, then return the value.
 * @param {any} value
 * @param {Function} fn
 * @returns {any}
 */
export function tap(value, fn) {
  fn(value);
  return value;
}

/**
 * Flip the first two arguments of a binary function.
 * `flip(fn)(a, b)` is equivalent to `fn(b, a)`.
 * @param {Function} fn
 * @returns {Function}
 */
export function flip(fn) {
  return (b, a) => fn(a, b);
}

// ── New inline utility functions ─────────────────────────────────

/**
 * Safely execute a function; on throw, return the handler's result.
 * @param {Function} fn
 * @param {Function} handler
 * @returns {Function}
 */
export function tryCatch(fn, handler) {
  return (...args) => { try { return fn(...args); } catch (e) { return handler(e); } };
}

/**
 * Return a default value when the input is null, undefined, or NaN.
 * @param {any} defaultValue
 * @param {any} value
 * @returns {any}
 */
export function defaultTo(defaultValue, value) {
  return value == null || (typeof value === 'number' && Number.isNaN(value)) ? defaultValue : value;
}

/**
 * Safely read a property from an object.
 * @param {string} key
 * @param {object} obj
 * @returns {any}
 */
export function prop(key, obj) {
  if (obj == null) return undefined;
  if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') return undefined;
  return obj[key];
}

/**
 * Safely read a deep path from an object using an array of keys or a dot-notation string.
 * @param {string[]|string} keys — Array of keys or dot-notation string like 'a.b.c'
 * @param {object} obj
 * @returns {any}
 */
export function getPath(keys, obj) {
  if (keys == null) return undefined;
  const keyList = Array.isArray(keys) ? keys : String(keys).split('.');
  let val = obj;
  for (const k of keyList) { if (val == null) return undefined; val = val[k]; }
  return val;
}

/**
 * Safely read a deep path with a fallback default.
 * @param {any} defaultValue
 * @param {string[]} keys
 * @param {object} obj
 * @returns {any}
 */
export function pathOr(defaultValue, keys, obj) {
  const result = getPath(keys, obj);
  return result === undefined ? defaultValue : result;
}

/**
 * Apply a function to a value only when a predicate returns true.
 * @param {Function} pred
 * @param {Function} fn
 * @param {any} value
 * @returns {any}
 */
export function when(pred, fn, value) {
  if (typeof pred !== 'function') return value;
  if (typeof fn !== 'function') return value;
  return pred(value) ? fn(value) : value;
}

/**
 * Apply a function to a value only when a predicate returns false.
 * @param {Function} pred
 * @param {Function} fn
 * @param {any} value
 * @returns {any}
 */
export function unless(pred, fn, value) {
  if (typeof pred !== 'function') return value;
  if (typeof fn !== 'function') return value;
  return pred(value) ? value : fn(value);
}

/**
 * Branch between two functions based on a predicate.
 * @param {Function} pred
 * @param {Function} onTrue
 * @param {Function} onFalse
 * @param {any} value
 * @returns {any}
 */
export function ifElse(pred, onTrue, onFalse, value) {
  if (typeof pred !== 'function') return value;
  if (typeof onTrue !== 'function') return value;
  if (typeof onFalse !== 'function') return value;
  return pred(value) ? onTrue(value) : onFalse(value);
}

/**
 * Multi-way conditional: return the first matching [pred, fn] pair.
 * @param {Array<[Function,Function]>} pairs
 * @returns {Function}
 */
export function cond(pairs) {
  if (!Array.isArray(pairs)) return () => undefined;
  return (value) => {
    for (const [pred, fn] of pairs) {
      if (typeof pred !== 'function' || typeof fn !== 'function') continue;
      if (pred(value)) return fn(value);
    }
    return undefined;
  };
}

/**
 * True only if every predicate returns true.
 * @param {Function[]} preds
 * @returns {Function}
 */
export function allPass(preds) {
  if (!Array.isArray(preds)) return () => false;
  return (value) => preds.every(p => typeof p === 'function' && p(value));
}

/**
 * True if any predicate returns true.
 * @param {Function[]} preds
 * @returns {Function}
 */
export function anyPass(preds) {
  if (!Array.isArray(preds)) return () => false;
  return (value) => preds.some(p => typeof p === 'function' && p(value));
}

/**
 * Logical negation of a predicate function.
 * @param {Function} pred
 * @returns {Function}
 */
export function complement(pred) {
  if (typeof pred !== 'function') return () => true;
  return (...args) => !pred(...args);
}

/**
 * Return a function that always returns the given value.
 * @param {any} value
 * @returns {Function}
 */
export function always(value) {
  return () => value;
}

/** Constant function that always returns true. @returns {Function} */
export function T() { return () => true; }

/** Constant function that always returns false. @returns {Function} */
export function F() { return () => false; }

/**
 * First element of an array or string.
 * @param {Array|string} list
 * @returns {any}
 */
export function head(list) {
  if (list == null || typeof list.length !== 'number') return undefined;
  return list[0];
}

/**
 * All elements after the first.
 * @param {Array} list
 * @returns {Array}
 */
export function tail(list) {
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.slice.call(list, 1);
}

/**
 * Last element of an array or string.
 * @param {Array|string} list
 * @returns {any}
 */
export function last(list) {
  if (list == null || typeof list.length !== 'number') return undefined;
  return list[list.length - 1];
}

/**
 * All elements except the last.
 * @param {Array} list
 * @returns {Array}
 */
export function init(list) {
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.slice.call(list, 0, -1);
}

/**
 * First n elements of a list.
 * @param {number} n
 * @param {Array|string} list
 * @returns {Array|string}
 */
export function take(n, list) {
  if (list == null || typeof list.length !== 'number') return [];
  return typeof list === 'string' ? list.slice(0, n) : Array.prototype.slice.call(list, 0, n);
}

/**
 * Elements after the first n.
 * @param {number} n
 * @param {Array|string} list
 * @returns {Array|string}
 */
export function drop(n, list) {
  if (list == null || typeof list.length !== 'number') return [];
  return typeof list === 'string' ? list.slice(n) : Array.prototype.slice.call(list, n);
}

/**
 * Last n elements of a list.
 * @param {number} n
 * @param {Array|string} list
 * @returns {Array|string}
 */
export function takeLast(n, list) {
  if (list == null || typeof list.length !== 'number') return [];
  return typeof list === 'string' ? list.slice(-n) : Array.prototype.slice.call(list, -n);
}

/**
 * All but the last n elements.
 * @param {number} n
 * @param {Array|string} list
 * @returns {Array|string}
 */
export function dropLast(n, list) {
  if (list == null || typeof list.length !== 'number') return [];
  return typeof list === 'string' ? list.slice(0, -n) : Array.prototype.slice.call(list, 0, -n);
}

/**
 * Extract a property from each object in a list.
 * @param {string} key
 * @param {Array<object>} list
 * @returns {Array}
 */
export function pluck(key, list) {
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.map.call(list, obj => obj == null ? undefined : obj[key]);
}

/**
 * First element matching a predicate.
 * @param {Function} pred
 * @param {Array} list
 * @returns {any}
 */
export function find(pred, list) {
  if (typeof pred !== 'function') return undefined;
  if (list == null || typeof list.length !== 'number') return undefined;
  return Array.prototype.find.call(list, pred);
}

/**
 * Index of first element matching a predicate.
 * @param {Function} pred
 * @param {Array} list
 * @returns {number}
 */
export function findIndex(pred, list) {
  if (typeof pred !== 'function') return -1;
  if (list == null || typeof list.length !== 'number') return -1;
  return Array.prototype.findIndex.call(list, pred);
}

/**
 * Check if obj[key] strictly equals val.
 * @param {string} key
 * @param {any} val
 * @param {object} obj
 * @returns {boolean}
 */
export function propEq(key, val, obj) {
  if (obj == null || typeof obj !== 'object') return false;
  return obj[key] === val;
}

/**
 * Check if a deep path strictly equals val.
 * @param {string[]} keys
 * @param {any} val
 * @param {object} obj
 * @returns {boolean}
 */
export function pathEq(keys, val, obj) {
  return getPath(keys, obj) === val;
}

/**
 * Strict-equality membership test for a list.
 * @param {any} value
 * @param {Array} list
 * @returns {boolean}
 */
export function contains(value, list) {
  if (list == null || typeof list.length !== 'number') return false;
  return Array.prototype.indexOf.call(list, value) >= 0;
}

/**
 * True for plain {} objects (not Date, Array, RegExp, etc.).
 * @param {any} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return value != null && Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * True for DOM Element nodes.
 * @param {any} value
 * @returns {boolean}
 */
export function isElement(value) {
  return value != null && typeof value === 'object' && typeof value.nodeType === 'number' && value.nodeType === 1;
}

/**
 * True for Promise instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isPromise(value) {
  return value != null && (value instanceof Promise || Object.prototype.toString.call(value) === '[object Promise]');
}

/**
 * True for FormData instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isFormData(value) {
  return value != null && Object.prototype.toString.call(value) === '[object FormData]';
}

/**
 * True for Blob instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isBlob(value) {
  return value != null && Object.prototype.toString.call(value) === '[object Blob]';
}

/**
 * True for File instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isFile(value) {
  return value != null && Object.prototype.toString.call(value) === '[object File]';
}

/**
 * True for array-like objects (has numeric length).
 * @param {any} value
 * @returns {boolean}
 */
export function isArrayLike(value) {
  return value != null && typeof value.length === 'number' && value.length >= 0;
}

/**
 * Transform object properties by applying functions from a template.
 * @param {object} transformations
 * @param {object} obj
 * @returns {object}
 */
export function evolve(transformations, obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (transformations == null || typeof transformations !== 'object') return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    const fn = transformations[key];
    result[key] = typeof fn === 'function' ? fn(obj[key]) : obj[key];
  }
  return result;
}

/**
 * Shallow clone of object without the given key.
 * @param {string} key
 * @param {object} obj
 * @returns {object}
 */
export function dissoc(key, obj) {
  if (obj == null || typeof obj !== 'object') return {};
  const result = {};
  for (const k of Object.keys(obj)) { if (k !== key) result[k] = obj[k]; }
  return result;
}

/**
 * Deep merge where `a` values take precedence.
 * @param {object} a
 * @param {object} b
 * @returns {object}
 */
export function mergeDeepLeft(a, b) {
  if (a == null || typeof a !== 'object') return b;
  if (b == null || typeof b !== 'object') return a;
  if (Array.isArray(a) || Array.isArray(b)) return a;
  const result = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k in a && k in b && a[k] != null && typeof a[k] === 'object' && b[k] != null && typeof b[k] === 'object') {
      result[k] = mergeDeepLeft(a[k], b[k]);
    } else { result[k] = k in a ? a[k] : b[k]; }
  }
  return result;
}

/**
 * Deep merge where `b` values take precedence.
 * @param {object} a
 * @param {object} b
 * @returns {object}
 */
export function mergeDeepRight(a, b) {
  if (a == null || typeof a !== 'object') return b;
  if (b == null || typeof b !== 'object') return a;
  if (Array.isArray(a) || Array.isArray(b)) return b;
  const result = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k in a && k in b && a[k] != null && typeof a[k] === 'object' && b[k] != null && typeof b[k] === 'object') {
      result[k] = mergeDeepRight(a[k], b[k]);
    } else { result[k] = k in b ? b[k] : a[k]; }
  }
  return result;
}

/**
 * Pick the specified keys from every object in a list.
 * @param {string[]} keys
 * @param {Array<object>} list
 * @returns {Array<object>}
 */
export function project(keys, list) {
  if (!Array.isArray(keys)) return [];
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.map.call(list, obj => {
    const result = {};
    for (const k of keys) { if (k in obj) result[k] = obj[k]; }
    return result;
  });
}

/**
 * Memoize a function with a custom cache-key generator.
 * @param {Function} fn
 * @param {Function} keyFn
 * @returns {Function}
 */
export function memoizeBy(fn, keyFn) {
  if (typeof fn !== 'function' || typeof keyFn !== 'function') return fn;
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Ensure a function runs at most once.
 * @param {Function} fn
 * @returns {Function}
 */
export function onceInline(fn) {
  if (typeof fn !== 'function') return () => undefined;
  let ran = false;
  let result;
  return (...args) => {
    if (ran) return result;
    ran = true;
    result = fn(...args);
    return result;
  };
}

/**
 * Safe RegExp match returning an array or null.
 * @param {RegExp} regex
 * @param {string} str
 * @returns {Array|null}
 */
export function match(regex, str) {
  if (typeof str !== 'string') return null;
  return str.match(regex);
}

/**
 * Safe string replace.
 * @param {string|RegExp} pattern
 * @param {string|Function} replacement
 * @param {string} str
 * @returns {string}
 */
export function replace(pattern, replacement, str) {
  if (typeof str !== 'string') return '';
  return str.replace(pattern, /** @type {string|Function} */ (replacement));
}

/**
 * Trim whitespace from both ends of a string.
 * @param {string} str
 * @returns {string}
 */
export function trim(str) {
  return typeof str === 'string' ? str.trim() : '';
}

/**
 * Convert a string to lowercase.
 * @param {string} str
 * @returns {string}
 */
export function toLower(str) {
  return typeof str === 'string' ? str.toLowerCase() : '';
}

/**
 * Convert a string to uppercase.
 * @param {string} str
 * @returns {string}
 */
export function toUpper(str) {
  return typeof str === 'string' ? str.toUpperCase() : '';
}

/**
 * Safe startsWith check.
 * @param {string} prefix
 * @param {string} str
 * @returns {boolean}
 */
export function startsWith(prefix, str) {
  return typeof str === 'string' && str.startsWith(prefix);
}

/**
 * Safe endsWith check.
 * @param {string} suffix
 * @param {string} str
 * @returns {boolean}
 */
export function endsWith(suffix, str) {
  return typeof str === 'string' && str.endsWith(suffix);
}

/**
 * Safe substring inclusion check.
 * @param {string} substr
 * @param {string} str
 * @returns {boolean}
 */
export function includes(substr, str) {
  return typeof str === 'string' && str.includes(substr);
}

/**
 * Safe string split.
 * @param {string|RegExp} sep
 * @param {string} str
 * @returns {string[]}
 */
export function split(sep, str) {
  return typeof str === 'string' ? str.split(sep) : [];
}

/**
 * Safe array join.
 * @param {string} sep
 * @param {Array} list
 * @returns {string}
 */
export function join(sep, list) {
  if (list == null || typeof list.length !== 'number') return '';
  return Array.prototype.join.call(list, sep);
}

/**
 * Reverse a copy of an array or string.
 * @param {Array|string} list
 * @returns {Array|string}
 */
export function reverseInline(list) {
  if (list == null || typeof list.length !== 'number') return [];
  if (typeof list === 'string') return list.split('').reverse().join('');
  return Array.prototype.slice.call(list).reverse();
}

/**
 * Sort a copy of an array.
 * @param {Array} list
 * @returns {Array}
 */
export function sort(list) {
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.slice.call(list).sort();
}

/**
 * Sort by iteratee result.
 * @param {Function} iteratee
 * @param {Array} list
 * @returns {Array}
 */
export function sortByInline(iteratee, list) {
  if (typeof iteratee !== 'function') return [];
  if (list == null || typeof list.length !== 'number') return [];
  return Array.prototype.slice.call(list).sort((a, b) => {
    const av = iteratee(a), bv = iteratee(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

/**
 * Unique items by iteratee result.
 * @param {Function} iteratee
 * @param {Array} list
 * @returns {Array}
 */
export function uniqBy(iteratee, list) {
  if (typeof iteratee !== 'function') return [];
  if (list == null || typeof list.length !== 'number') return [];
  const seen = new Set();
  return Array.prototype.filter.call(list, item => {
    const key = iteratee(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Flatten array to a given depth.
 * @param {number} depth
 * @param {Array} list
 * @returns {Array}
 */
export function flattenInline(depth, list) {
  if (list == null || typeof list.length !== 'number') return [];
  const result = [];
  const items = Array.from(list);
  const stack = [];
  for (let i = items.length - 1; i >= 0; i--) stack.push([items[i], 0]);
  if (!stack.length) return [];
  while (stack.length) {
    const [item, d] = stack.pop();
    if (Array.isArray(item) && d < depth) {
      for (let i = item.length - 1; i >= 0; i--) stack.push([item[i], d + 1]);
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Pairwise zip two arrays into an array of pairs.
 * @param {Array} arr1
 * @param {Array} arr2
 * @returns {Array<[any,any]>}
 */
export function zip(arr1, arr2) {
  if (!arr1 || !arr2 || typeof arr1.length !== 'number' || typeof arr2.length !== 'number') return [];
  const len = Math.min(arr1.length, arr2.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) result[i] = [arr1[i], arr2[i]];
  return result;
}

/**
 * Unzip an array of pairs into two arrays.
 * @param {Array<[any,any]>} arr
 * @returns {[Array, Array]}
 */
export function unzip(arr) {
  if (!arr || typeof arr.length !== 'number') return [[], []];
  const a = new Array(arr.length), b = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const pair = arr[i];
    a[i] = pair != null ? pair[0] : undefined;
    b[i] = pair != null ? pair[1] : undefined;
  }
  return [a, b];
}

/**
 * True for WeakMap instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isWeakMap(value) {
  return value != null && Object.prototype.toString.call(value) === '[object WeakMap]';
}

/**
 * True for WeakSet instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isWeakSet(value) {
  return value != null && Object.prototype.toString.call(value) === '[object WeakSet]';
}

/**
 * True for ArrayBuffer instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isArrayBuffer(value) {
  return value != null && Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

/**
 * True for SharedArrayBuffer instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isSharedArrayBuffer(value) {
  return value != null && Object.prototype.toString.call(value) === '[object SharedArrayBuffer]';
}

/**
 * True for DataView instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isDataView(value) {
  return value != null && Object.prototype.toString.call(value) === '[object DataView]';
}

/**
 * True for any TypedArray instance.
 * @param {any} value
 * @returns {boolean}
 */
export function isTypedArray(value) {
  return value != null && ArrayBuffer.isView(value) && Object.prototype.toString.call(value) !== '[object DataView]';
}

/**
 * True for generator functions.
 * @param {any} value
 * @returns {boolean}
 */
export function isGenerator(value) {
  return typeof value === 'function' && value.constructor && value.constructor.name === 'GeneratorFunction';
}

/**
 * True for async generator functions.
 * @param {any} value
 * @returns {boolean}
 */
export function isAsyncGenerator(value) {
  return typeof value === 'function' && value.constructor && value.constructor.name === 'AsyncGeneratorFunction';
}

/**
 * Check if a value has Symbol.iterator.
 * @param {any} value
 * @returns {boolean}
 */
export function isIterable(value) {
  return value != null && typeof value[Symbol.iterator] === 'function';
}

/**
 * Check if a value has Symbol.asyncIterator.
 * @param {any} value
 * @returns {boolean}
 */
export function isAsyncIterable(value) {
  return value != null && typeof value[Symbol.asyncIterator] === 'function';
}

/**
 * Recursively freeze an object and all of its enumerable properties.
 * Handles Date, RegExp, Map, Set, WeakMap, WeakSet, and arrays safely.
 * @param {any} obj
 * @returns {any}
 */
export function freezeNamespace(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const ctor = obj.constructor;
  if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet) return obj;
  if (ctor === Map) {
    for (const [k, v] of obj) obj.set(k, freezeNamespace(v));
    return Object.freeze(obj);
  }
  if (ctor === Set) {
    const values = Array.from(obj);
    obj.clear();
    for (const v of values) obj.add(freezeNamespace(v));
    return Object.freeze(obj);
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = freezeNamespace(obj[i]);
    }
    return Object.freeze(obj);
  }
  try { Object.freeze(obj); } catch { return obj; }
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      freezeNamespace(value);
    }
  }
  return obj;
}

// ── Build flat exports and namespace map dynamically ───────────
const _nsMap = {
  string, number, async, array, object, url, storage, theme, dom, format, type,
  fetch, function: function_, accessibility, clipboard, crypto, download, path,
  privacy, vscode, event, polling
};

const _flatExports = (() => {
  const exports = {};
  const seen = new Set();
  for (const [nsName, ns] of Object.entries(_nsMap)) {
    for (const key of Object.keys(ns)) {
      if (seen.has(key)) {
        console.warn(`[utils] Collision: "${key}" from "${nsName}" skipped; first export wins.`);
        continue;
      }
      seen.add(key);
      exports[key] = ns[key];
    }
  }
  // Inline namespace helpers override any same-named function-namespace exports
  exports.compose = compose;
  exports.pipe = pipe;
  exports.zipWith = zipWith;
  exports.curry = curry;
  exports.partial = partial;
  exports.tap = tap;
  exports.flip = flip;
  exports.freezeNamespace = freezeNamespace;
  exports.tryCatch = tryCatch;
  exports.defaultTo = defaultTo;
  exports.prop = prop;
  exports.getPath = getPath;
  exports.pathOr = pathOr;
  exports.when = when;
  exports.unless = unless;
  exports.ifElse = ifElse;
  exports.cond = cond;
  exports.allPass = allPass;
  exports.anyPass = anyPass;
  exports.complement = complement;
  exports.always = always;
  exports.T = T;
  exports.F = F;
  exports.head = head;
  exports.tail = tail;
  exports.last = last;
  exports.init = init;
  exports.take = take;
  exports.drop = drop;
  exports.takeLast = takeLast;
  exports.dropLast = dropLast;
  exports.pluck = pluck;
  exports.find = find;
  exports.findIndex = findIndex;
  exports.propEq = propEq;
  exports.pathEq = pathEq;
  exports.contains = contains;
  exports.isPlainObject = isPlainObject;
  exports.isElement = isElement;
  exports.isPromise = isPromise;
  exports.isFormData = isFormData;
  exports.isBlob = isBlob;
  exports.isFile = isFile;
  exports.isArrayLike = isArrayLike;
  exports.evolve = evolve;
  exports.dissoc = dissoc;
  exports.mergeDeepLeft = mergeDeepLeft;
  exports.mergeDeepRight = mergeDeepRight;
  exports.project = project;
  exports.memoizeBy = memoizeBy;
  exports.onceInline = onceInline;
  exports.match = match;
  exports.replace = replace;
  exports.trim = trim;
  exports.toLower = toLower;
  exports.toUpper = toUpper;
  exports.startsWith = startsWith;
  exports.endsWith = endsWith;
  exports.includes = includes;
  exports.split = split;
  exports.join = join;
  exports.reverseInline = reverseInline;
  exports.sort = sort;
  exports.sortByInline = sortByInline;
  exports.uniqBy = uniqBy;
  exports.flattenInline = flattenInline;
  exports.zip = zip;
  exports.unzip = unzip;
  exports.isWeakMap = isWeakMap;
  exports.isWeakSet = isWeakSet;
  exports.isArrayBuffer = isArrayBuffer;
  exports.isSharedArrayBuffer = isSharedArrayBuffer;
  exports.isDataView = isDataView;
  exports.isTypedArray = isTypedArray;
  exports.isGenerator = isGenerator;
  exports.isAsyncGenerator = isAsyncGenerator;
  exports.isIterable = isIterable;
  exports.isAsyncIterable = isAsyncIterable;
  return exports;
})();

/**
 * Return the list of all flat named export keys from this barrel.
 * @returns {ReadonlyArray<string>}
 */
export function getExportNames() {
  return Object.freeze(Object.keys(_flatExports).concat(
    'getExportNames', 'getNamespaceNames', 'getBarrelMeta',
    'validateBarrelIntegrity', 'freezeNamespace', '__barrel__', 'default'
  ));
}

const NAMESPACE_NAMES = Object.freeze(Object.keys(_nsMap).concat('inline'));

/**
 * Return a read-only snapshot of the barrel metadata.
 * @returns {Readonly<object>}
 */
export function getBarrelMeta() {
  return __barrel__;
}

/** @returns {ReadonlyArray<string>} All namespace keys from this barrel. */
export function getNamespaceNames() {
  return NAMESPACE_NAMES;
}

/**
 * Validate barrel integrity at runtime.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validateBarrelIntegrity() {
  const errors = [];
  const nsKeys = getNamespaceNames();
  for (const key of nsKeys) {
    if (!defaultExport[key] || typeof defaultExport[key] !== 'object') {
      errors.push(`Namespace "${key}" is missing or not an object`);
    } else if (!Object.isFrozen(defaultExport[key])) {
      errors.push(`Namespace "${key}" is not frozen`);
    }
  }
  if (!Object.isFrozen(defaultExport)) {
    errors.push('Default export is not frozen');
  }
  if (!defaultExport.__barrel__) {
    errors.push('Missing __barrel__ metadata');
  } else {
    const requiredMetaKeys = ['name', 'description', 'moduleCount', 'exportCount', 'namespaceCount', 'version', 'timestamp', 'exports', 'namespaces'];
    for (const metaKey of requiredMetaKeys) {
      if (!(metaKey in defaultExport.__barrel__)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

const BARREL_TIMESTAMP = new Date().toISOString();

export const __barrel__ = Object.freeze({
  name: 'simplebeacon-dashboard-utils',
  description: 'Barrel re-export for js-es2018/utils-lib/ sub-modules',
  moduleCount: NAMESPACE_NAMES.length,
  exportCount: getExportNames().length,
  namespaceCount: NAMESPACE_NAMES.length,
  version: '1.0.0',
  timestamp: BARREL_TIMESTAMP,
  exports: getExportNames(),
  namespaces: NAMESPACE_NAMES
});

const inlineNamespace = Object.freeze({
  compose, pipe, zipWith, curry, partial, tap, flip, freezeNamespace,
  tryCatch, defaultTo, prop, getPath, pathOr, when, unless, ifElse, cond,
  allPass, anyPass, complement, always, T, F,
  head, tail, last, init, take, drop, takeLast, dropLast,
  pluck, find, findIndex, propEq, pathEq, contains,
  isPlainObject, isElement, isPromise, isFormData, isBlob, isFile, isArrayLike,
  evolve, dissoc, mergeDeepLeft, mergeDeepRight, project,
  memoizeBy, onceInline, match, replace, trim, toLower, toUpper,
  startsWith, endsWith, includes, split, join, reverseInline, sort,
  sortByInline, uniqBy, flattenInline, zip, unzip,
  isWeakMap, isWeakSet, isArrayBuffer, isSharedArrayBuffer, isDataView,
  isTypedArray, isGenerator, isAsyncGenerator, isIterable, isAsyncIterable
});

const defaultExport = freezeNamespace({
  string, number, async, array, object, url, storage, theme, dom, format, type,
  fetch, function: function_,
  accessibility, clipboard, crypto, download, path, privacy, vscode, event, polling,
  inline: inlineNamespace,
  __barrel__
});

export default defaultExport;
