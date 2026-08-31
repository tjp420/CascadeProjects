/**
 * SimpleBeacon Serverless Stripe Webhook Handler & License Signer
 * Runtime: Cloudflare Worker (V8 Edge Isolate)
 * Edge compliance certification: /api/v1/certify + /api/v1/certify/public-key
 */

import { handleCertifyRequest, handlePublicKeyRequest } from "./certify.js";

const DEFAULT_ALLOWED_ORIGINS =
  "https://simplebeacon.ai,https://www.simplebeacon.ai";
const PAGES_PREVIEW_ORIGIN_REGEX =
  /^https:\/\/(?:[a-z0-9-]+\.)?simplebeacon\.pages\.dev$/;
const RENDER_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;
const NETLIFY_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const LICENSE_TTL_SECONDS = 24 * 60 * 60;
const STRIPE_TOLERANCE_SECONDS = 300;

/**
 * Inject GA4 Measurement ID into HTML responses via HTMLRewriter.
 * Reads GA_MEASUREMENT_ID from env and injects a <meta name="ga-id"> tag
 * into <head> so client-side analytics can initialize without hardcoding.
 *
 * @param {Response} response - The HTML response to transform
 * @param {string} gaId - The GA4 Measurement ID (already validated non-empty)
 * @returns {Response} - Transformed response with meta tag injected
 */
function injectGaMetaTag(response, gaId) {
  const sanitized = String(gaId).replace(/[^a-zA-Z0-9\-]/g, "");
  if (!sanitized) return response;
  const rewriter = new HTMLRewriter().on("head", {
    element(element) {
      element.prepend(`<meta name="ga-id" content="${sanitized}">`, {
        html: true,
      });
    },
  });
  return rewriter.transform(response);
}

/**
 * Wrap an HTML response with GA meta tag injection if GA_MEASUREMENT_ID is set.
 * @param {Response} response - The HTML response
 * @param {Object} env - Worker environment bindings
 * @returns {Response} - Original response (no GA ID) or transformed response
 */
function withGaInjection(response, env) {
  const gaId = String(env.GA_MEASUREMENT_ID || "").trim();
  if (!gaId) return response;
  return injectGaMetaTag(response, gaId);
}

/**
 * Inject a lightweight GDPR essential-cookie consent banner before </body>.
 * Dismiss state is persisted in localStorage so it only shows once.
 */
const COOKIE_BANNER_HTML = `<div id="sb-cookie-notice" style="position:fixed;bottom:0;left:0;right:0;z-index:99998;background:#0B0F19;border-top:1px solid #1E293B;padding:12px 20px;display:flex;align-items:center;justify-content:center;gap:16px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#94A3B8;transition:opacity .3s,transform .3s;"><span style="color:#F3F4F6;">We use only essential cookies to keep you logged in.</span><a href="/privacy" style="color:#06B6D4;text-decoration:none;">Read our Privacy Policy</a><button onclick="var n=document.getElementById('sb-cookie-notice');n.style.opacity='0';n.style.transform='translateY(100%)';setTimeout(function(){n.style.display='none'},300);try{localStorage.setItem('sb-cookie-dismissed','1')}catch(e){}" style="background:#06B6D4;color:#0B0F19;border:none;border-radius:6px;padding:6px 16px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Dismiss</button></div><script>try{if(localStorage.getItem('sb-cookie-dismissed')==='1'){var n=document.getElementById('sb-cookie-notice');if(n)n.style.display='none'}}catch(e){}</script>`;

function withCookieBanner(response, pathname) {
  // Skip cookie banner on dashboard/app SPA pages — the fixed-position overlay
  // (z-index:99998) intercepts touch events on mobile, making the sign-in
  // button untappable on small screens.
  if (
    pathname &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/app"))
  ) {
    return response;
  }
  const rewriter = new HTMLRewriter().on("body", {
    element(element) {
      element.append(COOKIE_BANNER_HTML, { html: true });
    },
  });
  return rewriter.transform(response);
}

/**
 * Inject Cloudflare Web Analytics beacon before </body> if CF_ANALYTICS_TOKEN is set.
 * The token is obtained from Cloudflare Dashboard → Analytics & Logs → Web Analytics.
 * Also strips integrity/crossorigin attributes from any auto-injected Cloudflare
 * beacon scripts to prevent SRI hash mismatch errors when the CDN returns 204.
 */
function withCfAnalytics(response, env) {
  const token = String(env.CF_ANALYTICS_TOKEN || "").trim();
  // Strip integrity/crossorigin from Cloudflare beacon scripts (auto-injected by CF)
  const stripRewriter = new HTMLRewriter().on(
    "script[src*='cloudflareinsights.com/beacon.min.js']",
    {
      element(el) {
        el.removeAttribute("integrity");
        el.removeAttribute("crossorigin");
      },
    },
  );
  let r = stripRewriter.transform(response);
  if (!token) return r;
  const beacon = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;:&quot;${token.replace(/[^a-zA-Z0-9]/g, "")}&quot;}"></script>`;
  const rewriter = new HTMLRewriter().on("body", {
    element(element) {
      element.append(beacon, { html: true });
    },
  });
  return rewriter.transform(r);
}

/**
 * Apply all HTML injections (GA, cookie banner, CF analytics) to an HTML response.
 * @param {Response} response - The HTML response
 * @param {Object} env - Worker environment bindings
 * @returns {Response} - Transformed response
 */
function withHtmlInjections(response, env, pathname) {
  let r = withGaInjection(response, env);
  r = withCookieBanner(r, pathname);
  r = withCfAnalytics(r, env);
  return r;
}

/**
 * Apply security headers to an HTML response.
 * Mirrors the headers set by the Express server in simplebeacon-server.cjs.
 * @param {Response} response - The HTML response
 * @returns {Response} - New response with security headers set
 */
function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "0");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://img.youtube.com; connect-src 'self' https://simplebeacon.onrender.com https://*.onrender.com http://127.0.0.1:3456 http://localhost:3456 http://127.0.0.1:55000 http://localhost:55000 http://127.0.0.1:3000 http://localhost:3000 http://127.0.0.1:3001 http://localhost:3001 http://127.0.0.1:3002 http://localhost:3002 http://127.0.0.1:4000 http://localhost:4000 http://127.0.0.1:8080 http://localhost:8080 http://127.0.0.1:5000 http://localhost:5000 http://127.0.0.1:38000 http://localhost:38000 http://127.0.0.1:50559 http://localhost:50559 http://127.0.0.1:54358 http://localhost:54358 http://127.0.0.1:55432 http://localhost:55432 http://127.0.0.1:11434 http://localhost:11434 https://*.cloudflareinsights.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'self' vscode-webview: vscode-extension:; base-uri 'self'; form-action 'self';",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

class SignatureError extends Error {
  constructor(message) {
    super(message);
    this.name = "SignatureError";
    this.isSignatureError = true;
  }
}

function json(data, status, corsOrigin) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function textResponse(body, status, corsOrigin) {
  const headers = { "Cache-Control": "no-store" };
  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Vary"] = "Origin";
  }
  return new Response(body, { status, headers });
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCorsOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return "";
  const allowed = getAllowedOrigins(env);
  if (allowed.includes(origin)) return origin;
  // Allow *.simplebeacon.pages.dev preview deployments, *.onrender.com, and *.netlify.app
  if (
    PAGES_PREVIEW_ORIGIN_REGEX.test(origin) ||
    RENDER_ORIGIN_REGEX.test(origin) ||
    NETLIFY_ORIGIN_REGEX.test(origin)
  ) {
    return origin;
  }
  return "";
}

function isValidSessionId(sessionId) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(sessionId || "");
}

function parseStripeSignature(headerValue) {
  const parts = String(headerValue || "").split(",");
  const out = { t: "", v1: [] };
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") out.t = value;
    if (key === "v1") out.v1.push(value);
  }
  return out;
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

async function verifyStripeWebhookSignature(request, env, payloadText) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET || "");
  if (!secret) throw new SignatureError("Webhook secret is not configured");

  const header = request.headers.get("Stripe-Signature");
  const parsed = parseStripeSignature(header);
  if (!parsed.t || !parsed.v1.length) {
    throw new SignatureError("Missing Stripe signature components");
  }

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) {
    throw new SignatureError("Invalid Stripe timestamp");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > STRIPE_TOLERANCE_SECONDS) {
    throw new SignatureError(
      "Stripe signature timestamp is outside tolerance window",
    );
  }

  const signedPayload = `${parsed.t}.${payloadText}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  for (const candidate of parsed.v1) {
    if (timingSafeEqualHex(expected, candidate)) {
      return true;
    }
  }
  throw new SignatureError("Stripe signature mismatch");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary)
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function utf8ToBase64Url(value) {
  const bytes = new TextEncoder().encode(String(value));
  return bytesToBase64Url(bytes);
}

async function signJwtHS256(claims, signingSecret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = utf8ToBase64Url(JSON.stringify(header));
  const payloadPart = utf8ToBase64Url(JSON.stringify(claims));
  const body = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const signaturePart = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${body}.${signaturePart}`;
}

/**
 * Verify a JWT (HS256) using Web Crypto API.
 * Returns the decoded payload if valid, null otherwise.
 */
async function verifyJwtHS256(token, signingSecret) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const body = `${headerPart}.${payloadPart}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = base64UrlToBytes(signaturePart);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payloadPart)),
    );
    // Check expiry
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Rate limiting for attestation endpoint — per-token request counting
const attestRateMap = new Map();
const ATTEST_RATE_WINDOW_MS = 60 * 1000;
const ATTEST_RATE_MAX = 10;
const ATTEST_CLEANUP_INTERVAL_MS = 120000;
let lastAttestCleanup = 0;

function checkAttestRateLimit(tokenHash) {
  const now = Date.now();
  // Lazy cleanup — prune stale entries on each call rather than using setInterval
  if (now - lastAttestCleanup > ATTEST_CLEANUP_INTERVAL_MS) {
    const cutoff = now - ATTEST_RATE_WINDOW_MS * 2;
    for (const [key, entry] of attestRateMap) {
      if (entry.windowStart < cutoff) attestRateMap.delete(key);
    }
    lastAttestCleanup = now;
  }
  const entry = attestRateMap.get(tokenHash);
  if (!entry || now - entry.windowStart > ATTEST_RATE_WINDOW_MS) {
    attestRateMap.set(tokenHash, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= ATTEST_RATE_MAX;
}

/**
 * Handle scan attestation requests.
 *
 * Validates the user's JWT auth token, then issues a short-lived (5-min)
 * attestation JWT signed with SCAN_ATTEST_SECRET. The attestation is bound
 * to a device fingerprint so it can't be shared across machines.
 *
 * Required body: { token: string, deviceFingerprint: string }
 * Returns: { attestation: string, expiresAt: number, scanId: string }
 */
async function handleScanAttestation(request, env, corsOrigin) {
  if (!corsOrigin) {
    return json({ error: "Origin not allowed." }, 403, "");
  }

  const jwtSecret = env.JWT_SECRET || env.SIMPLEBEACON_JWT_SECRET;
  const attestSecret =
    env.SCAN_ATTEST_SECRET || jwtSecret || "sb-attest-fallback-dev";

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON body." }, 400, corsOrigin);
  }

  const { token, deviceFingerprint } = body || {};
  if (!token || typeof token !== "string") {
    return json({ error: "Auth token required." }, 401, corsOrigin);
  }
  if (
    !deviceFingerprint ||
    typeof deviceFingerprint !== "string" ||
    deviceFingerprint.length < 8
  ) {
    return json({ error: "Device fingerprint required." }, 400, corsOrigin);
  }

  // Rate limit per token hash
  const tokenHash = await hmacSha256Hex(attestSecret, token.slice(0, 32));
  if (!checkAttestRateLimit(tokenHash)) {
    return json(
      { error: "Rate limit exceeded. Try again in a minute." },
      429,
      corsOrigin,
    );
  }

  // Verify the JWT auth token.
  // Mode 1: If JWT_SECRET is configured as a Worker secret, verify at the edge (fast).
  // Mode 2: Otherwise, proxy to the Render backend for verification.
  let payload = null;
  if (jwtSecret) {
    payload = await verifyJwtHS256(token, jwtSecret);
  } else {
    // Proxy to backend — use the existing /api/auth/verify endpoint
    const backendUrl = String(env.API_BACKEND || "");
    if (backendUrl) {
      try {
        const verifyResp = await fetch(
          backendUrl.replace(/\/+$/, "") + "/api/auth/verify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ token }),
          },
        );
        if (verifyResp.ok) {
          const data = await verifyResp.json();
          if (data.valid || data.user) {
            payload = data.user || data.payload || { email: data.email || "" };
          }
        }
      } catch (_) {
        // Backend unreachable — fall through to denial
      }
    }
  }

  if (!payload) {
    return json({ error: "Invalid or expired auth token." }, 401, corsOrigin);
  }

  // Issue a short-lived attestation JWT (5-minute TTL)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 300;
  const scanId = crypto.randomUUID();
  const deviceHash = await hmacSha256Hex(attestSecret, deviceFingerprint);

  const attestationClaims = {
    sub: payload.sub || payload.email || "unknown",
    email: payload.email || "",
    tier: payload.tier || payload.plan || "developer",
    role: payload.role || "user",
    dev: deviceHash.slice(0, 16),
    sid: scanId,
    iat: now,
    exp: expiresAt,
    iss: "simplebeacon-edge",
    aud: "simplebeacon-scan-worker",
  };
  const attestation = await signJwtHS256(attestationClaims, attestSecret);

  return json(
    {
      attestation,
      expiresAt: expiresAt * 1000,
      scanId,
      tier: attestationClaims.tier,
    },
    200,
    corsOrigin,
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsOrigin = getCorsOrigin(request, env);
    const debugPath = url.pathname;

    if (request.method === "OPTIONS") {
      const headers = {
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Accept,Authorization,X-Token-Password,Stripe-Signature",
        "Access-Control-Max-Age": "86400",
      };
      if (corsOrigin) {
        headers["Access-Control-Allow-Origin"] = corsOrigin;
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Vary"] = "Origin";
      }
      return new Response(null, { status: 204, headers });
    }

    // Static asset passthrough for /dashboard/assets/* and /app/assets/*
    // Fetches from ASSETS binding with cache-bust to bypass stale CDN 404s,
    // and sets correct Content-Type for JS modules (browsers reject text/plain).
    if (
      url.pathname.startsWith("/dashboard/assets/") ||
      url.pathname.startsWith("/app/assets/")
    ) {
      const assetUrl = new URL(url.pathname, url.origin);
      assetUrl.searchParams.set("_cb", Date.now().toString());
      const assetResp = await env.ASSETS.fetch(
        new Request(assetUrl.toString(), request),
      );
      // Always set correct Content-Type for JS/CSS, even for error responses.
      // Browsers cache 404s with empty MIME types and then refuse to load the
      // module even after the file appears — setting the MIME type on every
      // response (including errors) helps prevent this.
      const headers = new Headers(assetResp.headers);
      if (url.pathname.endsWith(".js") || url.pathname.endsWith(".mjs")) {
        headers.set("Content-Type", "text/javascript; charset=utf-8");
      } else if (url.pathname.endsWith(".css")) {
        headers.set("Content-Type", "text/css; charset=utf-8");
      }
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      headers.set("CDN-Cache-Control", "no-store");
      headers.set("Vary", "*");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-SB-Worker", "assets");
      return new Response(assetResp.body, {
        status: assetResp.status,
        headers,
      });
    }

    // Vite lazy-loaded chunks (e.g. TeamMetricsView-CueXexY4.js) are requested
    // at /dashboard/<chunk>.js but the actual files live in /dashboard/assets/.
    // Redirect to the correct path so the browser loads them as proper modules.
    if (
      url.pathname.startsWith("/dashboard/") &&
      !url.pathname.startsWith("/dashboard/assets/") &&
      /\.(js|mjs|css)$/.test(url.pathname) &&
      !url.pathname.startsWith("/dashboard/js/") &&
      !url.pathname.startsWith("/dashboard/js-es2018/") &&
      !url.pathname.startsWith("/dashboard/utils-lib/") &&
      !url.pathname.startsWith("/dashboard/scripts/") &&
      !url.pathname.startsWith("/dashboard/src/")
    ) {
      const chunkName = url.pathname.replace("/dashboard/", "");
      const redirectUrl = new URL("/dashboard/assets/" + chunkName, url.origin);
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirectUrl.toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
        },
      });
    }

    // Redirect all /app/* SPA routes to /dashboard/* — the ASSETS binding has a
    // persistent CDN cache for /app/ paths that serves stale HTML. /dashboard/
    // serves the correct bundle. Hash fragments (#/signin) are client-side only
    // and preserved automatically by the browser across same-origin redirects.
    if (url.pathname === "/app" || url.pathname === "/app/") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL("/dashboard/", url.origin).toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "X-SB-Worker": "app-redirect",
        },
      });
    }
    // Redirect /app/<non-asset-path> to /dashboard/<non-asset-path>
    if (
      url.pathname.startsWith("/app/") &&
      !url.pathname.startsWith("/app/assets/") &&
      !url.pathname.startsWith("/app/js/") &&
      !url.pathname.match(
        /\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i,
      )
    ) {
      const newPath = "/dashboard/" + url.pathname.substring(5);
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(newPath, url.origin).toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
        },
      });
    }

    // Health check endpoint for uptime monitoring and Render health checks
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "CDN-Cache-Control": "no-store",
            "X-SB-Worker": "health",
          },
        },
      );
    }

    // Redirect /demo to the landing page
    if (url.pathname === "/demo" || url.pathname.startsWith("/demo/")) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL("/", url.origin).toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
        },
      });
    }

    // SPA fallback for /dashboard/* and /app/* routes — serve the entry HTML
    // so the client-side router can render the requested view.
    // Fetches from ASSETS with cache-bust to bypass stale CDN cached HTML.
    if (
      (url.pathname.startsWith("/dashboard/") ||
        url.pathname.startsWith("/app/")) &&
      !url.pathname.match(
        /\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i,
      )
    ) {
      const cacheBust = `${Date.now()}`;
      const isDashboard = url.pathname.startsWith("/dashboard/");
      const entryCandidates = isDashboard
        ? [
            "/dashboard/__entry",
            "/dashboard/entry-20260806.html",
            "/dashboard/index.html",
          ]
        : ["/app/__entry", "/app/entry-20260806.html", "/app/index.html"];
      for (const entryPath of entryCandidates) {
        const assetUrl = new URL(entryPath, url.origin);
        assetUrl.searchParams.set("_cb", cacheBust);
        const candidate = await env.ASSETS.fetch(
          new Request(assetUrl.toString(), request),
        );
        if (candidate.ok) {
          const headers = new Headers(candidate.headers);
          headers.set("Content-Type", "text/html; charset=utf-8");
          headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
          headers.set("CDN-Cache-Control", "no-store");
          headers.set("Edge-Cache-TTL", "0");
          headers.set("X-SB-Worker-Entry", entryPath);
          headers.set("X-SB-Worker-Deploy", "2026-08-31-pdfix1");
          return withSecurityHeaders(
            withHtmlInjections(
              new Response(candidate.body, {
                status: candidate.status,
                headers,
              }),
              env,
              url.pathname,
            ),
          );
        }
      }
    }

    // Dynamic Route 1: GET /api/license?session_id=...
    // Fetches the generated license token securely from the edge cache
    if (url.pathname === "/api/license" && request.method === "GET") {
      const sessionId = url.searchParams.get("session_id");
      if (!corsOrigin) {
        return json({ error: "Origin not allowed." }, 403, "");
      }
      if (!sessionId) {
        return json({ error: "Missing session_id context." }, 400, corsOrigin);
      }
      if (!isValidSessionId(sessionId)) {
        return json({ error: "Invalid session_id format." }, 400, corsOrigin);
      }

      // Read from Cloudflare's Edge KV Store (Bound as env.LICENSE_STORE)
      const stored = await env.LICENSE_STORE.get(sessionId);
      if (!stored) {
        return json({ status: "PENDING_OR_NOT_FOUND" }, 404, corsOrigin);
      }

      let licenseToken = stored;
      let tier = "unknown";
      let capabilities = [];
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.license === "string") {
          licenseToken = parsed.license;
          tier = parsed.tier || tier;
          capabilities = Array.isArray(parsed.capabilities)
            ? parsed.capabilities
            : capabilities;
        }
      } catch (_) {
        // Backward-compatible read for old values that stored only the token string.
      }

      return json(
        { status: "COMPLETED", license: licenseToken, tier, capabilities },
        200,
        corsOrigin,
      );
    }

    // Dynamic Route 1b: GET /api/license/seats
    // Seat roster lookup — cached at edge for 60s to avoid hitting Render on every dashboard refresh.
    // Auth is enforced by the backend; the edge cache only stores successful (200) responses.
    if (url.pathname === "/api/license/seats" && request.method === "GET") {
      const cacheKey = "api:/api/license/seats:" + url.search;
      if (env.API_CACHE) {
        try {
          const cachedVal = await env.API_CACHE.get(cacheKey, "text");
          if (cachedVal !== null && cachedVal !== undefined) {
            const respHeaders = new Headers({
              "Content-Type": "application/json",
            });
            if (corsOrigin) {
              respHeaders.set("Access-Control-Allow-Origin", corsOrigin);
              respHeaders.set("Vary", "Origin");
            }
            respHeaders.set("X-Cache", "HIT-FRESH");
            return new Response(cachedVal, {
              status: 200,
              headers: respHeaders,
            });
          }
        } catch (_) {
          /* Cache read failure — proceed to proxy */
        }
      }
      // Fall through to backend proxy (below) for cache miss
    }

    // Edge stubs for dashboard endpoints not yet implemented on Render backend.
    // Returns empty success payloads so the dashboard views render without 404 noise.
    if (
      request.method === "GET" &&
      (url.pathname === "/api/webhook-events" ||
        url.pathname === "/api/webhook-events/stats" ||
        url.pathname === "/api/ops-report/status")
    ) {
      if (url.pathname === "/api/webhook-events/stats") {
        return json(
          {
            success: true,
            stats: {
              total: 0,
              delivered: 0,
              failed: 0,
              pending: 0,
              byType: {},
              byStatus: {},
            },
          },
          200,
          corsOrigin,
        );
      }
      if (url.pathname === "/api/ops-report/status") {
        return json(
          { success: true, status: "idle", lastRun: null, nextRun: null },
          200,
          corsOrigin,
        );
      }
      return json(
        {
          success: true,
          events: [],
          stats: { total: 0, delivered: 0, failed: 0, pending: 0 },
        },
        200,
        corsOrigin,
      );
    }

    // Edge stubs for dashboard admin/ops endpoints not yet implemented on Render backend.
    if (request.method === "GET") {
      if (url.pathname === "/api/provider-failover/stats")
        return json(
          {
            success: true,
            stats: {
              totalRequests: 0,
              failovers: 0,
              activeProvider: "none",
              providers: [],
            },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/provider-failover/providers")
        return json({ success: true, providers: [] }, 200, corsOrigin);
      if (url.pathname === "/api/provider-failover/events")
        return json({ success: true, events: [] }, 200, corsOrigin);
      if (url.pathname === "/api/provider-failover/config")
        return json(
          {
            success: true,
            config: {
              circuitBreaker: { failureThreshold: 5, recoveryTimeoutMs: 60000 },
              latencyThresholdMs: 10000,
              failoverChain: [],
              latencyOpenThresholdMs: 15000,
              latencyOpenConsecutiveCount: 3,
              healthCheckJitterMs: 2000,
            },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/identity-federation/stats")
        return json(
          {
            success: true,
            stats: { totalFederated: 0, activeSessions: 0, providers: [] },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/identity-federation/config")
        return json(
          {
            success: true,
            config: {
              defaultRole: "viewer",
              defaultTrustLevel: "silver",
              deprovisionAfterDays: 90,
              providers: [],
            },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/identity-federation/history")
        return json({ success: true, history: [] }, 200, corsOrigin);
      if (url.pathname === "/api/tool-schemas/stats")
        return json(
          {
            success: true,
            stats: { totalSchemas: 0, totalViolations: 0, strictMode: false },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/tool-schemas")
        return json({ success: true, schemas: [] }, 200, corsOrigin);
      if (url.pathname === "/api/tool-schemas/violations/list")
        return json({ success: true, violations: [] }, 200, corsOrigin);
      if (url.pathname === "/api/tool-schemas/config")
        return json(
          { success: true, config: { strictMode: false } },
          200,
          corsOrigin,
        );
    }

    // Edge stubs for platform status endpoints — returns healthy defaults so the dashboard
    // renders even when the Render backend is cold-starting or temporarily unavailable.
    if (request.method === "GET") {
      if (url.pathname === "/api/platform/status")
        return json(
          { online: true, status: "ok", version: "1.3.0" },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/status")
        return json(
          {
            status: "healthy",
            timestamp: new Date().toISOString(),
            service: "simplebeacon-core",
            version: "1.3.0",
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/health")
        return json({ status: "ok", service: "simplebeacon" }, 200, corsOrigin);
      if (url.pathname === "/api/vault/consensus/status")
        return json(
          {
            success: true,
            status: "ok",
            consensus: { nodes: 0, healthy: 0, leader: "none" },
          },
          200,
          corsOrigin,
        );
      if (url.pathname === "/api/license/seats")
        return json(
          {
            success: true,
            seats: [],
            pendingInvites: [],
            maxSeats: 0,
            seatsUsed: 0,
            seatsRemaining: 0,
            tier: "free",
          },
          200,
          corsOrigin,
        );
    }

    // Dynamic Route 2: POST /api/stripe-webhook
    // Pure proxy — verifies the Stripe signature at the edge, then forwards
    // the raw payload to the Render backend for token minting, subscription
    // activation, and email delivery.
    //
    // Token minting was previously done at the edge but caused silent failures
    // because the Worker used outdated tier names, the wrong signing secret,
    // and couldn't match price IDs from ad-hoc price_data checkout sessions.
    // The backend has the correct SIMPLEBEACON_LICENSE_SECRET, the correct
    // tier mapping, and the correct email templates — so all minting lives there now.
    if (url.pathname === "/api/stripe-webhook" && request.method === "POST") {
      try {
        const payload = await request.text();
        await verifyStripeWebhookSignature(request, env, payload);
        const body = JSON.parse(payload);

        // Idempotency guard — check KV for already-processed event IDs
        const eventId = body.id || "";
        if (eventId) {
          const processedKey = `processed:${eventId}`;
          const alreadyProcessed = await env.LICENSE_STORE.get(processedKey);
          if (alreadyProcessed) {
            return json(
              { received: true, status: "duplicate_ignored", eventId },
              200,
              "",
            );
          }
        }

        // Forward the raw Stripe payload to the Express backend on Render.
        // The backend verifies the Stripe signature again, resolves the tier
        // from session.metadata.product, mints the license token with the
        // correct SIMPLEBEACON_LICENSE_SECRET, stores it in the session-token
        // store, and sends the welcome email — all in one place.
        const backendUrl = String(env.API_BACKEND || "");
        if (backendUrl) {
          try {
            const backendResponse = await fetch(
              `${backendUrl}/api/stripe/webhook`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "stripe-signature":
                    request.headers.get("Stripe-Signature") || "",
                },
                body: payload,
              },
            );
            if (!backendResponse.ok) {
              console.error(
                "Express backend forwarding failed:",
                backendResponse.status,
              );
            }
          } catch (err) {
            console.error("Express backend forwarding error:", err.message);
          }
        }

        // Mark event as processed in KV (idempotency guard for Stripe retries)
        if (eventId) {
          await env.LICENSE_STORE.put(
            `processed:${eventId}`,
            JSON.stringify({
              processedAt: new Date().toISOString(),
              type: body.type,
            }),
            { expirationTtl: LICENSE_TTL_SECONDS },
          );
        }

        return json({ received: true }, 200, "");
      } catch (error) {
        if (error.isSignatureError) {
          return json({ error: error.message }, 400, "");
        }
        console.error("Webhook handler error:", error.message);
        return json({ error: "Internal server error" }, 500, "");
      }
    }

    // Model file serving from R2 — serves custom Ollama models and Modelfiles to users
    // GET/HEAD /models/<filename> → streams from R2 bucket
    if (
      url.pathname.startsWith("/models/") &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const key = url.pathname.slice("/models/".length);
      if (!key || key.includes("..") || key.includes("//")) {
        return json({ error: "Invalid model path" }, 400, corsOrigin);
      }
      if (!env.MODELS_BUCKET) {
        return json({ error: "Model storage not configured" }, 503, corsOrigin);
      }
      const object = await env.MODELS_BUCKET.get(key);
      if (!object) {
        return json({ error: "Model not found" }, 404, corsOrigin);
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      const isGguf = key.endsWith(".gguf");
      headers.set(
        "Content-Type",
        isGguf ? "application/octet-stream" : "text/plain",
      );
      headers.set("Content-Length", object.size.toString());
      headers.set(
        "Content-Disposition",
        `attachment; filename="${key.split("/").pop()}"`,
      );
      headers.set("Cache-Control", "public, max-age=86400");
      // simplebeacon-ignore cors-wildcard — public model file downloads (GGUF/Modelfiles) with Content-Disposition: attachment; wildcard CORS allows any tool (Ollama, LM Studio) to download
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Accept-Ranges", "bytes");
      // For HEAD requests, return headers only (no body)
      const body = request.method === "HEAD" ? null : object.body;
      return new Response(body, { status: 200, headers });
    }

    // Edge-native compliance certificate signing — handled at the edge, never proxied to Render.
    // The private key lives in Cloudflare Secrets and is imported into WebCrypto per-request.
    if (url.pathname === "/api/v1/certify" && request.method === "POST") {
      return await handleCertifyRequest(request, env, corsOrigin);
    }
    if (
      url.pathname === "/api/v1/certify/public-key" &&
      request.method === "GET"
    ) {
      return await handlePublicKeyRequest(env, corsOrigin);
    }

    // Scan Attestation Endpoint — issues short-lived, device-bound attestation
    // tokens that the local scan worker must present before running.
    //
    // Threat model: This prevents casual copying of the scan worker. A stolen
    // worker cannot produce server-trusted scan results without a valid
    // attestation. Tokens expire in 5 minutes and are bound to a device
    // fingerprint, so they cannot be shared across machines.
    //
    // What this CANNOT prevent: a determined attacker with DevTools can
    // modify the worker to skip the attestation check. This is an inherent
    // limitation of all client-side software. The bar is raised, not made
    // impossible.
    if (url.pathname === "/api/scan/attest" && request.method === "POST") {
      return await handleScanAttestation(request, env, corsOrigin);
    }

    // Dynamic Route 3: /api/* catch-all proxy to Render backend
    // Forwards any unmatched /api/* request to the Express backend on Render.
    // This keeps API calls same-origin from the browser's perspective (no CORS issues).
    //
    // Architecture: KV cache (stale-while-revalidate) + pristine retry loop.
    // The retry loop rebuilds a fresh Headers object and Request on every attempt
    // to avoid Cloudflare Workers' ReadableStream disturbed errors, which occur
    // when request.body is referenced after an await or stream-consuming operation.
    if (url.pathname.startsWith("/api/")) {
      const backendUrl = String(env.API_BACKEND || "");
      if (!backendUrl) {
        return json({ error: "API backend not configured" }, 503, corsOrigin);
      }

      const targetUrl =
        backendUrl.replace(/\/+$/, "") + url.pathname + url.search;
      const isGetOrHead = request.method === "GET" || request.method === "HEAD";
      const cacheKey = isGetOrHead
        ? "api:" + url.pathname + ":" + url.search
        : null;

      // --- Step 1: Extract body text for non-GET methods BEFORE any await ---
      // This reads the request body stream once, up front, so the retry loop
      // can reuse the string without referencing request.body (which would
      // disturb the stream on the second attempt).
      let requestBodyText = null;
      if (!isGetOrHead) {
        try {
          requestBodyText = await request.text();
        } catch (_) {
          requestBodyText = null;
        }
      }

      // --- Step 2: Build a clean header allowlist (no body-tracking headers) ---
      // We deliberately do NOT copy request.headers wholesale. Instead we pick
      // only the headers that the backend needs. This prevents Content-Length,
      // Transfer-Encoding, and Cloudflare internal headers from contaminating
      // the outgoing fetch and triggering stream-disturbance errors.
      const SAFE_FORWARD_HEADERS = [
        "content-type",
        "authorization",
        "accept",
        "accept-language",
        "x-requested-with",
        "x-csrf-token",
        "x-api-key",
        "x-simplebeacon-bridge-token",
        "x-token-password",
        "x-license-token",
        "x-license-tier",
        "cookie",
        "stripe-signature",
        "origin",
        "referer",
      ];
      function buildCleanHeaders() {
        const h = new Headers();
        for (const name of SAFE_FORWARD_HEADERS) {
          const val = request.headers.get(name);
          if (val) h.set(name, val);
        }
        return h;
      }

      // --- Step 3: KV cache check (GET/HEAD only) ---
      // Validate cached value is valid JSON before serving. A prior cache
      // poisoning bug allowed non-JSON bodies (e.g. "Upgrade Required") to be
      // cached and served as application/json with status 200. This guard
      // ensures poisoned entries are skipped and the proxy fetches fresh.
      if (cacheKey && env.API_CACHE) {
        try {
          const cachedVal = await env.API_CACHE.get(cacheKey, "text");
          if (cachedVal !== null && cachedVal !== undefined) {
            try {
              JSON.parse(cachedVal);
              const respHeaders = new Headers({
                "Content-Type": "application/json",
              });
              respHeaders.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate",
              );
              if (corsOrigin) {
                respHeaders.set("Access-Control-Allow-Origin", corsOrigin);
                respHeaders.set("Vary", "Origin");
              }
              respHeaders.set("X-Cache", "HIT-FRESH");
              return new Response(cachedVal, {
                status: 200,
                headers: respHeaders,
              });
            } catch (_) {
              // Poisoned cache entry — delete it and fall through to proxy.
              try {
                await env.API_CACHE.delete(cacheKey);
              } catch (_) {}
            }
          }
        } catch (_) {
          /* Cache read failure — proceed to proxy */
        }
      }

      // --- Step 4: Retry loop with pristine Request per attempt ---
      const maxRetries = 3;
      let lastErr = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Build a fresh Headers object on EVERY attempt — never share
          // across iterations. This is the key fix for stream disturbance.
          const freshHeaders = buildCleanHeaders();

          // Construct a pristine Request object — no reference to the
          // original request.body stream. Body comes from the extracted
          // string (for POST/PUT) or is omitted entirely (for GET/HEAD).
          const fetchOpts = {
            method: request.method,
            headers: freshHeaders,
            redirect: "manual",
          };
          if (!isGetOrHead && requestBodyText !== null) {
            fetchOpts.body = requestBodyText;
          }

          const proxyResponse = await fetch(targetUrl, fetchOpts);

          // Retry on 502/503/504 from backend (Render overload/cold-start)
          // POST/PUT/DELETE are also retried since the body is already
          // extracted as text (line 990) and rebuilt fresh per attempt.
          if (
            (proxyResponse.status === 502 ||
              proxyResponse.status === 503 ||
              proxyResponse.status === 504) &&
            attempt < maxRetries
          ) {
            // Progressive delay: 500ms, 1s, 2s — gives Render time to spin up
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
            continue;
          }

          // Copy response with CORS headers added
          const responseHeaders = new Headers(proxyResponse.headers);
          // Always set no-cache on API responses so the browser never caches
          // stale or poisoned responses. The KV cache (server-side) handles
          // caching valid JSON responses with its own TTL.
          responseHeaders.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate",
          );
          if (corsOrigin) {
            responseHeaders.set("Access-Control-Allow-Origin", corsOrigin);
            responseHeaders.set("Vary", "Origin");
          }

          // KV cache: store only successful JSON GET responses.
          // Guard against cache poisoning from non-JSON error bodies (e.g. the
          // "Upgrade Required" 426 response Render emits during cold starts or
          // protocol mismatches) by validating both the Content-Type header and
          // that the body parses as JSON before writing to KV.
          const contentType = proxyResponse.headers.get("Content-Type") || "";
          if (
            cacheKey &&
            env.API_CACHE &&
            proxyResponse.status === 200 &&
            contentType.includes("application/json")
          ) {
            try {
              const respBody = await proxyResponse.text();
              // Validate body is valid JSON before caching — prevents storing
              // error pages, plain-text responses, or HTML 404s as "JSON".
              JSON.parse(respBody);
              await env.API_CACHE.put(cacheKey, respBody, {
                expirationTtl: 300,
              });
              responseHeaders.set("X-Cache", "MISS");
              return new Response(respBody, {
                status: proxyResponse.status,
                statusText: proxyResponse.statusText,
                headers: responseHeaders,
              });
            } catch (_) {
              /* Not JSON or cache write failure — fall through to raw response */
            }
          }

          return new Response(proxyResponse.body, {
            status: proxyResponse.status,
            statusText: proxyResponse.statusText,
            headers: responseHeaders,
          });
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
            continue;
          }
        }
      }

      // --- Step 5: All retries exhausted — serve stale cache as fallback ---
      // Validate stale cache is JSON before serving (same guard as Step 3).
      if (cacheKey && env.API_CACHE) {
        try {
          const staleVal = await env.API_CACHE.get(cacheKey, "text");
          if (staleVal !== null && staleVal !== undefined) {
            try {
              JSON.parse(staleVal);
              const respHeaders = new Headers({
                "Content-Type": "application/json",
              });
              respHeaders.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate",
              );
              respHeaders.set("X-Cache", "HIT-STALE-FALLBACK");
              if (corsOrigin) {
                respHeaders.set("Access-Control-Allow-Origin", corsOrigin);
                respHeaders.set("Vary", "Origin");
              }
              return new Response(staleVal, {
                status: 200,
                headers: respHeaders,
              });
            } catch (_) {
              // Poisoned stale entry — delete it.
              try {
                await env.API_CACHE.delete(cacheKey);
              } catch (_) {}
            }
          }
        } catch (_) {
          /* Stale fallback read failure */
        }
      }
      return json(
        {
          error: "Backend unreachable",
          detail: lastErr ? lastErr.message : "timeout",
        },
        502,
        corsOrigin,
      );
    }

    // HTML route handling — with html_handling: "none", the ASSETS binding won't
    // auto-serve index.html for directory paths. We handle HTML serving here.
    // Root landing page
    if (url.pathname === "/" || url.pathname === "") {
      const assetUrl = new URL("/index.html", url.origin);
      assetUrl.searchParams.set("_cb", Date.now().toString());
      const resp = await env.ASSETS.fetch(
        new Request(assetUrl.toString(), { method: "GET" }),
      );
      if (resp.ok) {
        const body = await resp.text();
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        headers.set("CDN-Cache-Control", "no-store");
        headers.set("X-SB-Worker", "root-html");
        return withSecurityHeaders(
          withHtmlInjections(
            new Response(body, { status: 200, headers }),
            env,
            url.pathname,
          ),
        );
      }
    }

    // Dashboard entry HTML — serve for /dashboard/ and /dashboard/<spa-route>
    if (
      url.pathname === "/dashboard" ||
      url.pathname === "/dashboard/" ||
      (url.pathname.startsWith("/dashboard/") &&
        !url.pathname.match(
          /\.(css|js|mjs|svg|png|jpg|jpeg|gif|ico|woff2|woff|ttf|otf|json|map|txt|xml|webmanifest)$/i,
        ) &&
        !url.pathname.startsWith("/dashboard/assets/"))
    ) {
      const assetUrl = new URL("/dashboard/entry-20260806.html", url.origin);
      assetUrl.searchParams.set("_cb", Date.now().toString());
      const resp = await env.ASSETS.fetch(
        new Request(assetUrl.toString(), { method: "GET" }),
      );
      if (resp.ok) {
        const body = await resp.text();
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        headers.set("CDN-Cache-Control", "no-store");
        headers.set("Vary", "*");
        headers.set("X-SB-Worker", "dashboard-html");
        return withSecurityHeaders(
          withHtmlInjections(
            new Response(body, { status: 200, headers }),
            env,
            url.pathname,
          ),
        );
      }
    }

    // Other HTML pages (landing pages like /pricing, /faq, etc.)
    if (
      url.pathname.endsWith(".html") ||
      (!url.pathname.includes(".") && url.pathname !== "/")
    ) {
      let tryPath = url.pathname.endsWith(".html")
        ? url.pathname
        : url.pathname + ".html";
      // Serve dpa-v2.html for /dpa to bypass stale ASSETS binding cache on dpa.html
      if (tryPath === "/dpa.html") tryPath = "/dpa-v2.html";
      const assetUrl = new URL(tryPath, url.origin);
      assetUrl.searchParams.set("_cb", Date.now().toString());
      const resp = await env.ASSETS.fetch(
        new Request(assetUrl.toString(), { method: "GET" }),
      );
      if (resp.ok) {
        const body = await resp.text();
        const headers = new Headers();
        headers.set("Content-Type", "text/html; charset=utf-8");
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        headers.set("CDN-Cache-Control", "no-store");
        headers.set("X-SB-Worker", "page-html");
        return withSecurityHeaders(
          withHtmlInjections(
            new Response(body, { status: 200, headers }),
            env,
            url.pathname,
          ),
        );
      }
    }

    // Catch-all: serve static files from ASSETS binding
    // Strip query strings before fetching from ASSETS — the binding does file lookups
    // by path and returns 404 when query params are present (e.g. ?v=20260807)
    const cleanAssetReq = new Request(
      new URL(url.pathname, url.origin).toString(),
      {
        method: request.method,
        headers: request.headers,
      },
    );
    const assetResp = await env.ASSETS.fetch(cleanAssetReq);
    if (assetResp.ok) {
      const headers = new Headers(assetResp.headers);
      // Ensure correct MIME types for JS/CSS
      if (url.pathname.endsWith(".js") || url.pathname.endsWith(".mjs")) {
        headers.set("Content-Type", "text/javascript; charset=utf-8");
      } else if (url.pathname.endsWith(".css")) {
        headers.set("Content-Type", "text/css; charset=utf-8");
      }
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-SB-Worker", "catchall-assets");
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      headers.set("CDN-Cache-Control", "no-store");
      headers.set("Vary", "*");

      const isHtml =
        (headers.get("Content-Type") || "").includes("text/html") ||
        url.pathname.endsWith(".html") ||
        url.pathname === "/" ||
        (!url.pathname.includes(".") &&
          assetResp.headers.get("Content-Type", "").includes("text/html"));
      const response = new Response(assetResp.body, {
        status: assetResp.status,
        headers,
      });
      if (isHtml)
        return withSecurityHeaders(
          withHtmlInjections(response, env, url.pathname),
        );
      return response;
    }

    // 404 — never cache negative responses so fixes propagate instantly
    const notFoundHeaders = {
      "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
    };
    if (corsOrigin) {
      notFoundHeaders["Access-Control-Allow-Origin"] = corsOrigin;
      notFoundHeaders["Vary"] = "Origin";
    }
    return new Response("Not Found", { status: 404, headers: notFoundHeaders });
  },

  // Scheduled event: keep Render backend warm every 5 minutes
  // Render free tier spins down after 15 min of inactivity, causing 502s/500s.
  // The 5-min interval gives a 10-min safety buffer. If the first probe fails
  // (backend mid-spin-up), retry up to 2 more times with 3s delays.
  async scheduled(event, env) {
    const backendUrl = String(env.API_BACKEND || "");
    if (!backendUrl) return;
    const healthUrl = backendUrl.replace(/\/+$/, "") + "/api/health";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(healthUrl, {
          method: "GET",
          headers: { "User-Agent": "simplebeacon-keepalive/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return; // Backend is warm
      } catch (_) {
        // Backend may still be spinning up — retry after a short delay
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  },
};
