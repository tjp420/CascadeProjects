/**
 * Plugin System Facade
 *
 * Unified entry point for the SimpleBeacon language analyzer plugin system.
 * Provides lazy initialization, dependency validation, plugin discovery,
 * and a typed programmatic API while preserving backward-compatible exports.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Dependency Validation ─────────────────────────────────────

const REQUIRED_MODULES = [
  { file: './language-plugin.cjs', exports: ['LanguagePlugin', 'EMPTY_PATTERNS'] },
  { file: './plugin-manager.cjs', exports: ['PluginManager', 'getBuiltinPluginManager'] },
  { file: './builtin-plugins.cjs', exports: ['registerBuiltinPlugins'] },
  { file: './register-generic-fallback-plugins.cjs', exports: ['registerGenericFallbackPlugins'] },
];

const loaded = {};
for (const req of REQUIRED_MODULES) {
  let mod;
  try {
    mod = require(req.file);
  } catch (err) {
    throw new Error(
      `[plugin-system] Failed to load required submodule "${req.file}". ` +
        `Ensure all plugin-system files are present. Original error: ${err.message}`
    );
  }
  for (const name of req.exports) {
    if (!(name in mod)) {
      throw new Error(
        `[plugin-system] Submodule "${req.file}" does not export expected symbol "${name}".`
      );
    }
  }
  loaded[req.file] = mod;
}

const { LanguagePlugin, EMPTY_PATTERNS } = loaded['./language-plugin.cjs'];
const { PluginManager, getBuiltinPluginManager } = loaded['./plugin-manager.cjs'];
const { registerBuiltinPlugins } = loaded['./builtin-plugins.cjs'];
const { registerGenericFallbackPlugins } = loaded['./register-generic-fallback-plugins.cjs'];

// ── JSDoc Type Definitions ────────────────────────────────────

/**
 * @typedef {Object} PluginSystemOptions
 * @property {boolean} [autoRegister=false] - Whether to auto-register builtins on first use.
 * @property {boolean} [autoDiscover=false] - Whether to scan for external plugins.
 * @property {string} [pluginDir] - Directory to scan for external *.cjs / *.js plugins.
 * @property {Object} [detector] - Optional language detector override.
 */

/**
 * @typedef {Object} PluginHealthReport
 * @property {boolean} initialized
 * @property {number} pluginCount
 * @property {number} extensionCount
 * @property {Object<string,boolean>} modules - Map of loaded submodule names to load status.
 * @property {string[]} errors - Any initialization or validation errors.
 */

// ── PluginSystem Facade ───────────────────────────────────────

class PluginSystem {
  /**
   * @param {PluginSystemOptions} [options]
   */
  constructor(options = {}) {
    this._options = options;
    this._manager = null;
    this._initialized = false;
    this._errors = [];
  }

  /**
   * Initialize the plugin system, creating the internal PluginManager.
   * @returns {PluginSystem}
   */
  initialize() {
    if (this._initialized) {
      this._errors.push('PluginSystem.initialize() called twice');
      return this;
    }
    this._manager = new PluginManager({ detector: this._options.detector });
    this._initialized = true;

    if (this._options.autoRegister) {
      this.autoRegister();
    }
    if (this._options.autoDiscover && this._options.pluginDir) {
      this.discoverPlugins(this._options.pluginDir);
    }
    return this;
  }

  /**
   * Shutdown and release the plugin manager.
   * @returns {PluginSystem}
   */
  shutdown() {
    this._manager = null;
    this._initialized = false;
    this._errors = [];
    return this;
  }

  /**
   * Whether the system has been initialized.
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Register a single plugin after validating its shape.
   * @param {LanguagePlugin|Object} plugin
   * @returns {PluginSystem}
   */
  registerPlugin(plugin) {
    if (!this._manager) {
      throw new Error('[PluginSystem] Not initialized. Call initialize() first.');
    }
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('[PluginSystem] Plugin must be an object.');
    }
    if (!plugin.language) {
      throw new Error('[PluginSystem] Plugin must define a "language" property.');
    }
    if (!plugin.extensions || !Array.isArray(plugin.extensions)) {
      throw new Error('[PluginSystem] Plugin must define an "extensions" array.');
    }
    this._manager.register(plugin);
    return this;
  }

  /**
   * Register multiple plugins.
   * @param {Array<LanguagePlugin|Object>} plugins
   * @returns {PluginSystem}
   */
  registerPlugins(plugins) {
    for (const plugin of plugins) {
      this.registerPlugin(plugin);
    }
    return this;
  }

  /**
   * Discover and auto-register plugins from a directory.
   * Files must export either a LanguagePlugin instance or a factory function.
   * @param {string} dir
   * @returns {number} Number of plugins discovered.
   */
  discoverPlugins(dir) {
    if (!this._manager) {
      throw new Error('[PluginSystem] Not initialized. Call initialize() first.');
    }
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) {
      this._errors.push(`discoverPlugins: directory does not exist "${absDir}"`);
      return 0;
    }
    let discovered = 0;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext !== '.cjs' && ext !== '.js') continue;
      const fullPath = path.join(absDir, entry.name);
      try {
        const mod = require(fullPath);
        const candidate = mod && (mod.default || mod.plugin || mod);
        if (candidate && typeof candidate === 'object' && candidate.language) {
          this._manager.register(candidate);
          discovered += 1;
        }
      } catch (err) {
        this._errors.push(`discoverPlugins: failed to load "${entry.name}": ${err.message}`);
      }
    }
    return discovered;
  }

  /**
   * Auto-register built-in and generic fallback plugins.
   * @returns {PluginSystem}
   */
  autoRegister() {
    if (!this._manager) {
      throw new Error('[PluginSystem] Not initialized. Call initialize() first.');
    }
    registerBuiltinPlugins(this._manager);
    return this;
  }

  /**
   * Get the internal PluginManager instance.
   * @returns {PluginManager|null}
   */
  getManager() {
    return this._manager;
  }

  /**
   * List all registered plugins with metadata.
   * @returns {Array<Object>}
   */
  listPlugins() {
    if (!this._manager) return [];
    return this._manager.listLanguages();
  }

  /**
   * Resolve the best plugin for a given file.
   * @param {string} fileName
   * @param {string} [extension]
   * @param {string} [content]
   * @returns {LanguagePlugin|null}
   */
  resolve(fileName, extension, content) {
    if (!this._manager) return null;
    return this._manager.resolvePlugin(fileName, extension, content);
  }

  /**
   * Return a health-check report.
   * @returns {PluginHealthReport}
   */
  healthCheck() {
    const moduleStatus = {};
    for (const req of REQUIRED_MODULES) {
      moduleStatus[req.file] = true;
    }
    return {
      initialized: this._initialized,
      pluginCount: this._manager ? this._manager.plugins.size : 0,
      extensionCount: this._manager ? this._manager.extensionIndex.size : 0,
      modules: moduleStatus,
      errors: [...this._errors],
    };
  }
}

// ── Singleton & Factory ───────────────────────────────────────

let _singleton = null;

/**
 * Create a new PluginSystem instance.
 * @param {PluginSystemOptions} [options]
 * @returns {PluginSystem}
 */
function createPluginSystem(options) {
  return new PluginSystem(options);
}

/**
 * Get the shared PluginSystem singleton (lazy-initialized).
 * @param {PluginSystemOptions} [options]
 * @returns {PluginSystem}
 */
function getPluginSystem(options = {}) {
  if (!_singleton) {
    _singleton = new PluginSystem(options);
    _singleton.initialize();
  }
  return _singleton;
}

// ── Backward-Compatible Exports ───────────────────────────────

module.exports = {
  // New facade
  PluginSystem,
  createPluginSystem,
  getPluginSystem,

  // Original symbols (preserved for compatibility)
  LanguagePlugin,
  EMPTY_PATTERNS,
  PluginManager,
  getBuiltinPluginManager,
  registerBuiltinPlugins,
  registerGenericFallbackPlugins,
};
