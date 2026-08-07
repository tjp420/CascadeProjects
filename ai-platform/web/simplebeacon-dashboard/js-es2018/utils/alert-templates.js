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
    'SB-SEC-014': {
        title: 'GCP Service Account Key Exposed',
        severity: 'critical',
        summary: 'A GCP service account key was detected in source code',
        impact: 'Service account keys grant access to GCP resources. An exposed key allows attackers to impersonate the service account, exfiltrate data, or spin up compute resources for cryptomining.',
        immediateAction: 'Rotate the exposed key immediately in the GCP Console. Revoke the compromised key after creating a replacement. Audit GCP audit logs for unauthorized API calls.',
        remediationSteps: [
            'Go to GCP Console > IAM & Admin > Service Accounts',
            'Select the affected service account and create a new key',
            'Update your application to use the new key via environment variable or Secret Manager',
            'Revoke and delete the exposed key',
            'Review Cloud Audit Logs for unauthorized API calls',
            'Add the key file pattern to .gitignore and pre-commit hooks'
        ],
        preventionGuidance: 'Never commit service account JSON keys to version control. Use GCP Secret Manager, Workload Identity, or environment variables.',
        references: [
            'https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },
    'SB-SEC-015': {
        title: 'Azure Storage Key Exposed',
        severity: 'critical',
        summary: 'An Azure storage account key or client secret was detected in source code',
        impact: 'Azure storage keys grant full access to blob, table, queue, and file services. An exposed key allows attackers to read, modify, or delete stored data.',
        immediateAction: 'Rotate the storage key in the Azure Portal. Rotate the client secret in Azure AD. Audit Azure Activity Logs for unauthorized access.',
        remediationSteps: [
            'Open Azure Portal > Storage Account > Access keys > Rotate keys',
            'If AZURE_CLIENT_SECRET was exposed, rotate in AAD > App Registrations',
            'Update application configuration with the new key/secret via Azure Key Vault',
            'Review Azure Activity Logs for unauthorized storage operations',
            'Remove the hardcoded key from source and git history',
            'Add file patterns to .gitignore and pre-commit secret scanning'
        ],
        preventionGuidance: 'Use Azure Key Vault for all secrets. Use Managed Identities where possible to eliminate the need for secrets entirely.',
        references: [
            'https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },
    'SB-SEC-016': {
        title: 'OAuth Token Hardcoded in Source',
        severity: 'high',
        summary: 'An OAuth access or refresh token from Google, GitHub, Slack, or Stripe was detected in source code',
        impact: 'OAuth tokens grant authenticated access to the issuing platform. A Google token can access Gmail and Drive. A GitHub token can modify repositories. A Slack token can read messages.',
        immediateAction: 'Revoke the exposed token immediately on the issuing platform.',
        remediationSteps: [
            'Revoke the token on the issuing platform',
            'Generate a new token and store it in a secret manager',
            'Update application code to load the token from environment or secret manager',
            'Remove the hardcoded token from source and git history',
            'Audit the platform for unauthorized actions taken with the token'
        ],
        preventionGuidance: 'Store OAuth tokens in environment variables or secret managers. Use OAuth flows that exchange authorization codes for tokens at runtime.',
        references: ['https://oauth.net/2/best-practices/'],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },
    'SB-SEC-017': {
        title: 'Docker Container Running in Privileged Mode',
        severity: 'high',
        summary: 'A Docker container is configured to run in privileged mode',
        impact: 'Privileged mode grants the container full access to host devices, kernel capabilities, and the host filesystem. An attacker who compromises the container can escape to the host.',
        immediateAction: 'Remove the privileged flag. Identify the specific capability needed and grant only that capability.',
        remediationSteps: [
            'Remove `privileged: true` from docker-compose.yml or `--privileged` from docker run',
            'Identify the specific kernel capability the container needs',
            'Grant only the required capability: `--cap-add=NET_ADMIN`',
            'If the container needs device access, use `--device` instead of privileged',
            'Test the container functionality after removing privileged mode'
        ],
        preventionGuidance: 'Never use privileged mode in production. Use the principle of least capability.',
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
        impact: 'Running as root inside a container increases the blast radius of container escape vulnerabilities.',
        immediateAction: 'Change the USER directive to a non-root user.',
        remediationSteps: [
            'Add a non-root user in the Dockerfile: `RUN useradd -m appuser`',
            'Switch to the user: `USER appuser`',
            'Ensure file permissions allow the non-root user to read/write required paths',
            'Test the container to verify it works correctly as non-root'
        ],
        preventionGuidance: 'Always create a dedicated non-root user in Dockerfiles. Use multi-stage builds to minimize the final image.',
        references: [
            'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user'
        ],
        rotationRequired: false,
        cwe: 'CWE-250: Execution with Unnecessary Privileges'
    },
    'SB-SEC-019': {
        title: 'Hardcoded Secret in Docker ENV Directive',
        severity: 'critical',
        summary: 'A secret is hardcoded in a Docker ENV directive',
        impact: 'Docker ENV values are baked into the image layers and are visible to anyone who can pull the image. Secrets in ENV directives cannot be rotated without rebuilding the image.',
        immediateAction: 'Rotate the exposed secret. Remove it from the Dockerfile immediately.',
        remediationSteps: [
            'Rotate the exposed secret at the provider',
            'Remove the ENV directive containing the secret from the Dockerfile',
            'Use Docker secrets or mount a .env file at runtime',
            'Rebuild and redeploy the image',
            'Audit Docker registries for old images containing the secret'
        ],
        preventionGuidance: 'Never put secrets in ENV directives. Use Docker secrets, Kubernetes secrets, or external secret managers.',
        references: [
            'https://docs.docker.com/engine/swarm/secrets/'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    },
    'SB-SEC-020': {
        title: 'Docker Image Missing Health Check',
        severity: 'low',
        summary: 'A Dockerfile does not include a HEALTHCHECK instruction',
        impact: 'Without a health check, the orchestrator cannot detect when the application inside the container is unhealthy.',
        immediateAction: 'Add a HEALTHCHECK instruction to the Dockerfile.',
        remediationSteps: [
            'Add a HEALTHCHECK instruction to the Dockerfile',
            'Use an endpoint that verifies the application is responsive',
            'Example: `HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health`',
            'Configure the orchestrator to use the health check for automatic restarts'
        ],
        preventionGuidance: 'Always include a HEALTHCHECK in production Dockerfiles.',
        references: [
            'https://docs.docker.com/engine/reference/builder/#healthcheck'
        ],
        rotationRequired: false,
        cwe: null
    },
    'SB-SEC-021': {
        title: 'Suspicious Package Installation Detected',
        severity: 'high',
        summary: 'A package install command references a suspicious package name that may be a typosquat',
        impact: 'Typosquat packages are malicious packages with names similar to popular packages. They often contain malware that steals credentials or installs backdoors.',
        immediateAction: 'Do not install the flagged package. Verify the package name against the official npm registry.',
        remediationSteps: [
            'Verify the package name against the official npm registry',
            'If the package is a typosquat, remove it: `npm uninstall <package>`',
            'Clear npm cache: `npm cache clean --force`',
            'Audit the system for signs of compromise',
            'Install the correct package with the verified name'
        ],
        preventionGuidance: 'Always verify package names against the official registry. Use npm audit and Snyk to scan for known malicious packages.',
        references: [
            'https://docs.npmjs.com/about-registry'
        ],
        rotationRequired: false,
        cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component'
    },
    'SB-SEC-022': {
        title: 'Malicious postinstall Script Detected',
        severity: 'high',
        summary: 'A package.json postinstall script executes network calls or dynamic code execution',
        impact: 'postinstall scripts run automatically when a package is installed. Malicious scripts can download and execute arbitrary code, steal environment variables and secrets.',
        immediateAction: 'Review the postinstall script. If it makes network calls or executes dynamic code, remove it.',
        remediationSteps: [
            'Review the postinstall script in package.json',
            'If it uses curl, wget, node -e, python -c, bash -c, or powershell, remove it',
            'Replace with a legitimate build tool (tsc, webpack, babel, eslint, prettier)',
            'If the script was already executed, audit for compromise',
            'Consider using `npm install --ignore-scripts` in CI'
        ],
        preventionGuidance: 'Avoid postinstall scripts that make network calls. Use `npm install --ignore-scripts` in CI/CD.',
        references: [
            'https://docs.npmjs.com/cli/v8/using-npm/scripts'
        ],
        rotationRequired: false,
        cwe: 'CWE-506: Embedded Malicious Code'
    },
    'SB-SEC-023': {
        title: 'Unpinned Dependency Version',
        severity: 'medium',
        summary: 'A dependency uses an unpinned version specifier (^, ~, latest, *, >=)',
        impact: 'Unpinned dependencies can resolve to different versions across installs, leading to non-reproducible builds. Supply chain attacks often target floating version specifiers.',
        immediateAction: 'Pin the dependency to an exact version.',
        remediationSteps: [
            'Identify the unpinned dependency in package.json',
            'Replace ^, ~, latest, *, or >= with an exact version',
            'Run `npm install` to update the lockfile',
            'Run the full test suite to verify compatibility',
            'Consider using `npm ci` in CI/CD for reproducible installs'
        ],
        preventionGuidance: 'Pin all dependencies to exact versions. Use `npm ci` instead of `npm install` in CI.',
        references: [
            'https://docs.npmjs.com/cli/v8/commands/npm-ci'
        ],
        rotationRequired: false,
        cwe: 'CWE-1357: Reliance on Insufficiently Trustworthy Component'
    },
    'SB-SEC-009': {
        title: '.env File Committed to Repository',
        severity: 'critical',
        summary: 'A .env file with environment secrets has been committed to version control',
        impact: 'Environment files typically contain database credentials, API keys, and other secrets. Once committed, these secrets are in git history permanently.',
        immediateAction: 'Rotate ALL secrets that were in the .env file. Remove the file from git tracking.',
        remediationSteps: [
            'Rotate every secret that was in the .env file',
            'Remove the file from git: `git rm --cached .env`',
            'Add `.env` to .gitignore',
            'Purge the file from git history using BFG Repo-Cleaner',
            'Provide .env.example with placeholder values'
        ],
        preventionGuidance: 'Never commit .env files. Add .env to .gitignore on day one. Use .env.example with placeholder values.',
        references: [
            'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html'
        ],
        rotationRequired: true,
        cwe: 'CWE-312: Cleartext Storage of Sensitive Information'
    },
    'SB-SEC-013': {
        title: 'CI/CD Secret Hardcoded in Workflow Config',
        severity: 'critical',
        summary: 'A CI/CD secret is hardcoded in a workflow or config file',
        impact: 'CI/CD secrets in workflow files are visible to anyone with read access to the repository. Attackers can use these secrets to publish packages or access production.',
        immediateAction: 'Rotate the exposed secret. Move it to the CI/CD platform secret store.',
        remediationSteps: [
            'Rotate the exposed secret at the provider',
            'Move the secret to the CI/CD platform secret store',
            'Reference the secret via environment variable',
            'Remove the hardcoded value from the workflow file',
            'Audit CI/CD logs for unauthorized usage'
        ],
        preventionGuidance: 'Never hardcode secrets in workflow files. Use the CI/CD platform secret store. Use OIDC federation where possible.',
        references: [
            'https://docs.github.com/en/actions/security-guides/encrypted-secrets'
        ],
        rotationRequired: true,
        cwe: 'CWE-798: Use of Hard-coded Credentials'
    }
};

const SEVERITY_COLORS = {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280',
};

const SEVERITY_ICONS = {
    critical: '🔴',
    high: '🟠',
    medium: '🔵',
    low: '⚪',
};

export function getAlertTemplate(ruleId) {
    return ALERT_TEMPLATES[ruleId] || null;
}

export function enrichFindingWithAlert(finding) {
    if (!finding || typeof finding !== 'object') return finding;
    const ruleId = finding.pattern || (finding.id ? finding.id.split('-').slice(0, 3).join('-') : null);
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
    if (!t) return '';

    const color = SEVERITY_COLORS[t.severity] || '#6B7280';
    const icon = SEVERITY_ICONS[t.severity] || '⚪';
    const rotationBanner = t.rotationRequired
        ? `<div class="alert-rotation-banner" style="background:#FEE2E2;color:#991B1B;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-weight:600;">
             ⚠️ IMMEDIATE: Rotate exposed secrets before deploying.
           </div>`
        : '';
    const cweBadge = t.cwe
        ? `<span class="alert-cwe-badge" style="background:#E0E7FF;color:#3730A3;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">${t.cwe}</span>`
        : '';
    const steps = t.remediationSteps.map((s, i) => `<li>${s}</li>`).join('');
    const refs = t.references.map(r => `<a href="${r}" target="_blank" rel="noopener" style="color:#3B82F6;">${r}</a>`).join('<br>');

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
            ${refs ? `<div><strong style="font-size:0.875rem;">References:</strong><div style="margin-top:4px;font-size:0.75rem;">${refs}</div></div>` : ''}
        </div>
    `;
}

export function getAllAlertTemplates() {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return Object.entries(ALERT_TEMPLATES)
        .map(([ruleId, template]) => ({ ruleId, ...template }))
        .sort((a, b) => {
            const aOrder = severityOrder[a.severity] != null ? severityOrder[a.severity] : 4;
            const bOrder = severityOrder[b.severity] != null ? severityOrder[b.severity] : 4;
            return aOrder - bOrder;
        });
}

export function getAlertsBySeverity(severity) {
    return Object.entries(ALERT_TEMPLATES)
        .filter(([, t]) => t.severity === severity)
        .map(([ruleId, template]) => ({ ruleId, ...template }));
}

export { ALERT_TEMPLATES, SEVERITY_COLORS, SEVERITY_ICONS };
