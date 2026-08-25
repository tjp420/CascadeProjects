/**
 * Cross-mod MODELDEF monster actors vs R3DLighting handler coverage.
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");
const { resolveCompanionPaths } = require("./gzdoom-cvar-lint");

const MODEL_BLOCK_RE = /^Model\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm;
const MODEL_CLASS_RE =
  /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([A-Za-z_][A-Za-z0-9_.]*))?/g;
const HANDLER_CLASS_LITERAL_RE =
  /GetClassName\(\)\s*==\s*"([A-Za-z_][A-Za-z0-9_]*)"|"([A-Za-z_][A-Za-z0-9_]*)"\s*==\s*\w+\.GetClassName\(\)/g;
const MONSTER_MODEL_CLASS_RE = /^(?:Pure3D|R3D.*Model|.*Voxel.*|.*Render)/i;

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function readConfigGzdoom(modPath) {
  const cfgPath = path.join(modPath, ".simplebeacon", "config.json");
  if (!fs.existsSync(cfgPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8")).gzdoom || {};
  } catch {
    return {};
  }
}

function monsterTokenFromClass(className) {
  const name = String(className || "");
  const stripped = name
    .replace(/^R3D/i, "")
    .replace(/^Pure3D/i, "")
    .replace(/^Pure2D/i, "")
    .replace(/^PureVoxel/i, "")
    .replace(/(Model|Sprite|Voxel|Render|Base|\d+)$/gi, "")
    .trim();
  if (stripped.length >= 4) return stripped;
  const m = name.match(
    /(Revenant|Imp|Arachnotron|Baron|Cacodemon|Cyberdemon|Mancubus|PainElemental|Archvile|Zombieman|ShotgunGuy|ChaingunGuy|Demon|Spectre|Lost|Soul|HellKnight)/i,
  );
  return m ? m[1] : name;
}

function collectModelActors(root, ignoreGlobs = []) {
  const actors = new Map();
  function walk(dir, depth) {
    if (depth > 12) return;
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
        if (/node_modules|\.git$/i.test(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (lower !== "modeldef" && !lower.startsWith("modeldef")) continue;
      let content;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      MODEL_BLOCK_RE.lastIndex = 0;
      let match;
      while ((match = MODEL_BLOCK_RE.exec(content)) !== null) {
        const actor = match[1];
        if (!actors.has(actor)) {
          actors.set(actor, {
            actor,
            filePath: rel,
            line: content.slice(0, match.index).split("\n").length,
          });
        }
      }
    }
  }
  walk(path.resolve(root), 0);
  return actors;
}

function collectMonsterClasses(root, ignoreGlobs = [], maxFiles = 400) {
  const classes = new Map();
  let scanned = 0;
  function walk(dir, depth) {
    if (depth > 12 || scanned >= maxFiles) return;
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
        if (/node_modules|\.git$/i.test(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!/\.(zs|zscript)$/i.test(entry.name)) continue;
      scanned++;
      let content;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      MODEL_CLASS_RE.lastIndex = 0;
      let match;
      while ((match = MODEL_CLASS_RE.exec(content)) !== null) {
        const cls = match[1];
        if (!MONSTER_MODEL_CLASS_RE.test(cls)) continue;
        if (!classes.has(cls)) {
          classes.set(cls, {
            className: cls,
            parent: match[2] || null,
            filePath: rel,
            line: content.slice(0, match.index).split("\n").length,
            token: monsterTokenFromClass(cls),
          });
        }
      }
    }
  }
  walk(path.resolve(root), 0);
  return classes;
}

function collectHandlerReferences(handlersRoot, ignoreGlobs = []) {
  const tokens = new Set();
  const classRefs = new Set();
  if (!fs.existsSync(handlersRoot)) return { tokens, classRefs };

  function walk(dir, depth) {
    if (depth > 10) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = normalizeRel(handlersRoot, full);
      if (ignoreGlobs.some((g) => globMatch(rel, g))) continue;
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!/\.(zs|zscript)$/i.test(entry.name)) continue;
      tokens.add(entry.name.replace(/\.(zs|zscript)$/i, "").toLowerCase());
      let content;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      HANDLER_CLASS_LITERAL_RE.lastIndex = 0;
      let match;
      while ((match = HANDLER_CLASS_LITERAL_RE.exec(content)) !== null) {
        classRefs.add(match[1] || match[2]);
      }
      const tokenMatches = content.match(
        /\b(Revenant|Imp|Arachnotron|Baron|Cacodemon|Cyberdemon|Mancubus|PainElemental|Archvile|Zombieman|ShotgunGuy|ChaingunGuy|Demon|Spectre|LostSoul|HellKnight)\b/gi,
      );
      if (tokenMatches) {
        for (const t of tokenMatches) tokens.add(t.toLowerCase());
      }
    }
  }
  walk(handlersRoot, 0);
  return { tokens, classRefs };
}

function hasHandlerCoverage(entry, handlerRefs) {
  if (handlerRefs.classRefs.has(entry.className || entry.actor)) return true;
  const token = (
    entry.token || monsterTokenFromClass(entry.className || entry.actor)
  ).toLowerCase();
  if (!token) return false;
  for (const t of handlerRefs.tokens) {
    if (t.includes(token) || token.includes(t)) return true;
  }
  return false;
}

/**
 * @param {string} modPath — lighting mod root (e.g. R3DLighting)
 * @param {{companionMod?:string,ignoreGlobs?:string[],severity?:string}} [options]
 */
async function lintGzdoomHandlerMap(modPath, options = {}) {
  const gzdoomCfg = readConfigGzdoom(modPath);
  const opts = { ...gzdoomCfg, ...options };
  const severity = opts.severity || "medium";
  const ignoreGlobs = opts.ignoreGlobs || [];
  const roots = resolveCompanionPaths(modPath, opts);
  const companionRoots = roots.filter(
    (r) => path.resolve(r) !== path.resolve(modPath),
  );

  const handlersRoot = path.join(modPath, "zscript", "handlers");
  const handlerRefs = collectHandlerReferences(handlersRoot, ignoreGlobs);

  const modelActors = new Map();
  const monsterClasses = new Map();
  for (const root of companionRoots.length ? companionRoots : roots) {
    const monsterRoot = fs.existsSync(path.join(root, "zscript", "monsters"))
      ? path.join(root, "zscript", "monsters")
      : path.join(root, "zscript");
    for (const [k, v] of collectModelActors(root, ignoreGlobs))
      modelActors.set(k, v);
    for (const [k, v] of collectMonsterClasses(monsterRoot, ignoreGlobs, 250))
      monsterClasses.set(k, v);
  }

  const issues = [];
  const checked = new Set();

  for (const entry of monsterClasses.values()) {
    const key = entry.token.toLowerCase();
    if (checked.has(key)) continue;
    checked.add(key);
    if (hasHandlerCoverage(entry, handlerRefs)) continue;
    issues.push({
      type: "gzdoom-handler-map-missing",
      severity,
      filePath: entry.filePath,
      line: entry.line,
      count: 1,
      description: `3D monster class "${entry.className}" (${entry.token}) has no matching reference in ${path.relative(modPath, handlersRoot).replace(/\\/g, "/")}/`,
      recommendedAction:
        "Add a death/light handler for this monster family or confirm generic R3DR00MDeathHandler covers it",
      affectedFiles: [entry.filePath],
      metadata: {
        engine: "gzdoom-handler-map-lint",
        className: entry.className,
        monsterToken: entry.token,
        companionMod: companionRoots[0] || null,
      },
    });
  }

  for (const entry of modelActors.values()) {
    if (monsterClasses.has(entry.actor)) continue;
    const token = monsterTokenFromClass(entry.actor);
    if (hasHandlerCoverage({ className: entry.actor, token }, handlerRefs))
      continue;
    if (
      !MONSTER_MODEL_CLASS_RE.test(entry.actor) &&
      !/(Revenant|Imp|Arach|Baron|Caco|Cyber|Manc|Pain|Arch|Zomb|Shotg|Chaing|Demon|Spectre|Lost|Hell)/i.test(
        entry.actor,
      )
    ) {
      continue;
    }
    issues.push({
      type: "gzdoom-handler-map-model-unlinked",
      severity: "low",
      filePath: entry.filePath,
      line: entry.line,
      count: 1,
      description: `MODELDEF actor "${entry.actor}" has no dedicated handler reference in R3DLighting handlers/`,
      recommendedAction:
        "Verify death lighting covers this MODELDEF actor or add a handler mapping",
      affectedFiles: [entry.filePath],
      metadata: {
        engine: "gzdoom-handler-map-lint",
        actor: entry.actor,
        monsterToken: token,
      },
    });
  }

  return {
    companionRoots,
    modelActors: modelActors.size,
    monsterClasses: monsterClasses.size,
    handlerTokens: handlerRefs.tokens.size,
    findings: issues.length,
    issues,
  };
}

module.exports = {
  lintGzdoomHandlerMap,
  monsterTokenFromClass,
  collectModelActors,
  collectMonsterClasses,
};
