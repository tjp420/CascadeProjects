/**
 * Verification funnel benchmark v1 — measurement only.
 *
 * Calls the production gate path (no second pipeline):
 *   report.rawIssues
 *     → compileGateStatus
 *       → attachVerifiedFindings
 *       → attachSignalTriage
 *       → attachSemanticVerification  (→ applyVerifiedEngine)
 *       → maintainerHeadline
 *
 * Then measures funnel counts + labeled ground truth.
 *
 * Acceptance (two-sided):
 *   maximize verified recall  subject to  zero unsupported Verified
 * Dismissed counts are informational — not a success metric.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const { compileGateStatus } = require("../scan");
const {
  attemptVerifiedPromotion,
  promoteVerifiedBatch,
} = require("./verified-vulnerability-engine");

const BENCHMARK_ID = "verification-funnel-v1";
const FIXTURE_ROOT = path.resolve(__dirname, "../../fixtures/benchmark");
const LABELS_PATH = path.join(FIXTURE_ROOT, "labels.v1.json");
const NODEGOAT_ROOT = path.resolve(
  __dirname,
  "../../fixtures/known-vulnerable-nodegoat",
);
const XSS_ROOT = path.resolve(
  __dirname,
  "../../fixtures/deliberately-vulnerable-xss",
);
const EVIDENCE_REVIEW_DIR = path.resolve(
  __dirname,
  "../../../../.simplebeacon/evidence-review",
);
const GOLDEN_MINI_DIR = path.join(FIXTURE_ROOT, "goldens");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function loadLabels() {
  return readJson(LABELS_PATH);
}

/**
 * Production funnel measurement: seed detector-shaped rawIssues, then
 * compileGateStatus — same attach* chain as a live scan report.
 */
function measureProductionFunnel(rawIssues, gateConfig = {}) {
  const report = {
    rawIssues: (rawIssues || []).map((issue) => ({ ...issue })),
  };
  compileGateStatus(report, gateConfig);
  const h = report.maintainerHeadline || {};
  return {
    report,
    signalsAnalyzed: Number(h.signalsAnalyzed) || 0,
    dismissed: Number(h.automaticallyDismissed) || 0,
    requireReview: Number(h.requireReview) || 0,
    verified: Number(h.verifiedVulnerabilities) || 0,
    headline: h.summary || null,
  };
}

function promoteLabeled(expected, sourceText) {
  const attempt = attemptVerifiedPromotion(
    {
      filePath: expected.filePath,
      type: expected.type,
      category: expected.category || expected.type,
      severity: expected.severity || "critical",
      answers: expected.evidence.answers,
    },
    {
      links: expected.evidence.links,
      impactClass: expected.evidence.impactClass,
      sourceText,
    },
  );
  return attempt;
}

function resolveGoldenPath(baseName) {
  const preferred = path.join(EVIDENCE_REVIEW_DIR, `${baseName}-evidence.json`);
  if (fs.existsSync(preferred)) return preferred;
  const mini = path.join(GOLDEN_MINI_DIR, `${baseName}-mini.json`);
  if (fs.existsSync(mini)) return mini;
  return null;
}

function runPositiveTarget(def) {
  const sourceText = readUtf8(path.join(def.root, def.sourceFile));
  const measured = measureProductionFunnel(def.rawIssues);
  const expectedVerified = def.expectedVerified.map((e) => e.id);
  const hits = [];
  const misses = [];
  const verifiedRows = [];

  for (const expected of def.expectedVerified) {
    const attempt = promoteLabeled(expected, sourceText);
    if (attempt.verification === "verified" && attempt.promoted) {
      hits.push(expected.id);
      verifiedRows.push({
        id: expected.id,
        filePath: expected.filePath,
        impactClass: attempt.evidenceChain?.impactClass || null,
        explainable: Boolean(
          attempt.auditRecord &&
            attempt.evidenceChain?.complete &&
            attempt.evidenceChain?.independentlyReproducible,
        ),
      });
    } else {
      misses.push({
        id: expected.id,
        reason: attempt.verificationReason || "not verified",
      });
    }
  }

  const verifiedRecall =
    expectedVerified.length === 0
      ? null
      : hits.length / expectedVerified.length;

  return {
    name: def.name,
    kind: "positive-control",
    expectedVerified,
    signalsAnalyzed: measured.signalsAnalyzed,
    dismissed: measured.dismissed,
    requireReview: measured.requireReview,
    // Funnel Verified from production path (usually 0 without labeled chain)
    verifiedPipeline: measured.verified,
    // Ground-truth Verified via the same applyVerifiedEngine / promotion API
    verified: hits.length,
    verifiedRecall,
    falsePositivePromotions: 0,
    missed: misses,
    verifiedRows,
    headline: measured.headline,
    note: def.note || null,
  };
}

function runNegativeGolden(name) {
  const filePath = resolveGoldenPath(name);
  if (!filePath) {
    return {
      name,
      kind: "negative-control",
      expectedVerified: [],
      signalsAnalyzed: 0,
      dismissed: 0,
      requireReview: 0,
      verifiedPipeline: 0,
      verified: 0,
      verifiedRecall: null,
      falsePositivePromotions: 0,
      skipped: true,
      skipReason: `Missing golden for ${name}`,
      note: null,
    };
  }

  const golden = readJson(filePath);
  const h = golden.maintainerHeadline || {};
  const pipelineVerified = Number(h.verifiedVulnerabilities) || 0;

  // Re-run promotion on investigate/dismissed rows through the production engine.
  const batch = promoteVerifiedBatch([
    ...(golden.verification?.investigate || []),
    ...(golden.verification?.dismissed || []),
    ...(golden.verification?.verified || []),
  ]);
  const fp = pipelineVerified + batch.verified.length;

  return {
    name,
    kind: "negative-control",
    expectedVerified: [],
    signalsAnalyzed: Number(h.signalsAnalyzed) || 0,
    dismissed: Number(h.automaticallyDismissed) || 0,
    requireReview: Number(h.requireReview) || 0,
    verifiedPipeline: pipelineVerified,
    verified: pipelineVerified,
    verifiedRecall: null,
    falsePositivePromotions: fp,
    goldenSource: path.basename(filePath),
    headline: h.summary || null,
    note: "Unsupported finding → never Verified",
  };
}

function runKubernetesNoise(labels) {
  const root = process.env.SB_BENCH_K8S_ROOT;
  const useExternal = Boolean(root && fs.existsSync(root));
  const noiseRoot = path.join(FIXTURE_ROOT, "mature-noise");
  const rawIssues = [];

  if (useExternal) {
    // Sample walk — noise benchmark, not vuln hunt
    const maxFiles = Number(process.env.SB_BENCH_K8S_MAX_FILES) || 400;
    let walked = 0;
    function walk(dir) {
      if (walked >= maxFiles) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (walked >= maxFiles) return;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (/^\.git$|node_modules|vendor|_output$/.test(ent.name)) continue;
          walk(full);
        } else if (/\.(md|go|ya?ml|sh)$/i.test(ent.name)) {
          walked += 1;
          let text = "";
          try {
            text = fs.readFileSync(full, "utf8").slice(0, 6000);
          } catch {
            continue;
          }
          const rel = path.relative(root, full).split(path.sep).join("/");
          if (/eval\s*\(/.test(text)) {
            rawIssues.push({
              type: "evalDanger",
              severity: "critical",
              filePath: rel,
              description: "eval-like pattern (noise sample)",
            });
          } else if (/password|api[_-]?key|token\s*=/i.test(text)) {
            rawIssues.push({
              type: "hardcodedCredential",
              severity: "high",
              filePath: rel,
              description: "credential-like pattern (noise sample)",
            });
          }
        }
      }
    }
    walk(root);
  } else {
    for (const issue of labels.kubernetesNoise.rawIssues) {
      rawIssues.push({ ...issue });
    }
    // Ensure fixture files exist for explainability of the proxy
    for (const rel of labels.kubernetesNoise.files || []) {
      const full = path.join(noiseRoot, rel);
      if (!fs.existsSync(full)) {
        throw new Error(`kubernetes noise fixture missing: ${full}`);
      }
    }
  }

  const measured = measureProductionFunnel(rawIssues);
  const batch = promoteVerifiedBatch([
    ...(measured.report.verification?.investigate || []),
    ...(measured.report.verification?.dismissed || []),
    ...(measured.report.verification?.verified || []),
  ]);
  const fp = measured.verified + batch.verified.length;

  return {
    name: "kubernetes",
    kind: "noise-context",
    expectedVerified: [],
    signalsAnalyzed: measured.signalsAnalyzed,
    dismissed: measured.dismissed,
    requireReview: measured.requireReview,
    verifiedPipeline: measured.verified,
    verified: measured.verified,
    verifiedRecall: null,
    falsePositivePromotions: fp,
    mode: useExternal ? "external-sample" : "mature-noise-proxy",
    headline: measured.headline,
    note: useExternal
      ? `External sample from SB_BENCH_K8S_ROOT (${root})`
      : "Proxy for mature-repo noise (docs/test/examples). Not a vulnerable-app benchmark.",
  };
}

function scoreResult(targets) {
  const positives = targets.filter((t) => t.kind === "positive-control");
  const negatives = targets.filter(
    (t) => t.kind === "negative-control" || t.kind === "noise-context",
  );

  let known = 0;
  let hit = 0;
  for (const t of positives) {
    known += (t.expectedVerified || []).length;
    hit += Number(t.verified) || 0;
  }

  let unsupported = 0;
  for (const t of negatives) {
    if (t.skipped) continue;
    unsupported += Number(t.falsePositivePromotions) || 0;
  }
  // Positive controls should not invent extra Verified beyond expected
  for (const t of positives) {
    const expected = (t.expectedVerified || []).length;
    if ((t.verified || 0) > expected) {
      unsupported += t.verified - expected;
    }
  }

  const recallRate = known ? hit / known : null;
  const explainable = positives.every(
    (t) =>
      !t.verifiedRows ||
      t.verifiedRows.every((row) => row.explainable === true),
  );

  const recallPass = known > 0 && hit === known;
  const noisePass = unsupported === 0;
  const explainPass = explainable && hit > 0;

  return {
    knownVulnerabilities: known,
    verifiedBySimpleBeacon: hit,
    verifiedRecall: recallRate,
    unsupportedVerified: unsupported,
    fpToVerifiedRate: unsupported === 0 ? 0 : null,
    result: {
      recall: recallPass ? "PASS" : "FAIL",
      noiseRejection: noisePass ? "PASS" : "FAIL",
      explainability: explainPass ? "PASS" : "FAIL",
    },
    pass:
      recallPass &&
      noisePass &&
      (hit === 0 ? noisePass : explainPass),
  };
}

function runVerificationFunnelBenchmark(options = {}) {
  const labels = loadLabels();

  const nodegoat = runPositiveTarget({
    name: "nodegoat",
    root: NODEGOAT_ROOT,
    sourceFile: labels.nodegoat.sourceFile,
    rawIssues: labels.nodegoat.rawIssues,
    expectedVerified: labels.nodegoat.expectedVerified,
    note: "Known SSJS/eval → Verified (recall). Pipeline alone may leave investigate until labeled evidence is applied through the same engine.",
  });

  const xssFixture = runPositiveTarget({
    name: "xss-fixture",
    root: XSS_ROOT,
    sourceFile: labels.xssFixture.sourceFile,
    rawIssues: labels.xssFixture.rawIssues,
    expectedVerified: labels.xssFixture.expectedVerified,
    note: "Slice 6 complete evidence chain → Verified (Track 2 contract).",
  });

  const openWebui = runNegativeGolden("open-webui");
  const gitea = runNegativeGolden("gitea");
  const immich = runNegativeGolden("immich");
  const kubernetes = runKubernetesNoise(labels);

  const targets = [
    nodegoat,
    xssFixture,
    openWebui,
    gitea,
    immich,
    kubernetes,
  ];

  const groundTruth = scoreResult(targets);

  return {
    benchmark: BENCHMARK_ID,
    generatedAt: new Date().toISOString(),
    objective:
      "Maximize verified recall subject to zero unsupported promotion. Dismissed is informational only.",
    productionPath: [
      "rawIssues",
      "compileGateStatus",
      "attachVerifiedFindings",
      "attachSignalTriage",
      "attachSemanticVerification",
      "applyVerifiedEngine",
      "maintainerHeadline",
    ],
    targets: targets.map((t) => ({
      name: t.name,
      kind: t.kind,
      expectedVerified: t.expectedVerified || [],
      signalsAnalyzed: t.signalsAnalyzed,
      dismissed: t.dismissed,
      requireReview: t.requireReview,
      verified: t.verified,
      verifiedPipeline: t.verifiedPipeline,
      verifiedRecall: t.verifiedRecall,
      falsePositivePromotions: t.falsePositivePromotions,
      ...(t.skipped ? { skipped: true, skipReason: t.skipReason } : {}),
      ...(t.mode ? { mode: t.mode } : {}),
      ...(t.missed && t.missed.length ? { missed: t.missed } : {}),
      ...(t.note ? { note: t.note } : {}),
    })),
    groundTruth,
    pass: groundTruth.pass,
  };
}

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + " ".repeat(n - str.length);
}

function formatHumanReport(report) {
  const lines = [];
  lines.push("SIMPLEBEACON VERIFICATION FUNNEL BENCHMARK");
  lines.push("==========================================");
  lines.push(`benchmark: ${report.benchmark}`);
  lines.push(`generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(
    `${pad("Target", 18)} ${pad("Signals", 10)} ${pad("Dismissed", 11)} ${pad("Review", 9)} ${pad("Verified", 8)}`,
  );
  lines.push("-".repeat(60));
  for (const t of report.targets) {
    if (t.skipped) {
      lines.push(`${pad(t.name, 18)} skipped — ${t.skipReason}`);
      continue;
    }
    lines.push(
      `${pad(t.name, 18)} ${pad(t.signalsAnalyzed, 10)} ${pad(t.dismissed, 11)} ${pad(t.requireReview, 9)} ${pad(t.verified, 8)}`,
    );
  }
  lines.push("");
  lines.push("GROUND TRUTH");
  lines.push("-".repeat(60));
  const g = report.groundTruth;
  lines.push(
    `Known vulnerabilities:        ${g.knownVulnerabilities}`,
  );
  lines.push(
    `Verified by SimpleBeacon:     ${g.verifiedBySimpleBeacon}`,
  );
  lines.push(
    `Verified recall:              ${
      g.verifiedRecall == null
        ? "n/a"
        : `${(g.verifiedRecall * 100).toFixed(0)}%`
    }`,
  );
  lines.push("");
  lines.push(`Unsupported Verified:         ${g.unsupportedVerified}`);
  lines.push(
    `FP-to-Verified rate:          ${
      g.fpToVerifiedRate == null ? "n/a" : `${g.fpToVerifiedRate}%`
    }`,
  );
  lines.push("");
  lines.push("RESULT");
  lines.push("-".repeat(60));
  lines.push(`Recall:          ${g.result.recall}`);
  lines.push(`Noise rejection: ${g.result.noiseRejection}`);
  lines.push(`Explainability:  ${g.result.explainability}`);
  lines.push("");
  lines.push(
    "Objective: maximize verified recall subject to zero unsupported promotion.",
  );
  lines.push(
    '(Dismissed is reported for transparency — it is not an acceptance metric.)',
  );
  return lines.join("\n");
}

const LABELS_V2_PATH = path.join(FIXTURE_ROOT, "labels.v2.json");
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

function resolveV2Root(relRoot) {
  return path.resolve(PACKAGE_ROOT, relRoot);
}

/**
 * V2: labeled corpus expansion. Same production funnel + promotion API.
 * Does not change the verifier. Misses are recorded, not fixed here.
 */
function runVerificationFunnelBenchmarkV2() {
  const labels = readJson(LABELS_V2_PATH);
  const assessments = [];
  const positiveTargets = [];

  for (const gt of labels.groundTruth || []) {
    const root = resolveV2Root(gt.root);
    const sourceText = readUtf8(path.join(root, gt.sourceFile));
    const measured = measureProductionFunnel(gt.rawIssues || []);
    const attempt = promoteLabeled(
      {
        filePath: gt.filePath,
        type: gt.type,
        category: gt.category || gt.type,
        severity: gt.severity || "critical",
        evidence: gt.evidence,
      },
      sourceText,
    );
    const evidenceVerified =
      attempt.verification === "verified" && attempt.promoted === true;
    assessments.push({
      id: gt.id,
      app: gt.app,
      class: gt.class,
      expectVerified: gt.expectVerified !== false,
      evidenceVerified,
      hit:
        gt.expectVerified !== false ? evidenceVerified : !evidenceVerified,
      verificationReason: attempt.verificationReason || null,
      explainable: Boolean(
        attempt.auditRecord &&
          attempt.evidenceChain?.complete &&
          attempt.evidenceChain?.independentlyReproducible,
      ),
    });
    positiveTargets.push({
      name: gt.id,
      kind: "positive-control",
      expectedVerified: gt.expectVerified !== false ? [gt.id] : [],
      signalsAnalyzed: measured.signalsAnalyzed,
      dismissed: measured.dismissed,
      requireReview: measured.requireReview,
      verifiedPipeline: measured.verified,
      verified: evidenceVerified ? 1 : 0,
      verifiedRecall: evidenceVerified ? 1 : 0,
      falsePositivePromotions: 0,
      missed: evidenceVerified
        ? []
        : [{ id: gt.id, reason: attempt.verificationReason || "not verified" }],
      verifiedRows: evidenceVerified
        ? [
            {
              id: gt.id,
              filePath: gt.filePath,
              impactClass: attempt.evidenceChain?.impactClass || null,
              explainable: Boolean(
                attempt.auditRecord && attempt.evidenceChain?.complete,
              ),
            },
          ]
        : [],
      note: `${gt.app} / ${gt.class}`,
    });
  }

  const openWebui = runNegativeGolden("open-webui");
  const gitea = runNegativeGolden("gitea");
  const immich = runNegativeGolden("immich");
  const kubernetes = runKubernetesNoise(readJson(LABELS_PATH));

  const targets = [...positiveTargets, openWebui, gitea, immich, kubernetes];
  const scored = scoreResult(targets);

  const known = assessments.filter((a) => a.expectVerified);
  const verified = known.filter((a) => a.evidenceVerified);
  const missed = known.filter((a) => !a.evidenceVerified);

  return {
    benchmark: "verification-funnel-v2",
    generatedAt: new Date().toISOString(),
    objective:
      "V2 ground-truth expansion: measure recall of the unchanged funnel. Unsupported Verified must stay 0. Do not tune the verifier in this pass.",
    productionPath: [
      "rawIssues",
      "compileGateStatus",
      "attachVerifiedFindings",
      "attachSignalTriage",
      "attachSemanticVerification",
      "applyVerifiedEngine",
      "maintainerHeadline",
    ],
    verifierUnchanged: true,
    labelsPath: "fixtures/benchmark/labels.v2.json",
    assessments,
    targets: targets.map((t) => ({
      name: t.name,
      kind: t.kind,
      expectedVerified: t.expectedVerified || [],
      signalsAnalyzed: t.signalsAnalyzed,
      dismissed: t.dismissed,
      requireReview: t.requireReview,
      verified: t.verified,
      verifiedPipeline: t.verifiedPipeline,
      verifiedRecall: t.verifiedRecall,
      falsePositivePromotions: t.falsePositivePromotions,
      ...(t.skipped ? { skipped: true, skipReason: t.skipReason } : {}),
      ...(t.mode ? { mode: t.mode } : {}),
      ...(t.missed && t.missed.length ? { missed: t.missed } : {}),
      ...(t.note ? { note: t.note } : {}),
    })),
    groundTruth: {
      ...scored,
      knownVulnerabilities: known.length,
      verifiedBySimpleBeacon: verified.length,
      missed: missed.map((m) => ({
        id: m.id,
        app: m.app,
        class: m.class,
        reason: m.verificationReason,
      })),
      verifiedRecall: known.length ? verified.length / known.length : null,
    },
    pass:
      scored.result.noiseRejection === "PASS" &&
      scored.unsupportedVerified === 0,
    recallComplete: missed.length === 0,
  };
}

function formatHumanReportV2(report) {
  const lines = [];
  lines.push("SIMPLEBEACON VERIFICATION FUNNEL BENCHMARK V2");
  lines.push("=============================================");
  lines.push(`benchmark: ${report.benchmark}`);
  lines.push(`generated: ${report.generatedAt}`);
  lines.push("verifier: UNCHANGED (measurement only)");
  lines.push("");
  lines.push("GROUND TRUTH → VERIFIED → MISSED");
  lines.push("-".repeat(60));
  const g = report.groundTruth;
  lines.push(`Known vulnerabilities:        ${g.knownVulnerabilities}`);
  lines.push(`Verified by SimpleBeacon:     ${g.verifiedBySimpleBeacon}`);
  lines.push(`Missed:                       ${g.missed?.length || 0}`);
  lines.push(
    `Verified recall:              ${
      g.verifiedRecall == null
        ? "n/a"
        : `${(g.verifiedRecall * 100).toFixed(0)}%`
    }`,
  );
  lines.push(`Unsupported Verified:         ${g.unsupportedVerified}`);
  lines.push("");
  if (g.missed && g.missed.length) {
    lines.push(
      "MISSES (product limitations — do not fix verifier in this pass)",
    );
    lines.push("-".repeat(60));
    for (const m of g.missed) {
      lines.push(`- ${m.id} (${m.app}/${m.class})`);
      if (m.reason) lines.push(`    ${m.reason}`);
    }
    lines.push("");
  }
  lines.push("RESULT");
  lines.push("-".repeat(60));
  lines.push(
    `Unsupported Verified = 0: ${
      g.unsupportedVerified === 0 ? "PASS" : "FAIL"
    }`,
  );
  lines.push(
    `Recall complete:          ${
      report.recallComplete ? "YES" : "NO — misses recorded"
    }`,
  );
  lines.push(`Noise rejection:         ${g.result.noiseRejection}`);
  return lines.join("\n");
}

module.exports = {
  BENCHMARK_ID,
  BENCHMARK_ID_V2: "verification-funnel-v2",
  FIXTURE_ROOT,
  LABELS_PATH,
  LABELS_V2_PATH,
  runVerificationFunnelBenchmark,
  runVerificationFunnelBenchmarkV2,
  formatHumanReport,
  formatHumanReportV2,
  measureProductionFunnel,
  scoreResult,
};
