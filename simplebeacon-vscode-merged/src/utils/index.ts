/**
 * @module utils
 * Barrel re-export for the `src/utils/` directory.
 * Named exports are tree-shakeable; default export provides frozen namespaces.
 */

// ── Namespace imports (used for flat re-exports and Utils default) ──
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
import * as ClipboardUtils from './clipboard';
import * as ThemeUtils from './theme';
import * as EventUtils from './event';
import * as PollingUtils from './polling';
import * as FunctionalUtils from './functional';

// ── Flat re-exports (tree-shakeable named exports) ─────────────────
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
export * from './functional';

/**
 * Typed view of the namespace registry values, used for introspection and collision checks.
 */
type NamespaceRecord = Record<string, Record<string, unknown>>;

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
  readonly platform: NodeJS.Platform | 'unknown';
  /** Node.js runtime version. */
  readonly nodeVersion: string;
  /** Snapshot of all flat export keys. */
  readonly exports: ReadonlyArray<string>;
  /** Snapshot of all namespace keys. */
  readonly namespaces: ReadonlyArray<string>;
}

// ── Collision detection ─────────────────────────────────────────
const _collisionWarnings = new Set<string>();

function _warnCollision(name: string, ns1: string, ns2: string): void {
  if (_collisionWarnings.has(name)) return;
  _collisionWarnings.add(name);
  if (typeof process !== 'undefined' && process.env?.SIMPLEBEACON_VSCODE_COLLISION_WARN === '1') {
    console.warn(`[utils barrel] Export name collision: "${name}" exists in both "${ns1}" and "${ns2}"`);
  }
}

function _checkExportCollisions(): void {
  const flatExports = new Map<string, string>();
  _forEachRegistryExport((name, nsKey) => {
    if (flatExports.has(name)) {
      _warnCollision(name, flatExports.get(name)!, nsKey);
    } else {
      flatExports.set(name, nsKey);
    }
    if (name in _getInlineNamespace()) {
      _warnCollision(name, nsKey, 'inline');
    }
  });
}

/** @returns {number} Number of unique export-name collisions detected so far. */
export const getCollisionCount = (): number => {
  _ensureCollisionsChecked();
  return _collisionWarnings.size;
};

let _collisionsChecked = false;
function _ensureCollisionsChecked(): void {
  if (!_collisionsChecked) {
    _collisionsChecked = true;
    _checkExportCollisions();
  }
}

/** Deep immutable version of a type. Preserves primitive, Date, RegExp, Map, Set, etc. */
type DeepReadonly<T> = T extends
  ((...args: unknown[]) => unknown) | Date | RegExp | Error | URL | URLSearchParams | Promise<unknown> | bigint
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends ArrayBuffer | SharedArrayBuffer
        ? T
        : T extends Array<infer U>
          ? ReadonlyArray<DeepReadonly<U>>
          : T extends object
            ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;

/**
 * Re-export freezeNamespace from the object submodule with the original DeepReadonly return type.
 * @param ns Namespace object whose values are objects to freeze.
 * @returns Deeply frozen copy of the namespace.
 */
export const freezeNamespace = <T extends Record<string, unknown>>(ns: T): DeepReadonly<T> =>
  ObjectUtils.freezeNamespace(ns) as DeepReadonly<T>;

/** Namespace registry for auto-generation and collision detection. */
const _namespaceRegistry = {
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
  functional: FunctionalUtils,
} as const;

type NamespaceMap = typeof _namespaceRegistry;

/** Iterate every named export on each namespace in the registry. */
function _forEachRegistryExport(fn: (name: string, nsKey: string, ns: Record<string, unknown>) => void): void {
  const registry = _namespaceRegistry as NamespaceRecord;
  for (const [nsKey, ns] of Object.entries(registry)) {
    if (!ns || typeof ns !== 'object') continue;
    for (const name of Object.keys(ns)) {
      if (name === 'default' || !Object.prototype.hasOwnProperty.call(ns, name)) continue;
      fn(name, nsKey, ns);
    }
  }
}

/** All exports defined directly in this barrel (both inline-namespace and standalone). */
const _barrelNativeNames = Object.freeze([
  'getExportNames',
  'getNamespaceNames',
  'getBarrelMeta',
  'validateBarrelIntegrity',
  'integrityTest',
  'getCollisionCount',
  'getInlineSelection',
  '__barrel__',
]);

/** Auto-build flat export list by introspecting namespace objects. */
function _buildExportNames(): ReadonlyArray<string> {
  const set = new Set<string>();
  _forEachRegistryExport((name) => set.add(name));
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
  ...new Set([...Object.keys(_namespaceRegistry), 'inline']),
]);

/** @returns {ReadonlyArray<string>} All namespace keys from this barrel. */
export const getNamespaceNames = (): ReadonlyArray<string> => NAMESPACE_NAMES;

/** @returns {Readonly<typeof _inlineSelection>} The curated inline namespace selection. */
export const getInlineSelection = (): Readonly<typeof _inlineSelection> => _inlineSelection;

/**
 * Required metadata keys for a valid barrel.
 */
const BARREL_REQUIRED_KEYS: ReadonlyArray<keyof BarrelMeta> = Object.freeze([
  'name',
  'description',
  'moduleCount',
  'exportCount',
  'namespaceCount',
  'version',
  'timestamp',
  'platform',
  'nodeVersion',
  'exports',
  'namespaces',
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
  get exportCount() {
    return _getExportNames().length;
  },
  namespaceCount: getNamespaceNames().length,
  version: _getPackageVersion(),
  timestamp: BARREL_TIMESTAMP,
  platform: (typeof process !== 'undefined' ? process.platform : 'unknown') as NodeJS.Platform | 'unknown',
  nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
  get exports() {
    return _getExportNames();
  },
  namespaces: getNamespaceNames(),
});

/**
 * Curated selection of utility names exposed on Utils.inline.
 * Generated from the previous hand-written namespace to preserve the public API.
 */
const _inlineSelection = {
  functional: ['compose', 'pipe', 'zipWith', 'curry', 'partial', 'tap', 'flip', 'assert', 'tryCatch'],
  string: [
    'escapeHtml',
    'truncate',
    'capitalize',
    'kebabCase',
    'pluralize',
    'formatDate',
    'escapeRegExp',
    'wordCount',
    'camelCase',
    'snakeCase',
    'padStart',
    'padEnd',
    'stripHtml',
    'formatPercent',
    'formatDuration',
    'relativeTime',
    'repeat',
    'reverse',
    'slugify',
    'splitLines',
    'startsWith',
    'endsWith',
    'stripAnsi',
    'titleCase',
    'trim',
  ],
  number: [
    'clamp',
    'formatBytes',
    'formatNumber',
    'toFixedNumber',
    'isNumeric',
    'safeParseInt',
    'roundTo',
    'max',
    'mean',
    'min',
    'randomInt',
    'safeParseFloat',
    'sum',
    'sumBy',
    'meanBy',
  ],
  object: [
    'freezeNamespace',
    'deepClone',
    'deepEqual',
    'get',
    'set',
    'mapValues',
    'pick',
    'omit',
    'has',
    'isEmpty',
    'ensureArray',
    'defaults',
    'defaultsDeep',
    'invert',
    'values',
    'mapKeys',
    'at',
    'clone',
    'unset',
    'keys',
    'merge',
    'freezeDeep',
  ],
  array: [
    'groupBy',
    'partition',
    'chunk',
    'keyBy',
    'range',
    'sortBy',
    'intersection',
    'difference',
    'union',
    'flattenDeep',
    'zip',
    'randomChoice',
    'unique',
    'compact',
    'flatten',
    'sample',
    'shuffle',
    'times',
    'countBy',
    'head',
    'tail',
    'initial',
    'last',
    'take',
    'drop',
    'findIndex',
    'maxBy',
    'minBy',
  ],
  async: [
    'sleep',
    'delay',
    'debounce',
    'throttle',
    'retry',
    'withTimeout',
    'createDeferred',
    'once',
    'memoize',
    'waitFor',
    'poll',
    'parallel',
    'series',
    'waterfall',
    'debounceAsync',
    'debounceLeading',
    'throttleAsync',
    'memoizeAsync',
    'waitForAsync',
    'retryWithBackoff',
    'timeout',
  ],
  typeGuards: [
    'isDefined',
    'isString',
    'isNumber',
    'isBoolean',
    'isFunction',
    'isArray',
    'isObject',
    'isPlainObject',
    'isDate',
    'isRegExp',
    'isPromise',
    'isError',
    'isNull',
    'isUndefined',
    'isNil',
    'isSymbol',
    'isMap',
    'isSet',
  ],
  json: ['parseJsonSafe', 'stringifySafe', 'parseResponseJson', 'isJson'],
  fs: [
    'sha256',
    'getFileHashAsync',
    'readJsonFile',
    'readJsonFileAsync',
    'readTextFileAsync',
    'writeJsonFile',
    'writeTextFile',
    'ensureDir',
    'readTextFile',
    'sanitizeFilename',
    'getFileHash',
  ],
  network: ['isValidUrl', 'buildUrl', 'stringifyQueryString', 'resolveUrl', 'parseQueryString'],
  path: ['normalizeScanPath', 'relativePath', 'getExt', 'ensureExt', 'isSubPath'],
  clipboard: ['copyToClipboard', 'readFromClipboard'],
  theme: [
    'getThemeColor',
    'prefersDarkMode',
    'prefersLightMode',
    'prefersReducedMotion',
    'hexToRgba',
    'shadeColor',
    'contrastColor',
  ],
  event: ['createEventBus', 'createBroadcastChannel'],
  polling: ['createPoller'],
  misc: [
    'identity',
    'constant',
    'negate',
    'flow',
    'noop',
    'hash',
    'pMap',
    'seq',
    'uid',
    'assertNever',
    'randomId',
    'tryFn',
    'isBlank',
  ],
  vscode: [
    'getNonce',
    'showQuietMessage',
    'getSbConfig',
    'checkCliAvailable',
    'getCurrentFileDir',
    'browseForFolder',
    'getRecentFolders',
    'addRecentFolder',
    'removeRecentFolder',
    'pickWorkspaceFolder',
    'getWorkspaceRoot',
    'getWorkspaceFolderForFile',
    'getWorkspaceFolderForUri',
    'isWorkspaceOpen',
    'formatRelativePath',
    'isInsideWorkspace',
    'correctScanPath',
    'runWithProgress',
    'createDisposableStack',
    'getExtensionVersion',
  ],
} as const satisfies { [K in keyof NamespaceMap]: readonly string[] };

/** Pick a curated subset of exports from a namespace object with preserved types. */
function pickExports<NS extends Record<string, unknown>, Names extends readonly (keyof NS & string)[]>(
  ns: NS,
  names: Names
): Pick<NS, Names[number]> {
  const out = {} as Pick<NS, Names[number]>;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(ns, name)) {
      out[name] = ns[name];
    }
  }
  return out;
}

/** Auto-build the inline namespace from the curated selection. */
function _buildInlineNamespace() {
  return Object.freeze({
    ...pickExports(FunctionalUtils, _inlineSelection.functional),
    ...pickExports(StringUtils, _inlineSelection.string),
    ...pickExports(NumberUtils, _inlineSelection.number),
    ...pickExports(ObjectUtils, _inlineSelection.object),
    ...pickExports(ArrayUtils, _inlineSelection.array),
    ...pickExports(AsyncUtils, _inlineSelection.async),
    ...pickExports(TypeGuardUtils, _inlineSelection.typeGuards),
    ...pickExports(JsonUtils, _inlineSelection.json),
    ...pickExports(FsUtils, _inlineSelection.fs),
    ...pickExports(NetworkUtils, _inlineSelection.network),
    ...pickExports(PathUtils, _inlineSelection.path),
    ...pickExports(ClipboardUtils, _inlineSelection.clipboard),
    ...pickExports(ThemeUtils, _inlineSelection.theme),
    ...pickExports(EventUtils, _inlineSelection.event),
    ...pickExports(PollingUtils, _inlineSelection.polling),
    ...pickExports(MiscUtils, _inlineSelection.misc),
    ...pickExports(VSCode, _inlineSelection.vscode),
    getExportNames,
    getNamespaceNames,
    getBarrelMeta,
    getCollisionCount,
    getInlineSelection,
    validateBarrelIntegrity,
    integrityTest,
    __barrel__,
  });
}

/** Inferred from the builder so types track `_inlineSelection` without a hand-maintained map. */
type InlineNamespace = ReturnType<typeof _buildInlineNamespace>;

/** Strongly-typed shape of the Utils default export. */
type UtilsNamespace = {
  [K in keyof NamespaceMap]: DeepReadonly<NamespaceMap[K]>;
} & {
  inline: Readonly<InlineNamespace>;
  __barrel__: BarrelMeta;
};

let _inlineNamespace: Readonly<InlineNamespace> | null = null;
function _getInlineNamespace(): Readonly<InlineNamespace> {
  if (!_inlineNamespace) {
    _inlineNamespace = _buildInlineNamespace();
  }
  return _inlineNamespace;
}

const _frozenNamespaceCache: Record<string, DeepReadonly<Record<string, unknown>>> = {};
function _getFrozenNamespace(key: string): DeepReadonly<Record<string, unknown>> {
  if (!_frozenNamespaceCache[key]) {
    _frozenNamespaceCache[key] = freezeNamespace(
      (_namespaceRegistry as unknown as Record<string, Record<string, unknown>>)[key]
    );
  }
  return _frozenNamespaceCache[key];
}

const _utilsTarget: Record<string, unknown> = {};
Object.defineProperty(_utilsTarget, '__barrel__', {
  get: () => __barrel__,
  enumerable: true,
  configurable: false,
});
Object.defineProperty(_utilsTarget, 'inline', {
  get: () => _getInlineNamespace(),
  enumerable: true,
  configurable: false,
});
for (const key of Object.keys(_namespaceRegistry)) {
  Object.defineProperty(_utilsTarget, key, {
    get: () => _getFrozenNamespace(key),
    enumerable: true,
    configurable: false,
  });
}
Object.freeze(_utilsTarget);
export const Utils: UtilsNamespace = _utilsTarget as unknown as UtilsNamespace;

/**
 * Validate barrel integrity at runtime.
 * Checks that all namespaces are frozen, that __barrel__ contains every required key,
 * and that no flat export is duplicated across namespaces.
 * @returns {{ valid: boolean; errors: string[]; collisionCount: number }} Validation result.
 */
export const validateBarrelIntegrity = (): { valid: boolean; errors: string[]; collisionCount: number } => {
  const errors: string[] = [];

  for (const key of getNamespaceNames()) {
    if (!Object.isFrozen((Utils as unknown as Record<string, unknown>)[key])) {
      errors.push(`Namespace "${key}" is not frozen`);
    }
  }

  if (!Object.isFrozen(Utils)) errors.push('Default export is not frozen');
  if (!Object.isFrozen(__barrel__)) errors.push('__barrel__ metadata is not frozen');
  if (!Object.isFrozen(_getInlineNamespace())) errors.push('inline namespace is not frozen');

  const barrel = Utils.__barrel__;
  if (!barrel) {
    errors.push('Missing __barrel__ metadata');
  } else {
    for (const metaKey of BARREL_REQUIRED_KEYS) {
      if (!(metaKey in barrel)) errors.push(`Missing __barrel__ key: "${metaKey}"`);
    }
  }

  const flat = _getExportNames();
  const seen = new Map<string, string>();
  _forEachRegistryExport((name, nsKey) => {
    if (seen.has(name)) {
      errors.push(`Export "${name}" is duplicated in namespaces "${seen.get(name)}" and "${nsKey}"`);
    } else {
      seen.set(name, nsKey);
    }
  });
  for (const key of flat) {
    if (key === 'default') continue;
    const found = seen.has(key) || _barrelNativeNames.includes(key);
    if (!found) errors.push(`Export "${key}" not found in any namespace or inline registry`);
  }

  return { valid: errors.length === 0, errors, collisionCount: getCollisionCount() };
};

/**
 * Run inline smoke tests for critical barrel utilities.
 * @returns {{ passed: boolean; failures: string[] }}
 */
export function integrityTest(): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  function check(label: string, condition: boolean): void {
    if (!condition) failures.push(label);
  }

  const integrity = validateBarrelIntegrity();
  check('barrel integrity valid', integrity.valid);
  check('barrel inline frozen', Object.isFrozen(Utils.inline));
  check('barrel no unresolved exports', integrity.errors.filter((e) => e.includes('not found')).length === 0);
  check('barrel no duplicate exports', integrity.errors.filter((e) => e.includes('duplicated')).length === 0);

  check(
    'compose composes',
    FunctionalUtils.compose(
      (x: number) => x + 1,
      (x: number) => x * 2
    )(3) === 7
  );
  check(
    'pipe pipes',
    FunctionalUtils.pipe(
      (x: number) => x + 1,
      (x: number) => x * 2
    )(3) === 8
  );
  check('zipWith pairs', FunctionalUtils.zipWith([1, 2], [3, 4], (a: number, b: number) => a + b)[0] === 4);
  check('freezeNamespace deep', Object.isFrozen(freezeNamespace({ a: { b: 1 } }).a));

  // Inline namespace parity tests
  check(
    'groupBy',
    JSON.stringify(Utils.inline.groupBy([1, 2, 3], (x) => x % 2)) === JSON.stringify({ '1': [1, 3], '0': [2] })
  );
  check('deepClone', Utils.inline.deepClone({ a: 1 }).a === 1);
  check('pick', JSON.stringify(Utils.inline.pick({ a: 1, b: 2 }, ['a'])) === JSON.stringify({ a: 1 }));
  check('clamp', Utils.inline.clamp(15, 0, 10) === 10);
  check('escapeHtml', Utils.inline.escapeHtml('<div>').includes('&lt;'));
  check('isDefined', Utils.inline.isDefined(0));
  check(
    'parseJsonSafe',
    (Utils.inline.parseJsonSafe('{"a":1}', null) as unknown as Record<string, unknown>)['a'] === 1
  );

  return { passed: failures.length === 0, failures };
}

export default Utils;
