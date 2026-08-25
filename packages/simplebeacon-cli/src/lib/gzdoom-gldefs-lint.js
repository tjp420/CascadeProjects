/**
 * GLDEFS brightmap/glow path validation + TEXTURES.txt patch file checks.
 */

const fs = require("fs");
const path = require("path");
const { globMatch } = require("../rules/production-leak");

const GLDEFS_MAP_RE = /\bmap\s+"([^"]+)"/gi;
const GLDEFS_TEXTURE_RE =
  /\b(?:brightmap|glow|material)\s+(?:texture\s+)?"([^"]+)"/gi;
const TEXTURE_PATCH_RE = /patch\s+"([^"]+)"/gi;
const TEXTURE_NAME_RE = /^\s*texture\s+([A-Za-z0-9_]+)/gim;
const VOXELDEF_ENTRY_RE = /^\s*([A-Z]{4}[A-Z]?)\s*=\s*"([^"]+)"/gm;

function normalizeRel(baseDir, filePath) {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function collectGldefsLumpFiles(root, ignoreGlobs = []) {
  const files = [];
  const skipDirs = new Set([
    "node_modules",
    ".git",
    "coverage",
    "dist",
    "build",
    ".simplebeacon",
    "github-cache",
    "archive",
    "tools",
    "Docs",
    "build_temp",
    "Backup",
  ]);
  function walk(dir, depth) {
    if (depth > 10 || files.length > 500) return;
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
        if (skipDirs.has(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const isGl = isGldefsFile(entry.name);
      const isTex = lower === "textures.txt" || lower.endsWith("/textures.txt");
      const isVox = lower === "voxeldef" || lower.startsWith("voxeldef");
      const isSprite =
        /\.(png|jpg|jpeg|webp)$/i.test(lower) &&
        (rel.includes("/sprites/") || rel.startsWith("sprites/"));
      if (isGl || isTex || isVox)
        files.push({
          path: full,
          relativePath: rel,
          name: entry.name,
          kind: "lump",
        });
      else if (isSprite)
        files.push({
          path: full,
          relativePath: rel,
          name: entry.name,
          kind: "sprite",
        });
    }
  }
  walk(path.resolve(root), 0);
  return files;
}

function isGldefsFile(name) {
  const lower = String(name || "").toLowerCase();
  return (
    lower === "gldefs" ||
    lower.startsWith("gldefs_") ||
    lower.endsWith("gldefs.txt")
  );
}

function fileExistsAt(root, ref) {
  const normalized = String(ref || "").replace(/\\/g, "/");
  const candidates = [
    path.join(root, normalized),
    path.join(root, normalized.replace(/^\//, "")),
  ];
  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return true;
    } catch {
      /* skip */
    }
  }
  return false;
}

function spriteNameFromAsset(relativePath) {
  const base = path.basename(relativePath, path.extname(relativePath));
  return base.slice(0, 4).toUpperCase().padEnd(4, " ").trim().slice(0, 4);
}

/**
 * @param {string} modPath
 * @param {{ignoreGlobs?:string[],severity?:string}} [options]
 */
async function lintGzdoomGldefs(modPath, options = {}) {
  const opts = options || {};
  const severity = opts.severity || "medium";
  const ignoreGlobs = opts.ignoreGlobs || [];
  const root = path.resolve(modPath);
  const allFiles = collectGldefsLumpFiles(root, ignoreGlobs);

  const spriteNames = new Set();
  const textureNames = new Set();
  const issues = [];
  const reported = new Set();
  for (const file of allFiles) {
    if (file.kind === "sprite") {
      spriteNames.add(spriteNameFromAsset(file.relativePath));
      continue;
    }
    if (file.kind !== "lump") continue;
    const lower = file.name.toLowerCase();
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }

    if (lower === "textures.txt" || lower.endsWith("/textures.txt")) {
      let match;
      TEXTURE_NAME_RE.lastIndex = 0;
      while ((match = TEXTURE_NAME_RE.exec(content)) !== null) {
        textureNames.add(match[1]);
      }
      TEXTURE_PATCH_RE.lastIndex = 0;
      while ((match = TEXTURE_PATCH_RE.exec(content)) !== null) {
        const patch = match[1];
        const key = `patch:${patch}`;
        if (reported.has(key)) continue;
        if (fileExistsAt(root, patch)) continue;
        reported.add(key);
        issues.push({
          type: "gzdoom-texture-missing-patch",
          severity,
          filePath: file.relativePath,
          line: content.slice(0, match.index).split("\n").length,
          count: 1,
          description: `TEXTURES.txt patch "${patch}" has no matching file on disk`,
          recommendedAction:
            "Add the PNG patch file or fix the path in TEXTURES.txt",
          affectedFiles: [file.relativePath],
          metadata: { engine: "gzdoom-gldefs-lint", path: patch },
        });
      }
    }

    if (isGldefsFile(file.name)) {
      for (const re of [GLDEFS_MAP_RE, GLDEFS_TEXTURE_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
          const assetPath = match[1];
          const key = `gldefs:${assetPath}`;
          if (reported.has(key)) continue;
          if (fileExistsAt(root, assetPath)) continue;
          reported.add(key);
          issues.push({
            type: "gzdoom-gldefs-missing-asset",
            severity,
            filePath: file.relativePath,
            line: content.slice(0, match.index).split("\n").length,
            count: 1,
            description: `GLDEFS references missing asset "${assetPath}"`,
            recommendedAction:
              "Add the texture/brightmap file or remove the GLDEFS entry",
            affectedFiles: [file.relativePath],
            metadata: { engine: "gzdoom-gldefs-lint", path: assetPath },
          });
        }
      }
    }

    if (lower === "voxeldef" || lower.startsWith("voxeldef")) {
      let match;
      VOXELDEF_ENTRY_RE.lastIndex = 0;
      while ((match = VOXELDEF_ENTRY_RE.exec(content)) !== null) {
        const sprite = match[1].slice(0, 4);
        const kvxPath = match[2];
        const key = `voxel:${kvxPath}`;
        if (reported.has(key)) continue;
        if (!fileExistsAt(root, kvxPath)) {
          reported.add(key);
          issues.push({
            type: "gzdoom-voxeldef-missing-file",
            severity,
            filePath: file.relativePath,
            line: content.slice(0, match.index).split("\n").length,
            count: 1,
            description: `VOXELDEF "${match[1]}" points to missing file "${kvxPath}"`,
            recommendedAction:
              "Add the .kvx file or comment out the VOXELDEF entry",
            affectedFiles: [file.relativePath],
            metadata: { engine: "gzdoom-gldefs-lint", sprite, path: kvxPath },
          });
        }
        if (spriteNames.size && !spriteNames.has(sprite.trim())) {
          const skey = `voxelsprite:${sprite}`;
          if (!reported.has(skey)) {
            reported.add(skey);
            issues.push({
              type: "gzdoom-voxeldef-missing-sprite",
              severity: "low",
              filePath: file.relativePath,
              line: content.slice(0, match.index).split("\n").length,
              count: 1,
              description: `VOXELDEF sprite prefix "${sprite}" has no matching sprite PNG in sprites/`,
              recommendedAction:
                "Add sprite lump or verify the 4-char sprite name",
              affectedFiles: [file.relativePath],
              metadata: { engine: "gzdoom-gldefs-lint", sprite },
            });
          }
        }
      }
    }
  }

  return {
    scanned: allFiles.length,
    textureNames: textureNames.size,
    spriteNames: spriteNames.size,
    findings: issues.length,
    issues,
  };
}

module.exports = {
  lintGzdoomGldefs,
  fileExistsAt,
  isGldefsFile,
};
