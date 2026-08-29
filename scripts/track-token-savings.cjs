/**
 * SimpleBeacon Token Savings Tracker
 *
 * Tracks token savings from progressive discovery + payload compression
 * across MCP tool calls. Writes a rolling log to .simplebeacon/token-savings.json
 * that the dashboard can read to display real-time savings metrics.
 *
 * Usage (standalone):
 *   node scripts/track-token-savings.cjs --report
 *   node scripts/track-token-savings.cjs --reset
 *
 * Usage (as module):
 *   const tracker = require('./track-token-savings.cjs');
 *   tracker.record('scan_project', 25000, 3000);
 *   tracker.summary();
 */
const fs = require("fs");
const path = require("path");

const SAVINGS_FILE = path.resolve(".simplebeacon/token-savings.json");
const REPORT_FILE = path.resolve(".simplebeacon/report.json");

function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(SAVINGS_FILE, "utf8"));
  } catch {
    return {
      sessions: [],
      totalCalls: 0,
      totalRawTokens: 0,
      totalCompressedTokens: 0,
      startedAt: new Date().toISOString(),
    };
  }
}

function saveLog(log) {
  const dir = path.dirname(SAVINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SAVINGS_FILE, JSON.stringify(log, null, 2));
}

/**
 * Record a single tool call's token savings.
 * @param {string} toolName - Name of the MCP tool called
 * @param {number} rawTokens - Estimated tokens before compression
 * @param {number} compressedTokens - Estimated tokens after compression
 */
function record(toolName, rawTokens, compressedTokens) {
  const log = loadLog();
  log.totalCalls++;
  log.totalRawTokens += rawTokens;
  log.totalCompressedTokens += compressedTokens;
  log.lastUpdated = new Date().toISOString();

  // Track per-tool stats
  if (!log.byTool) log.byTool = {};
  if (!log.byTool[toolName]) {
    log.byTool[toolName] = { calls: 0, rawTokens: 0, compressedTokens: 0 };
  }
  log.byTool[toolName].calls++;
  log.byTool[toolName].rawTokens += rawTokens;
  log.byTool[toolName].compressedTokens += compressedTokens;

  saveLog(log);
}

/**
 * Get a summary of token savings.
 */
function summary() {
  const log = loadLog();
  const saved = log.totalRawTokens - log.totalCompressedTokens;
  const pct = log.totalRawTokens > 0
    ? ((saved / log.totalRawTokens) * 100).toFixed(1)
    : "0";

  return {
    totalCalls: log.totalCalls,
    totalRawTokens: log.totalRawTokens,
    totalCompressedTokens: log.totalCompressedTokens,
    totalSaved: saved,
    savingsPct: parseFloat(pct),
    byTool: log.byTool || {},
    startedAt: log.startedAt,
    lastUpdated: log.lastUpdated || log.startedAt,
  };
}

/**
 * Generate a human-readable report.
 */
function report() {
  const s = summary();
  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
  };

  console.log(`${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.magenta}       SIMPLEBEACON TOKEN SAVINGS REPORT             ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);

  if (s.totalCalls === 0) {
    console.log(`${colors.yellow}No token savings data yet. Run some MCP tool calls first.${colors.reset}`);
    console.log(`${colors.dim}Data is logged to .simplebeacon/token-savings.json${colors.reset}\n`);
    return;
  }

  console.log(`${colors.bold}Overview:${colors.reset}`);
  console.log(`  Total tool calls:     ${s.totalCalls.toLocaleString()}`);
  console.log(`  Raw tokens:           ${colors.red}${s.totalRawTokens.toLocaleString()}${colors.reset}`);
  console.log(`  Compressed tokens:    ${colors.green}${s.totalCompressedTokens.toLocaleString()}${colors.reset}`);
  console.log(`  Tokens saved:         ${colors.green}${s.totalSaved.toLocaleString()}${colors.reset}`);
  console.log(`  Savings percentage:   ${colors.green}${s.savingsPct}%${colors.reset}`);
  console.log(`  Tracking since:       ${colors.dim}${s.startedAt}${colors.reset}`);
  console.log(`  Last updated:         ${colors.dim}${s.lastUpdated}${colors.reset}\n`);

  // Per-tool breakdown
  const tools = Object.entries(s.byTool).sort((a, b) =>
    (b[1].rawTokens - b[1].compressedTokens) - (a[1].rawTokens - a[1].compressedTokens)
  );

  if (tools.length > 0) {
    console.log(`${colors.bold}Per-Tool Breakdown:${colors.reset}\n`);
    console.log(`  ${'Tool'.padEnd(30)} ${'Calls'.padStart(6)} ${'Raw'.padStart(10)} ${'Compressed'.padStart(10)} ${'Saved'.padStart(10)} ${'Pct'.padStart(6)}`);
    console.log(`  ${'─'.repeat(30)} ${'─'.repeat(6)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(6)}`);

    for (const [name, stats] of tools) {
      const saved = stats.rawTokens - stats.compressedTokens;
      const pct = stats.rawTokens > 0 ? ((saved / stats.rawTokens) * 100).toFixed(1) : "0";
      console.log(
        `  ${name.padEnd(30)} ${String(stats.calls).padStart(6)} ${String(stats.rawTokens).padStart(10)} ${String(stats.compressedTokens).padStart(10)} ${colors.green}${String(saved).padStart(10)}${colors.reset} ${colors.green}${String(pct).padStart(5)}%${colors.reset}`
      );
    }
  }

  // Cost estimate
  const PRICING = { inputPerM: 3, outputPerM: 15 };
  const rawCost = (s.totalRawTokens / 1_000_000) * PRICING.inputPerM;
  const compressedCost = (s.totalCompressedTokens / 1_000_000) * PRICING.inputPerM;
  const costSaved = rawCost - compressedCost;

  console.log(`\n${colors.bold}Cost Estimate (Claude Sonnet 4 pricing):${colors.reset}`);
  console.log(`  Raw cost:         ${colors.red}$${rawCost.toFixed(4)}${colors.reset}`);
  console.log(`  Compressed cost:  ${colors.green}$${compressedCost.toFixed(4)}${colors.reset}`);
  console.log(`  Cost saved:       ${colors.green}$${costSaved.toFixed(4)}${colors.reset}`);

  console.log(`\n${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.green}[REPORT COMPLETE] ${s.savingsPct}% token savings across ${s.totalCalls} calls${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);
}

/**
 * Reset the savings log.
 */
function reset() {
  const log = {
    sessions: [],
    totalCalls: 0,
    totalRawTokens: 0,
    totalCompressedTokens: 0,
    startedAt: new Date().toISOString(),
    byTool: {},
  };
  saveLog(log);
  console.log("Token savings log reset.");
}

/**
 * Calculate savings from a real scan report (one-shot analysis).
 */
function analyzeReport() {
  if (!fs.existsSync(REPORT_FILE)) {
    console.log("No .simplebeacon/report.json found. Run a scan first.");
    return;
  }
  const { compressScanReport, tokenSavingsSummary } = require(
    path.resolve("packages/simplebeacon-cli/src/reporters/agent-compressor.cjs")
  );
  const rawReport = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
  const savings = tokenSavingsSummary(rawReport);

  const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
  };

  console.log(`${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}  SCAN REPORT COMPRESSION ANALYSIS                  ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}\n`);

  console.log(`  Report file:       ${colors.dim}${REPORT_FILE}${colors.reset}`);
  console.log(`  Raw size:          ${colors.red}${(savings.rawBytes / 1024).toFixed(1)} KB${colors.reset} (${savings.rawTokens.toLocaleString()} tokens)`);
  console.log(`  Compressed size:   ${colors.green}${(savings.compressedBytes / 1024).toFixed(1)} KB${colors.reset} (${savings.compressedTokens.toLocaleString()} tokens)`);
  console.log(`  Tokens saved:      ${colors.green}${savings.saved.toLocaleString()}${colors.reset} (${savings.savingsPct}%)`);

  // Show compressed preview
  const compressed = compressScanReport(rawReport);
  const compressedStr = JSON.stringify(compressed);
  const preview = compressedStr.length > 500
    ? compressedStr.substring(0, 497) + "..."
    : compressedStr;

  console.log(`\n${colors.bold}Compressed preview:${colors.reset}`);
  console.log(`  ${colors.dim}${preview}${colors.reset}`);

  // Cost projection
  const turns = 10;
  const rawSessionCost = (savings.rawTokens * turns / 1_000_000) * 3;
  const compressedSessionCost = (savings.compressedTokens * turns / 1_000_000) * 3;
  console.log(`\n${colors.bold}10-turn session cost projection (Sonnet $3/M):${colors.reset}`);
  console.log(`  Raw:          ${colors.red}$${rawSessionCost.toFixed(4)}${colors.reset}`);
  console.log(`  Compressed:   ${colors.green}$${compressedSessionCost.toFixed(4)}${colors.reset}`);
  console.log(`  Session save: ${colors.green}$${(rawSessionCost - compressedSessionCost).toFixed(4)}${colors.reset}`);

  console.log(`\n${colors.cyan}====================================================${colors.reset}\n`);
}

// ── CLI entry point ─────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--report") || args.includes("-r")) {
    report();
  } else if (args.includes("--reset")) {
    reset();
  } else if (args.includes("--analyze")) {
    analyzeReport();
  } else {
    // Default: show report
    report();
  }
}

module.exports = { record, summary, report, reset, analyzeReport, loadLog, saveLog };
