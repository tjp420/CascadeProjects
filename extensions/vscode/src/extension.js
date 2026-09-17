let registerAiContextCommand;
let registerSimpleBeaconTool;
try {
  // Defer importing the helpers so tests can require the module without vscode present
  ({ registerAiContextCommand } = require('./ai-context'));
} catch (e) {
  // noop — tests will import buildContextBrief directly
}
try {
  ({ registerSimpleBeaconTool } = require('./lm-tool'));
} catch (e) {
  // noop when running outside VS Code
}

/**
 * VS Code extension activation
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  if (typeof registerAiContextCommand === 'function') {
    registerAiContextCommand(context);
  }
  if (typeof registerSimpleBeaconTool === 'function') {
    registerSimpleBeaconTool(context);
  }
}

function deactivate() {
  // no-op
}

module.exports = { activate, deactivate };
