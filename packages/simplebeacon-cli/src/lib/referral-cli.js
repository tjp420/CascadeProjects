"use strict";

/**
 * CLI referral helpers — resolve referrer identity and call SimpleBeacon API.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function decodeJwtEmail(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const payload = JSON.parse(payloadJson);
    return payload.email || payload.sub || null;
  } catch {
    return null;
  }
}

function readLicenseTokenFromDisk() {
  const licensePath = path.join(os.homedir(), ".simplebeacon", "license.jwt");
  try {
    if (!fs.existsSync(licensePath)) return null;
    return fs.readFileSync(licensePath, "utf8").trim();
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  return email.includes("@") ? email : null;
}

/**
 * Resolve the referrer's email from flags, env, or local license token.
 */
function resolveReferrerEmail(options = {}) {
  const fromFlag = normalizeEmail(options.from);
  if (fromFlag) return fromFlag;

  const envReferrer = normalizeEmail(process.env.SIMPLEBEACON_REFERRER_EMAIL);
  if (envReferrer) return envReferrer;

  const envEmail = normalizeEmail(process.env.SIMPLEBEACON_EMAIL);
  if (envEmail) return envEmail;

  const token = String(
    process.env.SIMPLEBEACON_LICENSE_TOKEN || readLicenseTokenFromDisk() || "",
  ).trim();
  const fromToken = normalizeEmail(decodeJwtEmail(token));
  if (fromToken) return fromToken;

  return null;
}

function getApiBase(server) {
  return String(
    server || process.env.SIMPLEBEACON_API_URL || "https://simplebeacon.ai",
  ).replace(/\/$/, "");
}

async function fetchJson(url, init, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function isReferralNudgeDisabled(options = {}) {
  if (options.noReferralNudge === true) return true;
  const env = String(process.env.SIMPLEBEACON_REFERRAL_NUDGE || "")
    .trim()
    .toLowerCase();
  return env === "false" || env === "0" || env === "no";
}

/**
 * Resolve share URL for post-scan nudge — personalized when identity + network available.
 */
async function resolveReferralNudgeContext(options = {}) {
  const base = getApiBase(options.server || options.apiUrl);
  const generic = {
    shareUrl: `${base}/`,
    partnerCode: null,
    personalized: false,
  };

  if (options.offline) return generic;

  const referrerEmail = resolveReferrerEmail(options);
  if (!referrerEmail) return generic;

  try {
    const data = await fetchReferralLink({
      server: options.server || options.apiUrl,
      referrerEmail,
      channel: "cli-scan-nudge",
      sendEmail: false,
      timeoutMs: 5000,
    });
    return {
      shareUrl: data.shareUrl || generic.shareUrl,
      partnerCode: data.partnerCode || data.slug || null,
      personalized: true,
    };
  } catch {
    return generic;
  }
}

/**
 * Print referral nudge after a passing scan (non-blocking, stderr-only).
 */
async function runReferralNudge(options = {}, gateResult = null, io = {}) {
  const writeErr = io.writeErr || ((msg) => process.stderr.write(msg));

  if (isReferralNudgeDisabled(options)) return;
  if (options.quiet || options.watch) return;
  if (!gateResult || gateResult.pass !== true) return;

  const { formatReferralNudgeBanner } = require("../reporters/text");
  const context = await resolveReferralNudgeContext(options);
  writeErr(`\n${formatReferralNudgeBanner(context)}\n`);
}

async function fetchReferralLink({
  server,
  referrerEmail,
  channel,
  sendEmail,
  timeoutMs,
}) {
  const base = getApiBase(server);
  const params = new URLSearchParams({
    email: referrerEmail,
    channel: channel || "cli",
  });
  if (sendEmail) params.set("sendEmail", "true");
  const url = `${base}/api/referral/link?${params.toString()}`;
  const result = await fetchJson(url, { method: "GET" }, timeoutMs);
  if (!result.ok || !result.data?.success) {
    throw new Error(
      result.data?.error || `Failed to create referral link (${result.status})`,
    );
  }
  return result.data;
}

async function sendReferralInvite({
  server,
  referrerEmail,
  inviteeEmail,
  message,
}) {
  const base = getApiBase(server);
  const url = `${base}/api/referral/invite`;
  const result = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      referrerEmail,
      inviteeEmail,
      message: message || undefined,
    }),
  });
  if (!result.ok || !result.data?.success) {
    throw new Error(
      result.data?.error || `Failed to send referral invite (${result.status})`,
    );
  }
  return result.data;
}

function formatTextResult(mode, payload) {
  if (mode === "invite") {
    const lines = [
      "Referral invite queued successfully.",
      `Share URL: ${payload.shareUrl}`,
      payload.emailSent
        ? "Email sent to colleague."
        : payload.emailQueued
          ? "Email queued for delivery."
          : "",
    ].filter(Boolean);
    return lines.join("\n");
  }
  const lines = [
    "Your SimpleBeacon referral link:",
    payload.shareUrl,
    `Partner code: ${payload.partnerCode || payload.slug || "n/a"}`,
  ];
  if (payload.emailSent) lines.push("Link emailed to your inbox.");
  else if (payload.emailQueued) lines.push("Link email queued for delivery.");
  return lines.join("\n");
}

/**
 * Run `simplebeacon refer` — generate a link or email an invite via the API mesh.
 */
async function runReferCommand(options = {}, io = {}) {
  const writeOut = io.writeOut || ((msg) => process.stdout.write(`${msg}\n`));
  const writeErr = io.writeErr || ((msg) => process.stderr.write(`${msg}\n`));

  const referrerEmail = resolveReferrerEmail(options);
  if (!referrerEmail) {
    throw new Error(
      "Referrer email required. Use --from you@company.com, set SIMPLEBEACON_REFERRER_EMAIL, or save a license token to ~/.simplebeacon/license.jwt",
    );
  }

  const inviteeEmail = normalizeEmail(options.inviteeEmail || options.email);
  const server = options.server;
  const jsonOutput = options.format === "json";
  const linkOnly = options.link === true || !inviteeEmail;

  if (linkOnly) {
    writeErr("[refer] Fetching your referral link...");
    const data = await fetchReferralLink({
      server,
      referrerEmail,
      channel: "cli",
      sendEmail: options.sendEmail === true,
    });
    const payload = {
      success: true,
      mode: "link",
      referrerEmail,
      partnerCode: data.partnerCode,
      slug: data.slug,
      shareUrl: data.shareUrl,
      emailSent: data.emailSent === true,
      emailQueued: data.emailQueued === true,
    };
    if (jsonOutput) {
      writeOut(JSON.stringify(payload, null, 2));
    } else {
      writeOut(formatTextResult("link", payload));
    }
    return payload;
  }

  if (referrerEmail === inviteeEmail) {
    throw new Error(
      "Cannot invite yourself — use a colleague email with --email",
    );
  }

  writeErr(`[refer] Sending invite to ${inviteeEmail}...`);
  const data = await sendReferralInvite({
    server,
    referrerEmail,
    inviteeEmail,
    message: options.message,
  });

  const payload = {
    success: true,
    mode: "invite",
    referrerEmail,
    inviteeEmail,
    shareUrl: data.shareUrl,
    emailSent: data.emailSent === true,
    emailQueued: data.emailQueued === true,
  };

  if (jsonOutput) {
    writeOut(JSON.stringify(payload, null, 2));
  } else {
    writeOut(formatTextResult("invite", payload));
  }
  return payload;
}

module.exports = {
  decodeJwtEmail,
  resolveReferrerEmail,
  fetchReferralLink,
  sendReferralInvite,
  runReferCommand,
  isReferralNudgeDisabled,
  resolveReferralNudgeContext,
  runReferralNudge,
};
