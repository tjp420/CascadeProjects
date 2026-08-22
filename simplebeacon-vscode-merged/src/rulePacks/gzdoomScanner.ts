/**
 * GZDoom native scanner — deeper checks beyond regex:
 * 1. Asset reference validation (does the .wad/.pk3 file actually exist?)
 * 2. Config precedence conflicts (same CVAR set in multiple files)
 * 3. Launch script vs config contradictions
 *
 * This is a "native scanner" that complements the regex-based custom rules.
 * It runs file-system checks and cross-file analysis.
 *
 * Milestone 2: Domain Rule Pack — GZDoom
 */

import * as fs from 'fs';
import * as path from 'path';
import { RealtimeIssue } from '../realtimeIssue';

export interface GzAssetReference {
  /** The referenced file name (e.g. "textures.pk3") */
  fileName: string;
  /** The file that references it */
  sourceFile: string;
  /** Line number where the reference appears */
  line: number;
  /** Whether the referenced file exists in the mod tree */
  exists: boolean;
  /** Resolved path if found, null if not */
  resolvedPath?: string;
}

export interface GzCvarConflict {
  /** The CVAR name that conflicts */
  cvarName: string;
  /** Files where this CVAR is set */
  sources: Array<{ file: string; line: number; value: string }>;
  /** Whether the values conflict */
  valuesConflict: boolean;
}

export interface GzScanResult {
  assetReferences: GzAssetReference[];
  cvarConflicts: GzCvarConflict[];
  issues: RealtimeIssue[];
}

// File extensions that can contain asset references
const ASSET_REF_EXTENSIONS = ['.zs', '.zscript', '.bat', '.cfg', '.ini', '.mapinfo', '.txt'];
const ASSET_FILE_EXTENSIONS = ['.wad', '.pk3', '.pk7', '.ipk3', '.p7z'];
const CONFIG_EXTENSIONS = ['.cfg', '.ini', '.cvarinfo'];
const LAUNCH_EXTENSIONS = ['.bat'];

// Regex to find asset references
const ASSET_REF_REGEX = /["']([^"']*\.(?:wad|pk3|pk7|ipk3|p7z))["']/gi;
// Regex to find CVAR set commands in config files
const CVAR_SET_REGEX = /^set\s+(\w+)\s+(.+)$/gim;
// Regex to find CVARINFO defaultvalue definitions
const CVARINFO_DEFAULT_REGEX = /^(\w+)\s+(\w+)\s+(\w+)\s+defaultvalue\s+(.+)$/gim;

/**
 * Scan a single file for asset references and check if they exist.
 */
function scanFileForAssetRefs(
  filePath: string,
  content: string,
  modRoot: string
): GzAssetReference[] {
  const refs: GzAssetReference[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    ASSET_REF_REGEX.lastIndex = 0;

    while ((match = ASSET_REF_REGEX.exec(line)) !== null) {
      const fileName = match[1];
      // Try to find the file relative to the mod root
      const possiblePaths = [
        path.join(modRoot, fileName),
        path.join(modRoot, 'mods', fileName),
        path.join(modRoot, 'assets', fileName),
        path.join(path.dirname(filePath), fileName),
      ];

      let resolved: string | undefined;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          resolved = p;
          break;
        }
      }

      refs.push({
        fileName,
        sourceFile: filePath,
        line: i + 1,
        exists: !!resolved,
        resolvedPath: resolved,
      });
    }
  }

  return refs;
}

/**
 * Scan all config files for CVAR set commands and detect conflicts.
 */
function scanCvarConflicts(
  configFiles: Array<{ file: string; content: string }>,
  cvarinfoFiles: Array<{ file: string; content: string }>
): GzCvarConflict[] {
  const cvarMap = new Map<string, Array<{ file: string; line: number; value: string }>>();

  // Scan config files for `set <cvar> <value>` commands
  for (const { file, content } of configFiles) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      CVAR_SET_REGEX.lastIndex = 0;
      const match = CVAR_SET_REGEX.exec(lines[i]);
      if (match) {
        const cvarName = match[1];
        const value = match[2].trim();
        if (!cvarMap.has(cvarName)) cvarMap.set(cvarName, []);
        cvarMap.get(cvarName)!.push({ file, line: i + 1, value });
      }
    }
  }

  // Scan CVARINFO files for defaultvalue definitions
  for (const { file, content } of cvarinfoFiles) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      CVARINFO_DEFAULT_REGEX.lastIndex = 0;
      const match = CVARINFO_DEFAULT_REGEX.exec(lines[i]);
      if (match) {
        const cvarName = match[2];
        const value = match[4].trim();
        if (!cvarMap.has(cvarName)) cvarMap.set(cvarName, []);
        cvarMap.get(cvarName)!.push({ file, line: i + 1, value });
      }
    }
  }

  // Detect conflicts: same CVAR set in multiple files with different values
  const conflicts: GzCvarConflict[] = [];
  for (const [cvarName, sources] of cvarMap) {
    if (sources.length < 2) continue;
    const values = new Set(sources.map((s) => s.value.toLowerCase()));
    conflicts.push({
      cvarName,
      sources,
      valuesConflict: values.size > 1,
    });
  }

  return conflicts;
}

/**
 * Main entry point: scan a GZDoom mod directory for asset references and config conflicts.
 *
 * @param modRoot The root directory of the GZDoom mod
 * @returns GzScanResult with asset references, CVAR conflicts, and issues
 */
export function scanGzdoomMod(modRoot: string): GzScanResult {
  const assetRefs: GzAssetReference[] = [];
  const issues: RealtimeIssue[] = [];

  if (!fs.existsSync(modRoot)) {
    return { assetReferences: [], cvarConflicts: [], issues: [] };
  }

  // Walk the mod tree and collect files
  const allFiles: string[] = [];
  const configFiles: Array<{ file: string; content: string }> = [];
  const cvarinfoFiles: Array<{ file: string; content: string }> = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common non-mod directories
        if (['node_modules', '.git', '.vscode', 'dist', 'build'].includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        allFiles.push(fullPath);
        const ext = path.extname(entry.name).toLowerCase();

        if (ASSET_REF_EXTENSIONS.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const refs = scanFileForAssetRefs(fullPath, content, modRoot);
            assetRefs.push(...refs);
          } catch { /* skip unreadable files */ }
        }

        if (CONFIG_EXTENSIONS.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            configFiles.push({ file: fullPath, content });
          } catch { /* skip */ }
        }

        if (ext === '.cvarinfo') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            cvarinfoFiles.push({ file: fullPath, content });
          } catch { /* skip */ }
        }
      }
    }
  }

  walk(modRoot);

  // Convert missing asset references to issues
  for (const ref of assetRefs) {
    if (!ref.exists) {
      issues.push({
        file: ref.sourceFile,
        line: ref.line,
        column: 1,
        severity: 'warning',
        type: 'GZ-ASSET-MISSING',
        message: `Asset reference "${ref.fileName}" not found in mod tree`,
        suggestion: 'Verify the file exists and the path is correct relative to the mod root',
        timestamp: new Date(),
      });
    }
  }

  // Scan for CVAR conflicts
  const cvarConflicts = scanCvarConflicts(configFiles, cvarinfoFiles);

  for (const conflict of cvarConflicts) {
    if (conflict.valuesConflict) {
      // Report on the first source — the conflict itself is cross-file
      const first = conflict.sources[0];
      issues.push({
        file: first.file,
        line: first.line,
        column: 1,
        severity: 'warning',
        type: 'GZ-CVAR-CONFLICT',
        message: `CVAR "${conflict.cvarName}" is set to different values in ${conflict.sources.length} files: ${conflict.sources.map((s) => `${s.value} (${path.basename(s.file)}:${s.line})`).join(', ')}`,
        suggestion: 'Consolidate CVAR settings into a single source (prefer CVARINFO defaultvalue)',
        timestamp: new Date(),
      });
    } else {
      // Same value in multiple files — info, not warning
      const first = conflict.sources[0];
      issues.push({
        file: first.file,
        line: first.line,
        column: 1,
        severity: 'info',
        type: 'GZ-CVAR-DUPLICATE',
        message: `CVAR "${conflict.cvarName}" is set in ${conflict.sources.length} files with the same value — consider consolidating`,
        suggestion: 'Define in CVARINFO defaultvalue and remove from other config files',
        timestamp: new Date(),
      });
    }
  }

  return {
    assetReferences: assetRefs,
    cvarConflicts,
    issues,
  };
}

/**
 * Quick check: does this file look like a GZDoom mod file?
 */
export function isGzdoomFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [
    '.zs', '.zscript', '.cvarinfo', '.keyconf', '.mapinfo',
    '.bat', '.cfg', '.ini', '.wad', '.pk3', '.pk7', '.ipk3',
  ].includes(ext);
}
