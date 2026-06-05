/**
 * EU AI Act Readiness Sprint — gate scan + EU checklist + assessment artifacts.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const {
  runScan,
  evaluateGate,
  loadSimplebeaconConfig,
  initSimplebeacon,
  resolvePlatformRoot,
  formatJsonReport
} = require('../../packages/simplebeacon-cli/src/index');
const { evaluateComplianceChecklist } = require('../../packages/simplebeacon-cli/src/compliance-checklist');
const { buildAssessmentReport } = require('../../packages/simplebeacon-cli/src/assessment');

const ARTIFACT_NAMES = {
  report: 'eu-ai-act-report.json',
  compliance: 'eu-ai-act-compliance.json',
  assessment: 'eu-ai-act-assessment.json'
};

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

function countEuPatternHits(report) {
  const issues = report.rawIssues || report.detectedIssues || [];
  return issues.filter((item) => /eu ai act/i.test(String(item.type || ''))).length;
}

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
  const gateResult = evaluateGate(report, config.gate);
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
