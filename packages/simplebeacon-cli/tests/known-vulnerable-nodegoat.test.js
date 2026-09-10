/**
 * Known-vulnerable real-world fixture milestone.
 * OWASP NodeGoat SSJS eval(req.body.*) → Verified under the same Track 2 gate.
 * Open WebUI / Gitea / Immich remain negative controls (0 Verified).
 * No category expansion. No redeploy. Outreach OFF.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  attemptVerifiedPromotion,
  promoteVerifiedBatch,
  independentReviewerReproduce,
  corroborateFromSourceContext,
} = require("../src/lib/verified-vulnerability-engine");

const FIXTURE_FILE = path.resolve(
  __dirname,
  "../fixtures/known-vulnerable-nodegoat/app/routes/contributions.js",
);
const GOLDEN_DIR = path.resolve(
  __dirname,
  "../../../.simplebeacon/evidence-review",
);

/** Evidence chain matching the real NodeGoat vulnerability surface. */
const NODEGOAT_SSJS_CHAIN = {
  answers: {
    attackerControlledInput: "yes",
    reachesDangerousOperation: "yes",
    dangerousOperationExecuted: "yes",
    privilegesRequired: "authenticated-user",
    existingControl:
      "none — upstream parseInt fix is present only as commented-out code",
    attackPath:
      "HTTP request body preTax → eval(req.body.preTax) executes attacker-controlled JavaScript on the server",
    sourceLines: [22, 23, 24],
  },
  links: [
    {
      from: "req.body.preTax",
      to: "eval()",
      mechanism: "request body string passed directly to eval without parsing",
    },
    {
      from: "eval()",
      to: "server JavaScript runtime",
      mechanism: "eval executes the attacker-controlled expression in-process",
    },
  ],
  impactClass: "rce",
};

describe("Known-vulnerable real-world fixture — OWASP NodeGoat SSJS", () => {
  test("attributed NodeGoat contributions.js exists on disk", () => {
    assert.ok(fs.existsSync(FIXTURE_FILE), FIXTURE_FILE);
    const src = fs.readFileSync(FIXTURE_FILE, "utf8");
    assert.match(src, /OWASP NodeGoat/);
    assert.match(src, /eval\s*\(\s*req\.body\.preTax\s*\)/);
    assert.match(src, /parseInt\(req\.body\.preTax\)/);
    assert.match(src, /Apache-2\.0|Apache License/i);
  });

  test("real NodeGoat source → Verified under the same promotion gate", () => {
    const sourceText = fs.readFileSync(FIXTURE_FILE, "utf8");
    const relPath = "app/routes/contributions.js";

    const attempt = attemptVerifiedPromotion(
      {
        filePath: relPath,
        type: "evalDanger",
        category: "evalDanger",
        severity: "critical",
        answers: NODEGOAT_SSJS_CHAIN.answers,
      },
      {
        links: NODEGOAT_SSJS_CHAIN.links,
        impactClass: NODEGOAT_SSJS_CHAIN.impactClass,
        sourceText,
      },
    );

    assert.equal(attempt.verification, "verified");
    assert.equal(attempt.promoted, true);
    assert.equal(attempt.evidenceChain.evidentiallyComplete, true);
    assert.equal(attempt.evidenceChain.independentlyReproducible, true);
    assert.equal(attempt.evidenceChain.sourceCorroborated, true);
    assert.equal(attempt.evidenceChain.impactClass, "rce");

    const record = { ...attempt.auditRecord };
    delete record.verification;
    delete record.complete;
    const review = independentReviewerReproduce(record);
    assert.equal(review.reproducible, true, review.gaps.join("; "));

    const sourceCheck = corroborateFromSourceContext({
      auditRecord: record,
      sourceText,
      filePath: relPath,
    });
    assert.equal(sourceCheck.corroborated, true, sourceCheck.gaps.join("; "));

    assert.match(record.whyVerified, /req\.body\.preTax/);
    assert.match(record.whyVerified, /eval/i);
    assert.match(record.whyVerified, /Impact:\s*rce/i);
  });

  test("Critical severity alone cannot Verified NodeGoat without the chain", () => {
    const sourceText = fs.readFileSync(FIXTURE_FILE, "utf8");
    const attempt = attemptVerifiedPromotion(
      {
        filePath: "app/routes/contributions.js",
        severity: "critical",
        answers: {
          attackerControlledInput: "unknown",
          reachesDangerousOperation: "unknown",
          dangerousOperationExecuted: "yes",
          privilegesRequired: "unknown",
          existingControl: "unknown",
          attackPath: "Not established.",
        },
      },
      { links: [], sourceText, impactClass: "rce" },
    );
    assert.equal(attempt.verification, "investigate");
  });

  test("Open WebUI / Gitea / Immich remain negative controls at 0 Verified", () => {
    for (const name of [
      "open-webui-evidence.json",
      "gitea-evidence.json",
      "immich-evidence.json",
    ]) {
      const report = JSON.parse(
        fs.readFileSync(path.join(GOLDEN_DIR, name), "utf8"),
      );
      assert.equal(report.maintainerHeadline.verifiedVulnerabilities, 0, name);
      assert.equal(
        promoteVerifiedBatch([
          ...(report.verification?.investigate || []),
          ...(report.verification?.dismissed || []),
        ]).verified.length,
        0,
        name,
      );
    }
  });
});
