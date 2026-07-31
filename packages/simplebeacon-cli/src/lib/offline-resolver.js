/**
 * Offline-first dependency resolution for air-gapped and corporate proxy environments.
 * Provides local caching of npm registry lookups, proxy detection, and graceful
 * degradation when network access is unavailable.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CACHE_DIR = path.join(require('os').homedir(), '.simplebeacon', 'cache');
const REGISTRY_CACHE_FILE = path.join(CACHE_DIR, 'npm-registry.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Well-known npm packages that definitely exist on the public registry.
// Used as a fallback when registry checks are unavailable (air-gapped mode).
const KNOWN_GOOD_PACKAGES = new Set([
  'express',
  'react',
  'react-dom',
  'vue',
  'angular',
  '@angular/core',
  'next',
  'nuxt',
  'svelte',
  '@sveltejs/kit',
  'astro',
  'eleventy',
  'lodash',
  'axios',
  'chalk',
  'commander',
  'inquirer',
  'ora',
  'typescript',
  'jest',
  'vitest',
  'mocha',
  'chai',
  'playwright',
  'eslint',
  'prettier',
  'webpack',
  'vite',
  'rollup',
  'esbuild',
  'tailwindcss',
  'postcss',
  'sass',
  'less',
  'fastify',
  'koa',
  'hapi',
  'polka',
  'connect',
  'mongoose',
  'sequelize',
  'prisma',
  'drizzle-orm',
  'kysely',
  'pg',
  'mysql2',
  'sqlite3',
  'better-sqlite3',
  'redis',
  'ioredis',
  'dotenv',
  'cors',
  'helmet',
  'morgan',
  'compression',
  'zod',
  'joi',
  'yup',
  'ajv',
  'io-ts',
  'superstruct',
  'openai',
  'anthropic',
  '@anthropic-ai/sdk',
  'langchain',
  '@langchain/core',
  'ws',
  'socket.io',
  'nanoid',
  'uuid',
  'date-fns',
  'dayjs',
  'moment',
  'fs-extra',
  'glob',
  'chokidar',
  'minimatch',
  'micromatch',
  'bcrypt',
  'argon2',
  'jsonwebtoken',
  'passport',
  'oauth',
  'winston',
  'pino',
  'bunyan',
  'loglevel',
  'node-fetch',
  'got',
  'undici',
  'ky',
  'jszip',
  'archiver',
  'tar',
  'unzipper',
  'sharp',
  'jimp',
  'canvas',
  'pdfkit',
  'puppeteer',
  '@babel/core',
  '@babel/parser',
  '@babel/traverse',
  '@babel/types',
  'bluebird',
  'rxjs',
  'immer',
  'nanostores',
  'zustand',
  'class-validator',
  'class-transformer',
  'reflect-metadata',
  'swagger-ui-express',
  'swagger-jsdoc',
  '@nestjs/core',
  '@nestjs/common',
  'graphql',
  '@apollo/server',
  'mercurius',
  'type-graphql',
  'prisma',
  '@prisma/client',
  'drizzle-orm',
  'simplebeacon',
  'simplebeacon-cli',
]);

// Packages that are commonly hallucinated by LLMs
const KNOWN_HALLUCINATED_PACKAGES = new Set([
  'react-server-renderer-v2',
  'next-ssr-optimizer',
  'ai-code-fixer',
  'smart-react-hooks',
  'vue-ai-validator',
  'auto-remediation-engine',
  'llm-code-optimizer',
  'gpt-router',
  'claude-bridge',
  'ai-middleware',
  'token-optimizer',
  'prompt-injector',
  'ai-safety-guard',
  'smart-async-handler',
  'react-ai-component',
  'vue-ai-composer',
]);

function ensureCacheDir() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    /* permission denied — read-only filesystem */
  }
}

function loadRegistryCache() {
  try {
    const raw = fs.readFileSync(REGISTRY_CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.entries) {
      return data;
    }
  } catch {
    /* no cache or corrupted */
  }
  return { entries: {}, updatedAt: 0 };
}

function saveRegistryCache(cache) {
  ensureCacheDir();
  try {
    fs.writeFileSync(REGISTRY_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    /* read-only filesystem — cache is best-effort */
  }
}

function isCacheEntryFresh(entry, now = Date.now()) {
  return entry && typeof entry.timestamp === 'number' && now - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Detect if we're behind a corporate proxy by checking environment variables.
 */
function detectProxyEnvironment() {
  const proxyVars = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
    'NO_PROXY',
    'no_proxy',
  ];
  const detected = {};
  let hasProxy = false;
  for (const varName of proxyVars) {
    const value = process.env[varName];
    if (value) {
      detected[varName] = value;
      if (varName.toLowerCase().includes('proxy') && !varName.toLowerCase().startsWith('no_')) {
        hasProxy = true;
      }
    }
  }
  return { hasProxy, vars: detected };
}

/**
 * Quick network connectivity check to npm registry.
 * Returns true if reachable, false if blocked/air-gapped.
 */
function checkNetworkConnectivity(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/express', { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if a package exists on the npm registry with offline-first fallback.
 *
 * Resolution order:
 * 1. Check local cache (if fresh)
 * 2. Check known-good packages list
 * 3. Check known-hallucinated packages list
 * 4. Attempt network lookup (if not air-gapped)
 * 5. Return null (unknown) if all else fails
 */
async function resolvePackageExists(packageName, options = {}) {
  const { airGapped = false, timeoutMs = 4000, useCache = true } = options;

  // 1. Check local cache
  if (useCache) {
    const cache = loadRegistryCache();
    const entry = cache.entries[packageName];
    if (isCacheEntryFresh(entry)) {
      return entry.exists;
    }
  }

  // 2. Check known-good list
  if (KNOWN_GOOD_PACKAGES.has(packageName)) {
    if (useCache) updateCacheEntry(packageName, true);
    return true;
  }

  // 3. Check known-hallucinated list
  if (KNOWN_HALLUCINATED_PACKAGES.has(packageName)) {
    if (useCache) updateCacheEntry(packageName, false);
    return false;
  }

  // 4. Network lookup (skip if air-gapped)
  if (airGapped) {
    // In air-gapped mode, we can't verify — return null (unknown)
    return null;
  }

  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const proxyEnv = detectProxyEnvironment();
    const requestOptions = { timeout: timeoutMs };

    // Respect proxy environment variables
    if (proxyEnv.hasProxy) {
      const proxyUrl =
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy;
      if (proxyUrl) {
        try {
          const { HttpsProxyAgent } = require('https-proxy-agent');
          requestOptions.agent = new HttpsProxyAgent(proxyUrl);
        } catch {
          // https-proxy-agent not installed — try without proxy
        }
      }
    }

    const req = https.get(url, requestOptions, (res) => {
      res.resume();
      const exists = res.statusCode === 200;
      if (useCache) updateCacheEntry(packageName, exists);
      resolve(exists);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function updateCacheEntry(packageName, exists) {
  const cache = loadRegistryCache();
  cache.entries[packageName] = { exists, timestamp: Date.now() };
  cache.updatedAt = Date.now();
  saveRegistryCache(cache);
}

/**
 * Pre-warm the registry cache for common packages.
 * Useful before entering air-gapped environments.
 */
async function prewarmCache(packageNames = [], options = {}) {
  const { concurrency = 5, onProgress } = options;
  const packages = [...new Set([...packageNames, ...KNOWN_GOOD_PACKAGES])];
  const results = { cached: 0, failed: 0, skipped: 0 };

  const batchSize = Math.ceil(packages.length / Math.ceil(packages.length / concurrency));
  for (let i = 0; i < packages.length; i += batchSize) {
    const batch = packages.slice(i, i + batchSize);
    const promises = batch.map(async (name) => {
      const exists = await resolvePackageExists(name, { ...options, useCache: false });
      if (exists === true) {
        updateCacheEntry(name, true);
        results.cached++;
      } else if (exists === false) {
        updateCacheEntry(name, false);
        results.cached++;
      } else {
        results.failed++;
      }
      if (onProgress) onProgress(name, exists);
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * Export the registry cache to a JSON file for transfer to air-gapped environments.
 */
function exportCache(outputPath) {
  const cache = loadRegistryCache();
  const exportData = {
    exportedAt: new Date().toISOString(),
    entryCount: Object.keys(cache.entries).length,
    entries: cache.entries,
    knownGoodPackages: [...KNOWN_GOOD_PACKAGES],
    knownHallucinatedPackages: [...KNOWN_HALLUCINATED_PACKAGES],
  };
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  return exportData;
}

/**
 * Import a registry cache from a JSON file (e.g., from a USB transfer to air-gapped env).
 */
function importCache(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !data.entries) throw new Error('Invalid cache file format');
  const cache = {
    entries: data.entries,
    updatedAt: Date.now(),
  };
  saveRegistryCache(cache);
  return { imported: Object.keys(data.entries).length };
}

/**
 * Get the current cache statistics.
 */
function getCacheStats() {
  const cache = loadRegistryCache();
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  for (const entry of Object.values(cache.entries)) {
    if (isCacheEntryFresh(entry, now)) {
      fresh++;
    } else {
      stale++;
    }
  }
  return {
    totalEntries: Object.keys(cache.entries).length,
    fresh,
    stale,
    cacheFile: REGISTRY_CACHE_FILE,
    cacheAge: cache.updatedAt ? now - cache.updatedAt : null,
  };
}

/**
 * Clear the registry cache.
 */
function clearCache() {
  try {
    fs.unlinkSync(REGISTRY_CACHE_FILE);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  resolvePackageExists,
  detectProxyEnvironment,
  checkNetworkConnectivity,
  prewarmCache,
  exportCache,
  importCache,
  getCacheStats,
  clearCache,
  KNOWN_GOOD_PACKAGES,
  KNOWN_HALLUCINATED_PACKAGES,
  CACHE_DIR,
  REGISTRY_CACHE_FILE,
};
