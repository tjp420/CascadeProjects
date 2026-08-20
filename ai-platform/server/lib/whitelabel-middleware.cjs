"use strict";

/**
 * Whitelabel Sub-Domain Routing Middleware — intercepts incoming requests,
 * extracts the hostname, resolves the partner brand configuration, and
 * attaches it to the request object for downstream use.
 *
 * Resolution order:
 *   1. Exact domain match (e.g., "acme.com")
 *   2. Subdomain match (e.g., "acme.simplebeacon.ai" → customSubdomain "acme")
 *   3. Wildcard/suffix domain match (e.g., "app.acme.com" matches "acme.com")
 *   4. Fallback to DEFAULT_BRAND if no partner found
 *
 * The middleware also exposes a helper to inject brand CSS + config into
 * the dashboard HTML response.
 *
 * @module whitelabel-middleware
 */

const logger = require("./app-logger.cjs");
const wlStore = require("./whitelabel-config-store.cjs");

// Domains that should never trigger whitelabel resolution
const SKIP_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

// Base domain for subdomain extraction (e.g., "simplebeacon.ai")
const BASE_DOMAIN = process.env.WHITELABEL_BASE_DOMAIN || "simplebeacon.ai";

/**
 * Extract the subdomain prefix from a hostname.
 * e.g., "acme.simplebeacon.ai" → "acme"
 * e.g., "app.acme.simplebeacon.ai" → "app.acme"
 * Returns null if the hostname is the base domain or not a subdomain.
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;
  const normalized = hostname.toLowerCase().trim();
  if (normalized === BASE_DOMAIN || normalized === "www." + BASE_DOMAIN)
    return null;
  if (!normalized.endsWith("." + BASE_DOMAIN)) return null;
  const prefix = normalized.slice(0, -(BASE_DOMAIN.length + 1));
  if (!prefix || prefix === "www") return null;
  return prefix;
}

/**
 * Resolve a hostname to a whitelabel partner.
 * Tries exact domain match first, then subdomain, then wildcard suffix.
 */
function resolvePartner(hostname) {
  if (!hostname || SKIP_HOSTS.has(hostname.toLowerCase())) {
    return null;
  }

  const normalized = hostname.toLowerCase().trim();

  // 1. Exact domain match (also handles wildcard suffix via resolveByDomain)
  const byDomain = wlStore.resolveByDomain(normalized);
  if (byDomain) {
    logger.info(
      `[Whitelabel] Resolved partner ${byDomain.partnerId} via domain: ${normalized}`,
    );
    return byDomain;
  }

  // 2. Subdomain match (e.g., "acme.simplebeacon.ai" → customSubdomain "acme")
  const subdomain = extractSubdomain(normalized);
  if (subdomain) {
    // Try the full subdomain first (e.g., "app.acme")
    const byFullSubdomain = wlStore.resolveBySubdomain(subdomain);
    if (byFullSubdomain) {
      logger.info(
        `[Whitelabel] Resolved partner ${byFullSubdomain.partnerId} via subdomain: ${subdomain}`,
      );
      return byFullSubdomain;
    }
    // Try just the first segment (e.g., "acme" from "app.acme")
    const firstSegment = subdomain.split(".")[0];
    if (firstSegment !== subdomain) {
      const bySegment = wlStore.resolveBySubdomain(firstSegment);
      if (bySegment) {
        logger.info(
          `[Whitelabel] Resolved partner ${bySegment.partnerId} via subdomain segment: ${firstSegment}`,
        );
        return bySegment;
      }
    }
  }

  return null;
}

/**
 * Express middleware — resolves whitelabel partner from request hostname
 * and attaches brand config to req.brand.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next()
 */
function whitelabelMiddleware(req, res, next) {
  try {
    const hostname = req.hostname || req.get("host") || "";
    const partner = resolvePartner(hostname);

    if (partner) {
      req.whitelabelPartner = partner;
      req.brand = partner.brand;
      res.setHeader("X-Whitelabel-Partner", partner.partnerId);
    } else {
      req.whitelabelPartner = null;
      req.brand = wlStore.DEFAULT_BRAND;
    }
  } catch (err) {
    // Never block the request due to whitelabel resolution failure
    logger.error("[Whitelabel] Middleware error:", err.message);
    req.whitelabelPartner = null;
    req.brand = wlStore.DEFAULT_BRAND;
  }
  next();
}

/**
 * Build the brand injection script for dashboard HTML.
 * Injects window.__SIMPLEBEACON_BRAND__ with the resolved brand config
 * and an inline <style> block with CSS variables.
 *
 * @param {object} brand - Brand config object (from req.brand)
 * @param {string|null} partnerId - Partner ID if resolved, null for default
 * @returns {string} HTML string to inject into <head>
 */
function buildBrandInjection(brand, partnerId) {
  const brandJson = JSON.stringify({
    brand,
    partnerId,
    resolvedAt: new Date().toISOString(),
  });

  const css = wlStore.generateBrandCss(brand);
  const styleBlock = `<style id="whitelabel-brand-css">\n${css}\n</style>`;
  const scriptBlock = `<script>window.__SIMPLEBEACON_BRAND__=${brandJson};</script>`;

  return styleBlock + "\n" + scriptBlock;
}

module.exports = {
  whitelabelMiddleware,
  resolvePartner,
  extractSubdomain,
  buildBrandInjection,
  BASE_DOMAIN,
};
