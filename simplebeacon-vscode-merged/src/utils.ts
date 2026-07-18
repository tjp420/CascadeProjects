// simplebeacon-ignore memory-leak — utils facade re-exporting sub-modules
// All utilities have been split into focused sub-modules under src/utils/.
// This file re-exports everything for backward compatibility.

// ── VS Code helpers ──────────────────────────────────────────────
export {
  getNonce,
  showQuietMessage,
  getSbConfig,
  getExtensionVersion,
  checkCliAvailable,
  getCurrentFileDir,
  browseForFolder,
  PickerItem,
  PathMapping,
  getRecentFolders,
  addRecentFolder,
  removeRecentFolder,
  pickWorkspaceFolder,
  getWorkspaceRoot,
  isWorkspaceOpen,
  getWorkspaceFolderForFile,
  getWorkspaceFolderForUri,
  formatRelativePath,
  isInsideWorkspace,
  correctScanPath,
  runWithProgress,
  createDisposableStack,
  normalizeApiServerUrl,
} from './utils/vscode';

// ── String helpers ───────────────────────────────────────────────
export {
  escapeHtml,
  escapeRegExp,
  truncate,
  capitalize,
  stripHtml,
  kebabCase,
  camelCase,
  snakeCase,
  padStart,
  padEnd,
  pluralize,
  formatPercent,
  formatDate,
  relativeTime,
  formatDuration,
  titleCase,
  reverse,
  slugify,
  repeat,
  startsWith,
  endsWith,
  trim,
  splitLines,
  stripAnsi,
  wordCount,
} from './utils/string';

// ── Number helpers ─────────────────────────────────────────────
export {
  clamp,
  formatBytes,
  formatNumber,
  safeParseInt,
  safeParseFloat,
  roundTo,
  toFixedNumber,
  isNumeric,
  randomInt,
  sum,
  mean,
  min,
  max,
  sumBy,
  meanBy,
} from './utils/number';

// ── Object helpers ───────────────────────────────────────────────
export {
  deepClone,
  clone,
  pick,
  omit,
  isEmpty,
  ensureArray,
  deepEqual,
  defaults,
  merge,
  has,
  get,
  set,
  mapKeys,
  mapValues,
  at,
  unset,
  defaultsDeep,
  invert,
  values,
  keys,
  freezeDeep,
} from './utils/object';

// ── Array helpers ────────────────────────────────────────────────
export {
  unique,
  compact,
  flatten,
  range,
  sortBy,
  keyBy,
  chunk,
  times,
  randomChoice,
  intersection,
  difference,
  union,
  groupBy,
  partition,
  sample,
  shuffle,
  zip,
  head,
  tail,
  flattenDeep,
  take,
  drop,
  last,
  initial,
  findIndex,
  maxBy,
  minBy,
  countBy,
} from './utils/array';

// ── Async helpers ──────────────────────────────────────────────
export {
  sleep,
  delay,
  debounce,
  debounceLeading,
  debounceAsync,
  once,
  memoize,
  throttle,
  throttleAsync,
  withTimeout,
  waitFor,
  poll,
  waitForAsync,
  memoizeAsync,
  retry,
  parallel,
  series,
  waterfall,
  timeout,
  retryWithBackoff,
  createDeferred,
} from './utils/async';

// ── FS helpers ───────────────────────────────────────────────────
export {
  sha256,
  getFileHash,
  getFileHashAsync,
  readJsonFile,
  readTextFile,
  readJsonFileAsync,
  readTextFileAsync,
  writeJsonFile,
  writeTextFile,
  ensureDir,
  sanitizeFilename,
} from './utils/fs';

// ── Network helpers ──────────────────────────────────────────────
export { isValidUrl, parseQueryString, stringifyQueryString, buildUrl, resolveUrl } from './utils/network';

// ── Path helpers ─────────────────────────────────────────────────
export { normalizeScanPath, relativePath, isSubPath, getExt, ensureExt } from './utils/path';

// ── Type guards ──────────────────────────────────────────────────
export {
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isArray,
  isObject,
  isDate,
  isRegExp,
  isPromise,
  isError,
  isNull,
  isUndefined,
  isNil,
  isSymbol,
  isMap,
  isSet,
  isPlainObject,
} from './utils/type-guards';

// ── Misc helpers ─────────────────────────────────────────────────
export {
  assertNever,
  noop,
  isBlank,
  hash,
  tryFn,
  pMap,
  randomId,
  uid,
  seq,
  flow,
  negate,
  identity,
  constant,
} from './utils/misc';

// ── JSON helpers ─────────────────────────────────────────────────
export { parseJsonSafe, parseResponseJson, stringifySafe, isJson } from './utils/json';

// ── Clipboard helpers ────────────────────────────────────────────
export { copyToClipboard, readFromClipboard } from './utils/clipboard';

// ── Theme helpers ──────────────────────────────────────────────────
export {
  getThemeColor,
  prefersDarkMode,
  prefersLightMode,
  prefersReducedMotion,
  hexToRgba,
  shadeColor,
  contrastColor,
} from './utils/theme';

// ── Event helpers ─────────────────────────────────────────────────
export { createEventBus, createBroadcastChannel } from './utils/event';

// ── Polling helpers ──────────────────────────────────────────────
export { createPoller } from './utils/polling';

// ── Inline barrel-native utilities ────────────────────────────────
export { compose, pipe, zipWith, curry, partial, tap, flip, assert, tryCatch } from './utils/index';

// ── Namespace for grouped access ─────────────────────────────────
/**
 * Re-export all utilities under a single namespace for convenient
 * IDE autocompletion and `Utils.*` style usage.
 */
// Re-export the canonical Utils namespace from the barrel index to avoid drift.
export { Utils } from './utils/index';

// Re-export barrel helpers from index.ts for API consistency
export {
  freezeNamespace,
  getExportNames,
  getNamespaceNames,
  getInlineSelection,
  getBarrelMeta,
  getCollisionCount,
  validateBarrelIntegrity,
  integrityTest,
} from './utils/index';
export type { BarrelMeta } from './utils/index';
export type { Unary, AnyFunction, Curried } from './utils/index';
export { __barrel__ } from './utils/index';
