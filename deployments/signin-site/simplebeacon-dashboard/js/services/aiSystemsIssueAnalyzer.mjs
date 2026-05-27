const CATEGORY_ORDER = [
  'technical-challenges',
  'reasoning-understanding-limitations',
  'resource-infrastructure-issues',
  'security-privacy-concerns',
  'ethical-societal-issues',
  'reliability-trust-issues',
  'alignment-safety'
];

export const AI_ISSUE_CATEGORIES = [
  {
    id: 'technical-challenges',
    name: 'Technical Challenges',
    methods: [
      {
        id: 'fact-checking-pipeline',
        name: 'Fact-checking pipeline',
        description: 'Verifies generated claims against trusted sources before output finalization.',
        type: 'validation'
      },
      {
        id: 'shap-lime-interpretability',
        name: 'SHAP/LIME interpretability',
        description: 'Provides local and global feature-attribution explanations for model behavior.',
        type: 'explainability'
      },
      {
        id: 'adversarial-testing',
        name: 'Adversarial testing',
        description: 'Stress-tests model robustness with crafted perturbations and red-team prompts.',
        type: 'robustness'
      }
    ],
    mitigationThemes: [
      'Ground responses in retrieval + citation checks',
      'Expand edge-case and adversarial evaluation coverage',
      'Continuously monitor drift and retrain with curated data'
    ]
  },
  {
    id: 'reasoning-understanding-limitations',
    name: 'Reasoning & Understanding Limitations',
    methods: [
      {
        id: 'chain-of-thought-audits',
        name: 'Reasoning trace audits',
        description: 'Evaluates multi-step reasoning consistency on benchmark tasks.',
        type: 'evaluation'
      },
      {
        id: 'causal-probing',
        name: 'Causal probing tests',
        description: 'Measures ability to infer cause-and-effect relationships under counterfactual prompts.',
        type: 'evaluation'
      }
    ],
    mitigationThemes: [
      'Use structured reasoning templates for critical workflows',
      'Separate arithmetic/logic checks from language generation',
      'Prefer specialist solvers for high-stakes computations'
    ]
  },
  {
    id: 'resource-infrastructure-issues',
    name: 'Resource & Infrastructure Issues',
    methods: [
      {
        id: 'latency-profiling',
        name: 'Latency profiling',
        description: 'Profiles end-to-end request latency across tokenization, inference, and post-processing.',
        type: 'performance'
      },
      {
        id: 'capacity-load-testing',
        name: 'Capacity load testing',
        description: 'Validates throughput and autoscaling behavior under peak traffic scenarios.',
        type: 'performance'
      }
    ],
    mitigationThemes: [
      'Apply model distillation/quantization where quality permits',
      'Use tiered serving with caching and batching',
      'Track energy and carbon cost per workload'
    ]
  },
  {
    id: 'security-privacy-concerns',
    name: 'Security & Privacy Concerns',
    methods: [
      {
        id: 'prompt-injection-red-team',
        name: 'Prompt injection red-team',
        description: 'Tests instruction hierarchy enforcement against malicious prompt payloads.',
        type: 'security'
      },
      {
        id: 'privacy-leakage-audits',
        name: 'Privacy leakage audits',
        description: 'Checks for memorization and unauthorized sensitive data disclosure paths.',
        type: 'security'
      }
    ],
    mitigationThemes: [
      'Enforce strict input/output guardrails and content filtering',
      'Minimize sensitive training data and apply differential privacy controls',
      'Use model access controls, watermarking, and request anomaly detection'
    ]
  },
  {
    id: 'ethical-societal-issues',
    name: 'Ethical & Societal Issues',
    methods: [
      {
        id: 'bias-audits',
        name: 'Bias and fairness audits',
        description: 'Runs subgroup performance checks and disparate impact analysis.',
        type: 'governance'
      },
      {
        id: 'provenance-and-watermarking',
        name: 'Content provenance checks',
        description: 'Tracks origin metadata and watermark signals for synthetic media.',
        type: 'governance'
      }
    ],
    mitigationThemes: [
      'Establish human-review checkpoints for high-impact decisions',
      'Implement content authenticity and provenance controls',
      'Maintain policy alignment with legal and regulatory guidance'
    ]
  },
  {
    id: 'reliability-trust-issues',
    name: 'Reliability & Trust Issues',
    methods: [
      {
        id: 'reliability-diagrams',
        name: 'Reliability diagrams',
        description: 'Compares confidence scores to empirical correctness to detect miscalibration.',
        type: 'reliability'
      },
      {
        id: 'consistency-regression-suite',
        name: 'Consistency regression suite',
        description: 'Measures response variance for repeated prompts across versions.',
        type: 'reliability'
      }
    ],
    mitigationThemes: [
      'Calibrate confidence and expose uncertainty when confidence is low',
      'Track repeatability metrics release-over-release',
      'Require abstention thresholds for low-evidence outputs'
    ]
  },
  {
    id: 'alignment-safety',
    name: 'Alignment & Safety',
    methods: [
      {
        id: 'reward-model-audits',
        name: 'Reward model audits',
        description: 'Detects objective exploits and behavior drift under optimization pressure.',
        type: 'safety'
      },
      {
        id: 'policy-stress-tests',
        name: 'Policy stress tests',
        description: 'Exercises refusal and control boundaries for harmful or disallowed tasks.',
        type: 'safety'
      }
    ],
    mitigationThemes: [
      'Constrain objectives with explicit safety policies',
      'Add fail-safe and human-override controls for critical actions',
      'Continuously monitor emergent behavior with staged deployment gates'
    ]
  }
];

const CATEGORY_NAME_TO_ID = new Map(AI_ISSUE_CATEGORIES.map((category) => [category.name, category.id]));
const CATEGORY_BY_ID = new Map(AI_ISSUE_CATEGORIES.map((category) => [category.id, category]));

const ISSUE_CRITICALITY_WEIGHTS = {
  'AI-01': 2,
  'AI-02': 2,
  'AI-07': 2,
  'AI-19': 3,
  'AI-21': 3,
  'AI-24': 2,
  'AI-26': 3,
  'AI-28': 3,
  'AI-33': 3,
  'AI-34': 3,
  'AI-35': 3,
  'AI-37': 4
};

const CATEGORY_BASE_WEIGHTS = {
  'technical-challenges': 3,
  'reasoning-understanding-limitations': 3,
  'resource-infrastructure-issues': 2,
  'security-privacy-concerns': 4,
  'ethical-societal-issues': 4,
  'reliability-trust-issues': 3,
  'alignment-safety': 5
};

export const AI_SYSTEM_ISSUES = [
  { id: 'AI-01', title: 'Hallucinations', category: 'Technical Challenges', description: 'AI generates confident but factually incorrect information.' },
  { id: 'AI-02', title: 'Bias and Fairness', category: 'Technical Challenges', description: 'Models inherit and amplify biases from training data.' },
  { id: 'AI-03', title: 'Black Box Problem', category: 'Technical Challenges', description: 'Lack of explainability and transparency in decision-making.' },
  { id: 'AI-04', title: 'Data Quality & Quantity', category: 'Technical Challenges', description: 'Systems require massive amounts of high-quality data.' },
  { id: 'AI-05', title: 'Overfitting/Underfitting', category: 'Technical Challenges', description: 'Difficulty generalizing beyond training data.' },
  { id: 'AI-06', title: 'Catastrophic Forgetting', category: 'Technical Challenges', description: 'Learning new tasks can erase prior knowledge.' },
  { id: 'AI-07', title: 'Adversarial Vulnerability', category: 'Technical Challenges', description: 'Susceptibility to malicious inputs that fool the system.' },
  { id: 'AI-08', title: 'Edge Case Failures', category: 'Technical Challenges', description: 'Poor performance on rare or unusual scenarios.' },
  { id: 'AI-09', title: 'Limited Context Window', category: 'Technical Challenges', description: 'Difficulty maintaining long-range context and coherence.' },
  { id: 'AI-10', title: 'Lack of Common Sense', category: 'Reasoning & Understanding Limitations', description: 'Struggles with intuitive real-world knowledge.' },
  { id: 'AI-11', title: 'Pattern Matching vs Understanding', category: 'Reasoning & Understanding Limitations', description: 'Mimics reasoning without true comprehension.' },
  { id: 'AI-12', title: 'Causal Reasoning Deficits', category: 'Reasoning & Understanding Limitations', description: 'Difficulty understanding cause-and-effect relationships.' },
  { id: 'AI-13', title: 'Mathematical & Logical Errors', category: 'Reasoning & Understanding Limitations', description: 'Prone to calculation and reasoning mistakes.' },
  { id: 'AI-14', title: 'Temporal Reasoning', category: 'Reasoning & Understanding Limitations', description: 'Challenges with time-based concepts and sequences.' },
  { id: 'AI-15', title: 'Computational Cost', category: 'Resource & Infrastructure Issues', description: 'Massive energy and hardware requirements.' },
  { id: 'AI-16', title: 'Environmental Impact', category: 'Resource & Infrastructure Issues', description: 'Significant carbon footprint from training and inference.' },
  { id: 'AI-17', title: 'Scalability Challenges', category: 'Resource & Infrastructure Issues', description: 'Difficulty deploying at scale while preserving performance.' },
  { id: 'AI-18', title: 'Latency Issues', category: 'Resource & Infrastructure Issues', description: 'Real-time applications face response speed limits.' },
  { id: 'AI-19', title: 'Data Privacy', category: 'Security & Privacy Concerns', description: 'Training data may contain sensitive personal information.' },
  { id: 'AI-20', title: 'Model Theft', category: 'Security & Privacy Concerns', description: 'Proprietary models can be extracted or reverse-engineered.' },
  { id: 'AI-21', title: 'Prompt Injection', category: 'Security & Privacy Concerns', description: 'Vulnerability to malicious instructions in user input.' },
  { id: 'AI-22', title: 'Training Data Extraction', category: 'Security & Privacy Concerns', description: 'Attackers can recover training data from models.' },
  { id: 'AI-23', title: 'Job Displacement', category: 'Ethical & Societal Issues', description: 'Automation threatens parts of the labor market.' },
  { id: 'AI-24', title: 'Misinformation Generation', category: 'Ethical & Societal Issues', description: 'Can create convincing fake content at scale.' },
  { id: 'AI-25', title: 'Copyright & IP Issues', category: 'Ethical & Societal Issues', description: 'Training data usage raises legal uncertainty.' },
  { id: 'AI-26', title: 'Deepfakes & Manipulation', category: 'Ethical & Societal Issues', description: 'Synthetic media can deceive and manipulate audiences.' },
  { id: 'AI-27', title: 'Surveillance & Control', category: 'Ethical & Societal Issues', description: 'Enables expansive monitoring capabilities.' },
  { id: 'AI-28', title: 'Autonomous Weaponization', category: 'Ethical & Societal Issues', description: 'Military applications introduce major safety concerns.' },
  { id: 'AI-29', title: 'Inconsistency', category: 'Reliability & Trust Issues', description: 'Same prompt may produce different outputs.' },
  { id: 'AI-30', title: 'Confidence Calibration', category: 'Reliability & Trust Issues', description: 'Systems can express unwarranted confidence.' },
  { id: 'AI-31', title: 'Failure to Admit Ignorance', category: 'Reliability & Trust Issues', description: 'May hallucinate instead of acknowledging uncertainty.' },
  { id: 'AI-32', title: 'Evaluation Challenges', category: 'Reliability & Trust Issues', description: 'True capabilities and limitations are hard to measure.' },
  { id: 'AI-33', title: 'Value Alignment', category: 'Alignment & Safety', description: 'Difficulty ensuring model goals match human values.' },
  { id: 'AI-34', title: 'Reward Hacking', category: 'Alignment & Safety', description: 'Systems exploit objective functions in unintended ways.' },
  { id: 'AI-35', title: 'Specification Gaming', category: 'Alignment & Safety', description: 'Models find loopholes without meeting intended behavior.' },
  { id: 'AI-36', title: 'Emergent Behaviors', category: 'Alignment & Safety', description: 'Unanticipated capabilities may appear and create harm.' },
  { id: 'AI-37', title: 'Control Problem', category: 'Alignment & Safety', description: 'Maintaining human control over advanced systems is difficult.' }
];

const ISSUE_BY_ID = new Map(AI_SYSTEM_ISSUES.map((issue) => [issue.id, issue]));

function normalizeSelectedIds(selectedIssueIds = []) {
  const validIds = [];
  const seen = new Set();
  for (const rawId of selectedIssueIds) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id) || !ISSUE_BY_ID.has(id)) continue;
    seen.add(id);
    validIds.push(id);
  }
  return validIds;
}

function scoreToSeverity(score) {
  if (score >= 10) return 'critical';
  if (score >= 8) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

function scoreToRiskBand(score) {
  if (score >= 9) return 'High';
  if (score >= 7) return 'Elevated';
  if (score >= 5) return 'Moderate';
  return 'Low';
}

function summarizeRisk(scoredIssues) {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  let totalScore = 0;
  for (const issue of scoredIssues) {
    severityCounts[issue.severity] += 1;
    totalScore += issue.priorityScore;
  }
  const average = scoredIssues.length ? Number((totalScore / scoredIssues.length).toFixed(2)) : 0;
  let overallRiskLevel = 'Low';
  if (severityCounts.critical > 0 || average >= 9) overallRiskLevel = 'High';
  else if (severityCounts.high >= 3 || average >= 7) overallRiskLevel = 'Elevated';
  else if (severityCounts.medium >= 3 || average >= 5) overallRiskLevel = 'Moderate';
  return {
    totalRiskScore: totalScore,
    averageRiskScore: average,
    overallRiskLevel,
    severityCounts
  };
}

function buildCategoryDistribution(selectedIssues) {
  const counts = new Map(CATEGORY_ORDER.map((categoryId) => [categoryId, 0]));
  for (const issue of selectedIssues) {
    const categoryId = CATEGORY_NAME_TO_ID.get(issue.category);
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }
  const total = selectedIssues.length || 1;
  return CATEGORY_ORDER.map((categoryId) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    const count = counts.get(categoryId) || 0;
    return {
      categoryId,
      categoryName: category.name,
      selectedCount: count,
      percentage: Number(((count / total) * 100).toFixed(1))
    };
  });
}

function buildMitigationThemes(selectedCategoryIds) {
  return selectedCategoryIds.map((categoryId) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    return {
      categoryId,
      categoryName: category.name,
      themes: category.mitigationThemes
    };
  });
}

function buildArchitectureSections(selectedIssues, categoryDistribution, scoredIssues, riskSummary) {
  const selectedCategoryIds = categoryDistribution.filter((item) => item.selectedCount > 0).map((item) => item.categoryId);
  const selectedMethodDefinitions = selectedCategoryIds.map((categoryId) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    return {
      categoryId,
      categoryName: category.name,
      methods: category.methods
    };
  });
  return {
    dataCollectionLayer: {
      inputSchemaVersion: 'ai-systems-issue-analyzer.v1',
      selectedIssueCount: selectedIssues.length,
      selectedIssueIds: selectedIssues.map((issue) => issue.id),
      selectedCategoryIds,
      selectedMethodDefinitions
    },
    analysisEngine: {
      deterministicRubric: 'priorityScore = categoryBaseWeight + issueCriticalityWeight + methodCoverageWeight',
      rubricVersion: '1.0.0',
      categoryBaseWeights: CATEGORY_BASE_WEIGHTS,
      methodCoverageWeight: 1,
      scoringBandReference: {
        critical: '>=10',
        high: '8-9',
        medium: '6-7',
        low: '<=5'
      },
      topPriorityLogic: 'Sort descending by priorityScore, then id ascending, take first 5',
      summary: {
        overallRiskLevel: riskSummary.overallRiskLevel,
        selectedCount: selectedIssues.length,
        analyzedCount: scoredIssues.length
      }
    },
    alertingAndReporting: {
      alertLevel: riskSummary.overallRiskLevel,
      escalationRule: riskSummary.severityCounts.critical > 0 ? 'Immediate architecture review required' : 'Weekly risk review cadence',
      recommendedCadence: riskSummary.overallRiskLevel === 'High' ? 'daily' : riskSummary.overallRiskLevel === 'Elevated' ? 'twice-weekly' : 'weekly',
      reportSections: [
        'Selected issue count',
        'Category distribution',
        'Risk summary',
        'Top priority issues',
        'Mitigation themes'
      ]
    },
    keyDesignPrinciples: [
      'Deterministic scoring and reproducible outputs',
      'Category-first modular structure for extensibility',
      'Transparent rubric with explainable priority calculation',
      'Separation of human-readable report and machine-readable payload'
    ]
  };
}

function scoreIssue(issue) {
  const categoryId = CATEGORY_NAME_TO_ID.get(issue.category);
  const baseWeight = CATEGORY_BASE_WEIGHTS[categoryId] || 1;
  const criticalityWeight = ISSUE_CRITICALITY_WEIGHTS[issue.id] || 1;
  const methodCoverageWeight = 1;
  const priorityScore = baseWeight + criticalityWeight + methodCoverageWeight;
  return {
    ...issue,
    categoryId,
    priorityScore,
    severity: scoreToSeverity(priorityScore),
    riskBand: scoreToRiskBand(priorityScore)
  };
}

export function groupIssuesByCategory() {
  return CATEGORY_ORDER.map((categoryId) => {
    const category = CATEGORY_BY_ID.get(categoryId);
    return {
      categoryId,
      categoryName: category.name,
      methods: category.methods,
      issues: AI_SYSTEM_ISSUES.filter((issue) => CATEGORY_NAME_TO_ID.get(issue.category) === categoryId)
    };
  });
}

export function buildAiSystemsIssueAnalysis(selectedIssueIds = []) {
  const normalizedIds = normalizeSelectedIds(selectedIssueIds);
  const selectedIssues = normalizedIds.map((id) => ISSUE_BY_ID.get(id));
  const scoredIssues = selectedIssues.map(scoreIssue);
  const categoryDistribution = buildCategoryDistribution(selectedIssues);
  const riskSummary = summarizeRisk(scoredIssues);
  const topPriorityIssues = [...scoredIssues]
    .sort((a, b) => (b.priorityScore - a.priorityScore) || a.id.localeCompare(b.id))
    .slice(0, 5);
  const selectedCategoryIds = categoryDistribution
    .filter((item) => item.selectedCount > 0)
    .map((item) => item.categoryId);
  const mitigationThemes = buildMitigationThemes(selectedCategoryIds);
  const architecture = buildArchitectureSections(selectedIssues, categoryDistribution, scoredIssues, riskSummary);

  return {
    summary: {
      selectedIssueCount: selectedIssues.length,
      categoryCount: selectedCategoryIds.length
    },
    categoryDistribution,
    riskSummary,
    topPriorityIssues,
    mitigationThemes,
    architecture,
    payload: {
      type: 'ai-systems-issue-analysis',
      analysisVersion: '1.0.0',
      taxonomyVersion: '2026-05-25',
      selectedIssueIds: selectedIssues.map((issue) => issue.id),
      selectedIssueCount: selectedIssues.length,
      categoryDistribution,
      riskSummary,
      topPriorityIssues,
      mitigationThemes,
      architecture
    }
  };
}
