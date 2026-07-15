import * as vscode from 'vscode';
import { getSbConfig } from './utils/vscode';

// In-memory runtime flag that persists only for the duration of this editor window session
let hasPromptedReferralThisSession = false;

/**
 * Register the "Share Clean Badge" command that copies a Markdown badge
 * to the clipboard for the current workspace repository.
 */
export function registerReferralEngine(context: vscode.ExtensionContext): void {
  const shareCommand = vscode.commands.registerCommand('simplebeacon.shareCleanBadge', () => {
    const repoName = vscode.workspace.name || 'my-repo';
    const markdownBadge = `[![AI Slop Cop Clean](https://img.shields.io/badge/AI%20Slop%20Cop-Clean-22c55e)](https://simplebeacon.ai?utm_repo=${encodeURIComponent(repoName)})`;

    vscode.env.clipboard.writeText(markdownBadge).then(
      () => {
        vscode.window.showInformationMessage('🚀 SimpleBeacon: Compliance repository badge copied to your clipboard!');
      },
      () => {
        vscode.window.showErrorMessage('❌ SimpleBeacon: Failed to copy badge to clipboard.');
      }
    );
  });

  context.subscriptions.push(shareCommand);
}

/**
 * Evaluate scan outcomes and prompt the user to share a badge when the
 * workspace achieves a perfect 100/100 quality score.
 *
 * Constrained to fire a maximum of once per active workspace session.
 */
export function evaluateReferralPrompt(qualityScore: number): void {
  if (hasPromptedReferralThisSession) {
    return;
  }

  const config = getSbConfig();
  const promptsEnabled = config.get<boolean>('enableReferralPrompts', true);

  if (promptsEnabled && qualityScore === 100) {
    hasPromptedReferralThisSession = true;

    vscode.window
      .showInformationMessage(
        '🎉 100/100 Quality Score! This workspace is officially free of AI Slop.',
        'Get Shareable Badge'
      )
      .then((selection) => {
        if (selection === 'Get Shareable Badge') {
          vscode.commands.executeCommand('simplebeacon.shareCleanBadge');
        }
      });
  }
}

/**
 * Administrative reset hook for debugging or testing loops programmatically.
 */
export function resetReferralSessionState(): void {
  hasPromptedReferralThisSession = false;
}
