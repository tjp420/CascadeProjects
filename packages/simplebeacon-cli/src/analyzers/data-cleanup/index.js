// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
"use strict";

/**
 * @module data-cleanup
 * Data cleanup and data quality analyzers.
 *
 * Provides lazy-loaded scanner classes for config management, dependency health,
 * environment variables, data freshness, access patterns, privacy, lineage,
 * and consistency. Includes runtime registration and query APIs.
 *
 * @file packages/simplebeacon-cli/src/analyzers/data-cleanup/index.js
 */

const SCANNER_REGISTRY = new Map();

function defineScanner(id, modulePath, options = {}) {
  const { priority = 99, enabled = true, lazy = true } = options;
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError(
      `Scanner id must be a non-empty string, got: ${typeof id}`,
    );
  }
  if (typeof priority !== "number" || !Number.isFinite(priority)) {
    throw new TypeError(
      `Scanner priority must be a finite number, got: ${priority}`,
    );
  }
  if (SCANNER_REGISTRY.has(id)) {
    throw new Error(`Scanner "${id}" is already registered`);
  }
  SCANNER_REGISTRY.set(id, {
    id,
    modulePath,
    priority,
    enabled,
    lazy,
    _loaded: null,
  });
}

function loadScanner(entry) {
  if (entry._loaded) return entry._loaded;
  try {
    entry._loaded = require(entry.modulePath);
    return entry._loaded;
  } catch (err) {
    throw new Error(
      `Failed to load scanner "${entry.id}" from "${entry.modulePath}": ${err.message}`,
    );
  }
}

function getScanner(id) {
  const entry = SCANNER_REGISTRY.get(id);
  if (!entry) return undefined;
  return loadScanner(entry);
}

function getAll() {
  return Array.from(SCANNER_REGISTRY.values()).map((e) => ({
    id: e.id,
    priority: e.priority,
    enabled: e.enabled,
    loaded: !!e._loaded,
    Scanner: e.lazy && !e._loaded ? undefined : loadScanner(e),
  }));
}

function getEnabled() {
  return getAll().filter((s) => s.enabled);
}

function getById(id) {
  return getScanner(id);
}

function getByPriority({ min = -Infinity, max = Infinity } = {}) {
  return getAll()
    .filter((s) => s.priority >= min && s.priority <= max)
    .sort((a, b) => a.priority - b.priority);
}

function register(id, scannerClass, options = {}) {
  if (typeof scannerClass !== "function") {
    throw new TypeError("scannerClass must be a constructor function");
  }
  const { priority = 99, enabled = true } = options;
  if (SCANNER_REGISTRY.has(id)) {
    throw new Error(`Scanner "${id}" is already registered`);
  }
  SCANNER_REGISTRY.set(id, {
    id,
    modulePath: null,
    priority,
    enabled,
    lazy: false,
    _loaded: scannerClass,
  });
}

function unregister(id) {
  return SCANNER_REGISTRY.delete(id);
}

// -- Built-in scanner definitions --
[
  {
    id: "config-management",
    path: "./config-management-analyzer",
    priority: 4,
  },
  {
    id: "dependency-health",
    path: "./dependency-health-analyzer",
    priority: 5,
  },
  {
    id: "environment-variables",
    path: "./environment-variable-analyzer",
    priority: 6,
  },
  { id: "data-freshness", path: "./data-freshness-analyzer", priority: 7 },
  {
    id: "data-access-patterns",
    path: "./data-access-pattern-analyzer",
    priority: 8,
  },
  { id: "data-privacy", path: "./data-privacy-analyzer", priority: 9 },
  { id: "data-lineage", path: "./data-lineage-analyzer", priority: 10 },
  { id: "data-consistency", path: "./data-consistency-analyzer", priority: 11 },
].forEach((def) =>
  defineScanner(def.id, def.path, {
    priority: def.priority,
    enabled: true,
    lazy: true,
  }),
);

// Eagerly load core scanners that are frequently used (keep the rest lazy)
const eagerlyLoaded = ["config-management", "dependency-health"];
eagerlyLoaded.forEach((id) => {
  const entry = SCANNER_REGISTRY.get(id);
  if (entry) loadScanner(entry);
});

// Backward-compatible named exports (lazy via getters)
const exportsMap = {
  getAll,
  getEnabled,
  getById,
  getByPriority,
  register,
  unregister,
  defineScanner,
};

// Create lazy getters for each analyzer class
const classNames = {
  "config-management": "ConfigManagementAnalyzer",
  "dependency-health": "DependencyHealthAnalyzer",
  "environment-variables": "EnvironmentVariableAnalyzer",
  "data-freshness": "DataFreshnessAnalyzer",
  "data-access-patterns": "DataAccessPatternAnalyzer",
  "data-privacy": "DataPrivacyAnalyzer",
  "data-lineage": "DataLineageAnalyzer",
  "data-consistency": "DataConsistencyAnalyzer",
};

Object.keys(classNames).forEach((id) => {
  const className = classNames[id];
  Object.defineProperty(exportsMap, className, {
    enumerable: true,
    get() {
      const mod = getScanner(id);
      return mod ? mod[className] || mod : undefined;
    },
  });
});

// Legacy array for consumers expecting DATA_CLEANUP_SCANNERS
Object.defineProperty(exportsMap, "DATA_CLEANUP_SCANNERS", {
  enumerable: true,
  get() {
    return getAll();
  },
});

module.exports = Object.freeze(exportsMap);
