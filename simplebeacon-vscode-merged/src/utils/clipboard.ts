// simplebeacon-ignore memory-leak — VS Code clipboard utility functions
import * as vscode from 'vscode';

/**
 * Copy text to the VS Code clipboard.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await vscode.env.clipboard.writeText(String(text));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text from the VS Code clipboard.
 * @returns {Promise<string>}
 */
export async function readFromClipboard(): Promise<string> {
  try {
    return await vscode.env.clipboard.readText();
  } catch {
    return '';
  }
}
