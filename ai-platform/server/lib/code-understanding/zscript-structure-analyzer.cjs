// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * ZScript structure extraction — classes, inheritance, functions, includes.
 */

const fs = require("fs");
const path = require("path");
const {
  readTextFileWithLimit,
  redactTextSecrets,
} = require("../recoverable-io.cjs");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache"]);

/**
 * Collect zscript files.
 * @param {string} rootDir
 * @param {Object} options
 * @returns {any}
 */
async function collectZscriptFiles(rootDir, options = {}) {
  const maxFiles = options.maxFiles ?? 600;
  const maxBytes = options.maxBytes ?? 256000;
  const results = [];

  /**
   * Walk.
   * @param {string} dir
   * @param {any} depth
   * @returns {any}
   */
  async function walk(dir, depth = 0) {
    if (results.length >= maxFiles || depth > 16) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext !== ".zs" && ext !== ".zscript") continue;

      try {
        const stat = await fs.promises.stat(full);
        if (stat.size > maxBytes) {
          results.push({
            path: full,
            relativePath: path.relative(rootDir, full).replace(/\\/g, "/"),
            content: "",
            truncated: true,
            size: stat.size,
          });
          continue;
        }
        const raw = await readTextFileWithLimit(full, maxBytes);
        if (!raw) {
          results.push({
            path: full,
            relativePath: path.relative(rootDir, full).replace(/\\/g, "/"),
            content: "",
            truncated: true,
            size: stat.size,
          });
          continue;
        }
        const content = redactTextSecrets(raw);
        results.push({
          path: full,
          relativePath: path.relative(rootDir, full).replace(/\\/g, "/"),
          content,
          truncated: false,
          size: stat.size,
        });
      } catch {
        /* skip */
      }
    }
  }

  await walk(path.resolve(rootDir));
  return results;
}

const { ZScriptParser } = require("../parsers/zscript-parser.cjs");
const zscriptParser = new ZScriptParser();

/**
 * Parse zscript file.
 * @param {any} content
 * @param {string} relativePath
 * @returns {any}
 */
function parseZscriptFile(content, relativePath) {
  const parsed = zscriptParser.parse(content, { filePath: relativePath });
  const legacy = {
    relativePath,
    classes: (parsed.classes || []).map((c) => ({
      name: c.name,
      parentClass: c.parentClass,
      keyFunctions: c.methods || [],
      hasStatesBlock: c.hasStatesBlock,
    })),
    parentClasses: [
      ...new Set((parsed.classes || []).map((c) => c.parentClass)),
    ],
    keyFunctions: (parsed.classes || [])
      .flatMap((c) => c.methods || [])
      .slice(0, 30),
    dependencies: parsed.ast?.includes || [],
    purpose:
      parsed.summary?.purpose ||
      inferPurpose(relativePath, parsed.classes || []),
    parserSummary: parsed.summary,
    gzdoomAPI: parsed.gzdoomAPI || [],
  };
  return legacy;
}

/**
 *  extract methods.
 * @param {any} content
 * @returns {any}
 */
function _extractMethods(content) {
  const names = [];
  const re =
    /\b(?:override\s+)?(?:static\s+)?(?:void|bool|int|float|double|string|color|Vector2|Vector3|State|Actor|EventHandler)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    if (["if", "for", "while", "switch"].includes(name)) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Infer purpose.
 * @param {string} relativePath
 * @param {Array} classes
 * @returns {any}
 */
function inferPurpose(relativePath, classes) {
  const rel = relativePath.toLowerCase();
  if (rel.includes("/lights/")) return "Light actor or lighting behavior";
  if (rel.includes("handler") || rel.includes("system"))
    return "Event handler / system coordinator";
  if (rel.includes("util") || rel.includes("helper"))
    return "Shared helper utilities";
  if (rel.includes("debug")) return "Debug/diagnostic tooling";
  if (classes.some((c) => /Light/i.test(c.name)))
    return "Dynamic or actor-attached lighting";
  if (classes.some((c) => c.parentClass === "EventHandler"))
    return "GZDoom event handler registration";
  return "ZScript module";
}

/**
 * Build class hierarchy.
 * @param {Array} zscriptFiles
 * @returns {any}
 */
function buildClassHierarchy(zscriptFiles) {
  const nodes = new Map();
  for (const file of zscriptFiles) {
    const parsed = parseZscriptFile(file.content, file.relativePath);
    for (const cls of parsed.classes) {
      if (!nodes.has(cls.name)) {
        nodes.set(cls.name, {
          className: cls.name,
          parentClass: cls.parentClass,
          definedIn: file.relativePath,
          children: [],
        });
      } else {
        const node = nodes.get(cls.name);
        node.definedIn = node.definedIn || file.relativePath;
        node.parentClass = node.parentClass || cls.parentClass;
      }
    }
  }

  for (const node of nodes.values()) {
    const parent = nodes.get(node.parentClass);
    if (parent && parent.className !== node.className) {
      parent.children.push(node.className);
    }
  }

  return {
    classCount: nodes.size,
    roots: [...nodes.values()]
      .filter((n) => !nodes.has(n.parentClass) || n.parentClass === "Object")
      .map((n) => n.className),
    nodes: Object.fromEntries(
      [...nodes.entries()].map(([k, v]) => [
        k,
        {
          parentClass: v.parentClass,
          definedIn: v.definedIn,
          children: v.children,
        },
      ]),
    ),
  };
}

/**
 * Analyze function logic.
 * @param {Array} zscriptFiles
 * @returns {any}
 */
function analyzeFunctionLogic(zscriptFiles) {
  const analysis = {};
  const targets = [
    "UpdateCVARs",
    "UpdateDynamicLights",
    "GetIntensityCVAR",
    "AdjustBrightness",
    "CalculateLightIntensity",
    "WorldTick",
    "OnRegister",
  ];

  for (const file of zscriptFiles) {
    for (const fn of targets) {
      const re = new RegExp(
        `\\b(?:override\\s+)?(?:static\\s+)?(?:void|float|bool|int|double)[^{;]*\\b${fn}\\s*\\([^)]*\\)\\s*\\{`,
        "g",
      );
      const match = re.exec(file.content);
      if (!match) continue;

      const start = match.index;
      const block = extractBlock(file.content, start + match[0].length - 1);
      const steps = summarizeFunctionBlock(block, fn);

      analysis[`${path.basename(file.relativePath)}.${fn}`] = {
        filePath: file.relativePath,
        function: fn,
        purpose: describeFunctionPurpose(fn),
        currentLogic: steps,
        suspectedIssues: flagFunctionIssues(fn, block),
        dataFlow: inferDataFlow(fn, block),
      };
    }
  }

  return analysis;
}

/**
 * Extract block.
 * @param {any} content
 * @param {number} openBraceIndex
 * @returns {any}
 */
function extractBlock(content, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < content.length; i += 1) {
    if (content[i] === "{") depth += 1;
    if (content[i] === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(openBraceIndex, i + 1);
    }
  }
  return content.slice(openBraceIndex, openBraceIndex + 1200);
}

/**
 * Summarize function block.
 * @param {any} block
 * @param {Function} fnName
 * @returns {any}
 */
function summarizeFunctionBlock(block, fnName) {
  const steps = [];
  if (/FindCVar/.test(block))
    steps.push("Reads one or more CVARs via CVar.FindCVar");
  if (/GetFloat|GetBool|GetInt/.test(block))
    steps.push("Extracts typed value from CVAR object");
  if (/masterIntensity/.test(block))
    steps.push("Updates masterIntensity field from CVAR");
  if (/AdjustBrightness/.test(block))
    steps.push("Applies AdjustBrightness to color/intensity");
  if (/CalculateLightIntensity/.test(block))
    steps.push("Uses distance-based intensity falloff");
  if (/A_Light|DynamicLight|light/i.test(block))
    steps.push("Creates or updates dynamic light output");
  if (/return/.test(block) && fnName.startsWith("Get"))
    steps.push("Returns computed scalar to caller");
  if (!steps.length)
    steps.push(
      "Logic present — review block manually for rendering side effects",
    );
  return steps.slice(0, 8);
}

/**
 * Describe function purpose.
 * @param {Function} fn
 * @returns {any}
 */
function describeFunctionPurpose(fn) {
  const map = {
    UpdateCVARs: "Refresh runtime settings from CVAR values each tick",
    UpdateDynamicLights: "Maintain and update spawned dynamic lights",
    GetIntensityCVAR: "Read and clamp global intensity CVAR",
    AdjustBrightness: "Scale RGB channels by brightness factor",
    CalculateLightIntensity: "Compute falloff from distance and radius",
    WorldTick: "Per-tick handler — often drives CVAR refresh and light updates",
    OnRegister: "Initialization — loads initial CVAR defaults",
  };
  return map[fn] || "ZScript method";
}

/**
 * Flag function issues.
 * @param {Function} fn
 * @param {any} block
 * @returns {any}
 */
function flagFunctionIssues(fn, block) {
  const issues = [];
  if (
    fn === "UpdateCVARs" &&
    /FindCVar/.test(block) &&
    !/masterIntensity\s*=/.test(block) &&
    !/intensity/i.test(block)
  ) {
    issues.push(
      "CVARs read but intensity fields may not be reassigned in this function",
    );
  }
  if (
    /GetFloat\(\)/.test(block) &&
    !/\*|AdjustBrightness|CalculateLightIntensity|A_Light/.test(block)
  ) {
    issues.push(
      "CVAR float read without visible scaling/application in same function",
    );
  }
  if (/clamp\s*\([^)]+\)/.test(block) && /1500/.test(block)) {
    issues.push(
      "Intensity clamped to 0–1500 — small CVAR changes may be visually subtle after normalization",
    );
  }
  return issues;
}

/**
 * Infer data flow.
 * @param {Function} fn
 * @param {any} block
 * @returns {any}
 */
function inferDataFlow(fn, block) {
  const flow = [];
  if (/FindCVar/.test(block)) flow.push("CVAR");
  if (/masterIntensity|GetIntensityCVAR/.test(block))
    flow.push("masterIntensity");
  if (/AdjustBrightness|color/i.test(block)) flow.push("color");
  if (/A_Light|DynamicLight|light/i.test(block)) flow.push("renderedLight");
  if (!flow.length) return ["unknown"];
  return flow;
}

/**
 * Build structure report.
 * @param {string} rootDir
 * @param {Object} options
 * @returns {any}
 */
async function buildStructureReport(rootDir, options = {}) {
  const zscriptFiles = await collectZscriptFiles(rootDir, options);
  const zscript_files = {};

  for (const file of zscriptFiles) {
    if (file.truncated) {
      zscript_files[file.relativePath] = {
        truncated: true,
        size: file.size,
        purpose: inferPurpose(file.relativePath, []),
      };
      continue;
    }
    zscript_files[file.relativePath] = parseZscriptFile(
      file.content,
      file.relativePath,
    );
  }

  return {
    projectRoot: path.resolve(rootDir),
    filesScanned: zscriptFiles.length,
    truncatedFiles: zscriptFiles.filter((f) => f.truncated).length,
    zscript_files,
    classHierarchy: buildClassHierarchy(
      zscriptFiles.filter((f) => !f.truncated),
    ),
    function_analysis: analyzeFunctionLogic(
      zscriptFiles.filter((f) => !f.truncated),
    ),
    entryPoints: detectEntryPoints(zscript_files),
  };
}

/**
 * Detect entry points.
 * @param {string} zscriptFilesMap
 * @returns {any}
 */
function detectEntryPoints(zscriptFilesMap) {
  const entryPoints = [];
  for (const [rel, info] of Object.entries(zscriptFilesMap)) {
    for (const cls of info.classes || []) {
      if (cls.parentClass === "EventHandler" || /Handler$/i.test(cls.name)) {
        entryPoints.push({
          className: cls.name,
          filePath: rel,
          role: "EventHandler — registered at map load",
        });
      }
      if (/Light/i.test(cls.name) && cls.parentClass === "Actor") {
        entryPoints.push({
          className: cls.name,
          filePath: rel,
          role: "Light actor spawnable in world",
        });
      }
    }
  }
  return entryPoints.slice(0, 40);
}

module.exports = {
  collectZscriptFiles,
  parseZscriptFile,
  buildStructureReport,
};
