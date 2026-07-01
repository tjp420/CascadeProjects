/**
 * @module utils
 * Barrel re-export for the `src/utils/` directory.
 *
 * Re-exports every named export from focused sub-modules (vscode, string,
 * number, object, array, async, fs, network, path, misc, json, typeGuards)
 * so consumers can import a single module or cherry-pick from sub-modules.
 *
 * Import from `'./utils'` to get every utility, or import from
 * `'./utils/string'` (etc.) for a focused module.
 *
 * Named exports (tree-shakeable):
 * ```ts
 * import { escapeHtml, clamp, deepClone } from './utils';
 * ```
 *
 * Grouped namespace access (deeply frozen at runtime):
 * ```ts
 * import Utils from './utils';
 * Utils.string.escapeHtml('<div>');
 * Object.isFrozen(Utils);        // true
 * Object.isFrozen(Utils.string); // true
 * ```
 *
 * Destructuring — alias `async` because it is a reserved keyword:
 * ```ts
 * import Utils from './utils';
 * const { string, async: asyncUtils } = Utils;
 * string.escapeHtml('<div>');
 * asyncUtils.sleep(100);
 * Object.isFrozen(string);      // true
 * Object.isFrozen(asyncUtils); // true
 * ```
 *
 * @file src/utils/index.ts
 */

// ── VS Code helpers ──────────────────────────────────────────────
export {
  getNonce,
  showQuietMessage,
  getSbConfig,
  getExtensionVersion,
  checkCliAvailable,
  getCurrentFileDir,
  browseForFolder,
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
  PickerItem,
  PathMapping,
} from './vscode';

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
} from './string';

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
} from './number';

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
} from './object';

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
} from './array';

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
} from './async';

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
} from './fs';

// ── Network helpers ──────────────────────────────────────────────
export {
  isValidUrl,
  parseQueryString,
  stringifyQueryString,
  buildUrl,
  resolveUrl,
} from './network';

// ── Path helpers ─────────────────────────────────────────────────
export {
  normalizeScanPath,
  relativePath,
  isSubPath,
  getExt,
  ensureExt,
} from './path';

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
} from './type-guards';

// ── Misc helpers ───────────────────────────────────────────────────
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
} from './misc';

// ── JSON helpers ─────────────────────────────────────────────────
export {
  parseJsonSafe,
  stringifySafe,
  isJson,
} from './json';

/**
 * Re-export all utilities under a single namespace for convenient
 * IDE autocompletion and `Utils.*` style usage.
 *
 * The entire namespace is deeply frozen at runtime and typed as `Readonly<>`
 * so any mutation attempt is caught by TypeScript at compile time.
 *
 * @example
 * // Dot-notation access (works for every category)
 * Utils.string.escapeHtml('<div>');
 *
 * @example
 * // VS Code helpers
 * Utils.vscode.getNonce();
 * Utils.vscode.showQuietMessage('Done');
 *
 * @example
 * // Destructuring — alias `async` because it is a reserved keyword
 * const { string, async: asyncUtils } = Utils;
 * string.escapeHtml('<div>');
 * asyncUtils.sleep(100);
 *
 * @example
 * // Runtime immutability
 * Object.isFrozen(Utils);        // true
 * Object.isFrozen(Utils.string); // true
 */
import * as VSCode from './vscode';
import * as StringUtils from './string';
import * as NumberUtils from './number';
import * as ObjectUtils from './object';
import * as ArrayUtils from './array';
import * as AsyncUtils from './async';
import * as FsUtils from './fs';
import * as NetworkUtils from './network';
import * as PathUtils from './path';
import * as MiscUtils from './misc';
import * as JsonUtils from './json';
import * as TypeGuardUtils from './type-guards';

const Utils: Readonly<{
  vscode: Readonly<typeof VSCode>;
  string: Readonly<typeof StringUtils>;
  number: Readonly<typeof NumberUtils>;
  object: Readonly<typeof ObjectUtils>;
  array: Readonly<typeof ArrayUtils>;
  async: Readonly<typeof AsyncUtils>;
  fs: Readonly<typeof FsUtils>;
  network: Readonly<typeof NetworkUtils>;
  path: Readonly<typeof PathUtils>;
  misc: Readonly<typeof MiscUtils>;
  json: Readonly<typeof JsonUtils>;
  typeGuards: Readonly<typeof TypeGuardUtils>;
}> = Object.freeze({
  vscode: Object.freeze(VSCode),
  string: Object.freeze(StringUtils),
  number: Object.freeze(NumberUtils),
  object: Object.freeze(ObjectUtils),
  array: Object.freeze(ArrayUtils),
  async: Object.freeze(AsyncUtils),
  fs: Object.freeze(FsUtils),
  network: Object.freeze(NetworkUtils),
  path: Object.freeze(PathUtils),
  misc: Object.freeze(MiscUtils),
  json: Object.freeze(JsonUtils),
  typeGuards: Object.freeze(TypeGuardUtils),
});

export { Utils };
export default Utils;
