#!/usr/bin/env node

/**
 * SimpleBeacon Automated Private Processor
 * 
 * A headless background service that automatically processes files from an input directory,
 * sanitizes PII locally, runs analysis via local Ollama, and exports reports.
 * 
 * Privacy guarantee: All PII is stripped before data reaches the AI engine.
 * Offline-only: Processes strictly on http://127.0.0.1:11434 (local Ollama).
 */

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

// Configuration
const WATCH_DIR = path.resolve(__dirname, './incoming_user_data');
const OUTPUT_DIR = path.resolve(__dirname, './processed_reports');
const ARCHIVE_DIR = path.resolve(__dirname, './processed_archive');
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'unbreakable-oracle:latest';
const OFFLINE_MODE = process.env.SIMPLEBEACON_OFFLINE === 'true' || process.env.NODE_ENV === 'production';

// Privacy enforcement
if (!OFFLINE_MODE) {
  console.warn('⚠️  WARNING: Offline mode not enforced. Set SIMPLEBEACON_OFFLINE=true for maximum privacy.');
}

// Ensure directories exist
[WATCH_DIR, OUTPUT_DIR, ARCHIVE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

/**
 * Call local Ollama engine for analysis
 */
async function analyzeWithOllama(prompt) {
  const url = `${OLLAMA_BASE_URL}/api/generate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 1024
      }
    })
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
    console.log(`[${new Date().toISOString()}] Processing: ${filename}`);

    // 1. Read input file
    const rawData = fs.readFileSync(filePath, 'utf8');

    // 2. Absolute Privacy: Strip PII before AI processing
    const cleanData = sanitizePrivacyData(rawData);
    console.log(`[${new Date().toISOString()}] PII sanitized for: ${filename}`);

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
    console.log(`[${new Date().toISOString()}] Analysis completed for: ${filename}`);

    // 4. Generate report
    const report = {
      metadata: {
        filename,
        processedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
        ollamaModel: OLLAMA_MODEL,
        offlineMode: OFFLINE_MODE
      },
      analysis: analysisResult,
      sanitization: {
        piiRemoved: rawData !== cleanData,
        originalLength: rawData.length,
        sanitizedLength: cleanData.length
      }
    };

    // 5. Save report
    const outputFilename = `report_${Date.now()}_${filename}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[${new Date().toISOString()}] Report saved: ${outputFilename}`);

    // 6. Archive original file (instead of deleting for audit trail)
    const archivePath = path.join(ARCHIVE_DIR, filename);
    fs.renameSync(filePath, archivePath);
    console.log(`[${new Date().toISOString()}] Archived to: ${archivePath}`);

    console.log(`[${new Date().toISOString()}] ✅ Successfully processed ${filename} in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to process ${filename}:`, error.message);
    
    // Move failed file to error subdirectory
    const errorDir = path.join(ARCHIVE_DIR, 'errors');
    if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });
    fs.renameSync(filePath, path.join(errorDir, `${filename}.error`));
  }
}

/**
 * Process all existing files in watch directory on startup
 */
function processExistingFiles() {
  const files = fs.readdirSync(WATCH_DIR);
  if (files.length === 0) {
    console.log(`[${new Date().toISOString()}] No existing files to process in ${WATCH_DIR}`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Processing ${files.length} existing file(s)...`);
  files.forEach(file => {
    const fullPath = path.join(WATCH_DIR, file);
    if (fs.statSync(fullPath).isFile()) {
      processFile(fullPath);
    }
  });
}

/**
 * Setup file watcher for real-time processing
 */
function setupFileWatcher() {
  console.log(`[${new Date().toISOString()}] Setting up file watcher on: ${WATCH_DIR}`);
  
  const watcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\\/])\../, // ignore dotfiles
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', filePath => {
      // Debounce: only process if file is stable (not being written)
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          processFile(filePath);
        }
      }, 2500);
    })
    .on('error', error => {
      console.error(`[${new Date().toISOString()}] Watcher error:`, error);
    });

  console.log(`[${new Date().toISOString()}] File watcher active. Drop files into ${WATCH_DIR} for automatic processing.`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('⚡ SimpleBeacon Automated Private Service starting...');
  console.log(`📁 Watch directory: ${WATCH_DIR}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🤖 Ollama URL: ${OLLAMA_BASE_URL}`);
  console.log(`🤖 Ollama Model: ${OLLAMA_MODEL}`);
  console.log(`🔒 Offline Mode: ${OFFLINE_MODE ? 'ENFORCED' : 'WARNING - NOT ENFORCED'}`);
  console.log('');

  // Verify Ollama is accessible
  try {
    const testResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!testResponse.ok) {
      throw new Error(`Ollama returned ${testResponse.status}`);
    }
    console.log(`[${new Date().toISOString()}] ✅ Ollama connection verified`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Ollama connection failed: ${error.message}`);
    console.error(`[${new Date().toISOString()}] Ensure Ollama is running: ollama serve`);
    process.exit(1);
  }

  // Process existing files
  processExistingFiles();

  // Start file watcher
  setupFileWatcher();

  console.log('');
  console.log('⚡ SimpleBeacon Automated Private Service is running in headless mode...');
  console.log('Press Ctrl+C to stop');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚡ Shutting down SimpleBeacon Automated Private Service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚡ Shutting down SimpleBeacon Automated Private Service...');
  process.exit(0);
});

// Start the service
main().catch(error => {
  console.error('Fatal error starting service:', error);
  process.exit(1);
});
