// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * EU AI Act readiness patterns — high-risk indicators (Annex III), Article 50
 * transparency, and documentation completeness signals.
 *
 * Static pattern scan only — not legal advice or formal conformity assessment.
 */

const fs = require('fs');
const path = require('path');
const { globMatch, walkProductionFiles } = require('./production-leak');

const DEFAULT_SOURCE_PATHS = [
  'server',
  'src',
  'web',
  'lib',
  'packages',
  'app',
  'api',
  'config',
  'docs',
];
const DEFAULT_PRODUCTION_PATHS = ['server/', 'src/', 'app/', 'lib/', 'api/', 'web/'];
const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.html',
  '.vue',
  '.svelte',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.toml',
  '.txt',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  'archive',
  '.simplebeacon',
  'tests',
  'test',
  '__tests__',
  'fixtures',
  'examples',
  'docs',
  'coming-soon',
  'reports',
  'security-reports',
  'templates',
  'data-central',
  'deployments',
  'public',
  'functions',
  'cloudflare-deploy',
  'temp',
  'tests-legacy',
  '.github-sync',
  '.cursor',
  '.vscode',
  'downloads',
  'findings',
  'simplebeacon-rule-tests',
  'simplebeacon-toxic-fixtures',
]);
const MAX_SCAN_BYTES = 512000;

const DOCUMENTATION_MARKERS = [
  { id: 'model-card', pattern: /model[-_\s]?card/i, label: 'Model card' },
  {
    id: 'technical-documentation',
    pattern: /technical[-_\s]?documentation|ai[-_\s]?system[-_\s]?documentation/i,
    label: 'Technical documentation',
  },
  {
    id: 'risk-assessment',
    pattern: /risk[-_\s]?assessment|fundamental[-_\s]?rights[-_\s]?impact/i,
    label: 'Risk assessment / FRIA',
  },
  {
    id: 'conformity-declaration',
    pattern: /conformity[-_\s]?declaration|eu[-_\s]?declaration[-_\s]?of[-_\s]?conformity/i,
    label: 'Conformity declaration',
  },
  {
    id: 'eu-ai-act',
    pattern: /eu[-_\s]?ai[-_\s]?act|regulation\s*\(\s*eu\s*\)\s*2024\/1689/i,
    label: 'EU AI Act reference',
  },
];

const DOCUMENTATION_FILE_NAMES = [
  'model-card.md',
  'MODEL_CARD.md',
  'ai-system-documentation.md',
  'risk-assessment.md',
  'conformity-declaration.md',
  'eu-ai-act-compliance.md',
];

const HIGH_RISK_CATALOG = [
  {
    id: 'EUAI-HR-001',
    annex: 'III.4',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:resume|curriculum\s+vitae|cv)\s*(?:screen|scor|rank|filter|match)|(?:candidate|applicant)\s*(?:scor|rank|filter|screen)|(?:hiring|recruitment|employment)\s*(?:decision|ai|model|automated)/gi,
    severity: 'high',
    description: 'Employment or recruitment AI decision pattern (Annex III area)',
    fixTemplate:
      'Implement human-in-the-loop review before any automated hiring decision. Add an appeal mechanism and document the FRIA (Fundamental Rights Impact Assessment). Ensure candidates are notified of AI screening.',
  },
  {
    id: 'EUAI-HR-002',
    annex: 'III.5',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:credit\s*score|creditworthiness|loan\s*approv|lending\s*decision|underwriting\s*model|default\s*risk\s*model)/gi,
    severity: 'high',
    description: 'Credit or lending AI decision pattern (Annex III area)',
    fixTemplate:
      'Add explainability logging for every credit decision. Implement a human override mechanism and provide applicants with a right-to-explanation. Document the model risk assessment.',
  },
  {
    id: 'EUAI-HR-003',
    annex: 'III.1',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:biometric\s*identif|facial\s*recognition|face\s*match|emotion\s*detect|gait\s*recognition)/gi,
    severity: 'high',
    description: 'Biometric identification or categorisation pattern (Annex III area)',
    fixTemplate:
      'Biometric AI is classified as unacceptable or high-risk under EU AI Act. Remove real-time biometric identification in public spaces, or seek explicit regulatory approval and implement strict data retention limits.',
  },
  {
    id: 'EUAI-HR-004',
    annex: 'III.3',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:exam\s*grad|student\s*assessment\s*automated|admission\s*decision\s*ai|education\s*ai\s*score)/gi,
    severity: 'high',
    description: 'Education or vocational training AI assessment pattern (Annex III area)',
    fixTemplate:
      'Ensure educators can override AI-generated scores. Provide students with transparent scoring criteria and an appeal process. Document how the model was trained and validated.',
  },
  {
    id: 'EUAI-HR-005',
    annex: 'III.6',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:insurance\s*premium\s*ai|insurance\s*underwriting\s*model|claims\s*automated\s*decision)/gi,
    severity: 'high',
    description: 'Insurance pricing or claims AI pattern (Annex III area)',
    fixTemplate:
      'Disclose to policyholders when AI contributes to premium or claim decisions. Maintain an audit trail of model inputs/outputs. Implement a human review process for denied claims.',
  },
  {
    id: 'EUAI-HR-006',
    annex: 'III.7',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:predictive\s*policing|criminal\s*risk\s*score|recidivism\s*model|law\s*enforcement\s*ai)/gi,
    severity: 'high',
    description: 'Law enforcement risk assessment AI pattern (Annex III area)',
    fixTemplate:
      'Law enforcement risk-scoring AI requires strict human oversight. Ensure every automated risk score is reviewed by an officer before action. Document bias testing and accuracy metrics.',
  },
  {
    id: 'EUAI-HR-007',
    annex: 'III.8',
    category: 'high-risk',
    type: 'EU AI Act — High-Risk Indicator',
    regex:
      /\b(?:migration\s*screen|asylum\s*decision\s*ai|border\s*control\s*ai|visa\s*automated\s*decision)/gi,
    severity: 'high',
    description: 'Migration, asylum, or border control AI pattern (Annex III area)',
    fixTemplate:
      'Migration AI decisions must preserve due process. Add a mandatory human review before any adverse decision. Provide applicants with a right to contest and explain the automated reasoning.',
  },
];

const AI_SYSTEM_INDICATORS = [
  {
    id: 'EUAI-AI-001',
    category: 'ai-system',
    type: 'EU AI Act — AI System Indicator',
    regex:
      /\b(?:openai|anthropic|claude|gpt-[\d.o]|chatgpt|llm\.|large\s*language\s*model|generative\s*ai|text-generation|chat\.completions|embeddings\.create)/gi,
    severity: 'medium',
    description: 'Generative AI or LLM integration detected',
    fixTemplate:
      'Add transparency disclosure in the UI (Article 50). Log all AI-generated content with a traceable ID. Document the model version, training data cutoff, and known limitations in your model-card.md.',
  },
  {
    id: 'EUAI-AI-002',
    category: 'ai-system',
    type: 'EU AI Act — AI System Indicator',
    regex:
      /\b(?:machine\s*learning|ml\.predict|model\.predict|inference\s*endpoint|tensorflow|pytorch|onnxruntime|huggingface)/gi,
    severity: 'medium',
    description: 'Machine learning inference or model runtime detected',
    fixTemplate:
      'Document the ML model purpose, performance metrics, and bias test results. Add input validation and confidence thresholds before returning predictions to users.',
  },
];

// --- EU AI Act Articles 9-15, 26-27: Compliance Obligations ---

const COMPLIANCE_OBLIGATIONS = [
  {
    id: 'EUAI-RM-001',
    article: '9',
    category: 'risk-management',
    type: 'EU AI Act — Risk Management System (Art. 9)',
    regex:
      /\b(?:risk\s*management\s*(?:system|process|framework)|risk\s*register|risk\s*identification|risk\s*mitigation\s*plan)\b/gi,
    severity: 'medium',
    description:
      'Missing risk management system — no risk register or assessment artifacts detected',
    fixTemplate:
      'Implement a risk management system per Article 9. Create a risk-register.md documenting identified risks, mitigation measures, and residual risks. Update it throughout the AI system lifecycle.',
    isAbsenceRule: true,
  },
  {
    id: 'EUAI-DG-001',
    article: '10',
    category: 'data-governance',
    type: 'EU AI Act — Data Governance (Art. 10)',
    regex:
      /(?:fetch|axios|http\.get|requests\.get)\s*\(\s*['"](?:https?:)?\/\/[^'"]*(?:scrape|crawl|dataset|training|corpus)/gi,
    severity: 'medium',
    description:
      'Training or evaluation data sourced from unvalidated URLs without data governance controls',
    fixTemplate:
      'Implement data governance per Article 10. Validate all training data sources. Document data provenance, quality measures, and bias testing. Create a data-governance.md artifact.',
    isAbsenceRule: false,
  },
  {
    id: 'EUAI-RK-001',
    article: '12',
    category: 'record-keeping',
    type: 'EU AI Act — Record-Keeping (Art. 12)',
    regex:
      /\b(?:auto(?:mated)?\s*(?:approve|reject|decision|score|rank)|automated\s*processing)\b/gi,
    severity: 'medium',
    description: 'Automated AI decision without automatic logging capability',
    fixTemplate:
      'Implement automatic logging per Article 12. Wrap every automated decision with an audit logger recording inputs, outputs, model version, timestamp, and human review status.',
    isAbsenceRule: true,
    requiresLogging: true,
  },
  {
    id: 'EUAI-TI-001',
    article: '13',
    category: 'transparency-deployers',
    type: 'EU AI Act — Transparency to Deployers (Art. 13)',
    regex: /\b(?:instructions\s*for\s*use|deployer\s*guide|user\s*manual|operator\s*guide)\b/gi,
    severity: 'medium',
    description:
      'Missing transparency documentation for deployers — no instructions-for-use artifact detected',
    fixTemplate:
      'Create instructions-for-use.md per Article 13. Include: intended purpose, accuracy metrics, known limitations, human oversight measures, and expected lifetime of the AI system.',
    isAbsenceRule: true,
  },
  {
    id: 'EUAI-HO-002',
    article: '14',
    category: 'human-oversight',
    type: 'EU AI Act — Human Oversight Gap (Art. 14)',
    regex:
      /\b(?:auto(?:matic)?\s*(?:approve|reject|decision)|fully\s*automated\s*(?:decision|approval|rejection)|no\s*human\s*(?:review|oversight|intervention))\b/gi,
    severity: 'high',
    description: 'Fully automated AI decision without human override mechanism',
    fixTemplate:
      'Implement human oversight per Article 14. Add a mandatory human review checkpoint before any automated decision is finalized. Provide an override mechanism and appeal process.',
    isAbsenceRule: false,
  },
  {
    id: 'EUAI-RAS-001',
    article: '15',
    category: 'robustness',
    type: 'EU AI Act — Robustness and Accuracy (Art. 15)',
    regex:
      /\b(?:accuracy\s*test|benchmark\s*eval|model\s*evaluation|robustness\s*test|stress\s*test\s*model)\b/gi,
    severity: 'medium',
    description: 'Missing robustness, accuracy, and cybersecurity testing artifacts',
    fixTemplate:
      'Implement robustness testing per Article 15. Create model-evaluation.md documenting accuracy metrics, adversarial test results, and cybersecurity measures. Run benchmarks throughout the lifecycle.',
    isAbsenceRule: true,
  },
  {
    id: 'EUAI-DEP-001',
    article: '26',
    category: 'deployer-obligations',
    type: 'EU AI Act — Deployer Obligations (Art. 26)',
    regex:
      /\b(?:deploy(?:ing|ment)?\s*(?:ai|model|system)|production\s*(?:ai|model|inference))\b/gi,
    severity: 'medium',
    description: 'High-risk AI system deployed without deployer obligation compliance',
    fixTemplate:
      'Fulfill deployer obligations per Article 26. Assign human oversight individuals, ensure staff are trained, and implement monitoring. Document the deployment decision and retain logs.',
    isAbsenceRule: false,
  },
  {
    id: 'EUAI-FRIA-001',
    article: '27',
    category: 'fundamental-rights',
    type: 'EU AI Act — Fundamental Rights Impact Assessment (Art. 27)',
    regex: /\b(?:fundamental\s*rights\s*impact\s*assessment|fria)\b/gi,
    severity: 'high',
    description: 'Missing Fundamental Rights Impact Assessment (FRIA) for high-risk AI deployment',
    fixTemplate:
      'Conduct a FRIA per Article 27 before deploying high-risk AI. Document: intended use, affected groups, specific risks to fundamental rights, mitigation measures, and human oversight plan. Create fria.md.',
    isAbsenceRule: true,
    requiresHighRisk: true,
  },
];

const COMPLIANCE_ARTIFACT_NAMES = [
  'risk-register.md',
  'risk-assessment.md',
  'data-governance.md',
  'data-quality.md',
  'instructions-for-use.md',
  'deployer-guide.md',
  'fria.md',
  'fundamental-rights-impact-assessment.md',
  'robustness-test.md',
  'model-evaluation.md',
  'audit-log.md',
  'decision-log.md',
];

const COMPLIANCE_ARTIFACT_MARKERS = [
  {
    id: 'risk-register',
    pattern: /risk\s*register|risk\s*management\s*system/i,
    label: 'Risk register',
  },
  {
    id: 'data-governance',
    pattern: /data\s*governance|data\s*quality\s*plan/i,
    label: 'Data governance',
  },
  {
    id: 'instructions-for-use',
    pattern: /instructions\s*for\s*use|deployer\s*guide/i,
    label: 'Instructions for use',
  },
  { id: 'fria', pattern: /fundamental\s*rights\s*impact\s*assessment|fria/i, label: 'FRIA' },
  {
    id: 'robustness-test',
    pattern: /robustness\s*test|model\s*evaluation\s*report/i,
    label: 'Robustness test',
  },
  { id: 'audit-log', pattern: /audit\s*log|decision\s*log/i, label: 'Audit log' },
];

const TRANSPARENCY_DISCLOSURE_PATTERNS = [
  /\bai[-\s]?generated\b/i,
  /\bgenerated\s+by\s+(?:an?\s+)?ai\b/i,
  /\bartificial\s+intelligence\b/i,
  /\bthis\s+(?:content|response|output)\s+(?:was|is)\s+(?:automatically\s+)?generated\b/i,
  /\byou\s+are\s+(?:chatting|interacting)\s+with\s+(?:an?\s+)?ai\b/i,
  /\bautomated\s+(?:decision|recommendation)\b/i,
  /\beu\s+ai\s+act\b/i,
  /\barticle\s+50\b/i,
];

const HUMAN_OVERSIGHT_PATTERNS = [
  /\bhuman[-\s]?(?:in[-\s]the[-\s]loop|oversight|review|approval)\b/i,
  /\bmanual\s+(?:review|approval|override|intervention)\b/i,
  /\boperator\s+override\b/i,
  /\bappeal\s+(?:process|mechanism|right)\b/i,
  /\bhuman\s+supervision\b/i,
];

const LOGGING_PATTERNS = [
  /\b(?:audit|decision|inference|model)\s*log(?:ger|ging)?\b/i,
  /\bai\s*audit\b/i,
  /\btrace(?:Id|_id)\b/i,
  /\blog(?:Model|Inference|Decision)(?:Event|Record)?\b/i,
  /\brecord(?:AI|Model|Inference)Decision\b/i,
];

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join('/');
}

function lineNumberAt(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function extractLineAt(content, index) {
  const lines = content.split('\n');
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (index >= pos && index < pos + line.length + 1) {
      return { line: i + 1, text: line.trim(), start: pos };
    }
    pos += line.length + 1;
  }
  return { line: content.slice(0, Math.max(0, index)).split('\n').length, text: '', start: 0 };
}

function buildEvidence(rule, lineText, match) {
  const snippet = lineText.slice(0, 120) || match[0].slice(0, 120);
  return `Matched "${rule.id}" in code: "${snippet}" — ${rule.description}`;
}

function buildFix(rule, relativePath, lineNumber, lineText) {
  const fileName = typeof relativePath === 'string' ? path.basename(relativePath) : 'file';
  if (rule.fixTemplate) return rule.fixTemplate;
  if (rule.category === 'high-risk') {
    return `Document Annex III classification for ${fileName} at line ${lineNumber}. Conduct a FRIA and implement high-risk system requirements before August 2026.`;
  }
  return `Review EU AI Act transparency and documentation obligations for the AI integration in ${fileName}:${lineNumber}.`;
}

function isExcludedPath(relativePath) {
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (/(?:^|\/)src\/(?:rules|reporters|analyzers|proxy)(?:\/|$)/.test(normalized)) return true;
  if (/\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|proxy|lib)\//.test(normalized))
    return true;
  if (/(?:^|\/)coming-soon\//.test(normalized)) return true;
  if (/(?:^|\/)reports\//.test(normalized)) return true;
  if (/(?:^|\/)security-reports\//.test(normalized)) return true;
  if (/(?:^|\/)templates\//.test(normalized)) return true;
  if (/(?:^|\/)data-central\//.test(normalized)) return true;
  if (/(?:^|\/)deployments\//.test(normalized)) return true;
  if (/(?:^|\/)public\//.test(normalized)) return true;
  if (/(?:^|\/)functions\//.test(normalized)) return true;
  if (/(?:^|\/)cloudflare-deploy\//.test(normalized)) return true;
  if (/(?:^|\/)archive\//.test(normalized)) return true;
  if (/(?:^|\/)temp\//.test(normalized)) return true;
  if (/(?:^|\/)tests-legacy\//.test(normalized)) return true;
  if (/(?:^|\/)downloads\//.test(normalized)) return true;
  if (/(?:^|\/)web\/(?:data|findings|simplebeacon-findings)\//.test(normalized)) return true;
  if (/(?:^|\/)web\/simplebeacon-dashboard\/js\/(?:views\/|utils\/|utils\.js$)/.test(normalized))
    return true;
  if (/(?:^|\/)server\/test-gateway\.js$/.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-frameworkless\//.test(normalized)) return true;
  if (/\.(?:env|env\.example)$/.test(normalized)) return true;
  if (/(?:^|\/)docs\//.test(normalized)) return true;
  if (/(?:^|\/)server\/(?:routes|services|lib)\//.test(normalized)) return true;
  if (/(?:^|\/)ai-agent\//.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-rule-tests\//.test(normalized)) return true;
  if (/(?:^|\/)simplebeacon-toxic-fixtures\//.test(normalized)) return true;
  if (/(?:^|\/)\.github-sync\//.test(normalized)) return true;
  if (/(?:^|\/)tests\//.test(normalized)) return true;
  if (/(?:^|\/)test\//.test(normalized)) return true;
  if (/\.test\.js$/i.test(normalized)) return true;
  return false;
}

async function walkSourceFiles(baseDir, sourcePaths, results = []) {
  if (!Array.isArray(sourcePaths)) return results;
  for (const rel of sourcePaths) {
    const abs = path.join(baseDir, ...String(rel).replace(/\/$/, '').split('/'));
    const stat = await fs.promises.stat(abs).catch(() => null);
    if (!stat) continue;
    if (stat.isFile()) {
      const ext = path.extname(abs).toLowerCase();
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        results.push({ path: abs, ext });
      }
      continue;
    }
    await walkDir(abs, results);
  }
  return results;
}

async function walkDir(dir, results, depth = 0) {
  if (depth > 8) return;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, results, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SCANNABLE_EXTENSIONS.has(ext)) {
      results.push({ path: fullPath, ext });
    }
  }
}

function collapsePatternIssuesByFile(issues, relativePath) {
  if (!issues.length) return [];
  const patternId = issues[0].metadata?.patternId || issues[0].type;
  const matches = [...new Set(issues.map((i) => i.metadata?.match).filter(Boolean))];
  const lines = issues.map((i) => i.metadata?.lineNumber).filter(Boolean);
  return [
    {
      ...issues[0],
      id: `${patternId}-${relativePath}`,
      filePath: relativePath,
      count: issues.length,
      description:
        issues.length > 1
          ? `${issues[0].description} (${issues.length} matches in file)`
          : issues[0].description,
      affectedFiles: [relativePath],
      metadata: {
        ...(issues[0].metadata || {}),
        matchCount: issues.length,
        matches: matches.slice(0, 8),
        lines: lines.length ? lines : undefined,
      },
    },
  ];
}

function scanCatalogPatterns(relativePath, content, catalog, severityDefault) {
  const issues = [];
  for (const rule of catalog) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const { line, text } = extractLineAt(content, match.index);
      const evidence = buildEvidence(rule, text, match);
      const fix = buildFix(rule, relativePath, line, text);
      issues.push({
        id: `${rule.id}-${relativePath}-${match.index}`,
        severity: rule.severity || severityDefault,
        type: rule.type,
        filePath: relativePath,
        lineNumber: line,
        count: 1,
        description: rule.description,
        recommendedAction: fix,
        evidence,
        affectedFiles: [relativePath],
        metadata: {
          patternId: rule.id,
          category: rule.category,
          annex: rule.annex || null,
          match: match[0].slice(0, 80),
          lineNumber: line,
          codeLine: text.slice(0, 120),
        },
      });
    }
  }
  return issues;
}

function hasTransparencyDisclosure(content) {
  return TRANSPARENCY_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(content));
}

function scanTransparencyGaps(relativePath, content, severityDefault) {
  const issues = [];
  const normalized = String(relativePath || '')
    .toLowerCase()
    .replace(/\\/g, '/');

  if (/\.(?:env|env\.example)$/.test(normalized)) return issues;
  if (/(?:^|\/)server\/(?:routes|services|lib)\//.test(normalized)) return issues;
  if (/(?:^|\/)packages\/simplebeacon-cli\/docs\//.test(normalized)) return issues;
  if (/(?:^|\/)outreach/.test(normalized)) return issues;

  let firstAiLine = 0;
  let firstAiLineText = '';
  const hasAiIndicator = AI_SYSTEM_INDICATORS.some((rule) => {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(content)) !== null) {
      if (!firstAiLine) {
        const loc = extractLineAt(content, m.index);
        firstAiLine = loc.line;
        firstAiLineText = loc.text;
      }
      return true;
    }
    return false;
  });
  if (!hasAiIndicator) return issues;

  const isUiFacing =
    /\.(html|tsx|jsx|vue|svelte|md)$/i.test(relativePath) ||
    /(?:component|page|view|ui|frontend|chat)/i.test(relativePath);
  if (!isUiFacing) return issues;

  if (!hasTransparencyDisclosure(content)) {
    const evidence = firstAiLine
      ? `AI integration detected at line ${firstAiLine}: "${firstAiLineText.slice(0, 100)}" — no Article 50 disclosure found in this file.`
      : 'AI system integration in user-facing code without transparency/disclosure markers';
    issues.push({
      id: `EUAI-T50-001-${relativePath}`,
      severity: severityDefault,
      type: 'EU AI Act — Transparency Gap (Art. 50)',
      filePath: relativePath,
      lineNumber: firstAiLine || undefined,
      count: 1,
      description:
        'AI system integration in user-facing code without transparency/disclosure markers',
      recommendedAction: `Add an Article 50 disclosure in ${path.basename(relativePath)} near line ${firstAiLine || '—'} — e.g., a visible banner or label stating "This content is AI-generated" or "You are interacting with an AI system".`,
      evidence,
      affectedFiles: [relativePath],
      metadata: {
        patternId: 'EUAI-T50-001',
        category: 'transparency',
        article: '50',
        lineNumber: firstAiLine || undefined,
      },
    });
  }
  return issues;
}

function scanHumanOversightGaps(relativePath, content, hasHighRiskInFile, severityDefault) {
  if (!hasHighRiskInFile) return [];
  if (HUMAN_OVERSIGHT_PATTERNS.some((pattern) => pattern.test(content))) return [];

  let hrLine = 0;
  let hrLineText = '';
  for (const rule of HIGH_RISK_CATALOG) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = regex.exec(content)) !== null) {
      if (!hrLine) {
        const loc = extractLineAt(content, m.index);
        hrLine = loc.line;
        hrLineText = loc.text;
      }
      break;
    }
    if (hrLine) break;
  }

  const evidence = hrLine
    ? `High-risk pattern at line ${hrLine}: "${hrLineText.slice(0, 100)}" — no human oversight signals found in this file.`
    : 'High-risk AI pattern without human oversight or appeal signals in same file';

  return [
    {
      id: `EUAI-HO-001-${relativePath}`,
      severity: severityDefault,
      type: 'EU AI Act — Human Oversight Gap',
      filePath: relativePath,
      lineNumber: hrLine || undefined,
      count: 1,
      description: 'High-risk AI pattern without human oversight or appeal signals in same file',
      recommendedAction: `In ${path.basename(relativePath)} near line ${hrLine || '—'}, add a human-in-the-loop checkpoint — e.g., a function that requires manual approval before the AI decision is finalized. Implement an appeal mechanism.`,
      evidence,
      affectedFiles: [relativePath],
      metadata: {
        patternId: 'EUAI-HO-001',
        category: 'human-oversight',
        lineNumber: hrLine || undefined,
      },
    },
  ];
}

function scanLoggingGaps(relativePath, content, hasAiInFile, severityDefault) {
  if (!hasAiInFile) return [];
  if (LOGGING_PATTERNS.some((pattern) => pattern.test(content))) return [];
  const isDecisionPath = /(?:route|controller|service|handler|api)/i.test(relativePath);
  if (!isDecisionPath) return [];

  let aiLine = 0;
  let aiLineText = '';
  for (const rule of AI_SYSTEM_INDICATORS) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = regex.exec(content)) !== null) {
      if (!aiLine) {
        const loc = extractLineAt(content, m.index);
        aiLine = loc.line;
        aiLineText = loc.text;
      }
      break;
    }
    if (aiLine) break;
  }

  const evidence = aiLine
    ? `AI decision path at line ${aiLine}: "${aiLineText.slice(0, 100)}" — no audit or inference logging found in this file.`
    : 'AI decision path without audit or inference logging signals';

  return [
    {
      id: `EUAI-LOG-001-${relativePath}`,
      severity: 'low',
      type: 'EU AI Act — Logging Gap',
      filePath: relativePath,
      lineNumber: aiLine || undefined,
      count: 1,
      description: 'AI decision path without audit or inference logging signals',
      recommendedAction: `In ${path.basename(relativePath)} near line ${aiLine || '—'}, wrap the AI call with an audit logger — e.g., \`logDecision({input, output, modelVersion, timestamp})\` — to record inputs, outputs, and decision rationale for EU AI Act accountability.`,
      evidence,
      affectedFiles: [relativePath],
      metadata: { patternId: 'EUAI-LOG-001', category: 'logging', lineNumber: aiLine || undefined },
    },
  ];
}

function detectDocumentationArtifacts(baseDir) {
  const found = [];
  const searchRoots = [
    baseDir,
    path.join(baseDir, 'docs'),
    path.join(baseDir, 'documentation'),
    path.join(baseDir, '.simplebeacon'),
  ];

  // Also search one level of subdirectories for nested docs (e.g., monorepo/ai-platform/docs)
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      searchRoots.push(path.join(baseDir, entry.name, 'docs'));
      searchRoots.push(path.join(baseDir, entry.name, 'documentation'));
    }
  } catch {
    // ignore read errors on baseDir
  }

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    for (const fileName of DOCUMENTATION_FILE_NAMES) {
      const filePath = path.join(root, fileName);
      if (fs.existsSync(filePath)) {
        found.push({ id: 'file', label: fileName, path: normalizeRel(baseDir, filePath) });
      }
    }
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (/\.simplebeacon-backup\./i.test(entry.name)) continue;
      const fullPath = path.join(root, entry.name);
      let content;
      try {
        if (fs.statSync(fullPath).size > MAX_SCAN_BYTES) continue;
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      for (const marker of DOCUMENTATION_MARKERS) {
        if (marker.pattern.test(content) || marker.pattern.test(entry.name)) {
          found.push({
            id: marker.id,
            label: marker.label,
            path: normalizeRel(baseDir, fullPath),
          });
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  const seenPaths = new Set();
  for (const item of found) {
    const key = `${item.id}:${item.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const documentationFound = [];
  for (const item of unique) {
    if (seenPaths.has(item.path)) continue;
    seenPaths.add(item.path);
    documentationFound.push(item.path);
  }

  return { artifacts: unique, paths: documentationFound };
}

function hasDocumentedAiInventory(documentation) {
  const paths = documentation.paths || [];
  const hasSystemDoc = paths.some((p) => /(?:^|\/)ai-system-documentation\.md$/i.test(p));
  const hasComplianceDoc = paths.some((p) =>
    /(?:^|\/)(?:eu-ai-act-compliance|conformity-declaration)\.md$/i.test(p)
  );
  return hasSystemDoc && hasComplianceDoc;
}

function filterDocumentedAiInventoryIssues(issues, documentation, summary) {
  if (!hasDocumentedAiInventory(documentation)) return issues;
  if ((summary.highRiskIndicators || 0) > 0) return issues;
  return issues.filter((issue) => {
    const patternId = issue.metadata?.patternId;
    return patternId !== 'EUAI-AI-001' && patternId !== 'EUAI-AI-002';
  });
}

async function scanEuAiActPatterns(baseDir, options = {}) {
  const sourcePaths = options.sourcePaths || DEFAULT_SOURCE_PATHS;
  const productionPaths = options.productionPaths || DEFAULT_PRODUCTION_PATHS;
  const ignoreGlobs = options.ignoreGlobs || [];
  const severityDefault = options.severity || 'medium';

  const files = [];
  await walkSourceFiles(baseDir, sourcePaths, files);
  for (const rel of productionPaths) {
    const abs = path.join(baseDir, ...rel.replace(/\/$/, '').split('/'));
    if (fs.existsSync(abs)) {
      await walkProductionFiles(abs, files);
    }
  }

  const seen = new Set();
  const uniqueFiles = [];
  for (const file of files) {
    const key = file.path;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFiles.push(file);
  }

  const issues = [];
  let scanned = 0;
  let highRiskHits = 0;
  let aiSystemHits = 0;
  let transparencyGaps = 0;

  for (const file of uniqueFiles) {
    const relativePath = normalizeRel(baseDir, file.path);
    if (ignoreGlobs.some((g) => globMatch(relativePath, g))) continue;
    if (isExcludedPath(relativePath)) continue;

    let content;
    try {
      const stat = await fs.promises.stat(file.path);
      if (stat.size > MAX_SCAN_BYTES) continue;
      content = await fs.promises.readFile(file.path, 'utf8');
    } catch {
      continue;
    }

    if (/simplebeacon-ignore/i.test(content.substring(0, 500))) continue;

    scanned += 1;
    const ext = file.ext || path.extname(file.path).toLowerCase();

    const highRiskIssues = scanCatalogPatterns(relativePath, content, HIGH_RISK_CATALOG, 'high');
    const aiIssues = scanCatalogPatterns(
      relativePath,
      content,
      AI_SYSTEM_INDICATORS,
      severityDefault
    );
    highRiskHits += highRiskIssues.length > 0 ? 1 : 0;
    aiSystemHits += aiIssues.length > 0 ? 1 : 0;
    issues.push(...collapsePatternIssuesByFile(highRiskIssues, relativePath));
    issues.push(...collapsePatternIssuesByFile(aiIssues, relativePath));

    const transparencyIssues = scanTransparencyGaps(relativePath, content, severityDefault);
    transparencyGaps += transparencyIssues.length;
    issues.push(...transparencyIssues);

    const hasHighRisk = highRiskIssues.length > 0;
    const hasAi = aiIssues.length > 0 || hasHighRisk;
    issues.push(...scanHumanOversightGaps(relativePath, content, hasHighRisk, severityDefault));
    issues.push(...scanLoggingGaps(relativePath, content, hasAi, severityDefault));

    // --- Articles 9-27 compliance obligations ---
    const complianceIssues = scanComplianceObligations(
      relativePath,
      content,
      hasHighRisk,
      hasAi,
      severityDefault
    );
    issues.push(...complianceIssues);
  }

  // Detect compliance documentation artifacts
  const complianceDocs = detectComplianceArtifacts(baseDir);
  const documentation = detectDocumentationArtifacts(baseDir);

  // Check for absence-rule artifacts and generate findings for missing ones
  const absenceIssues = scanAbsenceComplianceGaps(
    baseDir,
    complianceDocs,
    highRiskHits > 0,
    severityDefault
  );
  issues.push(...absenceIssues);

  const filteredIssues = filterDocumentedAiInventoryIssues(issues, documentation, {
    highRiskIndicators: highRiskHits,
    transparencyGaps,
  });
  const summary = {
    highRiskIndicators: highRiskHits,
    aiSystemIndicators: aiSystemHits,
    transparencyGaps,
    documentationArtifacts: documentation.artifacts.length,
    documentationFound: documentation.paths,
    complianceObligations: absenceIssues.length,
    complianceArtifacts: complianceDocs.artifacts.length,
    complianceArtifactsFound: complianceDocs.paths,
    missingArtifacts: absenceIssues.map((i) => i.metadata?.patternId).filter(Boolean),
    articlesCovered: ['9', '10', '11', '12', '13', '14', '15', '26', '27'],
    deadlineNote: 'High-risk AI systems must comply with EU AI Act requirements by August 2026',
  };

  return {
    scanned,
    findings: filteredIssues.length,
    issues: filteredIssues,
    summary,
    patterns: [...HIGH_RISK_CATALOG, ...AI_SYSTEM_INDICATORS, ...COMPLIANCE_OBLIGATIONS].map(
      (r) => r.id
    ),
  };
}

// --- Compliance obligation scanning (Articles 9-27) ---

function scanComplianceObligations(relativePath, content, hasHighRisk, hasAi, severityDefault) {
  const issues = [];
  if (!hasAi) return issues;

  for (const rule of COMPLIANCE_OBLIGATIONS) {
    if (rule.isAbsenceRule) continue; // absence rules handled by artifact detection
    if (rule.requiresHighRisk && !hasHighRisk) continue;

    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = regex.exec(content)) !== null) {
      const loc = extractLineAt(content, m.index);
      const snippet = loc.text.slice(0, 120) || m[0].slice(0, 120);
      if (/\/\/\s*simplebeacon-ignore/i.test(snippet)) continue;

      // For rules that require logging, check if logging is present
      if (rule.requiresLogging && LOGGING_PATTERNS.some((p) => p.test(content))) continue;

      issues.push({
        id: `${rule.id}-${relativePath}`,
        severity: rule.severity || severityDefault,
        type: rule.type,
        filePath: relativePath,
        lineNumber: loc.line,
        count: 1,
        description: rule.description,
        recommendedAction: rule.fixTemplate,
        evidence: `Matched "${rule.id}" (Art. ${rule.article}) in code: "${snippet}" — ${rule.description}`,
        affectedFiles: [relativePath],
        metadata: {
          patternId: rule.id,
          category: rule.category,
          article: rule.article,
          lineNumber: loc.line,
        },
      });
      break;
    }
  }
  return issues;
}

function detectComplianceArtifacts(baseDir) {
  const found = [];
  const searchRoots = [
    baseDir,
    path.join(baseDir, 'docs'),
    path.join(baseDir, 'documentation'),
    path.join(baseDir, '.simplebeacon'),
  ];

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      searchRoots.push(path.join(baseDir, entry.name, 'docs'));
      searchRoots.push(path.join(baseDir, entry.name, 'documentation'));
    }
  } catch {
    // ignore
  }

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    for (const fileName of COMPLIANCE_ARTIFACT_NAMES) {
      const filePath = path.join(root, fileName);
      if (fs.existsSync(filePath)) {
        found.push({
          id: fileName.replace(/\.md$/, ''),
          label: fileName,
          path: normalizeRel(baseDir, filePath),
        });
      }
    }
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (/\.simplebeacon-backup\./i.test(entry.name)) continue;
      const fullPath = path.join(root, entry.name);
      let content;
      try {
        if (fs.statSync(fullPath).size > MAX_SCAN_BYTES) continue;
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }
      for (const marker of COMPLIANCE_ARTIFACT_MARKERS) {
        if (marker.pattern.test(content) || marker.pattern.test(entry.name)) {
          found.push({
            id: marker.id,
            label: marker.label,
            path: normalizeRel(baseDir, fullPath),
          });
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  const seenPaths = new Set();
  for (const item of found) {
    const key = `${item.id}:${item.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const documentationFound = [];
  for (const item of unique) {
    if (seenPaths.has(item.path)) continue;
    seenPaths.add(item.path);
    documentationFound.push(item.path);
  }

  return { artifacts: unique, paths: documentationFound };
}

function scanAbsenceComplianceGaps(baseDir, complianceDocs, hasHighRisk, severityDefault) {
  const issues = [];
  const foundIds = new Set(complianceDocs.artifacts.map((a) => a.id));

  for (const rule of COMPLIANCE_OBLIGATIONS) {
    if (!rule.isAbsenceRule) continue;
    if (rule.requiresHighRisk && !hasHighRisk) continue;

    // Map rule to expected artifact IDs
    const artifactIds = {
      'EUAI-RM-001': ['risk-register', 'risk-register.md', 'risk-assessment', 'risk-assessment.md'],
      'EUAI-TI-001': [
        'instructions-for-use',
        'instructions-for-use.md',
        'deployer-guide',
        'deployer-guide.md',
      ],
      'EUAI-RAS-001': [
        'robustness-test',
        'robustness-test.md',
        'model-evaluation',
        'model-evaluation.md',
      ],
      'EUAI-FRIA-001': [
        'fria',
        'fria.md',
        'fundamental-rights-impact-assessment',
        'fundamental-rights-impact-assessment.md',
      ],
    };

    const expected = artifactIds[rule.id] || [];
    const hasArtifact = expected.some((id) => foundIds.has(id));

    if (!hasArtifact) {
      issues.push({
        id: `${rule.id}-missing`,
        severity: rule.severity || severityDefault,
        type: rule.type,
        filePath: '(repository-root)',
        lineNumber: undefined,
        count: 1,
        description: rule.description,
        recommendedAction: rule.fixTemplate,
        evidence: `Missing artifact for "${rule.id}" (Art. ${rule.article}) — ${rule.description}`,
        affectedFiles: [],
        metadata: {
          patternId: rule.id,
          category: rule.category,
          article: rule.article,
          isAbsenceRule: true,
        },
      });
    }
  }

  return issues;
}

module.exports = {
  HIGH_RISK_CATALOG,
  AI_SYSTEM_INDICATORS,
  COMPLIANCE_OBLIGATIONS,
  COMPLIANCE_ARTIFACT_NAMES,
  COMPLIANCE_ARTIFACT_MARKERS,
  DOCUMENTATION_MARKERS,
  DOCUMENTATION_FILE_NAMES,
  detectDocumentationArtifacts,
  detectComplianceArtifacts,
  scanEuAiActPatterns,
  scanComplianceObligations,
  scanAbsenceComplianceGaps,
  hasTransparencyDisclosure,
  hasDocumentedAiInventory,
  filterDocumentedAiInventoryIssues,
  DEFAULT_SOURCE_PATHS,
  DEFAULT_PRODUCTION_PATHS,
};
