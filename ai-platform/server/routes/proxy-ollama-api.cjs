/**
 * Proxy Ollama models endpoint to avoid Local Network Access issues
 * Exposes: GET /api/proxy/ollama/models
 */
const rateLimit = require("express-rate-limit");
const logger = require("../../src/lib/app-logger.cjs");
const { sendError } = require("../lib/response-helpers.cjs");
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

function getFetch() {
  if (typeof globalThis.fetch === "function") return globalThis.fetch;
  try {
    return require("node-fetch");
  } catch (e) {
    throw new Error(
      "fetch is not available; please run on Node >= 18 or install node-fetch",
    );
  }
}

function setupProxyOllamaAPI(app, options = {}) {
  const baseUrl = String(
    process.env.OLLAMA_BASE_URL || options.baseUrl || DEFAULT_OLLAMA_URL,
  ).replace(/\/$/, "");
  const fetch = getFetch();

  // Normalize IP addresses to be safe for IPv6/IPv4 mappings and proxies.
  function normalizeIpForRateLimit(req) {
    // Prefer req.ip (Express-aware), then X-Forwarded-For, then socket remote address
    let ip =
      (req &&
        (req.ip ||
          (req.headers &&
            req.headers["x-forwarded-for"] &&
            String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
          (req.socket && req.socket.remoteAddress))) ||
      "unknown";
    if (typeof ip !== "string") ip = String(ip);
    // Handle IPv6 loopback and IPv4-mapped IPv6 addresses
    if (ip === "::1") return "127.0.0.1";
    if (ip.startsWith("::ffff:")) return ip.split("::ffff:")[1];
    return ip;
  }

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.PROXY_OLLAMA_RATE_LIMIT || 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: "Too many requests — please try again later.",
    },
    keyGenerator: (req) => {
      try {
        const ip = normalizeIpForRateLimit(req);
        return rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(ip) : ip;
      } catch (e) {
        return normalizeIpForRateLimit(req);
      }
    },
  });

  app.get("/api/proxy/ollama/models", limiter, async (req, res) => {
    try {
      const target = `${baseUrl}/api/tags`;
      const controller = new AbortController();
      const timeoutMs = Number(process.env.PROXY_OLLAMA_TIMEOUT_MS || 5000);
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(target, { signal: controller.signal });
      clearTimeout(t);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return sendError(res, 502, "upstream_error", {
          status: resp.status,
          detail: text,
        });
      }
      const json = await resp.json().catch(async () => {
        const txt = await resp.text().catch(() => "");
        throw new Error("invalid_json_from_ollama: " + txt.slice(0, 200));
      });
      // Limit forwarded payload size
      const limited = Array.isArray(json) ? json.slice(0, 200) : json;
      return res.json({ success: true, data: limited });
    } catch (err) {
      const msg =
        err && err.name === "AbortError"
          ? "timeout"
          : (err && err.message) || String(err);
      logger.warn("[ProxyOllama] Proxy request failed:", msg);
      return sendError(res, 502, "proxy_failed", { detail: msg });
    }
  });

  if (process.env.DEBUG_LOGS === "true")
    logger.info(
      "[ProxyOllama] /api/proxy/ollama/models mounted →",
      baseUrl + "/api/tags",
    );
}

module.exports = { setupProxyOllamaAPI };
