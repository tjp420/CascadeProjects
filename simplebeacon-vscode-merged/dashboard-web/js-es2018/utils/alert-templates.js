// simplebeacon-ignore: Alert template definitions — all findings are false positives in scanner definitions
/**
 * Browser-compatible High-Risk Finding Alert Templates
 *
 * ESM version of the CLI alert-templates.js module. Provides the same
 * alert templates for the dashboard to render severity-specific alert
 * cards with remediation guidance.
 *
 * Used by:
 * - CliMetricsWidget: Renders alert cards for high-risk findings
 * - DashboardView: Enriches findings with alert template data
 * - Compliance Report PDF: Includes alert details in the PDF
 */

// Re-export the template data and functions from the shared CJS module
// This works because Vite/esbuild can import CJS modules from ESM

const ALERT_TEMPLATES = {
  "SB-SEC-014": {
    title: "GCP Service Account Key Exposed",
    severity: "critical",
    summary: "A GCP service account key was detected in source code",
    impact:
      "Service account keys grant access to GCP resources. An exposed key allows attackers to impersonate the service account, exfiltrate data, or spin up compute resources for cryptomining.",
    immediateAction:
      "Rotate the exposed key immediately in the GCP Console. Revoke the compromised key after creating a replacement. Audit GCP audit logs for unauthorized API calls.",
    remediationSteps: [
      "Go to GCP Console > IAM & Admin > Service Accounts",
      "Select the affected service account and create a new key",
      "Update your application to use the new key via environment variable or Secret Manager",
      "Revoke and delete the exposed key",
      "Review Cloud Audit Logs for unauthorized API calls",
      "Add the key file pattern to .gitignore and pre-commit hooks",
    ],
    preventionGuidance:
      "Never commit service account JSON keys to version control. Use GCP Secret Manager, Workload Identity, or environment variables.",
    references: [
      "https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys",
    ],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },
  "SB-SEC-015": {
    title: "Azure Storage Key Exposed",
    severity: "critical",
    summary:
      "An Azure storage account key or client secret was detected in source code",
    impact:
      "Azure storage keys grant full access to blob, table, queue, and file services. An exposed key allows attackers to read, modify, or delete stored data.",
    immediateAction:
      "Rotate the storage key in the Azure Portal. Rotate the client secret in Azure AD. Audit Azure Activity Logs for unauthorized access.",
    remediationSteps: [
      "Open Azure Portal > Storage Account > Access keys > Rotate keys",
      "If AZURE_CLIENT_SECRET was exposed, rotate in AAD > App Registrations",
      "Update application configuration with the new key/secret via Azure Key Vault",
      "Review Azure Activity Logs for unauthorized storage operations",
      "Remove the hardcoded key from source and git history",
      "Add file patterns to .gitignore and pre-commit secret scanning",
    ],
    preventionGuidance:
      "Use Azure Key Vault for all secrets. Use Managed Identities where possible to eliminate the need for secrets entirely.",
    references: [
      "https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices",
    ],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },
  "SB-SEC-016": {
    title: "OAuth Token Hardcoded in Source",
    severity: "high",
    summary:
      "An OAuth access or refresh token from Google, GitHub, Slack, or Stripe was detected in source code",
    impact:
      "OAuth tokens grant authenticated access to the issuing platform. A Google token can access Gmail and Drive. A GitHub token can modify repositories. A Slack token can read messages.",
    immediateAction:
      "Revoke the exposed token immediately on the issuing platform.",
    remediationSteps: [
      "Revoke the token on the issuing platform",
      "Generate a new token and store it in a secret manager",
      "Update application code to load the token from environment or secret manager",
      "Remove the hardcoded token from source and git history",
      "Audit the platform for unauthorized actions taken with the token",
    ],
    preventionGuidance:
      "Store OAuth tokens in environment variables or secret managers. Use OAuth flows that exchange authorization codes for tokens at runtime.",
    references: ["https://oauth.net/2/best-practices/"],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },
  "SB-SEC-017": {
    title: "Docker Container Running in Privileged Mode",
    severity: "high",
    summary: "A Docker container is configured to run in privileged mode",
    impact:
      "Privileged mode grants the container full access to host devices, kernel capabilities, and the host filesystem. An attacker who compromises the container can escape to the host.",
    immediateAction:
      "Remove the privileged flag. Identify the specific capability needed and grant only that capability.",
    remediationSteps: [
      "Remove `privileged: true` from docker-compose.yml or `--privileged` from docker run",
      "Identify the specific kernel capability the container needs",
      "Grant only the required capability: `--cap-add=NET_ADMIN`",
      "If the container needs device access, use `--device` instead of privileged",
      "Test the container functionality after removing privileged mode",
    ],
    preventionGuidance:
      "Never use privileged mode in production. Use the principle of least capability.",
    references: [
      "https://docs.docker.com/engine/reference/run/#security-configuration",
      "https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html",
    ],
    rotationRequired: false,
    cwe: "CWE-250: Execution with Unnecessary Privileges",
  },
  "SB-SEC-018": {
    title: "Docker Container Running as Root User",
    severity: "medium",
    summary:
      "A Dockerfile specifies USER root, running the container as the root user",
    impact:
      "Running as root inside a container increases the blast radius of container escape vulnerabilities.",
    immediateAction: "Change the USER directive to a non-root user.",
    remediationSteps: [
      "Add a non-root user in the Dockerfile: `RUN useradd -m appuser`",
      "Switch to the user: `USER appuser`",
      "Ensure file permissions allow the non-root user to read/write required paths",
      "Test the container to verify it works correctly as non-root",
    ],
    preventionGuidance:
      "Always create a dedicated non-root user in Dockerfiles. Use multi-stage builds to minimize the final image.",
    references: [
      "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user",
    ],
    rotationRequired: false,
    cwe: "CWE-250: Execution with Unnecessary Privileges",
  },
  "SB-SEC-019": {
    title: "Hardcoded Secret in Docker ENV Directive",
    severity: "critical",
    summary: "A secret is hardcoded in a Docker ENV directive",
    impact:
      "Docker ENV values are baked into the image layers and are visible to anyone who can pull the image. Secrets in ENV directives cannot be rotated without rebuilding the image.",
    immediateAction:
      "Rotate the exposed secret. Remove it from the Dockerfile immediately.",
    remediationSteps: [
      "Rotate the exposed secret at the provider",
      "Remove the ENV directive containing the secret from the Dockerfile",
      "Use Docker secrets or mount a .env file at runtime",
      "Rebuild and redeploy the image",
      "Audit Docker registries for old images containing the secret",
    ],
    preventionGuidance:
      "Never put secrets in ENV directives. Use Docker secrets, Kubernetes secrets, or external secret managers.",
    references: ["https://docs.docker.com/engine/swarm/secrets/"],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },
  "SB-SEC-020": {
    title: "Docker Image Missing Health Check",
    severity: "low",
    summary: "A Dockerfile does not include a HEALTHCHECK instruction",
    impact:
      "Without a health check, the orchestrator cannot detect when the application inside the container is unhealthy.",
    immediateAction: "Add a HEALTHCHECK instruction to the Dockerfile.",
    remediationSteps: [
      "Add a HEALTHCHECK instruction to the Dockerfile",
      "Use an endpoint that verifies the application is responsive",
      "Example: `HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health`",
      "Configure the orchestrator to use the health check for automatic restarts",
    ],
    preventionGuidance:
      "Always include a HEALTHCHECK in production Dockerfiles.",
    references: [
      "https://docs.docker.com/engine/reference/builder/#healthcheck",
    ],
    rotationRequired: false,
    cwe: null,
  },
  "SB-SEC-021": {
    title: "Suspicious Package Installation Detected",
    severity: "high",
    summary:
      "A package install command references a suspicious package name that may be a typosquat",
    impact:
      "Typosquat packages are malicious packages with names similar to popular packages. They often contain malware that steals credentials or installs backdoors.",
    immediateAction:
      "Do not install the flagged package. Verify the package name against the official npm registry.",
    remediationSteps: [
      "Verify the package name against the official npm registry",
      "If the package is a typosquat, remove it: `npm uninstall <package>`",
      "Clear npm cache: `npm cache clean --force`",
      "Audit the system for signs of compromise",
      "Install the correct package with the verified name",
    ],
    preventionGuidance:
      "Always verify package names against the official registry. Use npm audit and Snyk to scan for known malicious packages.",
    references: ["https://docs.npmjs.com/about-registry"],
    rotationRequired: false,
    cwe: "CWE-1357: Reliance on Insufficiently Trustworthy Component",
  },
  "SB-SEC-022": {
    title: "Malicious postinstall Script Detected",
    severity: "high",
    summary:
      "A package.json postinstall script executes network calls or dynamic code execution",
    impact:
      "postinstall scripts run automatically when a package is installed. Malicious scripts can download and execute arbitrary code, steal environment variables and secrets.",
    immediateAction:
      "Review the postinstall script. If it makes network calls or executes dynamic code, remove it.",
    remediationSteps: [
      "Review the postinstall script in package.json",
      "If it uses curl, wget, node -e, python -c, bash -c, or powershell, remove it",
      "Replace with a legitimate build tool (tsc, webpack, babel, eslint, prettier)",
      "If the script was already executed, audit for compromise",
      "Consider using `npm install --ignore-scripts` in CI",
    ],
    preventionGuidance:
      "Avoid postinstall scripts that make network calls. Use `npm install --ignore-scripts` in CI/CD.",
    references: ["https://docs.npmjs.com/cli/v8/using-npm/scripts"],
    rotationRequired: false,
    cwe: "CWE-506: Embedded Malicious Code",
  },
  "SB-SEC-023": {
    title: "Unpinned Dependency Version",
    severity: "medium",
    summary:
      "A dependency uses an unpinned version specifier (^, ~, latest, *, >=)",
    impact:
      "Unpinned dependencies can resolve to different versions across installs, leading to non-reproducible builds. Supply chain attacks often target floating version specifiers.",
    immediateAction: "Pin the dependency to an exact version.",
    remediationSteps: [
      "Identify the unpinned dependency in package.json",
      "Replace ^, ~, latest, *, or >= with an exact version",
      "Run `npm install` to update the lockfile",
      "Run the full test suite to verify compatibility",
      "Consider using `npm ci` in CI/CD for reproducible installs",
    ],
    preventionGuidance:
      "Pin all dependencies to exact versions. Use `npm ci` instead of `npm install` in CI.",
    references: ["https://docs.npmjs.com/cli/v8/commands/npm-ci"],
    rotationRequired: false,
    cwe: "CWE-1357: Reliance on Insufficiently Trustworthy Component",
  },
  "SB-SEC-009": {
    title: ".env File Committed to Repository",
    severity: "critical",
    summary:
      "A .env file with environment secrets has been committed to version control",
    impact:
      "Environment files typically contain database credentials, API keys, and other secrets. Once committed, these secrets are in git history permanently.",
    immediateAction:
      "Rotate ALL secrets that were in the .env file. Remove the file from git tracking.",
    remediationSteps: [
      "Rotate every secret that was in the .env file",
      "Remove the file from git: `git rm --cached .env`",
      "Add `.env` to .gitignore",
      "Purge the file from git history using BFG Repo-Cleaner",
      "Provide .env.example with placeholder values",
    ],
    preventionGuidance:
      "Never commit .env files. Add .env to .gitignore on day one. Use .env.example with placeholder values.",
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    ],
    rotationRequired: true,
    cwe: "CWE-312: Cleartext Storage of Sensitive Information",
  },
  "SB-SEC-013": {
    title: "CI/CD Secret Hardcoded in Workflow Config",
    severity: "critical",
    summary: "A CI/CD secret is hardcoded in a workflow or config file",
    impact:
      "CI/CD secrets in workflow files are visible to anyone with read access to the repository. Attackers can use these secrets to publish packages or access production.",
    immediateAction:
      "Rotate the exposed secret. Move it to the CI/CD platform secret store.",
    remediationSteps: [
      "Rotate the exposed secret at the provider",
      "Move the secret to the CI/CD platform secret store",
      "Reference the secret via environment variable",
      "Remove the hardcoded value from the workflow file",
      "Audit CI/CD logs for unauthorized usage",
    ],
    preventionGuidance:
      "Never hardcode secrets in workflow files. Use the CI/CD platform secret store. Use OIDC federation where possible.",
    references: [
      "https://docs.github.com/en/actions/security-guides/encrypted-secrets",
    ],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },

  // ═══════════════════════════════════════════════
  // Advanced Security Metrics (from PATTERN_REGISTRY)
  // ═══════════════════════════════════════════════
  credentials: {
    title: "Hardcoded Credential Detected",
    severity: "medium",
    summary:
      "A potential hardcoded secret (password, API key, or token) was found in source code",
    impact:
      "Hardcoded secrets in source code are visible to anyone with repository access. If the repo is public or leaked, attackers can use these credentials to access downstream services, databases, or cloud infrastructure.",
    immediateAction:
      "Identify the exposed credential. If it is a real secret (not a placeholder), rotate it immediately in the originating service. Remove the hardcoded value from source.",
    remediationSteps: [
      "Identify which service the credential belongs to (AWS, Stripe, database, etc.)",
      "Rotate the credential in the service dashboard or CLI",
      "Replace the hardcoded value with an environment variable reference (process.env.SECRET_NAME)",
      "Add the credential to your .env file (which should be gitignored)",
      "Scan git history for the credential using `git log -p | grep -i <pattern>` and purge if needed",
      "Add a pre-commit hook with gitleaks or simplebeacon to prevent future leaks",
    ],
    preventionGuidance:
      "Never hardcode secrets in source files. Use environment variables, a secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault), or a .env file that is gitignored. Use CI/CD secret stores for pipeline credentials.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password",
      "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html",
    ],
    rotationRequired: true,
    cwe: "CWE-798: Use of Hard-coded Credentials",
  },

  evalDanger: {
    title: "Dangerous Dynamic Code Execution",
    severity: "high",
    summary:
      "eval(), new Function(), or string-based setTimeout/setInterval detected — code injection risk",
    impact:
      "Dynamic code execution allows arbitrary code injection if the input is attacker-controlled. This can lead to full server compromise, data exfiltration, privilege escalation, and persistent backdoors.",
    immediateAction:
      "Determine if the eval/Function call processes user input. If so, treat as a critical vulnerability and patch immediately. Replace with structured parsing (JSON.parse, RegExp, or a proper parser).",
    remediationSteps: [
      "Identify the data source feeding into eval() or new Function()",
      "Replace eval() with JSON.parse() for JSON data",
      "Replace new Function() with a proper callback or strategy pattern",
      "Replace string-based setTimeout/setInterval with function references",
      "If dynamic evaluation is truly necessary, use a sandboxed evaluator like vm2 or isolated-vm",
    ],
    preventionGuidance:
      "Never use eval() or new Function() with untrusted input. Use JSON.parse() for JSON, template literals for string construction, and proper parsers for DSLs. Enable CSP headers (script-src 'self') to mitigate XSS-to-eval chains.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Direct_Dynamic_Code_Evaluation",
      "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval",
    ],
    rotationRequired: false,
    cwe: "CWE-94: Improper Control of Generation of Code (Code Injection)",
  },

  sensitiveData: {
    title: "Sensitive Data Exposure in Source",
    severity: "high",
    summary:
      "PII (email, SSN, phone) or sensitive data found in console logs or localStorage",
    impact:
      "Exposing PII in logs or client-side storage violates GDPR, CCPA, and HIPAA. Logs are often aggregated to third-party services (Datadog, Splunk) where PII becomes searchable. localStorage is accessible via XSS.",
    immediateAction:
      "Identify what sensitive data is being logged or stored. Remove the logging statement. If PII has been logged to external services, coordinate with the data team to purge those log entries.",
    remediationSteps: [
      "Remove the console.log/localStorage.setItem call that exposes PII",
      "If logging is necessary, implement a PII redaction filter (mask emails, SSNs, phone numbers)",
      "Replace localStorage usage with HttpOnly cookies for session tokens",
      "Audit log aggregation services (Datadog, Splunk) for exposed PII",
      "Add automated tests that scan for PII patterns in log output",
      "Review GDPR/CCPA compliance with the legal team if PII was exposed",
    ],
    preventionGuidance:
      "Never log or store raw PII. Implement a redaction middleware that masks sensitive fields before logging. Use HttpOnly, Secure cookies for authentication tokens. Add automated PII scanning to CI/CD pipelines.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure",
      "https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html",
    ],
    rotationRequired: false,
    cwe: "CWE-532: Insertion of Sensitive Information into Log File",
  },

  dbAntiPattern: {
    title: "SQL Injection Risk — Raw Query Construction",
    severity: "high",
    summary:
      "SQL string concatenation or unbounded query detected — potential SQL injection",
    impact:
      "String-concatenated SQL queries allow attackers to inject arbitrary SQL, enabling data exfiltration, modification, deletion, or full database compromise. Unbounded queries can cause OOM crashes or denial of service.",
    immediateAction:
      "Determine if the concatenated SQL uses user input. If so, this is a critical vulnerability. Replace with parameterized queries immediately. Add a query timeout and LIMIT clause.",
    remediationSteps: [
      "Identify the data source for the concatenated query",
      'Replace string concatenation with parameterized queries (e.g., db.query("SELECT * FROM users WHERE id = $1", [userId]))',
      "Add a LIMIT clause to unbounded findAll queries",
      "Add query timeouts to prevent long-running queries",
      "Write integration tests that verify parameterized queries are used",
      "Enable SQL query logging in development to catch raw SQL during testing",
    ],
    preventionGuidance:
      "Always use parameterized queries or an ORM that parameterizes automatically. Never concatenate user input into SQL strings. Add query limits and timeouts. Use a query builder (Knex, Kysely) that enforces parameterization.",
    references: [
      "https://owasp.org/www-community/attacks/SQL_Injection",
      "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html",
    ],
    rotationRequired: false,
    cwe: "CWE-89: Improper Neutralization of Special Elements used in an SQL Command",
  },

  innerHtmlXss: {
    title: "Cross-Site Scripting (XSS) via innerHTML",
    severity: "medium",
    summary:
      "Assignment to innerHTML without sanitization — potential XSS vector",
    impact:
      "If attacker-controlled data reaches innerHTML, malicious scripts can execute in the user's browser context, enabling session hijacking, credential theft, DOM manipulation, and worm propagation.",
    immediateAction:
      "Determine if the innerHTML assignment uses user-controlled data. If so, replace with textContent or sanitize with DOMPurify immediately.",
    remediationSteps: [
      "Identify the data source for the innerHTML assignment",
      "If the content is static or trusted, add a comment explaining why",
      "If the content is dynamic, replace .innerHTML with .textContent for plain text",
      "For HTML content, sanitize with DOMPurify: element.innerHTML = DOMPurify.sanitize(content)",
      "Add Content-Security-Policy headers (script-src 'self') as defense-in-depth",
      "Write tests that verify user input cannot reach innerHTML unsanitized",
    ],
    preventionGuidance:
      "Never assign user-controlled data to innerHTML. Use textContent for plain text. Use DOMPurify for HTML content. Enable CSP headers. Consider a framework (React, Vue) that auto-escapes by default.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Cross-site_Scripting_(XSS)",
      "https://github.com/cure53/DOMPurify",
    ],
    rotationRequired: false,
    cwe: "CWE-79: Improper Neutralization of Input During Web Page Generation",
  },

  prototypePollution: {
    title: "Prototype Pollution Vulnerability",
    severity: "high",
    summary:
      "Modification of Object.prototype or __proto__ — prototype pollution risk",
    impact:
      "Prototype pollution allows attackers to inject properties into all JavaScript objects, potentially bypassing authentication, escalating privileges, or causing denial of service. It is exploitable in Node.js and browser environments.",
    immediateAction:
      "Determine if the __proto__ or Object.prototype modification uses user-controlled data. If so, this is a critical vulnerability. Replace with Object.create(null) or Map immediately.",
    remediationSteps: [
      "Identify the data source for the prototype modification",
      "Replace __proto__ assignments with Object.create(null) for dictionary objects",
      "Use Map instead of plain objects for key-value storage of untrusted data",
      "Add input validation that rejects __proto__, constructor, and prototype keys",
      "Use Object.freeze(Object.prototype) in development to catch pollution early",
      "Audit dependencies for known prototype pollution CVEs (lodash <4.17.12, etc.)",
    ],
    preventionGuidance:
      "Never modify Object.prototype. Use Object.create(null) for hash maps. Use Map for untrusted key-value data. Validate input keys to reject __proto__ and constructor. Keep dependencies updated.",
    references: [
      "https://snyk.io/vuln/SNYK-JS-LODASH-450202",
      "https://github.com/HackTricks-wiki/hacktricks/blob/master/pentesting-web/prototype-pollution.md",
    ],
    rotationRequired: false,
    cwe: "CWE-1321: Improperly Controlled Modification of Object Prototype Attributes",
  },

  configDrift: {
    title: "Configuration Drift — Hardcoded URLs or Secrets",
    severity: "medium",
    summary:
      "Hardcoded localhost URLs, secrets, or API keys detected in source code",
    impact:
      "Hardcoded configuration values cause deployment failures across environments, expose development secrets in production builds, and make infrastructure changes brittle. Localhost references break in containerized environments.",
    immediateAction:
      "Identify the hardcoded value. If it is a secret, rotate it. Replace all hardcoded URLs and secrets with environment variables or configuration files.",
    remediationSteps: [
      "Replace hardcoded URLs with environment variables (process.env.API_URL)",
      "Replace hardcoded secrets with a secret manager or .env file",
      "Create a config module that loads from environment with sensible defaults",
      "Add a startup check that verifies required env vars are set",
      "Document required environment variables in a .env.example file",
      "Add a pre-commit hook that scans for localhost: and 127.0.0.1 patterns",
    ],
    preventionGuidance:
      "Use environment-based configuration for all URLs, ports, and secrets. Create a centralized config module. Use .env.example to document required variables. Never commit .env files. Use Docker compose or Kubernetes ConfigMaps for environment-specific config.",
    references: [
      "https://12factor.net/config",
      "https://owasp.org/www-community/vulnerabilities/Insertion_of_Sensitive_Information_into_a_Configuration_File",
    ],
    rotationRequired: false,
    cwe: "CWE-489: Active Debug Code",
  },

  loggingSecrets: {
    title: "Secrets Exposed in Log Output",
    severity: "high",
    summary:
      "Passwords, tokens, or API keys are being logged to console output",
    impact:
      "Logged secrets are captured by log aggregation services (Datadog, CloudWatch, Splunk) where they are searchable and persisted. In containerized environments, logs are often forwarded to shared storage, expanding the attack surface.",
    immediateAction:
      "Remove the logging statement that outputs the secret. Audit log aggregation services for the exposed secret. Rotate the secret if it has been logged to any external service.",
    remediationSteps: [
      "Remove or comment out the console.log that outputs the secret",
      "If logging is necessary, implement a redaction filter that masks secret values",
      "Audit log aggregation services (Datadog, CloudWatch) for the exposed secret",
      "Rotate the secret if it was logged to any external service",
      "Add a pre-commit hook that scans for console.log statements containing secret keywords",
      "Implement structured logging with a sanitizer that redacts known secret field names",
    ],
    preventionGuidance:
      "Never log secrets. Implement a structured logging library (Winston, Pino) with a redaction filter for sensitive fields. Use a centralized logging config that masks password, token, apiKey, secret, and credential fields. Add automated tests that verify secrets are not present in log output.",
    references: [
      "https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure",
      "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
    ],
    rotationRequired: true,
    cwe: "CWE-532: Insertion of Sensitive Information into Log File",
  },

  productionLeak: {
    title: "Test or Mock Data Leaked into Production Code",
    severity: "medium",
    summary:
      "Mock data files, fixtures, or placeholder values detected in production source paths",
    impact:
      "Test data in production code can cause incorrect behavior, expose internal data structures, and create confusion for users. Placeholder values (your_api_key, change_me) indicate incomplete configuration that may fail silently in production.",
    immediateAction:
      "Identify the mock/fixture file or placeholder value. Remove it from production code paths. If it is a configuration placeholder, replace with a real value or environment variable reference.",
    remediationSteps: [
      "Move mock/fixture files to a tests/ or __tests__/ directory",
      "Replace placeholder values (your_, change_me, xxxx) with real configuration or env vars",
      "Add a build step that excludes test data files from production bundles",
      "Add a pre-commit hook that scans production source paths for mock/fixture patterns",
      "Review import statements to ensure test modules are not imported into production code",
      "Use tree-shaking or dead code elimination to remove test-only exports",
    ],
    preventionGuidance:
      "Keep test data in dedicated test directories. Never import test modules from production code. Use build-time exclusion (webpack, esbuild) to strip test files. Add a CI check that scans production build output for mock/fixture references.",
    references: [
      "https://docs.python.org/3/library/unittest.html#organizing-test-code",
      "https://jestjs.io/docs/configuration#testmatch-string-array",
    ],
    rotationRequired: false,
    cwe: "CWE-489: Active Debug Code",
  },

  hallucinatedImport: {
    title: "Hallucinated npm Package Import",
    severity: "medium",
    summary:
      "An import references an npm package not declared in package.json dependencies",
    impact:
      "Hallucinated imports (often from LLM-generated code) reference packages that either do not exist (supply chain risk if someone registers the name) or are not installed (runtime crash). This is a common AI code generation anti-pattern.",
    immediateAction:
      "Verify whether the imported package exists on npm. If it exists, add it to package.json dependencies. If it does not exist, replace the import with a real package or implement the functionality natively.",
    remediationSteps: [
      "Check if the imported package name exists on npm (npm view <package>)",
      "If it exists, add it to package.json: npm install <package>",
      "If it does not exist, identify what functionality was expected",
      "Find a real package that provides the same functionality",
      "Replace the hallucinated import with the correct package",
      "Run npm install and verify the application starts without errors",
      "Add a CI check that verifies all imports resolve to declared dependencies",
    ],
    preventionGuidance:
      "When using AI-generated code, always verify imports against package.json. Use TypeScript with strict module resolution to catch missing dependencies at compile time. Add a CI step that runs `npm ls` or dependency-check to verify all imports resolve.",
    references: [
      "https://research.nccgroup.com/2023/04/12/ai-generated-code-finding-hallucinated-package-names/",
      "https://docs.npmjs.com/cli/v9/commands/npm-ls",
    ],
    rotationRequired: false,
    cwe: "CWE-1357: Reliance on Insufficiently Trustworthy Component",
  },
};

const SEVERITY_COLORS = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#6B7280",
};

const SEVERITY_ICONS = {
  critical: "🔴",
  high: "🟠",
  medium: "🔵",
  low: "⚪",
};

export function getAlertTemplate(ruleId) {
  return ALERT_TEMPLATES[ruleId] || null;
}

export function enrichFindingWithAlert(finding) {
  if (!finding || typeof finding !== "object") return finding;
  const ruleId =
    finding.pattern ||
    finding.patternId ||
    (finding.id ? finding.id.split("-").slice(0, 3).join("-") : null);
  const template = ruleId ? getAlertTemplate(ruleId) : null;
  if (!template) return finding;
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

export function enrichFindingsWithAlerts(findings) {
  if (!Array.isArray(findings)) return [];
  return findings.map(enrichFindingWithAlert);
}

/**
 * Render an alert card for a single finding with an alert template.
 * Returns an HTML string for the dashboard.
 */
export function renderAlertCard(finding) {
  const t = finding.alertTemplate;
  if (!t) return "";

  const color = SEVERITY_COLORS[t.severity] || "#6B7280";
  const icon = SEVERITY_ICONS[t.severity] || "⚪";
  const rotationBanner = t.rotationRequired
    ? `<div class="alert-rotation-banner" style="background:#FEE2E2;color:#991B1B;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-weight:600;">
             ⚠️ IMMEDIATE: Rotate exposed secrets before deploying.
           </div>`
    : "";
  const cweBadge = t.cwe
    ? `<span class="alert-cwe-badge" style="background:#E0E7FF;color:#3730A3;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">${t.cwe}</span>`
    : "";
  const steps = t.remediationSteps.map((s, i) => `<li>${s}</li>`).join("");
  const refs = t.references
    .map(
      (r) =>
        `<a href="${r}" target="_blank" rel="noopener" style="color:#3B82F6;">${r}</a>`,
    )
    .join("<br>");

  return `
        <div class="alert-card" style="border:1px solid ${color};border-left:4px solid ${color};border-radius:8px;padding:16px;margin-bottom:16px;background:var(--surface,#fff);">
            <div class="alert-header" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:1.25rem;">${icon}</span>
                <h4 style="margin:0;font-size:1rem;font-weight:700;color:${color};">${t.title}</h4>
                ${cweBadge}
            </div>
            <p style="margin:0 0 12px;color:var(--text-secondary,#64748b);font-size:0.875rem;">${t.summary}</p>
            ${rotationBanner}
            <div style="margin-bottom:12px;">
                <strong style="font-size:0.875rem;">Impact:</strong>
                <p style="margin:4px 0 0;color:var(--text-secondary,#64748b);font-size:0.8125rem;">${t.impact}</p>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="font-size:0.875rem;">Immediate Action:</strong>
                <p style="margin:4px 0 0;color:${color};font-size:0.8125rem;font-weight:500;">${t.immediateAction}</p>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="font-size:0.875rem;">Remediation Steps:</strong>
                <ol style="margin:4px 0 0;padding-left:20px;color:var(--text-secondary,#64748b);font-size:0.8125rem;">${steps}</ol>
            </div>
            <div style="margin-bottom:12px;">
                <strong style="font-size:0.875rem;">Prevention:</strong>
                <p style="margin:4px 0 0;color:var(--text-secondary,#64748b);font-size:0.8125rem;">${t.preventionGuidance}</p>
            </div>
            ${refs ? `<div><strong style="font-size:0.875rem;">References:</strong><div style="margin-top:4px;font-size:0.75rem;">${refs}</div></div>` : ""}
        </div>
    `;
}

export function getAllAlertTemplates() {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return Object.entries(ALERT_TEMPLATES)
    .map(([ruleId, template]) => ({ ruleId, ...template }))
    .sort((a, b) => {
      const aOrder =
        severityOrder[a.severity] != null ? severityOrder[a.severity] : 4;
      const bOrder =
        severityOrder[b.severity] != null ? severityOrder[b.severity] : 4;
      return aOrder - bOrder;
    });
}

export function getAlertsBySeverity(severity) {
  return Object.entries(ALERT_TEMPLATES)
    .filter(([, t]) => t.severity === severity)
    .map(([ruleId, template]) => ({ ruleId, ...template }));
}

export { ALERT_TEMPLATES, SEVERITY_COLORS, SEVERITY_ICONS };
