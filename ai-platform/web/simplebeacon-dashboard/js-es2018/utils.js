'use strict';

/**
 * @module utils
 * Barrel re-export for the `js-es2018/utils-lib/` directory.
 *
 * Re-exports every named export from focused sub-modules so consumers
 * can import a single module or cherry-pick from sub-modules.
 *
 * @example <caption>Named exports (tree-shakeable)</caption>
 * import { escapeHtml, clamp, deepClone } from './utils.js';
 *
 * @example <caption>Grouped namespace access</caption>
 * import Utils from './utils.js';
 * Utils.string.escapeHtml('<div>');
 *
 * @example <caption>Destructuring — alias `async` because it is a reserved keyword</caption>
 * import Utils from './utils.js';
 * const { string, async: asyncUtils } = Utils;
 * string.escapeHtml('<div>');
 * asyncUtils.sleep(100);
 *
 * @file ai-platform/web/simplebeacon-dashboard/js-es2018/utils.js
 */

// ── string ──
export {
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
  padEnd,
  pluralize
} from './utils-lib/string.js';

// ── dom ──
export {
  escapeHtml,
  showToast,
  removeToastContainer,
  renderEmptyState
} from './utils-lib/dom.js';

// ── format ──
export {
  formatNumber,
  formatPercent,
  formatAiSummarySkipMessage,
  formatDate,
  relativeTime,
  timeAgo,
  formatBytes,
  formatDuration
} from './utils-lib/format.js';

// ── download ──
export {
  downloadJson,
  downloadBlob,
  downloadText
} from './utils-lib/download.js';

// ── async ──
export {
  debounce,
  debounceAsync,
  debounceLeading,
  throttle,
  throttleAsync,
  once,
  sleep,
  retry,
  memoize,
  memoizeAsync,
  withTimeout,
  poll,
  waitForAsync,
  pMap,
  delay
} from './utils-lib/async.js';

// ── array ──
export {
  unique,
  flatten,
  range,
  chunk,
  compact,
  groupBy,
  partition,
  sortBy,
  keyBy,
  sample,
  shuffle,
  sum,
  mean,
  maxBy,
  minBy,
  reverse,
  union,
  intersection,
  difference,
  countBy,
  findIndex,
  times,
  randomChoice
} from './utils-lib/array.js';

// ── object ──
export {
  deepClone,
  parseJsonSafe,
  isEmpty,
  ensureArray,
  deepEqual,
  pick,
  omit,
  defaults,
  merge,
  clone,
  defaultsDeep,
  at,
  unset,
  get,
  set,
  has,
  mapValues,
  mapKeys,
  invert
} from './utils-lib/object.js';

// ── clipboard ──
export {
  copyToClipboard
} from './utils-lib/clipboard.js';

// ── url ──
export {
  isValidUrl,
  parseQueryString,
  stringifyQueryString
} from './utils-lib/url.js';

// ── crypto ──
export {
  getNonce,
  hash,
  randomId,
  uid
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
  sessionStorageRemove
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
  assertNever,
  noop,
  tryFn
} from './utils-lib/function.js';

// ── fetch ──
export {
  fetchWithTimeout
} from './utils-lib/fetch.js';

// ── path ──
export {
  normalizeSlashes,
  redactPathForDisplay,
  isRedactedPathDisplay,
  formatPathInputValue,
  formatScanPathForDisplay,
  formatPathLabel
} from './utils-lib/path.js';

// ── Namespace default export ──
import * as string from './utils-lib/string.js';
import * as dom from './utils-lib/dom.js';
import * as format from './utils-lib/format.js';
import * as download from './utils-lib/download.js';
import * as async from './utils-lib/async.js';
import * as array from './utils-lib/array.js';
import * as object from './utils-lib/object.js';
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
import * as path from './utils-lib/path.js';

export default {
  string,
  dom,
  format,
  download,
  async,
  array,
  object,
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
  fetch,
  path
};
