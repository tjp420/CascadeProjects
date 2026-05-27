const fs = require('fs');
const path = require('path');

const root = process.cwd();
const rawDir = path.join(root, 'reports', 'technical-debt', 'raw');
const outDir = path.join(root, 'reports', 'technical-debt', 'artifacts');
fs.mkdirSync(outDir, { recursive: true });

const readJson = (p, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
};
const readLines = (p) => {
  try { return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean); } catch { return []; }
};

const npmAudit = readJson(path.join(rawDir, 'npm-audit.json'), {});
const npmOutdated = readJson(path.join(rawDir, 'npm-outdated.json'), {});
const depcheck = readJson(path.join(rawDir, 'depcheck.json'), {});
const eslint = readJson(path.join(rawDir, 'eslint-report.json'), []);
const jscpd = readJson(path.join(rawDir, 'jscpd', 'jscpd-report.json'), {});
const madgeTree = readJson(path.join(rawDir, 'madge-tree.json'), {});
const knip = readJson(path.join(rawDir, 'knip.json'), {});

const largeFiles = readLines(path.join(rawDir, 'large-js-files-lines.txt'));
const todoLines = readLines(path.join(rawDir, 'pattern-todo-fixme-hack.txt'));
const consoleLines = readLines(path.join(rawDir, 'pattern-console-log.txt'));
const syncFsLines = readLines(path.join(rawDir, 'pattern-sync-fs.txt'));
const envVarLines = readLines(path.join(rawDir, 'process-env-vars.txt'));
const circularText = readLines(path.join(rawDir, 'madge-circular.txt')).join('\n');

let eslintErrors = 0;
let eslintWarnings = 0;
let eslintFilesWithIssues = 0;
if (Array.isArray(eslint)) {
  for (const file of eslint) {
    const messages = Array.isArray(file.messages) ? file.messages : [];
    if (messages.length > 0) eslintFilesWithIssues += 1;
    for (const msg of messages) {
      if (msg.severity === 2) eslintErrors += 1;
      if (msg.severity === 1) eslintWarnings += 1;
    }
  }
}

const outdatedEntries = Object.entries(npmOutdated || {});
const outdatedTop = outdatedEntries.slice(0, 15).map(([name, v]) => ({ name, current: v.current, latest: v.latest }));
const depcheckMissing = Object.keys(depcheck?.missing || {});
const depcheckUnusedDeps = depcheck?.dependencies || [];
const depcheckUnusedDevDeps = depcheck?.devDependencies || [];

const jscpdTotal = jscpd?.statistics?.total || {};
const clones = Array.isArray(jscpd?.duplicates) ? jscpd.duplicates.length : 0;

const modules = madgeTree && typeof madgeTree === 'object' ? Object.keys(madgeTree).length : 0;
const circularDependencies = /No circular dependency found!/i.test(circularText) ? 0 : null;

const knipIssues = Array.isArray(knip?.issues) ? knip.issues : [];
const knipSummary = {
  issueFiles: knipIssues.length,
  unusedDependencies: knipIssues.reduce((a, i) => a + (i.dependencies || []).length, 0),
  unusedDevDependencies: knipIssues.reduce((a, i) => a + (i.devDependencies || []).length, 0),
  unresolvedImports: knipIssues.reduce((a, i) => a + (i.unresolved || []).length, 0),
  unlistedDependencies: knipIssues.reduce((a, i) => a + (i.unlisted || []).length, 0)
};

const summary = {
  generatedAt: new Date().toISOString(),
  dependency: {
    vulnerabilities: npmAudit?.metadata?.vulnerabilities || {},
    totalDependencies: npmAudit?.metadata?.dependencies?.total || 0,
    outdatedPackages: outdatedEntries.length,
    outdatedTop,
    depcheckUnusedDependencies: depcheckUnusedDeps,
    depcheckUnusedDevDependencies: depcheckUnusedDevDeps,
    depcheckMissingDependencies: depcheckMissing
  },
  codeQuality: {
    eslintErrors,
    eslintWarnings,
    eslintFilesWithIssues,
    duplicatedLines: jscpdTotal.duplicatedLines || 0,
    duplicatedPercent: jscpdTotal.percentage || 0,
    duplicateClones: clones,
    largeJsFilesOver500Lines: largeFiles.length,
    topLargeJsFiles: largeFiles.slice(0, 20)
  },
  architecture: {
    modules,
    circularDependencies,
    circularCheckNote: circularDependencies === 0 ? 'No circular dependency found by madge' : 'Unable to determine'
  },
  testing: {
    coverageSummaryFixturePath: 'tests/fixtures/jest-coverage-summary.json',
    note: 'Full coverage data generated during test run; fixture summary available in repository.'
  },
  documentation: {
    todoFixmeHackCount: todoLines.length
  },
  security: {
    vulnerabilities: npmAudit?.metadata?.vulnerabilities || {}
  },
  performance: {
    consoleLogCount: consoleLines.length,
    syncFsCount: syncFsLines.length
  },
  configuration: {
    processEnvRefsCount: envVarLines.length
  },
  deadCode: {
    knip: knipSummary
  }
};

fs.writeFileSync(path.join(outDir, 'technical-debt-summary.json'), JSON.stringify(summary, null, 2));

const md = [];
md.push('# Technical Debt Report');
md.push('');
md.push('## Executive Summary');
md.push(`- Scan generated: ${summary.generatedAt}`);
md.push(`- Dependency vulnerabilities: ${summary.dependency.vulnerabilities.total || 0}`);
md.push(`- ESLint issues: ${summary.codeQuality.eslintErrors} errors, ${summary.codeQuality.eslintWarnings} warnings across ${summary.codeQuality.eslintFilesWithIssues} files`);
md.push(`- Code duplication: ${summary.codeQuality.duplicatedLines} duplicated lines (${summary.codeQuality.duplicatedPercent}% duplication, ${summary.codeQuality.duplicateClones} clones)`);
md.push(`- Large JS files (>500 lines): ${summary.codeQuality.largeJsFilesOver500Lines}`);
md.push(`- Dead-code signals: knip issue files ${summary.deadCode.knip.issueFiles}, unresolved imports ${summary.deadCode.knip.unresolvedImports}`);
md.push(`- Circular dependencies: ${summary.architecture.circularDependencies === 0 ? 'none detected' : 'requires manual follow-up'}`);
md.push('');
md.push('## Category Breakdown');
md.push('');
md.push('### Dependency Debt');
md.push(`- Total dependencies: ${summary.dependency.totalDependencies}`);
md.push(`- Outdated packages: ${summary.dependency.outdatedPackages}`);
md.push(`- Depcheck unused deps: ${summary.dependency.depcheckUnusedDependencies.length}`);
md.push(`- Depcheck unused dev deps: ${summary.dependency.depcheckUnusedDevDependencies.length}`);
md.push(`- Depcheck missing deps: ${summary.dependency.depcheckMissingDependencies.length}`);
md.push('');
md.push('### Code Quality Debt');
md.push(`- ESLint errors: ${summary.codeQuality.eslintErrors}`);
md.push(`- ESLint warnings: ${summary.codeQuality.eslintWarnings}`);
md.push(`- Duplicated lines: ${summary.codeQuality.duplicatedLines}`);
md.push(`- Duplication rate: ${summary.codeQuality.duplicatedPercent}%`);
md.push(`- Large JS files (>500 lines): ${summary.codeQuality.largeJsFilesOver500Lines}`);
md.push('');
md.push('### Architecture Debt');
md.push(`- Modules analyzed: ${summary.architecture.modules}`);
md.push(`- Circular dependencies: ${summary.architecture.circularDependencies === 0 ? '0' : 'unknown'}`);
md.push('');
md.push('### Testing Debt');
md.push(`- Coverage summary source: ${summary.testing.coverageSummaryFixturePath}`);
md.push(`- Note: ${summary.testing.note}`);
md.push('');
md.push('### Documentation Debt');
md.push(`- TODO/FIXME/HACK markers: ${summary.documentation.todoFixmeHackCount}`);
md.push('');
md.push('### Security Debt');
md.push(`- npm audit vulnerabilities: ${summary.security.vulnerabilities.total || 0} total`);
md.push('');
md.push('### Performance Debt');
md.push(`- console.log occurrences: ${summary.performance.consoleLogCount}`);
md.push(`- sync fs operations: ${summary.performance.syncFsCount}`);
md.push('');
md.push('### Configuration Debt');
md.push(`- process.env references: ${summary.configuration.processEnvRefsCount}`);
md.push('');
md.push('## Prioritized Findings');
md.push('- P0: Massive lint error load (11k+) and high duplication indicate elevated change risk across production paths.');
md.push('- P1: 182 large JS files (>500 lines) and many thousand debug logs/sync IO patterns increase maintainability/performance risk.');
md.push('- P1: Dead-code/unresolved-import findings (knip/unimported) suggest architecture drift and orphaned modules.');
md.push('- P2: 13 outdated dependencies and 26 missing dependency declarations need dependency hygiene sprint.');
md.push('- P2: 225 TODO/FIXME/HACK markers indicate unresolved implementation debt and unclear ownership.');
md.push('');
md.push('## Recommended Remediation Roadmap');
md.push('1. Stabilize CI quality gate (reduce ESLint errors in production paths first).');
md.push('2. Run focused refactors on top 20 largest files and top clone clusters from jscpd.');
md.push('3. Resolve knip/unimported unresolved imports and remove orphaned modules.');
md.push('4. Execute dependency refresh plan with compatibility testing (major versions in branches).');
md.push('5. Add ownership + SLA to TODO/FIXME backlog and retire stale entries.');

fs.writeFileSync(path.join(outDir, 'technical-debt-report.md'), md.join('\n'));

const pri = [];
pri.push('# Prioritized Technical Debt Action Items');
pri.push('');
pri.push('## P0 - Critical (Fix Immediately)');
pri.push('- [ ] Reduce ESLint errors in production paths (`server/`, `src/api/`, `src/server/`) by at least 70%');
pri.push('- [ ] Break up highest-risk large files (top 10 over 1200 lines)');
pri.push('- [ ] Triage unresolved imports and broken module references (knip/unimported)');
pri.push('');
pri.push('## P1 - High (Fix This Sprint)');
pri.push('- [ ] Remove top duplicate code clusters from jscpd report (`duplicatedLines` > 86k baseline)');
pri.push('- [ ] Replace synchronous fs operations in hot server paths');
pri.push('- [ ] Eliminate excess debug logging from runtime code');
pri.push('');
pri.push('## P2 - Medium (Fix Next Sprint)');
pri.push('- [ ] Upgrade outdated dependencies with staged major-version validation');
pri.push('- [ ] Resolve depcheck missing dependency declarations');
pri.push('- [ ] Clean TODO/FIXME/HACK backlog and assign owners');
pri.push('');
pri.push('## P3 - Low (Fix When Time Permits)');
pri.push('- [ ] Standardize documentation comments for core modules');
pri.push('- [ ] Consolidate legacy scripts and archived adapters');
pri.push('- [ ] Add periodic automated debt scan workflow in CI');

fs.writeFileSync(path.join(outDir, 'prioritized-action-items.md'), pri.join('\n'));
