/** Minimal VS Code API mock for unit tests */

/** Mock workspace API. */
export const workspace = {
  workspaceFolders: undefined,
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    update: jest.fn(),
  })),
  findFiles: jest.fn(() => Promise.resolve([])),
  fs: {
    readFile: jest.fn(() => Promise.resolve(new Uint8Array())),
  },
};

/** Mock window API. */
export const window = {
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  })),
  showTextDocument: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  activeColorTheme: { kind: 1 },
  showOpenDialog: jest.fn(),
  showQuickPick: jest.fn(),
};

/** Mock ViewColumn enum. */
export const ViewColumn = {
  One: 1,
};

/** Mock TreeItemCollapsibleState enum. */
export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

/** Mock ThemeIcon constructor. */
export const ThemeIcon = jest.fn();
/** Mock ThemeColor constructor. */
export const ThemeColor = jest.fn();
/** Mock Uri factory. */
export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
  joinPath: jest.fn((...args: any[]) => ({ fsPath: args.join('/') })),
};

/** Mock Range constructor. */
export const Range = jest.fn();
/** Mock ProgressLocation enum. */
export const ProgressLocation = { Notification: 15 };
/** Mock ColorThemeKind enum. */
export const ColorThemeKind = { Light: 1, Dark: 2 };
