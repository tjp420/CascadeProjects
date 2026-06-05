const { LanguagePlugin, EMPTY_PATTERNS } = require('./language-plugin.cjs');
const { PluginManager, getBuiltinPluginManager } = require('./plugin-manager.cjs');
const { registerBuiltinPlugins } = require('./builtin-plugins.cjs');
const { registerGenericFallbackPlugins } = require('./register-generic-fallback-plugins.cjs');

module.exports = {
    LanguagePlugin,
    EMPTY_PATTERNS,
    PluginManager,
    getBuiltinPluginManager,
    registerBuiltinPlugins,
    registerGenericFallbackPlugins
};
