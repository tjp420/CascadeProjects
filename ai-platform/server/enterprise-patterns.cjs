// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Enterprise DLP patterns for AI outbound traffic screening.
 */

const PRIVACY_PATTERNS = [
  {
    id: "ssn-full",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: "critical",
    category: "PII",
    regulation: "GDPR, HIPAA",
  },
  {
    id: "credit-card",
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    severity: "critical",
    category: "Financial",
    regulation: "PCI-DSS",
  },
  {
    id: "bank-account",
    regex: /\b(account\s*#?\s*[:=]\s*\d{8,})\b/gi,
    severity: "critical",
    category: "Financial",
    regulation: "PCI-DSS",
  },
  {
    id: "routing-number",
    regex: /\b(routing\s*#?\s*[:=]\s*\d{9})\b/gi,
    severity: "critical",
    category: "Financial",
    regulation: "PCI-DSS",
  },
  {
    id: "medical-record",
    regex: /\b(MRN|Patient ID|Medical Record|Patient Name)\s*[:=]\s*\w+/gi,
    severity: "critical",
    category: "Healthcare",
    regulation: "HIPAA",
  },
  {
    id: "diagnosis-code",
    regex: /\b(ICD-?\d+|CPT-\d+|HCPCS)\b/g,
    severity: "high",
    category: "Healthcare",
    regulation: "HIPAA",
  },
  {
    id: "email-address",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    severity: "high",
    category: "PII",
    regulation: "GDPR, CCPA",
  },
  {
    id: "phone-number",
    regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    severity: "medium",
    category: "PII",
    regulation: "GDPR, CCPA",
  },
  {
    id: "internal-api-key",
    regex:
      /\b(internal|private|secret|confidential)[-_]?(api|access|auth)[-_]?key\b/gi,
    severity: "high",
    category: "Corporate",
    regulation: "Internal Policy",
  },
  {
    id: "confidential-marker",
    regex:
      /\b(confidential|internal use only|do not share|proprietary|restricted)\b/gi,
    severity: "medium",
    category: "Corporate",
    regulation: "Internal Policy",
  },
  {
    id: "internal-domain",
    regex: /\b[a-z0-9.-]+\.internal\b/gi,
    severity: "medium",
    category: "Corporate",
    regulation: "Internal Policy",
  },
  {
    id: "internal-url",
    regex: /\bhttps?:\/\/[a-z0-9.-]+\.internal\b/gi,
    severity: "medium",
    category: "Corporate",
    regulation: "Internal Policy",
  },
];

/**
 * Scan enterprise patterns.
 * @param {string} text
 * @param {string} context
 * @returns {any}
 */
function scanEnterprisePatterns(text, context = {}) {
  const findings = [];

  for (const pattern of PRIVACY_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;

    while ((match = pattern.regex.exec(text)) !== null) {
      findings.push({
        id: `${pattern.id}-${match.index}`,
        severity: pattern.severity,
        severityBand:
          pattern.severity === "critical" ? "critical" : pattern.severity,
        pattern: pattern.id,
        category: pattern.category,
        regulation: pattern.regulation,
        match: match[0],
        index: match.index,
        description: `Possible ${pattern.id.replace(/-/g, " ")} in outbound AI request`,
        recommendation:
          "Remove sensitive data before sending prompts to external AI services",
        context,
      });
    }
  }

  return findings;
}

/**
 * Get regulatory summary.
 * @param {Array} findings
 * @returns {any}
 */
function getRegulatorySummary(findings) {
  const regulations = {};

  for (const finding of findings) {
    if (!finding.regulation) continue;
    for (const reg of finding.regulation.split(", ")) {
      regulations[reg] = (regulations[reg] || 0) + 1;
    }
  }

  return regulations;
}

/**
 * Is blocking finding.
 * @param {any} finding
 * @returns {any}
 */
function isBlockingFinding(finding) {
  return (
    finding.severityBand === "critical" ||
    finding.severity === "critical" ||
    finding.severity === "high"
  );
}

module.exports = {
  PRIVACY_PATTERNS,
  scanEnterprisePatterns,
  getRegulatorySummary,
  isBlockingFinding,
};
