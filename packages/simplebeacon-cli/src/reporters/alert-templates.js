// simplebeacon-ignore: Alert template definitions — all findings are false positives in scanner definitions
/**
 * High-Risk Finding Alert Templates
 *
 * Provides severity-specific alert templates for high-risk security findings.
 * Each template includes:
 * - title: Short headline for the alert
 * - severity: critical/high/medium/low
 * - summary: One-line description of the risk
 * - impact: Business/technical impact if not remediated
 * - immediateAction: What to do RIGHT NOW (rotation, revocation, etc.)
 * - remediationSteps: Ordered steps to fix the issue
 * - preventionGuidance: How to prevent this class of issue in the future
 * - references: Official documentation links
 * - rotationRequired: Whether secrets must be rotated
 * - cveOrCwe: Associated CWE identifier if applicable
 *
 * Used by:
 * - CLI: Enriches rawIssues with structured remediation guidance
 * - Dashboard: Renders alert cards with color-coded severity
 * - PDF Report: Includes alert details in compliance clearance document
 */

const ALERT_TEMPLATES = {
    // ═══════════════════════════════════════════════
    // Cloud IAM & Secret Detection (Critical)
    // ═══════════════════════════════════════════════
    'SB-SEC-014': {
        title: 'GCP Service Account Key Exposed',
        severity: 'critical',
        summary: 'A GCP service account key was detected in source code',
        impact: 'Service account keys grant access to GCP resources (Cloud Storage, BigQuery, Compute Engine). An exposed key allows attackers to impersonate the service account, exfiltrate data, spin up compute resources for cryptomining, or pivot to other GCP services via IAM escalation.',
        immediateAction: 'Rotate the exposed key immediately in the GCP Console (IAM & Admin > Service Accounts > Keys). Revoke the compromised key after creating a replacement. Audit GCP audit logs for unauthorized API calls made with the key.',
        remediationSteps: [
            'Go to GCP Console > IAM & Admin > Service Accounts',
            'Select the affected service account and create a new key',
            'Update your application to use the new key via environment variable or Secret Manager',
            'Revoke and delete the exposed key',
            'Review Cloud Audit Logs for unauthorized API calls since the key was committed',
            'Add the key file pattern to .gitignore and pre-commit hooks'
        ],
        preventionGuidance: 'Never commit service account JSON keys to version control. Use GCP Secret Manager, Workload Identity, or environment variables. Add pre-commit hooks with gitleaks or simplebeacon to scan for key patterns.',
        references: [
            'https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys',
            'https://cloud.google.com/security/compliance/iam-best-practices'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    'SB-SEC-015': {
        title: 'Azure Storage Key Exposed',
        severity: 'critical',
        summary: 'An Azure storage account key or client secret was detected in source code',
        impact: 'Azure storage keys grant full access to blob, table, queue, and file services in the storage account. An exposed key allows attackers to read, modify, or delete stored data, upload malicious content, and escalate to other Azure services via the associated subscription.',
        immediateAction: 'Rotate the storage key in the Azure Portal (Storage Account > Access keys > Rotate). Rotate the client secret in Azure Active Directory > App Registrations. Audit Azure Activity Logs for unauthorized access.',
        remediationSteps: [
            'Open Azure Portal > Storage Account > Access keys > Rotate keys',
            'If AZURE_CLIENT_SECRET was exposed, go to AAD > App Registrations > Certificates & secrets > New client secret',
            'Update application configuration with the new key/secret via Azure Key Vault',
            'Review Azure Activity Logs for unauthorized storage operations',
            'Remove the hardcoded key from source and git history (git filter-branch or BFG)',
            'Add file patterns to .gitignore and pre-commit secret scanning'
        ],
        preventionGuidance: 'Use Azure Key Vault for all secrets. Never hardcode AccountKey or AZURE_CLIENT_SECRET. Use Managed Identities where possible to eliminate the need for secrets entirely.',
        references: [
            'https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices',
            'https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    // ═══════════════════════════════════════════════
    // OAuth Token Detection (High)
    // ═══════════════════════════════════════════════
    'SB-SEC-016': {
        title: 'OAuth Token Hardcoded in Source',
        severity: 'high',
        summary: 'An OAuth access or refresh token from Google, GitHub, Slack, or Stripe was detected in source code',
        impact: 'OAuth tokens grant authenticated access to the issuing platform. A Google ya29.* token can access Gmail, Drive, and Calendar. A GitHub token can modify repositories and access private data. A Slack token can read messages and exfiltrate company communications. A Stripe key can issue refunds and access customer data.',
        immediateAction: 'Revoke the exposed token immediately on the issuing platform. For Google: Security > Third-party apps. For GitHub: Settings > Developer settings > Tokens. For Slack: Workspace > API tokens. For Stripe: Dashboard > API keys.',
        remediationSteps: [
            'Revoke the token on the issuing platform',
            'Generate a new token and store it in a secret manager',
            'Update application code to load the token from environment or secret manager',
            'Remove the hardcoded token from source and git history',
            'Audit the platform for unauthorized actions taken with the token'
        ],
        preventionGuidance: 'Store OAuth tokens in environment variables or secret managers. Use OAuth flows that exchange authorization codes for tokens at runtime rather than hardcoding tokens. Implement token refresh logic instead of persisting long-lived tokens.',
        references: [
            'https://oauth.net/2/best-practices/',
            'https://developers.google.com/identity/protocols/oauth2'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    // ═══════════════════════════════════════════════
    // Docker / Container Misconfiguration
    // ═══════════════════════════════════════════════
    'SB-SEC-017': {
        title: 'Docker Container Running in Privileged Mode',
        severity: 'high',
        summary: 'A Docker container is configured to run in privileged mode',
        impact: 'Privileged mode grants the container full access to host devices, kernel capabilities, and the host filesystem. An attacker who compromises the container can escape to the host, access other containers, and gain root-level control over the entire host system.',
        immediateAction: 'Remove the privileged flag from the container configuration. Identify the specific capability the container needs and grant only that capability via --cap-add.',
        remediationSteps: [
            'Remove `privileged: true` from docker-compose.yml or `--privileged` from docker run',
            'Identify the specific kernel capability the container needs (e.g., NET_ADMIN, SYS_ADMIN)',
            'Grant only the required capability: `--cap-add=NET_ADMIN`',
            'If the container needs device access, use `--device` instead of privileged',
            'Test the container functionality after removing privileged mode',
            'Add a CI check that rejects privileged containers in Dockerfile/compose files'
        ],
        preventionGuidance: 'Never use privileged mode in production. Use the principle of least capability — grant only the specific capabilities needed. Use Docker security profiles (AppArmor, seccomp) to further restrict container behavior.',
        references: [
            'https://docs.docker.com/engine/reference/run/#security-configuration',
            'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: 'CWE-250: Execution with Unnecessary Privileges'
    },

    'SB-SEC-018': {
        title: 'Docker Container Running as Root User',
        severity: 'medium',
        summary: 'A Dockerfile specifies USER root, running the container as the root user',
        impact: 'Running as root inside a container increases the blast radius of container escape vulnerabilities. If an attacker compromises the container, they already have root privileges, making it easier to access host resources and escalate attacks.',
        immediateAction: 'Change the USER directive to a non-root user. Create a dedicated user in the Dockerfile with minimal permissions.',
        remediationSteps: [
            'Add a non-root user in the Dockerfile: `RUN useradd -m appuser`',
            'Switch to the user: `USER appuser`',
            'Ensure file permissions allow the non-root user to read/write required paths',
            'Test the container to verify it works correctly as non-root',
            'If the application requires root for a specific operation, use gosu/su-exec to drop privileges after startup'
        ],
        preventionGuidance: 'Always create a dedicated non-root user in Dockerfiles. Use multi-stage builds to minimize the final image. Set read-only filesystem where possible with `--read-only` flag.',
        references: [
            'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user',
            'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html#rule-1-do-not-run-the-container-as-root'
        ],
        rotationRequired: false,
        cwe: 'CWE-250: Execution with Unnecessary Privileges'
    },

    'SB-SEC-019': {
        title: 'Hardcoded Secret in Docker ENV Directive',
        severity: 'critical',
        summary: 'A secret (password, API key, token) is hardcoded in a Docker ENV directive',
        impact: 'Docker ENV values are baked into the image layers and are visible to anyone who can pull the image. Secrets in ENV directives cannot be rotated without rebuilding the image. They appear in `docker inspect`, `docker history`, and any registry that stores the image.',
        immediateAction: 'Rotate the exposed secret. Remove it from the Dockerfile immediately. Use Docker secrets or environment variable files instead of ENV directives.',
        remediationSteps: [
            'Rotate the exposed secret at the provider',
            'Remove the ENV directive containing the secret from the Dockerfile',
            'Use Docker secrets (`docker secret create`) or mount a .env file at runtime',
            'Alternatively, pass the secret via `docker run -e SECRET=value` or compose `environment:` with `${SECRET}` substitution',
            'Rebuild and redeploy the image',
            'Audit Docker registries for old images containing the secret'
        ],
        preventionGuidance: 'Never put secrets in ENV directives. Use Docker secrets, Kubernetes secrets, or external secret managers (Vault, AWS Secrets Manager). Use multi-stage builds and .dockerignore to prevent accidental secret inclusion.',
        references: [
            'https://docs.docker.com/engine/swarm/secrets/',
            'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html#rule-7-do-not-store-secrets-in-dockerfiles'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    'SB-SEC-020': {
        title: 'Docker Image Missing Health Check',
        severity: 'low',
        summary: 'A Dockerfile does not include a HEALTHCHECK instruction',
        impact: 'Without a health check, the container orchestrator (Docker Swarm, Kubernetes, ECS) cannot detect when the application inside the container is unhealthy. The container continues running and receiving traffic even if the application has hung or crashed without exiting.',
        immediateAction: 'Add a HEALTHCHECK instruction to the Dockerfile that tests the application endpoint.',
        remediationSteps: [
            'Add a HEALTHCHECK instruction to the Dockerfile',
            'Use an endpoint that verifies the application is responsive (e.g., HTTP /health)',
            'Example: `HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -f http://localhost:3000/health || exit 1`',
            'Configure the orchestrator to use the health check for automatic restarts',
            'Test that the health check correctly detects application failures'
        ],
        preventionGuidance: 'Always include a HEALTHCHECK in production Dockerfiles. Use a dedicated /health or /ready endpoint that verifies database connectivity and critical dependencies, not just HTTP 200.',
        references: [
            'https://docs.docker.com/engine/reference/builder/#healthcheck',
            'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: null
    },

    // ═══════════════════════════════════════════════
    // Supply Chain Checks
    // ═══════════════════════════════════════════════
    'SB-SEC-021': {
        title: 'Suspicious Package Installation Detected',
        severity: 'high',
        summary: 'A package install command references a suspicious package name that may be a typosquat',
        impact: 'Typosquat packages are malicious packages published with names similar to popular packages (e.g., `nodjs` instead of `nodejs`). They often contain malware that steals credentials, installs backdoors, or enrolls the machine in a botnet upon installation.',
        immediateAction: 'Do not install the flagged package. Verify the package name against the official npm registry. If already installed, remove it and audit the system for compromise.',
        remediationSteps: [
            'Verify the package name against the official npm registry (npmjs.com)',
            'If the package is a typosquat, remove it: `npm uninstall <package>`',
            'Clear npm cache: `npm cache clean --force`',
            'Audit the system for signs of compromise (check for unexpected network connections, new files, modified system configs)',
            'Install the correct package with the verified name',
            'Add package name verification to CI/CD pipeline'
        ],
        preventionGuidance: 'Always verify package names against the official registry. Use npm audit and Snyk to scan for known malicious packages. Enable npm 2FA. Consider using a private npm registry proxy that blocks known typosquats.',
        references: [
            'https://docs.npmjs.com/about-registry',
            'https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html#do-not-use-javascript-eval'
        ],
        rotationRequired: false,
        cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component'
    },

    'SB-SEC-022': {
        title: 'Malicious postinstall Script Detected',
        severity: 'high',
        summary: 'A package.json postinstall script executes network calls or dynamic code execution',
        impact: 'postinstall scripts run automatically when a package is installed. Malicious scripts can download and execute arbitrary code, steal environment variables and secrets, install backdoors, or modify system files — all without user interaction.',
        immediateAction: 'Review the postinstall script. If it makes network calls or executes dynamic code, remove it. Audit the system for compromise if the script was already executed.',
        remediationSteps: [
            'Review the postinstall script in package.json',
            'If it uses curl, wget, node -e, python -c, bash -c, or powershell, remove it',
            'Replace with a legitimate build tool (tsc, webpack, babel, eslint, prettier)',
            'If the script was already executed, audit for compromise: check network connections, new files, modified configs',
            'Run `npm audit` to check for known vulnerabilities',
            'Consider using `npm install --ignore-scripts` in CI to prevent script execution'
        ],
        preventionGuidance: 'Avoid postinstall scripts that make network calls. Use `npm install --ignore-scripts` in CI/CD. Audit package.json before adding dependencies. Use npm 7+ lockfile to detect unexpected script changes.',
        references: [
            'https://docs.npmjs.com/cli/v8/using-npm/scripts',
            'https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: 'CWE-506: Embedded Malicious Code'
    },

    'SB-SEC-023': {
        title: 'Unpinned Dependency Version',
        severity: 'medium',
        summary: 'A dependency uses an unpinned version specifier (^, ~, latest, *, >=)',
        impact: 'Unpinned dependencies can resolve to different versions across installs, leading to non-reproducible builds. A malicious or buggy update can break the application or introduce vulnerabilities without any code change. Supply chain attacks often target floating version specifiers.',
        immediateAction: 'Pin the dependency to an exact version. Run npm install to verify the lockfile is consistent.',
        remediationSteps: [
            'Identify the unpinned dependency in package.json',
            'Replace ^, ~, latest, *, or >= with an exact version (e.g., "4.18.0")',
            'Run `npm install` to update the lockfile',
            'Run the full test suite to verify compatibility',
            'Consider using `npm ci` in CI/CD for reproducible installs',
            'Set up Dependabot or Renovate for automated, reviewed updates'
        ],
        preventionGuidance: 'Pin all dependencies to exact versions. Use `npm ci` instead of `npm install` in CI. Use Dependabot or Renovate for automated, reviewed dependency updates. Regularly run `npm audit` to check for vulnerabilities.',
        references: [
            'https://docs.npmjs.com/cli/v8/commands/npm-ci',
            'https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Management_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component'
    },

    // ═══════════════════════════════════════════════
    // Existing Critical Rules (enriched templates)
    // ═══════════════════════════════════════════════
    'SB-SEC-009': {
        title: '.env File Committed to Repository',
        severity: 'critical',
        summary: 'A .env file with environment secrets has been committed to version control',
        impact: 'Environment files typically contain database credentials, API keys, encryption keys, and other secrets. Once committed, these secrets are in git history permanently and accessible to anyone with repository access. Even if deleted, the secrets remain in historical commits.',
        immediateAction: 'Rotate ALL secrets that were in the .env file. Remove the file from git tracking. Add .env to .gitignore. Use git filter-branch or BFG to purge the file from history.',
        remediationSteps: [
            'Rotate every secret that was in the .env file (database passwords, API keys, etc.)',
            'Remove the file from git: `git rm --cached .env`',
            'Add `.env` to .gitignore',
            'Purge the file from git history using BFG Repo-Cleaner or git filter-branch',
            'Force push the cleaned history (coordinate with all collaborators first)',
            'Provide .env.example with placeholder values for documentation'
        ],
        preventionGuidance: 'Never commit .env files. Add .env to .gitignore on day one. Use .env.example with placeholder values. Install pre-commit hooks that block .env commits. Use secret managers for production secrets.',
        references: [
            'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
            'https://rtyley.github.io/bfg-repo-cleaner/'
        ],
        rotationRequired: true,
        cwe: 'CWE-312: Cleartext Storage of Sensitive Information'
    },

    'SB-SEC-013': {
        title: 'CI/CD Secret Hardcoded in Workflow Config',
        severity: 'critical',
        summary: 'A CI/CD secret (GITHUB_TOKEN, AWS keys, NPM_TOKEN) is hardcoded in a workflow or config file',
        impact: 'CI/CD secrets in workflow files are visible to anyone with read access to the repository. Attackers can use these secrets to publish packages, modify infrastructure, or access production environments. GitHub Actions secrets in particular can be exfiltrated via pull requests from forks.',
        immediateAction: 'Rotate the exposed secret. Move it to the CI/CD platform secret store (GitHub Actions secrets, GitLab CI variables). Audit CI/CD logs for unauthorized usage.',
        remediationSteps: [
            'Rotate the exposed secret at the provider',
            'Move the secret to the CI/CD platform secret store (e.g., GitHub Settings > Secrets)',
            'Reference the secret via environment variable: `env: TOKEN: ${{ secrets.TOKEN }}`',
            'Remove the hardcoded value from the workflow file',
            'Audit CI/CD logs for unauthorized pipeline runs or secret usage',
            'Add branch protection to prevent workflow file modifications without review'
        ],
        preventionGuidance: 'Never hardcode secrets in workflow files. Use the CI/CD platform secret store. Restrict secret access to specific environments. Use OIDC federation where possible to eliminate long-lived secrets entirely.',
        references: [
            'https://docs.github.com/en/actions/security-guides/encrypted-secrets',
            'https://docs.github.com/en/actions/deployment/security-hardening-your-deployments'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    // ═══════════════════════════════════════════════
    // Advanced Security Metrics (from PATTERN_REGISTRY)
    // ═══════════════════════════════════════════════
    'credentials': {
        title: 'Hardcoded Credential Detected',
        severity: 'medium',
        summary: 'A potential hardcoded secret (password, API key, or token) was found in source code',
        impact: 'Hardcoded secrets in source code are visible to anyone with repository access. If the repo is public or leaked, attackers can use these credentials to access downstream services, databases, or cloud infrastructure.',
        immediateAction: 'Identify the exposed credential. If it is a real secret (not a placeholder), rotate it immediately in the originating service. Remove the hardcoded value from source.',
        remediationSteps: [
            'Identify which service the credential belongs to (AWS, Stripe, database, etc.)',
            'Rotate the credential in the service dashboard or CLI',
            'Replace the hardcoded value with an environment variable reference (process.env.SECRET_NAME)',
            'Add the credential to your .env file (which should be gitignored)',
            'Scan git history for the credential using `git log -p | grep -i <pattern>` and purge if needed',
            'Add a pre-commit hook with gitleaks or simplebeacon to prevent future leaks'
        ],
        preventionGuidance: 'Never hardcode secrets in source files. Use environment variables, a secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault), or a .env file that is gitignored. Use CI/CD secret stores for pipeline credentials.',
        references: [
            'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
            'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },

    'evalDanger': {
        title: 'Dangerous Dynamic Code Execution',
        severity: 'high',
        summary: 'eval(), new Function(), or string-based setTimeout/setInterval detected — code injection risk',
        impact: 'Dynamic code execution allows arbitrary code injection if the input is attacker-controlled. This can lead to full server compromise, data exfiltration, privilege escalation, and persistent backdoors.',
        immediateAction: 'Determine if the eval/Function call processes user input. If so, treat as a critical vulnerability and patch immediately. Replace with structured parsing (JSON.parse, RegExp, or a proper parser).',
        remediationSteps: [
            'Identify the data source feeding into eval() or new Function()',
            'Replace eval() with JSON.parse() for JSON data',
            'Replace new Function() with a proper callback or strategy pattern',
            'Replace string-based setTimeout/setInterval with function references',
            'If dynamic evaluation is truly necessary, use a sandboxed evaluator like vm2 or isolated-vm'
        ],
        preventionGuidance: 'Never use eval() or new Function() with untrusted input. Use JSON.parse() for JSON, template literals for string construction, and proper parsers for DSLs. Enable CSP headers (script-src \'self\') to mitigate XSS-to-eval chains.',
        references: [
            'https://owasp.org/www-community/vulnerabilities/Direct_Dynamic_Code_Evaluation',
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval'
        ],
        rotationRequired: false,
        cwe: 'CWE-94: Improper Control of Generation of Code (Code Injection)'
    },

    'sensitiveData': {
        title: 'Sensitive Data Exposure in Source',
        severity: 'high',
        summary: 'PII (email, SSN, phone) or sensitive data found in console logs or localStorage',
        impact: 'Exposing PII in logs or client-side storage violates GDPR, CCPA, and HIPAA. Logs are often aggregated to third-party services (Datadog, Splunk) where PII becomes searchable. localStorage is accessible via XSS.',
        immediateAction: 'Identify what sensitive data is being logged or stored. Remove the logging statement. If PII has been logged to external services, coordinate with the data team to purge those log entries.',
        remediationSteps: [
            'Remove the console.log/localStorage.setItem call that exposes PII',
            'If logging is necessary, implement a PII redaction filter (mask emails, SSNs, phone numbers)',
            'Replace localStorage usage with HttpOnly cookies for session tokens',
            'Audit log aggregation services (Datadog, Splunk) for exposed PII',
            'Add automated tests that scan for PII patterns in log output',
            'Review GDPR/CCPA compliance with the legal team if PII was exposed'
        ],
        preventionGuidance: 'Never log or store raw PII. Implement a redaction middleware that masks sensitive fields before logging. Use HttpOnly, Secure cookies for authentication tokens. Add automated PII scanning to CI/CD pipelines.',
        references: [
            'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
            'https://cheatsheetseries.owasp.org/cheatsheets/User_Privacy_Protection_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: 'CWE-532: Insertion of Sensitive Information into Log File'
    },

    'dbAntiPattern': {
        title: 'SQL Injection Risk — Raw Query Construction',
        severity: 'high',
        summary: 'SQL string concatenation or unbounded query detected — potential SQL injection',
        impact: 'String-concatenated SQL queries allow attackers to inject arbitrary SQL, enabling data exfiltration, modification, deletion, or full database compromise. Unbounded queries can cause OOM crashes or denial of service.',
        immediateAction: 'Determine if the concatenated SQL uses user input. If so, this is a critical vulnerability. Replace with parameterized queries immediately. Add a query timeout and LIMIT clause.',
        remediationSteps: [
            'Identify the data source for the concatenated query',
            'Replace string concatenation with parameterized queries (e.g., db.query("SELECT * FROM users WHERE id = $1", [userId]))',
            'Add a LIMIT clause to unbounded findAll queries',
            'Add query timeouts to prevent long-running queries',
            'Write integration tests that verify parameterized queries are used',
            'Enable SQL query logging in development to catch raw SQL during testing'
        ],
        preventionGuidance: 'Always use parameterized queries or an ORM that parameterizes automatically. Never concatenate user input into SQL strings. Add query limits and timeouts. Use a query builder (Knex, Kysely) that enforces parameterization.',
        references: [
            'https://owasp.org/www-community/attacks/SQL_Injection',
            'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
        ],
        rotationRequired: false,
        cwe: 'CWE-89: Improper Neutralization of Special Elements used in an SQL Command'
    },

    'innerHtmlXss': {
        title: 'Cross-Site Scripting (XSS) via innerHTML',
        severity: 'medium',
        summary: 'Assignment to innerHTML without sanitization — potential XSS vector',
        impact: 'If attacker-controlled data reaches innerHTML, malicious scripts can execute in the user\'s browser context, enabling session hijacking, credential theft, DOM manipulation, and worm propagation.',
        immediateAction: 'Determine if the innerHTML assignment uses user-controlled data. If so, replace with textContent or sanitize with DOMPurify immediately.',
        remediationSteps: [
            'Identify the data source for the innerHTML assignment',
            'If the content is static or trusted, add a comment explaining why',
            'If the content is dynamic, replace .innerHTML with .textContent for plain text',
            'For HTML content, sanitize with DOMPurify: element.innerHTML = DOMPurify.sanitize(content)',
            'Add Content-Security-Policy headers (script-src \'self\') as defense-in-depth',
            'Write tests that verify user input cannot reach innerHTML unsanitized'
        ],
        preventionGuidance: 'Never assign user-controlled data to innerHTML. Use textContent for plain text. Use DOMPurify for HTML content. Enable CSP headers. Consider a framework (React, Vue) that auto-escapes by default.',
        references: [
            'https://owasp.org/www-community/vulnerabilities/Cross-site_Scripting_(XSS)',
            'https://github.com/cure53/DOMPurify'
        ],
        rotationRequired: false,
        cwe: 'CWE-79: Improper Neutralization of Input During Web Page Generation'
    },

    'prototypePollution': {
        title: 'Prototype Pollution Vulnerability',
        severity: 'high',
        summary: 'Modification of Object.prototype or __proto__ — prototype pollution risk',
        impact: 'Prototype pollution allows attackers to inject properties into all JavaScript objects, potentially bypassing authentication, escalating privileges, or causing denial of service. It is exploitable in Node.js and browser environments.',
        immediateAction: 'Determine if the __proto__ or Object.prototype modification uses user-controlled data. If so, this is a critical vulnerability. Replace with Object.create(null) or Map immediately.',
        remediationSteps: [
            'Identify the data source for the prototype modification',
            'Replace __proto__ assignments with Object.create(null) for dictionary objects',
            'Use Map instead of plain objects for key-value storage of untrusted data',
            'Add input validation that rejects __proto__, constructor, and prototype keys',
            'Use Object.freeze(Object.prototype) in development to catch pollution early',
            'Audit dependencies for known prototype pollution CVEs (lodash <4.17.12, etc.)'
        ],
        preventionGuidance: 'Never modify Object.prototype. Use Object.create(null) for hash maps. Use Map for untrusted key-value data. Validate input keys to reject __proto__ and constructor. Keep dependencies updated.',
        references: [
            'https://snyk.io/vuln/SNYK-JS-LODASH-450202',
            'https://github.com/HackTricks-wiki/hacktricks/blob/master/pentesting-web/prototype-pollution.md'
        ],
        rotationRequired: false,
        cwe: 'CWE-1321: Improperly Controlled Modification of Object Prototype Attributes'
    },

    'configDrift': {
        title: 'Configuration Drift — Hardcoded URLs or Secrets',
        severity: 'medium',
        summary: 'Hardcoded localhost URLs, secrets, or API keys detected in source code',
        impact: 'Hardcoded configuration values cause deployment failures across environments, expose development secrets in production builds, and make infrastructure changes brittle. Localhost references break in containerized environments.',
        immediateAction: 'Identify the hardcoded value. If it is a secret, rotate it. Replace all hardcoded URLs and secrets with environment variables or configuration files.',
        remediationSteps: [
            'Replace hardcoded URLs with environment variables (process.env.API_URL)',
            'Replace hardcoded secrets with a secret manager or .env file',
            'Create a config module that loads from environment with sensible defaults',
            'Add a startup check that verifies required env vars are set',
            'Document required environment variables in a .env.example file',
            'Add a pre-commit hook that scans for localhost: and 127.0.0.1 patterns'
        ],
        preventionGuidance: 'Use environment-based configuration for all URLs, ports, and secrets. Create a centralized config module. Use .env.example to document required variables. Never commit .env files. Use Docker compose or Kubernetes ConfigMaps for environment-specific config.',
        references: [
            'https://12factor.net/config',
            'https://owasp.org/www-community/vulnerabilities/Insertion_of_Sensitive_Information_into_a_Configuration_File'
        ],
        rotationRequired: false,
        cwe: 'CWE-489: Active Debug Code'
    },

    'loggingSecrets': {
        title: 'Secrets Exposed in Log Output',
        severity: 'high',
        summary: 'Passwords, tokens, or API keys are being logged to console output',
        impact: 'Logged secrets are captured by log aggregation services (Datadog, CloudWatch, Splunk) where they are searchable and persisted. In containerized environments, logs are often forwarded to shared storage, expanding the attack surface.',
        immediateAction: 'Remove the logging statement that outputs the secret. Audit log aggregation services for the exposed secret. Rotate the secret if it has been logged to any external service.',
        remediationSteps: [
            'Remove or comment out the console.log that outputs the secret',
            'If logging is necessary, implement a redaction filter that masks secret values',
            'Audit log aggregation services (Datadog, CloudWatch) for the exposed secret',
            'Rotate the secret if it was logged to any external service',
            'Add a pre-commit hook that scans for console.log statements containing secret keywords',
            'Implement structured logging with a sanitizer that redacts known secret field names'
        ],
        preventionGuidance: 'Never log secrets. Implement a structured logging library (Winston, Pino) with a redaction filter for sensitive fields. Use a centralized logging config that masks password, token, apiKey, secret, and credential fields. Add automated tests that verify secrets are not present in log output.',
        references: [
            'https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure',
            'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html'
        ],
        rotationRequired: true,
        cwe: 'CWE-532: Insertion of Sensitive Information into Log File'
    },

    'productionLeak': {
        title: 'Test or Mock Data Leaked into Production Code',
        severity: 'medium',
        summary: 'Mock data files, fixtures, or placeholder values detected in production source paths',
        impact: 'Test data in production code can cause incorrect behavior, expose internal data structures, and create confusion for users. Placeholder values (your_api_key, change_me) indicate incomplete configuration that may fail silently in production.',
        immediateAction: 'Identify the mock/fixture file or placeholder value. Remove it from production code paths. If it is a configuration placeholder, replace with a real value or environment variable reference.',
        remediationSteps: [
            'Move mock/fixture files to a tests/ or __tests__/ directory',
            'Replace placeholder values (your_, change_me, xxxx) with real configuration or env vars',
            'Add a build step that excludes test data files from production bundles',
            'Add a pre-commit hook that scans production source paths for mock/fixture patterns',
            'Review import statements to ensure test modules are not imported into production code',
            'Use tree-shaking or dead code elimination to remove test-only exports'
        ],
        preventionGuidance: 'Keep test data in dedicated test directories. Never import test modules from production code. Use build-time exclusion (webpack, esbuild) to strip test files. Add a CI check that scans production build output for mock/fixture references.',
        references: [
            'https://docs.python.org/3/library/unittest.html#organizing-test-code',
            'https://jestjs.io/docs/configuration#testmatch-string-array'
        ],
        rotationRequired: false,
        cwe: 'CWE-489: Active Debug Code'
    },

    'hallucinatedImport': {
        title: 'Hallucinated npm Package Import',
        severity: 'medium',
        summary: 'An import references an npm package not declared in package.json dependencies',
        impact: 'Hallucinated imports (often from LLM-generated code) reference packages that either do not exist (supply chain risk if someone registers the name) or are not installed (runtime crash). This is a common AI code generation anti-pattern.',
        immediateAction: 'Verify whether the imported package exists on npm. If it exists, add it to package.json dependencies. If it does not exist, replace the import with a real package or implement the functionality natively.',
        remediationSteps: [
            'Check if the imported package name exists on npm (npm view <package>)',
            'If it exists, add it to package.json: npm install <package>',
            'If it does not exist, identify what functionality was expected',
            'Find a real package that provides the same functionality',
            'Replace the hallucinated import with the correct package',
            'Run npm install and verify the application starts without errors',
            'Add a CI check that verifies all imports resolve to declared dependencies'
        ],
        preventionGuidance: 'When using AI-generated code, always verify imports against package.json. Use TypeScript with strict module resolution to catch missing dependencies at compile time. Add a CI step that runs `npm ls` or dependency-check to verify all imports resolve.',
        references: [
            'https://research.nccgroup.com/2023/04/12/ai-generated-code-finding-hallucinated-package-names/',
            'https://docs.npmjs.com/cli/v9/commands/npm-ls'
        ],
        rotationRequired: false,
        cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component'
    }
};

// ═══════════════════════════════════════════════
// Alert formatting functions
// ═══════════════════════════════════════════════

/**
 * Get the alert template for a given rule ID.
 * @param {string} ruleId - The rule ID (e.g., 'SB-SEC-014')
 * @returns {object|null} The alert template or null if not found
 */
function getAlertTemplate(ruleId) {
    return ALERT_TEMPLATES[ruleId] || null;
}

/**
 * Enrich a finding with its alert template data.
 * @param {object} finding - A raw finding from the scanner
 * @returns {object} The finding with added alertTemplate field
 */
function enrichFindingWithAlert(finding) {
    if (!finding || typeof finding !== 'object') return finding;
    const ruleId = finding.pattern || finding.patternId || (finding.id ? finding.id.split('-').slice(0, 3).join('-') : null) || null;
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
            cwe: template.cwe
        }
    };
}

/**
 * Enrich an array of findings with alert templates.
 * @param {object[]} findings - Array of raw findings
 * @returns {object[]} Findings with alert templates attached
 */
function enrichFindingsWithAlerts(findings) {
    if (!Array.isArray(findings)) return [];
    return findings.map(enrichFindingWithAlert);
}

/**
 * Format an alert as a markdown section for the CLI text report.
 * @param {object} finding - A finding with an alertTemplate
 * @returns {string} Markdown-formatted alert section
 */
function formatAlertMarkdown(finding) {
    const t = finding.alertTemplate;
    if (!t) return '';

    const steps = t.remediationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const refs = t.references.map(r => `- ${r}`).join('\n');
    const rotation = t.rotationRequired ? '\n\n> **IMMEDIATE: Rotate exposed secrets before deploying.**' : '';
    const cwe = t.cwe ? `\n**CWE:** ${t.cwe}` : '';

    return `### ${t.title}

**Severity:** ${t.severity.toUpperCase()}
**Summary:** ${t.summary}
${cwe}

**Impact:**
${t.impact}

**Immediate Action:**
${t.immediateAction}${rotation}

**Remediation Steps:**
${steps}

**Prevention:**
${t.preventionGuidance}

**References:**
${refs}`;
}

/**
 * Get all alert templates as an array, sorted by severity.
 * @returns {object[]} Array of {ruleId, ...template}
 */
function getAllAlertTemplates() {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return Object.entries(ALERT_TEMPLATES)
        .map(([ruleId, template]) => ({ ruleId, ...template }))
        .sort((a, b) => {
            const aOrder = severityOrder[a.severity] != null ? severityOrder[a.severity] : 4;
            const bOrder = severityOrder[b.severity] != null ? severityOrder[b.severity] : 4;
            return aOrder - bOrder;
        });
}

/**
 * Get alert templates filtered by severity.
 * @param {string} severity - critical, high, medium, or low
 * @returns {object[]} Filtered templates
 */
function getAlertsBySeverity(severity) {
    return Object.entries(ALERT_TEMPLATES)
        .filter(([, t]) => t.severity === severity)
        .map(([ruleId, template]) => ({ ruleId, ...template }));
}

module.exports = {
    ALERT_TEMPLATES,
    getAlertTemplate,
    enrichFindingWithAlert,
    enrichFindingsWithAlerts,
    formatAlertMarkdown,
    getAllAlertTemplates,
    getAlertsBySeverity
};
