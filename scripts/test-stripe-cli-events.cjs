"use strict";

/**
 * Stripe CLI Test Runner — fires test-mode Stripe events at the local webhook.
 *
 * Prerequisites:
 *   1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
 *   2. Authenticate: stripe login
 *   3. Start webhook forwarding in a separate terminal:
 *        stripe listen --forward-to localhost:3001/api/subscription/webhook
 *      (or for ai-platform: --forward-to localhost:3000/stripe/webhook)
 *   4. Set STRIPE_SECRET_KEY=sk_test_... in your env
 *
 * Usage:
 *   node scripts/test-stripe-cli-events.cjs                          # fire all events
 *   node scripts/test-stripe-cli-events.cjs --event charge.refunded  # fire one event
 *   node scripts/test-stripe-cli-events.cjs --list                   # list available events
 *
 * This script does NOT create real charges — it uses `stripe trigger` which
 * fires synthetic test-mode events. No real money is moved.
 */

const { execSync, spawnSync } = require("child_process");
const path = require("path");

const AVAILABLE_EVENTS = [
  {
    name: "checkout.session.completed",
    desc: "Simulates a completed checkout session (subscription activation)",
    handler: "both",
  },
  {
    name: "customer.subscription.updated",
    desc: "Simulates a subscription update (tier change / proration)",
    handler: "both",
  },
  {
    name: "customer.subscription.deleted",
    desc: "Simulates a subscription cancellation",
    handler: "both",
  },
  {
    name: "invoice.paid",
    desc: "Simulates a successful invoice payment (renewal)",
    handler: "both",
  },
  {
    name: "invoice.payment_failed",
    desc: "Simulates a failed invoice payment (past_due)",
    handler: "both",
  },
  {
    name: "customer.subscription.trial_will_end",
    desc: "Simulates a trial ending soon notification",
    handler: "both",
  },
  {
    name: "charge.dispute.created",
    desc: "Simulates a chargeback / dispute filed",
    handler: "both",
  },
  {
    name: "charge.refunded",
    desc: "Simulates a refund issued (full or partial)",
    handler: "both",
  },
  {
    name: "invoice.upcoming",
    desc: "Simulates an upcoming invoice notification",
    handler: "both",
  },
  {
    name: "customer.subscription.paused",
    desc: "Simulates a subscription pause (collection paused)",
    handler: "both",
  },
  {
    name: "customer.subscription.resumed",
    desc: "Simulates a subscription resume (collection resumed)",
    handler: "both",
  },
];

function checkStripeCli() {
  try {
    const result = spawnSync("stripe", ["--version"], {
      stdio: "pipe",
      shell: true,
      timeout: 5000,
    });
    if (result.status !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

function fireEvent(eventName) {
  console.log(`\n[trigger] Firing ${eventName}...`);
  try {
    const output = execSync(`stripe trigger ${eventName}`, {
      stdio: "pipe",
      timeout: 30000,
      shell: true,
      encoding: "utf8",
    });
    // stripe trigger prints the event ID and a success line
    const lines = output.trim().split("\n");
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    return { success: true, output };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    console.error(`  [FAIL] ${stderr}`);
    return { success: false, error: stderr };
  }
}

function printList() {
  console.log("Available Stripe test events to trigger:\n");
  for (const ev of AVAILABLE_EVENTS) {
    console.log(`  ${ev.name.padEnd(40)} ${ev.desc}`);
  }
  console.log(`\nTotal: ${AVAILABLE_EVENTS.length} events`);
  console.log("\nUsage:");
  console.log("  node scripts/test-stripe-cli-events.cjs                    # fire all");
  console.log("  node scripts/test-stripe-cli-events.cjs --event <name>     # fire one");
  console.log("  node scripts/test-stripe-cli-events.cjs --list             # list events");
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list") || args.includes("-l")) {
    printList();
    return 0;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printList();
    return 0;
  }

  // Check for Stripe CLI
  if (!checkStripeCli()) {
    console.error("Error: Stripe CLI not found. Install it from https://stripe.com/docs/stripe-cli");
    console.error("  Then run: stripe login");
    console.error("  And in a separate terminal: stripe listen --forward-to localhost:3001/api/subscription/webhook");
    return 1;
  }

  // Check for test API key
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey) {
    console.error("Error: STRIPE_SECRET_KEY not set. Set it to your test key (sk_test_...).");
    return 1;
  }
  if (secretKey.startsWith("sk_live_")) {
    console.error("ERROR: STRIPE_SECRET_KEY starts with sk_live_ — refusing to run with live key.");
    console.error("Switch to test mode in your Stripe Dashboard and use a sk_test_ key.");
    return 1;
  }
  console.log(`[check] Using test key: ${secretKey.slice(0, 12)}...`);

  // Determine which events to fire
  let eventsToFire;
  const eventIdx = args.indexOf("--event");
  if (eventIdx !== -1 && args[eventIdx + 1]) {
    const requested = args[eventIdx + 1];
    const found = AVAILABLE_EVENTS.find((e) => e.name === requested);
    if (!found) {
      console.error(`Unknown event: ${requested}. Run with --list to see available events.`);
      return 1;
    }
    eventsToFire = [found];
  } else {
    eventsToFire = AVAILABLE_EVENTS;
  }

  console.log(`\n========================================`);
  console.log(`Stripe CLI Test Event Runner`);
  console.log(`========================================`);
  console.log(`Events to fire: ${eventsToFire.length}`);
  console.log(`\nPrerequisites:`);
  console.log(`  1. stripe login (done)`);
  console.log(`  2. In a separate terminal:`);
  console.log(`     stripe listen --forward-to localhost:3001/api/subscription/webhook`);
  console.log(`     (copy the whsec_... signing secret to STRIPE_WEBHOOK_SECRET)`);
  console.log(`  3. Local server running on port 3001`);
  console.log(`\nFiring events...\n`);

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const ev of eventsToFire) {
    const result = fireEvent(ev.name);
    results.push({ name: ev.name, ...result });
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} triggered, ${failed} failed`);
  console.log(`========================================`);
  if (failed > 0) {
    console.log(`\nFailed events:`);
    for (const r of results.filter((r) => !r.success)) {
      console.log(`  ${r.name}: ${r.error}`);
    }
  }
  console.log(`\nNext steps:`);
  console.log(`  - Check the local server logs for webhook event processing`);
  console.log(`  - Verify customer subscription status was updated in the DB`);
  console.log(`  - Check email logs/queue for notification emails`);
  console.log(`  - Run 'node scripts/test-payment-sim.cjs' for the stub-based payment tests`);

  return failed > 0 ? 1 : 0;
}

process.exit(main());
