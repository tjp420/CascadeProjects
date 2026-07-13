/**
 * @module utils
 * Barrel re-export for the `js-es2018/utils/` directory.
 * Generated from monolithic utils.js refactor.
 */

// ── Sub-module imports with error boundaries ──────────────────
// If a sub-module fails to load, export a stub so the dashboard doesn't crash.

/**
 * Wrap a submodule namespace so the dashboard doesn't crash if a helper is missing.
 * Note: ES static imports at the top of this module cannot be caught; a broken submodule
 * will still fail to load. This wrapper only guards against missing or malformed exports.
 * @param {string} name @returns {object}
 */
function safeImport(name, module) {
  if (module && typeof module === 'object') return module;
  if (typeof __SB_DEBUG_UTILS__ !== 'undefined' && __SB_DEBUG_UTILS__) {
    console.warn('[utils] Failed to load module:', name);
  }
  return new Proxy({}, {
    get: (_t, prop) => {
      // Never intercept well-known Symbol properties or internal inspection keys.
      if (typeof prop === 'symbol') return undefined;
      const key = String(prop);
      if (key === 'then' || key === 'toString' || key === 'valueOf' || key === 'constructor' || key === 'toJSON') return undefined;
      if (typeof __SB_DEBUG_UTILS__ !== 'undefined' && __SB_DEBUG_UTILS__) {
        console.warn('[utils] Missing export from ' + name + ': ' + key);
      }
      return () => undefined;
    },
    has: () => false,
    ownKeys: () => []
  });
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
/** @param {string} str @returns {string} */
export const trim             = StringUtils.trim;
/** @param {string} str @returns {string} */
export const toLower          = StringUtils.toLower;
/** @param {string} str @returns {string} */
export const toUpper          = StringUtils.toUpper;
/** @param {string} prefix @param {string} str @returns {boolean} */
export const startsWith       = StringUtils.startsWith;
/** @param {string} suffix @param {string} str @returns {boolean} */
export const endsWith         = StringUtils.endsWith;
/** @param {string} substr @param {string} str @returns {boolean} */
export const includes         = StringUtils.includes;
/** @param {string|RegExp} sep @param {string} str @returns {string[]} */
export const split            = StringUtils.split;
/** @param {string} sep @param {Array} list @returns {string} */
export const join             = StringUtils.join;
/** @param {RegExp} regex @param {string} str @returns {Array|null} */
export const match            = StringUtils.match;
/** @param {string|RegExp} pattern @param {string|Function} replacement @param {string} str @returns {string} */
export const replace          = StringUtils.replace;
/** @param {any} value @returns {boolean} */
export const isBlank          = StringUtils.isBlank;
/** @param {string} str @returns {string[]} */
export const words            = StringUtils.words;
/** @param {string} str @returns {number} */
export const wordCount        = StringUtils.wordCount;
/** @param {string} str @param {number} count @returns {string} */
export const repeat           = StringUtils.repeat;
/** @param {string} str @returns {string} */
export const titleCase        = StringUtils.titleCase;
/** @param {string} str @returns {string} */
export const slugify          = StringUtils.slugify;
/** @param {string} str @returns {string[]} */
export const splitLines       = StringUtils.splitLines;
/** @param {string} str @returns {string} */
export const stripAnsi        = StringUtils.stripAnsi;

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
export const head          = ArrayUtils.head;
export const tail          = ArrayUtils.tail;
export const last          = ArrayUtils.last;
export const init          = ArrayUtils.init;
export const take          = ArrayUtils.take;
export const drop          = ArrayUtils.drop;
export const takeLast      = ArrayUtils.takeLast;
export const dropLast      = ArrayUtils.dropLast;
export const pluck         = ArrayUtils.pluck;
export const find          = ArrayUtils.find;
export const contains      = ArrayUtils.contains;
export const uniqBy        = ArrayUtils.uniqBy;
export const sortByInline  = ArrayUtils.sortByInline;
export const flattenInline = ArrayUtils.flattenInline;
export const zip           = ArrayUtils.zip;
export const unzip         = ArrayUtils.unzip;
export const project       = ArrayUtils.project;
export const reverseInline = ArrayUtils.reverseInline;
export const sort          = ArrayUtils.sort;

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
export const evolve       = ObjectUtils.evolve;
export const dissoc       = ObjectUtils.dissoc;
export const mergeDeepLeft = ObjectUtils.mergeDeepLeft;
export const mergeDeepRight = ObjectUtils.mergeDeepRight;
export const memoizeBy    = ObjectUtils.memoizeBy;

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
export const isPromise      = TypeUtils.isPromise;
export const isError        = TypeUtils.isError;
export const isPlainObject  = TypeUtils.isPlainObject;
export const isElement      = TypeUtils.isElement;
export const isFormData     = TypeUtils.isFormData;
export const isBlob         = TypeUtils.isBlob;
export const isFile         = TypeUtils.isFile;
export const isArrayLike    = TypeUtils.isArrayLike;
export const isWeakMap      = TypeUtils.isWeakMap;
export const isWeakSet      = TypeUtils.isWeakSet;
export const isArrayBuffer  = TypeUtils.isArrayBuffer;
export const isSharedArrayBuffer = TypeUtils.isSharedArrayBuffer;
export const isDataView     = TypeUtils.isDataView;
export const isTypedArray  = TypeUtils.isTypedArray;
export const isGenerator    = TypeUtils.isGenerator;
export const isAsyncGenerator = TypeUtils.isAsyncGenerator;
export const isIterable     = TypeUtils.isIterable;
export const isAsyncIterable = TypeUtils.isAsyncIterable;

// ── Functional helpers ───────────────────────────────────────
export const compose       = FunctionalUtils.compose;
export const pipe          = FunctionalUtils.pipe;
export const zipWith       = FunctionalUtils.zipWith;
export const curry         = FunctionalUtils.curry;
export const partial       = FunctionalUtils.partial;
export const tap           = FunctionalUtils.tap;
export const flip          = FunctionalUtils.flip;
export const tryCatch      = FunctionalUtils.tryCatch;
export const defaultTo     = FunctionalUtils.defaultTo;
export const prop          = FunctionalUtils.prop;
export const getPath       = FunctionalUtils.getPath;
export const pathOr        = FunctionalUtils.pathOr;
export const when          = FunctionalUtils.when;
export const unless        = FunctionalUtils.unless;
export const ifElse        = FunctionalUtils.ifElse;
export const cond          = FunctionalUtils.cond;
export const allPass       = FunctionalUtils.allPass;
export const anyPass       = FunctionalUtils.anyPass;
export const complement    = FunctionalUtils.complement;
export const always        = FunctionalUtils.always;
export const T             = FunctionalUtils.T;
export const F             = FunctionalUtils.F;
export const propEq        = FunctionalUtils.propEq;
export const pathEq        = FunctionalUtils.pathEq;
export const onceInline    = FunctionalUtils.onceInline;

// Inline helpers are re-exported from the utils/ submodules above.

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
import { resolveDashboardProjectPath } from './utils-lib/path.js';
export { resolveDashboardProjectPath };

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
export const stringifySafe   = MiscUtils.stringifySafe;

// ── Barrel helpers ─────────────────────────────────────────────
import { getExportNames, exportNames, validateBarrelIntegrity, registerNamespaces, registerInlineKeys, setDefaultBarrel } from './utils/barrel.js';
export { getExportNames, exportNames, validateBarrelIntegrity, registerNamespaces, registerInlineKeys, setDefaultBarrel };

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
  if (typeof __SB_DEBUG_UTILS__ !== 'undefined' && __SB_DEBUG_UTILS__) {
    console.warn(`[utils] Export collision: "${name}" exists in both "${ns1}" and "${ns2}" namespaces.`);
  }
}

function _checkExportCollisions() {
  const hasOwn = Object.prototype.hasOwnProperty;
  const namespaces = Object.entries(_namespaceRegistry).filter(([, ns]) => ns && typeof ns === 'object');
  // Namespace vs inline namespace.
  for (const [nsName, ns] of namespaces) {
    for (const key of Object.keys(ns)) {
      if (key === 'default') continue;
      if (!hasOwn.call(ns, key)) continue;
      if (key in inlineNamespace) {
        _warnCollision(key, nsName, 'inline');
      }
    }
  }
  // Namespace vs namespace (check each pair once).
  for (let i = 0; i < namespaces.length; i++) {
    const [nsNameA, nsA] = namespaces[i];
    for (let j = i + 1; j < namespaces.length; j++) {
      const [nsNameB, nsB] = namespaces[j];
      for (const key of Object.keys(nsA)) {
        if (key === 'default') continue;
        if (!hasOwn.call(nsA, key)) continue;
        if (hasOwn.call(nsB, key)) {
          _warnCollision(key, nsNameA, nsNameB);
        }
      }
    }
  }
}

function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  let ctor;
  try { ctor = obj.constructor; } catch { return obj; }
  if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet || ctor === Promise || ctor === Error) return obj;
  if (ctor === BigInt) return obj;
  if (ctor === URL || ctor === URLSearchParams) return obj;
  if (ArrayBuffer.isView(obj)) return obj;
  if (ctor === ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && ctor === SharedArrayBuffer)) return obj;
  try {
    if (ctor === Map) {
      const frozenMap = new Map();
      for (const [k, v] of obj) frozenMap.set(k, deepFreeze(v));
      Object.freeze(frozenMap);
      return frozenMap;
    }
    if (ctor === Set) {
      const frozenSet = new Set();
      for (const v of obj) frozenSet.add(deepFreeze(v));
      Object.freeze(frozenSet);
      return frozenSet;
    }
    if (Array.isArray(obj)) {
      const frozenArr = new Array(obj.length);
      for (let i = 0; i < obj.length; i++) {
        frozenArr[i] = deepFreeze(obj[i]);
      }
      Object.freeze(frozenArr);
      return frozenArr;
    }
    const frozenObj = {};
    const hasOwn = Object.prototype.hasOwnProperty;
    for (const key of Object.keys(obj)) {
      if (!hasOwn.call(obj, key)) continue;
      frozenObj[key] = deepFreeze(obj[key]);
    }
    Object.freeze(frozenObj);
    return frozenObj;
  } catch {
    return obj;
  }
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
  flip: FunctionalUtils.flip,
  tryCatch: FunctionalUtils.tryCatch,
  defaultTo: FunctionalUtils.defaultTo,
  prop: FunctionalUtils.prop,
  getPath: FunctionalUtils.getPath,
  pathOr: FunctionalUtils.pathOr,
  when: FunctionalUtils.when,
  unless: FunctionalUtils.unless,
  ifElse: FunctionalUtils.ifElse,
  cond: FunctionalUtils.cond,
  allPass: FunctionalUtils.allPass,
  anyPass: FunctionalUtils.anyPass,
  complement: FunctionalUtils.complement,
  always: FunctionalUtils.always,
  T: FunctionalUtils.T,
  F: FunctionalUtils.F,
  propEq: FunctionalUtils.propEq,
  pathEq: FunctionalUtils.pathEq,
  once: FunctionalUtils.onceInline,
  head: ArrayUtils.head,
  tail: ArrayUtils.tail,
  last: ArrayUtils.last,
  init: ArrayUtils.init,
  take: ArrayUtils.take,
  drop: ArrayUtils.drop,
  takeLast: ArrayUtils.takeLast,
  dropLast: ArrayUtils.dropLast,
  pluck: ArrayUtils.pluck,
  find: ArrayUtils.find,
  findIndex: ArrayUtils.findIndex,
  contains: ArrayUtils.contains,
  isPlainObject: TypeUtils.isPlainObject,
  isElement: TypeUtils.isElement,
  isPromise: TypeUtils.isPromise,
  isFormData: TypeUtils.isFormData,
  isBlob: TypeUtils.isBlob,
  isFile: TypeUtils.isFile,
  isArrayLike: TypeUtils.isArrayLike,
  evolve: ObjectUtils.evolve,
  dissoc: ObjectUtils.dissoc,
  mergeDeepLeft: ObjectUtils.mergeDeepLeft,
  mergeDeepRight: ObjectUtils.mergeDeepRight,
  project: ArrayUtils.project,
  memoizeBy: ObjectUtils.memoizeBy,
  match: StringUtils.match,
  replace: StringUtils.replace,
  trim: StringUtils.trim,
  toLower: StringUtils.toLower,
  toUpper: StringUtils.toUpper,
  startsWith: StringUtils.startsWith,
  endsWith: StringUtils.endsWith,
  includes: StringUtils.includes,
  split: StringUtils.split,
  join: StringUtils.join,
  reverse: ArrayUtils.reverseInline,
  sort: ArrayUtils.sort,
  sortBy: ArrayUtils.sortByInline,
  uniqBy: ArrayUtils.uniqBy,
  flatten: ArrayUtils.flattenInline,
  zip: ArrayUtils.zip,
  unzip: ArrayUtils.unzip,
  isWeakMap: TypeUtils.isWeakMap,
  isWeakSet: TypeUtils.isWeakSet,
  isArrayBuffer: TypeUtils.isArrayBuffer,
  isSharedArrayBuffer: TypeUtils.isSharedArrayBuffer,
  isDataView: TypeUtils.isDataView,
  isTypedArray: TypeUtils.isTypedArray,
  isGenerator: TypeUtils.isGenerator,
  isAsyncGenerator: TypeUtils.isAsyncGenerator,
  isIterable: TypeUtils.isIterable,
  isAsyncIterable: TypeUtils.isAsyncIterable,
  parseJsonSafe: MiscUtils.parseJsonSafe,
  parseResponseJson: MiscUtils.parseResponseJson,
  stringifySafe: MiscUtils.stringifySafe,
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

setDefaultBarrel(__barrel__);

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

  // String helpers
  assert('trim removes whitespace', trim('  hello  ') === 'hello');
  assert('toLower lowercases', toLower('Hello') === 'hello');
  assert('startsWith true', startsWith('he', 'hello'));
  assert('endsWith true', endsWith('lo', 'hello'));
  assert('includes true', includes('ell', 'hello'));
  assert('split works', JSON.stringify(split('-', 'a-b')) === JSON.stringify(['a', 'b']));
  assert('join works', join('-', ['a', 'b']) === 'a-b');
  assert('match works', match(/h.l/, 'hello') !== null);
  assert('replace works', replace('l', 'L', 'hello') === 'heLlo');

  // Array helpers
  assert('head first', head([1, 2, 3]) === 1);
  assert('tail rest', JSON.stringify(tail([1, 2, 3])) === JSON.stringify([2, 3]));
  assert('last last', last([1, 2, 3]) === 3);
  assert('take', JSON.stringify(take(2, [1, 2, 3])) === JSON.stringify([1, 2]));
  assert('drop', JSON.stringify(drop(1, [1, 2, 3])) === JSON.stringify([2, 3]));
  assert('pluck', JSON.stringify(pluck('a', [{ a: 1 }, { a: 2 }])) === JSON.stringify([1, 2]));
  assert('find', find(x => x > 1, [1, 2, 3]) === 2);
  assert('uniqBy', JSON.stringify(uniqBy(x => x, [1, 2, 2, 3])) === JSON.stringify([1, 2, 3]));
  assert('sortByInline', JSON.stringify(sortByInline(x => x, [3, 1, 2])) === JSON.stringify([1, 2, 3]));
  assert('flattenInline', JSON.stringify(flattenInline(2, [[1, 2], [3, [4]]])) === JSON.stringify([1, 2, 3, [4]]));
  assert('reverseInline', JSON.stringify(reverseInline([1, 2, 3])) === JSON.stringify([3, 2, 1]));
  assert('project', JSON.stringify(project(['a'], [{ a: 1, b: 2 }])) === JSON.stringify([{ a: 1 }]));

  // Type helpers
  assert('isFormData', isFormData(new FormData()));
  assert('isBlob', isBlob(new Blob()));
  assert('isFile', isFile(new File([], 'x')));
  assert('isArrayLike', isArrayLike([1, 2, 3]));
  assert('isTypedArray', isTypedArray(new Uint8Array(1)));
  assert('isGenerator', isGenerator(function* () {}));
  assert('isIterable', isIterable([1, 2, 3]));
  assert('isAsyncIterable', isAsyncIterable({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true }) }) }));

  // Functional helpers
  assert('flip', flip((a, b) => a - b)(2, 5) === 3);
  assert('tryCatch', tryCatch(() => { throw new Error('x'); }, () => 'caught')() === 'caught');
  assert('defaultTo NaN', defaultTo('def', NaN) === 'def');
  assert('prop', prop('a', { a: 1 }) === 1);
  assert('pathOr', pathOr('def', ['a', 'b'], { a: {} }) === 'def');
  assert('when', when(x => x > 0, x => x * 2, 5) === 10);
  assert('ifElse false', ifElse(x => x > 0, x => x * 2, x => x * 3, -5) === -15);
  assert('allPass', allPass([x => x > 0, x => x < 10])(5));
  assert('anyPass', anyPass([x => x > 0, x => x > 10])(5));
  assert('complement', complement(x => x > 0)(-1));
  assert('always', always(7)() === 7);
  assert('T', T()());
  assert('F', !F()());
  assert('propEq', propEq('a', 1, { a: 1 }));
  assert('pathEq', pathEq(['a', 'b'], 2, { a: { b: 2 } }));
  const onceFn = onceInline(() => Math.random());
  assert('onceInline first equals second', onceFn() === onceFn());

  // Object helpers
  assert('evolve', JSON.stringify(evolve({ a: x => x + 1 }, { a: 1, b: 2 })) === JSON.stringify({ a: 2, b: 2 }));
  assert('dissoc', JSON.stringify(dissoc('a', { a: 1, b: 2 })) === JSON.stringify({ b: 2 }));
  assert('memoizeBy', memoizeBy(x => x * 2, x => x)(3) === 6);

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
  safeStorage: SafeStorage,
  eventBus: EventBus,
  inline: inlineNamespace,
  __barrel__
});

export default defaultExport;
