/**
 * Allowlist suggester — watches for repeated finding dismissals
 * and suggests adding them to `.simplebeacon/config.json` allowlist.
 *
 * Milestone 2: Repo-Specific Custom Rules
 */

import * as vscode from 'vscode';
import { getDismissalTracker } from '../classifiers/dismissalTracker';

const DISMISSAL_THRESHOLD = 3; // Suggest after 3 dismissals of the same rule type
const SUGGESTION_COOLDOWN = 60000; // 1 minute between suggestions for the same rule

const suggestedRules = new Map<string, number>(); // ruleType → last suggestion timestamp

/**
 * Check if any rules should be suggested for allowlisting.
 * Call this after a finding is dismissed.
 */
export function checkAndSuggestAllowlist(): void {
  const tracker = getDismissalTracker();
  const suggestions = tracker.getSuggestions();

  if (suggestions.length === 0) return;

  const now = Date.now();
  for (const suggestion of suggestions) {
    // Check cooldown
    const lastSuggested = suggestedRules.get(suggestion.ruleType) || 0;
    if (now - lastSuggested < SUGGESTION_COOLDOWN) continue;

    // Check if we have enough dismissals to suggest
    const stats = tracker.getStats(suggestion.ruleType);
    if (!stats || stats.dismissedFindings < DISMISSAL_THRESHOLD) continue;

    // Show the suggestion
    suggestedRules.set(suggestion.ruleType, now);

    const message = `🔔 AI Slop Cop: Rule "${suggestion.ruleType}" has a ${(suggestion.dismissalRate * 100).toFixed(0)}% dismissal rate (${stats.dismissedFindings}/${stats.totalFindings} findings dismissed). Consider allowlisting it.`;

    vscode.window
      .showInformationMessage(message, 'Add to allowlist', 'Open noise dashboard', 'Dismiss')
      .then((selection) => {
        if (selection === 'Add to allowlist') {
          addRuleToAllowlist(suggestion.ruleType);
        } else if (selection === 'Open noise dashboard') {
          vscode.commands.executeCommand('simplebeacon.showNoiseDashboard');
        }
      });

    break; // Only show one suggestion at a time
  }
}

/**
 * Add a rule to the allowlist in `.simplebeacon/config.json`.
 */
async function addRuleToAllowlist(ruleType: string): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const root = workspaceFolders[0].uri.fsPath;
  const configPath = `${root}/.simplebeacon/config.json`;

  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    const text = doc.getText();

    // Try to parse the existing config
    let config: any;
    try {
      config = JSON.parse(text);
    } catch {
      vscode.window.showErrorMessage('Could not parse .simplebeacon/config.json — please add the allowlist manually.');
      return;
    }

    // Add to the rules section with enabled: false
    if (!config.rules) config.rules = {};
    if (!config.rules[ruleType]) {
      config.rules[ruleType] = {
        enabled: false,
        reason: `Auto-disabled: high dismissal rate detected by noise dashboard`,
      };
    } else {
      config.rules[ruleType].enabled = false;
      if (!config.rules[ruleType].reason) {
        config.rules[ruleType].reason = 'Auto-disabled: high dismissal rate detected by noise dashboard';
      }
    }

    // Write back
    const newText = JSON.stringify(config, null, 2) + '\n';
    const edit = new vscode.WorkspaceEdit();
    edit.replace(vscode.Uri.file(configPath), new vscode.Range(0, 0, doc.lineCount, 0), newText);
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    vscode.window.showInformationMessage(`✅ Rule "${ruleType}" disabled in .simplebeacon/config.json`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to update config: ${err}`);
  }
}
