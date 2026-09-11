// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code — judge schema and seed retrieval, not production leaks
/**
 * Detector → evidence → judge.
 * The judge does not invent findings. It reasons from SimpleBeacon decisions.
 * Only human-reviewed decisions are learning material.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const VERDICTS = Object.freeze([
  "CONFIRMED",
  "LIKELY",
  "DISMISSED",
  "UNCERTAIN",
]);
const SEVERITIES = Object.freeze([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
]);
const CANDIDATE_TYPES = Object.freeze({
  PRODUCTION_ENVIRONMENT_BOUNDARY: "production_environment_boundary",
  FIXTURE_LEAK: "fixture_leak",
  PLACEHOLDER: "placeholder",
  HALLUCINATED_DEPENDENCY: "hallucinated_dependency",
  FAKE_DATA: "fake_data",
  FAKE_SUCCESS: "fake_success",
  NOOP_IMPLEMENTATION: "noop_implementation",
});

const DEFAULT_MEMORY_FILE = path.join(__dirname, "reality-decision-memory.json");
const DEFAULT_EVAL_DATASET = path.join(
  __dirname,
  "..",
  "..",
  "tests",
  "fixtures",
  "reality-judge",
  "eval-dataset.json",
);

const SYSTEM_PROMPT = [
  "You are the SimpleBeacon decision engine.",
  "",
  "You have no predefined assumptions about whether a code pattern is acceptable.",
  "Determine whether the current candidate is consistent with the examples and policies provided by SimpleBeacon.",
  "Do not invent policy.",
  "Do not invent findings that are not in the candidate.",
  "If the available evidence is insufficient, return UNCERTAIN.",
  "Your decision must be supported by evidence.",
].join("\n");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function uniqueTokens(parts) {
  const set = new Set();
  for (const part of parts) {
    for (const token of tokenize(part)) set.add(token);
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

function inferBoundary(filePath) {
  const rel = String(filePath || "").replace(/\\/g, "/").toLowerCase();
  if (
    /(^|\/)(tests?|__tests__|spec)(\/|$)/.test(rel) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)
  ) {
    return "test";
  }
  if (/(^|\/)(docs?|documentation)(\/|$)/.test(rel)) return "docs";
  if (/(^|\/)(fixtures?|mocks?|samples?)(\/|$)/.test(rel) && !/(^|\/)src\//.test(rel)) {
    return "fixture";
  }
  return "production";
}

function candidateTokens(candidate, evidence = {}) {
  return uniqueTokens([
    candidate.type,
    candidate.claim,
    candidate.file,
    evidence.code,
    evidence.related_config,
    inferBoundary(candidate.file),
  ]);
}

function decisionTokens(decision) {
  const example = decision.example || {};
  return uniqueTokens([
    example.type,
    example.candidate,
    example.evidence,
    example.context,
    decision.reason,
    decision.invariant,
    ...(decision.evidence || []),
  ]);
}

function isLearningMaterial(decision) {
  return Boolean(decision && decision.source === "human" && decision.reviewed === true);
}

function loadDecisionMemory(options = {}) {
  if (options.memory && Array.isArray(options.memory.decisions)) {
    return options.memory;
  }
  const memoryPath = options.memoryPath || DEFAULT_MEMORY_FILE;
  const raw = fs.readFileSync(memoryPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.decisions)) {
    return { version: 1, decisions: [] };
  }
  return parsed;
}

function retrieveSimilarDecisions(candidate, memory, options = {}) {
  const k = Number.isInteger(options.k) ? options.k : 8;
  const query = candidateTokens(candidate, options.evidence);
  const scored = (memory.decisions || [])
    .filter(isLearningMaterial)
    .map((decision) => {
      const typeBonus = decision.example?.type === candidate.type ? 0.35 : 0;
      return {
        decision,
        score: Math.min(1, jaccard(query, decisionTokens(decision)) + typeBonus),
      };
    });
  return scored
    .filter((row) => row.score >= (options.minScore || 0.18))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function collectRelevantInvariants(candidate, memory, similar) {
  const fromSimilar = similar.map((row) => row.decision).filter((d) => d.invariant);
  const sameType = (memory.decisions || [])
    .filter(isLearningMaterial)
    .filter((d) => d.example?.type === candidate.type && d.invariant);
  const merged = [];
  const seen = new Set();
  for (const decision of [...fromSimilar, ...sameType]) {
    const key = String(decision.invariant).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const similarRow = similar.find((row) => row.decision.id === decision.id);
    merged.push({
      id: decision.id,
      type: decision.example?.type || "",
      invariant: key,
      decision: decision.human_decision,
      severity: decision.severity,
      evidence: decision.evidence || [],
      context: decision.example?.context || "",
      reason: decision.reason,
      score: similarRow ? similarRow.score : 0.35,
    });
  }
  return merged;
}

function invariantApplies(inv, candidate, boundary) {
  if (inv.type && inv.type !== candidate.type) return false;
  const ctx = String(inv.context || "").toLowerCase();
  if (boundary === "test") return /test/.test(ctx);
  if (boundary === "docs") return /doc/.test(ctx);
  if (boundary === "production") {
    return /production|dashboard|payments|application|crypto/.test(ctx);
  }
  return false;
}

function findingToCandidate(issue) {
  const file = issue.file || issue.path || issue.relativePath || "";
  const typeHint = String(issue.type || issue.pattern || issue.rule || "");
  const message = String(issue.message || issue.description || issue.claim || "");
  let type = CANDIDATE_TYPES.FIXTURE_LEAK;
  if (/hallucin/i.test(typeHint) || /not found in package/i.test(message)) {
    type = CANDIDATE_TYPES.HALLUCINATED_DEPENDENCY;
  } else if (/fiction|kpi|fake.?data/i.test(typeHint)) {
    type = CANDIDATE_TYPES.FAKE_DATA;
  } else if (/encrypt|noop|placeholder.?impl/i.test(typeHint + message)) {
    type = CANDIDATE_TYPES.NOOP_IMPLEMENTATION;
  } else if (/placeholder|todo_truncate|lorem/i.test(typeHint + message)) {
    type = CANDIDATE_TYPES.PLACEHOLDER;
  } else if (/success|charge\(|refund\(/i.test(typeHint + message)) {
    type = CANDIDATE_TYPES.FAKE_SUCCESS;
  } else if (/staging|PAYMENTS_URL|environment|mock-payments/i.test(typeHint + message)) {
    type = CANDIDATE_TYPES.PRODUCTION_ENVIRONMENT_BOUNDARY;
  } else if (/production leak|fixture|sample-json|mock-path/i.test(typeHint + message)) {
    type = CANDIDATE_TYPES.FIXTURE_LEAK;
  }
  return {
    type,
    file,
    line_start: issue.line || issue.lineStart || issue.line_start || null,
    line_end: issue.lineEnd || issue.line_end || issue.line || null,
    claim: message || `${type} candidate in ${file}`,
  };
}

function validateJudgeResult(result) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { valid: false, errors: ["Result is not an object"] };
  }
  if (!VERDICTS.includes(result.verdict)) {
    errors.push(`Invalid verdict: ${result.verdict}`);
  }
  const confidence = Number(result.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    errors.push("confidence must be a number between 0 and 1");
  }
  if (result.severity && !SEVERITIES.includes(result.severity)) {
    errors.push(`Invalid severity: ${result.severity}`);
  }
  if (typeof result.reason !== "string" || !result.reason.trim()) {
    errors.push("Missing reason");
  }
  if (result.evidence && !Array.isArray(result.evidence)) {
    errors.push("evidence must be an array");
  }
  return errors.length ? { valid: false, errors } : { valid: true, result };
}

function parseJudgeResponse(text) {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return { valid: false, errors: ["No JSON object"] };
  try {
    return validateJudgeResult(JSON.parse(raw.slice(start, end + 1)));
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

function buildJudgePrompt({ candidate, evidence = {}, knownDecisions = [], invariants = [] }) {
  const examples = knownDecisions
    .map((row, i) => {
      const d = row.decision || row;
      return [
        `Example ${i + 1}`,
        `Pattern: ${d.example?.candidate || ""}`,
        `Type: ${d.example?.type || ""}`,
        `Context: ${d.example?.context || ""}`,
        `Decision: ${d.human_decision}`,
        `Invariant: ${d.invariant || ""}`,
        `Reason: ${d.reason}`,
      ].join("\n");
    })
    .join("\n\n");
  const invariantBlock = invariants.length
    ? invariants
        .map(
          (inv, i) =>
            `${i + 1}. ${inv.invariant}\n   Decision: ${inv.decision}\n   Context: ${inv.context}\n   Evidence: ${(inv.evidence || []).join("; ")}`,
        )
        .join("\n")
    : "(none)";
  return [
    SYSTEM_PROMPT,
    "",
    "KNOWN DECISIONS",
    examples || "(none)",
    "",
    "RELEVANT INVARIANTS",
    invariantBlock,
    "",
    "CURRENT CASE",
    JSON.stringify(
      {
        candidate,
        evidence,
        boundary: inferBoundary(candidate.file),
      },
      null,
      2,
    ),
    "",
    'Reply with JSON only: {"verdict":"CONFIRMED|LIKELY|DISMISSED|UNCERTAIN","confidence":0.0,"severity":"CRITICAL|HIGH|MEDIUM|LOW|INFO","reason":"...","evidence":["..."],"consequence":"...","remediation":"..."}',
  ].join("\n");
}

function similarSummary(similar) {
  return similar.map((row) => ({
    id: row.decision.id,
    decision: row.decision.human_decision,
    score: Number(row.score.toFixed(3)),
    invariant: row.decision.invariant || "",
  }));
}

function applyRetrievedPolicy(similar, candidate, _evidence, invariants) {
  if (!similar.length && !invariants.length) {
    return emptyUncertain("No matching SimpleBeacon decisions.");
  }
  const boundary = inferBoundary(candidate.file);
  const applicable = invariants
    .filter((inv) => invariantApplies(inv, candidate, boundary))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (applicable.length) {
    const decisions = new Set(applicable.map((inv) => inv.decision));
    if (decisions.size > 1) {
      return {
        verdict: "UNCERTAIN",
        confidence: 0.4,
        severity: "MEDIUM",
        reason: "Retrieved invariants disagree. Human review required.",
        evidence: applicable.map((inv) => inv.invariant).slice(0, 3),
        consequence: "",
        remediation: "Record a human decision for this boundary.",
        invariant: "",
        similar: similarSummary(similar),
        invariants: applicable,
        source: "model",
        reviewed: false,
      };
    }
    const top = applicable[0];
    return {
      verdict: top.decision,
      confidence: Number(Math.min(0.99, 0.7 + (top.score || 0) * 0.25).toFixed(2)),
      severity: top.severity || (top.decision === "CONFIRMED" ? "HIGH" : "INFO"),
      reason: top.reason,
      evidence: top.evidence || [],
      consequence:
        top.decision === "CONFIRMED"
          ? "This change can violate an established production invariant."
          : "Similar accepted cases were test-only or otherwise in-bounds.",
      remediation: top.invariant,
      invariant: top.invariant,
      similar: similarSummary(similar),
      invariants: applicable,
      source: "model",
      reviewed: false,
    };
  }

  return emptyUncertain("No stored invariant applies to this boundary.", similar, invariants);
}

function emptyUncertain(reason, similar = [], invariants = []) {
  return {
    verdict: "UNCERTAIN",
    confidence: 0,
    severity: "INFO",
    reason,
    evidence: [],
    consequence: "",
    remediation: "Collect a human decision before treating this as a violation.",
    invariant: "",
    similar: similarSummary(similar),
    invariants,
    source: "model",
    reviewed: false,
  };
}

function judgeCandidate(candidate, evidence = {}, options = {}) {
  if (!candidate || typeof candidate !== "object") {
    return emptyUncertain("Candidate is missing.");
  }
  const memory = loadDecisionMemory(options);
  const similar = retrieveSimilarDecisions(candidate, memory, { evidence, k: options.k });
  const invariants = collectRelevantInvariants(candidate, memory, similar);
  const retrieved = applyRetrievedPolicy(similar, candidate, evidence, invariants);

  if (typeof options.askModel !== "function") {
    return { ...retrieved, candidate, prompt: null };
  }

  const prompt = buildJudgePrompt({
    candidate,
    evidence,
    knownDecisions: similar,
    invariants,
  });
  let modelRaw;
  try {
    modelRaw = options.askModel(prompt, { candidate, evidence, similar, invariants });
  } catch {
    return { ...retrieved, candidate, prompt, modelError: "askModel threw" };
  }
  const parsed = parseJudgeResponse(modelRaw);
  if (!parsed.valid) {
    return { ...retrieved, candidate, prompt, modelError: parsed.errors.join("; ") };
  }
  return {
    ...parsed.result,
    similar: retrieved.similar,
    invariants,
    invariant: retrieved.invariant,
    source: "model",
    reviewed: false,
    candidate,
    prompt,
  };
}

function judgeFindings(findings, options = {}) {
  const list = Array.isArray(findings) ? findings : [];
  return list.map((issue) => {
    const candidate = findingToCandidate(issue);
    const evidence = {
      code: issue.snippet || issue.lineText || issue.match || "",
      related_config: issue.relatedConfig || "",
      tests: issue.tests || [],
    };
    return judgeCandidate(candidate, evidence, options);
  });
}

function attachRealityJudgments(report, options = {}) {
  const issues = report?.issues || report?.rawIssues || [];
  const judgments = judgeFindings(issues, options);
  const summary = {
    judged: judgments.length,
    confirmed: judgments.filter((j) => j.verdict === "CONFIRMED").length,
    likely: judgments.filter((j) => j.verdict === "LIKELY").length,
    dismissed: judgments.filter((j) => j.verdict === "DISMISSED").length,
    uncertain: judgments.filter((j) => j.verdict === "UNCERTAIN").length,
  };
  report.realityJudge = { ...summary, judgments };
  return report;
}

function recordDecision(entry, options = {}) {
  const source = entry.source === "model" ? "model" : "human";
  const reviewed = entry.reviewed != null ? Boolean(entry.reviewed) : source === "human";
  const next = {
    id: entry.id || `${source}-${Date.now()}`,
    example: entry.example,
    human_decision: entry.human_decision,
    severity: entry.severity || "MEDIUM",
    reason: entry.reason,
    invariant: entry.invariant || "",
    evidence: entry.evidence || [],
    source,
    reviewed,
  };
  const memory = loadDecisionMemory(options);
  memory.decisions = [...(memory.decisions || []), next];
  if (options.persistPath && isLearningMaterial(next)) {
    const learning = {
      ...memory,
      decisions: memory.decisions.filter(isLearningMaterial),
    };
    fs.writeFileSync(options.persistPath, `${JSON.stringify(learning, null, 2)}\n`, "utf8");
  }
  return memory;
}

function recordHumanReview(judgment, humanVerdict, options = {}) {
  const candidate = judgment.candidate || options.candidate || {};
  return recordDecision(
    {
      id: options.id,
      example: {
        candidate: candidate.claim || "",
        type: candidate.type || "",
        evidence: options.evidence?.code || "",
        context: options.context || inferBoundary(candidate.file),
      },
      human_decision: humanVerdict,
      severity: options.severity || judgment.severity,
      reason: options.reason || "",
      invariant: options.invariant || judgment.invariant || "",
      evidence: options.evidenceList || judgment.evidence || [],
      source: "human",
      reviewed: true,
    },
    options,
  );
}

function countVerdicts(judgments) {
  const counts = { CONFIRMED: 0, LIKELY: 0, UNCERTAIN: 0, DISMISSED: 0 };
  for (const judgment of judgments) {
    if (counts[judgment.verdict] != null) counts[judgment.verdict] += 1;
  }
  return counts;
}

function isActionable(judgment) {
  return judgment.verdict === "CONFIRMED" || judgment.verdict === "LIKELY";
}

function pct(part, whole) {
  if (!whole) return "n/a";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function evaluateJudgeExperiment({ truePositives = [], falsePositives = [] }, options = {}) {
  const tp = truePositives.map((c) => judgeCandidate(c.candidate, c.evidence, options));
  const fp = falsePositives.map((c) => judgeCandidate(c.candidate, c.evidence, options));
  const confirmedOk = (j) => j.verdict === "CONFIRMED" || j.verdict === "LIKELY";
  const dismissedOk = (j) => j.verdict === "DISMISSED";
  const tpCounts = countVerdicts(tp);
  const fpCounts = countVerdicts(fp);
  const actionable = [...tp, ...fp].filter(isActionable);
  const actionableTrue = tp.filter(isActionable);
  const incorrectlyRaised = fp.filter(isActionable).length;
  const correctStrict = tpCounts.CONFIRMED + fpCounts.DISMISSED;
  const total = tp.length + fp.length;
  const metrics = {
    truePositivesCorrectlyConfirmed: tp.filter(confirmedOk).length,
    truePositivesIncorrectlyDismissed: tp.filter(dismissedOk).length,
    falsePositivesCorrectlyDismissed: fp.filter(dismissedOk).length,
    falsePositivesIncorrectlyEscalated: incorrectlyRaised,
    truePositiveVerdicts: tpCounts,
    falsePositiveVerdicts: fpCounts,
    dataset: {
      truePositives: tp.length,
      falsePositives: fp.length,
      total,
    },
    correctStrict,
    accuracy: total ? correctStrict / total : 0,
    actionableFindingPrecision: actionable.length
      ? actionableTrue.length / actionable.length
      : null,
    actionableCount: actionable.length,
    truePositives: tp,
    falsePositives: fp,
  };
  metrics.report = formatJudgeEvaluationReport(metrics);
  return metrics;
}

function formatJudgeEvaluationReport(metrics) {
  const tpN = metrics.dataset.truePositives;
  const fpN = metrics.dataset.falsePositives;
  const total = metrics.dataset.total;
  const tp = metrics.truePositiveVerdicts;
  const fp = metrics.falsePositiveVerdicts;
  const precision =
    metrics.actionableFindingPrecision == null
      ? "n/a"
      : `${(metrics.actionableFindingPrecision * 100).toFixed(1)}%`;
  return [
    "SimpleBeacon Reality Judge Evaluation",
    "======================================",
    "",
    "Dataset",
    `  True positives:   ${tpN}`,
    `  False positives:  ${fpN}`,
    `  Total:            ${total}`,
    "",
    "TRUE POSITIVES",
    `  Confirmed:        ${tp.CONFIRMED}/${tpN}  (${pct(tp.CONFIRMED, tpN)})`,
    `  Likely:           ${String(tp.LIKELY).padStart(3)}/${tpN}`,
    `  Uncertain:        ${String(tp.UNCERTAIN).padStart(3)}/${tpN}`,
    `  Dismissed:        ${String(tp.DISMISSED).padStart(3)}/${tpN}`,
    "",
    "FALSE POSITIVES",
    `  Dismissed:        ${fp.DISMISSED}/${fpN}  (${pct(fp.DISMISSED, fpN)})`,
    `  Uncertain:        ${String(fp.UNCERTAIN).padStart(3)}/${fpN}`,
    `  Incorrectly raised: ${fp.CONFIRMED + fp.LIKELY}/${fpN}`,
    "",
    "Overall",
    `  Correct:           ${metrics.correctStrict}/${total}`,
    `  Accuracy:          ${pct(metrics.correctStrict, total)}`,
    "",
    "Actionable finding precision",
    `  Investigated (CONFIRMED + LIKELY): ${metrics.actionableCount}`,
    `  Worth investigating:               ${metrics.truePositives.filter(isActionable).length}`,
    `  Precision:                         ${precision}`,
    "",
    "Learning boundary",
    "  Only source=human and reviewed=true decisions are permanent learning material.",
  ].join("\n");
}

function loadEvalDataset(datasetPath = DEFAULT_EVAL_DATASET) {
  return JSON.parse(fs.readFileSync(datasetPath, "utf8"));
}

function runLabeledEvaluation(options = {}) {
  const dataset = options.dataset || loadEvalDataset(options.datasetPath);
  return evaluateJudgeExperiment(
    {
      truePositives: dataset.truePositives || [],
      falsePositives: dataset.falsePositives || [],
    },
    options,
  );
}

module.exports = {
  VERDICTS,
  SEVERITIES,
  CANDIDATE_TYPES,
  SYSTEM_PROMPT,
  DEFAULT_EVAL_DATASET,
  inferBoundary,
  findingToCandidate,
  isLearningMaterial,
  loadDecisionMemory,
  retrieveSimilarDecisions,
  collectRelevantInvariants,
  buildJudgePrompt,
  parseJudgeResponse,
  validateJudgeResult,
  judgeCandidate,
  judgeFindings,
  attachRealityJudgments,
  recordDecision,
  recordHumanReview,
  evaluateJudgeExperiment,
  formatJudgeEvaluationReport,
  loadEvalDataset,
  runLabeledEvaluation,
};
