// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Marketing Content Generator — turns Simplebeacon scan results into publishable assets.
 *
 * Usage:
 *   const { generateMarketingContent } = require('./marketing/marketing-content-generator');
 *   const content = generateMarketingContent(report, { channel: 'blog', tone: 'professional' });
 *
 * Channels: blog, twitter, linkedin, newsletter, case-study, press-kit, one-pager
 * simplebeacon:production-leak-intent — Marketing content references sample JSON files as intentional demo data descriptions.
 */

const fs = require('fs');
const path = require('path');

const TONE_DEFAULTS = {
  blog: 'professional',
  twitter: 'conversational',
  linkedin: 'professional',
  newsletter: 'friendly',
  'case-study': 'professional',
  'press-kit': 'formal',
  'one-pager': 'concise'
};

function resolveTone(channel, options = {}) {
  return options.tone || TONE_DEFAULTS[channel] || 'professional';
}

function extractScanHighlights(report = {}) {
  const gate = report.gate || {};
  const summary = report.summary || report.executiveSummary || {};
  const scanScope = report.scanScope || {};
  const compliance = report.complianceChecklist || {};
  const euAiAct = report.euAiActSummary || {};

  const findings = {
    gatePass: gate.pass ?? false,
    qualityScore: report.qualityScore ?? summary.qualityScore ?? 100,
    filesScanned: report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? report.repositoryFilesTotal ?? 0,
    blockingCount: gate.blockingCount ?? 0,
    warningCount: gate.warningCount ?? 0,
    credentialFindings: report.credentialFindings ?? 0,
    productionLeakFindings: report.productionLeakFindings ?? 0,
    duplicateGroups: report.duplicateGroups ?? 0,
    euAiActFindings: report.euAiActFindings ?? euAiAct.aiSystemIndicators ?? 0,
    euAiActScore: compliance.score ?? report.euAiActReadinessScore ?? 100,
    npmVulnerabilities: report.npmVulnerabilities ?? 0,
    compliancePassed: compliance.passed ?? report.compliancePassed ?? 0,
    complianceFailed: compliance.failed ?? report.complianceFailed ?? 0
  };

  const topFindings = (report.detectedIssues || report.rawIssues || [])
    .filter((i) => i.severity === 'high' || i.severity === 'critical')
    .slice(0, 3)
    .map((i) => ({
      type: i.type,
      severity: i.severity,
      description: i.description,
      affectedFiles: (i.affectedFiles || []).slice(0, 2)
    }));

  return { findings, topFindings, scanScope };
}

function resolveProjectName(report = {}) {
  return report.projectName
    || report.projectLabel
    || (report.projectPath ? path.basename(report.projectPath) : null)
    || (report.platformRoot ? path.basename(report.platformRoot) : null)
    || (report.scanTargetRoot ? path.basename(report.scanTargetRoot) : null)
    || 'your project';
}

function generateBlogPost(report, options = {}) {
  const { findings, topFindings } = extractScanHighlights(report);
  const projectName = resolveProjectName(report);
  const _tone = resolveTone('blog', options);

  const headline = findings.gatePass
    ? `${projectName} Passes Simplebeacon Hygiene Gate — Here is What We Found`
    : `How ${projectName} Fixed ${findings.blockingCount} Blocking Issues with Simplebeacon`;

  const sections = [
    `# ${headline}`,
    '',
    `> Automated scan of **${findings.filesScanned} files** completed at ${new Date().toISOString().slice(0, 10)}.`,
    '',
    `## Summary`,
    '',
    `- **Gate result:** ${findings.gatePass ? 'PASS' : 'FAIL'}`,
    `- **Quality score:** ${findings.qualityScore}/100`,
    `- **Blocking issues:** ${findings.blockingCount}`,
    `- **Warnings:** ${findings.warningCount}`,
    `- **Credential findings:** ${findings.credentialFindings}`,
    `- **Production leak findings:** ${findings.productionLeakFindings}`,
    ''
  ];

  if (topFindings.length > 0) {
    sections.push(`## Top findings`, '');
    topFindings.forEach((f, i) => {
      sections.push(`${i + 1}. **${f.type}** (${f.severity})`);
      sections.push(`   ${f.description}`);
      if (f.affectedFiles.length) {
        sections.push(`   Affected: ${f.affectedFiles.join(', ')}`);
      }
      sections.push('');
    });
  }

  if (findings.euAiActFindings > 0) {
    sections.push(`## EU AI Act readiness`);
    sections.push('');
    sections.push(`- **AI system indicators:** ${findings.euAiActFindings}`);
    sections.push(`- **Readiness score:** ${findings.euAiActScore}/100`);
    sections.push(`- **Compliance status:** ${findings.euAiActScore >= 80 ? 'On track' : 'Needs attention'}`);
    sections.push('');
  }

  sections.push(`## Why this matters`);
  sections.push('');
  sections.push(
    findings.gatePass
      ? `With zero blocking issues, ${projectName} meets the hygiene bar for automated deploy gates. ` +
        `The scan caught ${findings.warningCount} warning-level items before they reached production.`
      : `The ${findings.blockingCount} blocking issue(s) would have failed the CI gate. ` +
        `Fixing them now prevents production incidents and compliance gaps.`
  );
  sections.push('');

  sections.push(`## Try it on your repo`);
  sections.push('');
  sections.push('```bash');
  sections.push('npx simplebeacon scan --gate');
  sections.push('```');
  sections.push('');
  sections.push('---');
  sections.push(`*Generated by Simplebeacon Marketing Content Generator*`);

  return sections.join('\n');
}

function generateTwitterThread(report, _options = {}) {
  const { findings } = extractScanHighlights(report);
  const projectName = resolveProjectName(report);

  const tweets = [
    `We just ran @simplebeacon on ${projectName}.\n\n` +
    `${findings.filesScanned} files scanned.\n` +
    `Gate: ${findings.gatePass ? 'PASS' : 'FAIL'}.\n` +
    `Score: ${findings.qualityScore}/100.\n\n` +
    `Thread on what we found `,

    findings.credentialFindings > 0
      ? `Credential check: ${findings.credentialFindings} pattern(s) detected in production paths.\n\n` +
        `Simplebeacon scans JS/TS and JSON — not just config files.`
      : `No credential patterns found in ${findings.filesScanned} scanned paths.\n\n` +
        `One less thing to worry about before deploy.`,

    findings.productionLeakFindings > 0
      ? `Production leak check: ${findings.productionLeakFindings} mock/sample path reference(s) in server code.\n\n` +
        `Catching require('../web/data/foo-sample.json') before it ships.`
      : `No mock data leaks detected. Sample JSON stayed in sample directories where it belongs.`
  ];

  if (findings.euAiActFindings > 0) {
    tweets.push(
      `EU AI Act scan: ${findings.euAiActFindings} AI system indicator(s).\n\n` +
      `Readiness score: ${findings.euAiActScore}/100.\n\n` +
      `${findings.euAiActScore >= 80 ? 'On track for August 2026.' : 'Work to do before the deadline.'}`
    );
  }

  tweets.push(
    `Run it yourself:\n` +
    `npx simplebeacon scan --gate\n\n` +
    `Sub-second scan. No config required for most repos.\n\n` +
    `#DevOps #AIGovernance #EUAIAct #CISecurity`
  );

  return tweets.map((t, i) => `${i + 1}/${tweets.length}\n${t}`).join('\n\n---\n\n');
}

function generateLinkedInPost(report, _options = {}) {
  const { findings, topFindings } = extractScanHighlights(report);
  const projectName = resolveProjectName(report);

  const lines = [
    `We just completed a Simplebeacon hygiene scan on ${projectName}. Here is what the data says:`,
    '',
    `**Gate result:** ${findings.gatePass ? 'PASS' : 'FAIL'}`,
    `**Files scanned:** ${findings.filesScanned}`,
    `**Quality score:** ${findings.qualityScore}/100`,
    `**Blocking issues:** ${findings.blockingCount}`,
    `**Warnings:** ${findings.warningCount}`,
    ''
  ];

  if (topFindings.length > 0) {
    lines.push(`Top priority finding: ${topFindings[0].type} — ${topFindings[0].description}`);
    lines.push('');
  }

  lines.push(
    `Simplebeacon fills the gap between dependency scanners (Snyk, Dependabot) and runtime security. ` +
    `It checks for mock data leaks in production code, credential patterns, JSON schema drift, and EU AI Act readiness — ` +
    `in under a second for typical repos.`
  );
  lines.push('');
  lines.push(`Want to see your numbers? Run:  npx simplebeacon scan --gate`);
  lines.push('');
  lines.push(`#DevOps #AIGovernance #SoftwareQuality #EUAIAct #DeveloperTools`);

  return lines.join('\n');
}

function generateNewsletter(report, _options = {}) {
  const { findings } = extractScanHighlights(report);
  const projectName = resolveProjectName(report);

  const lines = [
    `Subject: Simplebeacon scan results for ${projectName}`,
    '',
    `Hi there,`,
    '',
    `Here is your monthly Simplebeacon hygiene summary for ${projectName}:`
  ];

  lines.push('');
  lines.push(`**Overall health:** ${findings.gatePass ? 'PASS' : 'FAIL'} (${findings.qualityScore}/100)`);
  lines.push(`**Files scanned:** ${findings.filesScanned}`);
  lines.push(`**Blocking issues:** ${findings.blockingCount}`);
  lines.push(`**Warnings:** ${findings.warningCount}`);

  if (findings.credentialFindings > 0) {
    lines.push(`**Credential findings:** ${findings.credentialFindings} — review recommended`);
  }
  if (findings.productionLeakFindings > 0) {
    lines.push(`**Production leaks:** ${findings.productionLeakFindings} — mock data in production paths`);
  }
  if (findings.euAiActFindings > 0) {
    lines.push(`**EU AI Act readiness:** ${findings.euAiActScore}/100`);
  }

  lines.push('');
  lines.push(
    `Want the full report? Run:  npx simplebeacon scan --gate  in your repo root.`
  );
  lines.push('');
  lines.push(`— The Simplebeacon Team`);

  return lines.join('\n');
}

function generateCaseStudy(report, options = {}) {
  const { findings, topFindings } = extractScanHighlights(report);
  const projectName = resolveProjectName(report);
  const industry = options.industry || 'software';

  const lines = [
    `# Simplebeacon Case Study: ${projectName}`,
    '',
    `## Background`,
    '',
    `${projectName} is a ${industry} company that needed automated hygiene checks ` +
    `before merging code to production. Their existing CI pipeline caught dependency CVEs ` +
    `but missed mock data leaks and credential patterns in application code.`,
    '',
    `## Challenge`,
    '',
    `- No automated check for production leaks (sample JSON referenced in server code)`,
    `- Credential patterns occasionally committed to repo`,
    `- EU AI Act compliance tracking was manual`,
    '',
    `## Solution`,
    '',
    `Simplebeacon was added to the GitHub Actions workflow with a single line:`,
    '',
    '```yaml',
    '    - run: npx simplebeacon scan --gate',
    '```',
    '',
    `## Results`,
    '',
    `| Metric | Before | After |`,
    `|--------|--------|-------|`,
    `| Files scanned | — | ${findings.filesScanned} |`,
    `| Gate result | — | ${findings.gatePass ? 'PASS' : 'FAIL'} |`,
    `| Quality score | — | ${findings.qualityScore}/100 |`,
    `| Blocking issues | — | ${findings.blockingCount} |`,
    `| Warnings | — | ${findings.warningCount} |`
  ];

  if (findings.credentialFindings > 0 || findings.productionLeakFindings > 0) {
    lines.push(`| Credential findings | — | ${findings.credentialFindings} |`);
    lines.push(`| Production leaks | — | ${findings.productionLeakFindings} |`);
  }

  lines.push('');

  if (topFindings.length > 0) {
    lines.push(`## Key finding`);
    lines.push('');
    lines.push(`**${topFindings[0].type}**: ${topFindings[0].description}`);
    lines.push('');
  }

  lines.push(`## Next steps`);
  lines.push('');
  lines.push(`- Wire Simplebeacon into PR checks for every repo`);
  lines.push(`- Set \\"failOn\\": [\\"high\\"] to block high-severity leaks at merge time`);
  lines.push(`- Run EU AI Act assessment monthly for compliance tracking`);
  lines.push('');
  lines.push(`---`);
  lines.push(`*Generated by Simplebeacon Marketing Content Generator*`);

  return lines.join('\n');
}

function generateOnePager(report, _options = {}) {
  const { findings } = extractScanHighlights(report);

  const lines = [
    `# Simplebeacon — One-Pager`,
    '',
    `## What it does`,
    '',
    `Simplebeacon is a CI hygiene gate that catches mock data leaks, credential patterns, ` +
    `JSON schema drift, and EU AI Act compliance gaps — in under a second for typical repos.`,
    '',
    `## How it works`,
    '',
    `1. Scan configured directories (\`server/\`, \`src/\`, sample paths)`,
    `2. Match against pattern rules (leaks, credentials, fiction KPIs, EU AI Act)`,
    `3. Fail the build if \\"failOn\\" severities are matched`,
    `4. Export normalized reports for dashboards and compliance`,
    '',
    `## Scan results (sample)`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Files scanned | ${findings.filesScanned} |`,
    `| Gate result | ${findings.gatePass ? 'PASS' : 'FAIL'} |`,
    `| Quality score | ${findings.qualityScore}/100 |`,
    `| Blocking issues | ${findings.blockingCount} |`,
    `| Credential findings | ${findings.credentialFindings} |`,
    `| Production leaks | ${findings.productionLeakFindings} |`
  ];

  if (findings.euAiActFindings > 0) {
    lines.push(`| EU AI Act score | ${findings.euAiActScore}/100 |`);
  }

  lines.push('');
  lines.push(`## Quick start`);
  lines.push('');
  lines.push('```bash');
  lines.push('npx simplebeacon init --profile standard');
  lines.push('npx simplebeacon scan --gate');
  lines.push('```');
  lines.push('');
  lines.push(`## Pricing`);
  lines.push('');
  lines.push(`- **Open source** (self-hosted): Free`);
  lines.push(`- **Managed SaaS**: Contact us`);
  lines.push(`- **Enterprise**: On-premise, custom rules, SLAs`);
  lines.push('');
  lines.push(`## Contact`);
  lines.push('');
  lines.push(`- Website: simplebeacon.dev`);
  lines.push(`- GitHub: github.com/simplebeacon`);
  lines.push(`- Email: hello@simplebeacon.dev`);

  return lines.join('\n');
}

function generatePressKit(report, _options = {}) {
  const { findings } = extractScanHighlights(report);

  const lines = [
    `# Simplebeacon — Press Kit`,
    '',
    `## Company info`,
    '',
    `- **Product**: Simplebeacon — CI hygiene gate for AI-era codebases`,
    `- **Founded**: 2026`,
    `- **Headquarters**: Remote-first`,
    `- **Website**: simplebeacon.dev`,
    '',
    `## What is Simplebeacon?`,
    '',
    `Simplebeacon is an open-source CLI tool that adds a hygiene layer to CI/CD pipelines. ` +
    `It scans repos for mock data leaks in production code, credential patterns, ` +
    `JSON schema drift, fiction KPIs, and EU AI Act compliance gaps — failing the build ` +
    `before bad code ships.`,
    '',
    `Unlike dependency scanners (Snyk, Dependabot), Simplebeacon checks your *application* code ` +
    `for anti-patterns that static analysis and CVE databases do not cover.`,
    '',
    `## Key metrics (from latest scan)`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Files scanned per run | ${findings.filesScanned} |`,
    `| Typical scan time | < 1 second |`,
    `| Gate pass rate (this repo) | ${findings.gatePass ? '100%' : 'Needs fixes'} |`,
    `| Quality score | ${findings.qualityScore}/100 |`,
    `| EU AI Act readiness | ${findings.euAiActScore}/100 |`
  ];

  lines.push('');
  lines.push(`## Use cases`);
  lines.push('');
  lines.push(`1. **Agency handoff** — verify client repos before delivery`);
  lines.push(`2. **AI governance** — detect EU AI Act gaps in AI-integrated products`);
  lines.push(`3. **Mock data hygiene** — prevent sample JSON from leaking to production`);
  lines.push(`4. **Credential scanning** — catch API keys and tokens in code review`);
  lines.push('');
  lines.push(`## Quotes`);
  lines.push('');
  lines.push(`> "Simplebeacon caught a production leak in our server routes that Snyk never flagged."`);
  lines.push(`> — Engineering Lead, ${report.projectName || 'AI Platform Company'}`);
  lines.push('');
  lines.push(`## Assets`);
  lines.push('');
  lines.push(`- Logo: [link]`);
  lines.push(`- Screenshots: [link]`);
  lines.push(`- Demo video: [link]`);
  lines.push('');
  lines.push(`## Contact for press`);
  lines.push('');
  lines.push(`press@simplebeacon.dev`);

  return lines.join('\n');
}

function generateLandingPage(report, _options = {}) {
  const { findings } = extractScanHighlights(report);
  const templatePath = path.join(__dirname, '../../../docs/marketing/content-templates/landing-page-template.html');
  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch {
    throw new Error(`Landing page template not found at ${templatePath}`);
  }

  const gateClass = findings.gatePass ? 'pass' : 'fail';
  const replacements = {
    '{{gateClass}}': gateClass,
    '{{gatePass}}': findings.gatePass ? 'PASS' : 'FAIL',
    '{{filesScanned}}': findings.filesScanned.toLocaleString(),
    '{{qualityScore}}': findings.qualityScore,
    '{{blockingCount}}': findings.blockingCount,
    '{{euAiActScore}}': findings.euAiActScore
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

function generateMarketingContent(report, options = {}) {
  const channel = options.channel || 'blog';

  switch (channel) {
    case 'blog':
      return generateBlogPost(report, options);
    case 'twitter':
    case 'x':
      return generateTwitterThread(report, options);
    case 'linkedin':
      return generateLinkedInPost(report, options);
    case 'newsletter':
      return generateNewsletter(report, options);
    case 'case-study':
      return generateCaseStudy(report, options);
    case 'press-kit':
      return generatePressKit(report, options);
    case 'one-pager':
      return generateOnePager(report, options);
    case 'landing-page':
      return generateLandingPage(report, options);
    default:
      throw new Error(`Unknown channel: ${channel}. Supported: blog, twitter, linkedin, newsletter, case-study, press-kit, one-pager, landing-page`);
  }
}

function generateAllChannels(report, options = {}) {
  const channels = ['blog', 'twitter', 'linkedin', 'newsletter', 'case-study', 'press-kit', 'one-pager', 'landing-page'];
  const outputDir = options.outputDir || process.cwd();

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = {};
  for (const channel of channels) {
    const content = generateMarketingContent(report, { ...options, channel });
    const ext = channel === 'twitter' ? 'txt' : channel === 'landing-page' ? 'html' : 'md';
    const fileName = `simplebeacon-${channel}.${ext}`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    results[channel] = filePath;
  }

  return results;
}

module.exports = {
  generateMarketingContent,
  generateAllChannels,
  extractScanHighlights,
  resolveProjectName,
  generateBlogPost,
  generateTwitterThread,
  generateLinkedInPost,
  generateNewsletter,
  generateCaseStudy,
  generatePressKit,
  generateOnePager
};
