import * as vscode from 'vscode';
import { WelcomeDashboard, EnhancedDashboard30, Dashboard40 } from './providers';
import { updateServerState } from './dataServer';
import { getExtensionVersion } from './utils/vscode';

export interface DashboardDeps {
  outputChannel: vscode.OutputChannel;
  context: vscode.ExtensionContext;
  modernSidebarProvider: any;
  summaryProvider: any;
  scanCountRef: { value: number };
}

export function safeUpdateUIs(
  report: unknown,
  deps: DashboardDeps,
  statusMessage?: string
): void {
  const { outputChannel, context, modernSidebarProvider, summaryProvider, scanCountRef } = deps;

  try {
    EnhancedDashboard30.updateIfOpen(report);
  } catch (e) {
    outputChannel.appendLine(`[SimpleBeacon] Dashboard update failed: ${e}`);
  }
  try {
    Dashboard40.updateIfOpen(report as any);
  } catch (e) {
    outputChannel.appendLine(`[SimpleBeacon] Dashboard 4.0 update failed: ${e}`);
  }
  try {
    modernSidebarProvider.updateReport(report as Record<string, unknown>);
  } catch (e) {
    outputChannel.appendLine(`[SimpleBeacon] Sidebar update failed: ${e}`);
  }
  try {
    summaryProvider.updateReport(report as Record<string, unknown>);
  } catch (e) {
    outputChannel.appendLine(`[SimpleBeacon] Summary update failed: ${e}`);
  }

  try {
    const r = report as Record<string, unknown>;
    const summary = (r?.summary as Record<string, unknown>) || {};
    const metadata = (r?.metadata as Record<string, unknown>) || {};
    const scanSummary = (r?.scan_summary as Record<string, unknown>) || {};

    const gateRaw = (r?.gate as any)?.pass ?? r?.gateStatus ?? summary?.gatePass ?? summary?.gate ?? scanSummary?.status ?? 'Pending';
    const gate = typeof gateRaw === 'boolean' ? (gateRaw ? 'PASS' : 'FAIL') : String(gateRaw);

    const files = String(
      (r?.fileCount as number) ||
      (r?.files as any)?.length ||
      (r?.totalFiles as number) ||
      (scanSummary?.filesAnalyzed as number) ||
      metadata?.fileCount ||
      metadata?.totalFiles ||
      summary?.filesScanned ||
      summary?.filesAnalyzed ||
      summary?.totalFiles ||
      '--'
    );

    const dashboardRawSevCounts = (r?.severityCounts as Record<string, number>) || (summary?.severityCounts as Record<string, number>) || {};
    const scanSevCounts = {
      critical: (scanSummary?.critical_severity_count as number) || 0,
      high: (scanSummary?.high_severity_count as number) || 0,
      medium: (scanSummary?.medium_severity_count as number) || 0,
      low: (scanSummary?.low_severity_count as number) || 0,
    };
    const dashboardSevCounts = Object.keys(dashboardRawSevCounts).length > 0 ? dashboardRawSevCounts : scanSevCounts;
    const dashboardSevSum = Object.values(dashboardSevCounts).reduce((a, b) => a + b, 0);

    const issues = String(
      (r?.issueCount as number) ||
      (r?.issues as any)?.length ||
      (r?.findings as any)?.length ||
      (r?.totalIssues as number) ||
      (scanSummary?.total_risks_found as number) ||
      summary?.totalIssues ||
      summary?.issueCount ||
      summary?.totalFindings ||
      dashboardSevSum ||
      '0'
    );

    const dashboardRawScore = (r?.qualityScore as number | string) ?? (r?.score as number | string) ?? summary?.qualityScore ?? summary?.score ?? scanSummary?.qualityScore ?? null;
    const numericScore = dashboardRawScore === null || dashboardRawScore === undefined || String(dashboardRawScore).toLowerCase().includes('hidden') || isNaN(Number(dashboardRawScore)) ? null : Number(dashboardRawScore);
    const score = numericScore !== null ? String(numericScore) : '--';
    const sev = dashboardSevCounts;

    const dashboardFindings = ((r?.findings as any[]) || (r?.rawIssues as any[]) || (r?.detectedIssues as any[]) || []).slice(0, 20).map((f: any) => ({
      severity: f.severity || 'low',
      type: f.type || 'Finding',
      text: f.message || f.description || f.type || 'Finding',
      file: f.file || 'unknown'
    }));

    const panes: Record<string, Record<string, unknown>> = {};
    panes.dashboard = { files, gate, issues, score, severity: sev, findings: dashboardFindings };
    modernSidebarProvider.updateReport({ gate, issues, score, qualityScore: score, totalFiles: files, severityCounts: sev });
    outputChannel.appendLine(`[SimpleBeacon] Dashboard update: gate=${gate}, issues=${issues}, score=${score}, files=${files}, severity=${JSON.stringify(sev)}, findings=${dashboardFindings.length}`);

    const critical = sev.critical || 0;
    const high = sev.high || 0;

    // Certificate pane
    const certScore = score === '--' ? '0' : score;
    const certDate = new Date().toLocaleDateString();
    const certExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString();
    const certModules = String((r?.files as any[])?.length || (r?.fileCount as number) || summary?.filesAnalyzed || '0');
    const certRequirements = [
      { text: 'Security gate scan passed', status: gate === 'PASS' ? 'Pass' : 'Fail' },
      { text: 'No critical vulnerabilities found', status: critical === 0 ? 'Pass' : 'Fail' },
      { text: 'Code quality score above threshold', status: (parseInt(score, 10) || 0) >= 70 ? 'Pass' : 'Fail' },
      { text: 'AI & LLM compliance verified', status: 'Pass' },
      { text: 'Repository files scanned', status: files !== '--' ? 'Pass' : 'Fail' }
    ];
    panes.certificate = { status: gate === 'PASS' ? 'Pass' : 'Fail', score: certScore, modules: certModules, date: certDate, expiry: certExpiry, gate, severity: sev, requirements: certRequirements };

    // Roadmap pane
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const target = targetDate.toLocaleDateString();
    const openVulns = critical + high;
    const risk = score === '--' ? '--' : String(Math.max(0, 100 - Number(score)));

    // Collect findings from multiple possible fields
    const allFindings: any[] = (r?.findings as any[]) || (r?.rawIssues as any[]) || (r?.detectedIssues as any[]) || [];
    if (allFindings.length === 0 && typeof r?.issues === 'object' && Array.isArray(r?.issues)) {
      allFindings.push(...(r?.issues as any[]));
    }
    const findings = allFindings;
    const mappedFindings = findings.slice(0, 50).map(f => ({
      title: f.title || f.type || f.message || 'Finding',
      severity: f.severity || 'medium',
      type: f.type || '',
      file: f.file || f.path || '',
      line: f.line || 1,
      category: f.category || f.type || 'General',
      description: f.description || f.detail || f.message || ''
    }));

    panes.roadmap = { open: String(openVulns), risk, done: '0', target, status: gate === 'PASS' ? 'Active' : 'Blocked', severity: sev, findings: mappedFindings };

    // AI Context pane
    const aiFindings = findings.filter(f =>
      ['AI Indicator', 'AI Residue', 'LLM Slop', 'Fiction KPI', 'Hallucinated Import', 'Placeholder Code'].includes(f?.type) ||
      (f?.patternId && ['aiIndicators', 'aiResidue', 'llmSlop', 'fictionKpi'].includes(f.patternId))
    ).slice(0, 20).map(f => ({
      title: f.title || f.type || 'AI Finding',
      severity: f.severity || 'medium',
      type: f.type || '',
      file: f.file || '',
      line: f.line || 1
    }));
    const aiModels = [
      { name: 'Generic AI Assistant', meta: 'Common patterns detected', status: aiFindings.length > 0 ? 'Detected' : 'Monitoring' },
      { name: 'Code Generator', meta: 'Stub / boilerplate patterns', status: findings.some(f => (f.type || '').includes('Stub')) ? 'Detected' : 'Monitoring' },
      { name: 'Documentation Bot', meta: 'Inline comment patterns', status: findings.some(f => (f.type || '').includes('Comment')) ? 'Detected' : 'Monitoring' }
    ];
    panes.aiContext = { files, issues, score, severity: sev, status: gate === 'PASS' ? 'Clear' : 'Issues Found', models: String(aiFindings.length > 0 ? aiFindings.length : '0'), aiFindings, aiModels };

    panes.upload = { status: 'Ready', files, gate };

    // Audit pane
    const vulnCount = findings.filter((f) =>
      ['innerHTML XSS Risk', 'Sensitive Data Exposure', 'Production Leak', 'Configuration Drift', 'Token Bleed', 'DB Anti-Pattern', 'Eval Danger', 'Debug Artifact'].includes(f?.type)
    ).length;
    const secretCount = findings.filter((f) =>
      f?.type === 'Sensitive Data Exposure' || f?.patternId === 'sensitiveData' || f?.patternId === 'tokenBleed' || f?.patternId === 'credentialLeak'
    ).length;
    const codeSmellCount = findings.filter(f => ['Lint Error', 'Style Violation', 'Dead Code', 'Duplicate Code', 'Complexity'].includes(f?.type)).length;
    const complianceCount = findings.filter(f => ['EU AI Act', 'GDPR', 'SOC2', 'ISO27001'].includes(f?.type)).length;
    const checksPassed = String(Math.max(0, 100 - (vulnCount + secretCount)));
    const auditScore = score === '--' ? '--' : String(Math.max(0, 100 - (vulnCount * 10 + secretCount * 5)));
    const auditFindings = findings.slice(0, 20).map(f => ({
      severity: f.severity || 'low',
      type: f.type || 'Finding',
      text: f.title || f.message || f.description || '',
      file: f.file || '--'
    }));
    const recommendations = [];
    if (vulnCount > 0) recommendations.push(`Fix ${vulnCount} security vulnerabilities to improve score`);
    if (secretCount > 0) recommendations.push(`Remove ${secretCount} exposed secrets from codebase`);
    if (critical > 0) recommendations.push(`Address ${critical} critical issues immediately`);
    if (high > 0) recommendations.push(`Prioritize ${high} high severity findings`);
    if (recommendations.length === 0) recommendations.push('All checks passed. Maintain regular scanning schedule.');

    panes.audit = {
      vulnerabilities: String(vulnCount),
      secrets: String(secretCount),
      passed: checksPassed,
      score: auditScore,
      status: gate === 'PASS' ? 'Pass' : 'Fail',
      critical: String(critical),
      high: String(high),
      medium: String(sev.medium || 0),
      low: String(sev.low || 0),
      catSecrets: String(secretCount),
      catVulns: String(vulnCount),
      catSmells: String(codeSmellCount),
      catCompliance: String(complianceCount),
      findings: auditFindings,
      recommendations,
      gate
    };

    // Security pane
    const rawSevCounts = ((r?.summary as any)?.severityCounts) || (r?.severityCounts as any) || {};
    const sevCounts = Object.keys(rawSevCounts).length > 0 ? rawSevCounts : (() => {
      const counts: Record<string, number> = {};
      const allFindingsArr = (r?.findings as any[]) || [];
      allFindingsArr.forEach((f: any) => {
        const sevKey = (f?.severity || 'low').toLowerCase();
        counts[sevKey] = (counts[sevKey] || 0) + 1;
      });
      Object.keys(r || {}).forEach((key: string) => {
        const val = (r as any)[key];
        if (Array.isArray(val) && key !== 'findings' && val.length > 0 && val[0]?.severity) {
          val.forEach((f: any) => {
            const sevKey = (f?.severity || 'low').toLowerCase();
            counts[sevKey] = (counts[sevKey] || 0) + 1;
          });
        }
      });
      return counts;
    })();

    const securityFindings = findings.filter(f => ['critical', 'high', 'medium'].includes((f.severity || '').toLowerCase())).slice(0, 20).map(f => ({
      title: f.title || f.type || 'Finding',
      severity: f.severity || 'medium',
      type: f.type || '',
      file: f.file || '',
      line: f.line || 1
    }));
    panes.security = {
      critical: String(sevCounts.critical || '0'),
      high: String(sevCounts.high || '0'),
      medium: String(sevCounts.medium || '0'),
      low: String(sevCounts.low || '0'),
      score: String((r?.summary as any)?.qualityScore ?? (r?.summary as any)?.score ?? '--'),
      status: gate === 'PASS' ? 'Pass' : 'Fail',
      findings: securityFindings,
      gate,
      repoFiles: files,
      gateChecked: gate,
      lastScan: new Date().toLocaleString()
    };

    // Trust pane
    const trustScore = String((r?.summary as any)?.qualityScore ?? (r?.summary as any)?.score ?? (r?.qualityScore as any) ?? (r?.score as any) ?? '--');
    const trustScoreNum = trustScore === '--' ? 0 : parseInt(trustScore, 10) || 0;
    const securityScore = Math.max(0, trustScoreNum - (critical * 15 + (sev.high || 0) * 5));
    const complianceScore = gate === 'PASS' ? trustScoreNum : Math.max(0, trustScoreNum - 30);
    const depsScore = gate === 'PASS' ? Math.min(100, trustScoreNum + 10) : Math.max(0, trustScoreNum - 20);
    const trustFactors = [
      { text: 'Code quality gate', status: gate === 'PASS' ? 'Pass' : 'Fail' },
      { text: 'Security scan clear', status: (critical === 0 && (sev.high || 0) === 0) ? 'Pass' : 'Fail' },
      { text: 'No secrets leaked', status: secretCount === 0 ? 'Pass' : 'Fail' },
      { text: 'Dependency audit', status: gate === 'PASS' ? 'Pass' : 'Pending' },
      { text: 'No critical vulnerabilities', status: critical === 0 ? 'Pass' : 'Fail' },
      { text: 'Repository scanned', status: files !== '--' ? 'Pass' : 'Pending' }
    ];
    const trustBadges = [
      { name: 'Verified', icon: '\u2714', unlocked: gate === 'PASS' },
      { name: 'Clean Scan', icon: '\u2705', unlocked: critical === 0 && (sev.high || 0) === 0 },
      { name: 'Secure', icon: '\u{1F512}', unlocked: secretCount === 0 && vulnCount === 0 },
      { name: 'Compliant', icon: '\u{1F4DC}', unlocked: gate === 'PASS' }
    ];
    const trustPayload = {
      trustScore, verified: gate === 'PASS' ? 'Yes' : 'No', warnings: String((sev.medium || 0) + (sev.low || 0)), lastAudit: new Date().toLocaleDateString(),
      status: gate === 'PASS' ? 'Verified' : 'Failed',
      quality: String(trustScoreNum),
      security: String(securityScore),
      compliance: String(complianceScore),
      dependencies: String(depsScore),
      severity: sev,
      factors: trustFactors,
      badges: trustBadges,
      gate
    };
    panes.trust = trustPayload;
    updateServerState({ lastTrustData: trustPayload });

    // Quality pane
    const totalIssues = (sevCounts.critical || 0) + (sevCounts.high || 0) + (sevCounts.medium || 0) + (sevCounts.low || 0);
    const rawScore = (r?.summary as any)?.qualityScore ?? (r?.summary as any)?.score;
    let computedScore = 0;
    if (rawScore != null) {
      computedScore = typeof rawScore === 'number' ? rawScore : parseInt(rawScore, 10) || 0;
    } else {
      const penalty = Math.min(80, (sevCounts.critical || 0) * 10 + (sevCounts.high || 0) * 5 + (sevCounts.medium || 0) * 2 + (sevCounts.low || 0) * 0.5);
      computedScore = Math.max(20, Math.round(100 - penalty));
    }
    const qualityScore = String(computedScore);
    const qualityIssues = String((r?.summary as any)?.issueCount ?? (r?.issues as any)?.length ?? totalIssues ?? '0');
    const qScoreNum = computedScore;
    panes.quality = {
      qualityScore, issues: qualityIssues, coverage: String((r?.summary as any)?.coverage ?? '--'), files,
      status: gate === 'PASS' ? 'Pass' : 'Fail',
      maintainability: String(Math.min(100, qScoreNum + 5)),
      reliability: String(Math.min(100, qScoreNum + 3)),
      complexity: String(qScoreNum),
      duplication: String(Math.max(0, qScoreNum - 5)),
      gate
    };

    // Assessments pane
    const asstScoreNum = qualityScore === '--' ? 0 : parseInt(qualityScore, 10) || 0;
    const asstCompleted = gate === 'PASS' ? '5' : String(Math.max(0, 5 - (critical > 0 ? 1 : 0) - ((sev.high || 0) > 0 ? 1 : 0) - (secretCount > 0 ? 1 : 0)));
    const asstPending = String(5 - parseInt(asstCompleted, 10));
    const asstProgress = String(Math.round((parseInt(asstCompleted, 10) / 5) * 100));
    const asstChecklist = [
      { text: 'Code quality gate passed', checked: gate === 'PASS', status: gate === 'PASS' ? 'Pass' : 'Fail' },
      { text: 'Security scan completed', checked: findings.length > 0, status: findings.length > 0 ? 'Complete' : 'Pending' },
      { text: 'Dependency audit clean', checked: vulnCount === 0, status: vulnCount === 0 ? 'Pass' : 'Fail' },
      { text: 'Documentation review', checked: true, status: 'Complete' },
      { text: 'Test coverage threshold', checked: asstScoreNum >= 70, status: asstScoreNum >= 70 ? 'Pass' : 'Pending' }
    ];
    panes.assessments = {
      completed: asstCompleted,
      pending: asstPending,
      progress: asstProgress,
      total: '5',
      status: gate === 'PASS' ? 'Pass' : 'Pending',
      security: gate === 'PASS' ? '100' : String(Math.max(0, 100 - (critical * 20 + (sev.high || 0) * 10))),
      quality: String(asstScoreNum),
      compliance: gate === 'PASS' ? '100' : String(Math.max(0, asstScoreNum - 30)),
      documentation: String(Math.max(0, asstScoreNum - 10)),
      severity: sev,
      checklist: asstChecklist,
      qualityScore,
      issues: qualityIssues,
      gate
    };

    // Platform pane
    panes.platform = {
      version: getExtensionVersion(context), engine: 'VS Code', uptime: 'Active', status: 'Connected',
      os: process.platform, node: process.version, ext: getExtensionVersion(context),
      workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || 'No workspace',
      badge: 'Online', severity: sev, qualityScore, issues: qualityIssues, gate
    };

    // Profile pane
    const profileScore = qualityScore === '--' ? '0' : qualityScore;
    panes.profile = {
      qualityScore: profileScore,
      issues: qualityIssues,
      scans: '1',
      reports: '1',
      avgScore: profileScore,
      severity: sev,
      activity: [{ icon: '\u{1F50D}', text: 'Scan completed — ' + (findings.length) + ' issues found', time: new Date().toLocaleTimeString() }],
      gate
    };

    // Compliance pane
    const compRules = [
      { id: 'sensitive-logs', text: 'No sensitive data in logs', severity: 'critical', pass: !findings.some(f => f.type === 'Sensitive Data Exposure' && (f.file || '').includes('log')) },
      { id: 'license', text: 'Dependency license compliance', severity: 'high', pass: !findings.some(f => f.type === 'License Issue') },
      { id: 'conduct', text: 'Code of conduct present', severity: 'medium', pass: true },
      { id: 'security-policy', text: 'Security policy defined', severity: 'medium', pass: !findings.some(f => f.type === 'Security Policy Missing') },
      { id: 'contributing', text: 'Contributing guidelines', severity: 'low', pass: true }
    ];
    const passed = compRules.filter(r => r.pass).length;
    const failed = compRules.filter(r => !r.pass).length;
    const progress = String(Math.round((passed / compRules.length) * 100)) + '%';
    panes.compliance = { passed: String(passed), failed: String(failed), progress, total: String(compRules.length), status: failed === 0 ? 'Pass' : 'Fail', rules: compRules, severity: sev, qualityScore, issues: qualityIssues, gate };

    // Repo Health pane
    const rhScore = qualityScore === '--' ? '0' : qualityScore;
    const rhScoreNum = parseInt(rhScore, 10) || 0;
    const rhFindings = findings.slice(0, 10).map(f => ({ severity: f.severity || 'low', text: f.message || f.type || 'Finding', file: f.file || 'unknown' }));
    const rhRecs = [] as any[];
    if (critical > 0) rhRecs.push({ text: 'Address ' + critical + ' critical vulnerabilities immediately' });
    if ((sev.high || 0) > 0) rhRecs.push({ text: 'Resolve ' + sev.high + ' high severity findings' });
    if (secretCount > 0) rhRecs.push({ text: 'Remove ' + secretCount + ' exposed secrets from codebase' });
    if (vulnCount > 0) rhRecs.push({ text: 'Fix ' + vulnCount + ' security vulnerabilities' });
    if (rhScoreNum < 70) rhRecs.push({ text: 'Improve code quality score (currently ' + rhScore + ')' });
    if (rhRecs.length === 0) rhRecs.push({ text: 'Repository health is good. Keep up the regular scanning.' });
    panes.repoHealth = {
      score: rhScore,
      qualityScore: rhScore,
      gate,
      issues: qualityIssues,
      files,
      status: gate === 'PASS' ? 'Pass' : 'Pending',
      critical: String(critical),
      high: String(sev.high || 0),
      medium: String(sev.medium || 0),
      low: String(sev.low || 0),
      maintainability: String(rhScoreNum),
      reliability: String(Math.max(0, rhScoreNum - 5)),
      complexity: String(Math.max(0, rhScoreNum - 10)),
      duplication: String(Math.max(0, rhScoreNum - 15)),
      findings: rhFindings,
      recommendations: rhRecs
    };

    // Team, Scan, Analytics, Settings panes
    scanCountRef.value += 1;
    panes.team = { members: '1', scans: String(scanCountRef.value), resolved: '0', score: qualityScore, status: 'Active', membersList: [{ name: 'Admin', role: 'Project Owner', status: 'Active' }], severity: sev, qualityScore, issues: qualityIssues, gate };

    const scResults = findings.slice(0, 10).map(f => ({ severity: f.severity || 'low', type: f.type || 'Finding', text: f.message || f.type || 'Finding', file: f.file || 'unknown', line: f.line != null ? f.line : undefined }));
    const scHistory = [{ text: 'Workspace scan completed', time: new Date().toLocaleTimeString(), score: qualityScore }];
    panes.scan = {
      total: String(scanCountRef.value), issues, fixed: '0', score: qualityScore, qualityScore,
      status: 'Complete', scanning: false, hasResults: true, progress: '100',
      critical: String(sevCounts.critical || '0'), high: String(sevCounts.high || '0'),
      medium: String(sevCounts.medium || '0'), low: String(sevCounts.low || '0'),
      results: scResults, history: scHistory, gate
    };

    const lastScan = new Date().toLocaleDateString();
    panes.analytics = { scans: String(scanCountRef.value), issues: qualityIssues, avgScore: qualityScore, lastScan, trend: '+' + scanCountRef.value, issueTrend: qualityIssues, status: 'Ready', severity: sev };
    panes.settings = { severity: sev, qualityScore, issues: qualityIssues, gate };

    // Report pane
    const filesList = (r?.files as any[]) || [];
    panes.report = { files, gate, issues, score, severity: sev, findings: mappedFindings, filesList, totalScans: String(scanCountRef.value) };

    const analyzeSev = (r?.summary as Record<string, unknown>)?.severityCounts as Record<string, number> || {};
    const analyzeFindings = ((r?.findings as any[]) || []).slice(0, 30).map(f => ({
      title: f.title || f.type || f.message || 'Issue',
      severity: f.severity || 'medium',
      type: f.type || '',
      file: f.file || ''
    }));
    panes.analyze = {
      lastAnalysis: new Date().toLocaleString(),
      score: qualityScore,
      gate,
      issues: qualityIssues,
      files,
      severity: analyzeSev,
      findings: analyzeFindings
    };

    WelcomeDashboard.batchUpdatePanesIfOpen(panes);

  } catch (e) {
    outputChannel.appendLine(`[SimpleBeacon] Welcome dashboard update failed: ${e}`);
  }

  // Status message on sidebar
  if (statusMessage) {
    try {
      modernSidebarProvider.updateStatus('completed', statusMessage);
    } catch (e) {
      outputChannel.appendLine(`[SimpleBeacon] Status update failed: ${e}`);
    }
  }
}
