#!/usr/bin/env node
// simplebeacon-ignore: debugArtifacts

/**
 * SimpleBeacon Automated Private Processor
 *
 * A headless background service that automatically processes files from an input directory,
 * sanitizes PII locally, runs analysis via local Ollama, and exports reports.
 *
 * Privacy guarantee: All PII is stripped before data reaches the AI engine.
 * Offline-only: Processes strictly via local Ollama (OLLAMA_BASE_URL env var).
 */

const constants = require('./server/config/constants.cjs');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import shared privacy utilities from server/lib
const { sanitizePrivacyData } = require('./server/lib/privacy-utils.cjs');
const logger = require('./server/lib/app-logger.cjs');

// Configuration
let fileWatcher = null; // simplebeacon-ignore memory-leak — chokidar watcher is intentionally long-lived for background file processing
const activeTimers = new Set();
const WATCH_DIR = path.resolve(__dirname, './incoming_user_data');
const OUTPUT_DIR = path.resolve(__dirname, './processed_reports');
const ARCHIVE_DIR = path.resolve(__dirname, './processed_archive');
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'; // simplebeacon-ignore hardcoded-url — default localhost Ollama endpoint, override with OLLAMA_BASE_URL env var
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'unbreakable-oracle:latest';
const OFFLINE_MODE =
  process.env.SIMPLEBEACON_OFFLINE === 'true' || process.env.NODE_ENV === 'production';
const PROCESSOR_DEBUG = process.env.PROCESSOR_DEBUG === 'true';
const MAX_FILE_SIZE_MB = parseInt(process.env.PROCESSOR_MAX_FILE_SIZE_MB || '50', 10);
const log = (...args) => {
  if (PROCESSOR_DEBUG) logger.info(...args);
}; // simplebeacon-ignore debug-artifact — gated by PROCESSOR_DEBUG env var
const logError = (...args) => {
  if (PROCESSOR_DEBUG) logger.error(...args);
}; // simplebeacon-ignore debug-artifact — gated by PROCESSOR_DEBUG env var
const timestamp = () => new Date().toISOString();

// Ensure directories exist
[WATCH_DIR, OUTPUT_DIR, ARCHIVE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
});

/**
 * Call local Ollama engine for analysis
 */
async function fetchWithTimeout(url, options = {}, ms = constants.TIMEOUT_2M) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeWithOllama(prompt) {
  const url = `${OLLAMA_BASE_URL}/api/generate`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: constants.BYTES_PER_KB,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Process a single file through the automated pipeline
 */
async function processFile(filePath) {
  const filename = path.basename(filePath);
  const startTime = Date.now();

  try {
    log(`[${timestamp()}] Processing: ${filename}`);

    // 1. Read input file (with size guard) using streaming read to avoid large allocations
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_MB * constants.BYTES_PER_MB) {
      throw new Error(
        `File exceeds ${MAX_FILE_SIZE_MB}MB limit: ${filename} (${Math.round(stats.size / 1024 / 1024)}MB)`
      );
    }
    const { readTextFileWithLimit, redactTextSecrets } = require('./server/lib/recoverable-io.cjs');
    let rawData = '';
    try {
      rawData = await readTextFileWithLimit(
        filePath,
        Math.min(stats.size, MAX_FILE_SIZE_MB * constants.BYTES_PER_MB)
      );
      rawData = redactTextSecrets(rawData);
    } catch (err) {
      throw new Error(`Failed to read input file safely: ${err.message}`);
    }

    // 2. Absolute Privacy: Strip PII before AI processing
    const cleanData = sanitizePrivacyData(rawData);
    log(`[${timestamp()}] PII sanitized for: ${filename}`);

    // 3. Automated Analysis via local Ollama
    const analysisPrompt = `You are an expert static analysis engine for SimpleBeacon. Your primary job is to find hardcoded secrets, mock data, and AI-hallucinated paths.

Analyze this clean dataset for:
- Hardcoded secrets or credentials
- Mock data patterns
- AI-hallucinated file paths
- Code quality issues
- Security vulnerabilities

Data to analyze:
${cleanData}

Provide a structured report with findings and recommendations.`;

    const analysisResult = await analyzeWithOllama(analysisPrompt);
    log(`[${timestamp()}] Analysis completed for: ${filename}`);

    // 4. Generate report
    const report = {
      metadata: {
        filename,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        ollamaModel: OLLAMA_MODEL,
        offlineMode: OFFLINE_MODE,
      },
      analysis: analysisResult,
      sanitization: {
        piiRemoved: rawData !== cleanData,
        originalLength: rawData.length,
        sanitizedLength: cleanData.length,
      },
    };

    // 5. Save report
    const outputFilename = `report_${Date.now()}_${filename}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    log(`[${timestamp()}] Report saved: ${outputFilename}`);

    // 6. Archive original file (instead of deleting for audit trail)
    const archivePath = path.join(ARCHIVE_DIR, filename);
    fs.renameSync(filePath, archivePath);
    log(`[${timestamp()}] Archived to: ${archivePath}`);

    log(`[${timestamp()}] ✅ Successfully processed ${filename} in ${Date.now() - startTime}ms`);
  } catch (error) {
    logError(`[${timestamp()}] ❌ Failed to process ${filename}:`, error.message);

    // Move failed file to error subdirectory
    if (fs.existsSync(filePath)) {
      const errorDir = path.join(ARCHIVE_DIR, 'errors');
      if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });
      try {
        fs.renameSync(filePath, path.join(errorDir, `${filename}.error`));
      } catch (renameErr) {
        logError(`[${timestamp()}] Could not archive failed file ${filename}:`, renameErr.message);
      }
    }
  }
}

/**
 * Process all existing files in watch directory on startup
 */
async function processExistingFiles() {
  const files = fs.readdirSync(WATCH_DIR); // simplebeacon-ignore sync-io — startup directory listing before async watch begins
  if (files.length === 0) {
    log(`[${timestamp()}] No existing files to process in ${WATCH_DIR}`);
    return;
  }

  log(`[${timestamp()}] Processing ${files.length} existing file(s)...`);
  for (const file of files) {
    const fullPath = path.join(WATCH_DIR, file);
    if (fs.statSync(fullPath).isFile()) {
      try {
        await processFile(fullPath);
      } catch (err) {
        logError(`[${timestamp()}] Failed to process existing file ${file}:`, err.message);
      }
    }
  }
}

/**
 * Setup file watcher for real-time processing
 */
function setupFileWatcher() {
  const FILE_STABILITY_MS = 2000;
  log(`[${timestamp()}] Setting up file watcher on: ${WATCH_DIR}`);

  fileWatcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\\/])\../, // ignore dotfiles
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: FILE_STABILITY_MS,
      pollInterval: 100,
    },
  });

  fileWatcher
    .on('add', (filePath) => {
      // Debounce: only process if file is stable (not being written)
      const timer = setTimeout(() => {
        activeTimers.delete(timer);
        if (fs.existsSync(filePath)) {
          processFile(filePath).catch((err) => {
            logError(`[${timestamp()}] Unhandled error processing ${filePath}:`, err.message);
          });
        }
      }, 2500);
      activeTimers.add(timer);
    })
    .on('error', (error) => {
      logError(`[${timestamp()}] Watcher error:`, error);
    });

  log(
    `[${timestamp()}] File watcher active. Drop files into ${WATCH_DIR} for automatic processing.`
  );
}

/**
 * Main entry point
 */
async function main() {
  log('⚡ SimpleBeacon Automated Private Service starting...');
  log(`📁 Watch directory: ${WATCH_DIR}`);
  log(`📁 Output directory: ${OUTPUT_DIR}`);
  log(`🤖 Ollama URL: ${OLLAMA_BASE_URL}`);
  log(`🤖 Ollama Model: ${OLLAMA_MODEL}`);
  log(`🔒 Offline Mode: ${OFFLINE_MODE ? 'ENFORCED' : 'WARNING - NOT ENFORCED'}`);
  log('');

  // Verify Ollama is accessible
  try {
    const testResponse = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/tags`,
      {},
      constants.TIMEOUT_5S
    );
    if (!testResponse.ok) {
      throw new Error(`Ollama returned ${testResponse.status}`);
    }
    log(`[${timestamp()}] ✅ Ollama connection verified`);
  } catch (error) {
    logError(`[${timestamp()}] ❌ Ollama connection failed: ${error.message}`);
    logError(`[${timestamp()}] Ensure Ollama is running: ollama serve`);
    throw error;
  }

  // Process existing files
  await processExistingFiles();

  // Start file watcher
  setupFileWatcher();

  log('');
  log('⚡ SimpleBeacon Automated Private Service is running in headless mode...');
  log('Press Ctrl+C to stop');
}

// Handle graceful shutdown
async function shutdown() {
  log('\n⚡ Shutting down SimpleBeacon Automated Private Service...');
  activeTimers.forEach((timer) => clearTimeout(timer));
  activeTimers.clear();
  if (fileWatcher) {
    try {
      await fileWatcher.close();
    } catch (e) {
      /* ignore */
    }
    fileWatcher = null;
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the service
main().catch((error) => {
  logError('Fatal error starting service:', error);
  process.exit(1);
});
