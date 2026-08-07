import * as vscode from 'vscode';

/**
 * Quick-fix provider for security diagnostics emitted by the SimpleBeacon
 * workspace analyzer. Provides deterministic, inline WorkspaceEdit fixes for
 * the most common security patterns:
 *
 *   - evalDanger:     Replace eval(x) with JSON.parse(x)
 *   - innerHtmlXss:   Replace .innerHTML = with .textContent =
 *   - dbAntiPattern:  Wrap string-concatenated query in parameterized call
 *   - credentials:    Replace hardcoded secret with process.env reference
 *   - loggingSecrets: Remove console.log that outputs secrets
 *
 * Also provides a "Show remediation guide" action for all security diagnostics
 * that routes to the SimpleBeacon remediation panel.
 */

const SECURITY_PATTERN_IDS = new Set([
  'evalDanger',
  'innerHtmlXss',
  'dbAntiPattern',
  'credentials',
  'loggingSecrets',
  'sensitiveData',
  'prototypePollution',
  'configDrift',
  'productionLeak',
  'hallucinatedImport',
]);

function isSecurityDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  const code = String(diagnostic.code || '');
  if (SECURITY_PATTERN_IDS.has(code)) return true;
  const source = String(diagnostic.source || '');
  return source === 'SimpleBeacon' && SECURITY_PATTERN_IDS.has(code);
}

/**
 * Extract the matched text from the document at the diagnostic range.
 */
function getMatchedText(document: vscode.TextDocument, range: vscode.Range): string {
  return document.getText(range);
}

/**
 * Build a WorkspaceEdit for evalDanger: replace eval(expr) with JSON.parse(expr).
 * Only applies when the matched text contains eval( — not new Function or setTimeout.
 */
function fixEvalDanger(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  const evalMatch = matchedText.match(/\beval\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (!evalMatch) return null;

  const innerExpr = evalMatch[1].trim();
  const replacement = `JSON.parse(${innerExpr})`;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, replacement);
  return edit;
}

/**
 * Build a WorkspaceEdit for innerHtmlXss: replace .innerHTML = with .textContent =.
 */
function fixInnerHtmlXss(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  if (!/\.innerHTML\s*=/.test(matchedText)) return null;

  const replacement = matchedText.replace(/\.innerHTML\s*=/, '.textContent =');
  if (replacement === matchedText) return null;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, replacement);
  return edit;
}

/**
 * Build a WorkspaceEdit for dbAntiPattern: replace string-concatenated query
 * with a parameterized query placeholder.
 *
 * Example: db.query("SELECT * FROM users WHERE id = " + userId)
 *       -> db.query("SELECT * FROM users WHERE id = $1", [userId])
 */
function fixDbAntiPattern(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  // Match patterns like: .query("SELECT ... " + variable)
  const concatMatch = matchedText.match(
    /(\w+(?:\.\w+)*)\s*\(\s*(['"`])([\s\S]*?)\2\s*\+\s*(\w+)\s*\)/
  );
  if (!concatMatch) return null;

  const [, queryFn, quote, sqlBody, variable] = concatMatch;
  // Find the last condition to parameterize
  const paramMatch = sqlBody.match(/=\s*$/);
  if (!paramMatch) return null;

  const newSql = sqlBody.replace(/=\s*$/, '= $1');
  const replacement = `${queryFn}(${quote}${newSql}${quote}, [${variable}])`;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, replacement);
  return edit;
}

/**
 * Build a WorkspaceEdit for credentials: replace hardcoded secret string
 * with process.env reference.
 *
 * Example: const API_KEY = "sk_live_abc123"
 *       -> const API_KEY = process.env.API_KEY
 */
function fixCredentials(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  // Match: const/var/let NAME = "secret_value"
  const credMatch = matchedText.match(
    /(const|let|var)\s+(\w+)\s*=\s*(['"])(?:sk_|pk_|re_|ghp_|gho_|AKIA|AIza)[\w]{6,}['"]/
  );
  if (!credMatch) return null;

  const [, keyword, varName] = credMatch;
  const replacement = `${keyword} ${varName} = process.env.${varName}`;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, replacement);
  return edit;
}

/**
 * Build a WorkspaceEdit for loggingSecrets: comment out the console.log
 * statement that outputs a secret.
 */
function fixLoggingSecrets(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  if (!/console\.log\s*\(/.test(matchedText)) return null;

  // Comment out the line
  const lineStart = new vscode.Position(range.start.line, 0);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, lineStart, '// ');
  return edit;
}

/**
 * Build a WorkspaceEdit for prototypePollution: replace __proto__ assignment
 * with Object.create(null) pattern.
 */
function fixPrototypePollution(
  document: vscode.TextDocument,
  range: vscode.Range,
  matchedText: string
): vscode.WorkspaceEdit | null {
  const protoMatch = matchedText.match(
    /(const|let|var)\s+(\w+)\s*=\s*\{\s*__proto__\s*:/ 
  );
  if (!protoMatch) return null;

  const [, keyword, varName] = protoMatch;
  const replacement = `${keyword} ${varName} = Object.assign(Object.create(null), {`;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, range, replacement + matchedText.slice(protoMatch[0].length));
  return edit;
}

interface FixRecipe {
  patternId: string;
  title: string;
  buildEdit: (
    document: vscode.TextDocument,
    range: vscode.Range,
    matchedText: string
  ) => vscode.WorkspaceEdit | null;
}

const FIX_RECIPES: FixRecipe[] = [
  { patternId: 'evalDanger', title: 'Replace eval() with JSON.parse()', buildEdit: fixEvalDanger },
  { patternId: 'innerHtmlXss', title: 'Replace .innerHTML with .textContent', buildEdit: fixInnerHtmlXss },
  { patternId: 'dbAntiPattern', title: 'Convert to parameterized query', buildEdit: fixDbAntiPattern },
  { patternId: 'credentials', title: 'Replace with process.env reference', buildEdit: fixCredentials },
  { patternId: 'loggingSecrets', title: 'Comment out secret logging', buildEdit: fixLoggingSecrets },
  { patternId: 'prototypePollution', title: 'Replace __proto__ with Object.create(null)', buildEdit: fixPrototypePollution },
];

export class SecurityQuickFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    const securityDiagnostics = context.diagnostics.filter(isSecurityDiagnostic);

    for (const diagnostic of securityDiagnostics) {
      const patternId = String(diagnostic.code || '');
      const matchedText = getMatchedText(document, diagnostic.range);

      // Try each fix recipe for this pattern
      for (const recipe of FIX_RECIPES) {
        if (recipe.patternId !== patternId) continue;

        const edit = recipe.buildEdit(document, diagnostic.range, matchedText);
        if (!edit) continue;

        const action = new vscode.CodeAction(
          `SimpleBeacon: ${recipe.title}`,
          vscode.CodeActionKind.QuickFix
        );
        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }

      // Always add a "show remediation guide" action for security diagnostics
      const guideAction = new vscode.CodeAction(
        'SimpleBeacon: Show remediation guide',
        vscode.CodeActionKind.QuickFix
      );
      guideAction.diagnostics = [diagnostic];
      guideAction.command = {
        title: 'Show remediation guide',
        command: 'simplebeacon.showRemediationGuide',
      };
      actions.push(guideAction);

      // Add "send to Ollama" for AI-assisted remediation
      const ollamaAction = new vscode.CodeAction(
        'SimpleBeacon: Send to local Ollama remediation',
        vscode.CodeActionKind.QuickFix
      );
      ollamaAction.diagnostics = [diagnostic];
      ollamaAction.command = {
        title: 'Send to local Ollama remediation',
        command: 'simplebeacon.remediateDiagnostic',
        arguments: [document.uri, diagnostic.range, patternId, diagnostic.message, matchedText],
      };
      actions.push(ollamaAction);
    }

    return actions;
  }
}
