/**
 * Custom rule engine — matches custom rules against file content and
 * applies severity overrides to built-in findings.
 *
 * Milestone 2: Repo-Specific Custom Rules
 */

import { CustomRule, SeverityOverride, CustomRulesConfig } from './customRuleLoader';
import { FileRole } from '../classifiers/fileRoleClassifier';
import { RealtimeIssue } from '../realtimeIssue';

// Minimal glob matcher — supports **, *, and ? patterns
// (We don't pull in a glob library to keep the extension lightweight)
function matchGlob(pattern: string, filePath: string): boolean {
  // Normalize paths to forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Convert glob to regex
  // ** → match anything (including /)
  // * → match anything except /
  // ? → match single char except /
  let regexStr = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{DOUBLESTAR}}/g, '.*');

  // Anchor the pattern
  if (!regexStr.startsWith('^')) regexStr = '^' + regexStr;
  if (!regexStr.endsWith('$')) regexStr = regexStr + '$';

  // Allow matching from any directory if pattern doesn't start with /
  if (!normalizedPattern.startsWith('/')) {
    regexStr = regexStr.replace(/^\^/, '^.*?');
  }

  try {
    return new RegExp(regexStr, 'i').test(normalizedPath);
  } catch {
    return false;
  }
}

/**
 * Check if a file path matches a rule's targeting criteria.
 */
function matchesRuleTargeting(rule: CustomRule, filePath: string, fileRole: FileRole, fileExtension: string): boolean {
  // Check fileGlob
  if (rule.fileGlob && !matchGlob(rule.fileGlob, filePath)) {
    return false;
  }

  // Check fileRoles
  if (rule.fileRoles && rule.fileRoles.length > 0) {
    if (!rule.fileRoles.includes(fileRole)) {
      return false;
    }
  }

  // Check fileExtensions
  if (rule.fileExtensions && rule.fileExtensions.length > 0) {
    const ext = fileExtension.startsWith('.') ? fileExtension : '.' + fileExtension;
    if (!rule.fileExtensions.includes(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * Run custom rules against file content.
 * Returns findings in the same format as built-in rules.
 */
export function runCustomRules(
  config: CustomRulesConfig,
  filePath: string,
  content: string,
  fileRole: FileRole,
  fileExtension: string
): RealtimeIssue[] {
  const issues: RealtimeIssue[] = [];
  const lines = content.split('\n');

  for (const rule of config.rules) {
    // Skip disabled rules
    if (rule.enabled === false) continue;

    // Check targeting
    if (!matchesRuleTargeting(rule, filePath, fileRole, fileExtension)) {
      continue;
    }

    // Compile regex
    let regex: RegExp;
    try {
      regex = new RegExp(rule.regex, rule.regexFlags || 'gi');
    } catch {
      // Invalid regex — skip this rule
      continue;
    }

    // Match line-by-line (most common case) or full content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      regex.lastIndex = 0; // Reset for global regex

      let match: RegExpExecArray | null;
      try {
        match = regex.exec(line);
      } catch {
        continue;
      }

      if (match) {
        const column = match.index + 1;
        issues.push({
          file: filePath,
          line: i + 1,
          column,
          severity: rule.severity,
          type: rule.id, // Use the custom rule ID as the type
          message: rule.message,
          suggestion: rule.suggestion,
          timestamp: new Date(),
          fileRole,
          calibrated: false,
        });
      }
    }
  }

  return issues;
}

/**
 * Apply severity overrides to built-in findings.
 * This runs AFTER detection but BEFORE display.
 */
export function applySeverityOverrides(
  overrides: SeverityOverride[],
  issues: RealtimeIssue[],
  filePath: string,
  fileRole: FileRole
): RealtimeIssue[] {
  if (overrides.length === 0) return issues;

  const result: RealtimeIssue[] = [];

  for (const issue of issues) {
    let overridden = false;

    for (const override of overrides) {
      // Check if this override applies to this rule type
      if (override.ruleType !== issue.type && override.ruleType !== '*') {
        continue;
      }

      // Check fileGlob targeting
      if (override.fileGlob && !matchGlob(override.fileGlob, filePath)) {
        continue;
      }

      // Check fileRoles targeting
      if (override.fileRoles && override.fileRoles.length > 0) {
        if (!override.fileRoles.includes(fileRole)) {
          continue;
        }
      }

      // Apply the override
      if (override.severity === 'suppressed') {
        overridden = true; // Drop the finding
      } else {
        // Replace severity
        result.push({
          ...issue,
          severity: override.severity,
          calibrated: true,
        });
        overridden = true;
      }
      break; // First matching override wins
    }

    if (!overridden) {
      result.push(issue);
    }
  }

  return result;
}

/**
 * Check if a file path is in the custom allowlist.
 */
export function isAllowlisted(allowlist: string[], filePath: string): boolean {
  if (!allowlist || allowlist.length === 0) return false;
  return allowlist.some((pattern) => matchGlob(pattern, filePath));
}

// ─── Singleton cache for custom rules config ───
let cachedConfig: CustomRulesConfig | null = null;
let cachedOverrides: SeverityOverride[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds — refresh frequently for dev iteration

/**
 * Get the custom rules config, with a short TTL cache.
 */
export function getCustomRulesConfig(workspaceRoot?: string): {
  config: CustomRulesConfig;
  overrides: SeverityOverride[];
} {
  const now = Date.now();
  if (cachedConfig && cachedOverrides && now - cacheTimestamp < CACHE_TTL) {
    return { config: cachedConfig, overrides: cachedOverrides };
  }

  // Lazy load to avoid circular dependency issues

  const loader: any = require('./customRuleLoader');
  cachedConfig = loader.loadCustomRules(workspaceRoot) as CustomRulesConfig;
  cachedOverrides = loader.loadSeverityOverridesFromConfig(workspaceRoot) as SeverityOverride[];
  cacheTimestamp = now;

  return { config: cachedConfig, overrides: cachedOverrides };
}

/**
 * Clear the cache (e.g. when the custom-rules.json file changes).
 */
export function clearCustomRulesCache(): void {
  cachedConfig = null;
  cachedOverrides = null;
  cacheTimestamp = 0;
}
