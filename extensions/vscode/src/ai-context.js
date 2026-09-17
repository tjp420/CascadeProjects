const path = require('path');
let vscode;
try {
  // require vscode when available (in extension runtime)
  vscode = require('vscode');
} catch (e) {
  // Not running in VS Code — keep undefined for tests
  vscode = null;
}

function buildContextBrief(document) {
  const workspaceFolder = vscode && vscode.workspace ? vscode.workspace.getWorkspaceFolder(document.uri) : null;
  const relativePath = workspaceFolder
    ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
    : (document.fileName || document.uri && document.uri.fsPath || 'unknown');

  const text = typeof document.getText === 'function' ? document.getText() : '';
  const imports = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('import ') ||
      (trimmed.startsWith('const ') && trimmed.includes('require(')) ||
      trimmed.startsWith('require(')
    ) {
      imports.push(trimmed);
    }
  }

  const functions = [];
  // Match plain function declarations
  const declPattern = /function\s+([A-Za-z0-9_\$]+)/g;
  let m;
  while ((m = declPattern.exec(text)) !== null) {
    functions.push(m[1]);
  }
  // Match const/let/var assignments to functions or arrow functions
  const assignPattern = /(?:const|let|var)\s+([A-Za-z0-9_\$]+)\s*=\s*(?:async\s*)?(?:function|\()/g;
  while ((m = assignPattern.exec(text)) !== null) {
    functions.push(m[1]);
  }

  return [
    '[SIMPLEBEACON AI CONTEXT]',
    '',
    `File: ${relativePath}`,
    `Language: ${document.languageId || 'unknown'}`,
    `Lines: ${lines.length}`,
    '',
    'IMPORTS / DEPENDENCIES:',
    ...(imports.length ? imports.slice(0, 30) : ['None detected']),
    '',
    'FUNCTIONS:',
    ...(functions.length ? functions.slice(0, 50).map(name => `- ${name}`) : ['None detected']),
    '',
    'AI CONSTRAINTS:',
    '- Work from the existing codebase.',
    '- Do not invent files, functions, APIs, or dependencies.',
    '- Do not modify unrelated files unless required.',
    '- Preserve existing behavior unless the user explicitly requests a behavior change.',
    '- Verify proposed symbols against the workspace before using them.',
    '',
    'IMPORTANT:',
    'This context was generated locally by SimpleBeacon.',
    'It is descriptive context, not a security verdict.'
  ].join('\n');
}

function registerAiContextCommand(context) {
  if (!vscode) return; // only available in extension runtime

  const command = vscode.commands.registerCommand(
    'simplebeacon.generateAIContext',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('SimpleBeacon: Open a source file first.');
        return;
      }

      const brief = buildContextBrief(editor.document);
      await vscode.env.clipboard.writeText(brief);
      vscode.window.showInformationMessage('SimpleBeacon AI Context copied to clipboard.');
    }
  );
  context.subscriptions.push(command);
}

const CONSTRAINTS = [
  'preserve_existing_api',
  'no_new_dependencies',
  'avoid_unrelated_files',
  'do_not_invent_symbols',
];

function collectFunctionNames(text) {
  const functions = [];
  const seen = new Set();
  const declPattern = /function\s+([A-Za-z0-9_\$]+)/g;
  let m;
  while ((m = declPattern.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      functions.push(m[1]);
    }
  }
  const assignPattern = /(?:const|let|var)\s+([A-Za-z0-9_\$]+)\s*=\s*(?:async\s*)?(?:function|\()/g;
  while ((m = assignPattern.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      functions.push(m[1]);
    }
  }
  return functions;
}

function collectImportSpecs(text) {
  const specs = [];
  const seen = new Set();
  const specRe = /(?:from\s+|require\s*\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = specRe.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      specs.push(m[1]);
    }
  }
  return specs;
}

function toPosix(value) {
  return String(value || '').split('\\').join('/');
}

function buildWorkspaceVerificationPayload(document, input) {
  const requestedFile = input && input.requestedFile ? String(input.requestedFile) : '';
  if (!document) {
    return {
      simplebeacon: { version: 2, operation: 'workspace_verification', verified: false },
      status: 'error',
      reason: requestedFile ? 'Requested file does not exist' : 'No active editor',
      file: { path: toPosix(requestedFile), exists: false },
      functions: [],
      imports: [],
      relevantFiles: [],
      unresolvedImports: [],
      symbols: { verified: [], notFound: [], status: {} },
      verification: [],
      constraints: CONSTRAINTS.slice(),
      diagnostics: [],
      evidence: [],
      scope: { requestedFile: toPosix(requestedFile), relatedFiles: [] },
    };
  }

  const fsPath = document.uri && document.uri.fsPath ? document.uri.fsPath : document.fileName;
  const workspaceFolder = vscode && vscode.workspace ? vscode.workspace.getWorkspaceFolder(document.uri) : null;
  const relativePath = workspaceFolder
    ? toPosix(path.relative(workspaceFolder.uri.fsPath, fsPath))
    : toPosix(fsPath);
  const text = typeof document.getText === 'function' ? document.getText() : '';
  const functions = collectFunctionNames(text);
  const imports = collectImportSpecs(text);
  const verifyNames = [];
  if (input && input.verifySymbol) verifyNames.push(String(input.verifySymbol).trim());
  if (input && Array.isArray(input.verifySymbols)) {
    for (const name of input.verifySymbols) {
      const trimmed = String(name || '').trim();
      if (trimmed) verifyNames.push(trimmed);
    }
  }
  const notFound = [];
  const status = {};
  const verification = [];
  const evidence = [];
  for (const name of verifyNames) {
    const found = functions.indexOf(name) !== -1;
    status[name] = found ? 'found' : 'not_found';
    verification.push({ symbol: name, status: status[name], file: relativePath });
    if (!found) notFound.push(name);
    evidence.push({
      claim: 'function ' + name + ' exists',
      file: relativePath,
      symbol: name,
      exists: found,
    });
  }

  return {
    simplebeacon: {
      version: 2,
      operation: 'workspace_verification',
      verified: notFound.length === 0,
    },
    status: 'ok',
    file: { path: relativePath, exists: true },
    functions,
    imports,
    relevantFiles: [relativePath],
    unresolvedImports: imports.filter((spec) => spec.indexOf('.') === 0),
    symbols: { verified: functions, notFound, status },
    verification,
    constraints: CONSTRAINTS.slice(),
    diagnostics: [],
    evidence,
    language: document.languageId,
    lines: document.lineCount,
    scope: { requestedFile: relativePath, relatedFiles: imports },
  };
}

module.exports = {
  buildContextBrief,
  buildWorkspaceVerificationPayload,
  registerAiContextCommand,
};
