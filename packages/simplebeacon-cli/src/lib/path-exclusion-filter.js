/**
 * Safely determines if a file path should be excluded based on configuration rules.
 * Replaces project-specific hardcoded strings with a clean dynamic match.
 * @param {string} filePath - The absolute or relative file path being evaluated.
 * @param {Array<string>} userExclusions - Custom exclusion tokens passed from config.
 * @returns {boolean} True if the path should be skipped.
 */

const fs = require("fs");
const path = require("path");

function findConfigUpwards(startDir) {
  let current = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    const configPath = path.join(current, ".simplebeacon", "config.json");
    if (fs.existsSync(configPath)) return configPath;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function loadConfigExclusions() {
  try {
    const configPath =
      findConfigUpwards(process.cwd()) || findConfigUpwards(__dirname);
    if (!configPath || !fs.existsSync(configPath)) return [];
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return Array.isArray(config.ignore) ? config.ignore : [];
  } catch {
    return [];
  }
}

let _cachedExclusions = null;
function getConfigExclusions() {
  if (_cachedExclusions === null) {
    _cachedExclusions = loadConfigExclusions();
  }
  return _cachedExclusions;
}

function clearConfigExclusionsCache() {
  _cachedExclusions = null;
}

function shouldExcludePath(filePath, userExclusions = []) {
  // 1. Core global defaults to prevent scanning system noise
  const globalDefaults = [
    "node_modules",
    ".git",
    "coverage",
    "dist",
    "build",
    "archive",
    "github-cache",
    "deliverables",
  ];

  // 2. Load config exclusions from .simplebeacon/config.json
  const configExclusions = getConfigExclusions();

  // 3. Combine defaults with any custom exclusions
  const activeExclusions = [
    ...globalDefaults,
    ...configExclusions,
    ...userExclusions,
  ];

  // 4. Perform a clean token match (case-insensitive)
  const normalizedPath = filePath.toLowerCase();
  return activeExclusions.some((pattern) => {
    const pat = pattern.toLowerCase().replace(/\*\*/g, "").replace(/\*/g, "");
    return normalizedPath.includes(pat);
  });
}

module.exports = { shouldExcludePath, clearConfigExclusionsCache };
