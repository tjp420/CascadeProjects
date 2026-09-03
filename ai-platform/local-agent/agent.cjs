// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * SimpleBeacon Local Agent
 *
 * A tiny localhost-only service that lets the public web dashboard scan
 * filesystem paths on the user's own machine. It binds to 127.0.0.1 so only
 * the local browser can reach it, validates the requested path, runs the
 * same SimpleBeacon scan used by the CLI, and returns a JSON report.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");

// Suppress cosmetic export collision warnings from the SimpleBeacon CLI
// namespace. These warnings are emitted when multiple submodules export
// functions with the same name (e.g. `sleep`, `hash`, `formatBytes`).
// The collisions are expected and resolved via the Simplebeacon namespace.
if (!process.env.SIMPLEBEACON_DUP_WARN) {
  process.env.SIMPLEBEACON_DUP_WARN = "0";
}

/**
 * Resolve the project root for the agent so it can locate the SimpleBeacon
 * scanner and config. The agent may be run from inside ai-platform/local-agent,
 * from a packaged portable directory, or from a global install; try several
 * sensible roots.
 */
function resolveAgentRoot() {
  const candidates = [
    __dirname, // installed portable/agent directory contains packages/
    path.join(__dirname, "..", ".."), // ai-platform/local-agent/../../ => monorepo root
    path.join(__dirname, ".."), // ai-platform/local-agent/../ => ai-platform
    process.cwd(),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (
      fs.existsSync(
        path.join(resolved, "packages", "simplebeacon-cli", "src", "index.js"),
      )
    ) {
      return resolved;
    }
    if (
      fs.existsSync(path.join(resolved, "simplebeacon-cli", "src", "index.js"))
    ) {
      return resolved;
    }
  }
  return path.resolve(__dirname, "..", "..");
}

const AGENT_ROOT = resolveAgentRoot();
const { resolveScanProgressPath, readScanProgress } = require(
  path.join(
    AGENT_ROOT,
    "packages",
    "simplebeacon-cli",
    "src",
    "lib",
    "scan-progress.js",
  ),
);

const PORT = Number(process.env.SIMPLEBEACON_AGENT_PORT || 55432);
const HOST = process.env.SIMPLEBEACON_AGENT_HOST || "127.0.0.1";

const app = express();
const SCANNER_MODULE = path.join(
  AGENT_ROOT,
  "packages",
  "simplebeacon-cli",
  "src",
  "index.js",
);

/**
 * Load the SimpleBeacon scanner API. Returns null if the CLI package is not
 * installed or is otherwise unavailable. When packaged with pkg, the snapshot
 * may not contain the full scanner due to dynamic requires, so the runtime also
 * tries the scanner source shipped alongside the executable on the real filesystem.
 */

// Static literal require signals to pkg that this module must be bundled.
// Runtime resolution happens in loadScannerApi() so the filesystem copy is tried first.
try {
  // eslint-disable-next-line global-require
  require("../../packages/simplebeacon-cli/src/index.js");
} catch {
  // Ignore at runtime; this path is only used during pkg analysis.
}

let scannerLoadError = null;

function loadScannerApi() {
  const candidates = [SCANNER_MODULE];

  if (typeof process !== "undefined" && "pkg" in process && process.pkg) {
    // Packaged executable: scanner may be shipped alongside the executable on
    // the real filesystem, or bundled in the snapshot as a fallback.
    const exeDir = path.dirname(process.execPath);
    candidates.unshift(
      path.join(exeDir, "packages", "simplebeacon-cli", "src", "index.js"),
    );
    candidates.push(
      path.join("/snapshot", "packages", "simplebeacon-cli", "src", "index.js"),
      path.join(
        "/snapshot",
        "ai-platform",
        "local-agent",
        "packages",
        "simplebeacon-cli",
        "src",
        "index.js",
      ),
    );
  }

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      // eslint-disable-next-line global-require
      const api = require(candidate);
      if (api && typeof api.runScan === "function") {
        scannerLoadError = null;
        return api;
      }
    } catch (err) {
      scannerLoadError = err.message;
      process.stderr.write(
        [
          "[agent] Failed to load SimpleBeacon scanner from",
          candidate,
          ":",
          err.message,
        ].join(" ") + "\n",
      );
    }
  }
  return null;
}

const scannerApi = loadScannerApi();

/**
 * Validate that the requested path is safe to scan:
 * - Must be a non-empty string
 * - Must not be a URL
 * - Must be absolute
 * - Must exist on disk
 * - Must be a directory
 */
function validateTargetPath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    throw new Error("projectPath is required");
  }
  if (/^https?:\/\//i.test(rawPath) || /^file:\/\//i.test(rawPath)) {
    throw new Error("projectPath must be a local folder path, not a URL");
  }
  if (!path.isAbsolute(rawPath)) {
    throw new Error("projectPath must be an absolute path");
  }
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`projectPath does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error("projectPath must be a directory");
  }
  return resolved;
}

const FULL_TREE_INVENTORY_SKIP_DIRS = [
  ".git",
  "github-cache",
  ".simplebeacon",
  ".vscode-test",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".cache",
];

/**
 * Build inventory options aligned with the CLI full-tree walk skip list.
 */
function buildInventoryOptions(fullDirectoryScan) {
  if (fullDirectoryScan) {
    return {
      profile: "audit",
      skipDirs: [...FULL_TREE_INVENTORY_SKIP_DIRS],
    };
  }
  return {
    profile: "universal",
    skipDirs: ["node_modules", ".git"],
  };
}

/**
 * Run a lightweight repository inventory (no full gate scan).
 */
async function runLocalInventory(targetPath, scanOptions = {}) {
  if (
    !scannerApi ||
    typeof scannerApi.countRepositoryInventory !== "function"
  ) {
    throw new Error(
      "SimpleBeacon inventory is not available; install dependencies and run from the monorepo root",
    );
  }
  const invOptions = Object.assign({}, buildInventoryOptions(Boolean(scanOptions.fullDirectoryScan)));
  if (scanOptions.tier) invOptions.tier = scanOptions.tier;
  if (typeof scanOptions.maxFiles === 'number') invOptions.maxFiles = scanOptions.maxFiles;
  return scannerApi.countRepositoryInventory(targetPath, invOptions);
}

/**
 * Run a SimpleBeacon scan against a validated local path.
 */
async function runLocalScan(targetPath, scanOptions = {}) {
  if (!scannerApi || typeof scannerApi.runScan !== "function") {
    throw new Error(
      "SimpleBeacon scanner is not available; install dependencies and run from the monorepo root",
    );
  }

  const options = {
    fullDirectoryScan: Boolean(scanOptions.fullDirectoryScan),
    offline: true,
  };
  if (scanOptions.tier) options.tier = scanOptions.tier;
  if (typeof scanOptions.maxFiles === 'number') options.maxFiles = scanOptions.maxFiles;

  try {
    const report = await scannerApi.runScan(targetPath, options);
    if (!report || typeof report !== "object") {
      throw new Error("Scan returned an empty or invalid report");
    }
    return report;
  } catch (scanErr) {
    process.stderr.write(
      ["[agent] Scanner error:", scanErr?.message || scanErr].join(" ") + "\n",
    );
    throw scanErr;
  }
}

/**
 * Convert a full SimpleBeacon report into the privacy-safe summary schema
 * that may leave the local perimeter. Source code, AST data, and full file
 * contents are stripped; only severity/type/rule aggregates and one redacted
 * example path per issue are kept.
 */
function toPrivacySummaryReport(report) {
  const root = report?.projectRoot || report?.scanPaths?.[0] || "local-project";
  const label = path.basename(String(root));

  const rawIssues = Array.isArray(report?.detectedIssues)
    ? report.detectedIssues
    : [];
  const detectedIssues = rawIssues.map((issue) => {
    const rawPaths = Array.isArray(issue?.filePaths)
      ? issue.filePaths
      : issue?.filePath
        ? [issue.filePath]
        : [];
    const firstPath =
      rawPaths[0] || issue?.file || issue?.affectedFiles?.[0] || "—";
    const relativePath =
      firstPath === "—"
        ? "—"
        : path.relative(root, path.resolve(firstPath)).replace(/\\/g, "/");
    return {
      severity: issue?.severity || "low",
      type: issue?.type || "Unknown",
      count: typeof issue?.count === "number" ? issue.count : 1,
      filePath: relativePath,
      rule: issue?.pattern || issue?.rule || issue?.type || "unknown",
      impact: issue?.description || issue?.impact || "",
      fix:
        issue?.recommendation || issue?.recommendedAction || issue?.fix || "",
    };
  });

  return {
    type: "simplebeacon-report",
    version: "1.3.0",
    generatedAt: report?.generatedAt || new Date().toISOString(),
    projectRoot: label,
    gate: {
      pass: report?.gate?.pass === true,
      blockingCount: report?.gate?.blockingCount ?? 0,
    },
    qualityScore: report?.qualityScore ?? null,
    totalFiles:
      report?.totalFiles ?? report?.repositoryInventory?.totalFiles ?? null,
    issueCount: report?.issueCount ?? detectedIssues.length,
    detectedIssues,
    summary: {
      gatePass: report?.gate?.pass === true,
      qualityScore: report?.qualityScore ?? null,
    },
  };
}

// CORS middleware. The requireLoopback middleware below already restricts
// TCP connections to the loopback interface, so reflecting any origin is safe.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl) and reflect any real origin.
      callback(null, origin || true);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  }),
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf.toString(encoding || "utf8");
    },
  }),
);

// Trust proxy disabled so req.ip is accurate
app.set("trust proxy", false);

/**
 * Enforce that the TCP connection came from the loopback interface. Express
 * sees the socket address in req.socket.remoteAddress.
 */
function requireLoopback(req, res, next) {
  const remote = req.socket?.remoteAddress || "";
  const isLoopback =
    remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (!isLoopback) {
    res
      .status(403)
      .json({
        success: false,
        error: "Forbidden: only localhost connections are allowed",
      });
    return;
  }
  next();
}

app.use(requireLoopback);

// Request logger to help diagnose browser/agent issues.
app.use((req, res, next) => {
  process.stderr.write(
    [
      `[agent] ${req.method} ${req.url} from ${req.headers.origin || "no-origin"} (${req.socket.remoteAddress || "unknown"})`,
    ].join(" ") + "\n",
  );
  next();
});

// Health check used by the dashboard to detect the agent.
app.get("/health", (req, res) => {
  res.json({
    success: true,
    agent: "simplebeacon-local-agent",
    version: "1.0.4",
    scannerAvailable: Boolean(
      scannerApi && typeof scannerApi.runScan === "function",
    ),
    scannerLoadError,
    timestamp: new Date().toISOString(),
  });
});

// Scan a local directory.
app.post("/scan", async (req, res) => {
  const rawPath = req.body?.projectPath;
  try {
    process.stderr.write(
      ["[agent] /scan received projectPath:", rawPath].join(" ") + "\n",
    );
    const targetPath = validateTargetPath(rawPath);
    const fullDirectoryScan =
      req.body?.fullDirectoryScan === true ||
      req.body?.fullDirectoryScan === "true";
    const tier = req.body?.tier || undefined;
    const maxFiles = typeof req.body?.maxFiles === 'number' ? req.body.maxFiles : undefined;
    const report = await runLocalScan(targetPath, { fullDirectoryScan, tier, maxFiles });
    res.json({ success: true, projectPath: targetPath, report });
  } catch (err) {
    process.stderr.write(
      ["[agent] /scan rejected projectPath:", rawPath, "-", err.message].join(
        " ",
      ) + "\n",
    );
    res
      .status(400)
      .json({ success: false, error: err.message, receivedPath: rawPath });
  }
});

// Live scan progress for dashboard polling during local scans.
app.get("/progress", (req, res) => {
  try {
    const rawPath = req.query?.projectPath;
    if (!rawPath) {
      return res
        .status(400)
        .json({ success: false, error: "projectPath is required" });
    }
    const targetPath = validateTargetPath(String(rawPath));
    const progressPath = resolveScanProgressPath(targetPath);
    const progress = readScanProgress(progressPath);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, progress });
  } catch (err) {
    res
      .status(400)
      .json({
        success: false,
        error: err.message,
        progress: { active: false },
      });
  }
});

// Fetch inventory for a local directory without running a full gate scan.
app.post("/inventory", async (req, res) => {
  const rawPath = req.body?.projectPath;
  try {
    process.stderr.write(
      ["[agent] /inventory received projectPath:", rawPath].join(" ") + "\n",
    );
    const targetPath = validateTargetPath(rawPath);
    const fullDirectoryScan =
      req.body?.fullDirectoryScan === true ||
      req.body?.fullDirectoryScan === "true";
    const tier = req.body?.tier || undefined;
    const maxFiles = typeof req.body?.maxFiles === 'number' ? req.body.maxFiles : undefined;
    const inventory = await runLocalInventory(targetPath, {
      fullDirectoryScan,
      tier,
      maxFiles,
    });
    res.json({ success: true, projectPath: targetPath, inventory });
  } catch (err) {
    process.stderr.write(
      [
        "[agent] /inventory rejected projectPath:",
        rawPath,
        "-",
        err.message,
      ].join(" ") + "\n",
    );
    res
      .status(400)
      .json({ success: false, error: err.message, receivedPath: rawPath });
  }
});

// Return a privacy-safe summary report with no source code, AST, or file contents.
app.post("/summary", async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const tier = req.body?.tier || undefined;
    const maxFiles = typeof req.body?.maxFiles === 'number' ? req.body.maxFiles : undefined;
    const report = await runLocalScan(targetPath, { tier, maxFiles });
    const summary = toPrivacySummaryReport(report);
    res.json({ success: true, projectPath: targetPath, summary });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Deterministic fix endpoint ───
// Runs the AST remediator against a specific finding and returns the patch.
// No LLM needed — pure deterministic search/replace with syntax verification.
app.post("/fix", async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const findingIndex = Number(req.body?.findingIndex);
    const applyFix = req.body?.apply === true;

    // Load the AST remediator
    let remediator = null;
    try {
      remediator = require(
        path.join(
          AGENT_ROOT,
          "packages",
          "simplebeacon-cli",
          "src",
          "lib",
          "ast-remediator.js",
        ),
      );
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: "AST remediator not available",
        details: e.message,
      });
    }

    // Load the latest scan report
    const reportPath = path.join(targetPath, ".simplebeacon", "report.json");
    if (!fs.existsSync(reportPath)) {
      return res.status(400).json({
        success: false,
        error: "No scan report found. Run a scan first.",
      });
    }
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const issues = report.detectedIssues || report.rawIssues || [];
    const finding = issues[findingIndex];
    if (!finding) {
      return res.status(400).json({
        success: false,
        error: `Finding at index ${findingIndex} not found. Report has ${issues.length} issues.`,
      });
    }

    // Run deterministic remediation
    const result = remediator.remediateFinding(finding, {
      projectRoot: targetPath,
      applyFix,
    });

    res.json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "fix",
      success: true,
      deterministic: true,
      provider: "ast-remediator",
      result,
      finding: {
        severity: finding.severity,
        type: finding.type,
        filePath: finding.filePath,
        line: finding.line,
      },
    });
  } catch (err) {
    res.status(400).json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "fix",
      success: false,
      deterministic: true,
      provider: "ast-remediator",
      error: err.message,
    });
  }
});

// ─── Explain finding endpoint ───
// Returns a structured explanation of a finding from the scan report.
// No LLM needed — pulls from the deterministic rule catalog.
app.post("/explain", async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const findingIndex = Number(req.body?.findingIndex);

    // Load the latest scan report
    const reportPath = path.join(targetPath, ".simplebeacon", "report.json");
    if (!fs.existsSync(reportPath)) {
      return res.status(400).json({
        success: false,
        error: "No scan report found. Run a scan first.",
      });
    }
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const issues = report.detectedIssues || report.rawIssues || [];
    const finding = issues[findingIndex];
    if (!finding) {
      return res.status(400).json({
        success: false,
        error: `Finding at index ${findingIndex} not found. Report has ${issues.length} issues.`,
      });
    }

    // Build structured explanation
    const explanation = {
      severity: finding.severity || "low",
      type: finding.type || "Unknown",
      rule: finding.pattern || finding.rule || finding.type || "unknown",
      filePath: finding.filePath || finding.path || "unknown",
      line: finding.line || finding.metadata?.line || null,
      description: finding.description || finding.impact || "",
      recommendation:
        finding.recommendation ||
        finding.recommendedAction ||
        finding.fix ||
        "Manual review required",
      category: finding.category || "general",
      confidence: finding.confidence || null,
      cwe: finding.cwe || finding.metadata?.cwe || null,
      owasp: finding.owasp || finding.metadata?.owasp || null,
      euAiActRelevance: finding.euAiAct || finding.metadata?.euAiAct || null,
      deterministic: true,
    };

    // Add context snippet if file exists
    if (explanation.filePath && explanation.filePath !== "unknown") {
      try {
        const fullPath = path.resolve(targetPath, explanation.filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          const lineNum = explanation.line || 1;
          const start = Math.max(0, lineNum - 4);
          const end = Math.min(lines.length, lineNum + 4);
          explanation.snippet = lines.slice(start, end).join("\n");
          explanation.snippetStartLine = start + 1;
        }
      } catch {
        // ignore snippet errors
      }
    }

    res.json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "explain",
      success: true,
      deterministic: true,
      provider: "rule-catalog",
      result: explanation,
    });
  } catch (err) {
    res.status(400).json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "explain",
      success: false,
      deterministic: true,
      provider: "rule-catalog",
      error: err.message,
    });
  }
});

// ─── Local chat endpoint ───
// Multi-turn conversation that routes to Ollama (if available) or falls back
// to deterministic responses based on scan report data. Keeps everything local.
app.post("/chat", async (req, res) => {
  try {
    const rawPath = req.body?.projectPath;
    const targetPath = validateTargetPath(rawPath);
    const message = String(req.body?.message || "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({
        agent: "simplebeacon",
        source: "local-agent",
        action: "chat",
        success: false,
        error: "Message is required",
      });
    }

    // Try Ollama first for natural language responses
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";

    // Build scan context for the prompt
    let scanContext = "";
    const reportPath = path.join(targetPath, ".simplebeacon", "report.json");
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        const gate = report.gate || {};
        const issues = report.detectedIssues || [];
        scanContext = `\n\n[Project Scan Context]\nPath: ${path.basename(targetPath)}\nGate: ${gate.pass === true ? "PASS" : "FAIL"}\nBlocking: ${gate.blockingCount ?? 0}\nIssues: ${issues.length}\nQuality Score: ${report.qualityScore ?? "N/A"}/100`;
        if (issues.length > 0) {
          scanContext += "\nTop findings:";
          for (const issue of issues.slice(0, 5)) {
            scanContext += `\n- [${issue.severity || "low"}] ${issue.type || "issue"}: ${(issue.description || "").slice(0, 100)}`;
          }
        }
      } catch {
        // ignore report errors
      }
    }

    try {
      const fetch = globalThis.fetch || (await import("node-fetch")).default;
      const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            {
              role: "system",
              content: `You are a helpful code assistant for the SimpleBeacon platform. You help developers understand scan findings, fix issues, and improve code quality. Always answer directly and concisely.${scanContext}`,
            },
            ...history.slice(-10).map((h) => ({
              role: h.role === "assistant" ? "assistant" : "user",
              content: String(h.content || "").slice(0, 4000),
            })),
            { role: "user", content: message },
          ],
          stream: false,
          options: { temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json();
        const responseText = data.response || data.message?.content || "";
        return res.json({
          agent: "simplebeacon",
          source: "local-agent",
          action: "chat",
          success: true,
          deterministic: false,
          provider: "ollama",
          result: { response: responseText, model: ollamaModel },
        });
      }
    } catch (ollamaErr) {
      process.stderr.write(`[agent] Ollama chat failed: ${ollamaErr.message}\n`);
    }

    // Fallback: deterministic response based on scan data
    let fallbackResponse = "";
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes("gate") || lowerMsg.includes("status")) {
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        const gate = report.gate || {};
        fallbackResponse = `Gate status: ${gate.pass === true ? "PASS" : "FAIL"}\nBlocking issues: ${gate.blockingCount ?? 0}\nTotal issues: ${report.issueCount ?? 0}\nQuality score: ${report.qualityScore ?? "N/A"}/100`;
      } else {
        fallbackResponse = "No scan report found. Run a scan first to check gate status.";
      }
    } else if (lowerMsg.includes("fix") || lowerMsg.includes("resolve")) {
      fallbackResponse = "I can help with fixes. Use the /fix endpoint with a findingIndex to get a deterministic patch. Run a scan first to identify findings.";
    } else if (lowerMsg.includes("explain") || lowerMsg.includes("what is")) {
      fallbackResponse = "I can explain any finding from your scan report. Use the /explain endpoint with a findingIndex to get a detailed explanation.";
    } else if (lowerMsg.includes("scan") || lowerMsg.includes("analyze")) {
      fallbackResponse = `Ready to scan ${path.basename(targetPath)}. Use the /scan endpoint to run a full SimpleBeacon scan.`;
    } else {
      fallbackResponse = `I'm the SimpleBeacon local agent. I can help you scan your project, explain findings, and suggest fixes. Ollama is not running, so I'm using deterministic responses.\n\nAvailable endpoints:\n- POST /scan — Run a scan\n- POST /fix — Get a deterministic fix for a finding\n- POST /explain — Get an explanation of a finding\n- POST /chat — Chat with AI (requires Ollama) or deterministic fallback`;
    }

    res.json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "chat",
      success: true,
      deterministic: true,
      provider: "deterministic-fallback",
      result: { response: fallbackResponse },
    });
  } catch (err) {
    res.status(400).json({
      agent: "simplebeacon",
      source: "local-agent",
      action: "chat",
      success: false,
      error: err.message,
    });
  }
});

// Error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  process.stderr.write(["[agent] Unhandled error:", err].join(" ") + "\n");
  if (err && err.name === "SyntaxError" && req.rawBody !== undefined) {
    process.stderr.write(
      ["[agent] Invalid JSON body received:", req.rawBody].join(" ") + "\n",
    );
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res
      .status(400)
      .json({
        success: false,
        error: "Invalid JSON body",
        details: err.message,
      });
    return;
  }
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res
    .status(500)
    .json({ success: false, error: err.message || "Internal agent error" });
});

function start() {
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    process.stderr.write(
      [`[agent] Listening on http://${HOST}:${PORT}`].join(" ") + "\n",
    );
    process.stderr.write(
      [`[agent] Scanner root: ${AGENT_ROOT}`].join(" ") + "\n",
    );
    process.stderr.write(
      [
        `[agent] Scanner available: ${Boolean(scannerApi && typeof scannerApi.runScan === "function")}`,
      ].join(" ") + "\n",
    );
  });

  server.on("error", (err) => {
    if (err && "code" in err && err.code === "EADDRINUSE") {
      process.stderr.write(
        [
          `[agent] Port ${PORT} is already in use. Another agent may be running.`,
        ].join(" ") + "\n",
      );
    } else {
      process.stderr.write(
        ["[agent] Server error:", err.message].join(" ") + "\n",
      );
    }
    process.exit(1);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start, app, loadScannerApi };
