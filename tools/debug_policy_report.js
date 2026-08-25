const fs = require("fs");
const path = require("path");
const os = require("os");

(function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dbg-policy-"));
  const tmpLogPath = path.join(tmpDir, "audit-log.json");
  const tmpPolicyPath = path.join(tmpDir, "audit-policy.json");
  fs.writeFileSync(tmpLogPath, JSON.stringify({ entries: {} }, null, 2));
  fs.writeFileSync(tmpPolicyPath, JSON.stringify({}, null, 2));

  process.env.AUDIT_LOG_PATH = tmpLogPath;
  process.env.AUDIT_POLICY_PATH = tmpPolicyPath;

  // load modules
  delete require.cache[
    require.resolve("../ai-platform/server/lib/audit-logger.cjs")
  ];
  delete require.cache[
    require.resolve("../ai-platform/server/lib/audit-policy-store.cjs")
  ];
  const auditPolicyStore = require("../ai-platform/server/lib/audit-policy-store.cjs");
  const auditLogger = require("../ai-platform/server/lib/audit-logger.cjs");

  // write a policy
  const policy = { retentionDays: 60, maxEntries: 5000, archive: true };
  let store = {};
  try {
    store = JSON.parse(fs.readFileSync(tmpPolicyPath, "utf8"));
  } catch {}
  store["test-org"] = policy;
  fs.writeFileSync(tmpPolicyPath, JSON.stringify(store, null, 2));

  // reset cache on policy store
  if (auditPolicyStore && typeof auditPolicyStore._resetCache === "function")
    auditPolicyStore._resetCache();

  const report = auditLogger.generateComplianceReport("test-org");
  const orgProfile = report.orgs.find((o) => o.orgId === "test-org");
  console.log(
    "Reported retentionPolicy for test-org:",
    orgProfile.retentionPolicy,
  );
})();
