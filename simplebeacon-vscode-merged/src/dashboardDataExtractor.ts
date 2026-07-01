// Copyright (c) SimpleBeacon Contributors
// SPDX-License-Identifier: MIT
// simplebeacon-ignore memory-leak — report data extraction utilities, short-lived iterations

import { RawIssue } from './scanProvider';

export interface CategoryItem {
  label: string;
  count: number;
  severity: 'pass' | 'fail' | 'warn' | 'info';
}

export interface FindingItem {
  cat: string;
  sev: string;
  desc: string;
  file: string;
  line: number | '';
  patternId?: string;
}

export interface FailingFileItem {
  file: string;
  issues: { severity: string; description: string; line: number }[];
}

const severityMap: Record<string, CategoryItem['severity']> = {
  security: 'fail',
  debug: 'info',
  aiResidue: 'warn',
  performance: 'warn',
  typeSafety: 'info',
  testCoverage: 'info',
  accessibility: 'info',
  quality: 'warn',
  other: 'info',
};

const categoryDefs: { label: string; severity: CategoryItem['severity']; path: string }[] = [
  { label: 'Blocking', severity: 'fail', path: 'gate.blockingIssues' },
  { label: 'Secrets', severity: 'fail', path: 'credentialHygiene.secrets' },
  { label: 'AI Indicators', severity: 'warn', path: 'aiIndicators.findings' },
  { label: 'EU AI Act', severity: 'warn', path: 'euAiAct.findings' },
  { label: 'Vulnerabilities', severity: 'fail', path: 'dependencyAudit.vulnerabilities' },
  { label: 'Debug Markers', severity: 'info', path: 'cleanup.debugMarkers' },
  { label: 'AI Residue', severity: 'warn', path: 'aiResidue.aiResidueFindings' },
  { label: 'Performance', severity: 'warn', path: 'performance.performanceFindings' },
  { label: 'Type Safety', severity: 'info', path: 'typeSafety.typeSafetyFindings' },
  { label: 'Test Coverage', severity: 'info', path: 'testCoverage.testCoverageFindings' },
  { label: 'Accessibility', severity: 'info', path: 'accessibility.accessibilityFindings' },
  { label: 'i18n', severity: 'info', path: 'i18n.i18nFindings' },
  { label: 'Sensitive Data', severity: 'fail', path: 'sensitiveData.sensitiveDataFindings' },
  { label: 'Config Drift', severity: 'warn', path: 'configDrift.configDriftFindings' },
  { label: 'Security Headers', severity: 'fail', path: 'securityHeaders.securityHeaderFindings' },
  { label: 'Database Patterns', severity: 'fail', path: 'databasePatterns.dbPatternFindings' },
  { label: 'Framework Practices', severity: 'warn', path: 'frameworkPractices.frameworkFindings' },
  { label: 'Workspace Health', severity: 'info', path: 'workspaceHealth.workspaceFindings' },
  { label: 'Unused Deps', severity: 'info', path: 'unusedDeps.unusedDepFindings' },
  { label: 'API Contract', severity: 'info', path: 'apiContract.apiContractFindings' },
  { label: 'Complexity', severity: 'warn', path: 'complexity.complexityFindings' },
  { label: 'LLM Slop', severity: 'warn', path: 'llmSlop.llmSlopFindings' },
  { label: 'Token Bleed', severity: 'warn', path: 'tokenBleed.tokenBleedFindings' },
  { label: 'Production Leak', severity: 'fail', path: 'productionLeak.productionLeakFindings' },
  { label: 'Fiction KPI', severity: 'warn', path: 'fictionKpi.fictionKpiFindings' },
  { label: 'Security', severity: 'fail', path: 'security.securityFindings' },
  { label: 'Quality', severity: 'warn', path: 'quality.qualityFindings' },
  { label: 'Maintainability', severity: 'info', path: 'maintainability.maintainabilityFindings' },
];

function getValueAtPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, p) => {
    if (o && typeof o === 'object' && p in o) {
      return (o as Record<string, unknown>)[p];
    }
    return undefined;
  }, obj);
}

interface ReportLike {
  categories?: Record<string, unknown[]>;
  rawIssues?: RawIssue[];
  severityCounts?: { critical?: number; high?: number; medium?: number; low?: number };
  [key: string]: unknown;
}

export function extractCategories(report: unknown): CategoryItem[] {
  const r = report as ReportLike;
  const cats: CategoryItem[] = [];

  if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
    for (const [cat, items] of Object.entries(r.categories)) {
      if (Array.isArray(items) && items.length > 0) {
        cats.push({ label: cat, count: items.length, severity: severityMap[cat] || 'info' });
      }
    }
    return cats;
  }

  for (const def of categoryDefs) {
    const items = getValueAtPath(r, def.path);
    if (Array.isArray(items) && items.length > 0) {
      cats.push({ label: def.label, count: items.length, severity: def.severity });
    }
  }

  if (cats.length === 0 && Array.isArray(r.rawIssues) && r.rawIssues.length > 0) {
    const high = r.rawIssues.filter((i) => i.severity === 'high' || i.severity === 'critical');
    const medium = r.rawIssues.filter((i) => i.severity === 'medium');
    const low = r.rawIssues.filter((i) => i.severity === 'low');
    if (high.length) cats.push({ label: 'Blocking Issues', count: high.length, severity: 'fail' });
    if (medium.length) cats.push({ label: 'Warnings', count: medium.length, severity: 'warn' });
    if (low.length) cats.push({ label: 'Info', count: low.length, severity: 'info' });
  }

  if (cats.length === 0 && r.severityCounts && typeof r.severityCounts === 'object') {
    const sc = r.severityCounts;
    if (sc.critical) cats.push({ label: 'Critical', count: sc.critical, severity: 'fail' });
    if (sc.high) cats.push({ label: 'High', count: sc.high, severity: 'fail' });
    if (sc.medium) cats.push({ label: 'Medium', count: sc.medium, severity: 'warn' });
    if (sc.low) cats.push({ label: 'Low', count: sc.low, severity: 'info' });
  }

  return cats;
}

export function extractAllFindings(report: unknown): FindingItem[] {
  const r = report as ReportLike;
  const all: FindingItem[] = [];

  if (r.categories && typeof r.categories === 'object' && !Array.isArray(r.categories)) {
    for (const [cat, items] of Object.entries(r.categories)) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        const raw = it as RawIssue;
        all.push({
          cat,
          sev: raw.severity || 'medium',
          desc: raw.message || raw.type || 'Finding',
          file: raw.file || '',
          line: raw.line ?? '',
          patternId: raw.patternId || '',
        });
      }
    }
    return all;
  }

  const gateBlocking = getValueAtPath(r, 'gate.blockingIssues');
  const credSecrets = getValueAtPath(r, 'credentialHygiene.secrets');
  if (!Array.isArray(gateBlocking) && !Array.isArray(credSecrets) && Array.isArray(r.rawIssues) && r.rawIssues.length > 0) {
    r.rawIssues.forEach((it) => {
      all.push({
        cat: it.type || 'Finding',
        sev: it.severity || 'medium',
        desc: it.description || it.type || 'Finding',
        file: it.file || it.filePath || '',
        line: it.line || '',
      });
    });
    return all;
  }

  const sevMap: Record<string, string> = {
    'gate.blockingIssues': 'high',
    'credentialHygiene.secrets': 'high',
    'aiIndicators.findings': 'medium',
    'euAiAct.findings': 'medium',
    'dependencyAudit.vulnerabilities': 'high',
    'cleanup.debugMarkers': 'low',
    'aiResidue.aiResidueFindings': 'medium',
    'performance.performanceFindings': 'medium',
    'typeSafety.typeSafetyFindings': 'low',
    'testCoverage.testCoverageFindings': 'low',
    'accessibility.accessibilityFindings': 'low',
    'i18n.i18nFindings': 'low',
    'sensitiveData.sensitiveDataFindings': 'high',
    'configDrift.configDriftFindings': 'medium',
    'securityHeaders.securityHeaderFindings': 'high',
    'databasePatterns.dbPatternFindings': 'high',
    'frameworkPractices.frameworkFindings': 'medium',
    'workspaceHealth.workspaceFindings': 'low',
    'unusedDeps.unusedDepFindings': 'low',
    'apiContract.apiContractFindings': 'low',
    'complexity.complexityFindings': 'medium',
    'llmSlop.llmSlopFindings': 'medium',
    'tokenBleed.tokenBleedFindings': 'medium',
    'productionLeak.productionLeakFindings': 'high',
    'fictionKpi.fictionKpiFindings': 'medium',
    'security.securityFindings': 'high',
    'quality.qualityFindings': 'medium',
    'maintainability.maintainabilityFindings': 'low',
  };

  for (const def of categoryDefs) {
    const items = getValueAtPath(r, def.path) as RawIssue[] | undefined;
    items?.forEach((it: RawIssue) => {
      all.push({
        cat: def.label,
        sev: it.severity || sevMap[def.path] || 'medium',
        desc: it.description || it.message || it.type || it.id || it.packageName || 'Finding',
        file: it.file || it.path || '',
        line: it.line || '',
        patternId: it.patternId || '',
      });
    });
  }

  return all;
}

interface FindingEntry {
  file?: string;
  severity?: string;
  message?: string;
  type?: string;
  matches?: { line?: number }[];
}

export function extractFailingFiles(report: unknown): FailingFileItem[] {
  const r = report as ReportLike;
  const fileMap = new Map<string, { issues: { severity: string; description: string; line: number }[] }>();

  if (Array.isArray(r.findings)) {
    for (const issue of r.findings as FindingEntry[]) {
      const filePath = issue.file || 'Unknown';
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, { issues: [] });
      }
      fileMap.get(filePath)!.issues.push({
        severity: issue.severity || 'medium',
        description: issue.message || issue.type || 'Issue',
        line: issue.matches?.[0]?.line || 1,
      });
    }
    return Array.from(fileMap.entries())
      .map(([file, data]) => ({ file, issues: data.issues }))
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 20);
  }

  if (Array.isArray(r.rawIssues) && r.rawIssues.length > 0) {
    r.rawIssues.forEach((issue: RawIssue) => {
      const filePath = issue.filePath || issue.file || issue.path || 'Unknown';
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, { issues: [] });
      }
      fileMap.get(filePath)!.issues.push({
        severity: issue.severity || 'medium',
        description: issue.description || issue.type || 'Issue',
        line: issue.line || 1,
      });
    });
  }

  return Array.from(fileMap.entries())
    .map(([file, data]) => ({ file, issues: data.issues }))
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 20);
}

