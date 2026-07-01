'use strict';

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
 */

// ── String helpers ───────────────────────────────────────────────
export {
  escapeHtml,
  escapeRegExp,
  normalizeSlashes,
  truncate,
  capitalize,
  hash,
  kebabCase,
  camelCase,
  snakeCase,
  padStart,
  padEnd,
  stripHtml,
  pluralize,
} from './utils-lib/string.js';

// ── Number helpers ─────────────────────────────────────────────
export {
  formatNumber,
  formatPercent,
  formatBytes,
  clamp,
  roundTo,
  toFixedNumber,
  formatDuration,
  sum,
  mean,
  maxBy,
  minBy,
  safeParseInt,
  safeParseFloat,
  random,
  randomId,
  uid,
} from './utils-lib/number.js';

// ── Async helpers ──────────────────────────────────────────────
export {
  sleep,
  delay,
  debounce,
  debounceAsync,
  debounceLeading,
  throttle,
  throttleAsync,
  once,
  memoize,
  memoizeAsync,
  withTimeout,
  tryFn,
  seq,
  flow,
  negate,
} from './utils-lib/async.js';

// ── Array helpers ────────────────────────────────────────────────
export {
  unique,
  compact,
  flatten,
  range,
  chunk,
  sample,
  shuffle,
  reverse,
  union,
  intersection,
  difference,
  groupBy,
  partition,
  sortBy,
  keyBy,
  times,
  randomChoice,
  ensureArray,
  countBy,
} from './utils-lib/array.js';

// ── Object helpers ─────────────────────────────────────────────
export {
  deepClone,
  clone,
  deepEqual,
  pick,
  omit,
  defaults,
  merge,
  invert,
  mapValues,
  mapKeys,
  has,
  get,
  set,
  zipObject,
  identity,
  constant,
  at,
  unset,
  defaultsDeep,
} from './utils-lib/object.js';

// ── URL helpers ──────────────────────────────────────────────────
export {
  apiBaseUrl,
  apiUrl,
  fetchWithTimeout,
  parseQueryString,
  stringifyQueryString,
  getQueryParam,
  setQueryParam,
  buildUrl,
  isValidUrl,
  isUrl,
} from './utils-lib/url.js';

// ── Storage helpers ────────────────────────────────────────────
export {
  localStorageGet,
  localStorageSet,
  localStorageRemove,
  localStorageGetString,
  localStorageSetString,
  sessionStorageGet,
  sessionStorageSet,
  sessionStorageRemove,
} from './utils-lib/storage.js';

// ── Theme helpers ────────────────────────────────────────────────
export {
  hexToRgba,
  shadeColor,
  contrastColor,
  getCssVar,
  setCssVar,
  prefersReducedMotion,
  prefersDarkMode,
} from './utils-lib/theme.js';

// ── DOM helpers ──────────────────────────────────────────────────
export {
  showToast,
  removeToastContainer,
  downloadFile,
  downloadJson,
  downloadBlob,
  downloadText,
  downloadCsv,
  hasClass,
  addClass,
  removeClass,
  toggleClass,
  getFocusableElements,
  focusFirst,
  createElement,
  removeAllChildren,
  scrollToElement,
  elementInViewport,
  observeIntersection,
  preloadImage,
  copyToClipboard,
  renderEmptyState,
} from './utils-lib/dom.js';

// ── Format helpers ─────────────────────────────────────────────
export {
  formatDate,
  relativeTime,
  redactPathForDisplay,
  isRedactedPathDisplay,
  formatPathInputValue,
  formatScanPathForDisplay,
  formatPathLabel,
  formatAiSummarySkipMessage,
  sanitizePrivacyData,
} from './utils-lib/format.js';

// ── Type guards ─────────────────────────────────────────────────
export {
  isBlank,
  isEmail,
  isNumeric,
  isInteger,
  isHexColor,
  isEmpty,
  isDefined,
  noop,
  assertNever,
  parseJsonSafe,
  isOnline,
  isVSCodeWebview,
  isStandalone,
  getVSCodeApi,
  getNonce,
  isNull,
  isUndefined,
  isNil,
  isSymbol,
  isMap,
  isSet,
} from './utils-lib/type.js';

// ── Namespace default export ──
import * as string from './utils-lib/string.js';
import * as number from './utils-lib/number.js';
import * as async from './utils-lib/async.js';
import * as array from './utils-lib/array.js';
import * as object from './utils-lib/object.js';
import * as url from './utils-lib/url.js';
import * as storage from './utils-lib/storage.js';
import * as theme from './utils-lib/theme.js';
import * as dom from './utils-lib/dom.js';
import * as format from './utils-lib/format.js';
import * as type from './utils-lib/type.js';

export default {
  string,
  number,
  async,
  array,
  object,
  url,
  storage,
  theme,
  dom,
  format,
  type
};
