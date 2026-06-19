/**
 * EU AI Act Readiness Sprint — gate scan + EU checklist + assessment artifacts.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { buildAssessmentReport, evaluateComplianceChecklist, evaluateGate, formatJsonReport, initSimplebeacon, loadSimplebeaconConfig, resolvePlatformRoot, runScan } = require('./simplebeacon-proxy.cjs');


const ARTIFACT_NAMES = {
  report: 'eu-ai-act-report.json',
  compliance: 'eu-ai-act-compliance.json',
  assessment: 'eu-ai-act-assessment.json'
};

/**
 * Resolve scan root.
 * @param {string} inputPath
 * @param {any} platformRoot
 * @returns {any}
 */
function resolveScanRoot(inputPath, platformRoot) {
  const raw = String(inputPath || '').trim();
  if (!raw) {
    throw new Error('projectPath is required');
  }
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error('projectPath must be a directory');
  }
  return resolved;
}

/**
 * Count eu pattern hits.
 * @param {number} report
 * @returns {any}
 */
function countEuPatternHits(report) {
  const issues = report.rawIssues || report.detectedIssues || [];
  return issues.filter((item) => /eu ai act/i.test(String(item.type || ''))).length;
}

/**
 * Write json.
 * @param {string} filePath
 * @param {any} payload
 * @returns {any}
 */
async function writeJson(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * Run full EU AI Act sprint scan on a repo path (local folder on the dashboard machine).
 */
async function runEuAiActSprint(input = {}, options = {}) {
  const platformRoot = path.resolve(options.platformRoot || path.join(__dirname, '../..'));
  const scanRoot = resolveScanRoot(input.projectPath, platformRoot);
  const { platformRoot: detectedRoot } = resolvePlatformRoot(scanRoot);

  if (input.initProfile !== false) {
    initSimplebeacon(detectedRoot, {
      profile: 'eu-ai-act',
      force: input.forceInit === true
    });
  }

  const config = loadSimplebeaconConfig(detectedRoot);
  const report = await runScan(scanRoot, { config, configPath: config.configPath });

  // Compute core simplebeacon gate excluding file-reduction hygiene findings.
  // File-reduction issues (build artifacts, dead exports, unused deps) are
  // not security blockers and should not fail the EU AI Act gate.
/**
 * Core raw issues.
 * @param {number} report.rawIssues || []
 * @returns {any}
 */
  const coreRawIssues = (report.rawIssues || []).filter((issue) =>
    issue.metadata?.scanner !== 'file-reduction' &&
    issue.type !== 'File Reduction'
  );
  const coreReport = { ...report, rawIssues: coreRawIssues };
  const gateResult = evaluateGate(coreReport, config.gate);
  const formatted = formatJsonReport(report, gateResult);

  const simplebeaconDir = path.join(detectedRoot, '.simplebeacon');
  const reportPath = path.join(simplebeaconDir, ARTIFACT_NAMES.report);
  const compliancePath = path.join(simplebeaconDir, ARTIFACT_NAMES.compliance);
  const assessmentPath = path.join(simplebeaconDir, ARTIFACT_NAMES.assessment);

  await writeJson(reportPath, formatted);

  let npmAudit = null;
  try {
    const { runNpmAuditAsync } = require(path.join(detectedRoot, 'server/lib/npm-audit-runner'));

    npmAudit = await runNpmAuditAsync(scanRoot, { force: input.forceNpmAudit === true });
  } catch {
    npmAudit = null;
  }

  const complianceChecklist = evaluateComplianceChecklist(formatted, {
    projectRoot: scanRoot,
    npmAudit,
    checklistProfile: 'eu-ai-act'
  });
  await writeJson(compliancePath, complianceChecklist);

  const assessment = buildAssessmentReport(formatted, {
    company: input.company || path.basename(scanRoot),
    client: input.client || input.company || path.basename(scanRoot),
    assessor: input.assessor || 'SimpleBeacon Operator',
    projectRoot: scanRoot,
    gateResult,
    checklistProfile: 'eu-ai-act',
    npmAudit
  });
  await writeJson(assessmentPath, assessment);

  const workspaceDir = input.workspaceDir
    ? path.resolve(input.workspaceDir)
    : null;
  if (workspaceDir) {
    const exportsDir = path.join(workspaceDir, 'exports');
    await fsp.mkdir(exportsDir, { recursive: true });
    await fsp.copyFile(reportPath, path.join(workspaceDir, 'report.json'));
    await fsp.copyFile(compliancePath, path.join(workspaceDir, 'compliance.json'));
    await fsp.copyFile(assessmentPath, path.join(workspaceDir, 'assessment.json'));
  }

  const euHits = countEuPatternHits(formatted);
  const checklistSummary = complianceChecklist.summary || {};
/**
 * Failed rules.
 * @param {any} complianceChecklist.rules || []
 * @returns {any}
 */
  const failedRules = (complianceChecklist.rules || []).filter((rule) => rule.status === 'fail');

  return {
    ok: true,
    projectPath: scanRoot,
    platformRoot: detectedRoot,
    report: formatted,
    complianceChecklist,
    assessment,
    gate: {
      pass: gateResult.pass === true,
      blockingCount: gateResult.blockingCount ?? gateResult.blockingIssues?.length ?? null,
      warningCount: gateResult.warningCount ?? null
    },
    euPatternHits: euHits,
    compliance: {
      passed: checklistSummary.passed ?? null,
      failed: checklistSummary.failed ?? null,
      total: checklistSummary.total ?? null,
      score: checklistSummary.score ?? null,
      headline: checklistSummary.headline ?? null,
      failedRules
    },
    artifacts: {
      report: reportPath,
      compliance: compliancePath,
      assessment: assessmentPath
    },
    relativeArtifacts: {
      report: path.relative(detectedRoot, reportPath).replace(/\\/g, '/'),
      compliance: path.relative(detectedRoot, compliancePath).replace(/\\/g, '/'),
      assessment: path.relative(detectedRoot, assessmentPath).replace(/\\/g, '/')
    },
    disclaimer: 'Static technical readiness review — not legal conformity certification.'
  };
}

module.exports = {
  ARTIFACT_NAMES,
  runEuAiActSprint
};
