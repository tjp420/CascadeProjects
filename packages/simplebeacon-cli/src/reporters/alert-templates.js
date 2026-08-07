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
    const ruleId = finding.pattern || (finding.id ? finding.id.split('-').slice(0, 3).join('-') : null) || null;
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
