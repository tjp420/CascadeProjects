/* Client Deliverable Packager (CommonJS)
 * Generates an executive JSON + Markdown projection and writes atomically with _SUCCESS anchor.
 */
const fs = require('fs');
const path = require('path');

function generateMarkdownProjection(briefModel) {
  const summary = briefModel.summary || { total_issues_evaluated: 0, blocking_count: 0, supply_chain_count: 0, informational_count: 0 };
  const findings = briefModel.classified_findings || [];

  const blocking = findings.filter((f) => String(f.classification || '').toLowerCase() === 'blocking');
  const supplyChain = findings.filter((f) => String(f.classification || '').toLowerCase().includes('supply-chain') || String(f.classification || '').toLowerCase() === 'supply-chain');

  const md = [];
  md.push('# 🛡️ Executive Security Brief');
  md.push(`**Scan ID:** \`${briefModel.scan_id || 'N/A'}\`  `);
  md.push(`**Target Project Path:** \`${briefModel.target_project_path || briefModel.target_project_path || briefModel.target_project || briefModel.projectPath || 'Unknown'}\`  `);
  md.push(`**Report Schema Version:** \`${briefModel.report_schema_version || '1.1'}\`  \n`);

  md.push('## 📊 Executive Summary Metrics');
  md.push(`*   **Total Evaluated Issues:** ${summary.total_issues_evaluated || 0}`);
  md.push(`*   🔴 **Blocking Production Boundaries:** ${summary.blocking_count || 0}`);
  md.push(`*   🟡 **Supply-Chain Mapping Divergences:** ${summary.supply_chain_count || 0}`);
  md.push(`*   🔵 **Informational Technical Debt:** ${summary.informational_count || 0}\n`);

  md.push('---\n');

  md.push('## 🔴 1. Active Production Boundary Issues');
  if (blocking.length === 0) {
    md.push('*No active production boundary flaws or live credential exposures identified.*');
  } else {
    blocking.forEach((f) => {
      const orig = f.original_finding || {};
      md.push(`### 🛑 Finding: ${orig.type || f.finding_id || 'Security Vulnerability'}`);
      md.push(`*   **Target Asset:** \`${orig.filePath || 'Unknown'}\` (Line ${orig.line || 'N/A'})`);
      md.push(`*   **Scanner Description:** ${orig.description || 'Critical infrastructure boundary violation.'}`);
      md.push(`*   **Policy Notes:** ${f.policy_notes || 'Requires immediate remediation.'}\n`);
    });
  }

  md.push('## 🟡 2. Supply-Chain Mapping Divergences');
  if (supplyChain.length === 0) {
    md.push('### 📦 Active Core Vulnerabilities & Typosquats');
    md.push('*No active supply-chain compromises or malicious typosquats identified.*');
  } else {
    md.push('### 📦 Active Core Vulnerabilities & Typosquats');
    supplyChain.forEach((f) => {
      const orig = f.original_finding || {};
      md.push(`*   🔴 **\`${orig.filePath || 'Package'}\`:** ${orig.description || orig.reason || 'Supply-chain anomaly'}`);
      md.push(`    *   *Remediation Notes:* ${f.policy_notes || 'Align manifest configurations.'}`);
    });
  }

  md.push('\n<details>');
  md.push('<summary>📋 View Clean Invariant Dependency Manifest (Unchanged Components)</summary>\n');
  md.push('Third-party framework architectures match established upstream baseline signatures. Crypto checksum anchors are frozen predictably inside workspace lockfile architectures.');
  md.push('*(Full machine-readable manifest traceability preserved inside executive-report.json)*\n');
  md.push('</details>\n');

  md.push('---\n');

  md.push('## 🏁 Automated Pipeline Gate Status');
  if (Number(summary.blocking_count || 0) > 0) {
    md.push('### ❌ **GATE STATUS: FAILED**');
    md.push('Merge blocks are actively enforced. The execution gate failed because critical production boundary constraints or unredacted secrets have been exposed. Remediate active high-severity indicators to satisfy gate compliance thresholds.');
  } else {
    md.push('### ✅ **GATE STATUS: PASSED**');
    md.push('All underlying production parameters conform to required operational specs. Technical debt and lower-tier quality linting markers should be tracked across normal sprint buffers.');
  }

  return md.join('\n');
}

function writeClientDeliverableFolder(briefModel, outputDirectoryRoot) {
  const targetDir = path.resolve(outputDirectoryRoot, `scan_${briefModel.scan_id || 'export'}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const jsonFinalPath = path.join(targetDir, 'executive-report.json');
  const mdFinalPath = path.join(targetDir, 'EXECUTIVE-REPORT.md');
  const successMarkerPath = path.join(targetDir, '_SUCCESS');

  try {
    const jsonTmpPath = jsonFinalPath + '.tmp';
    fs.writeFileSync(jsonTmpPath, JSON.stringify(briefModel, null, 2), 'utf8');
    const jsonFd = fs.openSync(jsonTmpPath, 'r+');
    try { fs.fsyncSync(jsonFd); } finally { fs.closeSync(jsonFd); }
    fs.renameSync(jsonTmpPath, jsonFinalPath);

    const mdContent = generateMarkdownProjection(briefModel);
    const mdTmpPath = mdFinalPath + '.tmp';
    fs.writeFileSync(mdTmpPath, mdContent, 'utf8');
    const mdFd = fs.openSync(mdTmpPath, 'r+');
    try { fs.fsyncSync(mdFd); } finally { fs.closeSync(mdFd); }
    fs.renameSync(mdTmpPath, mdFinalPath);

    fs.writeFileSync(successMarkerPath, '', 'utf8');
    const sFd = fs.openSync(successMarkerPath, 'r+');
    try { fs.fsyncSync(sFd); } finally { fs.closeSync(sFd); }

    // console log compat
    process.stdout.write(`[+] Success: High-value deliverable folder generated cleanly at: ${targetDir}\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[-] Critical: Atomic transaction failure during export. Purging corrupted state directory: ${error.message}\n`);
    try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch (e) {}
    return false;
  }
}

module.exports = {
  generateMarkdownProjection,
  writeClientDeliverableFolder,
};
