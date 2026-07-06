/**
 * @module utils
 * Barrel re-export for the `js-es2018/utils/` directory.
 * Generated from monolithic utils.js refactor.
 */

// ── Sub-module imports with error boundaries ──────────────────
// If a sub-module fails to load, export a stub so the dashboard doesn't crash.

/** @param {string} name @returns {object} */
function safeImport(name, module) {
  if (module && typeof module === 'object') return module;
  console.warn('[utils] Failed to load module:', name);
  return new Proxy({}, { get: (_t, prop) => { console.warn('[utils] Missing export from ' + name + ': ' + String(prop)); return () => undefined; } });
}

import * as _StringUtils     from './utils/string.js';
import * as _NumberUtils     from './utils/number.js';
import * as _AsyncUtils      from './utils/async.js';
import * as _ArrayUtils      from './utils/array.js';
import * as _ObjectUtils     from './utils/object.js';
import * as _FormatUtils     from './utils/format.js';
import * as _DomUtils        from './utils/dom.js';
import * as _TypeUtils       from './utils/type.js';
import * as _FunctionalUtils from './utils/functional.js';
import * as _StorageUtils    from './utils/storage.js';
import * as _UrlUtils        from './utils/url.js';
import * as _MiscUtils       from './utils/misc.js';

const StringUtils     = safeImport('string',     _StringUtils);
const NumberUtils     = safeImport('number',     _NumberUtils);
const AsyncUtils      = safeImport('async',      _AsyncUtils);
const ArrayUtils      = safeImport('array',      _ArrayUtils);
const ObjectUtils     = safeImport('object',     _ObjectUtils);
const FormatUtils     = safeImport('format',     _FormatUtils);
const DomUtils        = safeImport('dom',        _DomUtils);
const TypeUtils       = safeImport('type',       _TypeUtils);
const FunctionalUtils = safeImport('functional', _FunctionalUtils);
const StorageUtils    = safeImport('storage',    _StorageUtils);
const UrlUtils        = safeImport('url',        _UrlUtils);
const MiscUtils       = safeImport('misc',       _MiscUtils);

// ── New safe-storage & event-bus modules ──────────────────────
import * as _SafeStorage from './utils/safe-storage.js';
import * as _EventBus    from './utils/event-bus.js';
const SafeStorage = safeImport('safe-storage', _SafeStorage);
const EventBus    = safeImport('event-bus',    _EventBus);

// ── String helpers ─────────────────────────────────────────────
/** @param {string} str @returns {string} */
export const escapeHtml       = StringUtils.escapeHtml;
/** @param {string} str @returns {string} */
export const escapeRegExp     = StringUtils.escapeRegExp;
/** @param {string} str @returns {string} */
export const normalizeSlashes = StringUtils.normalizeSlashes;
/**
 * Truncate a string to a maximum length with an optional suffix.
 * @param {string} str
 * @param {number} maxLength
 * @param {string} [suffix='…']
 * @returns {string}
 */
export const truncate         = StringUtils.truncate;
/**
 * Capitalize the first character of a string.
 * @param {string} str
 * @returns {string}
 */
export const capitalize       = StringUtils.capitalize;
/** @param {string} str @returns {string} */
export const kebabCase        = StringUtils.kebabCase;
/** @param {string} str @returns {string} */
export const camelCase        = StringUtils.camelCase;
/** @param {string} str @returns {string} */
export const snakeCase        = StringUtils.snakeCase;
/** @param {string} str @param {number} length @returns {string} */
export const padStart         = StringUtils.padStart;
/** @param {string} str @param {number} length @returns {string} */
export const padEnd           = StringUtils.padEnd;
/** @param {string} str @returns {string} */
export const stripHtml        = StringUtils.stripHtml;
/** @param {string} word @param {number} count @returns {string} */
export const pluralize        = StringUtils.pluralize;

// ── Number helpers ────────────────────────────────────────────
/** @param {number} n @returns {string} */
export const formatNumber   = NumberUtils.formatNumber;
/** @param {number} n @param {number} [decimals=2] @returns {string} */
export const formatPercent  = NumberUtils.formatPercent;
/**
 * Format a byte count as human-readable (e.g. 1.5 KB).
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes    = NumberUtils.formatBytes;
/**
 * Clamp a number between a minimum and maximum inclusive.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clamp          = NumberUtils.clamp;
/** @param {number} num @param {number} precision @returns {number} */
export const roundTo        = NumberUtils.roundTo;
/** @param {number} num @param {number} decimals @returns {number} */
export const toFixedNumber  = NumberUtils.toFixedNumber;
/** @param {number} ms @returns {string} */
export const formatDuration = NumberUtils.formatDuration;
/** @param {number[]} nums @returns {number} */
export const sum            = NumberUtils.sum;
/** @param {number[]} nums @returns {number} */
export const mean           = NumberUtils.mean;
/** @param {Array} arr @param {Function|string} iteratee @returns {any} */
export const maxBy          = NumberUtils.maxBy;
/** @param {Array} arr @param {Function|string} iteratee @returns {any} */
export const minBy          = NumberUtils.minBy;
/** @param {string} str @param {number} [radix=10] @returns {number|null} */
export const safeParseInt   = NumberUtils.safeParseInt;
/** @param {string} str @returns {number|null} */
export const safeParseFloat = NumberUtils.safeParseFloat;
/** @param {number} min @param {number} max @returns {number} */
export const random         = NumberUtils.random;
/** @returns {string} */
export const randomId       = NumberUtils.randomId;
/** @returns {string} */
export const uid            = NumberUtils.uid;

// ── Async helpers ────────────────────────────────────────────
/** @param {number} ms @returns {Promise<void>} */
export const sleep         = AsyncUtils.sleep;
/** @param {number} ms @returns {Promise<void>} */
export const delay         = AsyncUtils.delay;
/**
 * Debounce a function so it fires only after `wait` ms of inactivity.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export const debounce      = AsyncUtils.debounce;
/** @param {Function} fn @param {number} wait @returns {Function} */
export const debounceAsync = AsyncUtils.debounceAsync;
/** @param {Function} fn @param {number} wait @returns {Function} */
export const debounceLeading = AsyncUtils.debounceLeading;
/**
 * Throttle a function so it fires at most once per `limit` ms.
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export const throttle      = AsyncUtils.throttle;
/** @param {Function} fn @param {number} limit @returns {Function} */
export const throttleAsync = AsyncUtils.throttleAsync;
/** @param {Function} fn @returns {Function} */
export const once          = AsyncUtils.once;
/** @param {Function} fn @returns {Function} */
export const memoize       = AsyncUtils.memoize;
/** @param {Function} fn @returns {Function} */
export const memoizeAsync  = AsyncUtils.memoizeAsync;
/** @param {Function} fn @param {number} ms @returns {Function} */
export const withTimeout   = AsyncUtils.withTimeout;
/** @param {Function} fn @param {object} [options] @returns {Function} */
export const retry         = AsyncUtils.retry;
/** @param {Function} fn @returns {Function} */
export const tryFn         = AsyncUtils.tryFn;
/** @param {Function[]} fns @returns {Function} */
export const seq           = AsyncUtils.seq;
/** @param {Function[]} fns @returns {Function} */
export const flow          = AsyncUtils.flow;
/** @param {Function} fn @returns {Function} */
export const negate        = AsyncUtils.negate;

// ── Array helpers ────────────────────────────────────────────
/** @template T @param {T[]} arr @returns {T[]} */
export const unique        = ArrayUtils.unique;
/** @param {Array} arr @returns {Array} */
export const compact       = ArrayUtils.compact;
/**
 * Recursively flatten an array of arrays into a single flat array.
 * @param {Array} arr
 * @returns {Array}
 */
export const flatten       = ArrayUtils.flatten;
/** @param {number} start @param {number} end @returns {number[]} */
export const range         = ArrayUtils.range;
/** @param {Array} arr @param {number} size @returns {Array[]} */
export const chunk         = ArrayUtils.chunk;
/** @param {Array} arr @returns {any} */
export const sample        = ArrayUtils.sample;
/** @param {Array} arr @returns {Array} */
export const shuffle       = ArrayUtils.shuffle;
/** @param {Array} arr @returns {Array} */
export const reverse       = ArrayUtils.reverse;
/** @param {...Array} arrs @returns {Array} */
export const union         = ArrayUtils.union;
/** @param {...Array} arrs @returns {Array} */
export const intersection  = ArrayUtils.intersection;
/** @param {...Array} arrs @returns {Array} */
export const difference    = ArrayUtils.difference;
/**
 * Group array items by the result of an iteratee function.
 * @param {Array} arr
 * @param {Function|string} iteratee
 * @returns {Object<string, Array>}
 */
export const groupBy       = ArrayUtils.groupBy;
/** @param {Array} arr @param {Function} pred @returns {[Array, Array]} */
export const partition     = ArrayUtils.partition;
/** @param {Array} arr @param {Function|string} iteratee @returns {Array} */
export const sortBy        = ArrayUtils.sortBy;
/** @param {Array} arr @param {Function|string} iteratee @returns {Object} */
export const keyBy         = ArrayUtils.keyBy;
/** @param {number} n @param {Function} fn @returns {Array} */
export const times         = ArrayUtils.times;
/** @param {Array} arr @returns {any} */
export const randomChoice  = ArrayUtils.randomChoice;
/** @param {any} value @returns {Array} */
export const ensureArray   = ArrayUtils.ensureArray;
/** @param {Array} arr @param {Function|string} iteratee @returns {Object<string, number>} */
export const countBy       = ArrayUtils.countBy;

// ── Object helpers ───────────────────────────────────────────
/**
 * Deep-clone a plain object, array, Date, RegExp, Map, or Set.
 * @param {any} obj
 * @returns {any}
 */
export const deepClone    = ObjectUtils.deepClone;
/** @param {any} obj @returns {any} */
export const clone        = ObjectUtils.clone;
/**
 * Recursively compare two values for deep equality.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export const deepEqual    = ObjectUtils.deepEqual;
/**
 * Return a shallow clone of `obj` containing only the specified `keys`.
 * @param {string[]} keys
 * @param {object} obj
 * @returns {object}
 */
export const pick         = ObjectUtils.pick;
/**
 * Return a shallow clone of `obj` excluding the specified `keys`.
 * @param {string[]} keys
 * @param {object} obj
 * @returns {object}
 */
export const omit         = ObjectUtils.omit;
/** @param {object} obj @param {...object} sources @returns {object} */
export const defaults     = ObjectUtils.defaults;
/**
 * Deep-merge two objects. Nested objects are recursively merged.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
export const merge        = ObjectUtils.merge;
/** @param {object} obj @returns {object} */
export const invert       = ObjectUtils.invert;
/** @param {object} obj @param {Function} iteratee @returns {object} */
export const mapValues    = ObjectUtils.mapValues;
/** @param {object} obj @param {Function} iteratee @returns {object} */
export const mapKeys      = ObjectUtils.mapKeys;
/** @param {string} path @param {object} obj @returns {boolean} */
export const has          = ObjectUtils.has;
/** @param {string} path @param {object} obj @returns {any} */
export const get          = ObjectUtils.get;
/** @param {string} path @param {any} value @param {object} obj @returns {object} */
export const set          = ObjectUtils.set;
/** @param {string[]} keys @param {any[]} values @returns {object} */
export const zipObject    = ObjectUtils.zipObject;
/** @param {any} value @returns {any} */
export const identity     = ObjectUtils.identity;
/** @param {any} value @returns {Function} */
export const constant     = ObjectUtils.constant;
/** @param {string[]} paths @param {object} obj @returns {Array} */
export const at           = ObjectUtils.at;
/** @param {string} path @param {object} obj @returns {boolean} */
export const unset        = ObjectUtils.unset;
/** @param {object} obj @param {...object} sources @returns {object} */
export const defaultsDeep = ObjectUtils.defaultsDeep;

// ── Format helpers ───────────────────────────────────────────
/**
 * Redact a file path for safe display in UI.
 * @param {string} path
 * @returns {string}
 */
export const redactPathForDisplay   = FormatUtils.redactPathForDisplay;
/** @param {string} path @returns {boolean} */
export const isRedactedPathDisplay  = FormatUtils.isRedactedPathDisplay;
/** @param {string} path @returns {string} */
export const formatPathInputValue   = FormatUtils.formatPathInputValue;
/** @param {string} path @returns {string} */
export const formatScanPathForDisplay = FormatUtils.formatScanPathForDisplay;
/** @param {string} path @returns {string} */
export const formatPathLabel        = FormatUtils.formatPathLabel;
/** @param {string} message @returns {string} */
export const formatAiSummarySkipMessage = FormatUtils.formatAiSummarySkipMessage;
/** @param {string} data @returns {string} */
export const sanitizePrivacyData    = FormatUtils.sanitizePrivacyData;
/**
 * Format a Date or timestamp into a locale-aware string.
 * @param {Date|number|string} value
 * @param {object} [options]
 * @returns {string}
 */
export const formatDate             = FormatUtils.formatDate;
/**
 * Return a human-readable relative time string (e.g. "2 hours ago").
 * @param {Date|number|string} date
 * @returns {string}
 */
export const relativeTime           = FormatUtils.relativeTime;
/** @param {Date|number|string} date @returns {string} */
export const timeAgo                = FormatUtils.timeAgo;

// ── DOM helpers ──────────────────────────────────────────────
/**
 * Display a temporary toast notification.
 * @param {string} message
 * @param {string} [type='info']
 * @param {number} [duration=3000]
 */
export const showToast          = DomUtils.showToast;
/** Remove the global toast container from the DOM. */
export const removeToastContainer = DomUtils.removeToastContainer;
/** Render a styled empty-state message into a container element. */
export const renderEmptyState   = DomUtils.renderEmptyState;
/** Copy text to the clipboard, falling back to a legacy textarea trick. */
export const copyToClipboard    = DomUtils.copyToClipboard;
/** Trigger a download of a Blob with the given filename. */
export const downloadBlob       = DomUtils.downloadBlob;
/** Trigger a download of a JSON object as a .json file. */
export const downloadJson       = DomUtils.downloadJson;
/** Trigger a download of raw text as a .txt file. */
export const downloadText       = DomUtils.downloadText;
/** Trigger a download of CSV text as a .csv file. */
export const downloadCsv        = DomUtils.downloadCsv;

// ── Type guards ──────────────────────────────────────────────
/**
 * Check if a value is blank: null, undefined, empty string, empty array, or empty object.
 * @param {any} value
 * @returns {boolean}
 */
export const isBlank        = TypeUtils.isBlank;
export const noop           = TypeUtils.noop;
/**
 * Check if a value is neither `null` nor `undefined`.
 * @param {any} value
 * @returns {boolean}
 */
export const isDefined      = TypeUtils.isDefined;
export const isNull         = TypeUtils.isNull;
export const isUndefined    = TypeUtils.isUndefined;
export const isNil          = TypeUtils.isNil;
export const isSymbol       = TypeUtils.isSymbol;
export const isMap          = TypeUtils.isMap;
export const isSet          = TypeUtils.isSet;
export const isBoolean      = TypeUtils.isBoolean;
export const isNumber       = TypeUtils.isNumber;
export const isString       = TypeUtils.isString;
export const isArray        = TypeUtils.isArray;
export const isFunction     = TypeUtils.isFunction;
export const isObject       = TypeUtils.isObject;
export const isDate         = TypeUtils.isDate;
export const isRegExp       = TypeUtils.isRegExp;
export function isPromise(value) {
  return value != null && (value instanceof Promise || Object.prototype.toString.call(value) === '[object Promise]');
}
export const isError        = TypeUtils.isError;

// ── Functional helpers ───────────────────────────────────────
export const compose       = FunctionalUtils.compose;
export const pipe          = FunctionalUtils.pipe;
export const zipWith       = FunctionalUtils.zipWith;
export const curry         = FunctionalUtils.curry;
export const partial       = FunctionalUtils.partial;
export const tap           = FunctionalUtils.tap;

/**
 * Flip the first two arguments of a binary function.
 * `flip(fn)(a, b)` is equivalent to `fn(b, a)`.
 * @param {Function} fn
 * @returns {Function}
 */
export function flip(fn) {
  return (b, a) => fn(a, b);
}

/**
 * Safely execute a function; on throw, return the handler's result.
 * @param {Function} fn
 * @param {Function} handler
 * @returns {Function}
 */
export function tryCatch(fn, handler) {
  if (typeof fn !== 'function' || typeof handler !== 'function') return fn;
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
 * Safely read a deep path from an object using an array of keys.
 * @param {string[]} keys
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
  if (typeof pred !== 'function' || typeof fn !== 'function') return value;
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
  if (typeof pred !== 'function' || typeof fn !== 'function') return value;
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
  if (typeof pred !== 'function' || typeof onTrue !== 'function' || typeof onFalse !== 'function') return value;
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
  return value != null && Object.prototype.toString.call(value) === '[object Object]' && value.constructor === Object;
}

/**
 * True for DOM Element nodes.
 * @param {any} value
 * @returns {boolean}
 */
export function isElement(value) {
  return value != null && typeof value === 'object' && value.nodeType === 1;
}

/**
 * True for FormData instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isFormData(value) {
  return value != null && typeof value === 'object' && value.constructor === FormData;
}

/**
 * True for Blob instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isBlob(value) {
  return value != null && typeof value === 'object' && value.constructor === Blob;
}

/**
 * True for File instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isFile(value) {
  return value != null && typeof value === 'object' && value.constructor === File;
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
  const stack = list.map ? list.map(x => [x, 1]) : [];
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
  return value != null && typeof value === 'object' && value.constructor === WeakMap;
}

/**
 * True for WeakSet instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isWeakSet(value) {
  return value != null && typeof value === 'object' && value.constructor === WeakSet;
}

/**
 * True for ArrayBuffer instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isArrayBuffer(value) {
  return value != null && typeof value === 'object' && value.constructor === ArrayBuffer;
}

/**
 * True for SharedArrayBuffer instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isSharedArrayBuffer(value) {
  return value != null && typeof value === 'object' && value.constructor === SharedArrayBuffer;
}

/**
 * True for DataView instances.
 * @param {any} value
 * @returns {boolean}
 */
export function isDataView(value) {
  return value != null && typeof value === 'object' && value.constructor === DataView;
}

/**
 * True for any TypedArray instance.
 * @param {any} value
 * @returns {boolean}
 */
export function isTypedArray(value) {
  return value != null && ArrayBuffer.isView(value) && !(value instanceof DataView);
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

// ── Storage helpers ──────────────────────────────────────────
/** @param {string} key @returns {any} */
export const localStorageGet       = StorageUtils.localStorageGet;
/** @param {string} key @param {any} value @returns {void} */
export const localStorageSet       = StorageUtils.localStorageSet;
/** @param {string} key @returns {void} */
export const localStorageRemove    = StorageUtils.localStorageRemove;
/** @param {string} key @returns {string|null} */
export const localStorageGetString = StorageUtils.localStorageGetString;
/** @param {string} key @param {string} value @returns {void} */
export const localStorageSetString = StorageUtils.localStorageSetString;
/** @param {string} key @returns {any} */
export const sessionStorageGet     = StorageUtils.sessionStorageGet;
/** @param {string} key @param {any} value @returns {void} */
export const sessionStorageSet     = StorageUtils.sessionStorageSet;
/** @param {string} key @returns {void} */
export const sessionStorageRemove  = StorageUtils.sessionStorageRemove;

// ── Safe storage helpers (sandbox-aware) ─────────────────────
/** @param {string} key @param {string|null} [defaultValue] @returns {string|null} */
export const safeLocalStorageGet      = SafeStorage.localStorageGet;
/** @param {string} key @param {string} value @returns {boolean} */
export const safeLocalStorageSet      = SafeStorage.localStorageSet;
/** @param {string} key @returns {boolean} */
export const safeLocalStorageRemove   = SafeStorage.localStorageRemove;
/** @param {string} key @param {any} [defaultValue] @returns {any} */
export const safeLocalStorageGetJson  = SafeStorage.localStorageGetJson;
/** @param {string} key @param {any} value @returns {boolean} */
export const safeLocalStorageSetJson  = SafeStorage.localStorageSetJson;
/** @param {string} key @param {string|null} [defaultValue] @returns {string|null} */
export const safeSessionStorageGet     = SafeStorage.sessionStorageGet;
/** @param {string} key @param {string} value @returns {boolean} */
export const safeSessionStorageSet     = SafeStorage.sessionStorageSet;
/** @param {string} key @returns {boolean} */
export const safeSessionStorageRemove  = SafeStorage.sessionStorageRemove;
/** @param {string} prefix @returns {number} */
export const safeLocalStorageClearPrefix = SafeStorage.localStorageClearPrefix;

// ── URL helpers ──────────────────────────────────────────────
/** @returns {string} */
export const apiBaseUrl          = UrlUtils.apiBaseUrl;
/** @param {string} endpoint @returns {string} */
export const apiUrl              = UrlUtils.apiUrl;
/** @returns {boolean} */
export const isOnline            = UrlUtils.isOnline;
/** @returns {string} */
export const getNonce            = UrlUtils.getNonce;
/** @param {string} query @returns {object} */
export const parseQueryString    = UrlUtils.parseQueryString;
/** @param {object} params @returns {string} */
export const stringifyQueryString = UrlUtils.stringifyQueryString;
/** @param {string} str @returns {boolean} */
export const isValidUrl          = UrlUtils.isValidUrl;

// ── Fetch helpers ────────────────────────────────────────────
import { fetchWithTimeout } from './utils-lib/fetch.js';
export { fetchWithTimeout };
import { waitForAsync } from './utils-lib/async.js';
export { waitForAsync };

// ── Event bus helpers ────────────────────────────────────────
/** @returns {object} Event bus with on/off/emit/once/clear */
export const createEventBus    = EventBus.createEventBus;
/** @param {string} [namespace='sb'] @returns {object} DOM-backed event bus */
export const createDomEventBus = EventBus.createDomEventBus;

// ── DOM-aware debounceRender ─────────────────────────────────
/**
 * Debounce a function using requestAnimationFrame for smoother UI updates.
 * @param {Function} fn
 * @param {number} [wait=0] additional ms to wait after rAF
 * @returns {Function}
 */
export function debounceRender(fn, wait = 0) {
  if (typeof fn !== 'function') return () => {};
  let rafId = null;
  let timeoutId = null;
  return (...args) => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timeoutId) clearTimeout(timeoutId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (wait > 0) {
        timeoutId = setTimeout(() => { timeoutId = null; fn(...args); }, wait);
      } else {
        fn(...args);
      }
    });
  };
}

// ── Misc helpers ─────────────────────────────────────────────
export const assertNever     = MiscUtils.assertNever;
export const parseJsonSafe     = MiscUtils.parseJsonSafe;
export const parseResponseJson = MiscUtils.parseResponseJson;
export const prefersReducedMotion = MiscUtils.prefersReducedMotion;
export const prefersDarkMode = MiscUtils.prefersDarkMode;
export const isEqual         = MiscUtils.isEqual;
/**
 * Check if a value is empty: empty string, empty array, empty object, zero, or false.
 * @param {any} value
 * @returns {boolean}
 */
export const isEmpty         = MiscUtils.isEmpty;
export const findIndex       = MiscUtils.findIndex;

// ── Barrel helpers ─────────────────────────────────────────────
import { getExportNames, validateBarrelIntegrity, registerNamespaces, registerInlineKeys } from './utils/barrel.js';
export { getExportNames, validateBarrelIntegrity, registerNamespaces, registerInlineKeys };

const _namespaceRegistry = {
  string: StringUtils, number: NumberUtils, async: AsyncUtils, array: ArrayUtils,
  object: ObjectUtils, format: FormatUtils, dom: DomUtils, type: TypeUtils,
  functional: FunctionalUtils, storage: StorageUtils, url: UrlUtils, misc: MiscUtils,
  safeStorage: SafeStorage, eventBus: EventBus
};

const NAMESPACE_NAMES = Object.freeze(Object.keys(_namespaceRegistry).concat('inline'));

export function getNamespaceNames() {
  return NAMESPACE_NAMES;
}

// ── Collision detection ──────────────────────────────────────
const _collisionWarnings = new Set();

function _warnCollision(name, ns1, ns2) {
  if (_collisionWarnings.has(name)) return;
  _collisionWarnings.add(name);
}

function _checkExportCollisions() {
  const hasOwn = Object.prototype.hasOwnProperty;
  for (const [nsName, ns] of Object.entries(_namespaceRegistry)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const key of Object.keys(ns)) {
      if (key === 'default') continue;
      if (!hasOwn.call(ns, key)) continue;
      if (key in inlineNamespace) {
        _warnCollision(key, nsName, 'inline');
      }
    }
  }
}

function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const ctor = obj.constructor;
  if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet || ctor === Promise || ctor === Error) return obj;
  if (ctor === BigInt) return obj;
  if (ctor === URL || ctor === URLSearchParams) return obj;
  if (ArrayBuffer.isView(obj)) return obj;
  if (ctor === ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && ctor === SharedArrayBuffer)) return obj;
  if (ctor === Map) {
    const frozenMap = new Map();
    for (const [k, v] of obj) frozenMap.set(k, deepFreeze(v));
    try { Object.freeze(frozenMap); } catch { return obj; }
    return frozenMap;
  }
  if (ctor === Set) {
    const frozenSet = new Set();
    for (const v of obj) frozenSet.add(deepFreeze(v));
    try { Object.freeze(frozenSet); } catch { return obj; }
    return frozenSet;
  }
  if (Array.isArray(obj)) {
    const frozenArr = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      frozenArr[i] = deepFreeze(obj[i]);
    }
    try { Object.freeze(frozenArr); } catch { return obj; }
    return frozenArr;
  }
  const frozenObj = {};
  const hasOwn = Object.prototype.hasOwnProperty;
  for (const key of Object.keys(obj)) {
    if (!hasOwn.call(obj, key)) continue;
    frozenObj[key] = deepFreeze(obj[key]);
  }
  try { Object.freeze(frozenObj); } catch { return obj; }
  return frozenObj;
}

export { deepFreeze };

export function getBarrelMeta() {
  return __barrel__;
}

const inlineNamespace = /*#__PURE__*/ Object.freeze({
  compose: (...fns) => fns.length === 0 ? ObjectUtils.identity : FunctionalUtils.compose(...fns),
  pipe: (...fns) => fns.length === 0 ? ObjectUtils.identity : FunctionalUtils.pipe(...fns),
  zipWith: FunctionalUtils.zipWith,
  curry: FunctionalUtils.curry,
  partial: FunctionalUtils.partial,
  tap: FunctionalUtils.tap,
  flip, tryCatch, defaultTo, prop, getPath, pathOr, when, unless, ifElse, cond,
  allPass, anyPass, complement, always, T, F,
  head, tail, last, init, take, drop, takeLast, dropLast,
  pluck, find, findIndex, propEq, pathEq, contains,
  isPlainObject, isElement, isPromise, isFormData, isBlob, isFile, isArrayLike,
  evolve, dissoc, mergeDeepLeft, mergeDeepRight, project,
  memoizeBy, once: onceInline, match, replace, trim, toLower, toUpper,
  startsWith, endsWith, includes, split, join, reverse: reverseInline, sort,
  sortBy: sortByInline, uniqBy, flatten: flattenInline, zip, unzip,
  isWeakMap, isWeakSet, isArrayBuffer, isSharedArrayBuffer, isDataView,
  isTypedArray, isGenerator, isAsyncGenerator, isIterable, isAsyncIterable,
  parseJsonSafe: MiscUtils.parseJsonSafe,
  parseResponseJson: MiscUtils.parseResponseJson,
  isEmpty: MiscUtils.isEmpty,
  isEqual: MiscUtils.isEqual,
  prefersReducedMotion: MiscUtils.prefersReducedMotion,
  prefersDarkMode: MiscUtils.prefersDarkMode,
  fetchWithTimeout,
  waitForAsync
});

// Register namespaces so barrel.js can auto-derive export names
registerNamespaces(_namespaceRegistry);
registerInlineKeys(Object.keys(inlineNamespace).filter(k => k !== 'default'));
_checkExportCollisions();

export const __barrel__ = /*#__PURE__*/ Object.freeze({
  name: 'simplebeacon-dashboard-utils',
  description: 'Barrel re-export for js-es2018/utils/ sub-modules',
  moduleCount: NAMESPACE_NAMES.length,
  exportCount: getExportNames().length,
  namespaceCount: NAMESPACE_NAMES.length,
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  exports: getExportNames(),
  namespaces: NAMESPACE_NAMES
});

/**
 * Run inline smoke tests for critical barrel utilities.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function integrityTest() {
  const failures = [];
  function assert(label, condition) { if (!condition) failures.push(label); }

  assert('deepFreeze returns frozen object', Object.isFrozen(deepFreeze({ a: 1 })));
  assert('mergeDeepLeft precedence', JSON.stringify(mergeDeepLeft({ a: 1 }, { a: 2, b: 3 })) === JSON.stringify({ a: 1, b: 3 }));
  assert('mergeDeepRight precedence', JSON.stringify(mergeDeepRight({ a: 1 }, { a: 2, b: 3 })) === JSON.stringify({ a: 2, b: 3 }));
  assert('cond multiway', cond([[x => x > 0, x => x * 2]])(5) === 10);
  assert('allPass true', allPass([x => x > 0, x => x < 10])(5));
  assert('anyPass true', anyPass([x => x > 0, x => x > 10])(5));
  assert('getPath nested', getPath(['a', 'b'], { a: { b: 1 } }) === 1);
  assert('getPath string key', getPath('a.b', { a: { b: 1 } }) === 1);
  assert('isPromise cross-realm safe', isPromise(Promise.resolve(1)));
  assert('when applies', when(x => x > 0, x => x * 2, 5) === 10);
  assert('unless skips', unless(x => x > 0, x => x * 2, 5) === 5);
  assert('ifElse true branch', ifElse(x => x > 0, x => x * 2, x => x * 3, 5) === 10);
  assert('ifElse false branch', ifElse(x => x > 0, x => x * 2, x => x * 3, -5) === -15);
  assert('evolve transforms', JSON.stringify(evolve({ a: x => x + 1 }, { a: 1, b: 2 })) === JSON.stringify({ a: 2, b: 2 }));
  assert('project picks', JSON.stringify(project(['a'], [{ a: 1, b: 2 }])) === JSON.stringify([{ a: 1 }]));
  assert('contains membership', contains(2, [1, 2, 3]));
  assert('isPlainObject true', isPlainObject({}));
  assert('isPlainObject false for array', !isPlainObject([]));
  const zipped = zip([1, 2], ['a', 'b']);
  assert('zip pairs', JSON.stringify(zipped) === JSON.stringify([[1, 'a'], [2, 'b']]));
  const [ua, ub] = unzip(zipped);
  assert('unzip roundtrip', JSON.stringify(ua) === JSON.stringify([1, 2]) && JSON.stringify(ub) === JSON.stringify(['a', 'b']));

  return { passed: failures.length === 0, failures };
}

const defaultExport = /*#__PURE__*/ deepFreeze({
  string: StringUtils,
  number: NumberUtils,
  async: AsyncUtils,
  array: ArrayUtils,
  object: ObjectUtils,
  format: FormatUtils,
  dom: DomUtils,
  type: TypeUtils,
  functional: FunctionalUtils,
  storage: StorageUtils,
  url: UrlUtils,
  misc: MiscUtils,
  inline: inlineNamespace,
  __barrel__
});

export default defaultExport;
