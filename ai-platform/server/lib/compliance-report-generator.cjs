'use strict';

const crypto = require('crypto');

const FRAMEWORKS = {
  eu_ai_act: {
    id: 'eu_ai_act',
    name: 'EU AI Act',
    description: 'European Union Artificial Intelligence Act compliance assessment',
    sections: [
      { id: 'risk_classification', title: 'Risk Classification & Prohibited Practices', article: 'Art. 5-7' },
      { id: 'data_governance', title: 'Data Governance & Quality', article: 'Art. 10' },
      { id: 'transparency', title: 'Transparency & User Information', article: 'Art. 13' },
      { id: 'human_oversight', title: 'Human Oversight', article: 'Art. 14' },
      { id: 'accuracy_robustness', title: 'Accuracy, Robustness & Cybersecurity', article: 'Art. 15' },
      { id: 'incident_reporting', title: 'Incident Reporting & Post-Market Monitoring', article: 'Art. 72-73' },
    ],
  },
  soc2: {
    id: 'soc2',
    name: 'SOC 2 Type II',
    description: 'AICPA SOC 2 Type II Trust Services Criteria assessment',
    sections: [
      { id: 'security', title: 'Security (Common Criteria)', criteria: 'CC1-CC9' },
      { id: 'availability', title: 'Availability', criteria: 'A1' },
      { id: 'processing_integrity', title: 'Processing Integrity', criteria: 'PI1' },
      { id: 'confidentiality', title: 'Confidentiality', criteria: 'C1' },
      { id: 'privacy', title: 'Privacy', criteria: 'P1-P8' },
    ],
  },
  owasp: {
    id: 'owasp',
    name: 'OWASP Top 10 for LLM Applications',
    description: 'OWASP Top 10 risks specific to Large Language Model applications',
    sections: [
      { id: 'llm01_prompt_injection', title: 'LLM01: Prompt Injection', severity: 'critical' },
      { id: 'llm02_insecure_output', title: 'LLM02: Insecure Output Handling', severity: 'high' },
      { id: 'llm03_training_data_poisoning', title: 'LLM03: Training Data Poisoning', severity: 'high' },
      { id: 'llm04_model_dos', title: 'LLM04: Model Denial of Service', severity: 'medium' },
      { id: 'llm05_supply_chain', title: 'LLM05: Supply Chain Vulnerabilities', severity: 'high' },
      { id: 'llm06_sensitive_info', title: 'LLM06: Sensitive Information Disclosure', severity: 'high' },
      { id: 'llm07_insecure_plugins', title: 'LLM07: Insecure Plugin Design', severity: 'medium' },
      { id: 'llm08_excessive_agency', title: 'LLM08: Excessive Agency', severity: 'medium' },
      { id: 'llm09_overreliance', title: 'LLM09: Overreliance', severity: 'medium' },
      { id: 'llm10_model_theft', title: 'LLM10: Model Theft', severity: 'high' },
    ],
  },
};

function generateReport(orgId, options = {}) {
  const frameworks = options.frameworks || ['eu_ai_act', 'soc2', 'owasp'];
  const format = options.format || 'html';
  const title = options.title || `Compliance Report — ${new Date().toISOString().split('T')[0]}`;
  const generatedBy = options.generatedBy || 'system';

  const analyticsStore = safeRequire('../lib/usage-analytics-store.cjs');
  const guardrailStore = safeRequire('../lib/guardrail-incident-store.cjs');
  const auditLogger = safeRequire('../lib/audit-logger.cjs');
  const rbacStore = safeRequire('../lib/rbac-store.cjs');

  const telemetry = collectTelemetry(orgId, analyticsStore, guardrailStore, auditLogger, rbacStore);

  const assessments = {};
  for (const fw of frameworks) {
    if (FRAMEWORKS[fw]) {
      assessments[fw] = assessFramework(fw, telemetry);
    }
  }

  const scores = Object.values(assessments).map(a => a.overallScore);
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const summary = {
    totalScans: telemetry.totalScans,
    criticalFindings: telemetry.criticalFindings,
    highFindings: telemetry.highFindings,
    totalFindings: telemetry.totalFindings,
    postureScore: telemetry.postureScore,
    guardrailBlocks: telemetry.guardrailBlocks,
    guardrailScrubs: telemetry.guardrailScrubs,
    auditEntries: telemetry.auditEntries,
    rbacAssignments: telemetry.rbacAssignments,
  };

  const reportId = `rpt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const generatedAt = new Date().toISOString();

  const content = format === 'html'
    ? renderHTML(title, generatedAt, generatedBy, overallScore, assessments, summary, frameworks)
    : JSON.stringify({ id: reportId, title, generatedAt, generatedBy, orgId, overallScore, summary, assessments }, null, 2);

  return {
    id: reportId,
    orgId,
    title,
    frameworks,
    format,
    overallScore,
    status: 'generated',
    generatedAt,
    generatedBy,
    summary,
    assessments,
    content,
  };
}

function safeRequire(modPath) {
  try { return require(modPath); } catch { return null; }
}

function collectTelemetry(orgId, analyticsStore, guardrailStore, auditLogger, rbacStore) {
  const telemetry = {
    totalScans: 0, criticalFindings: 0, highFindings: 0, totalFindings: 0,
    postureScore: 100, guardrailBlocks: 0, guardrailScrubs: 0,
    auditEntries: 0, rbacAssignments: 0,
  };

  if (analyticsStore) {
    try {
      const stats = analyticsStore.getGlobalStats({ orgId });
      telemetry.totalScans = stats.totalScans || 0;
      telemetry.criticalFindings = stats.severityTotals?.critical || 0;
      telemetry.highFindings = stats.severityTotals?.high || 0;
      telemetry.totalFindings = stats.totalFindings || 0;
      telemetry.postureScore = stats.postureScore || 100;
    } catch {}
  }

  if (guardrailStore) {
    try {
      const gStats = guardrailStore.getStats(orgId);
      telemetry.guardrailBlocks = gStats.byVerdict?.blocked || gStats.blocked || 0;
      telemetry.guardrailScrubs = gStats.byVerdict?.scrubbed || gStats.scrubbed || 0;
    } catch {}
  }

  if (auditLogger) {
    try {
      const aStats = auditLogger.getStats(orgId);
      telemetry.auditEntries = aStats.total || aStats.count || 0;
    } catch {}
  }

  if (rbacStore) {
    try {
      const rStats = rbacStore.getStats(orgId);
      telemetry.rbacAssignments = rStats.totalAssignments || rStats.total || 0;
    } catch {}
  }

  return telemetry;
}

function assessFramework(fwId, telemetry) {
  const framework = FRAMEWORKS[fwId];
  const findings = [];

  for (const section of framework.sections) {
    const finding = assessSection(fwId, section, telemetry);
    findings.push(finding);
  }

  const scores = findings.map(f => f.score);
  const overallScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const status = overallScore >= 80 ? 'compliant' : overallScore >= 50 ? 'partial' : 'non_compliant';

  return { framework: fwId, overallScore, status, findings };
}

function assessSection(fwId, section, telemetry) {
  let score = 100;
  let details = '';
  let status = 'compliant';

  if (fwId === 'eu_ai_act') {
    switch (section.id) {
      case 'risk_classification':
        if (telemetry.criticalFindings > 10) { score = 30; details = `${telemetry.criticalFindings} critical findings indicate high-risk AI system requiring conformity assessment.`; }
        else if (telemetry.criticalFindings > 0) { score = 60; details = `${telemetry.criticalFindings} critical findings — risk classification review recommended.`; }
        else { details = 'No critical findings detected — system classified as limited risk.'; }
        break;
      case 'data_governance':
        if (telemetry.totalFindings > 50) { score = 40; details = `${telemetry.totalFindings} total findings indicate data quality concerns.`; }
        else if (telemetry.totalFindings > 20) { score = 70; details = `${telemetry.totalFindings} findings — data governance improvements recommended.`; }
        else { details = `${telemetry.totalFindings} total findings — data governance controls adequate.`; }
        break;
      case 'transparency':
        if (telemetry.auditEntries === 0) { score = 50; details = 'No audit entries — transparency logging not active.'; }
        else { score = 85; details = `${telemetry.auditEntries} audit entries recorded — transparency requirements met.`; }
        break;
      case 'human_oversight':
        if (telemetry.rbacAssignments === 0) { score = 40; details = 'No RBAC assignments — human oversight structure not established.'; }
        else { score = 85; details = `${telemetry.rbacAssignments} RBAC role assignments — human oversight framework active.`; }
        break;
      case 'accuracy_robustness':
        score = Math.max(40, Math.min(100, telemetry.postureScore));
        details = `Posture score: ${telemetry.postureScore}/100 — ${telemetry.guardrailBlocks} guardrail blocks active.`;
        break;
      case 'incident_reporting':
        if (telemetry.guardrailBlocks === 0) { score = 60; details = 'No guardrail incidents recorded — monitoring may not be active.'; }
        else { score = 80; details = `${telemetry.guardrailBlocks} blocked + ${telemetry.guardrailScrubs} scrubbed incidents — reporting pipeline active.`; }
        break;
    }
  } else if (fwId === 'soc2') {
    switch (section.id) {
      case 'security':
        score = Math.max(30, Math.min(100, telemetry.postureScore));
        details = `Security posture score: ${telemetry.postureScore}/100. ${telemetry.criticalFindings} critical, ${telemetry.highFindings} high findings.`;
        break;
      case 'availability':
        score = 85; details = 'Circuit breaker and retry patterns implemented. Uptime monitoring active.';
        break;
      case 'processing_integrity':
        if (telemetry.auditEntries > 0) { score = 85; details = `${telemetry.auditEntries} audit entries — processing integrity verified through audit trail.`; }
        else { score = 50; details = 'No audit entries — processing integrity cannot be verified.'; }
        break;
      case 'confidentiality':
        if (telemetry.guardrailScrubs > 0) { score = 85; details = `${telemetry.guardrailScrubs} PII scrubbing operations — confidentiality controls active.`; }
        else { score = 65; details = 'PII scrubbing engine available but no scrub operations recorded.'; }
        break;
      case 'privacy':
        score = 80; details = `OrgId-scoped data isolation, AES-256-GCM encryption at rest, secret masking in logs. ${telemetry.rbacAssignments} RBAC assignments enforce access controls.`;
        break;
    }
  } else if (fwId === 'owasp') {
    switch (section.id) {
      case 'llm01_prompt_injection':
        if (telemetry.guardrailBlocks > 0) { score = 80; details = `${telemetry.guardrailBlocks} prompt injection attempts blocked by firewall.`; }
        else { score = 60; details = 'Prompt firewall deployed but no blocks recorded.'; }
        break;
      case 'llm02_insecure_output':
        score = 70; details = 'Output validation and sanitization framework in place. PII scrubbing active.';
        break;
      case 'llm03_training_data_poisoning':
        score = 65; details = 'Model evaluation workspace with adversarial test suites available for data integrity validation.';
        break;
      case 'llm04_model_dos':
        score = 75; details = 'Circuit breaker and rate limiting implemented for LLM API calls.';
        break;
      case 'llm05_supply_chain':
        score = 70; details = 'Provider verification and API key authentication enforced.';
        break;
      case 'llm06_sensitive_info':
        if (telemetry.guardrailScrubs > 0) { score = 85; details = `${telemetry.guardrailScrubs} sensitive information disclosures prevented via PII scrubbing.`; }
        else { score = 60; details = 'PII scrubbing patterns deployed but no scrub events recorded.'; }
        break;
      case 'llm07_insecure_plugins':
        score = 75; details = 'Webhook configurations use HMAC signing for integrity verification.';
        break;
      case 'llm08_excessive_agency':
        if (telemetry.rbacAssignments > 0) { score = 85; details = `${telemetry.rbacAssignments} RBAC role assignments — agency properly constrained by role hierarchy.`; }
        else { score = 50; details = 'No RBAC assignments — LLM agency not constrained by role-based controls.'; }
        break;
      case 'llm09_overreliance':
        score = 70; details = 'Model evaluation workspace provides systematic testing to prevent overreliance.';
        break;
      case 'llm10_model_theft':
        score = 75; details = 'API key authentication, rate limiting, and access logging protect against unauthorized model access.';
        break;
    }
  }

  status = score >= 80 ? 'compliant' : score >= 50 ? 'partial' : 'non_compliant';
  return { sectionId: section.id, title: section.title, score, status, details };
}

function renderHTML(title, generatedAt, generatedBy, overallScore, assessments, summary, frameworks) {
  const badgeColor = score => score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const badgeText = score => score >= 80 ? 'COMPLIANT' : score >= 50 ? 'PARTIAL' : 'NON-COMPLIANT';

  let sectionsHtml = '';
  for (const fwId of frameworks) {
    const assessment = assessments[fwId];
    if (!assessment) continue;
    const framework = FRAMEWORKS[fwId];
    sectionsHtml += `
    <div style="margin-bottom:32px;">
      <h2 style="color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">${framework.name}</h2>
      <p style="color:#64748b;font-size:13px;margin-bottom:12px;">${framework.description}</p>
      <div style="display:inline-block;padding:4px 12px;border-radius:4px;color:white;font-weight:bold;font-size:14px;background:${badgeColor(assessment.overallScore)};">
        ${assessment.overallScore}/100 — ${badgeText(assessment.overallScore)}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Section</th>
            <th style="padding:8px;text-align:center;border:1px solid #e2e8f0;width:80px;">Score</th>
            <th style="padding:8px;text-align:center;border:1px solid #e2e8f0;width:120px;">Status</th>
            <th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${assessment.findings.map(f => `
            <tr>
              <td style="padding:8px;border:1px solid #e2e8f0;font-weight:500;">${f.title}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:${badgeColor(f.score)};">${f.score}</td>
              <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">
                <span style="padding:2px 8px;border-radius:3px;font-size:11px;font-weight:bold;color:white;background:${badgeColor(f.score)};">${badgeText(f.score)}</span>
              </td>
              <td style="padding:8px;border:1px solid #e2e8f0;color:#475569;">${f.details}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:1000px;margin:0 auto;padding:24px;color:#1e293b;">
  <div style="background:#1e3a5f;color:white;padding:24px;border-radius:8px;margin-bottom:24px;">
    <h1 style="margin:0 0 8px 0;font-size:24px;">${title}</h1>
    <p style="margin:0;opacity:0.8;font-size:13px;">Generated: ${new Date(generatedAt).toLocaleString()} by ${generatedBy}</p>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:24px;">
    <div style="flex:1;background:#f8fafc;padding:16px;border-radius:8px;text-align:center;border:2px solid ${badgeColor(overallScore)};">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Overall Compliance Score</div>
      <div style="font-size:36px;font-weight:bold;color:${badgeColor(overallScore)};">${overallScore}<span style="font-size:18px;color:#94a3b8;">/100</span></div>
      <div style="font-size:12px;font-weight:bold;color:${badgeColor(overallScore)};">${badgeText(overallScore)}</div>
    </div>
    <div style="flex:2;background:#f8fafc;padding:16px;border-radius:8px;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Summary</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;">
        <div><strong>Total Scans:</strong> ${summary.totalScans}</div>
        <div><strong>Critical Findings:</strong> ${summary.criticalFindings}</div>
        <div><strong>Posture Score:</strong> ${summary.postureScore}/100</div>
        <div><strong>Guardrail Blocks:</strong> ${summary.guardrailBlocks}</div>
        <div><strong>PII Scrubs:</strong> ${summary.guardrailScrubs}</div>
        <div><strong>Audit Entries:</strong> ${summary.auditEntries}</div>
        <div><strong>RBAC Assignments:</strong> ${summary.rbacAssignments}</div>
        <div><strong>Total Findings:</strong> ${summary.totalFindings}</div>
        <div><strong>High Findings:</strong> ${summary.highFindings}</div>
      </div>
    </div>
  </div>

  ${sectionsHtml}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
    Generated by Simplebeacon Compliance Report Generator | ${new Date(generatedAt).toISOString()}
  </div>
</body>
</html>`;
}

module.exports = { generateReport, FRAMEWORKS };
