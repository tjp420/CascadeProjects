// SPDX-License-Identifier: MIT
/**
 * Purchase notification dispatcher for Slack/Discord.
 *
 * Sends a formatted alert when a customer completes a checkout.
 * Supports Slack and Discord incoming webhook URLs via a single
 * PURCHASE_ALERT_WEBHOOK env var. If not set, notifications are
 * silently skipped (no-op).
 *
 * @license MIT
 */

"use strict";

const logger = require("./app-logger.cjs");

/**
 * Mask an email address for privacy in notifications.
 * "jane.developer@company.com" -> "j***r@company.com"
 * @param {string} email - The customer email.
 * @returns {string} Masked email.
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  var atIdx = email.indexOf("@");
  if (atIdx < 2) return email;
  var local = email.substring(0, atIdx);
  var domain = email.substring(atIdx);
  var first = local.charAt(0);
  var last = local.charAt(local.length - 1);
  return first + "***" + last + domain;
}

/**
 * Build a Slack-formatted message body.
 * @param {Object} params - { tier, email, priceId, amount, customerId }
 * @returns {Object} Slack webhook payload.
 */
function buildSlackPayload(params) {
  var tierEmoji =
    params.tier === "team_pro"
      ? ":rocket:"
      : params.tier === "developer"
        ? ":computer:"
        : params.tier === "enterprise"
          ? ":office:"
          : ":moneybag:";
  return {
    text: tierEmoji + " New SimpleBeacon Purchase",
    attachments: [
      {
        color:
          params.tier === "enterprise"
            ? "#7c3aed"
            : params.tier === "team_pro"
              ? "#22c55e"
              : "#3b82f6",
        fields: [
          { title: "Tier", value: params.tier, short: true },
          {
            title: "Amount",
            value: params.amount
              ? "$" + (params.amount / 100).toFixed(2)
              : "N/A",
            short: true,
          },
          { title: "Customer", value: maskEmail(params.email), short: true },
          { title: "Price ID", value: params.priceId || "N/A", short: true },
          {
            title: "Stripe Customer",
            value: params.customerId || "N/A",
            short: true,
          },
          { title: "Timestamp", value: new Date().toISOString(), short: true },
        ],
        footer: "SimpleBeacon Billing",
      },
    ],
  };
}

/**
 * Build a Discord-formatted message body.
 * @param {Object} params - { tier, email, priceId, amount, customerId }
 * @returns {Object} Discord webhook payload.
 */
function buildDiscordPayload(params) {
  var color =
    params.tier === "enterprise"
      ? 8126975 // purple
      : params.tier === "team_pro"
        ? 2293760 // green
        : 3932160; // blue
  var emoji =
    params.tier === "team_pro"
      ? "🚀"
      : params.tier === "developer"
        ? "💻"
        : params.tier === "enterprise"
          ? "🏢"
          : "💰";
  return {
    embeds: [
      {
        title: emoji + " New SimpleBeacon Purchase",
        color: color,
        fields: [
          { name: "Tier", value: params.tier, inline: true },
          {
            name: "Amount",
            value: params.amount
              ? "$" + (params.amount / 100).toFixed(2)
              : "N/A",
            inline: true,
          },
          { name: "Customer", value: maskEmail(params.email), inline: true },
          { name: "Price ID", value: params.priceId || "N/A", inline: true },
          {
            name: "Stripe Customer",
            value: params.customerId || "N/A",
            inline: true,
          },
          { name: "Timestamp", value: new Date().toISOString(), inline: true },
        ],
        footer: { text: "SimpleBeacon Billing" },
      },
    ],
  };
}

/**
 * Send a purchase notification to Slack or Discord.
 * Detects the platform from the webhook URL domain.
 * Silently skips if PURCHASE_ALERT_WEBHOOK is not set.
 *
 * @param {Object} params - { tier, email, priceId, amount, customerId }
 * @returns {Promise<{sent:boolean, platform:string|null}>}
 */
async function sendPurchaseAlert(params) {
  var webhookUrl = process.env.PURCHASE_ALERT_WEBHOOK;
  if (!webhookUrl) {
    return { sent: false, platform: null };
  }

  var isDiscord =
    webhookUrl.indexOf("discord.com/api/webhooks") >= 0 ||
    webhookUrl.indexOf("discordapp.com/api/webhooks") >= 0;
  var isSlack = webhookUrl.indexOf("hooks.slack.com") >= 0;

  if (!isDiscord && !isSlack) {
    logger.warn(
      "[PurchaseAlert] Webhook URL does not match Slack or Discord pattern, skipping",
    );
    return { sent: false, platform: null };
  }

  var platform = isDiscord ? "discord" : "slack";
  var payload = isDiscord
    ? buildDiscordPayload(params)
    : buildSlackPayload(params);

  try {
    var body = JSON.stringify(payload);
    // Use global fetch (Node 18+)
    var response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });

    if (!response.ok) {
      logger.warn(
        "[PurchaseAlert] " + platform + " returned HTTP " + response.status,
      );
      return { sent: false, platform: platform };
    }

    logger.info(
      "[PurchaseAlert] Notification sent to " + platform + " for tier:",
      params.tier,
    );
    return { sent: true, platform: platform };
  } catch (err) {
    logger.warn(
      "[PurchaseAlert] Failed to send to " + platform + ":",
      err.message,
    );
    return { sent: false, platform: platform };
  }
}

module.exports = {
  sendPurchaseAlert,
  maskEmail,
  buildSlackPayload,
  buildDiscordPayload,
};
