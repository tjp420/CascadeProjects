/**
 * Track 2 Slice 6 — real deliberately vulnerable repo fixture → Verified.
 * Goldens remain negative controls (0 Verified).
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

const VULN_ROOT = path.resolve(
  __dirname,
  "../fixtures/deliberately-vulnerable-xss",
);
const VULN_FILE = path.join(VULN_ROOT, "app", "comment-renderer.js");
const GOLDEN_DIR = path.resolve(
  __dirname,
  "../../../.simplebeacon/evidence-review",
);

const CHAIN = {
  answers: {
    attackerControlledInput: "yes",
    reachesDangerousOperation: "yes",
    dangerousOperationExecuted: "yes",
    privilegesRequired: "authenticated-user",
    existingControl: "none — sanitizer not applied on this path",
    attackPath:
      "HTTP request body comment → renderMarkdown() → element.innerHTML assignment",
    sourceLines: [18, 19, 20],
  },
  links: [
    {
      from: "req.body.comment",
      to: "renderMarkdown()",
      mechanism: "unsanitized string passthrough",
    },
    {
      from: "renderMarkdown()",
      to: "element.innerHTML",
      mechanism: "DOM sink write",
    },
  ],
  impactClass: "xss",
};

describe("Track 2 Slice 6 — real vulnerable fixture → Verified", () => {
  test("fixture source exists on disk for independent review", () => {
    assert.ok(fs.existsSync(VULN_FILE), `missing fixture: ${VULN_FILE}`);
    const src = fs.readFileSync(VULN_FILE, "utf8");
    assert.match(src, /req\.body\.comment/);
    assert.match(src, /renderMarkdown/);
    assert.match(src, /innerHTML/);
    assert.match(src, /DELIBERATE VULNERABILITY/);
  });

  test("real source → Verified with reproducible audit trail", () => {
    const sourceText = fs.readFileSync(VULN_FILE, "utf8");
    const relPath = "app/comment-renderer.js";

    const attempt = attemptVerifiedPromotion(
      {
        filePath: relPath,
        answers: CHAIN.answers,
        type: "innerHTMLXss",
        category: "xss",
        severity: "high", // must not be why it verifies
      },
      {
        links: CHAIN.links,
        impactClass: CHAIN.impactClass,
        sourceText,
      },
    );

    assert.equal(attempt.verification, "verified");
    assert.equal(attempt.promoted, true);
    assert.equal(attempt.evidenceChain.evidentiallyComplete, true);
    assert.equal(attempt.evidenceChain.independentlyReproducible, true);
    assert.equal(attempt.evidenceChain.sourceCorroborated, true);
    assert.equal(attempt.evidenceChain.impactClass, "xss");

    // Independent reviewer (audit record only — no engine verdict fields)
    const record = { ...attempt.auditRecord };
    delete record.verification;
    delete record.complete;
    const review = independentReviewerReproduce(record);
    assert.equal(review.reproducible, true, review.gaps.join("; "));

    // Second pass: reviewer with the actual file contents
    const sourceCheck = corroborateFromSourceContext({
      auditRecord: record,
      sourceText,
      filePath: relPath,
    });
    assert.equal(sourceCheck.corroborated, true, sourceCheck.gaps.join("; "));

    assert.match(record.whyVerified, /req\.body\.comment/);
    assert.match(record.whyVerified, /innerHTML/i);
    assert.match(record.whyVerified, /Impact:\s*xss/i);
  });

  test("severity alone still cannot verify the fixture without chain+source", () => {
    const sourceText = fs.readFileSync(VULN_FILE, "utf8");
    const attempt = attemptVerifiedPromotion(
      {
        filePath: "app/comment-renderer.js",
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
      { links: [], sourceText, impactClass: "xss" },
    );
    assert.equal(attempt.verification, "investigate");
  });

  test("Open WebUI / Gitea / Immich goldens remain 0 Verified (negative controls)", () => {
    for (const name of [
      "open-webui-evidence.json",
      "gitea-evidence.json",
      "immich-evidence.json",
    ]) {
      const report = JSON.parse(
        fs.readFileSync(path.join(GOLDEN_DIR, name), "utf8"),
      );
      assert.equal(report.maintainerHeadline.verifiedVulnerabilities, 0, name);
      const batch = promoteVerifiedBatch([
        ...(report.verification?.investigate || []),
        ...(report.verification?.dismissed || []),
      ]);
      assert.equal(batch.verified.length, 0, name);
    }
  });
});
