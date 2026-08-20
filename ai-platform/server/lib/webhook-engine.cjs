"use strict";

/**
 * Webhook Engine — Event router that dispatches compliance events to
 * configured integration channels (Slack, Teams, Jira, GitHub PR).
 *
 * @module webhook-engine
 */

const https = require("https");
const { URL } = require("url");
const logger = require("../lib/app-logger.cjs");
const integrationStore = require("./integration-config-store.cjs");
const signingStore = require("./webhook-signing-store.cjs");

// Configurable timeouts and retry/backoff for external webhook deliveries
const DEFAULT_WEBHOOK_TIMEOUT_MS = process.env.WEBHOOK_REQUEST_TIMEOUT_MS
  ? parseInt(process.env.WEBHOOK_REQUEST_TIMEOUT_MS, 10)
  : 15000;
const WEBHOOK_RETRY_BASE_MS = process.env.WEBHOOK_RETRY_BASE_MS
  ? parseInt(process.env.WEBHOOK_RETRY_BASE_MS, 10)
  : 200;
const WEBHOOK_RETRY_MAX_ATTEMPTS = process.env.WEBHOOK_RETRY_MAX_ATTEMPTS
  ? parseInt(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS, 10)
  : 3;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function retryWithBackoff(
  fn,
  maxAttempts = WEBHOOK_RETRY_MAX_ATTEMPTS,
  baseMs = WEBHOOK_RETRY_BASE_MS,
  context = {},
) {
  let attempt = 0;
  while (true) {
    try {
      return await fn({ attempt });
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      const jitter = Math.floor(Math.random() * baseMs);
      const backoffMs = baseMs * Math.pow(2, attempt - 1) + jitter;
      try {
        signingStore.recordDelivery({
          url: context.url || null,
          orgId: context.orgId || null,
          event: context.event || null,
          keyId: null,
          signed: false,
          attempt: attempt,
          status: "retrying",
          error: err.message,
        });
      } catch (e) {}
      await delay(backoffMs);
    }
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function httpsPostJsonOnce(url, body, headers = {}, context = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = JSON.stringify(body);

    // Build signature headers for outbound webhook delivery
    var signHeaders = {};
    var signed = false;
    try {
      signHeaders = signingStore.buildSignatureHeaders(
        postData,
        context.orgId,
        context.keyId,
      );
      signed = Object.keys(signHeaders).length > 0;
    } catch (err) {
      logger.warn(
        "[WebhookEngine] Signature header generation failed:",
        err.message,
      );
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...headers,
        ...signHeaders,
      },
    };
    const startMs = Date.now();
    const timeoutMs = context.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS;
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        var latencyMs = Date.now() - startMs;
        try {
          signingStore.recordDelivery({
            url: url,
            orgId: context.orgId || null,
            event: context.event || null,
            keyId: signHeaders["X-Beacon-Key-Id"] || null,
            signed: signed,
            attempt: context.attempt || 0,
            status:
              res.statusCode >= 200 && res.statusCode < 300
                ? "success"
                : "failed",
            statusCode: res.statusCode,
            latencyMs: latencyMs,
            retried: (context.attempt || 0) > 0,
          });
        } catch {}
        resolve({ status: res.statusCode, data, latencyMs, signed });
      });
    });
    req.on("error", (err) => {
      var latencyMs = Date.now() - startMs;
      try {
        signingStore.recordDelivery({
          url: url,
          orgId: context.orgId || null,
          event: context.event || null,
          keyId: signHeaders["X-Beacon-Key-Id"] || null,
          signed: signed,
          attempt: context.attempt || 0,
          status: "failed",
          statusCode: null,
          latencyMs: latencyMs,
          error: err.message,
          retried: (context.attempt || 0) > 0,
        });
      } catch {}
      reject(err);
    });
    // socket timeout handling
    req.setTimeout(timeoutMs, () => {
      try {
        req.abort();
      } catch (e) {}
      var latencyMs = Date.now() - startMs;
      try {
        signingStore.recordDelivery({
          url: url,
          orgId: context.orgId || null,
          event: context.event || null,
          keyId: signHeaders["X-Beacon-Key-Id"] || null,
          signed: signed,
          attempt: context.attempt || 0,
          status: "failed",
          statusCode: null,
          latencyMs: latencyMs,
          error: "timeout",
          retried: (context.attempt || 0) > 0,
        });
      } catch {}
      reject(new Error("Request timed out"));
    });
    req.write(postData);
    req.end();
  });
}

function httpsPostJson(url, body, headers = {}, context = {}) {
  const wrapper = (ctx) =>
    httpsPostJsonOnce(
      url,
      body,
      headers,
      Object.assign({}, context, { attempt: ctx.attempt, url }),
    );
  return retryWithBackoff(
    wrapper,
    WEBHOOK_RETRY_MAX_ATTEMPTS,
    WEBHOOK_RETRY_BASE_MS,
    { url, orgId: context.orgId, event: context.event },
  );
}

// Form POST with timeout + retry
function httpsPostFormOnce(url, formData, headers = {}, context = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const { URLSearchParams } = require("url");
    const postData = new URLSearchParams(formData).toString();
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        ...headers,
      },
    };
    const startMs = Date.now();
    const timeoutMs = context.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS;
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        var latencyMs = Date.now() - startMs;
        try {
          signingStore.recordDelivery({
            url,
            orgId: context.orgId || null,
            event: context.event || null,
            attempt: context.attempt || 0,
            status:
              res.statusCode >= 200 && res.statusCode < 300
                ? "success"
                : "failed",
            statusCode: res.statusCode,
            latencyMs,
          });
        } catch (e) {}
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", (err) => {
      var latencyMs = Date.now() - startMs;
      try {
        signingStore.recordDelivery({
          url,
          orgId: context.orgId || null,
          event: context.event || null,
          attempt: context.attempt || 0,
          status: "failed",
          error: err.message,
          latencyMs,
        });
      } catch (e) {}
      reject(err);
    });
    req.setTimeout(timeoutMs, () => {
      try {
        req.abort();
      } catch (e) {}
      reject(new Error("Request timed out"));
    });
    req.write(postData);
    req.end();
  });
}

function httpsPostForm(url, formData, headers = {}, context = {}) {
  const wrapper = (ctx) =>
    httpsPostFormOnce(
      url,
      formData,
      headers,
      Object.assign({}, context, { attempt: ctx.attempt, url }),
    );
  return retryWithBackoff(
    wrapper,
    WEBHOOK_RETRY_MAX_ATTEMPTS,
    WEBHOOK_RETRY_BASE_MS,
    { url, orgId: context && context.orgId, event: context && context.event },
  );
}

// GET JSON with timeout + retry
function httpsGetJsonOnce(url, headers = {}, context = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { Accept: "application/json", ...headers },
    };
    const startMs = Date.now();
    const timeoutMs = context.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS;
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        var latencyMs = Date.now() - startMs;
        try {
          signingStore.recordDelivery({
            url,
            orgId: context.orgId || null,
            event: context.event || null,
            attempt: context.attempt || 0,
            status:
              res.statusCode >= 200 && res.statusCode < 300
                ? "success"
                : "failed",
            statusCode: res.statusCode,
            latencyMs,
          });
        } catch (e) {}
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", (err) => {
      var latencyMs = Date.now() - startMs;
      try {
        signingStore.recordDelivery({
          url,
          orgId: context.orgId || null,
          event: context.event || null,
          attempt: context.attempt || 0,
          status: "failed",
          error: err.message,
          latencyMs,
        });
      } catch (e) {}
      reject(err);
    });
    req.setTimeout(timeoutMs, () => {
      try {
        req.abort();
      } catch (e) {}
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

function httpsGetJson(url, headers = {}, context = {}) {
  const wrapper = (ctx) =>
    httpsGetJsonOnce(
      url,
      headers,
      Object.assign({}, context, { attempt: ctx.attempt, url }),
    );
  return retryWithBackoff(
    wrapper,
    WEBHOOK_RETRY_MAX_ATTEMPTS,
    WEBHOOK_RETRY_BASE_MS,
    { url, orgId: context && context.orgId, event: context && context.event },
  );
}

// ── Event payload builder ───────────────────────────────────────────────────

function buildEventPayload(event, context) {
  return {
    event,
    eventLabel: integrationStore.EVENT_TYPES[event] || event,
    orgId: context.orgId || "unknown",
    timestamp: new Date().toISOString(),
    summary: context.summary || "",
    severity: context.severity || "info",
    issueCount: context.issueCount || 0,
    highSeverityCount: context.highSeverityCount || 0,
    criticalSeverityCount: context.criticalSeverityCount || 0,
    gateStatus: context.gateStatus || null,
    scanDuration: context.scanDuration || null,
    reportUrl: context.reportUrl || null,
    repository: context.repository || null,
    branch: context.branch || null,
    commitSha: context.commitSha || null,
    issues: context.issues || [],
  };
}

// ── Slack Adapter ───────────────────────────────────────────────────────────

function formatSlackPayload(payload) {
  const color =
    payload.severity === "critical"
      ? "#FF0000"
      : payload.severity === "high"
        ? "#FF6600"
        : payload.severity === "medium"
          ? "#FFAA00"
          : "#36A64F";

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `SimpleBeacon: ${payload.eventLabel}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Organization:*\n${payload.orgId}` },
        {
          type: "mrkdwn",
          text: `*Severity:*\n${payload.severity.toUpperCase()}`,
        },
      ],
    },
  ];

  if (payload.summary) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: payload.summary },
    });
  }

  if (payload.issueCount > 0) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Total Issues:*\n${payload.issueCount}` },
        {
          type: "mrkdwn",
          text: `*High Severity:*\n${payload.highSeverityCount}`,
        },
        {
          type: "mrkdwn",
          text: `*Critical:*\n${payload.criticalSeverityCount}`,
        },
        {
          type: "mrkdwn",
          text: `*Gate Status:*\n${payload.gateStatus || "N/A"}`,
        },
      ],
    });
  }

  if (payload.repository) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:github: ${payload.repository}${payload.branch ? " / " + payload.branch : ""}${payload.commitSha ? " / " + payload.commitSha.slice(0, 7) : ""}`,
        },
      ],
    });
  }

  if (payload.reportUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Report" },
          url: payload.reportUrl,
          style: "primary",
        },
      ],
    });
  }

  if (payload.issues && payload.issues.length > 0) {
    const topIssues = payload.issues.slice(0, 5);
    const issueText = topIssues
      .map(
        (i) =>
          `• *${i.severity || "unknown"}* — ${i.description || i.message || i.type || "Unknown issue"}${i.filePath ? " (" + i.filePath + (i.line ? ":" + i.line : "") + ")" : ""}`,
      )
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Top Issues:*\n${issueText}${payload.issues.length > 5 ? `\n_and ${payload.issues.length - 5} more..._` : ""}`,
      },
    });
  }

  return { blocks, attachments: [{ color, blocks }] };
}

async function sendSlack(config, payload, dispatchCtx) {
  const webhookUrl = config.config.webhookUrl;
  if (!webhookUrl) throw new Error("Slack webhook URL not configured");
  const body = formatSlackPayload(payload);
  const result = await httpsPostJson(webhookUrl, body, {}, dispatchCtx);
  if (result.status !== 200) {
    throw new Error(`Slack webhook failed: ${result.status} — ${result.data}`);
  }
  return { success: true, status: result.status, signed: result.signed };
}

// ── Microsoft Teams Adapter ─────────────────────────────────────────────────

function formatTeamsPayload(payload) {
  const accentColor =
    payload.severity === "critical"
      ? "FF0000"
      : payload.severity === "high"
        ? "FF6600"
        : payload.severity === "medium"
          ? "FFAA00"
          : "36A64F";

  const facts = [
    { name: "Organization", value: payload.orgId },
    { name: "Severity", value: payload.severity.toUpperCase() },
    { name: "Event", value: payload.eventLabel },
  ];

  if (payload.issueCount > 0) {
    facts.push({ name: "Total Issues", value: String(payload.issueCount) });
    facts.push({
      name: "High Severity",
      value: String(payload.highSeverityCount),
    });
    facts.push({
      name: "Critical",
      value: String(payload.criticalSeverityCount),
    });
    facts.push({ name: "Gate Status", value: payload.gateStatus || "N/A" });
  }

  if (payload.repository) {
    facts.push({
      name: "Repository",
      value: `${payload.repository}${payload.branch ? "/" + payload.branch : ""}`,
    });
  }

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
          body: [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: `SimpleBeacon: ${payload.eventLabel}`,
                  size: "Large",
                  weight: "Bolder",
                },
              ],
              bleed: true,
              style: accentColor === "36A64F" ? "good" : "attention",
            },
            {
              type: "FactSet",
              facts,
            },
          ],
          actions: payload.reportUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: "View Report",
                  url: payload.reportUrl,
                },
              ]
            : [],
        },
      },
    ],
  };

  if (payload.summary) {
    card.attachments[0].content.body.splice(1, 0, {
      type: "TextBlock",
      text: payload.summary,
      wrap: true,
    });
  }

  if (payload.issues && payload.issues.length > 0) {
    const topIssues = payload.issues.slice(0, 5);
    const issueText = topIssues
      .map(
        (i) =>
          `**${i.severity || "unknown"}** — ${i.description || i.message || i.type || "Unknown issue"}${i.filePath ? " (" + i.filePath + (i.line ? ":" + i.line : "") + ")" : ""}`,
      )
      .join("\n\n");
    card.attachments[0].content.body.push({
      type: "TextBlock",
      text: `**Top Issues:**\n\n${issueText}${payload.issues.length > 5 ? `\n\n_And ${payload.issues.length - 5} more..._` : ""}`,
      wrap: true,
    });
  }

  return card;
}

async function sendTeams(config, payload, dispatchCtx) {
  const webhookUrl = config.config.webhookUrl;
  if (!webhookUrl) throw new Error("Teams webhook URL not configured");
  const body = formatTeamsPayload(payload);
  const result = await httpsPostJson(webhookUrl, body, {}, dispatchCtx);
  if (result.status !== 200) {
    throw new Error(`Teams webhook failed: ${result.status} — ${result.data}`);
  }
  return { success: true, status: result.status, signed: result.signed };
}

// ── Jira Adapter ────────────────────────────────────────────────────────────

async function sendJira(config, payload) {
  const { host, email, apiToken, projectKey } = config.config;
  if (!host || !email || !apiToken || !projectKey) {
    throw new Error("Jira requires host, email, apiToken, and projectKey");
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const jiraUrl = `https://${host}/rest/api/3/issue`;

  const severityPriority = {
    critical: "Highest",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const summary = `[SimpleBeacon] ${payload.eventLabel} — ${payload.orgId}`;
  const description = buildJiraDescription(payload);

  const issueBody = {
    fields: {
      project: { key: projectKey },
      summary,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: description }],
          },
        ],
      },
      issuetype: { name: "Task" },
      priority: { name: severityPriority[payload.severity] || "Medium" },
      labels: [
        "simplebeacon",
        `severity-${payload.severity}`,
        `event-${payload.event}`,
      ],
    },
  };

  const result = await httpsPostJson(
    jiraUrl,
    issueBody,
    {
      Authorization: `Basic ${auth}`,
    },
    { orgId: payload.orgId, event: payload.event },
  );

  if (result.status !== 201) {
    throw new Error(
      `Jira issue creation failed: ${result.status} — ${result.data}`,
    );
  }

  const created =
    typeof result.data === "object" ? result.data : JSON.parse(result.data);
  return {
    success: true,
    issueKey: created.key,
    issueUrl: `https://${host}/browse/${created.key}`,
  };
}

function buildJiraDescription(payload) {
  const lines = [
    `SimpleBeacon compliance event detected.`,
    "",
    `Event: ${payload.eventLabel}`,
    `Organization: ${payload.orgId}`,
    `Severity: ${payload.severity.toUpperCase()}`,
    `Timestamp: ${payload.timestamp}`,
  ];

  if (payload.summary) lines.push("", payload.summary);
  if (payload.issueCount > 0) {
    lines.push(
      "",
      "Issue Summary:",
      `  Total: ${payload.issueCount}`,
      `  High: ${payload.highSeverityCount}`,
      `  Critical: ${payload.criticalSeverityCount}`,
    );
  }
  if (payload.gateStatus) lines.push(`  Gate: ${payload.gateStatus}`);
  if (payload.repository)
    lines.push(
      "",
      `Repository: ${payload.repository}${payload.branch ? " / " + payload.branch : ""}`,
    );

  if (payload.issues && payload.issues.length > 0) {
    lines.push("", "Top Issues:");
    payload.issues.slice(0, 10).forEach((i) => {
      lines.push(
        `  - [${i.severity || "unknown"}] ${i.description || i.message || i.type}${i.filePath ? " (" + i.filePath + (i.line ? ":" + i.line : "") + ")" : ""}`,
      );
    });
    if (payload.issues.length > 10)
      lines.push(`  ... and ${payload.issues.length - 10} more`);
  }

  if (payload.reportUrl) lines.push("", `Report: ${payload.reportUrl}`);

  return lines.join("\n");
}

// ── GitHub PR Comment Adapter ───────────────────────────────────────────────

async function sendGitHub(config, payload) {
  const { token, owner, repo } = config.config;
  if (!token || !owner || !repo) {
    throw new Error("GitHub requires token, owner, and repo");
  }

  const prNumber = payload.prNumber || payload.pullRequestNumber;
  if (!prNumber) {
    logger.warn(
      "[Integrations] GitHub PR comment skipped — no PR number in payload",
    );
    return { success: false, reason: "no_pr_number" };
  }

  const commentBody = buildGitHubComment(payload);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const result = await httpsPostJson(
    apiUrl,
    { body: commentBody },
    {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SimpleBeacon-Integration",
    },
    { orgId: payload.orgId, event: payload.event },
  );

  if (result.status !== 201) {
    throw new Error(
      `GitHub PR comment failed: ${result.status} — ${result.data}`,
    );
  }

  const created =
    typeof result.data === "object" ? result.data : JSON.parse(result.data);
  return { success: true, commentUrl: created.html_url };
}

function buildGitHubComment(payload) {
  const severityIcon = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
    info: "🔵",
  };

  const icon = severityIcon[payload.severity] || "⚪";

  const lines = [
    `## ${icon} SimpleBeacon Compliance Scan — ${payload.eventLabel}`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Severity | ${payload.severity.toUpperCase()} |`,
    `| Organization | ${payload.orgId} |`,
  ];

  if (payload.issueCount > 0) {
    lines.push(`| Total Issues | ${payload.issueCount} |`);
    lines.push(`| High Severity | ${payload.highSeverityCount} |`);
    lines.push(`| Critical | ${payload.criticalSeverityCount} |`);
    lines.push(`| Gate Status | ${payload.gateStatus || "N/A"} |`);
  }

  if (payload.summary) lines.push("", payload.summary);

  if (payload.issues && payload.issues.length > 0) {
    lines.push("", "### Top Issues", "");
    lines.push("| Severity | Issue | Location |");
    lines.push("|----------|-------|----------|");
    payload.issues.slice(0, 10).forEach((i) => {
      const sev = i.severity || "unknown";
      const desc = (i.description || i.message || i.type || "Unknown").replace(
        /\|/g,
        "\\|",
      );
      const loc = i.filePath
        ? `${i.filePath}${i.line ? ":" + i.line : ""}`
        : "—";
      lines.push(`| ${sev} | ${desc} | ${loc} |`);
    });
    if (payload.issues.length > 10) {
      lines.push(`| ... | _${payload.issues.length - 10} more issues_ | |`);
    }
  }

  if (payload.reportUrl) {
    lines.push("", `📋 [View Full Report](${payload.reportUrl})`);
  }

  lines.push(
    "",
    "---",
    "_Powered by [SimpleBeacon](https://simplebeacon.ai) — AI-generated code compliance scanning_",
  );

  return lines.join("\n");
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

const ADAPTERS = {
  slack: sendSlack,
  teams: sendTeams,
  jira: sendJira,
  github: sendGitHub,
};

async function dispatchEvent(event, context) {
  const orgId = context.orgId;
  if (!orgId) {
    logger.warn("[Integrations] Cannot dispatch event without orgId");
    return { dispatched: 0, results: [] };
  }

  const configs = integrationStore.getConfigsByOrgDecrypted(orgId);
  const eligible = configs.filter((c) => c.enabled && c.events.includes(event));

  if (eligible.length === 0) {
    return { dispatched: 0, results: [] };
  }

  const payload = buildEventPayload(event, context);
  const results = [];

  for (const config of eligible) {
    const adapter = ADAPTERS[config.type];
    if (!adapter) {
      results.push({
        configId: config.configId,
        type: config.type,
        success: false,
        error: "No adapter",
      });
      continue;
    }

    try {
      const dispatchCtx = { orgId, event };
      const result = await adapter(config, payload, dispatchCtx);
      results.push({ configId: config.configId, type: config.type, ...result });
      logger.info(
        `[Integrations] ${config.type} dispatch success for org ${orgId} event ${event}`,
      );
    } catch (err) {
      results.push({
        configId: config.configId,
        type: config.type,
        success: false,
        error: err.message,
      });
      logger.error(
        `[Integrations] ${config.type} dispatch failed for org ${orgId}: ${err.message}`,
      );
    }
  }

  return { dispatched: results.filter((r) => r.success).length, results };
}

module.exports = {
  dispatchEvent,
  buildEventPayload,
  formatSlackPayload,
  formatTeamsPayload,
  buildJiraDescription,
  buildGitHubComment,
  ADAPTERS,
};
