const { LanguagePlugin, EMPTY_PATTERNS } = require('./language-plugin');
const { PluginManager, getBuiltinPluginManager } = require('./plugin-manager');
const { registerBuiltinPlugins } = require('./builtin-plugins');
const { registerGenericFallbackPlugins } = require('./register-generic-fallback-plugins');

module.exports = {
    LanguagePlugin,
    EMPTY_PATTERNS,
    PluginManager,
    getBuiltinPluginManager,
    registerBuiltinPlugins,
    registerGenericFallbackPlugins
};
