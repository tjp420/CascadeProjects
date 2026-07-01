'use strict';

/**
 * @module utils
 * Barrel re-export for the `js-es2018/utils-lib/` directory.
 *
 * Re-exports every named export from focused sub-modules so consumers
 * can import a single module or cherry-pick from sub-modules.
 *
 * Named exports (tree-shakeable):
 * ```js
 * import { escapeHtml, clamp, deepClone } from './utils.js';
 * ```
 *
 * Grouped namespace access (frozen at runtime):
 * ```js
 * import Utils from './utils.js';
 * Utils.string.escapeHtml('<div>');
 * Object.isFrozen(Utils); // true
 * ```
 *
 * Destructuring — alias `async` because it is a reserved keyword:
 * ```js
 * import Utils from './utils.js';
 * const { string, async: asyncUtils } = Utils;
 * string.escapeHtml('<div>');
 * asyncUtils.sleep(100);
 * ```
 *
 * @file dashboard-web/js-es2018/utils.js
 */

// ── string ──
export {
  escapeHtml,
  escapeRegExp,
  truncate,
  capitalize,
  words,
  repeat,
  titleCase,
  slugify,
  isBlank,
  stripHtml,
  kebabCase,
  camelCase,
  snakeCase,
  padStart,
  padEnd
} from './utils-lib/string.js';

// ── dom ──
export {
  showToast,
  removeToastContainer,
  createElement,
  removeAllChildren,
  renderEmptyState,
  scrollToElement,
  elementInViewport
} from './utils-lib/dom.js';

// ── format ──
export {
  formatNumber,
  formatPercent,
  formatBytes,
  formatDuration,
  formatDate,
  relativeTime,
  normalizeSlashes,
  redactPathForDisplay,
  isRedactedPathDisplay,
  formatPathInputValue,
  formatScanPathForDisplay,
  formatPathLabel,
  formatAiSummarySkipMessage
} from './utils-lib/format.js';

// ── download ──
export {
  downloadJson,
  downloadBlob,
  downloadText,
  downloadCsv
} from './utils-lib/download.js';

// ── async ──
export {
  debounce,
  throttle,
  once,
  debounceAsync,
  debounceLeading,
  sleep,
  retry,
  poll,
  waitForAsync,
  pMap,
  withTimeout,
  memoize,
  memoizeAsync
} from './utils-lib/async.js';

// ── array ──
export {
  groupBy,
  partition,
  unique,
  flatten,
  range,
  chunk,
  sample,
  shuffle,
  zip,
  head,
  tail,
  initial,
  last,
  sum,
  mean,
  maxBy,
  minBy,
  reverse,
  union,
  intersection,
  difference,
  sortBy,
  keyBy,
  times,
  randomChoice,
  compact,
  countBy,
  findIndex
} from './utils-lib/array.js';

// ── object ──
export {
  deepClone,
  safeJSONParse,
  isEmpty,
  ensureArray,
  deepEqual,
  clone,
  defaults,
  defaultsDeep,
  merge,
  invert,
  mapValues,
  mapKeys,
  pick,
  omit,
  get,
  set,
  unset,
  at,
  has
} from './utils-lib/object.js';

// ── color ──
export {
  hexToRgba,
  shadeColor,
  contrastColor
} from './utils-lib/color.js';

// ── clipboard ──
export {
  copyToClipboard
} from './utils-lib/clipboard.js';

// ── url ──
export {
  apiBaseUrl,
  apiUrl,
  parseQueryString,
  stringifyQueryString,
  isValidUrl
} from './utils-lib/url.js';

// ── crypto ──
export {
  getNonce,
  hash,
  randomId,
  uid,
  random
} from './utils-lib/crypto.js';

// ── type ──
export {
  isDefined,
  isNull,
  isUndefined,
  isNil,
  isSymbol,
  isMap,
  isSet
} from './utils-lib/type.js';

// ── vscode ──
export {
  isVSCodeWebview,
  isStandalone,
  getVSCodeApi
} from './utils-lib/vscode.js';

// ── privacy ──
export {
  sanitizePrivacyData
} from './utils-lib/privacy.js';

// ── storage ──
export {
  localStorageGet,
  localStorageSet,
  localStorageRemove,
  sessionStorageGet,
  sessionStorageSet,
  localStorageGetString,
  localStorageSetString
} from './utils-lib/storage.js';

// ── number ──
export {
  clamp,
  inRange,
  roundTo,
  safeParseInt,
  safeParseFloat
} from './utils-lib/number.js';

// ── accessibility ──
export {
  prefersReducedMotion,
  prefersDarkMode
} from './utils-lib/accessibility.js';

// ── function ──
export {
  seq,
  flow,
  negate,
  identity,
  constant,
  assertNever,
  tryFn,
  noop
} from './utils-lib/function.js';

// ── fetch ──
export {
  fetchWithTimeout
} from './utils-lib/fetch.js';

// ── Namespace default export ──
import * as string from './utils-lib/string.js';
import * as dom from './utils-lib/dom.js';
import * as format from './utils-lib/format.js';
import * as download from './utils-lib/download.js';
import * as async from './utils-lib/async.js';
import * as array from './utils-lib/array.js';
import * as object from './utils-lib/object.js';
import * as color from './utils-lib/color.js';
import * as clipboard from './utils-lib/clipboard.js';
import * as url from './utils-lib/url.js';
import * as crypto from './utils-lib/crypto.js';
import * as type from './utils-lib/type.js';
import * as vscode from './utils-lib/vscode.js';
import * as privacy from './utils-lib/privacy.js';
import * as storage from './utils-lib/storage.js';
import * as number from './utils-lib/number.js';
import * as accessibility from './utils-lib/accessibility.js';
import * as fn from './utils-lib/function.js';
import * as fetch from './utils-lib/fetch.js';

export default {
  string,
  dom,
  format,
  download,
  async,
  array,
  object,
  color,
  clipboard,
  url,
  crypto,
  type,
  vscode,
  privacy,
  storage,
  number,
  accessibility,
  function: fn,
  fetch
};
