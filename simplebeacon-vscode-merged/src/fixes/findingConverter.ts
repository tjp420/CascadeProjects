// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
import { Finding } from '../analyzers/workspaceAnalyzer';
import { CodeIssue } from '../aiIntegration/aiCodeAnalyzer';
import { getFixForFinding } from './fixRegistry';

/**
 * Convert a workspace finding into a structured CodeIssue for AI remediation.
 * @param finding - Raw workspace finding.
 * @param fileContent - Full content of the file containing the finding.
 * @returns Structured code issue with remediation context.
 */
export function findingToCodeIssue(finding: Finding, fileContent: string): CodeIssue {
  const fix = getFixForFinding(finding);

  return {
    file: finding.file,
    line: finding.matches?.[0]?.line ?? 1,
    column: 1,
    severity: finding.severity === 'critical' ? 'error' : finding.severity === 'high' ? 'warning' : 'info',
    type: finding.type,
    message: finding.message || finding.type,
    suggestion: fix?.description || getSuggestion(finding.type),
    autoFixable: fix?.autoFixable ?? false,
    fixCode: fix?.replace || undefined,
    confidence: finding.confidence ?? 0.85,
    context: fileContent.split('\n')[Math.max(0, (finding.matches?.[0]?.line ?? 1) - 1)] || '',
  };
}

function getSuggestion(type: string): string {
  const suggestions: Record<string, string> = {
    'Credential Pattern': 'Move hardcoded secrets to environment variables or a secret manager.',
    'Debug Artifact': 'Remove console.log and debugger statements before production builds.',
    'Stub Implementation': 'Replace stub with actual implementation or add a proper TODO with owner.',
    'Error Swallowing': 'Add logging or error handling to empty catch blocks.',
    'Performance Anti-Pattern': 'Consider using Set lookups, Map, or reducing nested iterations.',
    'Type Safety Gap': 'Replace any with specific types or unknown. Remove @ts-ignore comments.',
    'Missing Test Coverage': 'Implement the skipped test or remove the empty test.',
    'Accessibility Gap': 'Add alt text to images, aria-label to inputs, or labels to buttons.',
    'Sensitive Data Exposure': 'Scrub PII from logs. Use a logging utility with automatic redaction.',
    'Configuration Drift': 'Move hardcoded URLs and secrets to .env or VS Code settings.',
    'Database Anti-Pattern': 'Use parameterized queries and add pagination to unbounded queries.',
    'Dangerous eval() Usage': 'Replace eval() with JSON.parse() or structured parsers.',
    'innerHTML XSS Risk': 'Use textContent for plain text or sanitize HTML with DOMPurify.',
    'Prototype Pollution Risk': 'Use Object.create(null) or Map for untrusted keys.',
    'Unhandled Promise': 'Add .catch() or try/catch with async/await for promise chains.',
    'Insecure Random for Security': 'Use crypto.randomBytes() or crypto.randomUUID() for security tokens.',
    'LLM Slop / Placeholder': 'Replace placeholder text with real data or remove the stub.',
  };
  return suggestions[type] || 'Review and address the finding.';
}
