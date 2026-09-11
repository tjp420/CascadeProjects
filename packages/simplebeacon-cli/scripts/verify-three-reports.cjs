const fs = require("fs");
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

const files = [
  [
    "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032056526.json",
    "Open WebUI",
    { "open-webui/backend/open_webui/socket/utils.py": redisSrc },
  ],
  [
    "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032513605.json",
    "Gitea",
    { "gitea/web_src/js/utils/dom.ts": giteaDom },
  ],
  [
    "c:\\Users\\user\\Downloads\\simplebeacon-report-1789032647877.json",
    "Immich",
    {
      "immich/server/src/commands/reset-admin-password.command.ts": immichCli,
      "immich/server/src/commands/password-login.ts": immichCli,
      "immich/machine-learning/ann/export/run.py": "compiled = eval(exported_graph)\n",
    },
  ],
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

for (const [path, name, sourceMap] of files) {
  const report = JSON.parse(fs.readFileSync(path, "utf8"));
  const t = triageFindings(extract(report));
  const wrapped = {
    signal: {
      scannedCount: t.scannedCount,
      dismissedCount: t.dismissedCount,
      investigate: t.investigate,
      candidates: t.investigate,
    },
  };
  attachSemanticVerification(wrapped, { sourceMap });
  const h = wrapped.maintainerHeadline;
  console.log(`\n${name}`);
  console.log(h.summary);
  console.log(
    "verifier dismissed:",
    wrapped.verification.dismissed.map(
      (d) => `${d.filePath} :: ${d.verificationReason}`,
    ),
  );
  console.log(
    "verifier investigate clusters:",
    wrapped.verification.investigate.map(
      (d) => `${d.clusterKey} x${d.clusterSize} ${d.filePath} :: ${d.verificationReason}`,
    ),
  );
  console.log("verified:", wrapped.verification.verified.length);
}
