/**
 * ZScript syntax lint — default parameter values (parse error in GZDoom).
 */

const fs = require("fs");
const path = require("path");
const { globMatch: _globMatch } = require("../rules/production-leak");
const { collectGzdoomFiles } = require("./gzdoom-symbol-graph");
const { resolveReachableGzdoomFiles } = require("./gzdoom-include-resolver");

const PARAM_DEFAULT_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^,)]+/;
const FN_HEAD_RE =
  /^\s*(?:override\s+)?(?:static\s+)?(?:void|bool|int|float|double|string|Vector2|Vector3|Name|State|Color)\s+([A-Za-z_]\w*)\s*\(/;

function lintDefaultParameters(content, filePath, severity = "high") {
  const issues = [];
  const lines = String(content || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const head = FN_HEAD_RE.exec(line);
    if (!head) continue;
    const open = line.indexOf("(");
    const close = line.indexOf(")", open + 1);
    if (close < 0) continue;
    const params = line.slice(open + 1, close);
    if (!params.includes("=")) continue;
    PARAM_DEFAULT_RE.lastIndex = 0;
    let paramMatch;
    while ((paramMatch = PARAM_DEFAULT_RE.exec(params)) !== null) {
      issues.push({
        type: "gzdoom-zscript-default-param",
        severity,
        filePath,
        line: i + 1,
        count: 1,
        description: `Function "${head[1]}" uses default parameter "${paramMatch[1]}" — GZDoom ZScript rejects default argument values`,
        recommendedAction:
          "Remove the default value and assign inside the function body, or use overloads",
        affectedFiles: [filePath],
        metadata: {
          engine: "gzdoom-zscript-lint",
          function: head[1],
          parameter: paramMatch[1],
        },
      });
    }
  }
  return issues;
}

/**
 * @param {string} modPath
 * @param {{ignoreGlobs?:string[],severity?:string,respectIncludes?:boolean}} [options]
 */
async function lintGzdoomZscript(modPath, options = {}) {
  const opts = options || {};
  const severity = opts.severity || "high";
  const ignoreGlobs = opts.ignoreGlobs || [];
  const root = path.resolve(modPath);
  const allFiles = await collectGzdoomFiles(root, { ignoreGlobs });
  let scanFiles = allFiles.filter(
    (f) => f.kind === "source" && /\.(zs|zscript)$/i.test(f.relativePath),
  );

  if (opts.respectIncludes !== false) {
    const resolved = resolveReachableGzdoomFiles(root, allFiles);
    scanFiles = scanFiles.filter((f) => resolved.reachable.has(f.relativePath));
  }

  const issues = [];
  for (const file of scanFiles) {
    let content;
    try {
      const stat = fs.statSync(file.path);
      if (stat.size > 256 * 1024) continue;
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    issues.push(...lintDefaultParameters(content, file.relativePath, severity));
  }

  return { scanned: scanFiles.length, findings: issues.length, issues };
}

module.exports = {
  lintGzdoomZscript,
  lintDefaultParameters,
};
