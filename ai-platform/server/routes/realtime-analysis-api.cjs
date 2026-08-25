/**
 * Real-time Analysis API
 *
 * Provides streaming analysis capabilities for live code analysis
 * with WebSocket support and incremental updates.
 *
 * Also provides POST /api/realtime/scan-content for the VS Code extension
 * to send file buffer content for deterministic scanning via the CLI engine,
 * without requiring the file to exist on disk. Content is written to a
 * temporary file, scanned with the full 38+ engine CLI suite, and findings
 * are returned as JSON. All processing is local — no content leaves the
 * engine process.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const WebSocket = require("ws");
const {
  progressiveAnalysis,
  StreamingAnalyzer,
  ANALYSIS_PROFILES,
} = require("../lib/enhanced-ai-orchestrator.cjs");
const { ensureRegistry } = require("../services/local-model-service.cjs");
const { getUserAiCredentials } = require("../lib/user-ai-keys-store.cjs");
const logger = require("../../src/lib/app-logger.cjs");
const rateLimit = require("express-rate-limit");
const { sendError } = require("../lib/response-helpers.cjs");

// In-memory storage for active analysis sessions
const activeSessions = new Map();
const sessionTimeouts = new Map();

/**
 * Session cleanup interval
 */
const sessionCleanupInterval = setInterval(
  () => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions) {
      if (now - session.lastActivity > 30 * 60 * 1000) {
        // 30 minutes
        activeSessions.delete(sessionId);
        sessionTimeouts.delete(sessionId);
        logger.info(`[Realtime API] Cleaned up inactive session: ${sessionId}`);
      }
    }
  },
  5 * 60 * 1000,
); // Check every 5 minutes
process.on("SIGINT", () => {
  clearInterval(sessionCleanupInterval);
});
process.on("SIGTERM", () => {
  clearInterval(sessionCleanupInterval);
});

/**
 * Create analysis session
 */
function createAnalysisSession(options = {}) {
  const sessionId = generateSessionId();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    analyzer: new StreamingAnalyzer(options),
    options,
    status: "active",
    chunks: new Map(),
    results: new Map(),
  };

  activeSessions.set(sessionId, session);

  // Set timeout for session cleanup
  const timeout = setTimeout(
    () => {
      activeSessions.delete(sessionId);
      sessionTimeouts.delete(sessionId);
    },
    30 * 60 * 1000,
  ); // 30 minutes

  sessionTimeouts.set(sessionId, timeout);

  return session;
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${crypto.randomBytes(6).toString("base64url")}`;
}

/**
 * Rate limiting for real-time analysis
 */
const realtimeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: "Too many analysis requests, please try again later.",
  },
});

/**
 * Setup real-time analysis routes
 */
function setupRealtimeAnalysisAPI(app, options = {}) {
  const baseDir = options.baseDir || process.cwd();
  const monorepoRoot = options.monorepoRoot || path.join(baseDir, "..");

  // Rate limiting
  app.use("/api/realtime", realtimeRateLimit);

  /**
   * POST /api/realtime/scan-content
   *
   * Scans file content (from an editor buffer) using the full CLI scanner suite.
   * The extension sends { content, filename, language? } and receives findings
   * as a JSON array. Content is written to a temp file, scanned, and the temp
   * file is deleted. All processing is local — no content leaves the engine.
   *
   * This endpoint is designed for the VS Code extension's real-time diagnostic
   * engine. It provides access to all 38+ CLI scanner engines (secrets, CVEs,
   * dead code, ReDoS, weak crypto, PII, hallucinated imports, OWASP LLM, EU AI
   * Act, etc.) without requiring the file to be saved to disk first.
   *
   * Privacy: Content is processed in-memory on localhost. No content is logged,
   * transmitted, or persisted after the scan completes.
   */
  app.post("/api/realtime/scan-content", async (req, res) => {
    let tempDir = null;
    try {
      const { content, filename, language } = req.body || {};

      if (typeof content !== "string") {
        return sendError(res, 400, "content (string) is required");
      }
      if (typeof filename !== "string" || !filename.trim()) {
        return sendError(res, 400, "filename (string) is required");
      }

      // Safety: cap content size at 2MB to prevent abuse
      if (content.length > 2 * 1024 * 1024) {
        return sendError(res, 413, "Content exceeds 2MB limit");
      }

      // Sanitize filename — only keep the basename, no path traversal
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeName || safeName === "." || safeName === "..") {
        return sendError(res, 400, "Invalid filename");
      }

      // Create temp directory and write content
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-scan-"));
      const tempFile = path.join(tempDir, safeName);
      fs.writeFileSync(tempFile, content, "utf8");

      // Run the CLI scanner on the temp file
      const cliBin = path.join(
        monorepoRoot,
        "packages",
        "simplebeacon-cli",
        "bin",
        "simplebeacon.js",
      );
      const reportOut = path.join(tempDir, "report.json");

      const { execFile } = require("child_process");
      const { promisify } = require("util");
      const execFileAsync = promisify(execFile);

      let findings = [];
      let cliAvailable = false;

      if (fs.existsSync(cliBin)) {
        cliAvailable = true;
        try {
          const { stdout, stderr } = await execFileAsync(
            "node",
            [
              cliBin,
              "scan",
              "--path",
              tempDir,
              "--format",
              "json",
              "--output",
              reportOut,
              "--tier",
              "executive",
            ],
            {
              timeout: 15000,
              maxBuffer: 5 * 1024 * 1024,
              cwd: monorepoRoot,
            },
          );

          // Read the report
          if (fs.existsSync(reportOut)) {
            const report = JSON.parse(fs.readFileSync(reportOut, "utf8"));
            findings = report.findings || report.rawIssues || [];
          } else {
            // Try to parse stdout as JSON
            try {
              const parsed = JSON.parse(stdout);
              findings = parsed.findings || parsed.rawIssues || [];
            } catch (e) {
              console.error("realtime-analysis-api.cjs error:", e);
              // No JSON output — return empty findings
            }
          }
        } catch (cliErr) {
          console.error("realtime-analysis-api.cjs error:", cliErr);
          // CLI may exit non-zero on gate failure — still try to read the report
          if (fs.existsSync(reportOut)) {
            try {
              const report = JSON.parse(fs.readFileSync(reportOut, "utf8"));
              findings = report.findings || report.rawIssues || [];
            } catch (e) {
              console.error("realtime-analysis-api.cjs error:", e);
              // Report not readable
            }
          } else {
            logger.warn("[Scan Content] CLI scan failed:", cliErr.message);
          }
        }
      } else {
        // Fallback: use programmatic comprehensive scanner
        try {
          const { scanFileFast } = require(
            path.join(
              monorepoRoot,
              "packages",
              "simplebeacon-cli",
              "src",
              "rules",
              "comprehensive-scanner.js",
            ),
          );
          const ext = path.extname(safeName).slice(1).toLowerCase();
          const ruleCounters = {};
          findings = scanFileFast(safeName, ext, content, ruleCounters) || [];
          cliAvailable = false;
        } catch (fallbackErr) {
          logger.warn(
            "[Scan Content] Programmatic fallback failed:",
            fallbackErr.message,
          );
          findings = [];
        }
      }

      // Normalize findings to a consistent format
      const normalizedFindings = findings.map((f) => ({
        id: f.id || f.ruleId || "unknown",
        severity: f.severity || "low",
        type: f.type || f.category || "unknown",
        filePath: filename, // Use the original filename, not the temp path
        line: f.line || f.lineNumber || 1,
        column: f.column || 1,
        description: f.description || f.message || "",
        recommendedAction: f.recommendedAction || f.suggestion || "",
        pattern: f.pattern || f.match || "",
        engine: f.engine || (cliAvailable ? "cli" : "comprehensive-scanner"),
      }));

      res.json({
        success: true,
        filename,
        language: language || path.extname(safeName).slice(1) || "unknown",
        engineUsed: cliAvailable
          ? "cli-38-engines"
          : "comprehensive-scanner-fallback",
        findingCount: normalizedFindings.length,
        findings: normalizedFindings,
        scannedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[Scan Content] Endpoint failed:", error);
      sendError(res, 500, "Failed to scan content");
    } finally {
      // Always clean up the temp directory
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          console.error("realtime-analysis-api.cjs error:", e);
          // Best-effort cleanup
        }
      }
    }
  });

  /**
   * Create new analysis session
   */
  app.post("/api/realtime/session", async (req, res) => {
    try {
      const {
        profile = "balanced",
        analysisType = "general",
        options = {},
      } = req.body;

      const session = createAnalysisSession({
        profile,
        analysisType,
        baseDir,
        ...options,
      });

      res.json({
        success: true,
        sessionId: session.id,
        profile: session.options.profile,
        analysisType: session.options.analysisType,
        createdAt: session.createdAt,
      });
    } catch (error) {
      logger.error("[Realtime API] Session creation failed:", error);
      sendError(res, 500, "Failed to create analysis session");
    }
  });

  /**
   * Analyze code chunk
   */
  app.post("/api/realtime/analyze/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content, chunkId, context = {} } = req.body;

      const session = activeSessions.get(sessionId);
      if (!session) {
        return sendError(res, 404, "Session not found or expired");
      }

      // Update last activity
      session.lastActivity = Date.now();

      // Analyze chunk
      const result = await session.analyzer.analyzeChunk(chunkId, content, {
        ...context,
        baseDir,
      });

      session.chunks.set(chunkId, { content, context, timestamp: Date.now() });
      session.results.set(chunkId, result);

      res.json({
        success: true,
        sessionId,
        chunkId,
        result,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("[Realtime API] Chunk analysis failed:", error);
      sendError(res, 500, "Failed to analyze chunk");
    }
  });

  /**
   * Get session results
   */
  app.get("/api/realtime/session/:sessionId/results", (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = activeSessions.get(sessionId);

      if (!session) {
        return sendError(res, 404, "Session not found or expired");
      }

      const results = session.analyzer.getAllResults();

      res.json({
        success: true,
        sessionId,
        results,
        totalChunks: results.length,
        sessionAge: Date.now() - session.createdAt,
      });
    } catch (error) {
      logger.error("[Realtime API] Results retrieval failed:", error);
      sendError(res, 500, "Failed to retrieve results");
    }
  });

  /**
   * Get session status
   */
  app.get("/api/realtime/session/:sessionId/status", (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = activeSessions.get(sessionId);

      if (!session) {
        return sendError(res, 404, "Session not found or expired");
      }

      res.json({
        success: true,
        sessionId,
        status: session.status,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        chunkCount: session.chunks.size,
        profile: session.options.profile,
        analysisType: session.options.analysisType,
      });
    } catch (error) {
      logger.error("[Realtime API] Status check failed:", error);
      sendError(res, 500, "Failed to get session status");
    }
  });

  /**
   * Close session
   */
  app.delete("/api/realtime/session/:sessionId", (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = activeSessions.get(sessionId);

      if (session) {
        activeSessions.delete(sessionId);
        const timeout = sessionTimeouts.get(sessionId);
        if (timeout) {
          clearTimeout(timeout);
          sessionTimeouts.delete(sessionId);
        }
      }

      res.json({
        success: true,
        sessionId,
        message: "Session closed successfully",
      });
    } catch (error) {
      logger.error("[Realtime API] Session closure failed:", error);
      sendError(res, 500, "Failed to close session");
    }
  });

  /**
   * WebSocket endpoint for real-time streaming
   */
  const wss = new WebSocket.Server({
    port: process.env.REALTIME_WS_PORT || 8082,
    path: "/api/realtime/stream",
  });

  wss.on("connection", (ws, req) => {
    const sessionId = extractSessionId(req.url);
    if (!sessionId) {
      ws.close(1008, "Session ID required");
      return;
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      ws.close(1008, "Session not found or expired");
      return;
    }

    logger.info(`[Realtime API] WebSocket connected for session: ${sessionId}`);

    // Send initial status
    ws.send(
      JSON.stringify({
        type: "status",
        sessionId,
        status: "connected",
        timestamp: Date.now(),
      }),
    );

    // Handle messages
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "analyze") {
          const { content, chunkId, context } = message;
          const result = await session.analyzer.analyzeChunk(chunkId, content, {
            ...context,
            baseDir,
          });

          ws.send(
            JSON.stringify({
              type: "analysis_result",
              sessionId,
              chunkId,
              result,
              timestamp: Date.now(),
            }),
          );
        } else if (message.type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
              sessionId,
              timestamp: Date.now(),
            }),
          );
        }
      } catch (error) {
        logger.error(
          "[Realtime API] WebSocket message handling failed:",
          error,
        );
        ws.send(
          JSON.stringify({
            type: "error",
            sessionId,
            error: "Failed to process message",
            timestamp: Date.now(),
          }),
        );
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      logger.info(
        `[Realtime API] WebSocket disconnected for session: ${sessionId}`,
      );
    });

    // Handle errors
    ws.on("error", (error) => {
      logger.error("[Realtime API] WebSocket error");
    });
  });

  logger.info("[Realtime API] WebSocket server started on port 8082");
}

/**
 * Extract session ID from WebSocket URL
 */
function extractSessionId(url) {
  const match = url.match(/[?&]sessionId=([^&]+)/);
  return match ? match[1] : null;
}

module.exports = {
  setupRealtimeAnalysisAPI,
  createAnalysisSession,
  generateSessionId,
};
