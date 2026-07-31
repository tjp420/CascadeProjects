// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Run all gate pattern passes against an explicit file list (no directory skip lists).
 */

const { scanTextContent } = require('./credential-pattern-scanner');
const { scanFileContent: scanProductionLeakContent } = require('../rules/production-leak');
const {
  scanTextPatterns: scanLlmSlopText,
  scanSuspiciousDependencies,
} = require('../rules/llm-slop-patterns');
const { scanTextPatterns: scanAgencyHandoffText } = require('../rules/agency-handoff-patterns');
const {
  buildPatternsFromBaseline,
  scanFileContent: scanFictionFileContent,
} = require('../rules/fiction-kpi-patterns');
const { scanEuAiActFileContent } = require('../rules/eu-ai-act-patterns');
const { scanTextPatterns: scanTokenBleedText } = require('../rules/token-bleed-patterns');
const {
  scanTextPatterns: scanArchitectureDriftText,
} = require('../rules/architecture-drift-patterns');
const { scanSecurityPatterns } = require('../rules/security-pattern-scanner');

function isUnderProductionPaths(relativePath, productionPaths = ['server/', 'src/']) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  return (productionPaths || []).some((prefix) => {
    const normalized = String(prefix || '')
      .replace(/\\/g, '/')
      .replace(/\/$/, '');
    if (!normalized) return false;
    return rel === normalized || rel.startsWith(`${normalized}/`);
  });
}

function runTextRulePasses(relativePath, content, ext, options = {}) {
  if (typeof content === 'string' && /simplebeacon-ignore/i.test(content.substring(0, 500))) {
    return {
      issues: [],
      counts: {
        credentials: 0,
        productionLeak: 0,
        llmSlop: 0,
        agencyHandoff: 0,
        fictionKpi: 0,
        euAiAct: 0,
        tokenBleed: 0,
        architectureDrift: 0,
        security: 0,
      },
      euStats: null,
    };
  }
  const issues = [];
  const counts = {
    credentials: 0,
    productionLeak: 0,
    llmSlop: 0,
    agencyHandoff: 0,
    fictionKpi: 0,
    euAiAct: 0,
    tokenBleed: 0,
    architectureDrift: 0,
    security: 0,
  };

  const cred = scanTextContent(relativePath.split(/[/\\]/).pop(), content, relativePath);
  counts.credentials = cred.length;
  issues.push(...cred);

  if (options.productionLeak !== false) {
    const prodOnly = options.productionPathsOnly === true;
    const prodPaths = options.productionPaths || ['server/', 'src/'];
    if (!prodOnly || isUnderProductionPaths(relativePath, prodPaths)) {
      const leak = scanProductionLeakContent(
        relativePath,
        content,
        options.productionLeakOptions || {}
      );
      counts.productionLeak = leak.findings.length;
      issues.push(...leak.findings);
    }
  }

  const slop = scanLlmSlopText(relativePath, content, ext);
  counts.llmSlop = slop.length;
  issues.push(...slop);
  issues.push(...scanSuspiciousDependencies(relativePath, content));

  if (options.agencyHandoff !== false) {
    const prodOnly = options.productionPathsOnly === true;
    const prodPaths = options.productionPaths || ['server/', 'src/'];
    if (!prodOnly || isUnderProductionPaths(relativePath, prodPaths)) {
      const handoff = scanAgencyHandoffText(relativePath, content, ext);
      counts.agencyHandoff = handoff.length;
      issues.push(...handoff);
    }
  }

  if (options.fictionPatterns?.length) {
    const fiction = scanFictionFileContent(relativePath, content, options.fictionPatterns, ext);
    counts.fictionKpi = fiction.length;
    issues.push(...fiction);
  }

  let euStats = null;
  if (options.euAiAct !== false) {
    const eu = scanEuAiActFileContent(relativePath, content, options.euAiActSeverity || 'medium');
    counts.euAiAct = eu.issues.length;
    issues.push(...eu.issues);
    euStats = {
      highRiskHits: eu.highRiskHits,
      aiSystemHits: eu.aiSystemHits,
      transparencyGaps: eu.transparencyGaps,
    };
  }

  const isUniversal = options.universal === true;
  const prodOnly = !isUniversal && options.productionPathsOnly === true;
  const prodPaths = options.productionPaths || ['server/', 'src/', 'app/', 'lib/'];

  if (options.tokenBleed !== false) {
    if (!prodOnly || isUnderProductionPaths(relativePath, prodPaths)) {
      const tokenBleed = scanTokenBleedText(relativePath, content, ext, {
        productionPathsOnly: true,
        productionPaths: prodPaths,
      });
      counts.tokenBleed = tokenBleed.length;
      issues.push(...tokenBleed);
    }
  }

  if (options.architectureDrift !== false) {
    if (!prodOnly || isUnderProductionPaths(relativePath, prodPaths)) {
      const drift = scanArchitectureDriftText(relativePath, content, ext, {
        productionPathsOnly: true,
        productionPaths: prodPaths,
      });
      counts.architectureDrift = drift.length;
      issues.push(...drift);
    }
  }

  if (options.security !== false) {
    const sec = scanSecurityPatterns(relativePath, content, ext);
    counts.security = sec.length;
    issues.push(...sec);
  }

  return { issues, counts, euStats };
}

function buildFictionPatterns(config = {}, enabled = true) {
  if (!enabled || config.fictionPatterns === false) return [];
  return buildPatternsFromBaseline(config.baseline || {});
}

module.exports = {
  runTextRulePasses,
  buildFictionPatterns,
  isUnderProductionPaths,
};
