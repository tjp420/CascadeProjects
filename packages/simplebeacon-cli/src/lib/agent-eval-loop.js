// simplebeacon-ignore: Scanner utility — agent eval loop, no real secrets
/**
 * Agent Evaluation Loop — orchestrates an external AI model through a
 * SimpleBeacon-validated generate → scan → feed-back → retry cycle.
 *
 * The loop:
 *   1. Sends a prompt to an AI model (OpenAI-compatible API)
 *   2. Saves the model's code output to a temporary workspace
 *   3. Runs SimpleBeacon's local scan engine on the workspace
 *   4. If findings are detected, appends them to the prompt and retries
 *   5. Repeats until the scan passes or maxAttempts is reached
 *
 * This shifts SimpleBeacon from a developer tool to an infrastructure safety
 * net — the AI model is forced to respect coupling rules and structural
 * configurations before its code can reach the codebase.
 *
 * Usage:
 *   const { runAgentEvalLoop } = require("./agent-eval-loop");
 *   const result = await runAgentEvalLoop({
 *     prompt: "Refactor the auth module",
 *     projectRoot: "./my-project",
 *     maxAttempts: 3,
 *     model: "gpt-4o",
 *     apiKey: process.env.OPENAI_API_KEY,
 *   });
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Default configuration values.
 */
const DEFAULTS = {
  maxAttempts: 3,
  model: "gpt-4o",
  apiBaseUrl: "https://api.openai.com/v1",
  temperature: 0.2,
  workspaceDir: null, // defaults to temp dir
  scanProfile: "standard",
  cleanup: true,
};

/**
 * Create a temporary workspace directory for the eval loop.
 * @param {string} prefix - Directory name prefix
 * @returns {string} Absolute path to the temp directory
 */
function createWorkspace(prefix = "sb-eval-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Save model output to the workspace.
 * The model output can be:
 *   - A string (saved as response.txt + extracted code blocks as files)
 *   - An array of {path, content} objects (saved as individual files)
 * @param {string} workspace - Workspace directory
 * @param {string|Array} output - Model output
 * @returns {string[]} List of files written
 */
function saveOutputToWorkspace(workspace, output) {
  const writtenFiles = [];
  const workspaceRoot = path.resolve(workspace);

  /**
   * Resolve a file path inside the workspace, enforcing boundary containment.
   * If the resolved path escapes the workspace root (via .. segments or
   * absolute paths), the file is flattened to its basename inside the
   * workspace root. This prevents path traversal from model output.
   * @param {string} relativePath - Path from model output
   * @returns {string} Safe absolute path inside workspace
   */
  function safeResolvePath(relativePath) {
    const resolved = path.resolve(workspaceRoot, relativePath);
    if (resolved.startsWith(workspaceRoot + path.sep) || resolved === workspaceRoot) {
      return resolved;
    }
    // Traversal attempt — flatten to basename inside workspace root
    const safeBaseName = path.basename(relativePath) || "traversal-blocked.txt";
    return path.join(workspaceRoot, safeBaseName);
  }

  if (Array.isArray(output)) {
    // Array of {path, content} — save each file
    for (const file of output) {
      if (!file.path || !file.content) continue;
      const fullPath = safeResolvePath(file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, "utf8");
      writtenFiles.push(fullPath);
    }
    return writtenFiles;
  }

  // String output — save as response.txt, then extract code blocks
  const responsePath = path.join(workspaceRoot, "response.txt");
  fs.writeFileSync(responsePath, String(output), "utf8");
  writtenFiles.push(responsePath);

  // Extract fenced code blocks and save as separate files
  const codeBlocks = extractCodeBlocks(String(output));
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    const ext = block.language || "txt";
    const blockPath = path.join(workspaceRoot, `block-${i + 1}.${ext}`);
    fs.writeFileSync(blockPath, block.code, "utf8");
    writtenFiles.push(blockPath);
  }

  return writtenFiles;
}

/**
 * Extract fenced code blocks from markdown text.
 * @param {string} text - Markdown text
 * @returns {Array<{language: string, code: string}>} Code blocks
 */
function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || "txt",
      code: match[2].trim(),
    });
  }
  return blocks;
}

/**
 * Run SimpleBeacon scan on the workspace directory.
 * Uses the local scan engine — no code is uploaded.
 * @param {string} workspace - Directory to scan
 * @param {Object} options - Scan options
 * @returns {Promise<Object>} Scan result with findings
 */
async function scanWorkspace(workspace, options = {}) {
  const { runScan } = require("../scan");
  const scanRoot = path.resolve(workspace);

  const report = await runScan(scanRoot, {
    config: null,
    configPath: null,
    fullDirectoryScan: true,
    ci: false,
    tier: "developer",
    profile: options.scanProfile || DEFAULTS.scanProfile,
  });

  // Extract findings from the report
  const issues = report.issues || report.findings || [];
  const gate = report.gate || {};
  const blockingCount = gate.blockingCount || 0;
  const highSeverity = issues.filter((i) => i.severity === "high" || i.severity === "critical");

  return {
    passed: gate.pass === true && blockingCount === 0 && highSeverity.length === 0,
    blockingCount,
    highSeverityCount: highSeverity.length,
    issues,
    gate,
    qualityScore: report.qualityScore || null,
    summary: formatFindingsSummary(issues, gate),
  };
}

/**
 * Format findings into a concise summary for the AI model's next prompt.
 * @param {Array} issues - Scan findings
 * @param {Object} gate - Gate result
 * @returns {string} Formatted summary
 */
function formatFindingsSummary(issues, gate) {
  const lines = [];
  lines.push(`SimpleBeacon scan result: ${gate.pass ? "PASS" : "FAIL"}`);
  if (gate.blockingCount) {
    lines.push(`Blocking issues: ${gate.blockingCount}`);
  }

  const shown = issues.slice(0, 15);
  for (const issue of shown) {
    const severity = (issue.severity || "medium").toUpperCase();
    const pattern = issue.pattern || issue.rule || "unknown";
    const file = issue.file || issue.path || "unknown";
    const line = issue.line || "";
    const message = issue.message || issue.description || "";
    lines.push(
      `  [${severity}] ${pattern} — ${file}${line ? `:${line}` : ""} — ${message}`,
    );
  }

  if (issues.length > shown.length) {
    lines.push(`  ... and ${issues.length - shown.length} more findings`);
  }

  return lines.join("\n");
}

/**
 * Call an OpenAI-compatible chat completion API.
 * @param {string} prompt - The prompt to send
 * @param {Object} options - { model, apiKey, apiBaseUrl, temperature }
 * @returns {Promise<string>} Model response text
 */
async function callModel(prompt, options = {}) {
  const model = options.model || DEFAULTS.model;
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const apiBaseUrl = options.apiBaseUrl || DEFAULTS.apiBaseUrl;
  const temperature = options.temperature ?? DEFAULTS.temperature;

  if (!apiKey) {
    throw new Error(
      "No API key provided. Set OPENAI_API_KEY or pass apiKey option.",
    );
  }

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a code generation assistant. Write clean, production-ready code. " +
          "Your output will be validated by SimpleBeacon's local scan engine. " +
          "Avoid AI slop patterns: no placeholder values, no mock/sample paths in production code, " +
          "no hardcoded credentials, no LLM placeholder text, no loose coupling violations.",
      },
      { role: "user", content: prompt },
    ],
    temperature,
  });

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Model returned empty response");
  }
  return content;
}

/**
 * Run the agent evaluation loop.
 *
 * @param {Object} config - Loop configuration
 * @param {string} config.prompt - The initial prompt for the AI model
 * @param {string} [config.projectRoot] - Project root for scan context
 * @param {number} [config.maxAttempts=3] - Maximum retry attempts
 * @param {string} [config.model] - Model name (OpenAI-compatible)
 * @param {string} [config.apiKey] - API key (defaults to OPENAI_API_KEY)
 * @param {string} [config.apiBaseUrl] - API base URL
 * @param {number} [config.temperature] - Sampling temperature
 * @param {string} [config.workspaceDir] - Custom workspace directory
 * @param {boolean} [config.cleanup=true] - Remove workspace after completion
 * @param {Function} [config.onAttempt] - Callback before each attempt
 * @param {Function} [config.onScanComplete] - Callback after each scan
 * @returns {Promise<Object>} Loop result
 */
async function runAgentEvalLoop(config = {}) {
  const {
    prompt: initialPrompt,
    projectRoot,
    maxAttempts = DEFAULTS.maxAttempts,
    model,
    apiKey,
    apiBaseUrl,
    temperature,
    workspaceDir,
    cleanup = DEFAULTS.cleanup,
    onAttempt,
    onScanComplete,
  } = config;

  if (!initialPrompt) {
    throw new Error("prompt is required");
  }

  const workspace = workspaceDir || createWorkspace();
  let currentPrompt = initialPrompt;
  let attempts = 0;
  let passed = false;
  let lastScanResult = null;
  let lastModelOutput = null;
  const history = [];

  try {
    while (!passed && attempts < maxAttempts) {
      attempts++;

      if (typeof onAttempt === "function") {
        onAttempt({ attempt: attempts, maxAttempts, prompt: currentPrompt });
      }

      // 1. Call the AI model
      lastModelOutput = await callModel(currentPrompt, {
        model,
        apiKey,
        apiBaseUrl,
        temperature,
      });

      // 2. Save output to workspace
      const files = saveOutputToWorkspace(workspace, lastModelOutput);

      // 3. Scan with SimpleBeacon
      lastScanResult = await scanWorkspace(workspace, config);

      if (typeof onScanComplete === "function") {
        onScanComplete({ attempt: attempts, scanResult: lastScanResult });
      }

      history.push({
        attempt: attempts,
        filesScanned: files.length,
        passed: lastScanResult.passed,
        blockingCount: lastScanResult.blockingCount,
        highSeverityCount: lastScanResult.highSeverityCount,
        qualityScore: lastScanResult.qualityScore,
      });

      if (lastScanResult.passed) {
        passed = true;
        break;
      }

      // 4. Feed findings back into the prompt for the next attempt
      if (attempts < maxAttempts) {
        currentPrompt =
          initialPrompt +
          `\n\n--- SimpleBeacon Feedback (Attempt ${attempts} failed) ---\n` +
          `Your previous code generation was scanned by SimpleBeacon and did not pass the gate.\n` +
          `Fix these specific findings:\n\n${lastScanResult.summary}\n\n` +
          `--- End SimpleBeacon Feedback ---\n\n` +
          `Please regenerate the code addressing all findings above.`;
      }
    }
  } finally {
    if (cleanup && fs.existsSync(workspace)) {
      try {
        fs.rmSync(workspace, { recursive: true, force: true });
      } catch {
        // Best effort cleanup
      }
    }
  }

  return {
    passed,
    attempts,
    maxAttempts,
    workspace: cleanup ? null : workspace,
    modelOutput: lastModelOutput,
    scanResult: lastScanResult,
    history,
  };
}

module.exports = {
  runAgentEvalLoop,
  createWorkspace,
  saveOutputToWorkspace,
  scanWorkspace,
  callModel,
  extractCodeBlocks,
  formatFindingsSummary,
  DEFAULTS,
};
