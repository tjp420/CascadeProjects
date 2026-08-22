/**
 * Rule pack installer — installs a domain-specific rule pack into the
 * current workspace's `.simplebeacon/custom-rules.json`.
 *
 * Milestone 2: Domain Rule Packs
 *
 * Available packs:
 * - gzdoom: GZDoom mod development (ZScript, config, launch scripts, asset refs)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface RulePackManifest {
  name: string;
  description: string;
  version: string;
  rules: any[];
  severityOverrides: any[];
  allowlist?: string[];
}

// Built-in rule packs (bundled with the extension)
const BUILTIN_PACKS: Record<string, string> = {
  gzdoom: 'gzdoom.json',
};

/**
 * List available rule packs.
 */
export function listAvailablePacks(): string[] {
  return Object.keys(BUILTIN_PACKS);
}

/**
 * Install a rule pack into the current workspace.
 *
 * Merges the pack's rules into the existing `.simplebeacon/custom-rules.json`
 * (if it exists) or creates a new file. Does not overwrite existing rules
 * with the same ID — instead skips them and reports the conflict.
 */
export function installRulePack(
  packName: string,
  workspaceRoot: string
): { installed: number; skipped: number; filePath: string } {
  const packFileName = BUILTIN_PACKS[packName];
  if (!packFileName) {
    throw new Error(`Unknown rule pack: ${packName}. Available: ${Object.keys(BUILTIN_PACKS).join(', ')}`);
  }

  // Load the pack from the extension's bundled rules
  const packPath = path.join(__dirname, '..', 'rulePacks', packFileName);
  let pack: RulePackManifest;
  try {
    pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to load rule pack ${packName}: ${err}`);
  }

  // Ensure .simplebeacon directory exists
  const sbDir = path.join(workspaceRoot, '.simplebeacon');
  if (!fs.existsSync(sbDir)) {
    fs.mkdirSync(sbDir, { recursive: true });
  }

  const customRulesPath = path.join(sbDir, 'custom-rules.json');

  // Load existing custom rules if present
  let existing: any = { rules: [], severityOverrides: [], allowlist: [] };
  if (fs.existsSync(customRulesPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(customRulesPath, 'utf8'));
      if (!Array.isArray(existing.rules)) existing.rules = [];
      if (!Array.isArray(existing.severityOverrides)) existing.severityOverrides = [];
      if (!Array.isArray(existing.allowlist)) existing.allowlist = [];
    } catch {
      // If existing file is malformed, start fresh
      existing = { rules: [], severityOverrides: [], allowlist: [] };
    }
  }

  // Merge rules — skip duplicates by ID
  const existingIds = new Set(existing.rules.map((r: any) => r.id));
  let installed = 0;
  let skipped = 0;

  for (const rule of pack.rules) {
    if (existingIds.has(rule.id)) {
      skipped++;
      continue;
    }
    existing.rules.push(rule);
    existingIds.add(rule.id);
    installed++;
  }

  // Merge severity overrides (no dedup — they're additive)
  for (const override of pack.severityOverrides || []) {
    existing.severityOverrides.push(override);
  }

  // Merge allowlist
  if (pack.allowlist) {
    for (const entry of pack.allowlist) {
      if (!existing.allowlist.includes(entry)) {
        existing.allowlist.push(entry);
      }
    }
  }

  // Write the merged config
  fs.writeFileSync(customRulesPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

  return { installed, skipped, filePath: customRulesPath };
}

/**
 * VS Code command handler for installing a rule pack.
 */
export async function installRulePackCommand(): Promise<void> {
  const packs = listAvailablePacks();
  if (packs.length === 0) {
    vscode.window.showInformationMessage('No rule packs available.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    packs.map((p) => ({ label: p, description: `Install the ${p} rule pack` })),
    { placeHolder: 'Select a rule pack to install' }
  );

  if (!selected) return;

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  try {
    const result = installRulePack(selected.label, root);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(result.filePath));
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `✅ Installed ${selected.label} rule pack: ${result.installed} rules added, ${result.skipped} skipped (duplicate IDs)`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to install rule pack: ${err}`);
  }
}
