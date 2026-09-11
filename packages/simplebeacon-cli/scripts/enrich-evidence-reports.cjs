/**
 * Enrich the three browser-local reports with signal triage + semantic
 * verification for local dashboard click-through (Audit → Import).
 * Does not deploy.
 */
const fs = require("fs");
const path = require("path");
const { triageFindings } = require("../src/lib/signal-engine");
const { attachSemanticVerification } = require("../src/lib/signal-verifier");

const redisSrc = [
  "_RENEW_SCRIPT = 'if redis.call'",
  "def renew_lock(self):",
  "    return bool(self.redis.eval(self._RENEW_SCRIPT, 1, self.lock_name, self.lock_id, self.timeout_secs))",
].join("\n");

const giteaDom = [
  "export function createElementFromHTML(htmlString) {",
  "  htmlString = htmlString.trim();",
  "  if (!htmlString.startsWith('<')) throw new Error('Invalid');",
  "  const div = document.createElement('div');",
  "  div.innerHTML = htmlString;",
  "  return div.firstChild;",
  "}",
].join("\n");

const immichCli = [
  "@Command({ name: 'reset-admin-password' })",
  "export class ResetAdminPasswordCommand extends CommandRunner {",
  "  async run() {",
  "    const { password } = await this.service.resetAdminPassword(prompt(this.inquirer));",
  "    console.log('The admin password has been updated to:' + password);",
  "  }",
  "}",
].join("\n");

const FILES = [
  {
    name: "open-webui",
    src: "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032056526.json",
    sourceMap: {
      "open-webui/backend/open_webui/socket/utils.py": redisSrc,
    },
  },
  {
    name: "gitea",
    src: "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032513605.json",
    sourceMap: {
      "gitea/web_src/js/utils/dom.ts": giteaDom,
      "gitea/modules/util/sanitize.go": "func SanitizeCredential",
    },
  },
  {
    name: "immich",
    src: "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032647877.json",
    sourceMap: {
      "immich/server/src/commands/reset-admin-password.command.ts": immichCli,
      "immich/server/src/commands/password-login.ts": immichCli,
      "immich/machine-learning/ann/export/run.py":
        "compiled = eval(exported_graph)\n",
    },
  },
];

function extract(report) {
  return (report.rawIssues || []).map((i) => ({
    type: i.type,
    severity: i.severity,
    filePath: i.filePath || i.file,
    line: i.line,
    description: i.description,
  }));
}

const outDir = path.resolve(
  __dirname,
  "../../../.simplebeacon/evidence-review",
);
fs.mkdirSync(outDir, { recursive: true });

for (const entry of FILES) {
  const report = JSON.parse(fs.readFileSync(entry.src, "utf8"));
  const findings = extract(report);
  const t = triageFindings(findings);
  report.signal = {
    pipeline: t.pipeline,
    scannedCount: t.scannedCount,
    dismissedCount: t.dismissedCount,
    reviewCount: t.reviewCount,
    investigateCount: t.investigateCount,
    investigate: t.investigate,
    candidates: t.investigate,
    note: "investigate means worth human review — not a confirmed vulnerability.",
  };
  attachSemanticVerification(report, { sourceMap: entry.sourceMap });
  report.contactGrade = {
    ...(report.contactGrade || {}),
    emailReady: false,
    verifiedCount: report.maintainerHeadline.verifiedVulnerabilities,
  };
  const outPath = path.join(outDir, `${entry.name}-evidence.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    `${entry.name}: ${report.maintainerHeadline.summary} → ${outPath}`,
  );
}

console.log("\nImport these in Audit → Import Existing Report for local review.");
