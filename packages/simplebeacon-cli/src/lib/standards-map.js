/**
 * Map SimpleBeacon rule IDs to CWE / OWASP Top 10 2021 / ASVS 4.0.
 * Used by JSON reports so findings are compliance-exportable.
 */

const DEFAULT = {
  cwe: "CWE-710",
  cweTitle: "Improper Adherence to Coding Standards",
  owasp: "A09:2021 – Security Logging and Monitoring Failures",
  asvs: "V14.1",
};

const BY_RULE = {
  "SB-SEC-001": {
    cwe: "CWE-94",
    cweTitle: "Improper Control of Generation of Code ('Code Injection')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.3",
  },
  "SB-SEC-002": {
    cwe: "CWE-79",
    cweTitle: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.3",
  },
  "SB-SEC-003": {
    cwe: "CWE-1321",
    cweTitle: "Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.1",
  },
  "SB-SEC-004": {
    cwe: "CWE-755",
    cweTitle: "Improper Handling of Exceptional Conditions",
    owasp: "A09:2021 – Security Logging and Monitoring Failures",
    asvs: "V7.1",
  },
  "SB-SEC-005": {
    cwe: "CWE-601",
    cweTitle: "URL Redirection to Untrusted Site ('Open Redirect')",
    owasp: "A01:2021 – Broken Access Control",
    asvs: "V5.1",
  },
  "SB-SEC-006": {
    cwe: "CWE-770",
    cweTitle: "Allocation of Resources Without Limits or Throttling",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V11.1",
  },
  "SB-SEC-007": {
    cwe: "CWE-338",
    cweTitle: "Use of Cryptographically Weak Pseudo-Random Number Generator (PRNG)",
    owasp: "A02:2021 – Cryptographic Failures",
    asvs: "V6.3",
  },
  "SB-SEC-008": {
    cwe: "CWE-532",
    cweTitle: "Insertion of Sensitive Information into Log File",
    owasp: "A09:2021 – Security Logging and Monitoring Failures",
    asvs: "V7.1",
  },
  "SB-SEC-009": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-010": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-011": {
    cwe: "CWE-327",
    cweTitle: "Use of a Broken or Risky Cryptographic Algorithm",
    owasp: "A02:2021 – Cryptographic Failures",
    asvs: "V6.2",
  },
  "SB-SEC-012": {
    cwe: "CWE-1333",
    cweTitle: "Inefficient Regular Expression Complexity",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V5.1",
  },
  "SB-SEC-013": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-014": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-015": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-016": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-017": {
    cwe: "CWE-250",
    cweTitle: "Execution with Unnecessary Privileges",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V1.14",
  },
  "SB-SEC-018": {
    cwe: "CWE-250",
    cweTitle: "Execution with Unnecessary Privileges",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V1.14",
  },
  "SB-SEC-019": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
  "SB-SEC-020": {
    cwe: "CWE-1078",
    cweTitle: "Inappropriate Source Code Style or Formatting",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V14.2",
  },
  "SB-SEC-021": {
    cwe: "CWE-1357",
    cweTitle: "Reliance on Insufficiently Trustworthy Component",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-SEC-022": {
    cwe: "CWE-506",
    cweTitle: "Embedded Malicious Code",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-SEC-023": {
    cwe: "CWE-1357",
    cweTitle: "Reliance on Insufficiently Trustworthy Component",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-SEC-024": {
    cwe: "CWE-269",
    cweTitle: "Improper Privilege Management",
    owasp: "A01:2021 – Broken Access Control",
    asvs: "V4.1",
  },
  "SB-SEC-025": {
    cwe: "CWE-269",
    cweTitle: "Improper Privilege Management",
    owasp: "A01:2021 – Broken Access Control",
    asvs: "V4.1",
  },
  "SB-SEC-026": {
    cwe: "CWE-78",
    cweTitle: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.3",
  },
  "SB-SEC-027": {
    cwe: "CWE-494",
    cweTitle: "Download of Code Without Integrity Check",
    owasp: "A08:2021 – Software and Data Integrity Failures",
    asvs: "V10.3",
  },
  "SB-SEC-028": {
    cwe: "CWE-78",
    cweTitle: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.3",
  },
  "SB-SEC-029": {
    cwe: "CWE-693",
    cweTitle: "Protection Mechanism Failure",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V14.4",
  },
  "SB-SEC-030": {
    cwe: "CWE-918",
    cweTitle: "Server-Side Request Forgery (SSRF)",
    owasp: "A10:2021 – Server-Side Request Forgery",
    asvs: "V12.6",
  },
  "SB-SEC-031": {
    cwe: "CWE-502",
    cweTitle: "Deserialization of Untrusted Data",
    owasp: "A08:2021 – Software and Data Integrity Failures",
    asvs: "V5.5",
  },
  "SB-SEC-032": {
    cwe: "CWE-89",
    cweTitle: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
    owasp: "A03:2021 – Injection",
    asvs: "V5.3",
  },
  "SB-SEC-033": {
    cwe: "CWE-862",
    cweTitle: "Missing Authorization",
    owasp: "A01:2021 – Broken Access Control",
    asvs: "V4.1",
  },
  "SB-SEC-034": {
    cwe: "CWE-614",
    cweTitle: "Sensitive Cookie in HTTPS Session Without 'Secure' Attribute",
    owasp: "A05:2021 – Security Misconfiguration",
    asvs: "V3.4",
  },
  "SB-SEC-035": {
    cwe: "CWE-1104",
    cweTitle: "Use of Unmaintained Third Party Components",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-SEC-036": {
    cwe: "CWE-1104",
    cweTitle: "Use of Unmaintained Third Party Components",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-SEC-037": {
    cwe: "CWE-693",
    cweTitle: "Protection Mechanism Failure",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V1.1",
  },
  "SB-SEC-038": {
    cwe: "CWE-347",
    cweTitle: "Improper Verification of Cryptographic Signature",
    owasp: "A02:2021 – Cryptographic Failures",
    asvs: "V6.2",
  },
  "SB-SEC-039": {
    cwe: "CWE-601",
    cweTitle: "URL Redirection to Untrusted Site ('Open Redirect')",
    owasp: "A01:2021 – Broken Access Control",
    asvs: "V5.1",
  },
  "SB-SEC-040": {
    cwe: "CWE-434",
    cweTitle: "Unrestricted Upload of File with Dangerous Type",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V12.5",
  },
  "SB-SEC-041": {
    cwe: "CWE-434",
    cweTitle: "Unrestricted Upload of File with Dangerous Type",
    owasp: "A03:2021 – Injection",
    asvs: "V12.5",
  },
  "SB-SEC-042": {
    cwe: "CWE-328",
    cweTitle: "Use of Weak Hash",
    owasp: "A02:2021 – Cryptographic Failures",
    asvs: "V2.4",
  },
  "SB-SEC-043": {
    cwe: "CWE-841",
    cweTitle: "Improper Enforcement of Behavioral Workflow",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V4.2",
  },
  "SB-SEC-044": {
    cwe: "CWE-295",
    cweTitle: "Improper Certificate Validation",
    owasp: "A02:2021 – Cryptographic Failures",
    asvs: "V9.2",
  },
  "SB-SEC-045": {
    cwe: "CWE-942",
    cweTitle: "Permissive Cross-domain Policy with Untrusted Domains",
    owasp: "A05:2021 – Security Misconfiguration",
    asvs: "V14.4",
  },
  "SB-QUAL-001": {
    cwe: "CWE-561",
    cweTitle: "Dead Code",
    owasp: "A04:2021 – Insecure Design",
    asvs: "V14.1",
  },
  "SB-CVE-001": {
    cwe: "CWE-1035",
    cweTitle: "Use of a Vulnerable Third-Party Component",
    owasp: "A06:2021 – Vulnerable and Outdated Components",
    asvs: "V14.2",
  },
  "SB-GITSEC-001": {
    cwe: "CWE-798",
    cweTitle: "Use of Hard-coded Credentials",
    owasp: "A07:2021 – Identification and Authentication Failures",
    asvs: "V2.10",
  },
};

const TYPE_FALLBACK = {
  "eval-danger": BY_RULE["SB-SEC-001"],
  "inner-html-xss": BY_RULE["SB-SEC-002"],
  "sql-injection": BY_RULE["SB-SEC-032"],
  "insecure-random": BY_RULE["SB-SEC-007"],
  "sensitive-data": BY_RULE["SB-SEC-008"],
  cleanup: BY_RULE["SB-QUAL-001"],
  "cve-vulnerability": BY_RULE["SB-CVE-001"],
  "git-history-secret": BY_RULE["SB-GITSEC-001"],
};

function ruleIdFromFinding(finding) {
  if (!finding || typeof finding !== "object") return null;
  if (finding.pattern) return String(finding.pattern);
  if (finding.patternId) return String(finding.patternId);
  if (finding.ruleId) return String(finding.ruleId);
  const id = String(finding.id || "");
  const m = id.match(/^(SB-[A-Z]+-\d+)/);
  return m ? m[1] : null;
}

function getStandardsForFinding(finding) {
  const ruleId = ruleIdFromFinding(finding);
  if (ruleId && BY_RULE[ruleId]) {
    return { ruleId, ...BY_RULE[ruleId] };
  }
  const type = String(finding?.type || "");
  if (TYPE_FALLBACK[type]) {
    return { ruleId: ruleId || type, ...TYPE_FALLBACK[type] };
  }
  return { ruleId: ruleId || null, ...DEFAULT };
}

module.exports = {
  BY_RULE,
  getStandardsForFinding,
  ruleIdFromFinding,
};
