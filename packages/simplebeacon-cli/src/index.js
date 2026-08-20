"use strict";

/**
 * @module simplebeacon
 * SimpleBeacon CLI public API facade. Re-exports every public function
 * from 20+ core modules as flat exports and a namespaced object.
 *
 * Heavy modules are lazy-loaded via Proxy so consumers only pay for what
 * they use. Duplicate keys in the flat export are detected and warned.
 * The entire API surface is deeply frozen to prevent accidental mutation.
 */

// ── Small / always-needed modules (eager) ──────────────────────────────
const configSchema = require("./config-schema.js");
const errors = require("./lib/errors");
const { version } = require("../package.json");

// ── Deep freeze helper ───────────────────────────────────────────────────
const _proxyObjects = new WeakSet();

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (_proxyObjects.has(obj)) return obj;
  if (Object.isFrozen(obj)) return obj;
  const ctor = obj.constructor;
  if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet)
    return obj;
  if (ctor === Map) {
    for (const [k, v] of obj) obj.set(k, deepFreeze(v));
    return Object.freeze(obj);
  }
  if (ctor === Set) {
    const frozenSet = new Set();
    for (const v of obj) frozenSet.add(deepFreeze(v));
    return Object.freeze(frozenSet);
  }
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === "object") deepFreeze(value);
  }
  return Object.freeze(obj);
}

// ── Module loader with validation ──────────────────────────────────────
const _loaded = new Map();

function _loadModule(name, path) {
  if (_loaded.has(name)) return _loaded.get(name);
  try {
    const mod = require(path);
    _loaded.set(name, mod);
    return mod;
  } catch (err) {
    throw new errors.SimplebeaconError(
      `Failed to load "${name}" from ${path}: ${err.message}`,
      "MODULE_LOAD_ERROR",
    );
  }
}

// ── Lazy namespace factory ───────────────────────────────────────────────
function _createNamespace(name, path) {
  const proxy = new Proxy(Object.freeze({}), {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      return _loadModule(name, path)[prop];
    },
    has(target, prop) {
      if (typeof prop !== "string") return false;
      return prop in _loadModule(name, path);
    },
    ownKeys(_target) {
      return Reflect.ownKeys(_loadModule(name, path));
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(_loadModule(name, path), prop);
    },
  });
  _proxyObjects.add(proxy);
  return proxy;
}

function _createMultiNamespace(name, paths) {
  const _key = (p) => `${name}:${p}`;
  const proxy = new Proxy(Object.freeze({}), {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      for (const p of paths) {
        const mod = _loadModule(_key(p), p);
        if (prop in mod) return mod[prop];
      }
      return undefined;
    },
    has(target, prop) {
      if (typeof prop !== "string") return false;
      for (const p of paths) {
        if (prop in _loadModule(_key(p), p)) return true;
      }
      return false;
    },
    ownKeys(_target) {
      const keys = new Set();
      for (const p of paths) {
        for (const k of Reflect.ownKeys(_loadModule(_key(p), p))) {
          keys.add(k);
        }
      }
      return Array.from(keys);
    },
    getOwnPropertyDescriptor(target, prop) {
      for (const p of paths) {
        const desc = Reflect.getOwnPropertyDescriptor(
          _loadModule(_key(p), p),
          prop,
        );
        if (desc) return desc;
      }
      return undefined;
    },
  });
  _proxyObjects.add(proxy);
  return proxy;
}

// ── Eager-load config + project-detect (used by inline helpers) ────────
const configModule = _loadModule("config", "./config");
const projectDetect = _loadModule("project-detect", "./project-detect");

const {
  loadSimplebeaconConfig,
  loadCentralDataConfig,
  resolveScanPaths,
  DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
  DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
  DEFAULT_BASELINE,
} = configModule;
const { resolvePlatformRoot } = projectDetect;
const { PathError } = errors;

/**
 * Resolve the set of mock-data directories to scan for a project.
 * @param {string} baseDir
 * @param {string[]} [extraPaths=[]]
 * @returns {string[]}
 */
function resolveMockDataScanPaths(baseDir, extraPaths = []) {
  const safeBase =
    baseDir && typeof baseDir === "string" ? baseDir : process.cwd();
  const resolved = resolvePlatformRoot(safeBase);
  if (!resolved || typeof resolved !== "object") {
    throw new PathError(
      `Could not resolve platform root object from: ${safeBase}`,
    );
  }
  const { platformRoot } = resolved;
  if (!platformRoot) {
    throw new PathError(`Resolved platform root is empty for: ${safeBase}`);
  }
  let mockPaths;
  try {
    const central = loadCentralDataConfig(platformRoot);
    const rawMockPaths = central?.mockDataScan?.paths;
    mockPaths = Array.isArray(rawMockPaths)
      ? rawMockPaths
      : DEFAULT_MOCK_SCAN_RELATIVE_PATHS;
  } catch {
    mockPaths = DEFAULT_MOCK_SCAN_RELATIVE_PATHS;
  }
  const safeExtras = Array.isArray(extraPaths)
    ? extraPaths.filter((p) => typeof p === "string" && p.length > 0)
    : [];
  try {
    return resolveScanPaths(platformRoot, { scanPaths: mockPaths }, safeExtras);
  } catch (err) {
    throw new PathError(
      `Failed to resolve mock-data scan paths: ${err?.message || err}`,
    );
  }
}

/**
 * Load a single key from simplebeacon config, falling back to a default.
 * @param {string} baseDir
 * @param {string} key
 * @param {Object|Array|string|number|boolean|null} fallback
 * @returns {Object|Array|string|number|boolean|null}
 */
function _loadConfigKey(baseDir, key, fallback) {
  if (typeof key !== "string" || key.length === 0) {
    return fallback;
  }
  try {
    const safeBase = baseDir && typeof baseDir === "string" ? baseDir : ".";
    const config = loadSimplebeaconConfig(safeBase);
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return fallback;
    }
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      return config[key];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Load the repository audit baseline from simplebeacon config.
 * @param {string} baseDir
 * @returns {Object}
 */
function getRepositoryAuditBaseline(baseDir) {
  return _loadConfigKey(baseDir, "baseline", DEFAULT_BASELINE);
}

/**
 * Load the consistency anchor samples from simplebeacon config.
 * @param {string} baseDir
 * @returns {Array<string>}
 */
function getConsistencyAnchorSamples(baseDir) {
  return _loadConfigKey(
    baseDir,
    "consistencyAnchorSamples",
    DEFAULT_CONSISTENCY_ANCHOR_SAMPLES,
  );
}

// ── Namespaced API (lazy-loaded via Proxy) ──────────────────────────────

const _initNs = _createNamespace(
  "init-simplebeacon",
  "./lib/init-simplebeacon.cjs",
);
const _repoInvNs = _createNamespace(
  "repository-inventory",
  "./lib/repository-inventory",
);

const Simplebeacon = deepFreeze({
  version,
  config: deepFreeze({
    ...configModule,
    resolveMockDataScanPaths,
    getRepositoryAuditBaseline,
    getConsistencyAnchorSamples,
    initSimplebeacon: _initNs.initSimplebeacon,
    initSamplebeacon: _initNs.initSimplebeacon,
    loadSamplebeaconConfig: configModule.loadSimplebeaconConfig,
    buildInitDryRunPlan: _initNs.buildInitDryRunPlan,
    countRepositoryInventory: _repoInvNs.countRepositoryInventory,
    SKIP_BY_PROFILE: _repoInvNs.SKIP_BY_PROFILE,
    validateConfig: configSchema.validateConfig,
    VALID_RULES: configSchema.VALID_RULES,
    VALID_PROFILES: configSchema.VALID_PROFILES,
    VALID_SCANNER_ACTIONS: configSchema.VALID_SCANNER_ACTIONS,
    VALID_SEVERITIES: configSchema.VALID_SEVERITIES,
  }),
  scan: _createNamespace("scan", "./scan"),
  gate: _createNamespace("gate", "./gate"),
  report: _createMultiNamespace("report", [
    "./reporters/text",
    "./reporters/json",
    "./reporters/github-comment",
    "./assessment",
    "./reporters/audit-report",
    "./reporters/file-reduction-report",
    "./lib/result-aggregator",
    "./lib/file-reduction-orchestrator",
  ]),
  fiction: _createNamespace("fiction", "./rules/ai-fiction-detection"),
  proxy: _createNamespace("proxy", "./proxy/gateway"),
  compliance: _createMultiNamespace("compliance", [
    "./compliance-checklist",
    "./eu-ai-act-export-guard",
    "./eu-ai-act-legal-attestation",
  ]),
  sanitize: _createMultiNamespace("sanitize", [
    "./lib/report-sanitizer",
    "./lib/complete-scan-export-sanitize",
    "./lib/public-summary-export-sanitize",
    "./lib/assessment-export-sanitize",
    "./lib/re-attestation-note-export-sanitize",
    "./lib/roadmap-export-sanitize",
    "./lib/simplebeacon-report-export-sanitize",
    "./lib/anonymized-export",
    "./lib/ai-problem-analyzer-cache",
    "./lib/ai-problem-analyzer-export-sanitize",
  ]),
  baseline: _createNamespace("baseline", "./baseline-sync"),
  hooks: _createNamespace("hooks", "./hook-install"),
  project: deepFreeze({ ...projectDetect }),
  trust: _createMultiNamespace("trust", [
    "./lib/trust-guard",
    "./lib/transaction-manager",
    "./lib/safe-write",
  ]),
  errors: deepFreeze({ ...errors }),
  path: _createMultiNamespace("path", [
    "./lib/path-utils",
    "./lib/input-sanitizer",
    "./lib/path-sanitizer",
  ]),
  mcp: _createMultiNamespace("mcp", [
    "./mcp/tools",
    "./mcp/stdio-server",
    "./lib/snippet-scanner",
  ]),
  doctor: _createNamespace("doctor", "./doctor"),
  fixDryRun: _createNamespace("fix-dry-run", "./fix-dry-run"),
  scanOrchestrator: _createNamespace("scan-orchestrator", "./scanOrchestrator"),
  utils: _createMultiNamespace("utils", [
    "./utils/async",
    "./utils/object",
    "./utils/string",
    "./utils/functional",
    "./utils/async-advanced",
  ]),
});

// ── Lazy flat export builder with collision detection ────────────────────

const _allModuleSpecs = [
  { name: "project-detect", path: "./project-detect" },
  { name: "config", path: "./config" },
  { name: "config-schema", path: "./config-schema.js" },
  { name: "errors", path: "./lib/errors" },
  { name: "scan", path: "./scan" },
  { name: "gate", path: "./gate" },
  { name: "reporters/text", path: "./reporters/text" },
  { name: "reporters/json", path: "./reporters/json" },
  { name: "reporters/github-comment", path: "./reporters/github-comment" },
  { name: "assessment", path: "./assessment" },
  { name: "reporters/audit-report", path: "./reporters/audit-report" },
  { name: "fiction", path: "./rules/ai-fiction-detection" },
  { name: "proxy", path: "./proxy/gateway" },
  { name: "compliance", path: "./compliance-checklist" },
  { name: "eu-ai-act-export-guard", path: "./eu-ai-act-export-guard" },
  {
    name: "eu-ai-act-legal-attestation",
    path: "./eu-ai-act-legal-attestation",
  },
  { name: "report-sanitizer", path: "./lib/report-sanitizer" },
  {
    name: "complete-scan-export-sanitize",
    path: "./lib/complete-scan-export-sanitize",
  },
  {
    name: "public-summary-export-sanitize",
    path: "./lib/public-summary-export-sanitize",
  },
  {
    name: "assessment-export-sanitize",
    path: "./lib/assessment-export-sanitize",
  },
  {
    name: "re-attestation-export-sanitize",
    path: "./lib/re-attestation-note-export-sanitize",
  },
  { name: "roadmap-export-sanitize", path: "./lib/roadmap-export-sanitize" },
  {
    name: "simplebeacon-report-export-sanitize",
    path: "./lib/simplebeacon-report-export-sanitize",
  },
  { name: "anonymized-export", path: "./lib/anonymized-export" },
  {
    name: "ai-problem-analyzer-cache",
    path: "./lib/ai-problem-analyzer-cache",
  },
  {
    name: "ai-problem-analyzer-export-sanitize",
    path: "./lib/ai-problem-analyzer-export-sanitize",
  },
  { name: "baseline-sync", path: "./baseline-sync" },
  { name: "hook-install", path: "./hook-install" },
  { name: "trust-guard", path: "./lib/trust-guard" },
  { name: "transaction-manager", path: "./lib/transaction-manager" },
  { name: "safe-write", path: "./lib/safe-write" },
  { name: "path-utils", path: "./lib/path-utils" },
  { name: "input-sanitizer", path: "./lib/input-sanitizer" },
  { name: "path-sanitizer", path: "./lib/path-sanitizer" },
  {
    name: "file-reduction-orchestrator",
    path: "./lib/file-reduction-orchestrator",
  },
  { name: "file-reduction-report", path: "./reporters/file-reduction-report" },
  { name: "result-aggregator", path: "./lib/result-aggregator" },
  { name: "init-simplebeacon", path: "./lib/init-simplebeacon.cjs" },
  { name: "repository-inventory", path: "./lib/repository-inventory" },
  { name: "mcp-tools", path: "./mcp/tools" },
  { name: "mcp-stdio-server", path: "./mcp/stdio-server" },
  { name: "snippet-scanner", path: "./lib/snippet-scanner" },
  {
    name: "ai-problem-analyzer-suite",
    path: "./lib/ai-problem-analyzer-suite",
  },
  { name: "async-utils", path: "./utils/async" },
  { name: "object-utils", path: "./utils/object" },
  { name: "string-utils", path: "./utils/string" },
  { name: "functional-utils", path: "./utils/functional" },
  { name: "async-advanced", path: "./utils/async-advanced" },
  { name: "doctor", path: "./doctor" },
  { name: "fix-dry-run", path: "./fix-dry-run" },
  { name: "scan-orchestrator", path: "./scanOrchestrator" },
];

const _collisionWarnings = new Map();

function _buildLazyFlatExport(specs) {
  const eagerOut = {};
  const seen = new Map();
  const eager = process.env.SIMPLEBEACON_LAZY_FLAT !== "1";

  if (eager) {
    for (const { name, path: p } of specs) {
      const mod = _loadModule(name, p);
      for (const key of Object.keys(mod)) {
        if (seen.has(key)) {
          const prev = seen.get(key);
          if (process.env.SIMPLEBEACON_DUP_WARN !== "0") {
            process.emitWarning(
              `[simplebeacon] Export collision: "${key}" from "${name}" shadows "${prev}". ` +
                `Access via Simplebeacon namespace to disambiguate.`,
              "SimplebeaconExportCollision",
            );
          }
        } else {
          seen.set(key, name);
        }
        eagerOut[key] = mod[key];
      }
    }
    // Special top-level exports that are not part of any lazy module namespace.
    eagerOut.version = version;
    eagerOut.resolveMockDataScanPaths = resolveMockDataScanPaths;
    eagerOut.getRepositoryAuditBaseline = getRepositoryAuditBaseline;
    eagerOut.getConsistencyAnchorSamples = getConsistencyAnchorSamples;
    eagerOut.Simplebeacon = Simplebeacon;
    eagerOut.getExportNames = getExportNames;
    eagerOut.getNamespaceNames = getNamespaceNames;
    eagerOut.validateBarrelIntegrity = validateBarrelIntegrity;
    return eagerOut;
  }

  const lazyOut = new Proxy(
    {},
    {
      get(target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "version") return version;
        if (prop === "resolveMockDataScanPaths")
          return resolveMockDataScanPaths;
        if (prop === "getRepositoryAuditBaseline")
          return getRepositoryAuditBaseline;
        if (prop === "getConsistencyAnchorSamples")
          return getConsistencyAnchorSamples;
        if (prop === "Simplebeacon") return Simplebeacon;
        if (prop === "getExportNames") return getExportNames;
        if (prop === "getNamespaceNames") return getNamespaceNames;
        if (prop === "validateBarrelIntegrity") return validateBarrelIntegrity;
        if (prop === "__barrel__") return __barrel__;
        for (const { name, path: p } of specs) {
          const mod = _loadModule(name, p);
          if (prop in mod) {
            if (
              seen.has(prop) &&
              seen.get(prop) !== name &&
              !_collisionWarnings.has(prop)
            ) {
              _collisionWarnings.set(prop, true);
              if (process.env.SIMPLEBEACON_DUP_WARN !== "0") {
                process.emitWarning(
                  `[simplebeacon] Export collision: "${prop}" from "${name}" shadows "${seen.get(prop)}". ` +
                    `Access via Simplebeacon namespace to disambiguate.`,
                  "SimplebeaconExportCollision",
                );
              }
            }
            if (!seen.has(prop)) seen.set(prop, name);
            return mod[prop];
          }
        }
        return undefined;
      },
      has(target, prop) {
        if (typeof prop !== "string") return false;
        if (
          [
            "version",
            "resolveMockDataScanPaths",
            "getRepositoryAuditBaseline",
            "getConsistencyAnchorSamples",
            "Simplebeacon",
            "getExportNames",
            "getNamespaceNames",
            "validateBarrelIntegrity",
            "__barrel__",
          ].includes(prop)
        ) {
          return true;
        }
        for (const { name, path: p } of specs) {
          if (prop in _loadModule(name, p)) return true;
        }
        return false;
      },
      ownKeys(_target) {
        const keys = new Set([
          "version",
          "resolveMockDataScanPaths",
          "getRepositoryAuditBaseline",
          "getConsistencyAnchorSamples",
          "Simplebeacon",
          "getExportNames",
          "getNamespaceNames",
          "validateBarrelIntegrity",
          "__barrel__",
        ]);
        for (const { name, path: p } of specs) {
          for (const k of Object.keys(_loadModule(name, p))) keys.add(k);
        }
        return Array.from(keys);
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop === "version")
          return {
            value: version,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "resolveMockDataScanPaths")
          return {
            value: resolveMockDataScanPaths,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "getRepositoryAuditBaseline")
          return {
            value: getRepositoryAuditBaseline,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "getConsistencyAnchorSamples")
          return {
            value: getConsistencyAnchorSamples,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "Simplebeacon")
          return {
            value: Simplebeacon,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "getExportNames")
          return {
            value: getExportNames,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "getNamespaceNames")
          return {
            value: getNamespaceNames,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "validateBarrelIntegrity")
          return {
            value: validateBarrelIntegrity,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        if (prop === "__barrel__")
          return {
            value: __barrel__,
            writable: false,
            enumerable: true,
            configurable: false,
          };
        for (const { name, path: p } of specs) {
          const mod = _loadModule(name, p);
          if (prop in mod)
            return {
              value: mod[prop],
              writable: false,
              enumerable: true,
              configurable: false,
            };
        }
        return undefined;
      },
    },
  );
  _proxyObjects.add(lazyOut);
  return lazyOut;
}

const flat = _buildLazyFlatExport(_allModuleSpecs);

// ── Barrel introspection ─────────────────────────────────────────────────

const NAMESPACE_NAMES = Object.freeze([
  "config",
  "scan",
  "gate",
  "report",
  "fiction",
  "proxy",
  "compliance",
  "sanitize",
  "baseline",
  "hooks",
  "project",
  "trust",
  "errors",
  "path",
  "mcp",
  "doctor",
  "fixDryRun",
  "scanOrchestrator",
  "utils",
  "inline",
]);

function getExportNames() {
  const keys = new Set([
    "version",
    "resolveMockDataScanPaths",
    "getRepositoryAuditBaseline",
    "getConsistencyAnchorSamples",
    "Simplebeacon",
    "getExportNames",
    "getNamespaceNames",
    "validateBarrelIntegrity",
    "__barrel__",
  ]);
  for (const { name, path: p } of _allModuleSpecs) {
    for (const k of Object.keys(_loadModule(name, p))) keys.add(k);
  }
  return Object.freeze(Array.from(keys).sort());
}

function getNamespaceNames() {
  return NAMESPACE_NAMES;
}

function validateBarrelIntegrity() {
  const errors = [];
  if (!Simplebeacon) {
    errors.push("Simplebeacon namespace is missing");
  } else if (!Object.isFrozen(Simplebeacon)) {
    errors.push("Simplebeacon namespace is not frozen");
  }
  for (const ns of NAMESPACE_NAMES) {
    if (!Simplebeacon[ns] || typeof Simplebeacon[ns] !== "object") {
      errors.push(`Namespace "${ns}" is missing or not an object`);
    }
  }
  if (!flat.__barrel__) {
    errors.push("Missing __barrel__ metadata");
  } else {
    const requiredMetaKeys = [
      "name",
      "description",
      "moduleCount",
      "exportCount",
      "namespaceCount",
      "version",
      "timestamp",
      "exports",
      "namespaces",
    ];
    for (const metaKey of requiredMetaKeys) {
      if (!(metaKey in flat.__barrel__)) {
        errors.push(`Missing __barrel__ key: "${metaKey}"`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

const __barrel__ = Object.freeze({
  name: "simplebeacon-cli",
  description: "Simplebeacon CLI public API facade",
  moduleCount: NAMESPACE_NAMES.length,
  exportCount: getExportNames().length,
  namespaceCount: NAMESPACE_NAMES.length,
  version,
  timestamp: new Date().toISOString(),
  exports: getExportNames(),
  namespaces: NAMESPACE_NAMES,
});

flat.__barrel__ = __barrel__;

module.exports = deepFreeze(flat);
