/**
 * ComplianceMapper — Maps audit issue types and patterns to regulatory frameworks.
 * Provides OWASP Top 10, EU AI Act, and NIST CSF mappings for executive-ready compliance reporting.
 */

export const FRAMEWORK_COLORS = {
  owasp: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)', text: '#ef4444', label: 'OWASP' },
  eu_ai_act: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6', label: 'EU AI Act' },
  nist: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b', label: 'NIST' }
};

export const COMPLIANCE_MAPPINGS = {
  // Credentials & Secrets
  credentials: [
    { framework: 'owasp', clause: 'A02:2021', name: 'Cryptographic Failures', desc: 'Hardcoded secrets violate credential storage best practices' },
    { framework: 'nist', clause: 'PR.AC-1', name: 'Access Control', desc: 'Identities and credentials are managed for authorized devices' }
  ],
  'production-leaks': [
    { framework: 'owasp', clause: 'A01:2021', name: 'Broken Access Control', desc: 'Sensitive data exposed in non-production contexts' },
    { framework: 'eu_ai_act', clause: 'Art. 15', name: 'Robustness & Cybersecurity', desc: 'AI systems must be resilient against unauthorized access' }
  ],
  'fiction-kpis': [
    { framework: 'eu_ai_act', clause: 'Art. 10', name: 'Data Governance', desc: 'Training data must be accurate and free from fabricated metrics' },
    { framework: 'nist', clause: 'PR.IP-6', name: 'Data Integrity', desc: 'Data is protected from unauthorized modification' }
  ],
  schema: [
    { framework: 'nist', clause: 'PR.DS-2', name: 'Data Protection', desc: 'Data-in-transit is protected through integrity controls' }
  ],
  roadmap: [
    { framework: 'nist', clause: 'RS.AN-1', name: 'Incident Analysis', desc: 'Notifications from detection systems are analyzed' }
  ],
  // npm audit / dependency vulnerabilities
  'dependency-vulns': [
    { framework: 'owasp', clause: 'A06:2021', name: 'Vulnerable Components', desc: 'Using components with known vulnerabilities' },
    { framework: 'nist', clause: 'ID.RA-1', name: 'Risk Assessment', desc: 'Asset vulnerabilities are identified and documented' }
  ],
  'sensitive-data': [
    { framework: 'owasp', clause: 'A03:2021', name: 'Injection', desc: 'PII exposure through unsanitized data handling' },
    { framework: 'eu_ai_act', clause: 'Art. 10(3)', name: 'Sensitive Data', desc: 'Special categories of personal data require heightened protections' }
  ],
  'security-headers': [
    { framework: 'owasp', clause: 'A05:2021', name: 'Security Misconfiguration', desc: 'Missing security headers indicate misconfiguration' }
  ],
  'config-drift': [
    { framework: 'owasp', clause: 'A05:2021', name: 'Security Misconfiguration', desc: 'Environment configuration drift creates attack surface' },
    { framework: 'nist', clause: 'PR.MA-1', name: 'Maintenance', desc: 'Maintenance and repair of organizational assets is performed' }
  ],
  'eval-danger': [
    { framework: 'owasp', clause: 'A03:2021', name: 'Injection', desc: 'Dynamic code execution enables code injection attacks' }
  ],
  'inner-html-xss': [
    { framework: 'owasp', clause: 'A03:2021', name: 'Injection', desc: 'Unsanitized innerHTML is a direct XSS vector' }
  ],
  'prototype-pollution': [
    { framework: 'owasp', clause: 'A08:2021', name: 'Software Integrity', desc: 'Prototype pollution undermines data integrity' }
  ],
  'unvalidated-redirect': [
    { framework: 'owasp', clause: 'A01:2021', name: 'Broken Access Control', desc: 'Open redirects enable phishing and malicious routing' }
  ],
  'missing-rate-limit': [
    { framework: 'owasp', clause: 'A07:2021', name: 'Authentication Failures', desc: 'Missing rate limits enable brute-force attacks' },
    { framework: 'nist', clause: 'PR.AC-5', name: 'Network Integrity', desc: 'Network integrity is protected' }
  ],
  'insecure-random': [
    { framework: 'owasp', clause: 'A02:2021', name: 'Cryptographic Failures', desc: 'Math.random() is not cryptographically secure' }
  ],
  'logging-secrets': [
    { framework: 'owasp', clause: 'A09:2021', name: 'Logging Failures', desc: 'Secrets in logs defeat audit and monitoring controls' },
    { framework: 'nist', clause: 'PR.PT-1', name: 'Audit Logging', desc: 'Audit logs capture user and system events' }
  ],
  // AI & LLM specific
  'ai-indicators': [
    { framework: 'eu_ai_act', clause: 'Art. 52', name: 'Transparency', desc: 'AI systems must disclose their artificial nature' }
  ],
  'ai-residue': [
    { framework: 'eu_ai_act', clause: 'Art. 10(5)', name: 'Data Quality', desc: 'Incomplete or erroneous data degrades AI output quality' }
  ],
  'llm-slop': [
    { framework: 'eu_ai_act', clause: 'Art. 15', name: 'Accuracy', desc: 'AI outputs must be factually accurate and verifiable' }
  ],
  'token-bleed': [
    { framework: 'owasp', clause: 'A01:2021', name: 'Broken Access Control', desc: 'Unbounded API calls may leak tokens or exceed quotas' }
  ],
  'ai-placeholder-comment': [
    { framework: 'eu_ai_act', clause: 'Art. 52(3)', name: 'Documentation', desc: 'AI-generated content must be clearly documented' }
  ],
  'markdown-fence-leak': [
    { framework: 'eu_ai_act', clause: 'Art. 15', name: 'Robustness', desc: 'Content leakage indicates insufficient output filtering' }
  ],
  'fiction-kpi': [
    { framework: 'eu_ai_act', clause: 'Art. 10', name: 'Data Governance', desc: 'Fabricated metrics undermine training data integrity' }
  ],
  // Code Quality
  'test-coverage': [
    { framework: 'nist', clause: 'PR.IP-1', name: 'Testing', desc: 'Testing procedures validate security functionality' }
  ],
  'unhandled-promise': [
    { framework: 'owasp', clause: 'A11:2021', name: 'Business Logic', desc: 'Unhandled errors may expose sensitive state' }
  ],
  // Default catch-all
  default: []
};

/**
 * Get compliance mappings for an issue type / layer key.
 * @param {string} issueType — e.g. 'credentials', 'dependency-vulns', 'ai-residue'
 * @returns {Array} Array of {framework, clause, name, desc} objects
 */
export function getComplianceMappings(issueType) {
  if (!issueType) return [];
  const key = String(issueType).toLowerCase().replace(/[\s_-]+/g, '-');
  return COMPLIANCE_MAPPINGS[key] || COMPLIANCE_MAPPINGS.default || [];
}

/**
 * Render compliance badges as HTML string for inline injection.
 * @param {string} issueType
 * @returns {string} HTML string of badge spans
 */
export function renderComplianceBadges(issueType) {
  const mappings = getComplianceMappings(issueType);
  if (!mappings.length) return '';

  return mappings.map((m) => {
    const style = FRAMEWORK_COLORS[m.framework];
    return `<span class="cm-badge" style="background:${style.bg};border:1px solid ${style.border};color:${style.text};padding:2px 8px;border-radius:6px;font-size:0.68rem;font-weight:700;white-space:nowrap;" title="${escapeHtml(m.name)}: ${escapeHtml(m.desc)}">${escapeHtml(style.label)} ${escapeHtml(m.clause)}</span>`;
  }).join('');
}

/**
 * Render a compact compliance summary block for a layer card.
 * @param {string} issueType
 * @returns {string} HTML string
 */
export function renderComplianceSummary(issueType) {
  const mappings = getComplianceMappings(issueType);
  if (!mappings.length) return '';

  const unique = [...new Map(mappings.map((m) => [m.framework, m])).values()];
  return unique.map((m) => {
    const style = FRAMEWORK_COLORS[m.framework];
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${style.bg};border:1px solid ${style.border};color:${style.text};padding:3px 10px;border-radius:8px;font-size:0.72rem;font-weight:700;">${escapeHtml(style.label)}</span>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
