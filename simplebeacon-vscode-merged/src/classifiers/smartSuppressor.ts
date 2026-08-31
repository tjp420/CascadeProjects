// simplebeacon-ignore: Suppression classifier — references to credentials/eval are pattern matching logic, not real secrets
/**
 * Smart suppressor — hardened false-positive suppression for known
 * safe patterns that should never fire regardless of file role.
 *
 * This complements the severity calibrator by catching content-level
 * false positives that the file role classifier can't catch alone.
 *
 * Milestone 1: Trust and Noise Reduction
 */

import { FileRole } from './fileRoleClassifier';

export interface SuppressionResult {
  suppressed: boolean;
  reason: string;
  /** Which suppressor matched, for debugging/audit */
  suppressor: string;
}

// ─── Known safe credential values (example/placeholder/demo) ───
// These are values that look like secrets but are universally recognized as fakes.
const SAFE_CREDENTIAL_VALUES = [
  'changeme',
  'change-me',
  'change_me',
  'secret123',
  'password',
  'password123',
  'your-api-key-here',
  'your_api_key_here',
  'your-secret',
  'your_secret',
  'placeholder',
  'example',
  'dummy',
  'test',
  'fake',
  'sample',
  'mock',
  'insert_secret_here',
  'insert-api-key-here',
  'not-a-real',
  'not real',
  'test-secret',
  'fake-token',
  'sample-token',
  'xxx',
  'xxxx',
  'xxxxxxxx',
  'redacted',
  'redacted-secret',
  '<your-api-key>',
  '<your-secret>',
  'your-api-key',
  'your-api-secret',
  'your-token',
  'your-password',
  'your_api_key',
  'your_secret_key',
  'process.env',
  'env.var',
  'getenv',
  'os.environ',
  'config.get',
  'config(',
  'settings.',
  'app.config',
];

// ─── Known safe URLs / hosts ───
const SAFE_URLS = [
  'example.com',
  'example.org',
  'example.net',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'test.local',
  'dev.local',
  'your-domain.com',
  'your-domain.tld',
  'placeholder.com',
  'sample.com',
  'demo.com',
];

// ─── Public/contact emails that should not be flagged as PII ───
const PUBLIC_EMAILS = [
  'admin@simplebeacon.ai',
  'support@simplebeacon.ai',
  'contact@simplebeacon.ai',
  'hello@simplebeacon.ai',
  'info@simplebeacon.ai',
  'noreply@',
  'no-reply@',
  'donotreply@',
  'do-not-reply@',
  'admin@example.com',
  'support@example.com',
  'user@example.com',
  'test@example.com',
  'demo@example.com',
];

// ─── Scanner self-reference markers ───
// Files that define detection rules should not be flagged by the patterns they detect.
const SCANNER_SELF_REFERENCE_MARKERS = [
  'simplebeacon-ignore',
  'slop-cop-disable',
  'rule definition',
  'scanner definition',
  'pattern definition',
  'this file defines',
  'detects.*pattern',
  'matches.*regex',
];

// ─── Demo / sample path indicators in the file path itself ───
const DEMO_PATH_INDICATORS = [
  /\/fixtures?\//i,
  /\/examples?\//i,
  /\/demo\//i,
  /\/samples?\//i,
  /\/mock\//i,
  /\/test-fixtures\//i,
  /\.example\./i,
  /\.demo\./i,
  /\.sample\./i,
];

/**
 * Check if a credential finding is a known safe/placeholder value.
 */
function isSafeCredentialValue(matchText: string): boolean {
  const lower = matchText.toLowerCase();
  // Extract the value from patterns like: password = "value" or apiKey: "value"
  const valueMatch = lower.match(/["']([^"']+)["']/);
  const value = valueMatch ? valueMatch[1] : lower;

  return SAFE_CREDENTIAL_VALUES.some((safe) => value.includes(safe));
}

/**
 * Check if a URL finding is a known safe/example URL.
 */
function isSafeUrl(matchText: string): boolean {
  const lower = matchText.toLowerCase();
  return SAFE_URLS.some((url) => lower.includes(url));
}

/**
 * Check if an email finding is a public/contact email.
 */
function isPublicEmail(matchText: string): boolean {
  const lower = matchText.toLowerCase();
  return PUBLIC_EMAILS.some((email) => lower.includes(email));
}

/**
 * Check if the file path indicates a demo/sample/fixtures location.
 */
function isDemoPath(filePath: string): boolean {
  return DEMO_PATH_INDICATORS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if the file content contains scanner self-reference markers
 * (i.e. this file defines the rules, so it mentions the patterns).
 */
function isScannerSelfReference(lineText: string, fileContent?: string): boolean {
  const lowerLine = lineText.toLowerCase();
  if (SCANNER_SELF_REFERENCE_MARKERS.some((marker) => lowerLine.includes(marker))) {
    return true;
  }
  // Check file header for scanner definition markers
  if (fileContent) {
    const header = fileContent.slice(0, 200).toLowerCase();
    if (header.includes('simplebeacon-ignore') || header.includes('scanner definitions')) {
      return true;
    }
  }
  return false;
}

/**
 * Determine whether a finding should be suppressed as a false positive.
 *
 * This runs AFTER the severity calibrator. If the calibrator already suppressed
 * the finding, this doesn't need to run. This catches content-level false positives
 * that the file role classifier can't catch.
 *
 * @param issueType The rule type
 * @param matchText The text that matched the rule
 * @param filePath The file path
 * @param lineText The line of code where the match occurred
 * @param fileRole The classified file role
 * @param fileContent Optional file content for header checks
 * @returns SuppressionResult
 */
export function shouldSuppress(
  issueType: string,
  matchText: string,
  filePath: string,
  lineText: string,
  fileRole: FileRole,
  fileContent?: string
): SuppressionResult {
  // ─── Credential findings: check for safe/placeholder values ───
  if (
    issueType.startsWith('hardcoded-') ||
    issueType.startsWith('secret-') ||
    issueType.includes('credential') ||
    issueType.includes('password') ||
    issueType.includes('api-key') ||
    issueType.includes('token')
  ) {
    if (isSafeCredentialValue(matchText)) {
      return {
        suppressed: true,
        reason: 'credential value is a known placeholder/example (changeme, test-secret, etc.)',
        suppressor: 'safe-credential-value',
      };
    }
  }

  // ─── URL findings: check for safe/example URLs ───
  if (issueType.includes('url') || issueType.includes('localhost') || issueType.includes('staging')) {
    if (isSafeUrl(matchText)) {
      return {
        suppressed: true,
        reason: 'URL is a known safe/example host (example.com, localhost, etc.)',
        suppressor: 'safe-url',
      };
    }
  }

  // ─── PII logging: check for public emails ───
  if (issueType.includes('pii') || issueType.includes('email') || issueType.includes('logging')) {
    if (isPublicEmail(matchText)) {
      return {
        suppressed: true,
        reason: 'email is a public/contact address (admin@, noreply@, etc.)',
        suppressor: 'public-email',
      };
    }
  }

  // ─── Demo path suppression: if the file is in a fixtures/examples/demo path ───
  // and the finding is a credential or AI slop pattern, suppress it
  if (isDemoPath(filePath)) {
    if (
      issueType.startsWith('hardcoded-') ||
      issueType.startsWith('secret-') ||
      issueType.includes('credential') ||
      issueType.startsWith('ai-') ||
      issueType.startsWith('llm-') ||
      issueType.includes('boilerplate') ||
      issueType.includes('placeholder')
    ) {
      return {
        suppressed: true,
        reason: 'file is in a fixtures/examples/demo/mock path',
        suppressor: 'demo-path',
      };
    }
  }

  // ─── Scanner self-reference: if the line or file header marks it as a rule definition ───
  if (isScannerSelfReference(lineText, fileContent)) {
    if (
      issueType.startsWith('ai-') ||
      issueType.startsWith('llm-') ||
      issueType.includes('boilerplate') ||
      issueType.includes('placeholder') ||
      issueType.includes('fiction')
    ) {
      return {
        suppressed: true,
        reason: 'file/line is a scanner rule definition (self-reference)',
        suppressor: 'scanner-self-reference',
      };
    }
  }

  // ─── Test file credential suppression: if the file role is test/sample
  // and the credential value is a known placeholder, suppress entirely ───
  if ((fileRole === 'test' || fileRole === 'sample') && isSafeCredentialValue(matchText)) {
    return {
      suppressed: true,
      reason: `credential in ${fileRole} file is a known placeholder value`,
      suppressor: 'test-sample-placeholder',
    };
  }

  // No suppression matched
  return {
    suppressed: false,
    reason: 'no suppression matched',
    suppressor: 'none',
  };
}
