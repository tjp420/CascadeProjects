'use strict';
// VS Code Agent integration helper for the SimpleBeacon plugin
// This file provides a tiny adapter that a VS Code extension can require
// from its extension activation function to register commands that call
// the simplebeacon plugin handlers.

// Usage (in your VS Code extension activation):
// const adapter = require('<repo-path>/ai-agent/plugins/vscode-agent-integration.cjs');
// adapter.install(context, require('vscode'));

// Safety notes:
// - The adapter will call plugin.register with a small agentContext that
//   exposes registerHandler(name, fn). Handlers are registered as
//   vscode.commands under the same name. Choose command names carefully.
// - Ensure your extension runs with appropriate permissions and input
//   is validated before being forwarded to the scanning CLI.

module.exports = {
  install: function install(context, vscode, opts = {}) {
    const pluginPath = opts.pluginPath || './ai-agent/plugins/simplebeacon-plugin.cjs';
    let plugin;
    try {
      // Resolve relative to extension workspace if supplied
      const resolved = require.resolve(pluginPath, { paths: [process.cwd(), __dirname] });
      plugin = require(resolved);
    } catch (err) {
      throw new Error(`Could not load simplebeacon plugin at ${pluginPath}: ${err.message}`);
    }

    const registeredCommands = [];

    const agentContext = {
      registerHandler: (name, fn) => {
        // Normalize command name: vscode commands must include an extension prefix in production
        const commandName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const disposable = vscode.commands.registerCommand(commandName, async (args) => {
          // Args should be an object with { projectPath, full }
          try {
            const result = await fn(args || {});
            return result;
          } catch (err) {
            // Bubble up the error to the extension caller
            throw err;
          }
        });
        context.subscriptions.push(disposable);
        registeredCommands.push(commandName);
        return disposable;
      }
    };

    // Register plugin handlers and return them for direct programmatic use
    const handlers = plugin.register(agentContext) || {};

    return { plugin, handlers, registeredCommands };
  }
};
