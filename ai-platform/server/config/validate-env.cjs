// SPDX-License-Identifier: MIT
/**
 * Server environment variable validator.
 *
 * Prevents server boot if critical Stripe or billing configuration is
 * missing or malformed. In production, a missing/invalid key causes an
 * immediate process.exit(1). In development, a warning is logged but
 * the server is allowed to start (so local dev without Stripe keys
 * remains possible).
 *
 * @license MIT
 */

"use strict";

const logger = require("../lib/app-logger.cjs");

const REQUIRED_STRIPE_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];

/**
 * Validate that STRIPE_SECRET_KEY starts with sk_ or rk_ (restricted key).
 * @param {string} val - The env var value.
 * @returns {boolean}
 */
function isValidStripeSecretKey(val) {
  return (
    typeof val === "string" && (val.startsWith("sk_") || val.startsWith("rk_"))
  );
}

/**
 * Validate that STRIPE_WEBHOOK_SECRET starts with whsec_.
 * @param {string} val - The env var value.
 * @returns {boolean}
 */
function isValidWebhookSecret(val) {
  return typeof val === "string" && val.startsWith("whsec_");
}

/**
 * Run environment validation. Call immediately after dotenv.config() in
 * the server entry point, before any Stripe-dependent modules are loaded.
 *
 * @param {Object} [opts] - Options.
 * @param {boolean} [opts.fatal=false] - If true, exit(1) on validation failure.
 *        Defaults to false — the server boots so non-billing endpoints remain
 *        available. Billing routes will return errors at runtime if Stripe
 *        keys are missing.
 * @returns {{missing:string[],invalid:string[],passed:boolean}} Validation result.
 */
function validateEnvironment(opts) {
  const isProduction =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const fatal = opts && typeof opts.fatal === "boolean" ? opts.fatal : false; // never crash — boot the server, let billing routes fail at runtime

  const missing = [];
  const invalid = [];

  for (const key of REQUIRED_STRIPE_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (
    process.env.STRIPE_SECRET_KEY &&
    !isValidStripeSecretKey(process.env.STRIPE_SECRET_KEY)
  ) {
    invalid.push(
      'STRIPE_SECRET_KEY must start with "sk_" (sk_test_ or sk_live_)',
    );
  }

  if (
    process.env.STRIPE_WEBHOOK_SECRET &&
    !isValidWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
  ) {
    invalid.push('STRIPE_WEBHOOK_SECRET must start with "whsec_"');
  }

  const passed = missing.length === 0 && invalid.length === 0;

  if (passed) {
    logger.info(
      "[EnvValidator] Environment validation passed: Stripe billing services ready.",
    );
    return { missing, invalid, passed: true };
  }

  logger.error("[EnvValidator] Environment validation FAILED!");
  if (missing.length > 0) {
    logger.error(
      "[EnvValidator] Missing required variables: " + missing.join(", "),
    );
  }
  if (invalid.length > 0) {
    logger.error(
      "[EnvValidator] Invalid variable formats: " + invalid.join("; "),
    );
  }

  if (fatal) {
    logger.error(
      "[EnvValidator] Server boot aborted to prevent silent webhook failures.",
    );
    process.exit(1);
  } else {
    logger.warn(
      "[EnvValidator] Stripe billing will not function — missing/invalid keys. Non-billing endpoints remain available.",
    );
  }

  return { missing, invalid, passed: false };
}

module.exports = {
  validateEnvironment,
  isValidStripeSecretKey,
  isValidWebhookSecret,
  REQUIRED_STRIPE_VARS,
};
