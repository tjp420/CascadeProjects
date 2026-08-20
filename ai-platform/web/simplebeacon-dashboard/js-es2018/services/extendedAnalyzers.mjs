// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Create extended analyzers.
 * @param {Array} deps
 * @returns {any}
 */
export function createExtendedAnalyzers(deps) {
  const {
    clampScore,
    finalizeRiskAssessment,
    buildHigherBetterResult,
    buildLowerBetterResult,
    buildInsufficientResult,
    collectSocietalImpactText,
    collectMarketShares,
    computeHhi,
    MARKET_LOCKIN_MARKERS,
    isScanReportContext,
  } = deps;
  const PRIVACY_CONCERN_MARKERS = [
    /\bgdpr\b/i,
    /\bprivacy policy\b/i,
    /\bdata retention\b/i,
    /\bpii\b/i,
    /\bconsent\b/i,
    /\baudit logging\b/i,
  ];
  const TRANSPARENCY_MARKERS = [
    /\brationale\b/i,
    /\blimitation\b/i,
    /\bhuman review\b/i,
    /\bdisclosure\b/i,
    /\bexplain\b/i,
  ];
  const DEPENDENCE_POSITIVE_MARKERS = [
    /\bhuman[- ]in[- ]the[- ]loop\b/i,
    /\bhuman override\b/i,
    /\bmanual review\b/i,
    /\bfallback\b/i,
  ];
  const DEPENDENCE_NEGATIVE_MARKERS = [
    /\bfully automated\b/i,
    /\bwithout review\b/i,
    /\bno human\b/i,
    /\bautonomous deployment\b/i,
  ];
  /**
   * Collect task sequence scores.
   * @param {any} input
   * @returns {any}
   */
  function collectTaskSequenceScores(input = {}) {
    if (!Array.isArray(input.taskSequenceScores)) return [];
    return input.taskSequenceScores
      .map((row) => {
        var _a, _b, _c;
        return {
          task: String(row.task || "task"),
          score: clampScore(
            Number((_a = row.score) !== null && _a !== void 0 ? _a : 0),
          ),
          checkpoint: Number(
            (_c =
              (_b = row.checkpoint) !== null && _b !== void 0
                ? _b
                : row.step) !== null && _c !== void 0
              ? _c
              : 0,
          ),
        };
      })
      .filter((row) => row.score > 0);
  }
  /**
   * Run catastrophic forgetting analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runCatastrophicForgettingAnalyzer(definition, issueId, input = {}) {
    const scores = collectTaskSequenceScores(input);
    if (scores.length < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "taskSequenceScores",
        "At least two task sequence score checkpoints are required.",
        [
          {
            name: "retention_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "knowledge_decay_speed",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "interference_score",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Compare old-task scores across training checkpoints.",
          "Track retention decay per task family.",
          "Flag interference when new tasks reduce prior-task performance.",
        ],
      );
    }
    const byTask = new Map();
    for (const row of scores) {
      if (!byTask.has(row.task)) byTask.set(row.task, []);
      byTask.get(row.task).push(row);
    }
    const retentionRatios = [];
    for (const rows of byTask.values()) {
      rows.sort((a, b) => a.checkpoint - b.checkpoint);
      const baseline = rows[0].score;
      const latest = rows[rows.length - 1].score;
      if (baseline > 0) retentionRatios.push((latest / baseline) * 100);
    }
    if (!retentionRatios.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "taskSequenceScores",
        "Task sequence scores must include comparable checkpoints per task.",
        [
          {
            name: "retention_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "knowledge_decay_speed",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "interference_score",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Compare old-task scores across training checkpoints.",
          "Track retention decay per task family.",
          "Flag interference when new tasks reduce prior-task performance.",
        ],
      );
    }
    const retentionRate = clampScore(
      retentionRatios.reduce((sum, value) => sum + value, 0) /
        retentionRatios.length,
    );
    const knowledgeDecaySpeed = clampScore(100 - retentionRate);
    const interferenceScore = clampScore(
      Math.max(...retentionRatios.map((value) => 100 - value)),
    );
    const score = clampScore(
      retentionRate * 0.55 +
        (100 - knowledgeDecaySpeed) * 0.25 +
        (100 - interferenceScore) * 0.2,
    );
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: scores.length,
      minEvidence: 2,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "retention_rate",
          value: retentionRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "knowledge_decay_speed",
          value: knowledgeDecaySpeed,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "interference_score",
          value: interferenceScore,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: scores.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      retentionRate < 80
        ? [
            {
              level: "warn",
              message:
                "Knowledge retention dropped below target across sequential tasks.",
              code: "LOW_RETENTION",
            },
          ]
        : [],
      [
        "Compare old-task scores across training checkpoints.",
        "Track retention decay per task family.",
        "Flag interference when new tasks reduce prior-task performance.",
      ],
      `Evaluated ${scores.length} task score checkpoint(s) across ${byTask.size} task(s).`,
      "taskSequenceScores",
    );
  }
  /**
   * Run prompt engineering difficulty analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runPromptEngineeringDifficultyAnalyzer(
    definition,
    issueId,
    input = {},
  ) {
    const attempts = Array.isArray(input.promptAttempts)
      ? input.promptAttempts
      : [];
    if (!attempts.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "promptAttempts",
        "At least one prompt attempt record is required.",
        [
          {
            name: "attempts_to_success",
            value: 0,
            unit: "count",
            direction: "lower_better",
          },
          {
            name: "expert_novice_gap",
            value: 0,
            unit: "count",
            direction: "lower_better",
          },
          {
            name: "prompt_complexity_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Log attempts-to-success by prompt variant.",
          "Compare novice and expert iteration counts.",
          "Reduce prompt complexity with templates and examples.",
        ],
      );
    }
    const rows = attempts.filter((row) => row.succeeded !== false);
    const attemptsToSuccess = rows.length
      ? rows.reduce((sum, row) => {
          var _a;
          return (
            sum +
            Math.max(
              1,
              Number((_a = row.attempts) !== null && _a !== void 0 ? _a : 1),
            )
          );
        }, 0) / rows.length
      : 0;
    const expertRows = rows.filter(
      (row) => String(row.expertise || "").toLowerCase() === "expert",
    );
    const noviceRows = rows.filter(
      (row) => String(row.expertise || "").toLowerCase() === "novice",
    );
    const expertAvg = expertRows.length
      ? expertRows.reduce((sum, row) => {
          var _a;
          return (
            sum +
            Math.max(
              1,
              Number((_a = row.attempts) !== null && _a !== void 0 ? _a : 1),
            )
          );
        }, 0) / expertRows.length
      : attemptsToSuccess;
    const noviceAvg = noviceRows.length
      ? noviceRows.reduce((sum, row) => {
          var _a;
          return (
            sum +
            Math.max(
              1,
              Number((_a = row.attempts) !== null && _a !== void 0 ? _a : 1),
            )
          );
        }, 0) / noviceRows.length
      : attemptsToSuccess;
    const expertNoviceGap = Math.max(0, noviceAvg - expertAvg);
    const promptComplexityIndex = clampScore(
      Math.min(100, attemptsToSuccess * 12 + expertNoviceGap * 10),
    );
    const score = promptComplexityIndex;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: rows.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildLowerBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "attempts_to_success",
          value: Number(attemptsToSuccess.toFixed(2)),
          unit: "count",
          direction: "lower_better",
        },
        {
          name: "expert_novice_gap",
          value: Number(expertNoviceGap.toFixed(2)),
          unit: "count",
          direction: "lower_better",
        },
        {
          name: "prompt_complexity_index",
          value: promptComplexityIndex,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: rows.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      attemptsToSuccess >= 4
        ? [
            {
              level: "warn",
              message:
                "High attempts-to-success indicates prompt engineering friction.",
              code: "HIGH_PROMPT_FRICTION",
            },
          ]
        : [],
      [
        "Log attempts-to-success by prompt variant.",
        "Compare novice and expert iteration counts.",
        "Reduce prompt complexity with templates and examples.",
      ],
      `Reviewed ${rows.length} prompt attempt record(s).`,
      "promptAttempts",
    );
  }
  /**
   * Run cost barrier analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runCostBarrierAnalyzer(definition, issueId, input = {}) {
    const tiers = Array.isArray(input.pricingTiers) ? input.pricingTiers : [];
    const text = collectSocietalImpactText(input);
    if (isScanReportContext(input) && !tiers.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "pricingTiers|responseText",
        "No pricing tier or affordability evidence in scan report context.",
        [
          {
            name: "affordability_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "cost_effectiveness_ratio",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "barrier_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Publish transparent tier pricing.",
          "Track cost per successful outcome by segment.",
          "Offer subsidized tiers for high-friction segments.",
        ],
      );
    }
    if (!tiers.length && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "pricingTiers|responseText",
        "Pricing tiers or affordability narrative is required.",
        [
          {
            name: "affordability_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "cost_effectiveness_ratio",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "barrier_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Publish transparent tier pricing.",
          "Track cost per successful outcome by segment.",
          "Offer subsidized tiers for high-friction segments.",
        ],
      );
    }
    let affordabilityScore = text.trim() ? 55 : 45;
    if (
      tiers.some((tier) => tier.free === true || Number(tier.monthlyCost) === 0)
    )
      affordabilityScore += 25;
    const costs = tiers
      .map((tier) => {
        var _a, _b;
        return Number(
          (_b =
            (_a = tier.monthlyCost) !== null && _a !== void 0
              ? _a
              : tier.cost) !== null && _b !== void 0
            ? _b
            : 0,
        );
      })
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (costs.length)
      affordabilityScore +=
        Math.max(...costs) <= 20 ? 20 : Math.max(...costs) <= 50 ? 10 : 0;
    if (/\baffordab/i.test(text)) affordabilityScore += 10;
    affordabilityScore = clampScore(affordabilityScore);
    const barrierIndex = clampScore(100 - affordabilityScore);
    const costEffectivenessRatio = clampScore(
      affordabilityScore - barrierIndex * 0.2,
    );
    const score = clampScore(
      affordabilityScore * 0.55 + costEffectivenessRatio * 0.45,
    );
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: tiers.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "affordability_score",
          value: affordabilityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "cost_effectiveness_ratio",
          value: costEffectivenessRatio,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "barrier_index",
          value: barrierIndex,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: tiers.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      barrierIndex >= 50
        ? [
            {
              level: "warn",
              message:
                "Cost barrier index exceeds preferred affordability threshold.",
              code: "HIGH_COST_BARRIER",
            },
          ]
        : [],
      [
        "Publish transparent tier pricing.",
        "Track cost per successful outcome by segment.",
        "Offer subsidized tiers for high-friction segments.",
      ],
      `Reviewed ${tiers.length} pricing tier(s).`,
      "pricingTiers|responseText",
    );
  }
  /**
   * Run usage limit analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runUsageLimitAnalyzer(definition, issueId, input = {}) {
    const events = Array.isArray(input.limitHitEvents)
      ? input.limitHitEvents
      : [];
    const text = collectSocietalImpactText(input);
    if (!events.length && !/\b(rate limit|quota|429|throttl)\b/i.test(text)) {
      return buildInsufficientResult(
        definition,
        issueId,
        "limitHitEvents|responseText",
        "Limit-hit events or quota disruption narrative is required.",
        [
          {
            name: "limit_impact_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "limit_hit_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "workflow_disruption_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Track rate-limit and quota hit frequency.",
          "Measure workflow interruption severity.",
          "Tune quotas for high-value batch workflows.",
        ],
      );
    }
    const disruptionWeight = events.reduce(
      (sum, row) => {
        const impact = String(row.impact || "").toLowerCase();
        return (
          sum + (impact === "interrupted" ? 35 : impact === "delayed" ? 20 : 12)
        );
      },
      /\b429\b/i.test(text) ? 20 : 0,
    );
    const limitHitRate = clampScore(
      events.length
        ? Math.min(100, events.length * 25)
        : /\b429\b/i.test(text)
          ? 40
          : 15,
    );
    const workflowDisruptionIndex = clampScore(Math.min(100, disruptionWeight));
    const limitImpactScore = clampScore(
      100 - (limitHitRate * 0.45 + workflowDisruptionIndex * 0.55),
    );
    const score = limitImpactScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: events.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "limit_impact_score",
          value: limitImpactScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "limit_hit_rate",
          value: limitHitRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "workflow_disruption_index",
          value: workflowDisruptionIndex,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: events.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      workflowDisruptionIndex >= 40
        ? [
            {
              level: "warn",
              message: "Quota or rate limits are disrupting workflows.",
              code: "LIMIT_DISRUPTION",
            },
          ]
        : [],
      [
        "Track rate-limit and quota hit frequency.",
        "Measure workflow interruption severity.",
        "Tune quotas for high-value batch workflows.",
      ],
      `Reviewed ${events.length} limit-hit event(s).`,
      "limitHitEvents|responseText",
    );
  }
  /**
   * Run platform lock in analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runPlatformLockInAnalyzer(definition, issueId, input = {}) {
    const shares = collectMarketShares(input);
    const text = collectSocietalImpactText(input);
    if (!shares.length && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "marketShares|responseText",
        "Provider share or portability narrative is required.",
        [
          {
            name: "portability_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "migration_complexity",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "dependency_ratio",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Document API portability mappings.",
          "Reduce provider-specific dependencies.",
          "Track migration complexity quarterly.",
        ],
      );
    }
    const hhi = shares.length ? computeHhi(shares) : 2200;
    const lockInHits = MARKET_LOCKIN_MARKERS.filter((pattern) =>
      pattern.test(text),
    ).length;
    const topShare = shares.length
      ? Math.max(...shares.map((row) => row.share))
      : 0;
    const dependencyRatio = clampScore(topShare + lockInHits * 15);
    const migrationComplexity = clampScore(
      (hhi / 100) * 0.35 + lockInHits * 20,
    );
    const portabilityScore = clampScore(
      100 - (dependencyRatio * 0.55 + migrationComplexity * 0.45),
    );
    const score = portabilityScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: shares.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "portability_score",
          value: portabilityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "migration_complexity",
          value: migrationComplexity,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "dependency_ratio",
          value: dependencyRatio,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: shares.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      dependencyRatio >= 50
        ? [
            {
              level: "warn",
              message:
                "Provider dependency ratio indicates platform lock-in risk.",
              code: "PLATFORM_LOCKIN",
            },
          ]
        : [],
      [
        "Document API portability mappings.",
        "Reduce provider-specific dependencies.",
        "Track migration complexity quarterly.",
      ],
      `Analyzed ${shares.length} provider share(s) and ${lockInHits} lock-in marker(s).`,
      "marketShares|responseText",
    );
  }
  /**
   * Run language limitation analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runLanguageLimitationAnalyzer(definition, issueId, input = {}) {
    const evaluations = Array.isArray(input.localeEvaluations)
      ? input.localeEvaluations
      : [];
    if (evaluations.length < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "localeEvaluations",
        "At least two locale evaluation rows are required.",
        [
          {
            name: "language_parity_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "coverage_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "localization_failure_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Run multilingual benchmark sets per locale.",
          "Track parity gaps across locales.",
          "Escalate localization failures before release.",
        ],
      );
    }
    const qualityScores = evaluations.map((row) => {
      var _a;
      return clampScore(
        Number(
          (_a = row.qualityScore) !== null && _a !== void 0
            ? _a
            : row.passed
              ? 80
              : 40,
        ),
      );
    });
    const maxScore = Math.max(...qualityScores);
    const minScore = Math.min(...qualityScores);
    const languageParityScore =
      maxScore > 0 ? clampScore((minScore / maxScore) * 100) : 0;
    const coverageScore = clampScore(
      (evaluations.filter((row) => row.passed !== false).length /
        evaluations.length) *
        100,
    );
    const localizationFailureRate = clampScore(100 - coverageScore);
    const score = clampScore(languageParityScore * 0.5 + coverageScore * 0.5);
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: evaluations.length,
      minEvidence: 2,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "language_parity_score",
          value: languageParityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "coverage_score",
          value: coverageScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "localization_failure_rate",
          value: localizationFailureRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: evaluations.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      languageParityScore < 75
        ? [
            {
              level: "warn",
              message: "Locale quality parity gap exceeds target.",
              code: "LOCALE_PARITY_GAP",
            },
          ]
        : [],
      [
        "Run multilingual benchmark sets per locale.",
        "Track parity gaps across locales.",
        "Escalate localization failures before release.",
      ],
      `Compared ${evaluations.length} locale evaluation(s).`,
      "localeEvaluations",
    );
  }
  /**
   * Run domain knowledge analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runDomainKnowledgeAnalyzer(definition, issueId, input = {}) {
    const tasks = Array.isArray(input.domainTasks) ? input.domainTasks : [];
    if (!tasks.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "domainTasks",
        "At least one domain benchmark task is required.",
        [
          {
            name: "domain_accuracy",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "terminology_precision",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "expert_agreement_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Maintain domain Q&A benchmarks with expert labels.",
          "Validate terminology usage in outputs.",
          "Track expert agreement on domain answers.",
        ],
      );
    }
    const accurateCount = tasks.filter((row) => {
      const expected = String(
        row.expected || row.expectedAnswer || "",
      ).toLowerCase();
      const actual = String(row.actual || row.actualAnswer || "").toLowerCase();
      return (
        expected && actual && (expected === actual || row.correct === true)
      );
    }).length;
    const terminologyCorrect = tasks.filter(
      (row) => row.terminologyCorrect !== false,
    ).length;
    const domainAccuracy = clampScore((accurateCount / tasks.length) * 100);
    const terminologyPrecision = clampScore(
      (terminologyCorrect / tasks.length) * 100,
    );
    const expertAgreementScore = clampScore(
      domainAccuracy * 0.6 + terminologyPrecision * 0.4,
    );
    const score = expertAgreementScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: tasks.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "domain_accuracy",
          value: domainAccuracy,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "terminology_precision",
          value: terminologyPrecision,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "expert_agreement_score",
          value: expertAgreementScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: tasks.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      domainAccuracy < 70
        ? [
            {
              level: "warn",
              message: "Domain benchmark accuracy is below target.",
              code: "LOW_DOMAIN_ACCURACY",
            },
          ]
        : [],
      [
        "Maintain domain Q&A benchmarks with expert labels.",
        "Validate terminology usage in outputs.",
        "Track expert agreement on domain answers.",
      ],
      `Evaluated ${tasks.length} domain task(s).`,
      "domainTasks",
    );
  }
  /**
   * Run output consistency analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runOutputConsistencyAnalyzer(definition, issueId, input = {}) {
    const outputs = Array.isArray(input.structuredOutputs)
      ? input.structuredOutputs
      : [];
    if (!outputs.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "structuredOutputs",
        "At least one structured output sample is required.",
        [
          {
            name: "format_consistency_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "schema_compliance_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "parser_success_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Validate outputs against expected schema.",
          "Track parser success across runs.",
          "Flag format drift in release gates.",
        ],
      );
    }
    const validCount = outputs.filter(
      (row) => row.schemaValid === true || row.valid === true,
    ).length;
    const schemaComplianceRate = clampScore(
      (validCount / outputs.length) * 100,
    );
    const score = schemaComplianceRate;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: outputs.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "format_consistency_score",
          value: schemaComplianceRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "schema_compliance_rate",
          value: schemaComplianceRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "parser_success_rate",
          value: schemaComplianceRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: outputs.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      schemaComplianceRate < 90
        ? [
            {
              level: "warn",
              message: "Structured output schema compliance is below target.",
              code: "SCHEMA_DRIFT",
            },
          ]
        : [],
      [
        "Validate outputs against expected schema.",
        "Track parser success across runs.",
        "Flag format drift in release gates.",
      ],
      `Validated ${outputs.length} structured output sample(s).`,
      "structuredOutputs",
    );
  }
  /**
   * Run session management analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runSessionManagementAnalyzer(definition, issueId, input = {}) {
    const transitions = Array.isArray(input.sessionTransitions)
      ? input.sessionTransitions
      : [];
    if (transitions.length < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "sessionTransitions",
        "At least two session transition records are required.",
        [
          {
            name: "session_continuity_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "state_integrity_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "recovery_success_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Log session state transitions with integrity checks.",
          "Measure recovery after interruptions.",
          "Add handoff validation between session steps.",
        ],
      );
    }
    const intactCount = transitions.filter(
      (row) => row.stateIntact !== false,
    ).length;
    const recoveredCount = transitions.filter(
      (row) => row.recovered === true,
    ).length;
    const stateIntegrityRate = clampScore(
      (intactCount / transitions.length) * 100,
    );
    const recoverySuccessRate = clampScore(
      (recoveredCount / transitions.length) * 100,
    );
    const sessionContinuityScore = clampScore(
      stateIntegrityRate * 0.6 + recoverySuccessRate * 0.4,
    );
    const score = sessionContinuityScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: transitions.length,
      minEvidence: 2,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "session_continuity_score",
          value: sessionContinuityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "state_integrity_rate",
          value: stateIntegrityRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "recovery_success_rate",
          value: recoverySuccessRate,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: transitions.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      stateIntegrityRate < 80
        ? [
            {
              level: "warn",
              message: "Session state integrity falls below target.",
              code: "SESSION_INTEGRITY_GAP",
            },
          ]
        : [],
      [
        "Log session state transitions with integrity checks.",
        "Measure recovery after interruptions.",
        "Add handoff validation between session steps.",
      ],
      `Reviewed ${transitions.length} session transition(s).`,
      "sessionTransitions",
    );
  }
  /**
   * Run privacy concern analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runPrivacyConcernAnalyzer(definition, issueId, input = {}) {
    const text = collectSocietalImpactText(input);
    const policyHits = text.trim()
      ? PRIVACY_CONCERN_MARKERS.filter((pattern) => pattern.test(text)).length
      : 0;
    if (isScanReportContext(input) && policyHits < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|privacyPolicy",
        "No privacy policy clarity signals in scan report context.",
        [
          {
            name: "policy_clarity_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "policy_behavior_alignment",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "trust_impact_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Publish clear privacy policy coverage.",
          "Align runtime behavior with policy statements.",
          "Track trust impact from privacy incidents.",
        ],
      );
    }
    if (!text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|privacyPolicy",
        "Privacy policy or usage narrative is required.",
        [
          {
            name: "policy_clarity_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "policy_behavior_alignment",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "trust_impact_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Publish clear privacy policy coverage.",
          "Align runtime behavior with policy statements.",
          "Track trust impact from privacy incidents.",
        ],
      );
    }
    const policyClarityScore = clampScore(Math.min(100, 35 + policyHits * 12));
    const policyBehaviorAlignment = clampScore(
      policyClarityScore - (/\bunauthorized\b/i.test(text) ? 25 : 0),
    );
    const trustImpactScore = clampScore(
      policyClarityScore * 0.5 + policyBehaviorAlignment * 0.5,
    );
    const score = trustImpactScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: text.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "policy_clarity_score",
          value: policyClarityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "policy_behavior_alignment",
          value: policyBehaviorAlignment,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "trust_impact_score",
          value: trustImpactScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      policyClarityScore < 60
        ? [
            {
              level: "warn",
              message: "Privacy policy clarity signals are incomplete.",
              code: "LOW_POLICY_CLARITY",
            },
          ]
        : [],
      [
        "Publish clear privacy policy coverage.",
        "Align runtime behavior with policy statements.",
        "Track trust impact from privacy incidents.",
      ],
      `Scanned ${text.length} privacy narrative character(s).`,
      "responseText|privacyPolicy",
    );
  }
  /**
   * Run content filtering analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runContentFilteringAnalyzer(definition, issueId, input = {}) {
    const decisions = Array.isArray(input.moderationDecisions)
      ? input.moderationDecisions
      : [];
    if (decisions.length < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "moderationDecisions",
        "At least two moderation decision records are required.",
        [
          {
            name: "moderation_consistency_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "leakage_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "wrongful_block_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Track moderation decisions by policy category.",
          "Measure harmful-content leakage.",
          "Review wrongful blocks via appeals.",
        ],
      );
    }
    let leakage = 0;
    let wrongfulBlocks = 0;
    let consistent = 0;
    for (const row of decisions) {
      const blocked = row.blocked === true;
      const harmful = row.harmful === true;
      if (harmful && !blocked) leakage += 1;
      if (blocked && !harmful) wrongfulBlocks += 1;
      if ((harmful && blocked) || (!harmful && !blocked)) consistent += 1;
    }
    const moderationConsistencyScore = clampScore(
      (consistent / decisions.length) * 100,
    );
    const leakageRate = clampScore((leakage / decisions.length) * 100);
    const wrongfulBlockRate = clampScore(
      (wrongfulBlocks / decisions.length) * 100,
    );
    const score = clampScore(
      moderationConsistencyScore * 0.5 +
        (100 - leakageRate) * 0.3 +
        (100 - wrongfulBlockRate) * 0.2,
    );
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: decisions.length,
      minEvidence: 2,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "moderation_consistency_score",
          value: moderationConsistencyScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "leakage_rate",
          value: leakageRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "wrongful_block_rate",
          value: wrongfulBlockRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: decisions.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      [
        ...(leakageRate > 0
          ? [
              {
                level: "warn",
                message: `${leakage} harmful-content leakage case(s) detected.`,
                code: "MODERATION_LEAKAGE",
              },
            ]
          : []),
        ...(wrongfulBlockRate > 0
          ? [
              {
                level: "info",
                message: `${wrongfulBlocks} potential wrongful block(s) detected.`,
                code: "WRONGFUL_BLOCK",
              },
            ]
          : []),
      ],
      [
        "Track moderation decisions by policy category.",
        "Measure harmful-content leakage.",
        "Review wrongful blocks via appeals.",
      ],
      `Reviewed ${decisions.length} moderation decision(s).`,
      "moderationDecisions",
    );
  }
  /**
   * Run transparency analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runTransparencyAnalyzer(definition, issueId, input = {}) {
    const text = collectSocietalImpactText(input);
    const markerHits = text.trim()
      ? TRANSPARENCY_MARKERS.filter((pattern) => pattern.test(text)).length
      : 0;
    if (isScanReportContext(input) && markerHits < 2) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|rationale",
        "No transparency rationale or limitation disclosures in scan report context.",
        [
          {
            name: "transparency_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "rationale_coverage",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "disclosure_completeness",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Include decision rationale in outputs.",
          "Disclose known system limitations.",
          "Publish transparency docs for high-risk flows.",
        ],
      );
    }
    if (!text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|rationale",
        "Transparency narrative or rationale payload is required.",
        [
          {
            name: "transparency_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "rationale_coverage",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "disclosure_completeness",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Include decision rationale in outputs.",
          "Disclose known system limitations.",
          "Publish transparency docs for high-risk flows.",
        ],
      );
    }
    const rationaleCoverage = clampScore(Math.min(100, markerHits * 25));
    const disclosureCompleteness = /\blimitation\b/i.test(text)
      ? clampScore(rationaleCoverage + 10)
      : rationaleCoverage;
    const transparencyScore = clampScore(
      rationaleCoverage * 0.55 + disclosureCompleteness * 0.45,
    );
    const score = transparencyScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: text.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "transparency_score",
          value: transparencyScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "rationale_coverage",
          value: rationaleCoverage,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "disclosure_completeness",
          value: disclosureCompleteness,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      transparencyScore < 60
        ? [
            {
              level: "info",
              message:
                "Transparency disclosures are partial; expand rationale coverage.",
              code: "LOW_TRANSPARENCY",
            },
          ]
        : [],
      [
        "Include decision rationale in outputs.",
        "Disclose known system limitations.",
        "Publish transparency docs for high-risk flows.",
      ],
      `Scanned ${text.length} transparency narrative character(s).`,
      "responseText|rationale",
    );
  }
  /**
   * Run dependence risk analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runDependenceRiskAnalyzer(definition, issueId, input = {}) {
    const text = collectSocietalImpactText(input);
    const positiveHits = text.trim()
      ? DEPENDENCE_POSITIVE_MARKERS.filter((pattern) => pattern.test(text))
          .length
      : 0;
    const negativeHits = text.trim()
      ? DEPENDENCE_NEGATIVE_MARKERS.filter((pattern) => pattern.test(text))
          .length
      : 0;
    if (isScanReportContext(input) && positiveHits + negativeHits === 0) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|usageTraces",
        "No dependence or fallback governance signals in scan report context.",
        [
          {
            name: "dependence_risk_score",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "fallback_readiness",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "resilience_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Measure AI dependency ratio in critical workflows.",
          "Maintain manual fallback paths.",
          "Run resilience drills without AI availability.",
        ],
      );
    }
    if (!text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "responseText|usageTraces",
        "Usage or governance narrative is required for dependence analysis.",
        [
          {
            name: "dependence_risk_score",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "fallback_readiness",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "resilience_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
        ],
        [
          "Measure AI dependency ratio in critical workflows.",
          "Maintain manual fallback paths.",
          "Run resilience drills without AI availability.",
        ],
      );
    }
    const dependenceRiskScore = clampScore(
      Math.min(100, 20 + negativeHits * 25 - positiveHits * 12),
    );
    const fallbackReadiness = clampScore(
      40 + positiveHits * 18 - negativeHits * 10,
    );
    const resilienceScore = clampScore(
      fallbackReadiness * 0.6 + (100 - dependenceRiskScore) * 0.4,
    );
    const score = dependenceRiskScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: text.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildLowerBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "dependence_risk_score",
          value: dependenceRiskScore,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "fallback_readiness",
          value: fallbackReadiness,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "resilience_score",
          value: resilienceScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "data_analyzed",
          value: text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      dependenceRiskScore >= 45
        ? [
            {
              level: "warn",
              message:
                "Overreliance markers exceed preferred dependence threshold.",
              code: "HIGH_DEPENDENCE",
            },
          ]
        : [],
      [
        "Measure AI dependency ratio in critical workflows.",
        "Maintain manual fallback paths.",
        "Run resilience drills without AI availability.",
      ],
      `Scanned ${text.length} dependence narrative character(s).`,
      "responseText|usageTraces",
    );
  }
  /**
   * Run api complexity analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runApiComplexityAnalyzer(definition, issueId, input = {}) {
    const codeText = String(input.codeText || "").trim();
    const text = collectSocietalImpactText(input);
    if (isScanReportContext(input) && !codeText) {
      return buildInsufficientResult(
        definition,
        issueId,
        "codeText|responseText",
        "No API integration code surface in scan report context.",
        [
          {
            name: "integration_ease_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "docs_quality_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "failure_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Reduce API surface complexity.",
          "Publish complete SDK and OpenAPI docs.",
          "Track integration failure rates.",
        ],
      );
    }
    if (!codeText && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "codeText|responseText",
        "API surface code or integration narrative is required.",
        [
          {
            name: "integration_ease_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "docs_quality_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "failure_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Reduce API surface complexity.",
          "Publish complete SDK and OpenAPI docs.",
          "Track integration failure rates.",
        ],
      );
    }
    const endpointHits = (
      codeText.match(/\/api\/|fetch\(|axios\.|request\(/gi) || []
    ).length;
    const importHits = (codeText.match(/\bimport\b/g) || []).length;
    const docsHits =
      (/\b(openapi|sdk|readme|docs)\b/i.test(text) ? 2 : 0) +
      (/\b(openapi|sdk|readme|docs)\b/i.test(codeText) ? 1 : 0);
    const complexityPenalty = clampScore(
      Math.min(70, endpointHits * 8 + importHits * 4),
    );
    const docsQualityScore = clampScore(35 + docsHits * 20);
    const integrationEaseScore = clampScore(
      100 - complexityPenalty + docsQualityScore * 0.25,
    );
    const failureRate = clampScore(
      Math.max(0, complexityPenalty - docsHits * 5),
    );
    const score = clampScore(
      integrationEaseScore * 0.55 + docsQualityScore * 0.45,
    );
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: codeText.length || text.length,
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "integration_ease_score",
          value: integrationEaseScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "docs_quality_score",
          value: docsQualityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "failure_rate",
          value: failureRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: codeText.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      complexityPenalty >= 40
        ? [
            {
              level: "info",
              message:
                "API surface complexity is elevated; simplify integration paths.",
              code: "HIGH_API_COMPLEXITY",
            },
          ]
        : [],
      [
        "Reduce API surface complexity.",
        "Publish complete SDK and OpenAPI docs.",
        "Track integration failure rates.",
      ],
      `Reviewed ${codeText.length || text.length} integration signal character(s).`,
      "codeText|responseText",
    );
  }
  /**
   * Run compatibility analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runCompatibilityAnalyzer(definition, issueId, input = {}) {
    const matrix = Array.isArray(input.compatibilityMatrix)
      ? input.compatibilityMatrix
      : [];
    const text = collectSocietalImpactText(input);
    if (isScanReportContext(input) && !matrix.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "compatibilityMatrix|responseText",
        "No compatibility matrix in scan report context.",
        [
          {
            name: "compatibility_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "matrix_coverage",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "upgrade_friction_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Maintain supported platform matrix.",
          "Track compatibility failures by version.",
          "Publish upgrade migration guides.",
        ],
      );
    }
    if (!matrix.length && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "compatibilityMatrix|responseText",
        "Compatibility matrix or platform support narrative is required.",
        [
          {
            name: "compatibility_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "matrix_coverage",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "upgrade_friction_index",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Maintain supported platform matrix.",
          "Track compatibility failures by version.",
          "Publish upgrade migration guides.",
        ],
      );
    }
    const supportedCount = matrix.filter(
      (row) => row.supported !== false,
    ).length;
    const matrixCoverage = matrix.length
      ? clampScore((supportedCount / matrix.length) * 100)
      : /\bsupported on\b/i.test(text)
        ? 75
        : 0;
    const upgradeFrictionIndex = clampScore(
      matrix.length ? Math.max(0, 100 - matrixCoverage) * 0.4 : 25,
    );
    const compatibilityScore = clampScore(
      matrixCoverage * 0.75 + (100 - upgradeFrictionIndex) * 0.25,
    );
    const score = compatibilityScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: matrix.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "compatibility_score",
          value: compatibilityScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "matrix_coverage",
          value: matrixCoverage,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "upgrade_friction_index",
          value: upgradeFrictionIndex,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: matrix.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      matrixCoverage < 80
        ? [
            {
              level: "warn",
              message: "Compatibility matrix coverage is below target.",
              code: "LOW_COMPATIBILITY_COVERAGE",
            },
          ]
        : [],
      [
        "Maintain supported platform matrix.",
        "Track compatibility failures by version.",
        "Publish upgrade migration guides.",
      ],
      `Reviewed ${matrix.length} compatibility row(s).`,
      "compatibilityMatrix|responseText",
    );
  }
  /**
   * Run maintenance overhead analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runMaintenanceOverheadAnalyzer(definition, issueId, input = {}) {
    const events = Array.isArray(input.maintenanceEvents)
      ? input.maintenanceEvents
      : [];
    const text = collectSocietalImpactText(input);
    if (!events.length && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "maintenanceEvents|responseText",
        "Maintenance events or release narrative is required.",
        [
          {
            name: "maintenance_burden_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "change_churn_rate",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
          {
            name: "breakage_frequency",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Track dependency and API churn.",
          "Measure maintenance hours per release.",
          "Reduce breaking schema changes.",
        ],
      );
    }
    const breakingCount = events.filter((row) => row.breaking === true).length;
    const changeChurnRate = clampScore(events.length ? events.length * 15 : 20);
    const breakageFrequency = clampScore(
      events.length ? (breakingCount / events.length) * 100 : 0,
    );
    const maintenanceBurdenScore = clampScore(
      100 - (changeChurnRate * 0.35 + breakageFrequency * 0.65),
    );
    const score = maintenanceBurdenScore;
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: events.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "maintenance_burden_score",
          value: maintenanceBurdenScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "change_churn_rate",
          value: changeChurnRate,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "breakage_frequency",
          value: breakageFrequency,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: events.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      breakingCount > 0
        ? [
            {
              level: "warn",
              message: `${breakingCount} breaking maintenance event(s) detected.`,
              code: "BREAKING_CHANGE",
            },
          ]
        : [],
      [
        "Track dependency and API churn.",
        "Measure maintenance hours per release.",
        "Reduce breaking schema changes.",
      ],
      `Reviewed ${events.length} maintenance event(s).`,
      "maintenanceEvents|responseText",
    );
  }
  /**
   * Run customization limit analyzer.
   * @param {any} definition
   * @param {string} issueId
   * @param {any} input
   * @returns {any}
   */
  function runCustomizationLimitAnalyzer(definition, issueId, input = {}) {
    const options = Array.isArray(input.customizationOptions)
      ? input.customizationOptions
      : [];
    const text = collectSocietalImpactText(input);
    if (isScanReportContext(input) && !options.length) {
      return buildInsufficientResult(
        definition,
        issueId,
        "customizationOptions|responseText",
        "No customization pathway evidence in scan report context.",
        [
          {
            name: "customization_coverage_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "adaptation_success_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "customization_complexity",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Document customization pathways.",
          "Track adaptation success by use case.",
          "Reduce customization complexity where possible.",
        ],
      );
    }
    if (!options.length && !text.trim()) {
      return buildInsufficientResult(
        definition,
        issueId,
        "customizationOptions|responseText",
        "Customization pathways or capability narrative is required.",
        [
          {
            name: "customization_coverage_score",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "adaptation_success_rate",
            value: 0,
            unit: "percent",
            direction: "higher_better",
          },
          {
            name: "customization_complexity",
            value: 0,
            unit: "percent",
            direction: "lower_better",
          },
        ],
        [
          "Document customization pathways.",
          "Track adaptation success by use case.",
          "Reduce customization complexity where possible.",
        ],
      );
    }
    const successCount = options.filter((row) => row.success !== false).length;
    const customizationCoverageScore = clampScore(
      options.length
        ? (successCount / options.length) * 100
        : /\bcustom\b/i.test(text)
          ? 70
          : 0,
    );
    const customizationComplexity = clampScore(
      Math.max(0, 100 - customizationCoverageScore) * 0.5,
    );
    const score = clampScore(
      customizationCoverageScore * 0.6 + (100 - customizationComplexity) * 0.4,
    );
    const risk = finalizeRiskAssessment(score, definition.scoringDirection, {
      evidenceCount: options.length || (text.trim() ? 1 : 0),
      minEvidence: 1,
      criticalRequiresMinEvidence: true,
    });
    return buildHigherBetterResult(
      definition,
      issueId,
      score,
      risk,
      [
        {
          name: "customization_coverage_score",
          value: customizationCoverageScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "adaptation_success_rate",
          value: customizationCoverageScore,
          unit: "percent",
          direction: "higher_better",
        },
        {
          name: "customization_complexity",
          value: customizationComplexity,
          unit: "percent",
          direction: "lower_better",
        },
        {
          name: "data_analyzed",
          value: options.length || text.length,
          unit: "count",
          direction: "higher_better",
        },
      ],
      customizationCoverageScore < 70
        ? [
            {
              level: "info",
              message: "Customization pathway coverage is limited.",
              code: "LOW_CUSTOMIZATION_COVERAGE",
            },
          ]
        : [],
      [
        "Document customization pathways.",
        "Track adaptation success by use case.",
        "Reduce customization complexity where possible.",
      ],
      `Reviewed ${options.length} customization pathway(s).`,
      "customizationOptions|responseText",
    );
  }
  return {
    runCatastrophicForgettingAnalyzer,
    runPromptEngineeringDifficultyAnalyzer,
    runCostBarrierAnalyzer,
    runUsageLimitAnalyzer,
    runPlatformLockInAnalyzer,
    runLanguageLimitationAnalyzer,
    runDomainKnowledgeAnalyzer,
    runOutputConsistencyAnalyzer,
    runSessionManagementAnalyzer,
    runPrivacyConcernAnalyzer,
    runContentFilteringAnalyzer,
    runTransparencyAnalyzer,
    runDependenceRiskAnalyzer,
    runApiComplexityAnalyzer,
    runCompatibilityAnalyzer,
    runMaintenanceOverheadAnalyzer,
    runCustomizationLimitAnalyzer,
  };
}
