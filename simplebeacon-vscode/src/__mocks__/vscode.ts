// Minimal VS Code API mock for unit tests
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

export const ViewColumn = {
  One: 1,
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export const ThemeIcon = jest.fn();
export const ThemeColor = jest.fn();
export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
  joinPath: jest.fn((...args: any[]) => ({ fsPath: args.join('/') })),
};

export const Range = jest.fn();
export const ProgressLocation = { Notification: 15 };
export const ColorThemeKind = { Light: 1, Dark: 2 };
