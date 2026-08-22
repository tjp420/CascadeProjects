/**
 * Custom rule loader — loads repo-specific custom rules from
 * `.simplebeacon/custom-rules.json` and severity overrides from
 * `.simplebeacon/config.json`.
 *
 * Milestone 2: Repo-Specific Custom Rules
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileRole } from '../classifiers/fileRoleClassifier';

export interface CustomRule {
  id: string;
  /** Regex pattern to match against file content (line-by-line) */
  regex: string;
  /** Regex flags (default: 'gi') */
  regexFlags?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  /** Glob pattern for file paths this rule applies to (e.g. "src/**") */
  fileGlob?: string;
  /** File roles this rule applies to (e.g. ["app", "config"]) */
  fileRoles?: FileRole[];
  /** File extensions this rule applies to (e.g. [".ts", ".js"]) */
  fileExtensions?: string[];
  /** Confidence threshold (0-1). Findings below this are suppressed. */
  confidence?: number;
  /** Whether this rule is enabled */
  enabled?: boolean;
}

export interface SeverityOverride {
  /** The built-in rule type to override */
  ruleType: string;
  /** The new severity (use 'suppressed' to disable the rule) */
  severity: 'error' | 'warning' | 'info' | 'suppressed';
  /** Glob pattern for file paths this override applies to */
  fileGlob?: string;
  /** File roles this override applies to */
  fileRoles?: FileRole[];
  /** Reason for the override (for audit) */
  reason?: string;
}

export interface CustomRulesConfig {
  rules: CustomRule[];
  severityOverrides: SeverityOverride[];
  /** Additional allowlist glob patterns */
  allowlist?: string[];
}

const DEFAULT_CONFIG: CustomRulesConfig = {
  rules: [],
  severityOverrides: [],
  allowlist: [],
};

/**
 * Load custom rules from `.simplebeacon/custom-rules.json`.
 * Returns a default empty config if the file doesn't exist.
 */
export function loadCustomRules(workspaceRoot?: string): CustomRulesConfig {
  const root = workspaceRoot || getWorkspaceRoot();
  if (!root) return DEFAULT_CONFIG;

  const customRulesPath = path.join(root, '.simplebeacon', 'custom-rules.json');

  try {
    if (!fs.existsSync(customRulesPath)) {
      return DEFAULT_CONFIG;
    }

    const content = fs.readFileSync(customRulesPath, 'utf8');
    const parsed = JSON.parse(content);

    // Validate and normalize
    const rules: CustomRule[] = [];
    if (Array.isArray(parsed.rules)) {
      for (const rule of parsed.rules) {
        if (isValidCustomRule(rule)) {
          rules.push(normalizeRule(rule));
        }
      }
    }

    const severityOverrides: SeverityOverride[] = [];
    if (Array.isArray(parsed.severityOverrides)) {
      for (const override of parsed.severityOverrides) {
        if (isValidSeverityOverride(override)) {
          severityOverrides.push(override);
        }
      }
    }

    const allowlist = Array.isArray(parsed.allowlist) ? parsed.allowlist : [];

    return { rules, severityOverrides, allowlist };
  } catch (err) {
    // Don't crash the extension if custom rules are malformed
    console.error('[SimpleBeacon] Failed to load custom rules:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Load severity overrides from the main `.simplebeacon/config.json`.
 * These are in the `rules` section as `severity` fields.
 */
export function loadSeverityOverridesFromConfig(workspaceRoot?: string): SeverityOverride[] {
  const root = workspaceRoot || getWorkspaceRoot();
  if (!root) return [];

  const configPath = path.join(root, '.simplebeacon', 'config.json');

  try {
    if (!fs.existsSync(configPath)) return [];

    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);

    const overrides: SeverityOverride[] = [];
    if (parsed.rules && typeof parsed.rules === 'object') {
      for (const [ruleName, ruleConfig] of Object.entries(parsed.rules)) {
        const cfg = ruleConfig as any;
        if (cfg.severity && typeof cfg.severity === 'string') {
          // Map config severity to our severity levels
          const sev = mapConfigSeverity(cfg.severity);
          if (sev) {
            overrides.push({
              ruleType: ruleName,
              severity: sev,
              reason: cfg.reason || `Override from config.json: ${cfg.severity}`,
            });
          }
        }
        // Disabled rules are suppression overrides
        if (cfg.enabled === false) {
          overrides.push({
            ruleType: ruleName,
            severity: 'suppressed',
            reason: cfg.reason || 'Disabled in config.json',
          });
        }
      }
    }

    return overrides;
  } catch {
    return [];
  }
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath;
}

function isValidCustomRule(rule: any): rule is CustomRule {
  return (
    rule &&
    typeof rule.id === 'string' &&
    typeof rule.regex === 'string' &&
    typeof rule.message === 'string' &&
    ['error', 'warning', 'info'].includes(rule.severity)
  );
}

function isValidSeverityOverride(override: any): override is SeverityOverride {
  return (
    override &&
    typeof override.ruleType === 'string' &&
    ['error', 'warning', 'info', 'suppressed'].includes(override.severity)
  );
}

function normalizeRule(rule: CustomRule): CustomRule {
  return {
    ...rule,
    regexFlags: rule.regexFlags || 'gi',
    enabled: rule.enabled !== false, // default to enabled
  };
}

function mapConfigSeverity(sev: string): 'error' | 'warning' | 'info' | null {
  const lower = sev.toLowerCase();
  if (lower === 'critical' || lower === 'error' || lower === 'high') return 'error';
  if (lower === 'warning' || lower === 'medium') return 'warning';
  if (lower === 'info' || lower === 'low') return 'info';
  return null;
}

/**
 * Create a sample custom-rules.json file.
 * Useful for the "Initialize custom rules" command.
 */
export function createSampleCustomRules(workspaceRoot: string): string {
  const dir = path.join(workspaceRoot, '.simplebeacon');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const samplePath = path.join(dir, 'custom-rules.json');
  if (fs.existsSync(samplePath)) {
    return samplePath; // Don't overwrite existing
  }

  const sample: CustomRulesConfig = {
    rules: [
      {
        id: 'CUSTOM-001',
        regex: 'console\\.warn\\(',
        severity: 'warning',
        message: 'console.warn not allowed in this repo',
        suggestion: 'Use the project logger instead',
        fileGlob: 'src/**',
        fileRoles: ['app'],
        enabled: true,
      },
      {
        id: 'CUSTOM-002',
        regex: 'TODO\\(',
        severity: 'info',
        message: 'TODO with assignee found — track in issue tracker',
        suggestion: 'Move to GitHub Issues or Jira',
        fileExtensions: ['.ts', '.js', '.py'],
        enabled: true,
      },
    ],
    severityOverrides: [
      {
        ruleType: 'console-log',
        severity: 'error',
        fileGlob: 'src/api/**',
        reason: 'API layer must not have console.log — use structured logger',
      },
    ],
    allowlist: [],
  };

  fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2) + '\n', 'utf8');
  return samplePath;
}
