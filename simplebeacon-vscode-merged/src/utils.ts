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
  isDefined,
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
export {
  isValidUrl,
  parseQueryString,
  stringifyQueryString,
  buildUrl,
  resolveUrl,
} from './utils/network';

// ── Path helpers ─────────────────────────────────────────────────
export {
  normalizeScanPath,
  relativePath,
  isSubPath,
  getExt,
  ensureExt,
} from './utils/path';

// ── Type guards ──────────────────────────────────────────────────
export {
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
export {
  parseJsonSafe,
  stringifySafe,
  isJson,
} from './utils/json';

// ── Namespace for grouped access ─────────────────────────────────
/**
 * Re-export all utilities under a single namespace for convenient
 * IDE autocompletion and `Utils.*` style usage.
 */
import * as VSCode from './utils/vscode';
import * as StringUtils from './utils/string';
import * as NumberUtils from './utils/number';
import * as ObjectUtils from './utils/object';
import * as ArrayUtils from './utils/array';
import * as AsyncUtils from './utils/async';
import * as FsUtils from './utils/fs';
import * as NetworkUtils from './utils/network';
import * as PathUtils from './utils/path';
import * as MiscUtils from './utils/misc';
import * as JsonUtils from './utils/json';
import * as TypeGuardUtils from './utils/type-guards';

export namespace Utils {
  export const vscode = VSCode;
  export const string = StringUtils;
  export const number = NumberUtils;
  export const object = ObjectUtils;
  export const array = ArrayUtils;
  export const async = AsyncUtils;
  export const fs = FsUtils;
  export const network = NetworkUtils;
  export const path = PathUtils;
  export const misc = MiscUtils;
  export const json = JsonUtils;
  export const typeGuards = TypeGuardUtils;
}
