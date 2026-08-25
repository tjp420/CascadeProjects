/**
 * GZDoom ZScript state-sequence lint — death-frame reuse and related domain rules.
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");
const { collectGzdoomFiles } = require("./gzdoom-symbol-graph");
const { resolveReachableGzdoomFiles } = require("./gzdoom-include-resolver");

const DEATH_LABELS = new Set(["death", "xdeath"]);
const COMBAT_LABELS = new Set(["missile", "melee", "pain"]);
const AMBIENT_LABELS = new Set([
  "spawn",
  "see",
  "heal",
  "crash",
  "idle",
  "wound",
]);
const EXCLUDED_LABELS = new Set(["raise"]);

const FRAME_LINE_RE = /^\s*([A-Z][A-Z0-9]{2,5})\s+([A-Z]+)\s+(-?\d+)/;
const STATE_LABEL_RE = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*$/;
const _CLASS_BEFORE_STATES_RE =
  /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^\{]*)?\{/g;

function _normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function classNameBeforeIndex(content, index) {
  const slice = content.slice(0, index);
  let last = "Unknown";
  let match;
  const re = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^\{]*)?\{/g;
  while ((match = re.exec(slice)) !== null) {
    last = match[1];
  }
  return last;
}

/**
 * Extract States { ... } blocks from ZScript content.
 * @returns {Array<{className:string,startLine:number,body:string}>}
 */
function extractStatesBlocks(content) {
  const blocks = [];
  const re = /\bStates\s*\{/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const openBrace = content.indexOf("{", match.index);
    if (openBrace < 0) continue;
    let depth = 0;
    let end = openBrace;
    for (let i = openBrace; i < content.length; i++) {
      const ch = content[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const body = content.slice(openBrace + 1, end - 1);
    blocks.push({
      className: classNameBeforeIndex(content, match.index),
      startLine: content.slice(0, match.index).split("\n").length,
      body,
    });
  }
  return blocks;
}

/**
 * Parse a States body into labeled frame sequences.
 * @returns {Map<string, Array<{sprite:string,frame:string,line:number}>>}
 */
function parseStateFrames(statesBody, lineOffset = 0) {
  /** @type {Map<string, Array<{sprite:string,frame:string,line:number}>>} */
  const byLabel = new Map();
  let currentLabel = null;
  const lines = statesBody.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (/^\}/.test(trimmed)) continue;

    const labelMatch = STATE_LABEL_RE.exec(raw);
    if (labelMatch) {
      currentLabel = labelMatch[1];
      if (!byLabel.has(currentLabel)) byLabel.set(currentLabel, []);
      continue;
    }

    if (!currentLabel) continue;

    const frameMatch = FRAME_LINE_RE.exec(raw);
    if (!frameMatch) continue;

    const sprite = frameMatch[1];
    const frameLetters = frameMatch[2];
    const line = lineOffset + i + 1;
    const entries = byLabel.get(currentLabel);
    for (const frame of frameLetters.split("")) {
      entries.push({ sprite, frame, line });
    }
  }

  return byLabel;
}

function frameKey(sprite, frame) {
  return `${sprite}:${frame}`;
}

/**
 * Determine if a class name indicates a 3D model or voxel variant.
 * Sprite-only variants intentionally reuse vanilla death frames (vanilla behavior),
 * so death-frame reuse is only a real problem for 3D model/voxel rendering where
 * the model can't switch poses mid-animation the way sprites can.
 *
 * @param {string} className
 * @returns {boolean}
 */
function is3DVariantClass(className) {
  const name = String(className || "");
  // Match patterns like: Pure3D..., PureVoxel..., ...Model..., ...Voxel...
  // but NOT ...Sprite... or ...RenderParity... (sprite-only)
  return (
    /(?:^|_)(?:Pure3D|PureVoxel|Model|Voxel)(?:_|$|[A-Z])/i.test(name) ||
    /\b(?:3DModel|VoxelVariant|ModelVariant)\b/i.test(name) ||
    /(?:Model|Voxel)\d*$/i.test(name)
  );
}

/**
 * Find death-frame reuse within one States block.
 * @returns {Array<Object>}
 */
function lintStatesBlock(
  className,
  relativePath,
  statesBody,
  startLine,
  severity,
) {
  const issues = [];
  // Only flag death-frame reuse for 3D model/voxel variant classes.
  // Sprite-only variants intentionally reuse vanilla death frames.
  if (!is3DVariantClass(className)) return issues;

  const byLabel = parseStateFrames(statesBody, startLine);

  /** @type {Map<string, {label:string,line:number}[]>} */
  const frameIndex = new Map();

  for (const [label, frames] of byLabel.entries()) {
    const norm = label.toLowerCase();
    if (EXCLUDED_LABELS.has(norm)) continue;
    for (const { sprite, frame, line } of frames) {
      const key = frameKey(sprite, frame);
      if (!frameIndex.has(key)) frameIndex.set(key, []);
      frameIndex.get(key).push({ label, line });
    }
  }

  const reported = new Set();

  for (const [label, frames] of byLabel.entries()) {
    const norm = label.toLowerCase();
    if (!DEATH_LABELS.has(norm)) continue;

    for (const { sprite, frame, line } of frames) {
      const key = frameKey(sprite, frame);
      const allUses = frameIndex.get(key) || [];
      const others = allUses.filter((u) => {
        const ln = u.label.toLowerCase();
        return (
          !DEATH_LABELS.has(ln) &&
          (COMBAT_LABELS.has(ln) || AMBIENT_LABELS.has(ln))
        );
      });
      if (!others.length) continue;

      for (const other of others) {
        const otherNorm = other.label.toLowerCase();
        const issueSeverity = COMBAT_LABELS.has(otherNorm)
          ? severity
          : "medium";
        const dedupe = `${relativePath}|${className}|${sprite}|${frame}|${norm}|${other.label.toLowerCase()}`;
        if (reported.has(dedupe)) continue;
        reported.add(dedupe);

        issues.push({
          type: "gzdoom-death-frame-reuse",
          severity: issueSeverity,
          filePath: relativePath,
          line,
          count: 1,
          description:
            `Frame ${sprite} ${frame} appears in both ${label} and ${other.label} states` +
            " — 3D model may render corpse in attack pose",
          recommendedAction: `Use disjoint sprite frames for ${other.label} vs ${label} in class ${className}`,
          affectedFiles: [relativePath],
          metadata: {
            engine: "gzdoom-state-lint",
            patternId: "gzdoom-death-frame-reuse",
            className,
            sprite,
            frame,
            deathState: label,
            otherState: other.label,
            otherLine: other.line,
          },
        });
      }
    }
  }

  return issues;
}

/**
 * Lint one ZScript file for death-frame reuse.
 * @param {string} content
 * @param {string} relativePath
 * @param {{severity?:string}} [options]
 */
function lintZScriptDeathFrameReuse(content, relativePath, options = {}) {
  const severity = options.severity || "high";
  const issues = [];
  for (const block of extractStatesBlocks(content)) {
    issues.push(
      ...lintStatesBlock(
        block.className,
        relativePath,
        block.body,
        block.startLine,
        severity,
      ),
    );
  }
  return issues;
}

/**
 * Walk mod tree and lint reachable .zs files.
 * @param {string} baseDir
 * @param {{ignoreGlobs?:string[],respectIncludes?:boolean,severity?:string,sourcePaths?:string[]}} [options]
 */
async function lintGzdoomDeathFrameReuse(baseDir, options = {}) {
  const root = path.resolve(baseDir);
  const ignoreGlobs = Array.isArray(options.ignoreGlobs)
    ? options.ignoreGlobs
    : [];
  const severity = options.severity || "high";
  const respectIncludes = options.respectIncludes !== false;

  const files = await collectGzdoomFiles(root, { ignoreGlobs });
  let zsFiles = files.filter(
    (f) =>
      f.kind === "source" &&
      (/\.zs$/i.test(f.relativePath) || /\.zscript$/i.test(f.relativePath)),
  );

  if (respectIncludes) {
    const { reachable } = resolveReachableGzdoomFiles(root, files);
    zsFiles = zsFiles.filter((f) => reachable.has(f.relativePath));
  }

  const issues = [];
  for (const file of zsFiles) {
    if (ignoreGlobs.some((g) => globMatch(file.relativePath, g))) continue;
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    issues.push(
      ...lintZScriptDeathFrameReuse(content, file.relativePath, { severity }),
    );
  }

  return {
    scanned: zsFiles.length,
    findings: issues.length,
    issues,
  };
}

module.exports = {
  DEATH_LABELS,
  COMBAT_LABELS,
  AMBIENT_LABELS,
  EXCLUDED_LABELS,
  is3DVariantClass,
  extractStatesBlocks,
  parseStateFrames,
  lintStatesBlock,
  lintZScriptDeathFrameReuse,
  lintGzdoomDeathFrameReuse,
};
