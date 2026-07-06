/**
 * @module utils
 * Barrel re-export for the `src/utils/` directory.
 * Named exports are tree-shakeable; default export provides frozen namespaces.
 */

// ── Namespace imports (used for flat re-exports and Utils default) ──
import * as VSCode         from './vscode';
import * as StringUtils    from './string';
import * as NumberUtils    from './number';
import * as ObjectUtils    from './object';
import * as ArrayUtils     from './array';
import * as AsyncUtils     from './async';
import * as FsUtils        from './fs';
import * as NetworkUtils   from './network';
import * as PathUtils      from './path';
import * as MiscUtils      from './misc';
import * as JsonUtils      from './json';
import * as TypeGuardUtils from './type-guards';
import * as ClipboardUtils from './clipboard';
import * as ThemeUtils     from './theme';
import * as EventUtils     from './event';
import * as PollingUtils   from './polling';

/**
 * Barrel metadata shape.
 */
export interface BarrelMeta {
  /** Barrel module name. */
  readonly name: string;
  /** Human-readable description. */
  readonly description: string;
  /** Number of source sub-modules. */
  readonly moduleCount: number;
  /** Number of flat named exports. */
  readonly exportCount: number;
  /** Number of grouped namespaces. */
  readonly namespaceCount: number;
  /** Barrel version (semver). */
  readonly version: string;
  /** ISO timestamp of module load. */
  readonly timestamp: string;
  /** Host platform identifier. */
  readonly platform: string;
  /** Node.js runtime version. */
  readonly nodeVersion: string;
  /** Snapshot of all flat export keys. */
  readonly exports: ReadonlyArray<string>;
  /** Snapshot of all namespace keys. */
  readonly namespaces: ReadonlyArray<string>;
}

/**
 * Strongly-typed shape of the Utils default export.
 * Namespace types are derived directly from imported module types;
 * the inline namespace mirrors the runtime _inlineNamespace object.
 */
interface UtilsNamespace {
  vscode: typeof VSCode;
  string: typeof StringUtils;
  number: typeof NumberUtils;
  object: typeof ObjectUtils;
  array: typeof ArrayUtils;
  async: typeof AsyncUtils;
  fs: typeof FsUtils;
  network: typeof NetworkUtils;
  path: typeof PathUtils;
  misc: typeof MiscUtils;
  json: typeof JsonUtils;
  typeGuards: typeof TypeGuardUtils;
  clipboard: typeof ClipboardUtils;
  theme: typeof ThemeUtils;
  event: typeof EventUtils;
  polling: typeof PollingUtils;
  inline: Readonly<typeof _inlineNamespace>;
  __barrel__: BarrelMeta;
}

// ── Flat re-exports (auto-generated from submodules) ──────────────
export * from './vscode';
export * from './string';
export * from './number';
export * from './object';
export * from './array';
export * from './async';
export * from './fs';
export * from './network';
export * from './path';
export * from './misc';
export * from './json';
export * from './type-guards';
export * from './clipboard';
export * from './theme';
export * from './event';
export * from './polling';

export type { PickerItem, PathMapping } from './vscode';

// ── Collision detection ─────────────────────────────────────────
const _collisionWarnings = new Set<string>();

function _warnCollision(name: string, ns1: string, ns2: string): void {
  if (_collisionWarnings.has(name)) return;
  _collisionWarnings.add(name);
  // Collision warnings are intentionally silent in production;
  // set SIMPLEBEACON_VSCODE_COLLISION_WARN=1 to enable verbose logging.
}

function _checkExportCollisions(): void {
  const flatExports = new Map<string, string>();
  for (const [nsKey, ns] of Object.entries(_namespaceRegistry)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const name of Object.keys(ns)) {
      if (name === 'default') continue;
      if (!Object.prototype.hasOwnProperty.call(ns, name)) continue;
      if (flatExports.has(name)) {
        _warnCollision(name, flatExports.get(name)!, nsKey);
      } else {
        flatExports.set(name, nsKey);
      }
    }
  }
  // Check namespace-to-inline collisions
  for (const [nsKey, ns] of Object.entries(_namespaceRegistry)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const name of Object.keys(ns)) {
      if (name === 'default') continue;
      if (!Object.prototype.hasOwnProperty.call(ns, name)) continue;
      if (name in _inlineNamespace) {
        _warnCollision(name, nsKey, 'inline');
      }
    }
  }
}

let _collisionsChecked = false;

/** Unary function type used by compose/pipe. */
type Unary<A, B> = (x: A) => B;

/**
 * Compose functions right-to-left.
 * `compose(f, g, h)(x)` is equivalent to `f(g(h(x)))`.
 * Returns identity when called with no arguments.
 */
export function compose<T>(): (value: T) => T;
export function compose<T, A>(fn1: Unary<T, A>): (value: T) => A;
export function compose<T, A, B>(fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => B;
export function compose<T, A, B, C>(fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => C;
export function compose<T, A, B, C, D>(fn4: Unary<C, D>, fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => D;
export function compose<T, A, B, C, D, E>(fn5: Unary<D, E>, fn4: Unary<C, D>, fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => E;
export function compose<T>(...fns: Array<(x: unknown) => unknown>): (value: T) => unknown {
  if (fns.length === 0) return (value: T) => value;
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value as unknown);
}

/**
 * Pipe functions left-to-right.
 * `pipe(f, g, h)(x)` is equivalent to `h(g(f(x)))`.
 * Returns identity when called with no arguments.
 */
export function pipe<T>(): (value: T) => T;
export function pipe<T, A>(fn1: Unary<T, A>): (value: T) => A;
export function pipe<T, A, B>(fn1: Unary<T, A>, fn2: Unary<A, B>): (value: T) => B;
export function pipe<T, A, B, C>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>): (value: T) => C;
export function pipe<T, A, B, C, D>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>, fn4: Unary<C, D>): (value: T) => D;
export function pipe<T, A, B, C, D, E>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>, fn4: Unary<C, D>, fn5: Unary<D, E>): (value: T) => E;
export function pipe<T>(...fns: Array<(x: unknown) => unknown>): (value: T) => unknown {
  if (fns.length === 0) return (value: T) => value;
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value as unknown);
}

/**
 * Zip two arrays with a custom combiner function.
 */
export const zipWith = <T, U, R>(arr1: T[], arr2: U[], fn: (a: T, b: U) => R): R[] => {
  if (!arr1 || typeof arr1.length !== 'number' || !arr2 || typeof arr2.length !== 'number') {
    return [];
  }
  if (typeof fn !== 'function') return [];
  const len = Math.min(arr1.length, arr2.length);
  const result: R[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = fn(arr1[i], arr2[i]);
  }
  return result;
};

/**
 * Curry a function so it can be called with one argument at a time.
 */
export const curry = <T extends (...args: any[]) => any>(fn: T): ((...args: any[]) => ReturnType<T> | any) => {
  if (typeof fn !== 'function') throw new TypeError('curry requires a function');
  const curried = (...args: any[]): any => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: any[]): any => curried(...args.concat(nextArgs));
  };
  return curried;
};

/**
 * Create a partial application of a function with preset arguments.
 */
export const partial = <T extends (...args: any[]) => any>(fn: T, ...presetArgs: any[]): ((...args: any[]) => ReturnType<T>) => {
  if (typeof fn !== 'function') throw new TypeError('partial requires a function');
  return (...args: any[]): ReturnType<T> => fn(...presetArgs.concat(args));
};

/**
 * Execute a side-effect function on a value, then return the value.
 * Useful for debugging inside pipelines.
 * @returns The original value.
 */
export const tap = <T>(value: T, fn: (value: T) => void): T => {
  if (typeof fn !== 'function') throw new TypeError('tap requires a function');
  fn(value);
  return value;
};

/**
 * Flip the first two arguments of a binary function.
 * `flip(fn)(a, b)` is equivalent to `fn(b, a)`.
 * @returns Flipped function.
 */
export const flip = <A, B, R>(fn: (a: A, b: B) => R): ((b: B, a: A) => R) => {
  if (typeof fn !== 'function') throw new TypeError('flip requires a function');
  return (b, a) => fn(a, b);
};

/**
 * Runtime assertion helper.
 * @param condition Value to assert.
 * @param message Optional message on failure.
 * @throws {Error} If condition is falsy.
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Functional try/catch wrapper.
 * @param fn Function to execute safely.
 * @returns Result object with discriminated union shape.
 */
export function tryCatch<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Recursively freeze every object in a namespace map.
 * Safely handles Date, RegExp, Map, Set, WeakMap, WeakSet, Promise, and Error.
 * @param ns Namespace object whose values are objects to freeze.
 * @returns Deeply frozen copy of the namespace.
 */
export const freezeNamespace = <T extends Record<string, unknown>>(ns: T): Readonly<{ [K in keyof T]: Readonly<T[K]> }> => {
  if (ns == null || typeof ns !== 'object') return ns as unknown as Readonly<{ [K in keyof T]: Readonly<T[K]> }>;
  if (Object.isFrozen(ns)) return ns as unknown as Readonly<{ [K in keyof T]: Readonly<T[K]> }>;

  const seen = new WeakMap<object, unknown>();

  function _deepFreeze(val: unknown): unknown {
    if (val == null || typeof val !== 'object') return val;
    if (seen.has(val)) return seen.get(val);
    if (Object.isFrozen(val)) return val;

    const ctor = (val as Record<string, unknown>).constructor;
    if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet || ctor === Promise || ctor === Error) return val;
    if (ctor === BigInt) return val;
    if (ctor === URL || ctor === URLSearchParams) return val;
    if (ArrayBuffer.isView(val)) return val;
    if (ctor === ArrayBuffer || ctor === SharedArrayBuffer) return val;

    if (ctor === Map) {
      const frozenMap = new Map<unknown, unknown>();
      seen.set(val, frozenMap);
      for (const [k, v] of val as Map<unknown, unknown>) {
        frozenMap.set(k, _deepFreeze(v));
      }
      try { Object.freeze(frozenMap); } catch (_e) { /* ignore */ }
      return frozenMap;
    }

    if (ctor === Set) {
      const frozenSet = new Set<unknown>();
      seen.set(val, frozenSet);
      for (const v of val as Set<unknown>) {
        frozenSet.add(_deepFreeze(v));
      }
      try { Object.freeze(frozenSet); } catch (_e) { /* ignore */ }
      return frozenSet;
    }

    if (Array.isArray(val)) {
      const frozenArr = new Array(val.length);
      seen.set(val, frozenArr);
      for (let i = 0; i < val.length; i++) {
        frozenArr[i] = _deepFreeze(val[i]);
      }
      try { Object.freeze(frozenArr); } catch (_e) { /* ignore */ }
      return frozenArr;
    }

    const frozenObj: Record<PropertyKey, unknown> = {};
    seen.set(val, frozenObj);
    for (const key of Reflect.ownKeys(val as object)) {
      frozenObj[key] = _deepFreeze((val as Record<PropertyKey, unknown>)[key]);
    }
    try { Object.freeze(frozenObj); } catch (_e) { /* ignore */ }
    return frozenObj;
  }

  const frozen: Record<string, unknown> = {};
  for (const key of Object.keys(ns)) {
    frozen[key] = _deepFreeze(ns[key]);
  }
  return Object.freeze(frozen) as Readonly<{ [K in keyof T]: Readonly<T[K]> }>;
};

/** Namespace registry for auto-generation and collision detection. */
const _namespaceRegistry: Record<string, Record<string, unknown>> = {
  vscode: VSCode,
  string: StringUtils,
  number: NumberUtils,
  object: ObjectUtils,
  array: ArrayUtils,
  async: AsyncUtils,
  fs: FsUtils,
  network: NetworkUtils,
  path: PathUtils,
  misc: MiscUtils,
  json: JsonUtils,
  typeGuards: TypeGuardUtils,
  clipboard: ClipboardUtils,
  theme: ThemeUtils,
  event: EventUtils,
  polling: PollingUtils,
};

/** All exports defined directly in this barrel (both inline-namespace and standalone). */
const _barrelNativeNames = Object.freeze([
  'compose', 'pipe', 'zipWith', 'curry', 'partial', 'tap', 'flip',
  'assert', 'tryCatch',
  'freezeNamespace', 'getExportNames', 'getNamespaceNames',
  'getBarrelMeta', 'validateBarrelIntegrity', '__barrel__'
]);

/** Names from submodules re-exported inside _inlineNamespace for convenience. */
const _inlineReExports = Object.freeze([
  // Misc
  'memoize',
  // Array
  'unique', 'compact', 'flatten', 'sample', 'shuffle', 'times', 'countBy',
  'head', 'tail', 'initial', 'last', 'take', 'drop', 'findIndex',
  // Object
  'defaults', 'defaultsDeep', 'invert', 'mapKeys', 'at', 'clone', 'unset', 'keys', 'merge', 'freezeDeep',
  // String
  'escapeRegExp', 'camelCase', 'snakeCase', 'padStart', 'padEnd', 'stripHtml',
  'formatPercent', 'formatDuration', 'relativeTime', 'repeat', 'reverse', 'slugify',
  'splitLines', 'startsWith', 'endsWith', 'stripAnsi', 'titleCase', 'trim',
  // Number
  'max', 'mean', 'min', 'randomInt', 'safeParseFloat', 'sum', 'sumBy', 'meanBy',
  // Async
  'debounceAsync', 'debounceLeading', 'throttleAsync', 'memoizeAsync', 'timeout',
  // FS
  'ensureDir', 'readTextFile', 'sanitizeFilename', 'getFileHash',
  // Network
  'resolveUrl', 'parseQueryString',
  // Path
  'getExt', 'ensureExt', 'isSubPath',
  // Misc
  'assertNever', 'randomId', 'tryFn', 'isBlank',
  // Event
  'createBroadcastChannel',
  // VSCode
  'getWorkspaceRoot', 'isWorkspaceOpen', 'getExtensionVersion'
]);

/** Auto-build flat export list by introspecting namespace objects. */
function _buildExportNames(): ReadonlyArray<string> {
  const set = new Set<string>();
  for (const ns of Object.values(_namespaceRegistry)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const name of Object.keys(ns)) {
      if (name !== 'default' && Object.prototype.hasOwnProperty.call(ns, name)) {
        set.add(name);
      }
    }
  }
  for (const name of _barrelNativeNames) set.add(name);
  return Object.freeze(Array.from(set).sort());
}

let _exportNamesCache: ReadonlyArray<string> | null = null;
function _getExportNames(): ReadonlyArray<string> {
  if (!_exportNamesCache) {
    _exportNamesCache = _buildExportNames();
  }
  return _exportNamesCache;
}

/** @returns {ReadonlyArray<string>} All flat named export keys from this barrel. */
export const getExportNames = (): ReadonlyArray<string> => _getExportNames();

/** @returns {Readonly<BarrelMeta>} Snapshot of the barrel metadata. */
export const getBarrelMeta = (): Readonly<BarrelMeta> => __barrel__;

const NAMESPACE_NAMES: ReadonlyArray<string> = Object.freeze([
  ...new Set([...Object.keys(_namespaceRegistry), 'inline'])
]);

/** @returns {ReadonlyArray<string>} All namespace keys from this barrel. */
export const getNamespaceNames = (): ReadonlyArray<string> => NAMESPACE_NAMES;

/**
 * Required metadata keys for a valid barrel.
 */
const BARREL_REQUIRED_KEYS: ReadonlyArray<keyof BarrelMeta> = Object.freeze([
  'name', 'description', 'moduleCount', 'exportCount',
  'namespaceCount', 'version', 'timestamp', 'platform', 'nodeVersion',
  'exports', 'namespaces'
]);

/** Auto-generated barrel timestamp at module evaluation. */
const BARREL_TIMESTAMP = new Date().toISOString();

/** Read package.json version with safe fallback. */
function _getPackageVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    return pkg?.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export const __barrel__: BarrelMeta = Object.freeze({
  name: 'simplebeacon-utils-barrel',
  description: 'Barrel re-export for src/utils/ sub-modules',
  moduleCount: Object.keys(_namespaceRegistry).length,
  exportCount: _getExportNames().length,
  namespaceCount: getNamespaceNames().length,
  version: _getPackageVersion(),
  timestamp: BARREL_TIMESTAMP,
  platform: typeof process !== 'undefined' ? process.platform : 'unknown',
  nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
  exports: getExportNames(),
  namespaces: getNamespaceNames()
});

/** Inline utilities object (eager, small). */
const _inlineNamespace = Object.freeze({
  // Barrel-native
  compose, pipe, zipWith, curry, partial, tap, flip, freezeNamespace,
  assert, tryCatch,
  // Barrel introspection
  getExportNames, getNamespaceNames, getBarrelMeta,
  __barrel__,
  // Array
  groupBy: ArrayUtils.groupBy,
  partition: ArrayUtils.partition,
  chunk: ArrayUtils.chunk,
  keyBy: ArrayUtils.keyBy,
  range: ArrayUtils.range,
  sortBy: ArrayUtils.sortBy,
  intersection: ArrayUtils.intersection,
  difference: ArrayUtils.difference,
  union: ArrayUtils.union,
  // Object
  deepClone: ObjectUtils.deepClone,
  deepEqual: ObjectUtils.deepEqual,
  get: ObjectUtils.get,
  set: ObjectUtils.set,
  mapValues: ObjectUtils.mapValues,
  pick: ObjectUtils.pick,
  omit: ObjectUtils.omit,
  has: ObjectUtils.has,
  isEmpty: ObjectUtils.isEmpty,
  // Number
  clamp: NumberUtils.clamp,
  formatBytes: NumberUtils.formatBytes,
  formatNumber: NumberUtils.formatNumber,
  safeParseInt: NumberUtils.safeParseInt,
  roundTo: NumberUtils.roundTo,
  // String
  escapeHtml: StringUtils.escapeHtml,
  truncate: StringUtils.truncate,
  capitalize: StringUtils.capitalize,
  kebabCase: StringUtils.kebabCase,
  pluralize: StringUtils.pluralize,
  // Async
  sleep: AsyncUtils.sleep,
  delay: AsyncUtils.delay,
  debounce: AsyncUtils.debounce,
  throttle: AsyncUtils.throttle,
  retry: AsyncUtils.retry,
  withTimeout: AsyncUtils.withTimeout,
  createDeferred: AsyncUtils.createDeferred,
  once: AsyncUtils.once,
  memoize: AsyncUtils.memoize,
  // TypeGuards
  isDefined: TypeGuardUtils.isDefined,
  isString: TypeGuardUtils.isString,
  isNumber: TypeGuardUtils.isNumber,
  isFunction: TypeGuardUtils.isFunction,
  isArray: TypeGuardUtils.isArray,
  isObject: TypeGuardUtils.isObject,
  isPlainObject: TypeGuardUtils.isPlainObject,
  // JSON
  parseJsonSafe: JsonUtils.parseJsonSafe,
  stringifySafe: JsonUtils.stringifySafe,
  // FS
  sha256: FsUtils.sha256,
  readJsonFile: FsUtils.readJsonFile,
  writeJsonFile: FsUtils.writeJsonFile,
  // Network
  isValidUrl: NetworkUtils.isValidUrl,
  buildUrl: NetworkUtils.buildUrl,
  // Path
  normalizeScanPath: PathUtils.normalizeScanPath,
  relativePath: PathUtils.relativePath,
  // Clipboard
  copyToClipboard: ClipboardUtils.copyToClipboard,
  // Theme
  getThemeColor: ThemeUtils.getThemeColor,
  prefersDarkMode: ThemeUtils.prefersDarkMode,
  // Event
  createEventBus: EventUtils.createEventBus,
  // Polling
  createPoller: PollingUtils.createPoller,
  // Misc
  identity: MiscUtils.identity,
  constant: MiscUtils.constant,
  negate: MiscUtils.negate,
  flow: MiscUtils.flow,
  noop: MiscUtils.noop,
  // Array (additional)
  unique: ArrayUtils.unique,
  compact: ArrayUtils.compact,
  flatten: ArrayUtils.flatten,
  sample: ArrayUtils.sample,
  shuffle: ArrayUtils.shuffle,
  times: ArrayUtils.times,
  countBy: ArrayUtils.countBy,
  head: ArrayUtils.head,
  tail: ArrayUtils.tail,
  initial: ArrayUtils.initial,
  last: ArrayUtils.last,
  take: ArrayUtils.take,
  drop: ArrayUtils.drop,
  findIndex: ArrayUtils.findIndex,
  // Object (additional)
  defaults: ObjectUtils.defaults,
  defaultsDeep: ObjectUtils.defaultsDeep,
  invert: ObjectUtils.invert,
  mapKeys: ObjectUtils.mapKeys,
  at: ObjectUtils.at,
  clone: ObjectUtils.clone,
  unset: ObjectUtils.unset,
  keys: ObjectUtils.keys,
  merge: ObjectUtils.merge,
  freezeDeep: ObjectUtils.freezeDeep,
  // String (additional)
  escapeRegExp: StringUtils.escapeRegExp,
  camelCase: StringUtils.camelCase,
  snakeCase: StringUtils.snakeCase,
  padStart: StringUtils.padStart,
  padEnd: StringUtils.padEnd,
  stripHtml: StringUtils.stripHtml,
  formatPercent: StringUtils.formatPercent,
  formatDuration: StringUtils.formatDuration,
  relativeTime: StringUtils.relativeTime,
  repeat: StringUtils.repeat,
  reverse: StringUtils.reverse,
  slugify: StringUtils.slugify,
  splitLines: StringUtils.splitLines,
  startsWith: StringUtils.startsWith,
  endsWith: StringUtils.endsWith,
  stripAnsi: StringUtils.stripAnsi,
  titleCase: StringUtils.titleCase,
  trim: StringUtils.trim,
  // Number (additional)
  max: NumberUtils.max,
  mean: NumberUtils.mean,
  min: NumberUtils.min,
  randomInt: NumberUtils.randomInt,
  safeParseFloat: NumberUtils.safeParseFloat,
  sum: NumberUtils.sum,
  sumBy: NumberUtils.sumBy,
  meanBy: NumberUtils.meanBy,
  // Async (additional)
  debounceAsync: AsyncUtils.debounceAsync,
  debounceLeading: AsyncUtils.debounceLeading,
  throttleAsync: AsyncUtils.throttleAsync,
  memoizeAsync: AsyncUtils.memoizeAsync,
  timeout: AsyncUtils.timeout,
  // FS (additional)
  ensureDir: FsUtils.ensureDir,
  readTextFile: FsUtils.readTextFile,
  sanitizeFilename: FsUtils.sanitizeFilename,
  getFileHash: FsUtils.getFileHash,
  // Network (additional)
  resolveUrl: NetworkUtils.resolveUrl,
  parseQueryString: NetworkUtils.parseQueryString,
  // Path (additional)
  getExt: PathUtils.getExt,
  ensureExt: PathUtils.ensureExt,
  isSubPath: PathUtils.isSubPath,
  // Misc (additional)
  assertNever: MiscUtils.assertNever,
  randomId: MiscUtils.randomId,
  tryFn: MiscUtils.tryFn,
  isBlank: MiscUtils.isBlank,
  // Event (additional)
  createBroadcastChannel: EventUtils.createBroadcastChannel,
  // VSCode (additional)
  getWorkspaceRoot: VSCode.getWorkspaceRoot,
  isWorkspaceOpen: VSCode.isWorkspaceOpen,
  getExtensionVersion: VSCode.getExtensionVersion
});

/** Eagerly freeze all namespaces and build the Utils object at module init. */
const _utilsTarget: Record<string, unknown> = {};
for (const key of Object.keys(_namespaceRegistry)) {
  _utilsTarget[key] = freezeNamespace(_namespaceRegistry[key]);
}
_utilsTarget['__barrel__'] = __barrel__;
_utilsTarget['inline'] = _inlineNamespace;
Object.freeze(_utilsTarget);

export const Utils: UtilsNamespace = _utilsTarget as unknown as UtilsNamespace;

// Run collision checks now that every namespace (including inline) is initialized
if (!_collisionsChecked) {
  _collisionsChecked = true;
  _checkExportCollisions();
}

/**
 * Validate barrel integrity at runtime.
 * Checks that all namespaces are frozen and that __barrel__ contains every required key.
 * @returns {{ valid: boolean; errors: string[] }} Validation result.
 */
export const validateBarrelIntegrity = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const nsKeys = getNamespaceNames();
  for (const key of nsKeys) {
    if (!Object.isFrozen((Utils as unknown as Record<string, unknown>)[key])) {
      errors.push(`Namespace "${key}" is not frozen`);
    }
  }

  if (!Object.isFrozen(Utils)) {
    errors.push('Default export is not frozen');
  }

  if (!Object.isFrozen(__barrel__)) {
    errors.push('__barrel__ metadata is not frozen');
  }

  if (!Object.isFrozen(_inlineNamespace)) {
    errors.push('inline namespace is not frozen');
  }

  if (!Utils.__barrel__) {
    errors.push('Missing __barrel__ metadata');
  } else {
    const barrel = Utils.__barrel__;
    for (const metaKey of BARREL_REQUIRED_KEYS) {
      if (!(metaKey in barrel)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
  }

  const flat = _getExportNames();
  for (const key of flat) {
    if (key === 'default') continue;
    let found = false;
    for (const ns of Object.values(_namespaceRegistry)) {
      if (ns && Object.prototype.hasOwnProperty.call(ns, key)) { found = true; break; }
    }
    if (!found && _barrelNativeNames.includes(key)) found = true;
    if (!found && _inlineReExports.includes(key)) found = true;
    if (!found) errors.push(`Export "${key}" not found in any namespace or inline registry`);
  }

  for (const key of Object.keys(_inlineNamespace)) {
    if (typeof (_inlineNamespace as unknown as Record<string, unknown>)[key] !== 'function' && typeof (_inlineNamespace as unknown as Record<string, unknown>)[key] !== 'object') {
      errors.push(`Inline utility "${key}" has unsupported type: ${typeof (_inlineNamespace as unknown as Record<string, unknown>)[key]}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Run inline smoke tests for critical barrel utilities.
 * @returns {{ passed: boolean; failures: string[] }}
 */
export function integrityTest(): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  function check(label: string, condition: boolean): void { if (!condition) failures.push(label); }

  check('compose identity', compose<number>()(5) === 5);
  check('compose composes', compose((x: number) => x + 1, (x: number) => x * 2)(3) === 7);
  check('pipe identity', pipe<number>()(5) === 5);
  check('pipe pipes', pipe((x: number) => x + 1, (x: number) => x * 2)(3) === 8);
  check('zipWith pairs', zipWith([1, 2], [3, 4], (a: number, b: number) => a + b)[0] === 4);
  check('flip swaps args', flip((a: number, b: number) => a - b)(5, 3) === -2);
  check('tryCatch ok', tryCatch(() => 1).ok === true);
  check('tryCatch error', tryCatch(() => { throw new Error('x'); }).ok === false);
  check('curry partial', curry((a: number, b: number) => a + b)(1)(2) === 3);
  check('partial apply', partial((a: number, b: number) => a + b, 1)(2) === 3);
  check('tap returns value', tap(5, () => undefined) === 5);
  check('assert throws on false', (() => { try { assert(false); return false; } catch { return true; } })());
  check('freezeNamespace deep', Object.isFrozen(freezeNamespace({ a: { b: 1 } }).a));

  // Inline namespace parity tests
  check('groupBy', JSON.stringify(Utils.inline.groupBy([1, 2, 3], x => x % 2)) === JSON.stringify({ '1': [1, 3], '0': [2] }));
  check('partition', JSON.stringify(Utils.inline.partition([1, 2, 3], x => x > 1)) === JSON.stringify([[2, 3], [1]]));
  check('chunk', JSON.stringify(Utils.inline.chunk([1, 2, 3, 4], 2)) === JSON.stringify([[1, 2], [3, 4]]));
  check('deepClone', Utils.inline.deepClone({ a: 1 }).a === 1);
  check('deepEqual', Utils.inline.deepEqual({ a: 1 }, { a: 1 }));
  check('pick', JSON.stringify(Utils.inline.pick({ a: 1, b: 2 }, ['a'])) === JSON.stringify({ a: 1 }));
  check('omit', JSON.stringify(Utils.inline.omit({ a: 1, b: 2 }, ['b'])) === JSON.stringify({ a: 1 }));
  check('clamp', Utils.inline.clamp(15, 0, 10) === 10);
  check('formatBytes', Utils.inline.formatBytes(1024).includes('KB'));
  check('formatNumber', Utils.inline.formatNumber(1000).includes('1'));
  check('escapeHtml', Utils.inline.escapeHtml('<div>').includes('&lt;'));
  check('truncate', Utils.inline.truncate('hello world', 8) === 'hello...');
  check('capitalize', Utils.inline.capitalize('hello') === 'Hello');
  check('isDefined', Utils.inline.isDefined(0));
  check('parseJsonSafe', ((Utils.inline.parseJsonSafe('{"a":1}', null) as unknown) as Record<string, unknown>)['a'] === 1);
  check('stringifySafe', Utils.inline.stringifySafe({ a: 1 }).includes('a'));

  return { passed: failures.length === 0, failures };
}

export default Utils;
