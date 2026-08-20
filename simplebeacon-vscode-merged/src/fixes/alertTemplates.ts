/**
 * Alert template definitions for the VS Code extension sidebar.
 *
 * Provides severity-specific alert templates for security findings from
 * the workspace analyzer. Each template includes a title, summary, impact,
 * immediate action, remediation steps, prevention guidance, references,
 * rotation required flag, and CWE identifier.
 *
 * This is a focused subset matching the pattern IDs from PATTERN_REGISTRY
 * in workspaceAnalyzer.ts. The full template library lives in the CLI's
 * alert-templates.js module.
 */

export interface AlertTemplate {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  impact: string;
  immediateAction: string;
  remediationSteps: string[];
  preventionGuidance: string;
  references: string[];
  rotationRequired: boolean;
  cwe: string;
}

export interface EnrichedFinding {
  [key: string]: unknown;
  alertTemplate?: AlertTemplate;
}

const ALERT_TEMPLATES: Record<string, AlertTemplate> = {
  credentials: {
    title: 'Hardcoded Credential Detected',
    severity: 'medium',
    summary: 'A potential hardcoded secret (password, API key, or token) was found in source code',
    impact:
      'Hardcoded secrets in source code are visible to anyone with repository access. If the repo is public or leaked, attackers can use these credentials to access downstream services, databases, or cloud infrastructure.',
    immediateAction:
      'Identify the exposed credential. If it is a real secret (not a placeholder), rotate it immediately in the originating service. Remove the hardcoded value from source.',
    remediationSteps: [
      'Identify which service the credential belongs to (AWS, Stripe, database, etc.)',
      'Rotate the credential in the service dashboard or CLI',
      'Replace the hardcoded value with an environment variable reference (process.env.SECRET_NAME)',
      'Add the credential to your .env file (which should be gitignored)',
      'Scan git history for the credential using `git log -p | grep -i <pattern>` and purge if needed',
      'Add a pre-commit hook with gitleaks or simplebeacon to prevent future leaks',
    ],
    preventionGuidance:
      'Never hardcode secrets in source files. Use environment variables, a secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault), or a .env file that is gitignored. Use CI/CD secret stores for pipeline credentials.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
      'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    ],
    rotationRequired: true,
    cwe: 'CWE-798: Use of Hard-coded Credentials',
  },

  evalDanger: {
    title: 'Dangerous Dynamic Code Execution',
    severity: 'high',
    summary: 'eval(), new Function(), or string-based setTimeout/setInterval detected — code injection risk',
    impact:
      'Dynamic code execution allows arbitrary code injection if the input is attacker-controlled. This can lead to full server compromise, data exfiltration, privilege escalation, and persistent backdoors.',
    immediateAction:
      'Determine if the eval/Function call processes user input. If so, treat as a critical vulnerability and patch immediately. Replace with structured parsing (JSON.parse, RegExp, or a proper parser).',
    remediationSteps: [
      'Identify the data source feeding into eval() or new Function()',
      'Replace eval() with JSON.parse() for JSON data',
      'Replace new Function() with a proper callback or strategy pattern',
      'Replace string-based setTimeout/setInterval with function references',
      'If dynamic evaluation is truly necessary, use a sandboxed evaluator like vm2 or isolated-vm',
    ],
    preventionGuidance:
      "Never use eval() or new Function() with untrusted input. Use JSON.parse() for JSON, template literals for string construction, and proper parsers for DSLs. Enable CSP headers (script-src 'self') to mitigate XSS-to-eval chains.",
    references: [
      'https://owasp.org/www-community/vulnerabilities/Direct_Dynamic_Code_Evaluation',
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval',
    ],
    rotationRequired: false,
    cwe: 'CWE-94: Improper Control of Generation of Code (Code Injection)',
  },

  sensitiveData: {
    title: 'Sensitive Data Exposure in Source',
    severity: 'high',
    summary: 'PII (email, SSN, phone) or sensitive data found in console logs or localStorage',
    impact:
      'Exposing PII in logs or client-side storage violates GDPR, CCPA, and HIPAA. Logs are often aggregated to third-party services (Datadog, Splunk) where PII becomes searchable. localStorage is accessible via XSS.',
    immediateAction:
      'Identify what sensitive data is being logged or stored. Remove the logging statement. If PII has been logged to external services, coordinate with the data team to purge those log entries.',
    remediationSteps: [
      'Remove the console.log/localStorage.setItem call that exposes PII',
      'If logging is necessary, implement a PII redaction filter (mask emails, SSNs, phone numbers)',
      'Replace localStorage usage with HttpOnly cookies for session tokens',
      'Audit log aggregation services (Datadog, Splunk) for exposed PII',
      'Add automated tests that scan for PII patterns in log output',
      'Review GDPR/CCPA compliance with the legal team if PII was exposed',
    ],
    preventionGuidance:
      'Never log or store raw PII. Implement a redaction middleware that masks sensitive fields before logging. Use HttpOnly, Secure cookies for authentication tokens. Add automated PII scanning to CI/CD pipelines.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
      'https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html',
    ],
    rotationRequired: false,
    cwe: 'CWE-532: Insertion of Sensitive Information into Log File',
  },

  dbAntiPattern: {
    title: 'SQL Injection Risk — Raw Query Construction',
    severity: 'high',
    summary: 'SQL string concatenation or unbounded query detected — potential SQL injection',
    impact:
      'String-concatenated SQL queries allow attackers to inject arbitrary SQL, enabling data exfiltration, modification, deletion, or full database compromise. Unbounded queries can cause OOM crashes or denial of service.',
    immediateAction:
      'Determine if the concatenated SQL uses user input. If so, this is a critical vulnerability. Replace with parameterized queries immediately. Add a query timeout and LIMIT clause.',
    remediationSteps: [
      'Identify the data source for the concatenated query',
      'Replace string concatenation with parameterized queries (e.g., db.query("SELECT * FROM users WHERE id = $1", [userId]))',
      'Add a LIMIT clause to unbounded findAll queries',
      'Add query timeouts to prevent long-running queries',
      'Write integration tests that verify parameterized queries are used',
      'Enable SQL query logging in development to catch raw SQL during testing',
    ],
    preventionGuidance:
      'Always use parameterized queries or an ORM that parameterizes automatically. Never concatenate user input into SQL strings. Add query limits and timeouts. Use a query builder (Knex, Kysely) that enforces parameterization.',
    references: [
      'https://owasp.org/www-community/attacks/SQL_Injection',
      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
    ],
    rotationRequired: false,
    cwe: 'CWE-89: Improper Neutralization of Special Elements used in an SQL Command',
  },

  innerHtmlXss: {
    title: 'Cross-Site Scripting (XSS) via innerHTML',
    severity: 'medium',
    summary: 'Assignment to innerHTML without sanitization — potential XSS vector',
    impact:
      "If attacker-controlled data reaches innerHTML, malicious scripts can execute in the user's browser context, enabling session hijacking, credential theft, DOM manipulation, and worm propagation.",
    immediateAction:
      'Determine if the innerHTML assignment uses user-controlled data. If so, replace with textContent or sanitize with DOMPurify immediately.',
    remediationSteps: [
      'Identify the data source for the innerHTML assignment',
      'If the content is static or trusted, add a comment explaining why',
      'If the content is dynamic, replace .innerHTML with .textContent for plain text',
      'For HTML content, sanitize with DOMPurify: element.innerHTML = DOMPurify.sanitize(content)',
      "Add Content-Security-Policy headers (script-src 'self') as defense-in-depth",
      'Write tests that verify user input cannot reach innerHTML unsanitized',
    ],
    preventionGuidance:
      'Never assign user-controlled data to innerHTML. Use textContent for plain text. Use DOMPurify for HTML content. Enable CSP headers. Consider a framework (React, Vue) that auto-escapes by default.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Cross-site_Scripting_(XSS)',
      'https://github.com/cure53/DOMPurify',
    ],
    rotationRequired: false,
    cwe: 'CWE-79: Improper Neutralization of Input During Web Page Generation',
  },

  prototypePollution: {
    title: 'Prototype Pollution Vulnerability',
    severity: 'high',
    summary: 'Modification of Object.prototype or __proto__ — prototype pollution risk',
    impact:
      'Prototype pollution allows attackers to inject properties into all JavaScript objects, potentially bypassing authentication, escalating privileges, or causing denial of service. It is exploitable in Node.js and browser environments.',
    immediateAction:
      'Determine if the __proto__ or Object.prototype modification uses user-controlled data. If so, this is a critical vulnerability. Replace with Object.create(null) or Map immediately.',
    remediationSteps: [
      'Identify the data source for the prototype modification',
      'Replace __proto__ assignments with Object.create(null) for dictionary objects',
      'Use Map instead of plain objects for key-value storage of untrusted data',
      'Add input validation that rejects __proto__, constructor, and prototype keys',
      'Use Object.freeze(Object.prototype) in development to catch pollution early',
      'Audit dependencies for known prototype pollution CVEs (lodash <4.17.12, etc.)',
    ],
    preventionGuidance:
      'Never modify Object.prototype. Use Object.create(null) for hash maps. Use Map for untrusted key-value data. Validate input keys to reject __proto__ and constructor. Keep dependencies updated.',
    references: [
      'https://snyk.io/vuln/SNYK-JS-LODASH-450202',
      'https://github.com/HackTricks-wiki/hacktricks/blob/master/pentesting-web/prototype-pollution.md',
    ],
    rotationRequired: false,
    cwe: 'CWE-1321: Improperly Controlled Modification of Object Prototype Attributes',
  },

  configDrift: {
    title: 'Configuration Drift — Hardcoded URLs or Secrets',
    severity: 'medium',
    summary: 'Hardcoded localhost URLs, secrets, or API keys detected in source code',
    impact:
      'Hardcoded configuration values cause deployment failures across environments, expose development secrets in production builds, and make infrastructure changes brittle. Localhost references break in containerized environments.',
    immediateAction:
      'Identify the hardcoded value. If it is a secret, rotate it. Replace all hardcoded URLs and secrets with environment variables or configuration files.',
    remediationSteps: [
      'Replace hardcoded URLs with environment variables (process.env.API_URL)',
      'Replace hardcoded secrets with a secret manager or .env file',
      'Create a config module that loads from environment with sensible defaults',
      'Add a startup check that verifies required env vars are set',
      'Document required environment variables in a .env.example file',
      'Add a pre-commit hook that scans for localhost: and 127.0.0.1 patterns',
    ],
    preventionGuidance:
      'Use environment-based configuration for all URLs, ports, and secrets. Create a centralized config module. Use .env.example to document required variables. Never commit .env files. Use Docker compose or Kubernetes ConfigMaps for environment-specific config.',
    references: [
      'https://12factor.net/config',
      'https://owasp.org/www-community/vulnerabilities/Insertion_of_Sensitive_Information_into_a_Configuration_File',
    ],
    rotationRequired: false,
    cwe: 'CWE-489: Active Debug Code',
  },

  loggingSecrets: {
    title: 'Secrets Exposed in Log Output',
    severity: 'high',
    summary: 'Passwords, tokens, or API keys are being logged to console output',
    impact:
      'Logged secrets are captured by log aggregation services (Datadog, CloudWatch, Splunk) where they are searchable and persisted. In containerized environments, logs are often forwarded to shared storage, expanding the attack surface.',
    immediateAction:
      'Remove the logging statement that outputs the secret. Audit log aggregation services for the exposed secret. Rotate the secret if it has been logged to any external service.',
    remediationSteps: [
      'Remove or comment out the console.log that outputs the secret',
      'If logging is necessary, implement a redaction filter that masks secret values',
      'Audit log aggregation services (Datadog, CloudWatch) for the exposed secret',
      'Rotate the secret if it was logged to any external service',
      'Add a pre-commit hook that scans for console.log statements containing secret keywords',
      'Implement structured logging with a sanitizer that redacts known secret field names',
    ],
    preventionGuidance:
      'Never log secrets. Implement a structured logging library (Winston, Pino) with a redaction filter for sensitive fields. Use a centralized logging config that masks password, token, apiKey, secret, and credential fields. Add automated tests that verify secrets are not present in log output.',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
      'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
    ],
    rotationRequired: true,
    cwe: 'CWE-532: Insertion of Sensitive Information into Log File',
  },

  productionLeak: {
    title: 'Test or Mock Data Leaked into Production Code',
    severity: 'medium',
    summary: 'Mock data files, fixtures, or placeholder values detected in production source paths',
    impact:
      'Test data in production code can cause incorrect behavior, expose internal data structures, and create confusion for users. Placeholder values (your_api_key, change_me) indicate incomplete configuration that may fail silently in production.',
    immediateAction:
      'Identify the mock/fixture file or placeholder value. Remove it from production code paths. If it is a configuration placeholder, replace with a real value or environment variable reference.',
    remediationSteps: [
      'Move mock/fixture files to a tests/ or __tests__/ directory',
      'Replace placeholder values (your_, change_me, xxxx) with real configuration or env vars',
      'Add a build step that excludes test data files from production bundles',
      'Add a pre-commit hook that scans production source paths for mock/fixture patterns',
      'Review import statements to ensure test modules are not imported into production code',
      'Use tree-shaking or dead code elimination to remove test-only exports',
    ],
    preventionGuidance:
      'Keep test data in dedicated test directories. Never import test modules from production code. Use build-time exclusion (webpack, esbuild) to strip test files. Add a CI check that scans production build output for mock/fixture references.',
    references: [
      'https://docs.python.org/3/library/unittest.html#organizing-test-code',
      'https://jestjs.io/docs/configuration#testmatch-string-array',
    ],
    rotationRequired: false,
    cwe: 'CWE-489: Active Debug Code',
  },

  hallucinatedImport: {
    title: 'Hallucinated npm Package Import',
    severity: 'medium',
    summary: 'An import references an npm package not declared in package.json dependencies',
    impact:
      'Hallucinated imports (often from LLM-generated code) reference packages that either do not exist (supply chain risk if someone registers the name) or are not installed (runtime crash). This is a common AI code generation anti-pattern.',
    immediateAction:
      'Verify whether the imported package exists on npm. If it exists, add it to package.json dependencies. If it does not exist, replace the import with a real package or implement the functionality natively.',
    remediationSteps: [
      'Check if the imported package name exists on npm (npm view <package>)',
      'If it exists, add it to package.json: npm install <package>',
      'If it does not exist, identify what functionality was expected',
      'Find a real package that provides the same functionality',
      'Replace the hallucinated import with the correct package',
      'Run npm install and verify the application starts without errors',
      'Add a CI check that verifies all imports resolve to declared dependencies',
    ],
    preventionGuidance:
      'When using AI-generated code, always verify imports against package.json. Use TypeScript with strict module resolution to catch missing dependencies at compile time. Add a CI step that runs `npm ls` or dependency-check to verify all imports resolve.',
    references: [
      'https://research.nccgroup.com/2023/04/12/ai-generated-code-finding-hallucinated-package-names/',
      'https://docs.npmjs.com/cli/v9/commands/npm-ls',
    ],
    rotationRequired: false,
    cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component',
  },
};

/**
 * Get the alert template for a given rule/pattern ID.
 */
export function getAlertTemplate(ruleId: string): AlertTemplate | null {
  return ALERT_TEMPLATES[ruleId] || null;
}

/**
 * Enrich a finding with its alert template data.
 */
export function enrichFindingWithAlert<T extends Record<string, unknown>>(finding: T): T & EnrichedFinding {
  if (!finding || typeof finding !== 'object') return finding as T & EnrichedFinding;
  const ruleId =
    (finding.pattern as string) ||
    (finding.patternId as string) ||
    ((finding.id as string) ? String(finding.id).split('-').slice(0, 3).join('-') : null) ||
    null;
  const template = ruleId ? getAlertTemplate(ruleId) : null;

  if (!template) return finding as T & EnrichedFinding;

  return {
    ...finding,
    alertTemplate: {
      title: template.title,
      severity: template.severity,
      summary: template.summary,
      impact: template.impact,
      immediateAction: template.immediateAction,
      remediationSteps: template.remediationSteps,
      preventionGuidance: template.preventionGuidance,
      references: template.references,
      rotationRequired: template.rotationRequired,
      cwe: template.cwe,
    },
  };
}

/**
 * Enrich an array of findings with alert templates.
 */
export function enrichFindingsWithAlerts<T extends Record<string, unknown>>(findings: T[]): (T & EnrichedFinding)[] {
  if (!Array.isArray(findings)) return [];
  return findings.map(enrichFindingWithAlert);
}
