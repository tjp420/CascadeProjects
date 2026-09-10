const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { classifyFinding, triageFindings } = require("../src/lib/signal-engine");
const {
  OUTCOMES,
  verifyFinding,
  verifyCandidates,
  clusterCandidates,
  maintainerHeadline,
} = require("../src/lib/signal-verifier");

const REDIS_EVAL = `
class RedisLock:
    _RENEW_SCRIPT = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('expire', KEYS[1], ARGV[2])
    end
    return 0
    """
    def renew_lock(self):
        return bool(self.redis.eval(self._RENEW_SCRIPT, 1, self.lock_name, self.lock_id, self.timeout_secs))
`;

const GITEA_DOM = `
export function createElementFromHTML<T extends Element>(htmlString: string): T {
  htmlString = htmlString.trim();
  if (!htmlString.startsWith('<')) throw new Error('Invalid HTML');
  const div = document.createElement('div');
  div.innerHTML = htmlString;
  return div.firstChild as T;
}
`;

const IMMICH_CLI = `
@Command({ name: 'reset-admin-password' })
export class ResetAdminPasswordCommand extends CommandRunner {
  async run(): Promise<void> {
    const { password, provided } = await this.service.resetAdminPassword(prompt(this.inquirer));
    console.log(\`The admin password has been updated to:\\n\${password}\`);
  }
}
`;

describe("semantic verifier", () => {
  test("Open WebUI redis.eval is dismissed, not a verified eval() RCE", () => {
    const finding = classifyFinding({
      type: "evalDanger",
      severity: "high",
      filePath: "open-webui/backend/open_webui/socket/utils.py",
      line: 58,
    });
    const row = verifyFinding(finding, { sourceText: REDIS_EVAL });
    assert.equal(row.verification, OUTCOMES.DISMISSED);
    assert.equal(row.answers.attackerControlledInput, "no");
    assert.match(row.verificationReason, /Redis EVAL/i);
  });

  test("Gitea innerHTML helpers cluster and stay investigate until callers are traced", () => {
    const xss = [
      "web_src/js/utils/dom.ts",
      "web_src/js/features/repo-issue.ts",
      "web_src/js/features/repo-wiki.ts",
    ].map((filePath) =>
      classifyFinding({
        type: "innerHtmlXss",
        severity: "high",
        filePath,
        line: 272,
      }),
    );
    const clusters = clusterCandidates(xss);
    assert.ok(clusters.length <= 2);
    const row = verifyFinding(xss[0], {
      sourceText: GITEA_DOM,
      clusterSize: 3,
    });
    assert.equal(row.verification, OUTCOMES.INVESTIGATE);
    assert.notEqual(row.verification, OUTCOMES.VERIFIED);
    assert.match(row.answers.attackPath, /Cluster|not traced/i);
  });

  test("Immich CLI password print is not a remote verified vulnerability", () => {
    const finding = classifyFinding({
      type: "loggingSecrets",
      severity: "high",
      filePath: "immich/server/src/commands/reset-admin-password.command.ts",
      line: 35,
    });
    const row = verifyFinding(finding, { sourceText: IMMICH_CLI });
    assert.equal(row.verification, OUTCOMES.INVESTIGATE);
    assert.equal(row.answers.privilegesRequired, "local-operator-cli");
    assert.match(row.verificationReason, /not a remote/i);
  });

  test("Immich ML eval stays investigate until attacker control is shown", () => {
    const finding = classifyFinding({
      type: "evalDanger",
      severity: "high",
      filePath: "immich/machine-learning/ann/export/run.py",
      line: 64,
    });
    const row = verifyFinding(finding, {
      sourceText: "compiled = eval(exported_graph)\n",
    });
    assert.equal(row.verification, OUTCOMES.INVESTIGATE);
    assert.equal(row.answers.attackerControlledInput, "unknown");
    assert.equal(row.answers.privilegesRequired, "local-ml-export-job");
  });

  test("maintainer headline never calls signals vulnerabilities", () => {
    const h = maintainerHeadline({
      signalsAnalyzed: 1258,
      automaticallyDismissed: 1235,
      requireReview: 23,
      verifiedVulnerabilities: 0,
    });
    assert.match(h.summary, /code signals analyzed/);
    assert.match(h.summary, /0 verified vulnerabilities/);
    assert.equal(h.summary.includes("1258 vulnerabilities found"), false);
  });

  test("sanitizer credential hits are dismissed", () => {
    const finding = classifyFinding({
      type: "sensitiveData",
      severity: "high",
      filePath: "gitea/modules/util/sanitize.go",
      line: 34,
    });
    const row = verifyFinding(finding, { sourceText: "func SanitizeCredential" });
    assert.equal(row.verification, OUTCOMES.DISMISSED);
  });

  test("hundreds of Critical/High signals never invent Verified without evidence", () => {
    const flood = Array.from({ length: 200 }, (_, i) =>
      classifyFinding({
        type: i % 2 ? "credentials" : "innerHtmlXss",
        severity: i % 3 === 0 ? "critical" : "high",
        filePath: `src/app/module-${i}.ts`,
        line: i + 1,
      }),
    );
    const result = verifyCandidates(flood);
    assert.equal(result.verified.length, 0);
    const headline = maintainerHeadline({
      signalsAnalyzed: flood.length,
      automaticallyDismissed: result.dismissed.length,
      requireReview: result.investigate.reduce(
        (n, r) => n + (r.clusterSize || 1),
        0,
      ),
      verifiedVulnerabilities: result.verified.length,
    });
    assert.equal(headline.verifiedVulnerabilities, 0);
    assert.match(headline.summary, /0 verified vulnerabilities/);
  });
});
