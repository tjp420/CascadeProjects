"use strict";

/**
 * Auto-updater check for SimpleBeacon CLI.
 *
 * Non-blocking notification that prompts users when a new version
 * is published on npm. Respects --offline and --air-gapped modes.
 * Caches the check for 24 hours to avoid hitting npm on every run.
 *
 * Cache location: ~/.simplebeacon/update-check.json
 * Cache TTL: 24 hours (86400000 ms)
 * npm registry: https://registry.npmjs.org/simplebeacon/latest
 * Timeout: 3 seconds (never blocks scan execution)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NPM_REGISTRY_URL = "https://registry.npmjs.org/simplebeacon/latest";
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || process.cwd(),
  ".simplebeacon",
);
const CACHE_FILE = path.join(CACHE_DIR, "update-check.json");

/**
 * Get the current installed CLI version from package.json.
 * @returns {string|null}
 */
function getInstalledVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Read the cached update check result.
 * Returns null if cache is missing, expired, or corrupt.
 * @returns {Object|null}
 */
function readCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (data && typeof data === "object" && data.checkedAt) {
      const age = Date.now() - new Date(data.checkedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return data;
      }
    }
  } catch {
    // Cache miss / corrupt — fall through
  }
  return null;
}

/**
 * Write the update check result to cache.
 * @param {Object} data - { latestVersion, checkedAt }
 */
function writeCache(data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Non-blocking — cache write failure is silently ignored
  }
}

/**
 * Compare two semver versions (major.minor.patch).
 * Returns true if latest > installed.
 * @param {string} latest
 * @param {string} installed
 * @returns {boolean}
 */
function isNewerVersion(latest, installed) {
  const parseVer = (v) => {
    const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
    return m
      ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
      : [0, 0, 0];
  };
  const [a1, a2, a3] = parseVer(latest);
  const [b1, b2, b3] = parseVer(installed);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

/**
 * Fetch the latest version from npm registry.
 * Returns a promise that resolves to the version string or null on error.
 * @returns {Promise<string|null>}
 */
function fetchLatestVersion() {
  return new Promise((resolve) => {
    const url = new URL(NPM_REGISTRY_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        port: 443,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "simplebeacon-cli-update-check",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data.version || null);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/**
 * Check for updates and print a notification if a newer version is available.
 *
 * Behavior:
 *   - Skips entirely if --offline or --air-gapped is set
 *   - Uses cached result if less than 24h old
 *   - Fetches from npm registry if cache is stale
 *   - Prints to stderr (never stdout — doesn't interfere with JSON output)
 *   - Never throws — all errors are silently swallowed
 *   - Returns immediately if --version or --help is being shown
 *
 * @param {Object} options - CLI options { offline, airGapped, quiet }
 * @returns {Promise<void>}
 */
async function checkForUpdates(options = {}) {
  // Skip in offline / air-gapped mode
  if (options.offline || options.airGapped) return;

  // Skip if quiet flag is set
  if (options.quiet) return;

  const installed = getInstalledVersion();
  if (!installed) return;

  // Check cache first
  const cached = readCache();
  if (cached) {
    if (
      cached.latestVersion &&
      isNewerVersion(cached.latestVersion, installed)
    ) {
      printUpdateNotice(cached.latestVersion, installed);
    }
    return;
  }

  // Fetch latest version from npm
  const latest = await fetchLatestVersion();
  if (!latest) return;

  // Cache the result
  writeCache({
    latestVersion: latest,
    checkedAt: new Date().toISOString(),
  });

  // Print notice if newer version exists
  if (isNewerVersion(latest, installed)) {
    printUpdateNotice(latest, installed);
  }
}

/**
 * Print the update notification to stderr.
 * Uses yellow ANSI color when TTY, plain text otherwise.
 * @param {string} latest - Latest version on npm
 * @param {string} installed - Currently installed version
 */
function printUpdateNotice(latest, installed) {
  const isTTY = process.stderr.isTTY === true;
  const yellow = isTTY ? "\x1b[33m" : "";
  const reset = isTTY ? "\x1b[0m" : "";
  const cyan = isTTY ? "\x1b[36m" : "";

  const lines = [
    `${yellow}┌─────────────────────────────────────────────────────────────┐${reset}`,
    `${yellow}│${reset}  ${cyan}SimpleBeacon ${latest}${reset} is available — you have ${installed}          ${yellow}│${reset}`,
    `${yellow}│${reset}  Update: ${cyan}npm install -g simplebeacon@latest${reset}                  ${yellow}│${reset}`,
    `${yellow}│${reset}  52 deterministic engines · catch AI code debt             ${yellow}│${reset}`,
    `${yellow}└─────────────────────────────────────────────────────────────┘${reset}`,
  ];
  for (const line of lines) {
    process.stderr.write(line + "\n");
  }
  process.stderr.write("\n");
}

module.exports = {
  checkForUpdates,
  getInstalledVersion,
  fetchLatestVersion,
  isNewerVersion,
  readCache,
  writeCache,
  printUpdateNotice,
  CACHE_TTL_MS,
  CACHE_FILE,
  NPM_REGISTRY_URL,
};
