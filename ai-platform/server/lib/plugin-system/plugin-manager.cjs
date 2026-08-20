/**
 * Registry and resolver for language analyzer plugins.
 */

const path = require("path");
const {
  createLanguageDetector,
} = require("../universal-language-detector.cjs");
const {
  resolveLanguageFromPath,
} = require("../universal-language-registry.cjs");

/**
 * Plugin manager.
 */
class PluginManager {
  constructor(options = {}) {
    this.plugins = new Map();
    this.extensionIndex = new Map();
    this.detector = options.detector || createLanguageDetector();
  }

  register(plugin) {
    if (!plugin?.language) {
      throw new Error("Language plugin must define language");
    }
    this.plugins.set(plugin.language, plugin);
    for (const ext of plugin.extensions || []) {
      const key = String(ext).toLowerCase();
      if (!this.extensionIndex.has(key)) this.extensionIndex.set(key, []);
      this.extensionIndex.get(key).push(plugin);
    }
    return plugin;
  }

  getByLanguage(languageId) {
    return this.plugins.get(String(languageId || "").toLowerCase()) || null;
  }

  getByExtension(extension) {
    const matches =
      this.extensionIndex.get(String(extension || "").toLowerCase()) || [];
    return matches[0] || null;
  }

  listLanguages() {
    return [...this.plugins.values()].map((plugin) => ({
      id: plugin.language,
      label: plugin.label,
      extensions: [...plugin.extensions],
      version: plugin.version,
      parser: plugin.parser,
    }));
  }

  resolvePlugin(fileName, extension, content = "") {
    const base = path.basename(String(fileName || ""));
    for (const plugin of this.plugins.values()) {
      if (plugin.matchesBasename(base)) return plugin;
    }

    const byExt = this.getByExtension(extension);
    if (byExt) return byExt;

    const detected = this.detector.detectFromContent(content);
    if (detected.confidence >= 0.55) {
      return this.getByLanguage(detected.language);
    }

    const fromPath = resolveLanguageFromPath(base);
    if (fromPath) {
      const fromRegistry = this.getByLanguage(fromPath.id);
      if (fromRegistry) return fromRegistry;
    }

    return this.getByLanguage("generic");
  }

  shouldUsePlugin(extension) {
    const legacyHandled = new Set([
      ".js",
      ".mjs",
      ".cjs",
      ".ts",
      ".tsx",
      ".jsx",
      ".json",
    ]);
    return !legacyHandled.has(String(extension || "").toLowerCase());
  }
}

let builtinManager;

/**
 * Get builtin plugin manager.
 * @returns {any}
 */
function getBuiltinPluginManager() {
  if (!builtinManager) {
    const { registerBuiltinPlugins } = require("./builtin-plugins.cjs");
    builtinManager = new PluginManager();
    registerBuiltinPlugins(builtinManager);
  }
  return builtinManager;
}

module.exports = {
  PluginManager,
  getBuiltinPluginManager,
};
