"use strict";

/**
 * Onboarding Drip Cron — sends day 1, day 3, and day 7 onboarding emails
 * to recently activated subscribers.
 *
 * Schedule: Run every hour (or every 6 hours) via cron.
 * The job checks the onboarding-drip-store for users who are due for
 * their next drip step and sends the appropriate email.
 *
 * Steps:
 *   Step 1 (Day 1, ~24h):  Quick tips for first scan
 *   Step 2 (Day 3, ~72h):  Advanced features you might have missed
 *   Step 3 (Day 7, ~168h): Value check-in
 *
 * Usage:
 *   node server/cron/onboarding-drip.cjs           # Run once
 *   node server/cron/onboarding-drip.cjs --dry-run # Preview without sending
 */

const logger = require("../lib/app-logger.cjs");
const { sendEmail } = require("../lib/email-service.cjs");
const {
  renderOnboardingDay1,
  renderOnboardingDay3,
  renderOnboardingDay7,
} = require("../lib/billing-email-templates.cjs");
const {
  registerActivation,
  findDueUsers,
  markStepSent,
} = require("../lib/onboarding-drip-store.cjs");

const DRIP_STEPS = [
  { step: 1, hours: 24, render: renderOnboardingDay1, name: "Day 1 — Quick Tips" },
  { step: 2, hours: 72, render: renderOnboardingDay3, name: "Day 3 — Features" },
  { step: 3, hours: 168, render: renderOnboardingDay7, name: "Day 7 — Check-in" },
];

/**
 * Run the onboarding drip job.
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun] - If true, log what would be sent without sending.
 * @returns {Promise<{sent:number,failed:number,skipped:number}>}
 */
async function runOnboardingDrip(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  logger.info(
    `[OnboardingDrip] Running drip job${dryRun ? " (dry-run)" : ""}...`,
  );

  for (const stepConfig of DRIP_STEPS) {
    const dueUsers = findDueUsers(stepConfig.step, stepConfig.hours);

    if (dueUsers.length === 0) {
      continue;
    }

    logger.info(
      `[OnboardingDrip] ${stepConfig.name}: ${dueUsers.length} user(s) due`,
    );

    for (const user of dueUsers) {
      if (dryRun) {
        logger.info(
          `[OnboardingDrip] (dry-run) Would send ${stepConfig.name} to ${user.email}`,
        );
        skipped += 1;
        continue;
      }

      try {
        const { subject, text, html } = stepConfig.render({
          tier: user.tier,
          customerEmail: user.email,
        });

        const result = await sendEmail({
          to: user.email,
          subject,
          text,
          html,
        });

        if (result.sent || result.queued) {
          markStepSent(user.email, stepConfig.step);
          sent += 1;
          logger.info(
            `[OnboardingDrip] Sent ${stepConfig.name} to ${user.email} (${result.sent ? "sent" : "queued"})`,
          );
        } else {
          failed += 1;
          logger.warn(
            `[OnboardingDrip] Failed to send ${stepConfig.name} to ${user.email}`,
          );
        }
      } catch (err) {
        failed += 1;
        logger.error(
          `[OnboardingDrip] Error sending ${stepConfig.name} to ${user.email}:`,
          err?.message || err,
        );
      }
    }
  }

  logger.info(
    `[OnboardingDrip] Job complete: ${sent} sent, ${failed} failed, ${skipped} skipped (dry-run)`,
  );
  return { sent, failed, skipped };
}

module.exports = { runOnboardingDrip, DRIP_STEPS };

// Runnable entry point for cron scheduling
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  runOnboardingDrip({ dryRun })
    .then((result) => {
      console.log(
        `Onboarding drip complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Onboarding drip failed:", err);
      process.exit(1);
    });
}
