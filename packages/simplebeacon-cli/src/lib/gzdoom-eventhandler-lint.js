/**
 * EVENTHANDLERS / MAPINFO AddEventHandlers vs compiled EventHandler classes.
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");
const {
  collectGzdoomFiles: _collectGzdoomFiles,
} = require("./gzdoom-symbol-graph");
const { resolveReachableGzdoomFiles } = require("./gzdoom-include-resolver");

const EVENTHANDLER_CLASS_RE =
  /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:StaticEventHandler|EventHandler)\b/g;
const _MAPINFO_HANDLERS_RE =
  /AddEventHandlers\s*=\s*"([^"]+)"(?:\s*,\s*"([^"]+)")*/gi;
const QUOTED_NAME_RE = /"([A-Za-z_][A-Za-z0-9_]*)"/g;

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function parseEventHandlerRegistrations(content, filePath) {
  const names = [];
  const lines = String(content || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    if (/^addEventHandlers/i.test(line) || line === "{") continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(line);
    if (m)
      names.push({
        name: m[1],
        filePath,
        line: i + 1,
        source: "eventhandlers",
      });
  }
  return names;
}

function parseMapInfoHandlers(content, filePath) {
  const names = [];
  const re = /AddEventHandlers\s*=\s*([^;\n]+)/gi;
  let match;
  while ((match = re.exec(content)) !== null) {
    const block = match[1];
    QUOTED_NAME_RE.lastIndex = 0;
    let nameMatch;
    while ((nameMatch = QUOTED_NAME_RE.exec(block)) !== null) {
      names.push({
        name: nameMatch[1],
        filePath,
        line: content.slice(0, match.index).split("\n").length,
        source: "mapinfo",
      });
    }
  }
  return names;
}

function collectHandlerClasses(content, filePath) {
  const classes = [];
  let match;
  EVENTHANDLER_CLASS_RE.lastIndex = 0;
  while ((match = EVENTHANDLER_CLASS_RE.exec(content)) !== null) {
    classes.push({
      name: match[1],
      filePath,
      line: content.slice(0, match.index).split("\n").length,
    });
  }
  return classes;
}

function collectLintFiles(root, ignoreGlobs = []) {
  const files = [];
  const scanDirs = [path.join(root, "zscript"), root];
  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = normalizeRel(root, full);
      if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
      if (entry.isDirectory()) {
        if (
          /node_modules|\.git|tools|Docs|build_temp|Backup$/i.test(entry.name)
        )
          continue;
        walk(full, depth + 1);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (lower === "eventhandlers" || lower === "mapinfo") {
        files.push({ path: full, relativePath: rel, name: entry.name });
      }
    }
  }
  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) walk(dir, 0);
  }
  return files;
}

/**
 * @param {string} modPath
 * @param {{ignoreGlobs?:string[],severity?:string,respectIncludes?:boolean}} [options]
 */
async function lintGzdoomEventHandlers(modPath, options = {}) {
  const opts = options || {};
  const severity = opts.severity || "high";
  const ignoreGlobs = opts.ignoreGlobs || [];
  const root = path.resolve(modPath);

  const { collectGzdoomFiles } = require("./gzdoom-symbol-graph");
  const allFiles = await collectGzdoomFiles(root, { ignoreGlobs });
  const reachable =
    opts.respectIncludes !== false
      ? resolveReachableGzdoomFiles(root, allFiles).reachable
      : null;

  const registrations = [];
  const handlerClasses = new Map();

  for (const file of collectLintFiles(root, ignoreGlobs)) {
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    const lower = file.name.toLowerCase();
    if (lower === "eventhandlers")
      registrations.push(
        ...parseEventHandlerRegistrations(content, file.relativePath),
      );
    if (lower === "mapinfo")
      registrations.push(...parseMapInfoHandlers(content, file.relativePath));
  }

  for (const file of allFiles) {
    if (!/\.(zs|zscript)$/i.test(file.relativePath)) continue;
    if (reachable && !reachable.has(file.relativePath)) continue;
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    for (const cls of collectHandlerClasses(content, file.relativePath)) {
      if (!handlerClasses.has(cls.name)) handlerClasses.set(cls.name, cls);
    }
  }

  const issues = [];
  const seenReg = new Map();
  for (const reg of registrations) {
    const key = `${reg.source}:${reg.name}`;
    if (seenReg.has(key)) continue;
    seenReg.set(key, reg);
    if (handlerClasses.has(reg.name)) continue;
    issues.push({
      type: "gzdoom-eventhandler-unknown",
      severity,
      filePath: reg.filePath,
      line: reg.line,
      count: 1,
      description: `EventHandler "${reg.name}" registered in ${reg.source} but no matching compiled class extends EventHandler`,
      recommendedAction:
        "Include the handler ZScript in the manifest or remove the registration entry",
      affectedFiles: [reg.filePath],
      metadata: {
        engine: "gzdoom-eventhandler-lint",
        handler: reg.name,
        source: reg.source,
      },
    });
  }

  const regNames = new Set(registrations.map((r) => r.name));
  for (const [name, regList] of groupBy(registrations, (r) => r.name)) {
    const sources = [...new Set(regList.map((r) => r.source))];
    if (regList.length > 1 && sources.length > 1) {
      issues.push({
        type: "gzdoom-eventhandler-duplicate",
        severity: "medium",
        filePath: regList[0].filePath,
        line: regList[0].line,
        count: regList.length,
        description: `EventHandler "${name}" registered in both ${sources.join(" and ")}`,
        recommendedAction:
          "Register each handler in only one place (EVENTHANDLERS or MAPINFO AddEventHandlers)",
        affectedFiles: regList.map((r) => r.filePath),
        metadata: {
          engine: "gzdoom-eventhandler-lint",
          handler: name,
          sources,
        },
      });
    }
  }

  for (const [name, cls] of handlerClasses) {
    if (regNames.has(name)) continue;
    issues.push({
      type: "gzdoom-eventhandler-unregistered",
      severity: "low",
      filePath: cls.filePath,
      line: cls.line,
      count: 1,
      description: `EventHandler class "${name}" is compiled but not registered in EVENTHANDLERS or MAPINFO`,
      recommendedAction:
        "Add to EVENTHANDLERS or MAPINFO AddEventHandlers if it should run at runtime",
      affectedFiles: [cls.filePath],
      metadata: { engine: "gzdoom-eventhandler-lint", handler: name },
    });
  }

  return {
    scanned: handlerClasses.size,
    registrations: registrations.length,
    findings: issues.length,
    issues,
  };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

module.exports = {
  lintGzdoomEventHandlers,
  parseEventHandlerRegistrations,
  parseMapInfoHandlers,
  collectHandlerClasses,
};
