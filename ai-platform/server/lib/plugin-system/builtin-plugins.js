/**
 * Built-in language plugins shipped with the platform.
 */

const { LanguagePlugin } = require('./language-plugin');
const zscriptPatterns = require('../language-patterns/zscript-patterns');
const pythonPatterns = require('../language-patterns/python-patterns');
const rustPatterns = require('../language-patterns/rust-patterns');
const goPatterns = require('../language-patterns/go-patterns');
const sqlPatterns = require('../language-patterns/sql-patterns');
const { getRegistryEntry } = require('../universal-language-registry');
const { ZScriptParser } = require('../parsers/zscript-parser');
const { registerGenericFallbackPlugins } = require('./register-generic-fallback-plugins');
const { extractGenericStructureHints } = require('./generic-structure-hints');

const zscriptStructureParser = new ZScriptParser();

function createPatternPlugin(languageId, patternOverrides = {}, options = {}) {
    const entry = getRegistryEntry(languageId);
    if (!entry) return null;

    const plugin = new LanguagePlugin({
        id: options.id || `${languageId}-analyzer-v1`,
        language: entry.id,
        label: entry.label,
        extensions: entry.extensions,
        basenames: entry.basenames || [],
        version: options.version || '1.0.0',
        parser: entry.parser,
        patterns: {
            techDebt: patternOverrides.techDebt || [],
            debug: patternOverrides.debug || [],
            placeholders: patternOverrides.placeholders || [],
            bestPractices: patternOverrides.bestPractices || [],
            productionLeak: patternOverrides.productionLeak || []
        },
        contentIndicators: patternOverrides.contentIndicators || []
    });

    if (options.structureParser !== false) {
        plugin.structureParser = (content, filePath) => (
            extractGenericStructureHints(content, { language: entry.id, filePath })
        );
    }

    return plugin;
}

function registerDedicatedPatternPlugin(manager, languageId, patterns, options = {}) {
    const plugin = createPatternPlugin(languageId, patterns, options);
    if (plugin) manager.register(plugin);
    return plugin;
}

function registerBuiltinPlugins(manager) {
    const zscriptPlugin = new LanguagePlugin({
        id: 'zscript-analyzer-v1',
        language: 'zscript',
        label: 'ZScript',
        extensions: ['.zs', '.zscript'],
        version: '1.1.0',
        parser: 'custom-zscript',
        patterns: zscriptPatterns,
        contentIndicators: [
            { pattern: /\bclass\s+\w+\s*:\s*\w+/g, weight: 3 },
            { pattern: /\bStates\s*\{/g, weight: 3 },
            { pattern: /\bA_\w+\s*\(/g, weight: 2 }
        ]
    });
    zscriptPlugin.structureParser = (content, filePath) => {
        return zscriptStructureParser.parse(content, { filePath });
    };
    manager.register(zscriptPlugin);

    manager.register(createPatternPlugin('acs', {
        debug: [
            { id: 'acs-print', pattern: /\bPrint\s*\(/gi, label: 'ACS debug print' },
            { id: 'acs-log', pattern: /\bLog\s*\(/gi, label: 'ACS log call' }
        ],
        contentIndicators: [
            { pattern: /\bscript\s+\w+\s*\(/g, weight: 3 }
        ]
    }));

    manager.register(createPatternPlugin('decorate', {
        bestPractices: [
            { id: 'actor-block', pattern: /\bActor\s+\w+/gi, label: 'DECORATE actor definition' }
        ]
    }));

    manager.register(createPatternPlugin('glsl', {
        debug: [
            { id: 'glsl-debug-output', pattern: /\bfragColor\s*=\s*vec4\s*\(\s*1\.0\s*,\s*0\.0/gi, label: 'GLSL debug color output' }
        ],
        contentIndicators: [
            { pattern: /\bvoid\s+main\s*\(\s*\)/g, weight: 3 }
        ]
    }));

    manager.register(createPatternPlugin('lua', {
        debug: [
            { id: 'lua-print', pattern: /\bprint\s*\(/gi, label: 'Lua print statement' }
        ]
    }));

    registerDedicatedPatternPlugin(manager, 'python', pythonPatterns, { version: '1.0.0' });
    registerDedicatedPatternPlugin(manager, 'rust', rustPatterns, { version: '1.0.0' });
    registerDedicatedPatternPlugin(manager, 'go', goPatterns, { version: '1.0.0' });
    registerDedicatedPatternPlugin(manager, 'sql', sqlPatterns, { version: '1.0.0' });

    registerGenericFallbackPlugins(manager);
}

module.exports = {
    registerBuiltinPlugins,
    createPatternPlugin,
    registerDedicatedPatternPlugin
};
