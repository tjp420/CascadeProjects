"use strict";

/**
 * Local, provider-neutral context transform for chat-style request bodies.
 * Restructures selected plain-text context to reduce whitespace redundancy
 * and optionally expose a caller-supplied workspace graph.
 *
 * Not a network gateway: no outbound calls, no key handling, no prompt logging.
 * HTTP forwarding and DLP stay in server/ai-proxy-gateway.cjs.
 */

const DEFAULT_MAX_GRAPH_BYTES = 16384;
const DEFAULT_MAX_CONTEXT_BYTES = 128000;
const GRAPH_TRUNCATION_MARK =
  "\n... [Graph Truncated Due to Context Budget Overrun]";

function clonePayload(requestPayload) {
  if (requestPayload == null || typeof requestPayload !== "object") {
    return requestPayload;
  }
  try {
    return JSON.parse(JSON.stringify(requestPayload));
  } catch {
    return requestPayload;
  }
}

function utf8Len(text) {
  return Buffer.byteLength(String(text || ""), "utf8");
}

function normalizePlainText(text) {
  return String(text)
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateUtf8(text, maxBytes) {
  const raw = String(text || "");
  const buf = Buffer.from(raw, "utf8");
  if (buf.length <= maxBytes) return raw;
  let end = Math.max(0, maxBytes);
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return buf.subarray(0, end).toString("utf8");
}

function clipGraph(graph, maxBytes) {
  const source = String(graph || "");
  if (utf8Len(source) <= maxBytes) {
    return { text: source, truncated: false };
  }
  const markBytes = utf8Len(GRAPH_TRUNCATION_MARK);
  const bodyBudget = Math.max(0, maxBytes);
  const body = truncateUtf8(source, bodyBudget);
  return { text: `${body}${GRAPH_TRUNCATION_MARK}`, truncated: true };
}

function lastStringUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (
      msg &&
      msg.role === "user" &&
      typeof msg.content === "string"
    ) {
      return i;
    }
  }
  return -1;
}

class UniversalContextProxy {
  /**
   * @param {object} [options]
   * @param {boolean} [options.optInGraph=false]
   * @param {number} [options.maxGraphSizeBytes]
   * @param {number} [options.maxContextBytes]
   */
  constructor(options = {}) {
    this.optInGraph = options.optInGraph === true;
    const graphCap = Number(options.maxGraphSizeBytes);
    this.maxGraphSizeBytes =
      Number.isFinite(graphCap) && graphCap > 0
        ? graphCap
        : DEFAULT_MAX_GRAPH_BYTES;
    const contextCap = Number(options.maxContextBytes);
    this.maxContextBytes =
      Number.isFinite(contextCap) && contextCap > 0
        ? contextCap
        : DEFAULT_MAX_CONTEXT_BYTES;
  }

  /**
   * @param {object} requestPayload
   * @param {string} [workspaceGraph]
   * @returns {{ optimizedBody: object, metrics: object }}
   */
  optimizeRequest(requestPayload, workspaceGraph = "") {
    const clonedPayload = clonePayload(requestPayload);
    const emptyMetrics = {
      originalBytes: 0,
      optimizedBytes: 0,
      savedBytes: 0,
      tokenEstimateSaved: 0,
      graphInjected: false,
      graphTruncated: false,
    };

    if (
      !clonedPayload ||
      typeof clonedPayload !== "object" ||
      !Array.isArray(clonedPayload.messages)
    ) {
      return { optimizedBody: clonedPayload, metrics: emptyMetrics };
    }

    let originalBytes = 0;
    let optimizedBytes = 0;
    let graphInjected = false;
    let graphTruncated = false;
    const injectAt = this.optInGraph
      ? lastStringUserIndex(clonedPayload.messages)
      : -1;

    clonedPayload.messages = clonedPayload.messages.map((msg, idx) => {
      if (!msg || typeof msg.content !== "string") {
        return msg;
      }

      const rawText = msg.content;
      originalBytes += utf8Len(rawText);
      let processedText = normalizePlainText(rawText);

      if (idx === injectAt && workspaceGraph) {
        const clipped = clipGraph(workspaceGraph, this.maxGraphSizeBytes);
        graphTruncated = clipped.truncated;
        let graphText = clipped.text;
        const wrap = (g, body) =>
          `[SIMPLEBEACON WORKSPACE ANALYSIS]\n${g}\n\n[PROMPT CONTEXT]:\n${body}`;
        let candidate = wrap(graphText, processedText);
        while (
          utf8Len(candidate) > this.maxContextBytes &&
          utf8Len(graphText) > 0
        ) {
          const nextCap = Math.max(0, utf8Len(graphText) - 64);
          const again = clipGraph(workspaceGraph, nextCap);
          graphText = again.text;
          graphTruncated = true;
          candidate = wrap(graphText, processedText);
          if (nextCap === 0) break;
        }
        if (utf8Len(candidate) > this.maxContextBytes) {
          processedText = truncateUtf8(candidate, this.maxContextBytes);
          graphTruncated = true;
        } else {
          processedText = candidate;
        }
        graphInjected = processedText.includes(
          "[SIMPLEBEACON WORKSPACE ANALYSIS]",
        );
      }

      optimizedBytes += utf8Len(processedText);
      return { ...msg, content: processedText };
    });

    const savedBytes = Math.max(0, originalBytes - optimizedBytes);
    return {
      optimizedBody: clonedPayload,
      metrics: {
        originalBytes,
        optimizedBytes,
        savedBytes,
        tokenEstimateSaved: Math.ceil(savedBytes / 3.7),
        graphInjected,
        graphTruncated,
      },
    };
  }
}

module.exports = {
  UniversalContextProxy,
  DEFAULT_MAX_GRAPH_BYTES,
  DEFAULT_MAX_CONTEXT_BYTES,
};
