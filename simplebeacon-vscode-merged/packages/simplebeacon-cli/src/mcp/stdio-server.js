/**
 * Minimal MCP stdio server (JSON-RPC 2.0) — zero extra npm dependencies.
 * Implements tools/list + tools/call for Cursor, Claude Desktop, etc.
 */

const readline = require("readline");
const { TOOL_DEFINITIONS, createMcpToolHandlers } = require("./tools");
const {
  compressScanReport,
  compressGateStatus,
  compressSuggestions,
  estimateTokens,
} = require("../reporters/agent-compressor.cjs");

// Agent telemetry — tracks hallucinations squashed per scan
// Lazy-loaded to avoid breaking if telemetry service is unavailable
let telemetryService = null;
function getTelemetry() {
  if (!telemetryService) {
    try {
      telemetryService = require("../../../../ai-platform/server/lib/agent-telemetry-service.cjs");
    } catch {
      // Telemetry service not available — scan results pass through without recording
      telemetryService = null;
    }
  }
  return telemetryService;
}

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "simplebeacon", version: "1.3.0" };

function createMcpStdioServer(options = {}) {
  const handlers = createMcpToolHandlers(options);
  let initialized = false;
  const activeRequests = new Map(); // requestId -> { cancelled, startTime }
  const logger = {
    log: (...a) => {
      if (options.debug) console.error("[MCP]", ...a);
    },
  };

  function send(message) {
    const line = JSON.stringify(message);
    process.stdout.write(`${line}\n`);
    logger.log(
      "→",
      message.method || message.id || "notify",
      line.length,
      "bytes",
    );
  }

  function sendProgress(token, progress, total) {
    send({
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: { progressToken: token, progress, total },
    });
  }

  /**
   * TOON (Token-Optimized Object Notation) compression.
   * Recursively strips null, undefined, empty strings, empty arrays, and empty objects
   * from tool results before returning to the LLM agent.
   * This reduces output token consumption without losing meaningful data.
   *
   * Disabled when SIMPLEBEACON_NO_COMPRESS=1 (for debugging raw tool output).
   */
  function compressToolResult(result) {
    if (!result || process.env.SIMPLEBEACON_NO_COMPRESS === "1") return result;
    try {
      return compressValue(result);
    } catch {
      return result; // If compression fails, return original
    }
  }

  function compressValue(val) {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      return val === "" ? undefined : val;
    }
    if (typeof val === "number" || typeof val === "boolean") return val;
    if (Array.isArray(val)) {
      const compressed = val.map(compressValue).filter((v) => v !== undefined);
      return compressed.length === 0 ? undefined : compressed;
    }
    if (typeof val === "object") {
      const result = {};
      let hasKeys = false;
      for (const [key, value] of Object.entries(val)) {
        const compressed = compressValue(value);
        if (compressed !== undefined) {
          result[key] = compressed;
          hasKeys = true;
        }
      }
      return hasKeys ? result : undefined;
    }
    return val;
  }

  /**
   * Apply payload compression to specific tool results that return large JSON.
   * Uses agent-compressor.cjs for scan reports, gate status, and suggestions.
   * Falls through to TOON compression for all other tools.
   */
  function compressToolPayload(toolName, result) {
    if (!result || process.env.SIMPLEBEACON_NO_COMPRESS === "1") return result;

    try {
      // Tools that return full scan reports (have gate/detectedIssues structure).
      // NOTE: scan_snippet and scan_file are NOT here — they return compact
      // {filePath, findingCount, findings} objects, not full reports. Their
      // own `compressed` arg handles per-finding compression. Running them
      // through compressScanReport mangles the shape (loses findingCount).
      const reportTools = new Set(["scan_project", "scan_staged", "scan_deployment_readiness"]);
      // Tools that return raw gate objects (with pass/blockingIssues/warningIssues).
      // NOTE: gate_status returns {ok, gatePass, blockingCount, topBlocking} — not a
      // raw gate. handoff_check returns {agentId, gate, ...}. Neither matches the
      // compressGateStatus input shape, so running them through it loses the `ok`
      // field and mangles the structure. They still get TOON compression below.
      const gateTools = new Set(["gate_finalize"]);
      // Tools that return suggestions
      const suggestionTools = new Set(["suggest_fixes", "code_suggestions", "get_action_plan"]);

      const content = result.content;
      if (!Array.isArray(content)) return result;

      // For report tools, try to parse and compress the text content
      if (reportTools.has(toolName) || gateTools.has(toolName) || suggestionTools.has(toolName)) {
        const newContent = content.map((block) => {
          if (block.type !== "text" || !block.text) return block;
          try {
            const parsed = JSON.parse(block.text);
            let compressed;
            if (reportTools.has(toolName) && parsed) {
              compressed = compressScanReport(parsed);
            } else if (gateTools.has(toolName) && parsed) {
              compressed = compressGateStatus(parsed);
            } else if (suggestionTools.has(toolName) && parsed) {
              compressed = compressSuggestions(parsed);
            } else {
              return block;
            }
            return { type: "text", text: JSON.stringify(compressed) };
          } catch {
            // Not JSON — leave as-is
            return block;
          }
        });
        return { ...result, content: newContent };
      }

      return result;
    } catch {
      return result;
    }
  }

  function toolListResult() {
    // Progressive discovery: if SIMPLEBEACON_PROGRESSIVE=1, return only 3 meta-tools
    // instead of all 34 full schemas. This reduces initial token burn by ~90%.
    // Agents use search_available_tools + inspect_tool_schema to discover tools on-demand.
    const progressive = process.env.SIMPLEBEACON_PROGRESSIVE === "1" ||
      options.progressive === true;

    if (progressive) {
      return {
        tools: [
          {
            name: "search_available_tools",
            description:
              "Search SimpleBeacon's 34-tool registry by natural language query. Returns matching tool names and short descriptions. Use this first to find the right tool before calling inspect_tool_schema. Runs locally — no upload.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Natural language search query (e.g. 'scan for credentials', 'compliance checklist', 'agent memory', 'gate status')",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "inspect_tool_schema",
            description:
              "Fetch the full parameter schema for a specific tool before calling it. Returns the complete inputSchema with all properties, enums, and descriptions. Use this after search_available_tools to get exact parameters. Runs locally — no upload.",
            inputSchema: {
              type: "object",
              properties: {
                tool_name: {
                  type: "string",
                  description: "Exact tool name returned by search_available_tools (e.g. 'scan_snippet', 'gate_status', 'agent_remember')",
                },
              },
              required: ["tool_name"],
            },
          },
          {
            name: "list_all_tools",
            description:
              "Returns a compact list of all 34 available tool names with one-line descriptions. Use this when you need a full overview instead of searching. Runs locally — no upload.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    }

    // Standard mode: return all 34 tools with full schemas
    return {
      tools: TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  }

  // ── Progressive discovery helpers ──────────────────────────────────────────
  function searchTools(query) {
    const q = query.toLowerCase();
    return TOOL_DEFINITIONS.filter((tool) => {
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        // Also match on parameter names for semantic relevance
        Object.keys(tool.inputSchema?.properties || {}).some(
          (p) => p.toLowerCase().includes(q),
        )
      );
    }).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  function inspectTool(toolName) {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
    if (!tool) return null;
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  }

  function listAllToolsCompact() {
    return TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description.split(". ")[0] + ".",
    }));
  }

  // Check if a name is a progressive discovery meta-tool
  const PROGRESSIVE_META_TOOLS = new Set([
    "search_available_tools",
    "inspect_tool_schema",
    "list_all_tools",
  ]);

  function isProgressiveMetaTool(name) {
    return PROGRESSIVE_META_TOOLS.has(name);
  }

  function handleProgressiveMetaTool(name, args) {
    if (name === "search_available_tools") {
      const results = searchTools(args.query || "");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: args.query,
                matchedCount: results.length,
                tools: results,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    if (name === "inspect_tool_schema") {
      const tool = inspectTool(args.tool_name);
      if (!tool) {
        return {
          content: [
            {
              type: "text",
              text: `Tool '${args.tool_name}' not found. Use search_available_tools or list_all_tools to discover available tools.`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tool, null, 2),
          },
        ],
      };
    }
    if (name === "list_all_tools") {
      const tools = listAllToolsCompact();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { totalTools: tools.length, tools },
              null,
              2,
            ),
          },
        ],
      };
    }
    return null;
  }

  function validateMessage(msg) {
    if (msg.jsonrpc !== "2.0")
      return { valid: false, error: "Invalid jsonrpc version" };
    if (!msg.method || typeof msg.method !== "string")
      return { valid: false, error: "Missing or invalid method" };
    return { valid: true };
  }

  function handleRequest(message) {
    const validation = validateMessage(message);
    if (!validation.valid) {
      if (message.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32600, message: validation.error },
        });
      }
      return;
    }

    const { id, method, params } = message;
    logger.log("←", method, id !== undefined ? `id=${id}` : "notify");

    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {}, progress: {}, logging: {} },
          serverInfo: SERVER_INFO,
        },
      });
      initialized = true;
      logger.log("Initialized");
      return;
    }

    if (method === "$/cancelRequest" && params && params.id !== undefined) {
      const req = activeRequests.get(params.id);
      if (req) {
        req.cancelled = true;
      }
      return; // No response for cancel
    }

    if (!initialized && method !== "ping") {
      send({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32002,
          message: "Server not initialized. Call initialize first.",
        },
      });
      return;
    }

    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }

    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: toolListResult() });
      return;
    }

    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments || {};

      // Progressive discovery meta-tools — handled inline, not via handlers map
      if (isProgressiveMetaTool(name)) {
        try {
          const result = handleProgressiveMetaTool(name, args);
          send({ jsonrpc: "2.0", id, result });
        } catch (err) {
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: err.message || "Meta-tool failed" }],
              isError: true,
            },
          });
        }
        return;
      }

      const handler = handlers[name];

      if (!handler) {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          },
        });
        return;
      }

      const progressToken = params?.meta?.progressToken || id;
      activeRequests.set(id, { cancelled: false, startTime: Date.now() });
      const reqState = activeRequests.get(id);

      // Helper to check if cancelled mid-flight
      const checkCancelled = () => reqState.cancelled;

      (async () => {
        try {
          // Progress for long-running tools
          const longRunning = ["scan_project", "run_analyzer_suite"];
          if (longRunning.includes(name) && progressToken !== undefined) {
            sendProgress(progressToken, 0, 100);
          }

          const result = await handler(args);

          if (checkCancelled()) {
            logger.log("Request cancelled:", id); // simplebeacon-ignore pii-logging — logs request ID only, no user data
            activeRequests.delete(id);
            return;
          }

          if (longRunning.includes(name) && progressToken !== undefined) {
            sendProgress(progressToken, 100, 100);
          }

          // Telemetry: record deflections for scan tools (non-blocking)
          const scanTools = new Set(["scan_project", "scan_snippet", "scan_file", "scan_staged", "scan_deployment_readiness"]);
          if (scanTools.has(name)) {
            try {
              const tel = getTelemetry();
              if (tel) {
                // Extract the report from the tool result for telemetry
                const text = result?.content?.[0]?.text;
                if (text) {
                  const parsed = JSON.parse(text);
                  tel.recordAgentScanPass(parsed);
                }
              }
            } catch (telErr) {
              logger.log("Telemetry recording skipped:", telErr.message);
            }
          }

          // Payload compression: apply agent-compressor to scan reports, gate
          // status, and suggestions. Strips verbose fields, truncates paths,
          // and minifies output for token efficiency.
          const payloadCompressed = compressToolPayload(name, result);

          // TOON compression: strip empty/null/undefined fields from tool responses
          // to minimize token consumption when returning results to the LLM agent
          const compressed = compressToolResult(payloadCompressed);

          const elapsed = Date.now() - reqState.startTime;
          logger.log("Tool", name, "completed in", elapsed, "ms");
          activeRequests.delete(id);
          send({ jsonrpc: "2.0", id, result: compressed });
        } catch (err) {
          activeRequests.delete(id);
          logger.log("Tool", name, "error:", err.message);
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: err.message || "Tool failed" }],
              isError: true,
            },
          });
        }
      })();
      return;
    }

    if (id !== undefined) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }
  }

  function handleNotification(message) {
    const validation = validateMessage(message);
    if (!validation.valid) return;

    if (message.method === "notifications/initialized") {
      initialized = true;
      logger.log("Client initialized");
    }
    if (
      message.method === "notifications/cancelled" &&
      message.params &&
      message.params.requestId
    ) {
      const req = activeRequests.get(message.params.requestId);
      if (req) req.cancelled = true;
    }
  }

  function start() {
    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });

    process.on("SIGINT", () => {
      logger.log("SIGINT");
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      logger.log("SIGTERM");
      process.exit(0);
    });
    process.on("uncaughtException", (err) => {
      console.error("[MCP] Uncaught:", err.message);
      process.exit(1);
    });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let message;
      try {
        message = JSON.parse(trimmed);
      } catch (e) {
        logger.log("JSON parse error:", e.message);
        return;
      }

      if (message.method && message.id === undefined) {
        handleNotification(message);
        return;
      }

      handleRequest(message);
    });

    rl.on("close", () => {
      logger.log("stdin closed");
      process.exit(0);
    });

    logger.log("Server ready. Protocol:", PROTOCOL_VERSION);
  }

  return { start, toolListResult, handlers };
}

module.exports = {
  createMcpStdioServer,
  PROTOCOL_VERSION,
  SERVER_INFO,
};
