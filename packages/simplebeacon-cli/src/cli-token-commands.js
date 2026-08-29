"use strict";

/**
 * CLI command handlers for the token-saving toolkit:
 *   summarize, token-estimate, embed, search, telemetry
 *
 * These wire the lib modules (project-summarizer, token-estimator,
 * embeddings-index, token-telemetry) into the simplebeacon CLI.
 * All operations are local and offline — no source upload, no LLM calls.
 */

const fs = require("fs");
const path = require("path");

const {
  summarizeProject,
  DEFAULT_SUMMARIES_DIR,
} = require("./lib/project-summarizer");
const {
  estimateTokens,
  estimatePromptTokens,
  trimContext,
} = require("./lib/token-estimator");
const {
  buildIndex,
  search,
  saveIndex,
  loadIndex,
  defaultIndexPath,
} = require("./lib/embeddings-index");
const {
  recordEvent,
  summarizeLedger,
  defaultLedgerPath,
} = require("./lib/token-telemetry");
const { walkProject } = require("./lib/project-summarizer");
const {
  generateBeaconIndex,
  scanBeacons,
  loadIndex: loadBeaconIndex,
  defaultIndexPath: defaultBeaconIndexPath,
  DEFAULT_BEACONS_DIR,
} = require("./lib/semantic-lighthouse");

function writeLine(msg = "") {
  process.stdout.write(`${msg == null ? "" : String(msg)}\n`);
}

function resolveProjectRoot(options) {
  return path.resolve(options.path || process.cwd());
}

function outputResult(payload, options) {
  const json = options.format === "json" || options.jsonOutput === true;
  const text = json ? JSON.stringify(payload, null, 2) : payload.text;
  if (options.output) {
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), text);
    writeLine(`Wrote ${options.output}`);
  } else {
    writeLine(text);
  }
}

/**
 * simplebeacon summarize [--path .] [--max-tokens 200] [--format json]
 */
async function runSummarizeCommand(options) {
  const root = resolveProjectRoot(options);
  writeLine(`Summarizing project: ${root}`);
  const { index, summaries, outputDir } = await summarizeProject(root, {
    maxFiles: 20000,
  });
  const ledgerPath = defaultLedgerPath(root);
  recordEvent({
    ledgerPath,
    action: "summarize",
    capability: "summary",
    inputTokens: index.totalTokens,
    outputTokens: summaries.reduce((a, s) => a + estimateTokens(s.summary), 0),
    savedTokens: Math.max(0, index.totalTokens - summaries.reduce((a, s) => a + estimateTokens(s.summary), 0)),
    detail: `${summaries.length} files`,
  });
  if (options.format === "json" || options.jsonOutput === true) {
    outputResult({ text: JSON.stringify(index, null, 2), index, outputDir }, options);
    return 0;
  }
  writeLine(`Files: ${index.fileCount}`);
  writeLine(`Total tokens (full content): ${index.totalTokens}`);
  writeLine(`Total lines: ${index.totalLines}`);
  writeLine(`Categories:`);
  for (const [cat, info] of Object.entries(index.byCategory)) {
    writeLine(`  ${cat}: ${info.count} files, ${info.tokens} tokens`);
  }
  writeLine(`\nTop 10 files by token cost:`);
  for (const f of index.files.slice(0, 10)) {
    writeLine(`  ${f.tokens}\t${f.path}`);
    writeLine(`      ${f.summary}`);
  }
  writeLine(`\nWrote ${summaries.length} per-file summaries to ${outputDir}`);
  writeLine(`Wrote index to ${path.join(outputDir, "index.json")}`);
  return 0;
}

/**
 * simplebeacon token-estimate [--path file | --prompt-file f] [--budget N]
 */
async function runTokenEstimateCommand(options) {
  if (options.promptFile) {
    const ledgerPath = defaultLedgerPath(resolveProjectRoot(options));
    const promptPath = path.resolve(options.promptFile);
    let prompt;
    try {
      prompt = JSON.parse(fs.readFileSync(promptPath, "utf8"));
    } catch (err) {
      writeLine(`Error reading prompt file: ${err.message}`);
      return 1;
    }
    const { total, parts } = estimatePromptTokens(prompt);
    recordEvent({
      ledgerPath,
      action: "token-estimate",
      capability: "estimator",
      inputTokens: total,
      detail: "prompt",
    });
    outputResult({
      text: JSON.stringify({ total, parts }, null, 2),
      total,
      parts,
    }, options);
    return 0;
  }
  const target = options.path ? path.resolve(options.path) : null;
  if (!target) {
    writeLine("Provide --path <file> or --prompt-file <file>");
    return 1;
  }
  // When --path is a file, the telemetry ledger lives in the file's parent dir.
  const ledgerPath = defaultLedgerPath(
    fs.existsSync(target) && fs.statSync(target).isDirectory()
      ? target
      : path.dirname(target),
  );
  let content = "";
  try {
    content = fs.readFileSync(target, "utf8");
  } catch (err) {
    writeLine(`Error reading file: ${err.message}`);
    return 1;
  }
  const originalTokens = estimateTokens(content, { filePath: target });
  if (options.budget && originalTokens > options.budget) {
    const { trimmed, trimmedTokens, droppedLines } = trimContext(content, options.budget, { filePath: target });
    recordEvent({
      ledgerPath,
      action: "token-estimate",
      capability: "estimator",
      inputTokens: originalTokens,
      outputTokens: trimmedTokens,
      savedTokens: originalTokens - trimmedTokens,
      detail: path.basename(target),
    });
    outputResult({
      text: JSON.stringify({
        file: target,
        originalTokens,
        budget: options.budget,
        trimmedTokens,
        savedTokens: originalTokens - trimmedTokens,
        droppedLines,
        trimmed,
      }, null, 2),
      originalTokens,
      trimmedTokens,
    }, options);
    return 0;
  }
  recordEvent({
    ledgerPath,
    action: "token-estimate",
    capability: "estimator",
    inputTokens: originalTokens,
    detail: path.basename(target),
  });
  outputResult({
    text: JSON.stringify({ file: target, tokens: originalTokens, withinBudget: true }, null, 2),
    tokens: originalTokens,
  }, options);
  return 0;
}

/**
 * simplebeacon embed [--path .] [--dimensions 256] [--index <file>]
 */
async function runEmbedCommand(options) {
  const root = resolveProjectRoot(options);
  const indexPath = options.indexFile ? path.resolve(options.indexFile) : defaultIndexPath(root);
  writeLine(`Building embeddings index for: ${root}`);
  const files = await walkProject(root, {});
  const fileInputs = [];
  for (const f of files) {
    let content = "";
    try {
      content = fs.readFileSync(f.absPath, "utf8");
    } catch {
      continue;
    }
    fileInputs.push({ path: f.relPath, content });
  }
  const index = buildIndex(fileInputs, { dimensions: options.dimensions || 256 });
  saveIndex(index, indexPath);
  const ledgerPath = defaultLedgerPath(root);
  recordEvent({
    ledgerPath,
    action: "embed",
    capability: "embeddings",
    inputTokens: index.passageCount * 100, // rough estimate
    outputTokens: index.passageCount,
    detail: `${index.fileCount} files, ${index.passageCount} passages`,
  });
  if (options.format === "json" || options.jsonOutput === true) {
    outputResult({ text: JSON.stringify({ indexPath, fileCount: index.fileCount, passageCount: index.passageCount, dimensions: index.dimensions }, null, 2) }, options);
    return 0;
  }
  writeLine(`Files indexed: ${index.fileCount}`);
  writeLine(`Passages: ${index.passageCount}`);
  writeLine(`Dimensions: ${index.dimensions}`);
  writeLine(`Index written to: ${indexPath}`);
  return 0;
}

/**
 * simplebeacon search --query "..." [--k 5] [--index <file>]
 */
async function runSearchCommand(options) {
  if (!options.query) {
    writeLine("Error: --query is required for search");
    return 1;
  }
  const root = resolveProjectRoot(options);
  const indexPath = options.indexFile ? path.resolve(options.indexFile) : defaultIndexPath(root);
  const index = loadIndex(indexPath);
  if (!index) {
    writeLine(`No embeddings index found at ${indexPath}. Run 'simplebeacon embed' first.`);
    return 1;
  }
  const results = search(index, options.query, { k: options.topK || 5 });
  const ledgerPath = defaultLedgerPath(root);
  recordEvent({
    ledgerPath,
    action: "search",
    capability: "embeddings",
    inputTokens: estimateTokens(options.query),
    outputTokens: results.length * 50,
    savedTokens: 0,
    detail: options.query.slice(0, 60),
  });
  if (options.format === "json" || options.jsonOutput === true) {
    outputResult({ text: JSON.stringify({ query: options.query, results }, null, 2), results }, options);
    return 0;
  }
  writeLine(`Query: "${options.query}"`);
  writeLine(`Top ${results.length} results:`);
  for (const r of results) {
    const loc = r.isSummary ? "(summary)" : `L${r.startLine}-${r.endLine}`;
    writeLine(`  ${r.score.toFixed(3)}\t${r.path}\t${loc}`);
  }
  return 0;
}

/**
 * simplebeacon telemetry [--since <iso>] [--format json]
 */
async function runTelemetryCommand(options) {
  const root = resolveProjectRoot(options);
  const ledgerPath = defaultLedgerPath(root);
  const report = summarizeLedger(ledgerPath, { since: options.since });
  if (options.format === "json" || options.jsonOutput === true) {
    outputResult({ text: JSON.stringify(report, null, 2), report }, options);
    return 0;
  }
  writeLine(`Token Telemetry Report — ${ledgerPath}`);
  writeLine(`Generated: ${report.generatedAt}`);
  writeLine(`Total calls: ${report.totalCalls}`);
  writeLine(`Total input tokens: ${report.totalInputTokens}`);
  writeLine(`Total output tokens: ${report.totalOutputTokens}`);
  writeLine(`Total saved tokens: ${report.totalSavedTokens}`);
  writeLine(`Net token cost: ${report.netTokenCost}`);
  writeLine(``);
  writeLine(`By capability:`);
  for (const [cap, info] of Object.entries(report.byCapability)) {
    writeLine(`  ${cap}: ${info.calls} calls, ${info.inputTokens} in, ${info.outputTokens} out, ${info.savedTokens} saved`);
  }
  if (report.totalCalls === 0) {
    writeLine(`(no telemetry recorded yet — run summarize/token-estimate/embed/search to populate)`);
  }
  return 0;
}

/**
 * simplebeacon beacon [--path .] [--query "..."] [--k 10] [--format json]
 *
 * With --query: scans the beacon index for matching targets (low-cost scan).
 * Without --query: generates a beacon index from the project.
 */
async function runBeaconCommand(options) {
  const root = resolveProjectRoot(options);

  // Scan mode: query existing beacon index
  if (options.query) {
    const indexPath = options.indexFile
      ? path.resolve(options.indexFile)
      : defaultBeaconIndexPath(root);
    let index;
    try {
      index = loadBeaconIndex(indexPath);
    } catch {
      writeLine(`No beacon index found at ${indexPath}`);
      writeLine(`Run 'simplebeacon beacon --path .' first to generate one.`);
      return 1;
    }
    const results = scanBeacons(index, options.query, {
      k: options.topK || 10,
    });
    const ledgerPath = defaultLedgerPath(root);
    recordEvent({
      ledgerPath,
      action: "beacon-scan",
      capability: "lighthouse",
      inputTokens: estimateTokens(options.query),
      outputTokens: results.length * 40,
      savedTokens: results.reduce(
        (sum, r) => sum + (r.estimatedSavedTokens || 0),
        0,
      ),
      detail: options.query.slice(0, 60),
    });
    if (options.format === "json" || options.jsonOutput === true) {
      outputResult(
        { text: JSON.stringify({ query: options.query, results }, null, 2), results },
        options,
      );
      return 0;
    }
    writeLine(`Lighthouse scan: "${options.query}"`);
    writeLine(`Top ${results.length} beacon targets:`);
    for (const r of results) {
      writeLine(
        `  [${r.score}]\t${r.targetFile}:${r.targetLine}\t${r.entityType} ${r.entityName}`,
      );
      writeLine(`        ${r.signature}`);
      writeLine(`        saved ~${r.estimatedSavedTokens} tokens vs reading full file`);
    }
    return 0;
  }

  // Generate mode: build beacon index
  writeLine(`Generating semantic beacons for: ${root}`);
  const { index, outputDir } = await generateBeaconIndex(root, {
    maxFiles: 20000,
  });
  const ledgerPath = defaultLedgerPath(root);
  recordEvent({
    ledgerPath,
    action: "beacon-generate",
    capability: "lighthouse",
    inputTokens: index.summary.totalFileTokens,
    outputTokens: index.summary.totalBeaconTokens,
    savedTokens:
      index.summary.totalFileTokens - index.summary.totalBeaconTokens,
    detail: `${index.summary.filesIndexed} files, ${index.summary.totalBeacons} beacons`,
  });
  if (options.format === "json" || options.jsonOutput === true) {
    outputResult(
      {
        text: JSON.stringify(
          {
            outputDir,
            summary: index.summary,
          },
          null,
          2,
        ),
        summary: index.summary,
      },
      options,
    );
    return 0;
  }
  writeLine(`Files indexed: ${index.summary.filesIndexed}`);
  writeLine(`Total beacons: ${index.summary.totalBeacons}`);
  writeLine(`Raw file tokens: ${index.summary.totalFileTokens}`);
  writeLine(`Beacon tokens: ${index.summary.totalBeaconTokens}`);
  writeLine(`Token reduction: ${index.summary.tokenReductionPct}%`);
  writeLine(`Index written to: ${path.join(outputDir, "beacon-index.json")}`);
  return 0;
}

module.exports = {
  runSummarizeCommand,
  runTokenEstimateCommand,
  runEmbedCommand,
  runSearchCommand,
  runTelemetryCommand,
  runBeaconCommand,
};
