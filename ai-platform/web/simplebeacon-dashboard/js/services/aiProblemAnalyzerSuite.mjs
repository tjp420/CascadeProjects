const CATEGORY_DEFINITIONS = [
  {
    id: 'technical-ai-issues',
    name: 'Technical AI Issues',
    methods: ['Factual verification', 'Parity checks', 'Robustness testing']
  },
  {
    id: 'ethical-societal-ai-issues',
    name: 'Ethical & Societal AI Issues',
    methods: ['Impact assessment', 'Policy checks', 'Population segmentation']
  },
  {
    id: 'economic-regulatory-ai-issues',
    name: 'Economic & Regulatory AI Issues',
    methods: ['Market concentration', 'Compliance mapping', 'Liability analysis']
  },
  {
    id: 'everyday-reliability-problems',
    name: 'Everyday Reliability Problems',
    methods: ['Repeatability tests', 'Calibration checks', 'Context stress tests']
  },
  {
    id: 'everyday-ux-problems',
    name: 'Everyday UX Problems',
    methods: ['Usability telemetry', 'Latency profiling', 'Cost fit analysis']
  },
  {
    id: 'everyday-practical-issues',
    name: 'Everyday Practical Issues',
    methods: ['Error analysis', 'Multilingual checks', 'Formatting checks']
  },
  {
    id: 'everyday-trust-safety-issues',
    name: 'Everyday Trust & Safety Issues',
    methods: ['Privacy controls', 'Security controls', 'Moderation checks']
  },
  {
    id: 'everyday-integration-issues',
    name: 'Everyday Integration Issues',
    methods: ['API integration tests', 'Compatibility tests', 'Operability tests']
  }
];

function toId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function createAnalyzer(category, name, purpose, inputData, methodology, outputMetrics, scoringDirection, implementationHint, status = 'stub') {
  return {
    id: toId(name),
    name,
    category,
    purpose,
    inputData,
    methodology,
    outputMetrics,
    scoringDirection,
    implementationHint,
    status
  };
}

export const ANALYZER_CATALOG = [
  createAnalyzer('Technical AI Issues', 'Hallucination Analyzer', 'Detect and measure AI-generated false information.', ['AI responses with source references', 'Ground truth evidence', 'Claim confidence metadata'], ['Extract factual claims', 'Check evidence support for each claim', 'Measure confidence-evidence mismatch'], ['Hallucination rate', 'Confidence-evidence mismatch score', 'Unsupported claim count'], 'lower_better', 'Use deterministic claim/evidence rules and confidence thresholds.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Bias Detection Analyzer', 'Identify and quantify bias differences across demographic variants.', ['Prompt/response pairs by subgroup', 'Protected subgroup labels', 'Outcome quality scores'], ['Compare subgroup outcome rates', 'Compute parity gap', 'Flag subgroup disparity over threshold'], ['Subgroup parity score', 'Max disparity gap', 'Flagged subgroup count'], 'higher_better', 'Run deterministic subgroup parity checklist over labeled outcomes.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Interpretability Analyzer', 'Measure explainability and traceability of model decisions.', ['Decision traces', 'Feature-importance exports', 'Explanation requests'], ['Check trace completeness', 'Check feature attribution consistency', 'Score explanation coverage'], ['Trace completeness', 'Attribution stability', 'Explanation coverage'], 'higher_better', 'Start with static checks for trace fields and attribution presence.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Data Quality Analyzer', 'Assess quality and representativeness of training/eval data.', ['Dataset samples', 'Label metadata', 'Distribution summaries'], ['Check label consistency', 'Check class balance', 'Check freshness markers'], ['Label consistency rate', 'Class balance score', 'Freshness index'], 'higher_better', 'Add deterministic profiling checks on data snapshots.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Scalability Analyzer', 'Measure computational efficiency and scaling characteristics.', ['Latency profiles', 'Throughput logs', 'Resource usage metrics'], ['Compute throughput trends', 'Evaluate p95 latency under load', 'Flag scaling bottlenecks'], ['Throughput score', 'Latency scalability score', 'Resource efficiency ratio'], 'higher_better', 'Use local benchmark traces and rule thresholds.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Generalization Analyzer', 'Test performance on out-of-distribution scenarios.', ['In-distribution benchmark', 'OOD benchmark', 'Scenario labels'], ['Compare ID vs OOD accuracy', 'Measure degradation', 'Identify failure clusters'], ['OOD retention score', 'Generalization gap', 'Failure cluster count'], 'higher_better', 'Implement deterministic benchmark comparison reports.', 'implemented'),
  createAnalyzer('Technical AI Issues', 'Catastrophic Forgetting Analyzer', 'Measure knowledge retention over sequential learning tasks.', ['Task sequence scores', 'Training checkpoints', 'Retention baselines'], ['Compare old-task scores over time', 'Measure decay', 'Flag interference'], ['Retention rate', 'Knowledge decay speed', 'Interference score'], 'higher_better', 'Track checkpoint metrics with deterministic decay formulas.'),
  createAnalyzer('Technical AI Issues', 'Adversarial Vulnerability Analyzer', 'Assess susceptibility to adversarial inputs and attacks.', ['Adversarial prompts', 'Model outputs', 'Defense policy outcomes'], ['Replay attack prompts', 'Measure jailbreak success', 'Measure defense containment'], ['Attack success rate', 'Defense effectiveness', 'Transferability risk'], 'lower_better', 'Use seeded adversarial test corpora and fixed pass/fail rules.'),

  createAnalyzer('Ethical & Societal AI Issues', 'Job Displacement Impact Analyzer', 'Assess potential workforce displacement risk.', ['Role/task inventories', 'Automation capability matrix', 'Adoption scenarios'], ['Map automatable tasks', 'Estimate role exposure', 'Score transition readiness'], ['Displacement risk score', 'Transition readiness score', 'High-risk role count'], 'lower_better', 'Start with deterministic task-to-capability lookup tables.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Privacy Violation Analyzer', 'Detect privacy risks in data collection and usage.', ['Data flow maps', 'PII/PHI patterns', 'Access logs'], ['Scan for sensitive attributes', 'Check access boundaries', 'Check retention policy fit'], ['Exposure risk score', 'Policy alignment rate', 'Unauthorized access count'], 'lower_better', 'Reuse pattern scanners and policy rule validation.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Copyright Infringement Analyzer', 'Identify potential copyright and licensing violations.', ['Source licenses', 'Generated outputs', 'Similarity signatures'], ['Check license compatibility', 'Measure content similarity', 'Verify attribution requirements'], ['License compliance score', 'Similarity risk score', 'Attribution completeness'], 'higher_better', 'Use deterministic license matrix and similarity thresholds.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Misinformation Generation Analyzer', 'Detect risk of generating misleading content.', ['Claimed facts', 'Verified fact sources', 'Source provenance'], ['Cross-check key claims', 'Evaluate source credibility', 'Flag unsupported narratives'], ['False claim rate', 'Credibility score', 'Misinformation risk index'], 'lower_better', 'Combine rule-based claim checks with source whitelist validation.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Deepfake Detection Analyzer', 'Identify synthetic media manipulation patterns.', ['Media fingerprints', 'Provenance metadata', 'Artifact checks'], ['Detect generation artifacts', 'Validate provenance', 'Score manipulation indicators'], ['Synthetic likelihood', 'Artifact score', 'Provenance confidence'], 'lower_better', 'Start with metadata and artifact heuristics before ML models.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Autonomous Weapon Safety Analyzer', 'Assess safety controls for autonomous lethal decisions.', ['Decision policy docs', 'Override controls', 'Failure-mode tests'], ['Check human override availability', 'Check fail-safe behavior', 'Check policy guardrails'], ['Safety control score', 'Override availability rate', 'Failure containment score'], 'higher_better', 'Use compliance checklist against explicit safety controls.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Surveillance Impact Analyzer', 'Measure societal harm risk from AI surveillance usage.', ['Deployment scope', 'Affected population data', 'Governance constraints'], ['Compute coverage intensity', 'Measure disproportional impact', 'Check proportionality controls'], ['Impact intensity score', 'Disproportionate targeting index', 'Governance adequacy score'], 'lower_better', 'Implement deterministic impact scoring rubric.'),
  createAnalyzer('Ethical & Societal AI Issues', 'Digital Divide Analyzer', 'Measure inequity in access to AI benefits.', ['Usage by demographic segment', 'Connectivity/access data', 'Cost barriers'], ['Compare access rates', 'Score affordability barriers', 'Identify underserved groups'], ['Access equality score', 'Affordability score', 'Segment disparity index'], 'higher_better', 'Compute parity and affordability deltas from usage telemetry.'),

  createAnalyzer('Economic & Regulatory AI Issues', 'Market Monopolization Analyzer', 'Detect market concentration and platform lock-in risk.', ['Provider market shares', 'Dependency concentration', 'Switching costs'], ['Compute concentration index', 'Measure vendor dependency', 'Score switching friction'], ['Concentration score', 'Dependency ratio', 'Switching cost index'], 'lower_better', 'Use deterministic HHI-like concentration calculations.'),
  createAnalyzer('Economic & Regulatory AI Issues', 'Environmental Impact Analyzer', 'Measure energy and carbon footprint efficiency.', ['Energy usage logs', 'Compute utilization', 'Carbon intensity factors'], ['Compute energy per workload', 'Estimate emissions', 'Benchmark efficiency'], ['Energy per request', 'Carbon footprint score', 'Efficiency percentile'], 'higher_better', 'Derive deterministic sustainability metrics from runtime telemetry.'),
  createAnalyzer('Economic & Regulatory AI Issues', 'Regulatory Compliance Analyzer', 'Assess alignment with applicable AI regulations.', ['Regulatory control catalog', 'System policy docs', 'Audit evidence'], ['Map controls to requirements', 'Check evidence completeness', 'Flag missing controls'], ['Compliance coverage rate', 'Control gap count', 'Audit readiness score'], 'higher_better', 'Implement control checklist and evidence validation engine.'),
  createAnalyzer('Economic & Regulatory AI Issues', 'Liability Assessment Analyzer', 'Evaluate clarity of responsibility and liability boundaries.', ['Decision logs', 'Terms/policy docs', 'Escalation ownership maps'], ['Map decision responsibility chain', 'Check escalation paths', 'Score legal clarity'], ['Liability clarity score', 'Ownership coverage rate', 'Escalation completeness'], 'higher_better', 'Use deterministic ownership matrix checks.'),
  createAnalyzer('Economic & Regulatory AI Issues', 'Market Manipulation Analyzer', 'Detect AI-assisted market manipulation risk patterns.', ['Transaction/behavior traces', 'Anomaly events', 'Regulatory rules'], ['Detect anomaly clusters', 'Check manipulation signatures', 'Score regulatory breach risk'], ['Manipulation risk score', 'Anomaly intensity', 'Rule breach count'], 'lower_better', 'Use fixed anomaly signatures and threshold rules.'),
  createAnalyzer('Economic & Regulatory AI Issues', 'Intellectual Property Analyzer', 'Assess IP ownership, provenance, and rights clarity.', ['Content provenance records', 'Training source rights', 'Attribution logs'], ['Trace provenance lineage', 'Validate rights coverage', 'Score ownership ambiguity'], ['Ownership clarity score', 'Rights coverage ratio', 'Attribution completeness'], 'higher_better', 'Apply deterministic provenance lineage checks.'),

  createAnalyzer('Everyday Reliability Problems', 'Response Consistency Analyzer', 'Measure repeatability for same or equivalent prompts.', ['Repeated prompt-response sets', 'Similarity measures', 'Configuration settings'], ['Compare semantic overlap', 'Measure variance over repeats', 'Flag unstable outputs'], ['Response similarity score', 'Variance index', 'Stability pass rate'], 'higher_better', 'Use deterministic token/phrase overlap with fixed thresholds.', 'implemented'),
  createAnalyzer('Everyday Reliability Problems', 'Confidence Accuracy Analyzer', 'Measure calibration between confidence and correctness.', ['Confidence signals', 'Correctness labels', 'Evaluation datasets'], ['Build calibration buckets', 'Compute confidence-correctness gap', 'Flag overconfidence'], ['Calibration score', 'Overconfidence rate', 'Reliability score'], 'higher_better', 'Implement calibration curve checks without model calls.'),
  createAnalyzer('Everyday Reliability Problems', 'Context Retention Analyzer', 'Measure context retention over long interactions.', ['Conversation transcripts', 'Context dependency prompts', 'Retention expectations'], ['Inject recall prompts at intervals', 'Measure retained facts', 'Score context decay'], ['Retention rate', 'Context decay slope', 'Recall failure count'], 'higher_better', 'Use deterministic recall checkpoints in scripted conversations.'),
  createAnalyzer('Everyday Reliability Problems', 'Knowledge Freshness Analyzer', 'Assess currency of model knowledge for recent topics.', ['Timestamped fact tests', 'Knowledge cutoff metadata', 'Verified references'], ['Query fresh facts', 'Compare with references', 'Compute staleness impact'], ['Freshness score', 'Recent-fact accuracy', 'Staleness risk'], 'higher_better', 'Use fixed dated benchmark sets and deterministic scoring.'),
  createAnalyzer('Everyday Reliability Problems', 'Reasoning Capability Analyzer', 'Evaluate logical and multi-step reasoning robustness.', ['Reasoning benchmark tasks', 'Step-by-step outputs', 'Expected solutions'], ['Check step validity', 'Check final answer correctness', 'Identify recurring fallacies'], ['Reasoning accuracy', 'Multi-step success rate', 'Fallacy frequency'], 'higher_better', 'Use deterministic benchmark answer keys and rule checks.'),

  createAnalyzer('Everyday UX Problems', 'Prompt Engineering Difficulty Analyzer', 'Measure how hard it is for users to get quality outputs.', ['Prompt iteration logs', 'Success outcomes', 'User expertise labels'], ['Count attempts to success', 'Compare novice vs expert outcomes', 'Score prompt complexity'], ['Attempts-to-success', 'Expert-novice gap', 'Prompt complexity index'], 'lower_better', 'Start with deterministic attempt/success analytics.'),
  createAnalyzer('Everyday UX Problems', 'Response Latency Analyzer', 'Measure responsiveness and UX latency impact.', ['Request timing logs', 'Prompt complexity labels', 'User wait tolerance'], ['Compute p50/p95 latency', 'Compare by workload type', 'Check UX threshold breaches'], ['Latency score', 'Threshold breach rate', 'Responsiveness percentile'], 'higher_better', 'Use local latency telemetry and threshold checks.'),
  createAnalyzer('Everyday UX Problems', 'Cost Barrier Analyzer', 'Assess affordability and cost-to-value by user segment.', ['Pricing tiers', 'Usage patterns', 'Outcome success rates'], ['Compute cost per successful outcome', 'Compare segment affordability', 'Flag barrier tiers'], ['Affordability score', 'Cost-effectiveness ratio', 'Barrier index'], 'higher_better', 'Use deterministic unit economics per segment.'),
  createAnalyzer('Everyday UX Problems', 'Usage Limit Analyzer', 'Measure workflow disruption from rate and quota limits.', ['Rate-limit policies', 'Usage traces', 'Limit-hit events'], ['Compute limit hit frequency', 'Measure interruption impact', 'Estimate optimal quotas'], ['Limit impact score', 'Limit-hit rate', 'Workflow disruption index'], 'higher_better', 'Use deterministic quota impact calculations.'),
  createAnalyzer('Everyday UX Problems', 'Platform Lock-in Analyzer', 'Measure portability and migration friction between providers.', ['API feature parity matrix', 'Migration mappings', 'Provider-specific dependencies'], ['Score feature portability', 'Estimate migration complexity', 'Quantify dependency lock-in'], ['Portability score', 'Migration complexity', 'Dependency ratio'], 'higher_better', 'Use deterministic API parity and dependency scoring.'),

  createAnalyzer('Everyday Practical Issues', 'False Positive/Negative Analyzer', 'Measure classification and moderation error tradeoffs.', ['Prediction labels', 'Ground truth labels', 'Error-cost matrix'], ['Compute precision/recall', 'Compute FP/FN rates', 'Score cost-weighted error'], ['Precision', 'Recall', 'Cost-weighted accuracy'], 'higher_better', 'Use deterministic confusion-matrix scoring.'),
  createAnalyzer('Everyday Practical Issues', 'Language Limitation Analyzer', 'Assess multilingual and cultural handling quality.', ['Multilingual evaluation sets', 'Locale metadata', 'Quality labels'], ['Compare performance across languages', 'Measure parity gaps', 'Flag localization failures'], ['Language parity score', 'Coverage score', 'Localization failure rate'], 'higher_better', 'Use fixed multilingual test sets and parity checks.'),
  createAnalyzer('Everyday Practical Issues', 'Domain Knowledge Analyzer', 'Evaluate specialized-domain knowledge quality.', ['Domain benchmark tasks', 'Expert-labeled references', 'Terminology dictionaries'], ['Test domain Q&A', 'Check terminology correctness', 'Measure expert agreement'], ['Domain accuracy', 'Terminology precision', 'Expert agreement score'], 'higher_better', 'Use deterministic domain benchmark suites.'),
  createAnalyzer('Everyday Practical Issues', 'Output Consistency Analyzer', 'Measure output format and schema consistency.', ['Structured outputs', 'Expected format schema', 'Parser success logs'], ['Validate against schema', 'Measure parser success', 'Flag format drift'], ['Format consistency score', 'Schema compliance rate', 'Parser success rate'], 'higher_better', 'Use strict schema validation and parser checks.'),
  createAnalyzer('Everyday Practical Issues', 'Session Management Analyzer', 'Evaluate session continuity and state handling quality.', ['Session transcripts', 'State transition logs', 'Context handoff events'], ['Check state continuity', 'Measure handoff integrity', 'Score recovery after interruptions'], ['Session continuity score', 'State integrity rate', 'Recovery success rate'], 'higher_better', 'Use deterministic state-transition validation rules.'),

  createAnalyzer('Everyday Trust & Safety Issues', 'Privacy Concern Analyzer', 'Measure privacy-protection clarity and user trust impact.', ['Privacy policy text', 'Data usage logs', 'User trust feedback'], ['Check policy coverage', 'Compare policy vs behavior', 'Score transparency clarity'], ['Policy clarity score', 'Policy-behavior alignment', 'Trust impact score'], 'higher_better', 'Use policy checklist and usage-log comparisons.'),
  createAnalyzer('Everyday Trust & Safety Issues', 'Security Risk Analyzer', 'Assess security vulnerabilities and protection controls.', ['Threat indicators', 'Access control events', 'Injection attempts'], ['Detect security anti-patterns', 'Measure control coverage', 'Score exploitability'], ['Security posture score', 'Exploitability index', 'Control coverage rate'], 'higher_better', 'Use deterministic security rule checks.', 'implemented'),
  createAnalyzer('Everyday Trust & Safety Issues', 'Content Filtering Analyzer', 'Evaluate moderation consistency and harmful-content handling.', ['Moderation decisions', 'Appeal outcomes', 'Policy categories'], ['Check decision consistency', 'Measure harmful-content leakage', 'Measure wrongful block rate'], ['Moderation consistency score', 'Leakage rate', 'Wrongful block rate'], 'higher_better', 'Use deterministic policy matrix validation.'),
  createAnalyzer('Everyday Trust & Safety Issues', 'Transparency Analyzer', 'Measure clarity of system limitations and decision rationale.', ['System docs', 'Rationale payloads', 'User comprehension surveys'], ['Check rationale availability', 'Check limitation disclosures', 'Score clarity signals'], ['Transparency score', 'Rationale coverage', 'Disclosure completeness'], 'higher_better', 'Use documentation and rationale field validation.'),
  createAnalyzer('Everyday Trust & Safety Issues', 'Dependence Risk Analyzer', 'Assess overreliance risk and human skill atrophy signals.', ['Usage intensity traces', 'Fallback usage rates', 'Human override metrics'], ['Measure dependency ratio', 'Measure fallback readiness', 'Score resilience under AI unavailability'], ['Dependence risk score', 'Fallback readiness', 'Resilience score'], 'lower_better', 'Use deterministic usage trend thresholds.'),

  createAnalyzer('Everyday Integration Issues', 'API Complexity Analyzer', 'Measure AI API integration complexity for developers.', ['API docs', 'SDK surface data', 'Integration attempt logs'], ['Score API surface complexity', 'Check docs completeness', 'Measure integration failures'], ['Integration ease score', 'Docs quality score', 'Failure rate'], 'higher_better', 'Use deterministic API-surface and docs heuristics.'),
  createAnalyzer('Everyday Integration Issues', 'Compatibility Analyzer', 'Assess compatibility across platforms, versions, and systems.', ['Compatibility matrix', 'Version requirements', 'Integration outcomes'], ['Check supported matrix coverage', 'Measure compatibility failures', 'Score upgrade friction'], ['Compatibility score', 'Matrix coverage', 'Upgrade friction index'], 'higher_better', 'Run deterministic compatibility matrix checks.'),
  createAnalyzer('Everyday Integration Issues', 'Maintenance Overhead Analyzer', 'Measure ongoing maintenance burden of AI integrations.', ['Release change logs', 'Maintenance time logs', 'Support issue volumes'], ['Measure update churn', 'Measure maintenance effort', 'Score breakage frequency'], ['Maintenance burden score', 'Change churn rate', 'Breakage frequency'], 'higher_better', 'Use deterministic update and ticket trend analytics.'),
  createAnalyzer('Everyday Integration Issues', 'Error Handling Analyzer', 'Evaluate error quality, debugging support, and recovery behavior.', ['Error payloads', 'Recovery outcomes', 'Developer remediation time'], ['Score error message actionability', 'Measure recovery success', 'Measure time-to-resolution'], ['Error clarity score', 'Recovery success rate', 'Time-to-resolution score'], 'higher_better', 'Use deterministic error quality rubric and recovery checks.', 'implemented'),
  createAnalyzer('Everyday Integration Issues', 'Customization Limit Analyzer', 'Assess limits in fine-tuning and use-case customization.', ['Customization options', 'Fine-tuning outcomes', 'Use-case coverage map'], ['Count customization pathways', 'Measure adaptation success', 'Score complexity of customization'], ['Customization coverage score', 'Adaptation success rate', 'Customization complexity'], 'higher_better', 'Use deterministic capability matrix scoring.'),
  createAnalyzer('Everyday Reliability Problems', 'AI Output Reliability Analyzer', 'Detect overconfident or unverified AI claims that need human verification.', ['AI-generated code or text', 'Claim confidence metadata', 'Verification evidence markers'], ['Flag overconfidence without evidence', 'Score technical plausibility gaps', 'Require verification for vague assurances'], ['Reliability score', 'Verification requirement flag', 'Overconfidence flag count'], 'higher_better', 'Use deterministic pattern rules for overconfidence, plausibility, and verification gaps.', 'implemented')
];

export const AI_SYSTEM_ISSUES = ANALYZER_CATALOG.map((item, index) => ({
  id: `A-${String(index + 1).padStart(2, '0')}`,
  analyzerId: item.id,
  title: item.name,
  category: item.category,
  description: item.purpose
}));

const ISSUE_BY_ID = new Map(AI_SYSTEM_ISSUES.map((entry) => [entry.id, entry]));
const ANALYZER_BY_ID = new Map(ANALYZER_CATALOG.map((entry) => [entry.id, entry]));
const ANALYZER_BY_ISSUE_ID = new Map(AI_SYSTEM_ISSUES.map((entry) => [entry.id, ANALYZER_BY_ID.get(entry.analyzerId)]));

export function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Number(numeric.toFixed(2));
}

export function normalizeRiskScore(score, scoringDirection) {
  const clamped = clampScore(score);
  if (scoringDirection === 'higher_better') {
    return clampScore(100 - clamped);
  }
  return clamped;
}

export function severityFromRisk(riskScore) {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 55) return 'high';
  if (riskScore >= 35) return 'medium';
  return 'low';
}

export function riskBandFromRisk(riskScore) {
  if (riskScore >= 75) return 'High';
  if (riskScore >= 55) return 'Elevated';
  if (riskScore >= 35) return 'Moderate';
  return 'Low';
}

function finalizeRiskAssessment(score, scoringDirection, options = {}) {
  const {
    evidenceCount = Number.POSITIVE_INFINITY,
    minEvidence = 0,
    criticalRequiresMinEvidence = false
  } = options;
  const normalizedEvidenceCount = Number.isFinite(evidenceCount) ? Math.max(0, Math.floor(evidenceCount)) : Number.POSITIVE_INFINITY;
  let riskScore = normalizeRiskScore(score, scoringDirection);
  let evidenceStatus = 'sufficient';

  if (normalizedEvidenceCount === 0 && minEvidence > 0) {
    evidenceStatus = 'insufficient_data';
    riskScore = 25;
  } else if (normalizedEvidenceCount < minEvidence) {
    evidenceStatus = 'limited_data';
    const weightedRisk = ((riskScore * normalizedEvidenceCount) + (50 * (minEvidence - normalizedEvidenceCount))) / minEvidence;
    riskScore = clampScore(weightedRisk);
    if (criticalRequiresMinEvidence && riskScore >= 75) {
      riskScore = 74.99;
    }
  }

  return {
    riskScore,
    severity: severityFromRisk(riskScore),
    riskBand: riskBandFromRisk(riskScore),
    evidenceStatus
  };
}

function normalizeSelectedIds(selectedIssueIds = []) {
  const seen = new Set();
  const valid = [];
  for (const raw of selectedIssueIds) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id) || !ISSUE_BY_ID.has(id)) continue;
    seen.add(id);
    valid.push(id);
  }
  return valid;
}

function isScanReportContext(input = {}) {
  return input.scanReportContext === true || input.inputKind === 'scan-report';
}

function hasScalabilityBenchmarkMetrics(metrics = {}) {
  return Number(metrics.throughputRps) > 0
    || Number(metrics.p95LatencyMs) > 0
    || Number(metrics.p50LatencyMs) > 0
    || Number(metrics.p99LatencyMs) > 0;
}

function isOperationalScanTimingClaim(text = '') {
  return /\b(completed in|scan|dry[- ]run|pipeline|cleanup|inventory)\b.*\b\d+\s*ms\b/i.test(text)
    || /\b\d+\s*ms\b.*\b(scan|dry[- ]run|pipeline|cleanup|inventory)\b/i.test(text);
}

function buildStubResult(definition, issueId) {
  const neutralScore = 50;
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'not_implemented',
    score: neutralScore,
    severity: 'low',
    riskBand: 'Low',
    evidenceStatus: 'not_applicable',
    countsTowardRiskSummary: false,
    metrics: [
      {
        name: 'implementation_readiness',
        value: 0,
        unit: 'percent',
        direction: 'higher_better'
      }
    ],
    findings: [
      {
        level: 'info',
        message: `${definition.name} is currently a planned stub.`,
        code: 'ANALYZER_STUB'
      }
    ],
    recommendations: [
      `Implement deterministic checks for: ${definition.methodology[0]}.`,
      `Add local input fixture coverage for: ${definition.outputMetrics[0]}.`
    ],
    evidence: [
      {
        sourceType: 'catalog',
        pointer: definition.id,
        detail: 'Stub metadata from analyzer registry.'
      }
    ]
  };
}

function parseClaims(input = {}) {
  if (isScanReportContext(input) && !(Array.isArray(input.claims) && input.claims.length)) {
    return [];
  }
  if (Array.isArray(input.claims) && input.claims.length) {
    return input.claims.map((claim, index) => ({
      text: String(claim.text || claim || '').trim(),
      hasEvidence: Boolean(claim.hasEvidence),
      confidence: Number(claim.confidence ?? input.responseConfidence ?? 0.5),
      evidenceConfidence: Number(claim.evidenceConfidence ?? (claim.hasEvidence ? 0.8 : 0.2)),
      idx: index
    })).filter((claim) => claim.text);
  }
  const responseText = String(input.responseText || '').trim();
  if (!responseText) return [];
  return responseText
    .split(/[.!?]\s+/)
    .map((sentence, index) => sentence.trim())
    .filter(Boolean)
    .map((sentence, index) => ({
      text: sentence,
      hasEvidence: /\[[^\]]+\]|\b(source|citation|evidence|according to)\b/i.test(sentence),
      confidence: Number(input.responseConfidence ?? 0.5),
      evidenceConfidence: /\[[^\]]+\]|\b(source|citation|evidence|according to)\b/i.test(sentence) ? 0.8 : 0.2,
      idx: index
    }));
}

function runHallucinationAnalyzer(definition, issueId, input = {}) {
  const claims = parseClaims(input);
  const text = extractAnalyzerText(input);
  if (isScanReportContext(input) && !claims.length) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 1,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'hallucination_rate', value: 0, unit: 'percent', direction: 'lower_better' },
        { name: 'confidence_evidence_mismatch', value: 0, unit: 'percent', direction: 'lower_better' },
        { name: 'claims_analyzed', value: 0, unit: 'count', direction: 'higher_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'Scan report context does not include explicit factual claims to verify.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Require explicit evidence references for factual claims.',
        'Downgrade confidence language when evidence confidence is low.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'claims', detail: 'No explicit claims supplied for hallucination analysis.' }
      ]
    };
  }
  const dataAnalyzed = claims.length || text.length;
  const total = claims.length || 1;
  const unsupported = claims.filter((claim) => !claim.hasEvidence || claim.evidenceConfidence < 0.5);
  const mismatch = claims.filter((claim) => claim.confidence >= 0.75 && claim.evidenceConfidence < 0.5);
  const hallucinationRate = clampScore((unsupported.length / total) * 100);
  const mismatchScore = clampScore((mismatch.length / total) * 100);
  const score = clampScore((hallucinationRate * 0.7) + (mismatchScore * 0.3));
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount: dataAnalyzed > 0 ? dataAnalyzed : 0,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'hallucination_rate', value: hallucinationRate, unit: 'percent', direction: 'lower_better' },
      { name: 'confidence_evidence_mismatch', value: mismatchScore, unit: 'percent', direction: 'lower_better' },
      { name: 'claims_analyzed', value: claims.length, unit: 'count', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No response text or claims supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(unsupported.length ? [{ level: 'warn', message: `${unsupported.length} claim(s) have weak or missing evidence.`, code: 'UNSUPPORTED_CLAIMS' }] : []),
      ...(mismatch.length ? [{ level: 'warn', message: `${mismatch.length} claim(s) were high-confidence with low evidence confidence.`, code: 'CONFIDENCE_MISMATCH' }] : [])
    ],
    recommendations: [
      'Require explicit evidence references for factual claims.',
      'Downgrade confidence language when evidence confidence is low.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'claims', detail: `Analyzed ${claims.length} extracted claim(s).` }
    ]
  };
}

function runBiasDetectionAnalyzer(definition, issueId, input = {}) {
  const outcomes = Array.isArray(input.subgroupOutcomes) ? input.subgroupOutcomes : [];
  const text = combineAnalyzerText(input);
  const normalized = outcomes.map((row) => ({
    subgroup: String(row.subgroup || 'unknown'),
    favorableRate: clampScore(Number(row.favorableRate ?? 0)),
    sampleSize: Number(row.sampleSize ?? 1)
  }));
  const rates = normalized.map((row) => row.favorableRate);
  const maxRate = rates.length ? Math.max(...rates) : 100;
  const minRate = rates.length ? Math.min(...rates) : 100;
  const disparityGap = clampScore(maxRate - minRate);
  const parityScore = clampScore(100 - disparityGap);
  const dataAnalyzed = normalized.length || text.length;
  const risk = finalizeRiskAssessment(parityScore, definition.scoringDirection, {
    evidenceCount: dataAnalyzed > 0 ? dataAnalyzed : 0,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score: parityScore,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'subgroup_parity_score', value: parityScore, unit: 'percent', direction: 'higher_better' },
      { name: 'max_disparity_gap', value: disparityGap, unit: 'percent', direction: 'lower_better' },
      { name: 'subgroups_compared', value: normalized.length, unit: 'count', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No subgroup outcomes or scan parity input supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(disparityGap > 20 ? [{ level: 'warn', message: `Subgroup parity gap is ${disparityGap} points.`, code: 'PARITY_GAP' }] : [])
    ],
    recommendations: [
      'Run parity checks on all protected subgroup variants before release.',
      'Add remediation rules for subgroup disparities over 20 points.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'subgroupOutcomes', detail: `Compared ${normalized.length} subgroup(s).` }
    ]
  };
}

function runSecurityRiskAnalyzer(definition, issueId, input = {}) {
  const prompt = String(input.prompt || '').toLowerCase();
  const response = String(input.responseText || '').toLowerCase();
  const injectionMarkers = [
    /ignore (all|any|previous|prior) instructions/,
    /disregard (all|previous|prior) instructions/,
    /you are now (in )?(developer mode|dan|jailbreak)/,
    /(print|reveal|show|expose).{0,40}(system prompt|hidden prompt|chain of thought|internal instructions)/,
    /(bypass|disable|override).{0,20}(safety|policy|guardrail|filter|restriction)/,
    /(sudo|root|admin) mode/,
    /act as (an? )?(unfiltered|uncensored|malicious) assistant/
  ];
  const leakMarkers = [
    /\bapi[_ -]?key\b/,
    /\bsecret\b/,
    /\bpassword\b/,
    /\btoken\b/,
    /\bsk_(live|test)_[a-z0-9]{8,}\b/,
    /\bghp_[a-z0-9]{12,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i
  ];
  const promptHits = injectionMarkers.filter((pattern) => pattern.test(prompt)).length;
  const responseLeakHits = leakMarkers.filter((pattern) => pattern.test(response)).length;
  const evidenceCount = [prompt.trim(), response.trim()].filter(Boolean).length;
  const dataAnalyzed = prompt.length + response.length;
  const riskSignals = Math.min(100, (promptHits * 15) + (responseLeakHits * 30));
  const score = clampScore(100 - riskSignals);
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount: dataAnalyzed > 0 ? evidenceCount : 0,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'injection_marker_hits', value: promptHits, unit: 'count', direction: 'lower_better' },
      { name: 'response_secret_leak_hits', value: responseLeakHits, unit: 'count', direction: 'lower_better' },
      { name: 'security_posture_score', value: score, unit: 'score', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'Insufficient security evidence input; risk normalized to moderate baseline.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(promptHits ? [{ level: 'warn', message: `Detected ${promptHits} prompt-injection marker(s).`, code: 'INJECTION_MARKERS' }] : []),
      ...(responseLeakHits ? [{ level: 'critical', message: `Response includes ${responseLeakHits} potential secret-leak indicator(s).`, code: 'SECRET_LEAK' }] : [])
    ],
    recommendations: [
      'Apply strict instruction-hierarchy checks before execution.',
      'Mask or redact sensitive values in model outputs.',
      'Add denylist signatures for prompt-injection and known credential patterns.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'prompt', detail: 'Checked prompt content against deterministic injection and jailbreak signatures.' },
      { sourceType: 'input', pointer: 'responseText', detail: 'Checked response content for deterministic credential and secret leakage markers.' }
    ]
  };
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size && !setB.size) return 1;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

function runResponseConsistencyAnalyzer(definition, issueId, input = {}) {
  const responses = Array.isArray(input.responses) ? input.responses.map((item) => String(item || '')).filter(Boolean) : [];
  const tokens = responses.map(tokenize);
  let comparisons = 0;
  let similarityTotal = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      similarityTotal += jaccard(tokens[i], tokens[j]);
      comparisons += 1;
    }
  }
  const similarityScore = clampScore((comparisons ? (similarityTotal / comparisons) : 1) * 100);
  const varianceIndex = clampScore(100 - similarityScore);
  const dataAnalyzed = responses.length;
  const risk = finalizeRiskAssessment(similarityScore, definition.scoringDirection, {
    evidenceCount: comparisons,
    minEvidence: 2,
    criticalRequiresMinEvidence: true
  });
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score: similarityScore,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'response_similarity', value: similarityScore, unit: 'percent', direction: 'higher_better' },
      { name: 'content_variance_index', value: varianceIndex, unit: 'percent', direction: 'lower_better' },
      { name: 'comparisons', value: comparisons, unit: 'count', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No comparable response samples supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(risk.evidenceStatus === 'limited_data' ? [{ level: 'info', message: 'Fewer than three response samples; consistency severity is capped until more repeats are available.', code: 'LIMITED_DATA' }] : []),
      ...(risk.evidenceStatus !== 'insufficient_data' && similarityScore < 60 ? [{ level: 'warn', message: 'Repeated responses show high variance.', code: 'HIGH_VARIANCE' }] : [])
    ],
    recommendations: [
      'Tighten prompt templates and deterministic post-processing.',
      'Pin key generation parameters for reliability-critical workflows.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'responses', detail: `Compared ${responses.length} response sample(s).` }
    ]
  };
}

const EVIDENCE_MARKERS = {
  testing: /\b(test(?:s|ed|ing)?|unit test|integration test|e2e|fixture|spec)\b/i,
  validation: /\b(validat(?:e|ed|ion)|verified|verify|proof|proven)\b/i,
  securityReview: /\b(security review|security audit|audited|audit|penetration test|pentest|vulnerability scan)\b/i,
  analysis: /\b(analyz(?:e|ed|is)|benchmark|profiled|profiling|complexity analysis|big-o)\b/i,
  productionSignals: /\b(test(?:s|ed|ing)?|logging|log(?:ged|s)?|error handling|try[\s/-]catch|monitoring|observability)\b/i
};

function extractAnalyzerText(input = {}) {
  if (typeof input.responseText === 'string' && input.responseText.trim()) {
    return input.responseText.trim();
  }
  if (typeof input.text === 'string' && input.text.trim()) {
    return input.text.trim();
  }
  if (Array.isArray(input.claims) && input.claims.length) {
    return input.claims.map((claim) => String(claim.text || claim || '').trim()).filter(Boolean).join(' ');
  }
  return '';
}

function quoteSnippet(text, match) {
  const snippet = String(match || '').trim();
  if (!snippet) return 'claim';
  return snippet.length > 48 ? `${snippet.slice(0, 45)}...` : snippet;
}

function detectReliabilityFlags(text) {
  const flags = [];
  const addFlag = (flag) => {
    if (!flags.includes(flag)) flags.push(flag);
  };

  const overconfidenceRules = [
    {
      pattern: /\b(definitely|certainly)\s+(works?|will work)\b/i,
      evidence: EVIDENCE_MARKERS.testing,
      label: 'testing'
    },
    {
      pattern: /\bguaranteed (to be )?(secure|safe)\b|\bguaranteed secure\b/i,
      evidence: EVIDENCE_MARKERS.securityReview,
      label: 'audit'
    },
    {
      pattern: /\b100\s*%\s*accurate\b|\b100 percent accurate\b|\bperfectly accurate\b/i,
      evidence: EVIDENCE_MARKERS.validation,
      label: 'validation'
    },
    {
      pattern: /\b(always works|never fails|cannot fail|will never fail|can't fail)\b/i,
      evidence: EVIDENCE_MARKERS.testing,
      label: 'testing'
    },
    {
      pattern: /\b(completely safe|totally secure|bulletproof|foolproof)\b/i,
      evidence: EVIDENCE_MARKERS.securityReview,
      label: 'audit'
    }
  ];

  for (const rule of overconfidenceRules) {
    const match = text.match(rule.pattern);
    if (match && !rule.evidence.test(text)) {
      addFlag(`Overconfidence detected: '${quoteSnippet(text, match[0])}' without ${rule.label}`);
    }
  }

  const plausibilityRules = [
    {
      pattern: /\bO\s*\(\s*1\s*\)|\bconstant[- ]time\b|\blinear[- ]time performance\b/i,
      evidence: EVIDENCE_MARKERS.analysis,
      message: (match) => `Plausibility issue: ${quoteSnippet(text, match[0])} claim needs algorithmic analysis`
    },
    {
      pattern: /\bzero security vulnerabilities\b|\bno security vulnerabilities\b|\bno vulnerabilities\b/i,
      evidence: EVIDENCE_MARKERS.securityReview,
      message: (match) => `Plausibility issue: '${quoteSnippet(text, match[0])}' without audit`
    },
    {
      pattern: /\bproduction[- ]ready\b/i,
      evidence: EVIDENCE_MARKERS.productionSignals,
      message: () => 'Plausibility issue: production-ready claim without tests/logging/error handling evidence'
    }
  ];

  for (const rule of plausibilityRules) {
    const match = text.match(rule.pattern);
    if (match && !rule.evidence.test(text)) {
      addFlag(rule.message(match));
    }
  }

  const verificationRules = [
    {
      pattern: /\bhandles all edge cases\b|\ball edge cases\b/i,
      message: () => 'Verification needed: Edge case handling not demonstrated'
    },
    {
      pattern: /\bfollows best practices\b|\bfollow best practices\b/i,
      message: () => 'Verification needed: Best practices claim is vague and unverified'
    },
    {
      pattern: /\bno security issues\b|\bno security problems\b/i,
      evidence: EVIDENCE_MARKERS.securityReview,
      message: () => 'Verification needed: Security assurance lacks audit evidence'
    },
    {
      pattern: /\bfully tested\b|\bcomprehensive test coverage\b/i,
      evidence: EVIDENCE_MARKERS.testing,
      message: () => 'Verification needed: Testing completeness not demonstrated'
    }
  ];

  for (const rule of verificationRules) {
    const match = text.match(rule.pattern);
    if (match && (!rule.evidence || !rule.evidence.test(text))) {
      addFlag(rule.message(match));
    }
  }

  return flags;
}

function buildVerificationChecklist(flags) {
  return flags.map((flag) => {
    if (flag.startsWith('Overconfidence detected:')) {
      return 'Obtain supporting evidence or downgrade certainty language for flagged claims.';
    }
    if (flag.startsWith('Plausibility issue:')) {
      return 'Validate technical claims with analysis, benchmarks, or audits before acceptance.';
    }
    return 'Perform targeted human verification for the flagged assurance.';
  });
}

function buildReliabilityRecommendation(reliabilityScore, flags) {
  if (!flags.length) {
    return 'Output appears reliable; routine spot-checks recommended for critical use.';
  }
  if (reliabilityScore < 70) {
    return 'Human code review required before deployment';
  }
  if (reliabilityScore < 85) {
    return 'Verify flagged claims before relying on this output';
  }
  return 'Spot-check flagged claims; overall reliability is acceptable pending verification.';
}

export const confidenceCalibrationRegistry = {
  _records: [],
  register(entry = {}) {
    this._records.push({
      analyzerRunId: String(entry.analyzerRunId || 'ai-output-reliability-analyzer'),
      claimedConfidence: Number(entry.claimedConfidence ?? entry.confidence ?? 0),
      verificationOutcome: entry.verificationOutcome ?? null,
      reliabilityScore: Number(entry.reliabilityScore ?? 0),
      flagCount: Number(entry.flagCount ?? 0),
      timestamp: entry.timestamp || Date.now()
    });
    return this._records[this._records.length - 1];
  },
  list() {
    return [...this._records];
  },
  getStats() {
    return {
      recordCount: this._records.length,
      calibrationScore: null,
      status: 'stub',
      message: 'Full confidence-vs-verification learning is planned for the Enhanced phase.'
    };
  },
  clear() {
    this._records.length = 0;
  }
};

export function analyzeAiOutputReliability(input = {}) {
  const text = extractAnalyzerText(input);
  const flags = text ? detectReliabilityFlags(text) : [];
  const overconfidenceCount = flags.filter((flag) => flag.startsWith('Overconfidence detected:')).length;
  const plausibilityCount = flags.filter((flag) => flag.startsWith('Plausibility issue:')).length;
  const verificationCount = flags.filter((flag) => flag.startsWith('Verification needed:')).length;
  const penalty = (overconfidenceCount * 15) + (plausibilityCount * 12) + (verificationCount * 10);
  const reliabilityScore = clampScore(100 - penalty);
  const verificationRequired = flags.length > 0;
  const recommendation = buildReliabilityRecommendation(reliabilityScore, flags);
  const verificationChecklist = buildVerificationChecklist(flags);

  return {
    reliabilityScore,
    verificationRequired,
    flags,
    recommendation,
    verificationChecklist,
    confidenceCalibration: confidenceCalibrationRegistry.getStats()
  };
}

function runAiOutputReliabilityAnalyzer(definition, issueId, input = {}) {
  const text = extractAnalyzerText(input);
  const assessment = analyzeAiOutputReliability(input);
  const { reliabilityScore, verificationRequired, flags, recommendation, verificationChecklist } = assessment;
  const overconfidenceCount = flags.filter((flag) => flag.startsWith('Overconfidence detected:')).length;
  const plausibilityCount = flags.filter((flag) => flag.startsWith('Plausibility issue:')).length;
  const verificationCount = flags.filter((flag) => flag.startsWith('Verification needed:')).length;
  const dataAnalyzed = text.length;
  const risk = finalizeRiskAssessment(reliabilityScore, definition.scoringDirection, {
    evidenceCount: dataAnalyzed > 0 ? dataAnalyzed : 0,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });

  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score: reliabilityScore,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'reliability_score', value: reliabilityScore, unit: 'score', direction: 'higher_better' },
      { name: 'verification_required', value: verificationRequired ? 1 : 0, unit: 'flag', direction: 'lower_better' },
      { name: 'overconfidence_flag_count', value: overconfidenceCount, unit: 'count', direction: 'lower_better' },
      { name: 'plausibility_flag_count', value: plausibilityCount, unit: 'count', direction: 'lower_better' },
      { name: 'verification_flag_count', value: verificationCount, unit: 'count', direction: 'lower_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No AI output text supplied for reliability scan.', code: 'INSUFFICIENT_DATA' }] : []),
      ...flags.map((flag) => ({
        level: flag.startsWith('Overconfidence detected:') ? 'warn' : 'info',
        message: flag,
        code: flag.startsWith('Overconfidence detected:')
          ? 'OVERCONFIDENCE'
          : flag.startsWith('Plausibility issue:')
            ? 'PLAUSIBILITY_GAP'
            : 'VERIFICATION_REQUIRED'
      }))
    ],
    recommendations: [
      recommendation,
      ...verificationChecklist
    ],
    evidence: [
      { sourceType: 'input', pointer: 'responseText', detail: `Scanned ${text.length} character(s) with deterministic reliability heuristics.` }
    ],
    reliabilityAssessment: assessment
  };
}

function combineAnalyzerText(input = {}) {
  const parts = [
    extractAnalyzerText(input),
    String(input.codeText || '').trim(),
    String(input.context?.logs || input.logs || '').trim()
  ].filter(Boolean);
  return parts.join('\n');
}

function parseLogErrorLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  const cases = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isErrorLine = /\b(ERROR|FATAL|Exception|Traceback|Unhandled|failed with)\b/i.test(trimmed);
    if (!isErrorLine) continue;
    cases.push({
      message: trimmed,
      source: 'log',
      recovered: /\b(recovered|resolved|retry succeeded|back online)\b/i.test(trimmed),
      actionable: /\b(retry|check|verify|code:|hint:|suggestion:)\b/i.test(trimmed),
      code: (trimmed.match(/\b(E[A-Z0-9_]{2,}|ERR_[A-Z0-9_]+|HTTP\s*\d{3})\b/i) || [])[0] || '',
      occurredAt: (trimmed.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/) || [])[0] || null
    });
  }
  return cases;
}

function parseTextErrorSentences(text) {
  const sentences = String(text || '')
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const cases = [];
  for (const sentence of sentences) {
    const isError = /\b(error|exception|failure|failed|timeout|crash|unhandled)\b/i.test(sentence);
    if (!isError) continue;
    cases.push({
      message: sentence,
      source: 'text',
      recovered: /\b(recovered|resolved|handled|fallback)\b/i.test(sentence),
      actionable: /\b(retry|check|verify|contact support|see docs|run)\b/i.test(sentence),
      code: (sentence.match(/\b(E[A-Z0-9_]{2,}|ERR_[A-Z0-9_]+|HTTP\s*\d{3})\b/i) || [])[0] || '',
      nextStep: (sentence.match(/\b(retry|check|verify|contact support|run [^.]+)/i) || [])[0] || ''
    });
  }
  return cases;
}

function parseCodeErrorPatterns(codeText) {
  const code = String(codeText || '');
  if (!code.trim()) return [];
  const cases = [];
  const throwMatches = code.match(/throw\s+new\s+\w+Error[^;]*/gi) || [];
  for (const match of throwMatches) {
    cases.push({
      message: match.trim(),
      source: 'code',
      recovered: /\bcatch\b/.test(code),
      actionable: /\b(message|code|hint|retry)\b/i.test(match),
      code: (match.match(/\b(E[A-Z0-9_]{2,}|ERR_[A-Z0-9_]+)\b/i) || [])[0] || ''
    });
  }
  const catchBlocks = (code.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/gi) || []).length;
  if (catchBlocks) {
    cases.push({
      message: `${catchBlocks} catch block(s) detected`,
      source: 'code',
      recovered: true,
      actionable: true,
      code: 'CATCH_HANDLER'
    });
  }
  if (/\berr(or)?\.(Wrap|Is|As)\b/.test(code) || /\btry\s*\{/.test(code)) {
    cases.push({
      message: 'Structured error handling patterns present',
      source: 'code',
      recovered: true,
      actionable: true,
      code: 'ERROR_HANDLING'
    });
  }
  return cases;
}

function collectErrorCases(input = {}) {
  const structured = Array.isArray(input.errorCases)
    ? input.errorCases.map((row) => ({ ...row, source: row.source || 'structured' }))
    : [];
  const fromLogs = parseLogErrorLines(input.context?.logs || input.logs || '');
  const fromText = parseTextErrorSentences(combineAnalyzerText(input));
  const fromCode = parseCodeErrorPatterns(input.codeText);
  const merged = [...structured, ...fromLogs, ...fromText, ...fromCode];
  const seen = new Set();
  return merged.filter((row, index) => {
    const key = String(
      row.message
      || row.error
      || row.code
      || `${row.source || 'case'}-${index}`
    ).slice(0, 120);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeMttrMinutes(errorCases) {
  const durations = [];
  for (const row of errorCases) {
    if (Number.isFinite(row.timeToResolutionMinutes) && row.timeToResolutionMinutes >= 0) {
      durations.push(row.timeToResolutionMinutes);
      continue;
    }
    const start = row.occurredAt || row.startedAt;
    const end = row.resolvedAt || row.endedAt;
    if (start && end) {
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        durations.push((endMs - startMs) / 60000);
      }
    }
  }
  if (!durations.length) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function normalizeErrorCase(row) {
  const message = String(row.message || row.error || '').toLowerCase();
  const code = String(row.code || row.errorCode || '');
  const hasErrorCode = Boolean(code) || /\b(E[A-Z0-9_]{2,}|ERR_[A-Z0-9_]+|HTTP\s*\d{3})\b/.test(message);
  const hasRemediationHint = Boolean(row.nextStep || row.suggestedAction || row.remediation)
    || /\b(retry|check|verify|contact support|run|see docs|hint:|suggestion:)\b/.test(message);
  const actionable = row.actionable === true || (hasErrorCode && hasRemediationHint);
  const recovered = row.recovered === true || /\b(recovered|resolved|handled|fallback)\b/.test(message);
  const timeToResolutionMinutes = Number(row.timeToResolutionMinutes ?? NaN);
  return {
    message: String(row.message || row.error || ''),
    source: row.source || 'structured',
    actionable,
    recovered,
    hasErrorCode,
    hasRemediationHint,
    timeToResolutionMinutes: Number.isFinite(timeToResolutionMinutes) && timeToResolutionMinutes >= 0
      ? timeToResolutionMinutes
      : null
  };
}

function runInterpretabilityAnalyzer(definition, issueId, input = {}) {
  const traces = Array.isArray(input.traces) ? input.traces : [];
  if (isScanReportContext(input) && !traces.length) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 1,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'trace_completeness', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'attribution_stability', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'explanation_coverage', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'Scan report context does not include decision traces or model explanations.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Provide decision traces with inputs, outputs, and confidence for model decisions.',
        'Export feature attribution for top decisions and verify consistency across runs.',
        'Add natural-language explanations tied to attribution evidence.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'traces', detail: 'No decision traces supplied for interpretability analysis.' }
      ]
    };
  }
  const text = combineAnalyzerText(input);
  const traceFields = ['decision', 'reason', 'step', 'feature', 'attribution', 'confidence', 'input'];
  let traceCompleteness = 0;
  if (traces.length) {
    const complete = traces.filter((trace) => {
      const keys = Object.keys(trace || {}).map((key) => key.toLowerCase());
      return traceFields.filter((field) => keys.some((key) => key.includes(field))).length >= 3;
    }).length;
    traceCompleteness = clampScore((complete / traces.length) * 100);
  } else {
    const traceMarkers = [
      /\bdecision trace\b/i,
      /\bstep[- ]by[- ]step\b/i,
      /\bchain of thought\b/i,
      /\btrace id\b/i,
      /\breasoning path\b/i
    ];
    const attributionMarkers = [
      /\bfeature importance\b/i,
      /\battribution\b/i,
      /\bshap\b/i,
      /\blime\b/i,
      /\bsaliency\b/i,
      /\battention weight/i
    ];
    const explanationMarkers = [
      /\bbecause\b/i,
      /\btherefore\b/i,
      /\bexplained by\b/i,
      /\bdue to\b/i,
      /\battributed to\b/i
    ];
    const traceHits = traceMarkers.filter((pattern) => pattern.test(text)).length;
    const attributionHits = attributionMarkers.filter((pattern) => pattern.test(text)).length;
    const explanationHits = explanationMarkers.filter((pattern) => pattern.test(text)).length;
    traceCompleteness = clampScore((traceHits * 25) + (attributionHits * 20) + (explanationHits * 15));
  }
  const attributionStability = clampScore(
    (/\bconsistent attribution\b/i.test(text) ? 40 : 0)
    + (/\bstable feature importance\b/i.test(text) ? 30 : 0)
    + (text.match(/\battribution\b/gi) || []).length >= 2 ? 30 : 0
  );
  const explanationCoverage = clampScore(
    (text.match(/\b(explain|because|therefore|attributed)\b/gi) || []).length >= 3 ? 80
      : (text.match(/\b(explain|because|therefore|attributed)\b/gi) || []).length >= 1 ? 55
        : traces.length ? 60 : 20
  );
  const score = clampScore((traceCompleteness * 0.4) + (attributionStability * 0.25) + (explanationCoverage * 0.35));
  const evidenceCount = traces.length || (text.trim() ? 1 : 0);
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  const dataAnalyzed = traces.length || text.length;
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'trace_completeness', value: traceCompleteness, unit: 'percent', direction: 'higher_better' },
      { name: 'attribution_stability', value: attributionStability, unit: 'percent', direction: 'higher_better' },
      { name: 'explanation_coverage', value: explanationCoverage, unit: 'percent', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No trace or explanation input supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(traceCompleteness < 50 ? [{ level: 'warn', message: 'Decision traces lack required completeness fields.', code: 'INCOMPLETE_TRACES' }] : []),
      ...(attributionStability < 50 ? [{ level: 'warn', message: 'Feature attribution signals are weak or inconsistent.', code: 'WEAK_ATTRIBUTION' }] : []),
      ...(explanationCoverage < 50 ? [{ level: 'info', message: 'Explanation markers are sparse in provided content.', code: 'LOW_EXPLANATION_COVERAGE' }] : [])
    ],
    recommendations: [
      'Include step-level decision traces with inputs, outputs, and confidence.',
      'Export feature attribution for top decisions and verify consistency across runs.',
      'Add natural-language explanations tied to attribution evidence.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'traces|responseText|codeText', detail: `Analyzed ${dataAnalyzed} trace unit(s) or character(s) for interpretability markers.` }
    ]
  };
}

function runDataQualityAnalyzer(definition, issueId, input = {}) {
  const samples = Array.isArray(input.datasetSamples) ? input.datasetSamples : [];
  if (isScanReportContext(input) && !samples.length) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 1,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'label_consistency_rate', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'class_balance_score', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'freshness_index', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'Scan report context does not include dataset samples or label metadata.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Run label agreement audits on a stratified sample before training.',
        'Apply class weighting or resampling when imbalance is detected.',
        'Track dataset freshness with explicit cutoff and refresh SLAs.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'datasetSamples', detail: 'No dataset samples supplied for data quality profiling.' }
      ]
    };
  }
  const text = combineAnalyzerText(input);
  const labelConsistencyHits = [
    /\blabel (consistency|agreement)\b/i,
    /\binter[- ]annotator agreement\b/i,
    /\bgold standard labels\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const imbalanceHits = [
    /\bclass imbalance\b/i,
    /\bimbalanced (dataset|classes)\b/i,
    /\bskewed (distribution|labels)\b/i,
    /\bminority class\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const balancePositiveHits = [
    /\bbalanced (dataset|classes)\b/i,
    /\bstratified split\b/i,
    /\bclass weights?\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const freshnessHits = [
    /\blast updated\b/i,
    /\bdata freshness\b/i,
    /\bcutoff date\b/i,
    /\bstaleness\b/i,
    /\brefreshed (daily|weekly|monthly)\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const staleHits = [/\bstale data\b/i, /\boutdated (dataset|labels)\b/i, /\bexpired\b/i]
    .filter((pattern) => pattern.test(text)).length;
  let labelConsistency = clampScore((labelConsistencyHits * 35) + (samples.length ? 40 : 0));
  if (/\binconsistent labels\b/i.test(text)) labelConsistency = clampScore(labelConsistency - 30);
  let classBalance = clampScore((balancePositiveHits * 30) + 40 - (imbalanceHits * 25));
  if (/\bno imbalance\b/i.test(text)) classBalance = clampScore(classBalance + 20);
  let freshnessIndex = clampScore((freshnessHits * 25) + 35 - (staleHits * 30));
  if (/\b202[4-9]\b/.test(text) || /\bupdated (today|recently)\b/i.test(text)) {
    freshnessIndex = clampScore(freshnessIndex + 20);
  }
  const score = clampScore((labelConsistency * 0.35) + (classBalance * 0.35) + (freshnessIndex * 0.3));
  const evidenceCount = samples.length || (text.trim() ? 1 : 0);
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  const dataAnalyzed = samples.length || text.length;
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'label_consistency_rate', value: labelConsistency, unit: 'percent', direction: 'higher_better' },
      { name: 'class_balance_score', value: classBalance, unit: 'percent', direction: 'higher_better' },
      { name: 'freshness_index', value: freshnessIndex, unit: 'percent', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No dataset or profiling input supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(labelConsistency < 50 ? [{ level: 'warn', message: 'Label consistency signals are weak.', code: 'LABEL_INCONSISTENCY' }] : []),
      ...(classBalance < 50 ? [{ level: 'warn', message: 'Class balance concerns detected.', code: 'CLASS_IMBALANCE' }] : []),
      ...(freshnessIndex < 50 ? [{ level: 'warn', message: 'Data freshness markers are missing or stale.', code: 'STALE_DATA' }] : [])
    ],
    recommendations: [
      'Run label agreement audits on a stratified sample before training.',
      'Apply class weighting or resampling when imbalance is detected.',
      'Track dataset freshness with explicit cutoff and refresh SLAs.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'datasetSamples|responseText', detail: `Profiled ${dataAnalyzed} sample unit(s) or character(s) for data quality markers.` }
    ]
  };
}

function runScalabilityAnalyzer(definition, issueId, input = {}) {
  const metrics = input.metrics || {};
  if (isScanReportContext(input) && !hasScalabilityBenchmarkMetrics(metrics)) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 1,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'throughput_score', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'latency_scalability_score', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'resource_efficiency_ratio', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'Scan report context does not include throughput or latency benchmarks.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Publish load-test results with throughput and p95 latency under realistic traffic.',
        'Profile hot paths and document bottleneck remediation plans.',
        'Add autoscaling and caching where resource efficiency is below target.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'metrics', detail: 'No scalability metrics supplied for benchmark analysis.' }
      ]
    };
  }
  const text = combineAnalyzerText(input);
  const scanReportMode = isScanReportContext(input);
  const throughputClaim = /\b(\d[\d,]*)\s*(req|requests?)\/s(ec(ond)?)?\b/i.test(text)
    || Number(metrics.throughputRps) > 0;
  const latencyClaim = /\bp(50|95|99)\b/i.test(text)
    || (/\b\d+\s*ms\b/i.test(text) && !(scanReportMode && isOperationalScanTimingClaim(text)))
    || Number(metrics.p95LatencyMs) > 0;
  const throughputEvidence = [
    /\bbenchmark(ed)?\b/i,
    /\bload test(ed)?\b/i,
    /\bthroughput (measured|observed)\b/i,
    /\b\d[\d,]*\s*rps\b/i
  ].some((pattern) => pattern.test(text)) || Number(metrics.throughputRps) > 0;
  const latencyEvidence = [
    /\bprofiled\b/i,
    /\bload test\b/i,
    /\bobserved latency\b/i,
    /\bp95\s*[:=]?\s*\d+/i
  ].some((pattern) => pattern.test(text)) || Number(metrics.p95LatencyMs) > 0;
  const bottleneckHits = [
    /\bbottleneck\b/i,
    /\bqueue backlog\b/i,
    /\bthrottl(e|ing)\b/i,
    /\bmemory leak\b/i,
    /\bo\s*\(\s*n\s*\)/i,
    /\bcpu bound\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const scalingPositive = [
    /\bhorizontal scaling\b/i,
    /\bauto[- ]scale\b/i,
    /\blinear scaling\b/i,
    /\bcaching layer\b/i
  ].filter((pattern) => pattern.test(text)).length;
  let throughputScore = throughputEvidence ? 75 : (throughputClaim ? 35 : 50);
  if (Number(metrics.throughputRps) >= 1000) throughputScore = clampScore(throughputScore + 15);
  let latencyScore = latencyEvidence ? 75 : (latencyClaim ? 35 : 50);
  if (Number(metrics.p95LatencyMs) > 0 && Number(metrics.p95LatencyMs) <= 200) {
    latencyScore = clampScore(latencyScore + 15);
  } else if (Number(metrics.p95LatencyMs) > 500) {
    latencyScore = clampScore(latencyScore - 20);
  }
  const resourceEfficiency = clampScore(70 - (bottleneckHits * 15) + (scalingPositive * 10));
  const score = clampScore((throughputScore * 0.35) + (latencyScore * 0.35) + (resourceEfficiency * 0.3));
  const evidenceCount = (text.trim() ? 1 : 0) + (Object.keys(metrics).length ? 1 : 0);
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  const dataAnalyzed = text.length + Object.keys(metrics).length;
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'throughput_score', value: throughputScore, unit: 'percent', direction: 'higher_better' },
      { name: 'latency_scalability_score', value: latencyScore, unit: 'percent', direction: 'higher_better' },
      { name: 'resource_efficiency_ratio', value: resourceEfficiency, unit: 'percent', direction: 'higher_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No scalability metrics or claims supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(throughputClaim && !throughputEvidence ? [{ level: 'warn', message: 'Throughput claims lack benchmark evidence.', code: 'UNVERIFIED_THROUGHPUT' }] : []),
      ...(latencyClaim && !latencyEvidence ? [{ level: 'warn', message: 'Latency claims lack profiling evidence.', code: 'UNVERIFIED_LATENCY' }] : []),
      ...(bottleneckHits ? [{ level: 'warn', message: `${bottleneckHits} scaling bottleneck pattern(s) detected.`, code: 'SCALING_BOTTLENECK' }] : [])
    ],
    recommendations: [
      'Publish load-test results with throughput and p95 latency under realistic traffic.',
      'Profile hot paths and document bottleneck remediation plans.',
      'Add autoscaling and caching where resource efficiency is below target.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'responseText|metrics', detail: `Reviewed ${dataAnalyzed} scalability signal(s) for claim-vs-evidence alignment.` }
    ]
  };
}

function runGeneralizationAnalyzer(definition, issueId, input = {}) {
  const benchmarks = input.benchmarks || {};
  if (isScanReportContext(input) && !Object.keys(benchmarks).length) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 1,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'ood_retention_score', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'generalization_gap', value: 0, unit: 'percent', direction: 'lower_better' },
        { name: 'failure_cluster_count', value: 0, unit: 'count', direction: 'lower_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'Scan report context does not include in-distribution or OOD benchmarks.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Compare in-distribution and OOD benchmarks with explicit retention metrics.',
        'Cluster OOD failure modes and track degradation over releases.',
        'Document benchmark suites used for generalization validation.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'benchmarks', detail: 'No generalization benchmarks supplied for analysis.' }
      ]
    };
  }
  const text = combineAnalyzerText(input);
  const idScore = Number(benchmarks.inDistributionAccuracy ?? benchmarks.idAccuracy ?? NaN);
  const oodScore = Number(benchmarks.outOfDistributionAccuracy ?? benchmarks.oodAccuracy ?? NaN);
  const oodClaims = [
    /\bout[- ]of[- ]distribution\b/i,
    /\bood\b/i,
    /\bunseen domain\b/i,
    /\bdistribution shift\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const degradationHits = [
    /\bdegrad(es|ation|ed)\b/i,
    /\bperformance drop\b/i,
    /\baccuracy (falls|drops|declines)\b/i,
    /\bgeneralization gap\b/i
  ].filter((pattern) => pattern.test(text)).length;
  const benchmarkHits = [
    /\bbenchmark\b/i,
    /\beval (set|suite)\b/i,
    /\bholdout\b/i,
    /\bcross[- ]validation\b/i
  ].filter((pattern) => pattern.test(text)).length;
  let oodRetention = 50;
  if (Number.isFinite(idScore) && Number.isFinite(oodScore) && idScore > 0) {
    oodRetention = clampScore((oodScore / idScore) * 100);
  } else if (/\bood retention\b/i.test(text) || /\bretains?\s+\d{2,3}%\b/i.test(text)) {
    oodRetention = clampScore(65 + (benchmarkHits * 5));
  } else if (oodClaims) {
    oodRetention = clampScore(45 + (benchmarkHits * 8) - (degradationHits * 10));
  }
  const generalizationGap = clampScore(100 - oodRetention);
  const failureClusters = degradationHits + (/\bfailure cluster\b/i.test(text) ? 1 : 0);
  const score = clampScore((oodRetention * 0.55) + ((100 - generalizationGap) * 0.25) + ((benchmarkHits ? 80 : 40) * 0.2));
  const evidenceCount = (text.trim() ? 1 : 0) + (Object.keys(benchmarks).length ? 1 : 0);
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount,
    minEvidence: 1,
    criticalRequiresMinEvidence: true
  });
  const dataAnalyzed = text.length + Object.keys(benchmarks).length;
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'ood_retention_score', value: oodRetention, unit: 'percent', direction: 'higher_better' },
      { name: 'generalization_gap', value: generalizationGap, unit: 'percent', direction: 'lower_better' },
      { name: 'failure_cluster_count', value: failureClusters, unit: 'count', direction: 'lower_better' },
      { name: 'data_analyzed', value: dataAnalyzed, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No generalization benchmark input supplied.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(oodClaims && !benchmarkHits ? [{ level: 'warn', message: 'OOD claims present without benchmark references.', code: 'UNBENCHMARKED_OOD' }] : []),
      ...(degradationHits ? [{ level: 'warn', message: 'Performance degradation language detected on OOD scenarios.', code: 'OOD_DEGRADATION' }] : []),
      ...(generalizationGap > 30 ? [{ level: 'warn', message: 'Generalization gap exceeds preferred threshold.', code: 'HIGH_GENERALIZATION_GAP' }] : [])
    ],
    recommendations: [
      'Compare in-distribution and OOD benchmarks with explicit retention metrics.',
      'Cluster OOD failure modes and track degradation over releases.',
      'Document benchmark suites used for generalization validation.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'benchmarks|responseText', detail: `Evaluated ${dataAnalyzed} generalization signal(s) for ID/OOD alignment.` }
    ]
  };
}

function runErrorHandlingAnalyzer(definition, issueId, input = {}) {
  const errors = collectErrorCases(input);
  if (!errors.length) {
    const risk = finalizeRiskAssessment(0, definition.scoringDirection, {
      evidenceCount: 0,
      minEvidence: 3,
      criticalRequiresMinEvidence: true
    });
    return {
      id: issueId,
      analyzerId: definition.id,
      name: definition.name,
      category: definition.category,
      purpose: definition.purpose,
      status: 'implemented',
      score: 0,
      severity: risk.severity,
      riskBand: risk.riskBand,
      evidenceStatus: risk.evidenceStatus,
      countsTowardRiskSummary: false,
      metrics: [
        { name: 'error_message_clarity_score', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'recovery_success_rate', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'time_to_resolution_score', value: 0, unit: 'score', direction: 'higher_better' },
        { name: 'error_code_coverage', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'remediation_hint_coverage', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'remediation_coverage', value: 0, unit: 'percent', direction: 'higher_better' },
        { name: 'mttr_minutes', value: null, unit: 'minutes', direction: 'lower_better' },
        { name: 'error_cases_reviewed', value: 0, unit: 'count', direction: 'higher_better' },
        { name: 'data_analyzed', value: 0, unit: 'count', direction: 'higher_better' }
      ],
      findings: [
        { level: 'info', message: 'No error cases supplied; error-handling risk is not scored until cases are available.', code: 'INSUFFICIENT_DATA' }
      ],
      recommendations: [
        'Include direct remediation steps and context IDs in all error messages.',
        'Add retry/backoff and fallback handling for common failure modes.',
        'Track top unresolved error classes and publish playbooks to reduce MTTR.'
      ],
      evidence: [
        { sourceType: 'input', pointer: 'errorCases|responseText|codeText|logs', detail: 'Reviewed 0 error case(s) from sources: none.' }
      ]
    };
  }
  const total = errors.length;
  const normalizedErrors = errors.map(normalizeErrorCase);
  const actionable = normalizedErrors.filter((row) => row.actionable).length;
  const recoverySuccess = normalizedErrors.filter((row) => row.recovered).length;
  const mttrMinutes = computeMttrMinutes(errors);
  const timedCaseCount = normalizedErrors.filter((row) => row.timeToResolutionMinutes !== null).length;
  const avgResolutionMinutes = mttrMinutes !== null
    ? mttrMinutes
    : (timedCaseCount
      ? normalizedErrors
        .filter((row) => row.timeToResolutionMinutes !== null)
        .reduce((sum, row) => sum + row.timeToResolutionMinutes, 0) / timedCaseCount
      : 60);
  const codeCoverageScore = clampScore((normalizedErrors.filter((row) => row.hasErrorCode).length / total) * 100);
  const remediationHintScore = clampScore((normalizedErrors.filter((row) => row.hasRemediationHint).length / total) * 100);
  const clarityScore = clampScore(((actionable / total) * 60) + (codeCoverageScore * 0.2) + (remediationHintScore * 0.2));
  const recoveryScore = clampScore((recoverySuccess / total) * 100);
  let resolutionScore = 10;
  if (avgResolutionMinutes <= 15) resolutionScore = 100;
  else if (avgResolutionMinutes <= 30) resolutionScore = 85;
  else if (avgResolutionMinutes <= 60) resolutionScore = 70;
  else if (avgResolutionMinutes <= 120) resolutionScore = 45;
  else if (avgResolutionMinutes <= 240) resolutionScore = 25;
  const remediationCoverage = clampScore((remediationHintScore * 0.6) + (codeCoverageScore * 0.4));
  const score = clampScore((clarityScore * 0.35) + (recoveryScore * 0.35) + (resolutionScore * 0.15) + (remediationCoverage * 0.15));
  const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
    evidenceCount: errors.length,
    minEvidence: 3,
    criticalRequiresMinEvidence: true
  });
  const sourcesUsed = [...new Set(normalizedErrors.map((row) => row.source))];
  return {
    id: issueId,
    analyzerId: definition.id,
    name: definition.name,
    category: definition.category,
    purpose: definition.purpose,
    status: 'implemented',
    score,
    severity: risk.severity,
    riskBand: risk.riskBand,
    evidenceStatus: risk.evidenceStatus,
    countsTowardRiskSummary: risk.evidenceStatus !== 'insufficient_data',
    metrics: [
      { name: 'error_message_clarity_score', value: clarityScore, unit: 'percent', direction: 'higher_better' },
      { name: 'recovery_success_rate', value: recoveryScore, unit: 'percent', direction: 'higher_better' },
      { name: 'time_to_resolution_score', value: resolutionScore, unit: 'score', direction: 'higher_better' },
      { name: 'error_code_coverage', value: codeCoverageScore, unit: 'percent', direction: 'higher_better' },
      { name: 'remediation_hint_coverage', value: remediationHintScore, unit: 'percent', direction: 'higher_better' },
      { name: 'remediation_coverage', value: remediationCoverage, unit: 'percent', direction: 'higher_better' },
      { name: 'mttr_minutes', value: mttrMinutes !== null ? Number(avgResolutionMinutes.toFixed(2)) : null, unit: 'minutes', direction: 'lower_better' },
      { name: 'error_cases_reviewed', value: errors.length, unit: 'count', direction: 'higher_better' },
      { name: 'data_analyzed', value: errors.length || combineAnalyzerText(input).length, unit: 'count', direction: 'higher_better' }
    ],
    findings: [
      ...(risk.evidenceStatus === 'insufficient_data' ? [{ level: 'info', message: 'No error cases supplied; severity held at moderate pending more evidence.', code: 'INSUFFICIENT_DATA' }] : []),
      ...(risk.evidenceStatus === 'limited_data' ? [{ level: 'info', message: `Only ${errors.length} error case(s) supplied; critical severity is suppressed until at least 3 cases are reviewed.`, code: 'LIMITED_DATA' }] : []),
      ...(clarityScore < 70 ? [{ level: 'warn', message: 'Error messages are frequently non-actionable.', code: 'LOW_ERROR_CLARITY' }] : []),
      ...(recoveryScore < 70 ? [{ level: 'warn', message: 'Recovery success rate is below target.', code: 'LOW_RECOVERY_RATE' }] : []),
      ...(resolutionScore < 50 ? [{ level: 'warn', message: 'Average time-to-resolution exceeds the preferred operational threshold.', code: 'SLOW_RESOLUTION' }] : []),
      ...(remediationCoverage < 60 ? [{ level: 'warn', message: 'Remediation guidance coverage is below target.', code: 'LOW_REMEDIATION_COVERAGE' }] : [])
    ],
    recommendations: [
      'Include direct remediation steps and context IDs in all error messages.',
      'Add retry/backoff and fallback handling for common failure modes.',
      'Track top unresolved error classes and publish playbooks to reduce MTTR.'
    ],
    evidence: [
      { sourceType: 'input', pointer: 'errorCases|responseText|codeText|logs', detail: `Reviewed ${errors.length} error case(s) from sources: ${sourcesUsed.join(', ') || 'none'}.` },
      ...(mttrMinutes !== null ? [{ sourceType: 'input', pointer: 'timestamps', detail: `Computed MTTR of ${avgResolutionMinutes.toFixed(1)} minute(s) from timestamp or duration fields.` }] : [])
    ]
  };
}

function deriveScanIssues(context = {}) {
  if (Array.isArray(context.scanIssues) && context.scanIssues.length) return context.scanIssues;
  if (Array.isArray(context.rawIssues) && context.rawIssues.length) return context.rawIssues;
  if (Array.isArray(context.issues) && context.issues.length) return context.issues;
  return [];
}

function deriveSubgroupOutcomes(context = {}) {
  if (Array.isArray(context.subgroupOutcomes) && context.subgroupOutcomes.length) {
    return context.subgroupOutcomes;
  }
  const issues = deriveScanIssues(context);
  const buckets = new Map();
  for (const issue of issues) {
    const subgroup = String(issue.type || issue.category || issue.kind || issue.severity || 'general');
    const prev = buckets.get(subgroup) || { total: 0, favorable: 0 };
    const count = Number(issue.count) > 0 ? Number(issue.count) : 1;
    prev.total += count;
    const severity = String(issue.severity || '').toLowerCase();
    if (severity !== 'critical' && severity !== 'high') {
      prev.favorable += count;
    }
    buckets.set(subgroup, prev);
  }
  if (!buckets.size) return undefined;
  return [...buckets.entries()].map(([subgroup, stats]) => ({
    subgroup,
    favorableRate: clampScore(stats.total ? (stats.favorable / stats.total) * 100 : 50),
    sampleSize: stats.total
  }));
}

function deriveResponses(context = {}) {
  if (Array.isArray(context.responses) && context.responses.length) {
    return context.responses.map((item) => String(item || '')).filter(Boolean);
  }
  if (isScanReportContext(context)) {
    return undefined;
  }
  const candidates = [
    context.responseText,
    context.aiResponse,
    context.aiSummary,
    context.backlogSnippet,
    context.conclusion,
    context.scanSummary
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return candidates.length ? [...new Set(candidates)] : undefined;
}

function deriveErrorCasesFromContext(context = {}) {
  if (Array.isArray(context.errorCases) && context.errorCases.length) {
    return context.errorCases;
  }
  const issues = deriveScanIssues(context);
  const derived = issues
    .filter((issue) => /\b(error|fail|exception|timeout|crash|unhandled)\b/i.test(
      String(issue.description || issue.message || issue.type || '')
    ))
    .map((issue) => ({
      message: String(issue.description || issue.message || issue.type || 'scan issue'),
      code: issue.code || issue.id,
      actionable: Boolean(issue.remediation || issue.suggestion || issue.nextStep),
      recovered: /\b(resolved|fixed|mitigated|recovered)\b/i.test(String(issue.description || '')),
      source: 'scan'
    }));
  return derived.length ? derived : undefined;
}

function resolveAnalyzerContext(analyzerInputs = {}) {
  const { context: nestedContext, default: defaultInput, ...rest } = analyzerInputs;
  const reserved = new Set(['default', 'context', ...Object.keys(IMPLEMENTED_RUNNERS)]);
  const flatContext = Object.fromEntries(
    Object.entries(rest).filter(([key]) => !reserved.has(key))
  );
  return {
    ...(nestedContext && typeof nestedContext === 'object' ? nestedContext : {}),
    ...flatContext,
    ...(defaultInput && typeof defaultInput === 'object' ? defaultInput : {})
  };
}

export function collectAnalyzerInputs(context = {}) {
  const snippets = {
    responseText: String(
      context.responseText
      || context.aiResponse
      || context.aiSummary
      || ''
    ).trim(),
    codeText: String(context.codeText || context.code || '').trim(),
    logs: String(context.logs || context.context?.logs || '').trim(),
    prompt: String(context.prompt || '').trim()
  };
  const shared = {
    responseText: snippets.responseText,
    codeText: snippets.codeText,
    context: { logs: snippets.logs },
    logs: snippets.logs || undefined,
    inputKind: context.inputKind,
    scanReportContext: context.scanReportContext === true || context.inputKind === 'scan-report'
  };
  const subgroupOutcomes = deriveSubgroupOutcomes(context);
  const responses = deriveResponses(context);
  const errorCases = deriveErrorCasesFromContext(context);
  const perAnalyzer = {
    default: shared,
    'interpretability-analyzer': {
      ...shared,
      traces: Array.isArray(context.traces) ? context.traces : undefined
    },
    'data-quality-analyzer': {
      ...shared,
      datasetSamples: Array.isArray(context.datasetSamples) ? context.datasetSamples : undefined
    },
    'scalability-analyzer': {
      ...shared,
      metrics: context.scalabilityMetrics || context.metrics || undefined
    },
    'generalization-analyzer': {
      ...shared,
      benchmarks: context.benchmarks || undefined
    },
    'error-handling-analyzer': {
      ...shared,
      errorCases,
      logs: snippets.logs || undefined
    },
    'security-risk-analyzer': {
      ...shared,
      prompt: snippets.prompt,
      responseText: snippets.responseText
    },
    'ai-output-reliability-analyzer': {
      ...shared,
      responseText: snippets.responseText
    },
    'hallucination-analyzer': {
      ...shared,
      ...(Array.isArray(context.claims) && context.claims.length ? { claims: context.claims } : {}),
      responseText: snippets.responseText
    },
    'bias-detection-analyzer': {
      ...shared,
      subgroupOutcomes
    },
    'response-consistency-analyzer': {
      ...shared,
      responses
    }
  };
  for (const analyzerId of Object.keys(IMPLEMENTED_RUNNERS)) {
    if (!perAnalyzer[analyzerId]) {
      perAnalyzer[analyzerId] = { ...shared };
    }
  }
  return perAnalyzer;
}

export const IMPLEMENTED_ANALYZER_ISSUE_IDS = AI_SYSTEM_ISSUES
  .filter((issue) => ANALYZER_BY_ID.get(issue.analyzerId)?.status === 'implemented')
  .map((issue) => issue.id);

export function runAllAnalyzers(context = {}, selectedIssueIds = IMPLEMENTED_ANALYZER_ISSUE_IDS) {
  return buildAiSystemsIssueAnalysis(selectedIssueIds, { context });
}

const IMPLEMENTED_RUNNERS = {
  'hallucination-analyzer': runHallucinationAnalyzer,
  'bias-detection-analyzer': runBiasDetectionAnalyzer,
  'interpretability-analyzer': runInterpretabilityAnalyzer,
  'data-quality-analyzer': runDataQualityAnalyzer,
  'scalability-analyzer': runScalabilityAnalyzer,
  'generalization-analyzer': runGeneralizationAnalyzer,
  'security-risk-analyzer': runSecurityRiskAnalyzer,
  'response-consistency-analyzer': runResponseConsistencyAnalyzer,
  'error-handling-analyzer': runErrorHandlingAnalyzer,
  'ai-output-reliability-analyzer': runAiOutputReliabilityAnalyzer
};

function executeAnalyzer(issueId, input = {}) {
  const definition = ANALYZER_BY_ISSUE_ID.get(issueId);
  if (!definition) return null;
  const runner = IMPLEMENTED_RUNNERS[definition.id];
  if (runner && definition.status === 'implemented') {
    return runner(definition, issueId, input);
  }
  return buildStubResult(definition, issueId);
}

function summarizeRisk(results) {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  let totalRisk = 0;
  let measuredCount = 0;
  for (const result of results) {
    if (result.countsTowardRiskSummary === false) {
      severityCounts.low += 1;
      continue;
    }
    const definition = ANALYZER_BY_ID.get(result.analyzerId);
    const riskScore = normalizeRiskScore(result.score, definition?.scoringDirection || 'lower_better');
    severityCounts[result.severity] += 1;
    totalRisk += riskScore;
    measuredCount += 1;
  }
  const avg = measuredCount ? Number((totalRisk / measuredCount).toFixed(2)) : 0;
  const overallRiskLevel = avg >= 70 ? 'High' : avg >= 50 ? 'Elevated' : avg >= 30 ? 'Moderate' : 'Low';
  return {
    totalRiskScore: Number(totalRisk.toFixed(2)),
    averageRiskScore: avg,
    overallRiskLevel,
    severityCounts,
    measuredAnalyzerCount: measuredCount
  };
}

function buildCategoryDistribution(selectedIssues) {
  const counts = new Map(CATEGORY_DEFINITIONS.map((item) => [item.name, 0]));
  for (const issue of selectedIssues) {
    counts.set(issue.category, (counts.get(issue.category) || 0) + 1);
  }
  const total = selectedIssues.length || 1;
  return CATEGORY_DEFINITIONS.map((category) => {
    const count = counts.get(category.name) || 0;
    return {
      categoryId: category.id,
      categoryName: category.name,
      selectedCount: count,
      percentage: Number(((count / total) * 100).toFixed(1))
    };
  });
}

export function groupIssuesByCategory() {
  return CATEGORY_DEFINITIONS.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    methods: category.methods,
    issues: AI_SYSTEM_ISSUES.filter((issue) => issue.category === category.name)
  }));
}

export function enrichAnalyzerContextFromCodeInsights(context = {}) {
  const next = { ...context };
  const understanding = context.codeUnderstanding;
  const report = context.zscriptReport?.report || context.zscriptReport;

  if (understanding?.fileInsights?.length) {
    const lines = understanding.fileInsights.map((item) => {
      const summary = item.understanding?.summary
        || item.understanding?.layers?.semantic?.purpose
        || '';
      return summary ? `${item.filePath}: ${summary}` : '';
    }).filter(Boolean);
    if (lines.length) {
      next.codeText = [next.codeText, ...lines].filter(Boolean).join('\n');
      next.understandingSummary = understanding.projectSummary;
    }
  }

  if (report?.problem_diagnosis) {
    const diagnosis = report.problem_diagnosis;
    next.domainDiagnosis = diagnosis;
    const claimTexts = [
      diagnosis.problem,
      ...(diagnosis.suspected_root_causes || []),
      ...(diagnosis.recommended_validation || [])
    ].filter(Boolean);
    next.claims = [
      ...(Array.isArray(next.claims) ? next.claims : []),
      ...claimTexts.map((text) => ({
        text: String(text),
        hasEvidence: true,
        confidence: 0.82,
        evidenceConfidence: 0.78,
        source: 'zscript-report'
      }))
    ];
    next.responseText = [
      next.responseText,
      diagnosis.problem,
      ...(diagnosis.suspected_root_causes || []).slice(0, 3)
    ].filter(Boolean).join('. ');
  }

  return next;
}

export function buildAiSystemsIssueAnalysis(selectedIssueIds = [], analyzerInputs = {}) {
  const normalized = normalizeSelectedIds(selectedIssueIds);
  const selectedIssues = normalized.map((id) => ISSUE_BY_ID.get(id));
  const context = enrichAnalyzerContextFromCodeInsights(resolveAnalyzerContext(analyzerInputs));
  const collected = collectAnalyzerInputs(context);
  const mergedInputs = { ...collected };
  for (const [key, value] of Object.entries(analyzerInputs)) {
    if (key === 'context' || value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      mergedInputs[key] = {
        ...(mergedInputs[key] || mergedInputs.default || {}),
        ...value
      };
    }
  }
  const analyzerResults = selectedIssues.map((issue) => {
    const perAnalyzerInput = mergedInputs[issue.analyzerId] || mergedInputs[issue.id] || mergedInputs.default || {};
    const result = executeAnalyzer(issue.id, perAnalyzerInput);
    if (!result) return null;
    const definition = ANALYZER_BY_ID.get(result.analyzerId);
    const riskScore = normalizeRiskScore(result.score, definition?.scoringDirection || 'lower_better');
    return {
      ...result,
      riskScore: Number(riskScore.toFixed(2))
    };
  }).filter(Boolean);
  const riskSummary = summarizeRisk(analyzerResults);
  const categoryDistribution = buildCategoryDistribution(selectedIssues);
  const topPriorityIssues = [...analyzerResults]
    .filter((result) => result.countsTowardRiskSummary !== false)
    .map((result) => {
      const issue = ISSUE_BY_ID.get(result.id);
      return {
        ...issue,
        priorityScore: result.riskScore,
        severity: result.severity,
        riskBand: result.riskBand
      };
    })
    .sort((a, b) => (b.priorityScore - a.priorityScore) || a.id.localeCompare(b.id))
    .slice(0, 5);
  const mitigationThemes = categoryDistribution
    .filter((item) => item.selectedCount > 0)
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      themes: [
        'Use deterministic evaluation fixtures and regression tests.',
        'Track category-specific metrics in release gates.',
        'Escalate high-risk findings with clear remediation owners.'
      ]
    }));

  const architecture = {
    dataCollectionLayer: {
      inputSchemaVersion: 'ai-problem-analyzer-suite.v1',
      selectedIssueCount: selectedIssues.length,
      selectedIssueIds: selectedIssues.map((item) => item.id),
      selectedCategoryIds: categoryDistribution.filter((item) => item.selectedCount > 0).map((item) => item.categoryId),
      selectedMethodDefinitions: groupIssuesByCategory()
        .filter((group) => group.issues.some((issue) => selectedIssues.some((selected) => selected.id === issue.id)))
        .map((group) => ({ categoryId: group.categoryId, categoryName: group.categoryName, methods: group.methods }))
    },
    analysisEngine: {
      deterministicRubric: 'riskScore = normalize(score, scoringDirection), then apply evidence-aware moderation before fixed severity thresholds',
      rubricVersion: '2.0.0',
      scoringBands: {
        critical: '>=75',
        high: '55-74.99',
        medium: '35-54.99',
        low: '<35'
      },
      summary: {
        overallRiskLevel: riskSummary.overallRiskLevel,
        selectedCount: selectedIssues.length,
        analyzedCount: analyzerResults.length,
        measuredCount: riskSummary.measuredAnalyzerCount
      }
    },
    alertingAndReporting: {
      alertLevel: riskSummary.overallRiskLevel,
      escalationRule: riskSummary.severityCounts.critical > 0
        ? 'Immediate review required for critical analyzer findings.'
        : 'Review results in regular reliability/security cadence.',
      recommendedCadence: riskSummary.overallRiskLevel === 'High'
        ? 'daily'
        : riskSummary.overallRiskLevel === 'Elevated'
          ? 'twice-weekly'
          : 'weekly'
    },
    keyDesignPrinciples: [
      'Exact 48-analyzer taxonomy with category fidelity.',
      'Deterministic local execution for implemented analyzers.',
      'Contract-valid safe stubs for all planned analyzers.',
      'Machine-readable payload with stable field schema.'
    ]
  };

  return {
    summary: {
      selectedIssueCount: selectedIssues.length,
      categoryCount: categoryDistribution.filter((item) => item.selectedCount > 0).length,
      implementedCount: analyzerResults.filter((result) => result.status === 'implemented').length,
      stubCount: analyzerResults.filter((result) => result.status !== 'implemented').length
    },
    categoryDistribution,
    riskSummary,
    topPriorityIssues,
    mitigationThemes,
    architecture,
    analyzerResults,
    payload: {
      type: 'ai-problem-analyzer-suite',
      analysisVersion: '2.0.0',
      taxonomyVersion: 'final-48-analyzers',
      selectedIssueIds: selectedIssues.map((item) => item.id),
      selectedIssueCount: selectedIssues.length,
      categoryDistribution,
      riskSummary,
      topPriorityIssues,
      analyzerResults,
      registry: ANALYZER_CATALOG
    }
  };
}
