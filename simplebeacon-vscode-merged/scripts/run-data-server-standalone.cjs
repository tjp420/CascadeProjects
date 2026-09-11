"use strict";

const path = require("path");
const Module = require("module");

const extensionPath = path.resolve(__dirname, "..");
const workspacePath = path.resolve(__dirname, "..", "..");

const vscode = {
  workspace: {
    workspaceFolders: [{ name: "CascadeProjects", uri: { fsPath: workspacePath } }],
    getConfiguration: () => ({
      get: (key, def) => (key === "dataServerPort" ? 54358 : def),
      has: () => false,
      update: async () => {},
    }),
  },
  window: {
    showOpenDialog: async () => undefined,
    showInformationMessage: () => {},
    showErrorMessage: () => {},
    showWarningMessage: () => {},
    createOutputChannel: () => ({ appendLine: () => {}, append: () => {} }),
  },
  commands: { executeCommand: async () => undefined },
  Uri: { file: (p) => ({ fsPath: p }) },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") return vscode;
  return originalLoad.apply(this, arguments);
};

const { startDataServer, getDataServerPort } = require("../out/dataServer.js");

const context = {
  extensionPath,
  extension: { packageJSON: { version: "3.0.581-local" } },
  subscriptions: [],
  workspaceState: { get: () => undefined, update: async () => {} },
  globalState: { get: () => undefined, update: async () => {} },
  secrets: { get: async () => undefined, store: async () => {}, delete: async () => {} },
};

startDataServer(context, { appendLine: (m) => console.log(m) });
console.log(`[standalone-data-server] listening on http://127.0.0.1:${getDataServerPort()}`);
