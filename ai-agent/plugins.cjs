const fs = require('fs');
const path = require('path');

/**
 * Load plugins from a directory. Each plugin should export a `register(agentApi)` function.
 * The `agentApi` provides helpers and a `registerPlugin` callback for the plugin to declare capabilities.
 */
function loadPlugins(pluginsDir, agentApi) {
    var loaded = [];
    try {
        if (!fs.existsSync(pluginsDir)) return loaded;
        const files = fs.readdirSync(pluginsDir);
        for (const f of files) {
            const full = path.join(pluginsDir, f);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) continue;
            if (!/\.cjs$|\.js$|\.mjs$/.test(f)) continue;
            try {
                const mod = require(full);
                if (mod && typeof mod.register === 'function') {
                    try {
                        const res = mod.register(agentApi) || {};
                        loaded.push({ file: f, name: res.name || res.id || f, module: mod, meta: res });
                    } catch (err) {
                        // plugin init failed — continue
                        if (agentApi && agentApi.debug) agentApi.debug(`Plugin ${f} register error: ${err.message}`);
                    }
                }
            } catch (err) {
                if (agentApi && agentApi.debug) agentApi.debug(`Failed to load plugin ${f}: ${err.message}`);
            }
        }
    } catch (err) {
        if (agentApi && agentApi.debug) agentApi.debug(`loadPlugins error: ${err.message}`);
    }
    return loaded;
}

module.exports = { loadPlugins };
