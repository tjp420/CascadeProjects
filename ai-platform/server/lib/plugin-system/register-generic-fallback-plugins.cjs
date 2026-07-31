// simplebeacon-ignore test-coverage
/**
 * Register Tier-1 baseline plugins for every registry language without a dedicated plugin.
 */

const { LanguagePlugin } = require('./language-plugin.cjs');
const { listRegistryLanguages } = require('../universal-language-registry.cjs');
const {
  getBaselinePatternsForFamily,
} = require('../language-patterns/universal-baseline-patterns.cjs');
const { extractGenericStructureHints } = require('./generic-structure-hints.cjs');

/** Languages with dedicated analyzers — do not register generic baseline over them */
const DEDICATED_LANGUAGE_IDS = new Set([
  'zscript',
  'acs',
  'decorate',
  'glsl',
  'lua',
  'python',
  'rust',
  'go',
  'sql',
]);

/**
 * Create generic baseline plugin.
 * @param {any} entry
 * @returns {any}
 */
function createGenericBaselinePlugin(entry) {
  const patterns = getBaselinePatternsForFamily(entry.family);
  const plugin = new LanguagePlugin({
    id: `${entry.id}-baseline-v1`,
    language: entry.id,
    label: entry.label,
    extensions: entry.extensions || [],
    basenames: entry.basenames || [],
    version: '1.0.0',
    parser: entry.parser || 'regex-baseline',
    patterns,
    contentIndicators: [],
    useGenericTechDebt: true,
    useGenericPlaceholders: true,
  });

  plugin.structureParser = (content, filePath) =>
    extractGenericStructureHints(content, { language: entry.id, filePath });

  return plugin;
}

/**
 * Create unknown file fallback plugin.
 * @returns {any}
 */
function createUnknownFileFallbackPlugin() {
  const patterns = getBaselinePatternsForFamily('domain');
  const plugin = new LanguagePlugin({
    id: 'generic-fallback-v1',
    language: 'generic',
    label: 'Unknown / generic source',
    extensions: [],
    version: '1.0.0',
    parser: 'regex-baseline',
    patterns,
    useGenericTechDebt: true,
    useGenericPlaceholders: true,
  });

  plugin.structureParser = (content, filePath) =>
    extractGenericStructureHints(content, { language: 'generic', filePath });

  return plugin;
}

/**
 * Register generic fallback plugins.
 * @param {any} manager
 * @returns {any}
 */
function registerGenericFallbackPlugins(manager) {
  let registered = 0;

  for (const entry of listRegistryLanguages()) {
    if (DEDICATED_LANGUAGE_IDS.has(entry.id)) continue;
    if (manager.getByLanguage(entry.id)) continue;
    manager.register(createGenericBaselinePlugin(entry));
    registered += 1;
  }

  if (!manager.getByLanguage('generic')) {
    manager.register(createUnknownFileFallbackPlugin());
  }

  return registered;
}

module.exports = {
  DEDICATED_LANGUAGE_IDS,
  createGenericBaselinePlugin,
  createUnknownFileFallbackPlugin,
  registerGenericFallbackPlugins,
};
