const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

function shannonEntropy(s) {
  if (!s || s.length === 0) return 0;
  const freq = Object.create(null);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    freq[c] = (freq[c] || 0) + 1;
  }
  let ent = 0;
  for (const k of Object.keys(freq)) {
    const p = freq[k] / s.length;
    ent -= p * Math.log2(p);
  }
  return ent; // bits per symbol
}

function findQuotedCandidates(content) {
  const re = /['`\"]([A-Za-z0-9\/+\-=._]{20,})['`\"]/g;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    out.push({ match: m[1], index: m.index, length: m[1].length });
  }
  return out;
}

function isHexString(s) {
  return /^[0-9a-fA-F]+$/.test(s);
}

function scanFileContent(content, filename, opts = {}) {
  const findings = [];

  // Explicit assignment patterns
  const kekAssign = /TRACK113_KEK\s*[:=]\s*['`\"]([^'`\"]+)['`\"]/m;
  const m = kekAssign.exec(content);
  if (m) {
    findings.push({
      reason: "TRACK113_KEK assignment",
      value: m[1].slice(0, 64),
      filename,
    });
  }

  // Search for quoted candidate tokens
  const candidates = findQuotedCandidates(content);
  for (const c of candidates) {
    const s = c.match;
    // Hex long strings
    if (s.length >= 32 && isHexString(s)) {
      findings.push({
        reason: "long-hex-string",
        value: s.slice(0, 64),
        filename,
      });
      continue;
    }
    // Entropy-based detection: strings >= 32 chars and entropy per char >= threshold
    const lenThreshold = opts.lenThreshold || 32;
    const perCharEntropyThreshold = opts.perCharEntropyThreshold || 4.5;
    if (s.length >= lenThreshold) {
      // Skip file paths — they contain slashes and end with file extensions.
      // Add common static asset extensions to avoid flagging entry file names.
      if (
        /^\.?\.?\/.*\.(cjs|js|json|ts|mjs|md|html|htm|css|yml|yaml|svg|png|jpg|gif|woff2?|ttf|eot)$/i.test(
          s,
        ) ||
        /^[a-z][-a-z0-9]*\/[a-z][-a-z0-9/]*\.(cjs|js|json|ts|mjs|md|html|htm|css|yml|yaml|svg|png|jpg|gif|woff2?|ttf|eot)$/i.test(
          s,
        )
      )
        continue;
      const ent = shannonEntropy(s);
      const perChar = ent; // entropy computed per-symbol already
      if (perChar >= perCharEntropyThreshold) {
        findings.push({
          reason: "high-entropy-string",
          entropy: perChar,
          length: s.length,
          value: s.slice(0, 64),
          filename,
        });
      }
    }
  }

  return findings;
}

function getStagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    });
    return out.split(/\r?\n/).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function scanFiles(filePaths, opts = {}) {
  const allFindings = [];
  for (const p of filePaths) {
    // Skip docs and markdown files to avoid false-positives on examples
    // Skip test files — long test pattern names and test secrets trigger high-entropy detection
    // Skip built frontend bundles/maps — minified charset alphabets (e.g. nanoid) trip entropy checks
    if (
      /\.md$/i.test(p) ||
      p.startsWith("ai-platform/docs") ||
      p.startsWith(".github/") ||
      /__tests__\/.*\.cjs$/.test(p) ||
      /\.test\.cjs$/.test(p) ||
      /(^|\/)tests\/.*\.(js|cjs)$/.test(p) ||
      /(^|\/)package-lock\.json$/.test(p) ||
      /(^|\/)npm-shrinkwrap\.json$/.test(p) ||
      /\.js\.map$/i.test(p) ||
      /(^|\/)(ai-platform\/web\/simplebeacon-dashboard\/assets|coming-soon\/public\/(?:app|dashboard)\/assets|simplebeacon-vscode-merged\/dashboard-web\/assets)\//i.test(
        p,
      ) ||
      new RegExp(
        "tests" + "\\/" + "fixtures" + "\\/" + "true-positives" + "\\/",
        "i",
      ).test(p) ||
      /(^|\/)vendor\/.*\.js$/i.test(p) ||
      /(^|\/)js-es2018\/dashboard\/main\.js$/i.test(p)
    )
      continue;
    let full = p;
    if (!path.isAbsolute(full)) full = path.resolve(process.cwd(), p);
    if (!fs.existsSync(full)) continue;
    try {
      const content = fs.readFileSync(full, "utf8");
      const f = scanFileContent(content, p, opts);
      if (f && f.length) allFindings.push(...f);
    } catch (e) {
      console.error("secret-scanner.cjs error:", e);
      // ignore unreadable
    }
  }
  return allFindings;
}

function cli() {
  const args = process.argv.slice(2);
  const opts = {};
  if (args.length === 0) {
    const staged = getStagedFiles();
    const findings = scanFiles(staged, opts);
    if (findings.length) {
      console.error("Secret scanner detected potential secrets:");
      for (const f of findings) console.error(JSON.stringify(f));
      process.exit(2);
    }
    process.exit(0);
  } else {
    const findings = scanFiles(args, opts);
    if (findings.length) {
      for (const f of findings) console.error(JSON.stringify(f));
      process.exit(2);
    }
    process.exit(0);
  }
}

if (require.main === module) cli();

module.exports = { shannonEntropy, scanFileContent, scanFiles };
