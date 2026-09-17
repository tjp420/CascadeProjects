import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  formatEvidenceHeadline,
  resolveEvidenceState,
} from "./evidence-state.ts";

describe("evidence-state", () => {
  test("headline never equates signals with vulnerabilities", () => {
    const h = formatEvidenceHeadline({
      signalsAnalyzed: 1258,
      automaticallyDismissed: 1235,
      requireReview: 23,
      verifiedVulnerabilities: 0,
    });
    assert.match(h.summary, /1258 code signals analyzed/);
    assert.match(h.summary, /0 verified vulnerabilities/);
    assert.equal(h.summary.includes("1258 vulnerabilities"), false);
  });

  test("resolves 0 verified from Open WebUI-shaped report", () => {
    const { headline, investigations, dismissals } = resolveEvidenceState({
      maintainerHeadline: {
        signalsAnalyzed: 182,
        automaticallyDismissed: 177,
        requireReview: 4,
        verifiedVulnerabilities: 0,
        summary:
          "182 code signals analyzed. 177 automatically dismissed. 4 require review. 0 verified vulnerabilities.",
      },
      verification: {
        dismissed: [
          {
            filePath: "open-webui/backend/open_webui/socket/utils.py",
            line: 58,
            type: "evalDanger",
            scannerSeverity: "high",
            verificationReason:
              "Sink is Redis EVAL of a hardcoded Lua snippet, not language eval() of user input.",
          },
        ],
        investigate: [
          {
            filePath: "open-webui/src/lib/components/notes/utils.ts",
            line: 40,
            type: "innerHtmlXss",
            scannerSeverity: "high",
            verificationReason:
              "DOM sink matched. Reachability from attacker-controlled content is not proven.",
            nextAction: "Trace markdown → renderer → sink",
            answers: { privilegesRequired: "browser-user" },
            clusterSize: 1,
          },
        ],
        verified: [],
      },
    });
    assert.equal(headline.verifiedVulnerabilities, 0);
    assert.equal(headline.requireReview, 4);
    assert.equal(investigations.length, 1);
    assert.equal(investigations[0].verification, "investigate");
    assert.equal(dismissals.length, 1);
    assert.equal(dismissals[0].verification, "dismissed");
    assert.match(dismissals[0].reason, /Redis EVAL/i);
    assert.equal(dismissals[0].detectorSeverity, "high");
  });

  test("does not invent verified from severityCounts alone", () => {
    const { headline } = resolveEvidenceState({
      issueCount: 387,
      severityCounts: { critical: 0, high: 40, medium: 342, low: 5 },
      signal: { scannedCount: 182, dismissedCount: 177, investigateCount: 5 },
    });
    assert.equal(headline.verifiedVulnerabilities, 0);
    assert.equal(headline.signalsAnalyzed, 182);
  });
});
