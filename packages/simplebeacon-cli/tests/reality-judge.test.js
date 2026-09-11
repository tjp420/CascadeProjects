"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  SYSTEM_PROMPT,
  inferBoundary,
  findingToCandidate,
  isLearningMaterial,
  buildJudgePrompt,
  parseJudgeResponse,
  judgeCandidate,
  recordDecision,
  evaluateJudgeExperiment,
  runLabeledEvaluation,
} = require("../src/lib/reality-judge");

describe("reality-judge", () => {
  it("keeps a blank policy prompt", () => {
    assert.match(SYSTEM_PROMPT, /Do not invent policy/);
    assert.match(SYSTEM_PROMPT, /UNCERTAIN/);
  });

  it("treats test paths as a test boundary and src as production", () => {
    assert.equal(inferBoundary("tests/payments.test.js"), "test");
    assert.equal(inferBoundary("src/payments/config.py"), "production");
  });

  it("maps existing detector issues to candidate types", () => {
    assert.equal(
      findingToCandidate({
        type: "production leak",
        file: "src/dashboard.js",
        message: "fixtures/revenue.json",
      }).type,
      "fixture_leak",
    );
    assert.equal(
      findingToCandidate({
        type: "hallucinated-import",
        file: "src/lib/client.js",
        message: 'import of "stable_payments_client" not found in package.json',
      }).type,
      "hallucinated_dependency",
    );
  });

  it("confirms a production staging-payment fallback from stored decisions", () => {
    const result = judgeCandidate(
      {
        type: "production_environment_boundary",
        file: "src/config/environments.py",
        claim: "Production can fall back to a staging payment endpoint.",
      },
      {
        code: 'PAYMENTS_URL = os.getenv("PAYMENTS_URL", "https://mock-payments-stage.example")',
      },
    );
    assert.equal(result.verdict, "CONFIRMED");
    assert.ok(result.confidence >= 0.7);
    assert.match(result.reason, /staging|production/i);
  });

  it("dismisses the same mock endpoint when the file is a test", () => {
    const result = judgeCandidate(
      {
        type: "production_environment_boundary",
        file: "tests/integration/payments.test.js",
        claim: "mock payment endpoint",
      },
      { code: 'const host = "https://mock-payments-stage.example"' },
    );
    assert.equal(result.verdict, "DISMISSED");
  });

  it("returns UNCERTAIN when no stored decision applies", () => {
    const result = judgeCandidate({
      type: "authorization_check",
      file: "src/users.py",
      claim: "Route returns a user without an ownership check.",
    });
    assert.equal(result.verdict, "UNCERTAIN");
    assert.equal(result.confidence, 0);
  });

  it("rejects a model response that invents a verdict", () => {
    const parsed = parseJudgeResponse('{"verdict":"SHIP_IT","confidence":1,"reason":"looks fine"}');
    assert.equal(parsed.valid, false);
  });

  it("does not let askModel invent policy when JSON is invalid", () => {
    const result = judgeCandidate(
      {
        type: "authorization_check",
        file: "src/users.py",
        claim: "missing authz",
      },
      {},
      { askModel: () => "this is definitely a critical vulnerability" },
    );
    assert.equal(result.verdict, "UNCERTAIN");
    assert.ok(result.modelError);
  });

  it("builds a prompt that includes retrieved decisions and forbids invention", () => {
    const prompt = buildJudgePrompt({
      candidate: {
        type: "fixture_leak",
        file: "src/dashboard.js",
        claim: "dashboard reads fixtures",
      },
      evidence: { code: "readFile('fixtures/revenue.json')" },
      knownDecisions: [
        {
          decision: {
            example: { candidate: "fixture data", type: "fixture_leak", context: "production dashboard" },
            human_decision: "CONFIRMED",
            reason: "metrics must be authoritative",
          },
        },
      ],
    });
    assert.match(prompt, /Do not invent policy/);
    assert.match(prompt, /KNOWN DECISIONS/);
    assert.match(prompt, /RELEVANT INVARIANTS/);
    assert.match(prompt, /production dashboard/);
  });

  it("marks machine judgments as unreviewed model output", () => {
    const result = judgeCandidate({
      type: "authorization_check",
      file: "src/users.py",
      claim: "missing authz",
    });
    assert.equal(result.source, "model");
    assert.equal(result.reviewed, false);
    assert.equal(isLearningMaterial(result), false);
  });

  it("does not treat unreviewed model decisions as learning material", () => {
    const memory = recordDecision(
      {
        id: "model-guess",
        example: {
          candidate: "unknown pattern",
          type: "authorization_check",
          context: "production application",
        },
        human_decision: "CONFIRMED",
        reason: "model guess",
        invariant: "Invented policy must not be learned.",
        source: "model",
        reviewed: false,
      },
      { memory: { version: 1, decisions: [] } },
    );
    assert.equal(isLearningMaterial(memory.decisions[0]), false);
    const result = judgeCandidate(
      {
        type: "authorization_check",
        file: "src/users.py",
        claim: "unknown pattern",
      },
      {},
      { memory },
    );
    assert.equal(result.verdict, "UNCERTAIN");
  });

  it("measures whether the brain confirms true positives and dismisses false positives", () => {
    const metrics = evaluateJudgeExperiment({
      truePositives: [
        {
          candidate: {
            type: "production_environment_boundary",
            file: "src/config/environments.py",
            claim: "Production fallback to staging payment endpoint",
          },
          evidence: { code: 'PAYMENTS_URL = "https://mock-payments-stage.example"' },
        },
        {
          candidate: {
            type: "fixture_leak",
            file: "src/dashboard/revenue.js",
            claim: "production dashboard reads fixture data",
          },
          evidence: { code: "readFile('fixtures/revenue.json')" },
        },
        {
          candidate: {
            type: "noop_implementation",
            file: "src/crypto/encrypt.py",
            claim: "encrypt returns input unchanged",
          },
          evidence: { code: "def encrypt(data):\n    return data" },
        },
        {
          candidate: {
            type: "hallucinated_dependency",
            file: "src/lib/payments.py",
            claim: "unknown dependency stable_payments_client",
          },
          evidence: { code: "from stable_payments_client import Client" },
        },
        {
          candidate: {
            type: "fake_success",
            file: "src/payments/charge.py",
            claim: "charge returns success without a processor",
          },
          evidence: { code: 'def charge(card):\n    return {"success": True}' },
        },
      ],
      falsePositives: [
        {
          candidate: {
            type: "production_environment_boundary",
            file: "tests/integration/payments.test.js",
            claim: "mock payment endpoint",
          },
          evidence: { code: 'const host = "https://mock-payments-stage.example"' },
        },
        {
          candidate: {
            type: "fixture_leak",
            file: "tests/dashboard.test.js",
            claim: "unit test loads fixture data",
          },
          evidence: { code: "readFile('fixtures/revenue.json')" },
        },
        {
          candidate: {
            type: "placeholder",
            file: "tests/doubles/encrypt.py",
            claim: "placeholder implementation",
          },
          evidence: { code: "return True  # placeholder" },
        },
      ],
    });

    assert.equal(metrics.truePositivesCorrectlyConfirmed, 5);
    assert.equal(metrics.truePositivesIncorrectlyDismissed, 0);
    assert.equal(metrics.falsePositivesCorrectlyDismissed, 3);
    assert.equal(metrics.falsePositivesIncorrectlyEscalated, 0);
  });

  it("evaluates the held-out 26 TP / 25 FP set and prints the measurement report", () => {
    const metrics = runLabeledEvaluation();
    assert.equal(metrics.dataset.truePositives, 26);
    assert.equal(metrics.dataset.falsePositives, 25);
    assert.equal(metrics.dataset.total, 51);
    assert.match(metrics.report, /SimpleBeacon Reality Judge Evaluation/);
    assert.match(metrics.report, /Actionable finding precision/);
    assert.equal(metrics.truePositivesIncorrectlyDismissed, 0);
    assert.equal(metrics.falsePositivesIncorrectlyEscalated, 0);
    assert.ok(metrics.actionableFindingPrecision === 1);
    process.stdout.write(`\n${metrics.report}\n`);
  });
});
