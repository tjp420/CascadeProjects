#!/usr/bin/env node
/**
 * Create a REAL Stripe test-mode Checkout Session.
 * Uses the test key from ai-platform/.env (sk_test_).
 * No real charges — Stripe test mode uses test cards only.
 *
 * Usage:
 *   node scripts/create-test-checkout.cjs                          # Developer monthly $49
 *   node scripts/create-test-checkout.cjs --tier team_pro           # Team Pro monthly $149
 *   node scripts/create-test-checkout.cjs --tier developer --annual # Developer annual $490
 *   node scripts/create-test-checkout.cjs --one-time certificate    # One-time $149 certificate
 *
 * Then open the printed URL in your browser and use a Stripe test card:
 *   Card:   4242 4242 4242 4242
 *   Exp:    any future date (e.g. 12/34)
 *   CVC:    any 3 digits (e.g. 123)
 *   ZIP:    42424
 */

const fs = require("fs");
const path = require("path");

// Load the TEST key from ai-platform/.env (NOT the live key from coming-soon/.env)
const envPath = path.join(__dirname, "..", "ai-platform", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const keyMatch = envContent.match(/^STRIPE_SECRET_KEY=(sk_test_\S+)/m);
if (!keyMatch) {
    console.error("ERROR: No sk_test_ key found in ai-platform/.env");
    console.error("Add STRIPE_SECRET_KEY=sk_test_... to ai-platform/.env");
    process.exit(1);
}
const stripeKey = keyMatch[1];
console.log(`Using TEST key: ${stripeKey.substring(0, 12)}...`);

// Minimal Stripe API client (no SDK needed)
async function createCheckoutSession(params) {
    const body = new URLSearchParams();
    body.append("mode", params.mode);
    body.append("customer_email", params.email);
    body.append("success_url", params.successUrl);
    body.append("cancel_url", params.cancelUrl);
    for (let i = 0; i < params.lineItems.length; i++) {
        const item = params.lineItems[i];
        body.append(`line_items[${i}][price_data][currency]`, "usd");
        body.append(`line_items[${i}][price_data][product_data][name]`, item.name);
        body.append(`line_items[${i}][price_data][unit_amount]`, String(item.unitAmount));
        if (item.recurring) {
            body.append(`line_items[${i}][price_data][recurring][interval]`, item.recurring.interval);
            body.append(`line_items[${i}][price_data][recurring][interval_count]`, "1");
        }
        body.append(`line_items[${i}][quantity]`, "1");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(`Stripe API error: ${json.error?.message || JSON.stringify(json)}`);
    }
    return json;
}

// Parse args
const args = process.argv.slice(2);
let tier = "developer";
let annual = false;
let oneTime = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tier" && args[i + 1]) tier = args[i + 1];
    if (args[i] === "--annual") annual = true;
    if (args[i] === "--one-time" && args[i + 1]) oneTime = args[i + 1];
}

const email = "test@simplebeacon.ai";
const projectName = "Test Project";

async function main() {
    let lineItems, mode, successUrl, cancelUrl;

    if (oneTime === "certificate") {
        console.log("\nCreating ONE-TIME Checkout: Board-Ready Audit Certificate ($149)\n");
        lineItems = [{ name: "Board-Ready Audit Certificate", unitAmount: 14900 }];
        mode = "payment";
        successUrl = "http://localhost:3000/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}";
        cancelUrl = "http://localhost:3000/pricing.html?canceled=true";
    } else if (oneTime === "executive") {
        console.log("\nCreating ONE-TIME Checkout: Executive Risk Certificate ($499)\n");
        lineItems = [{ name: "Executive Risk Certificate", unitAmount: 49900 }];
        mode = "payment";
        successUrl = "http://localhost:3000/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}";
        cancelUrl = "http://localhost:3000/pricing.html?canceled=true";
    } else {
        const tiers = {
            developer: { name: "SimpleBeacon Developer", monthly: 4900, annual: 49000 },
            team_pro: { name: "SimpleBeacon Team Pro", monthly: 14900, annual: 149000 },
            pro: { name: "AI Slop Cop Pro", monthly: 900, annual: 9000 },
        };
        const t = tiers[tier];
        if (!t) {
            console.error(`Unknown tier: ${tier}. Use: developer, team_pro, pro`);
            process.exit(1);
        }
        const amount = annual ? t.annual : t.monthly;
        const interval = annual ? "year" : "month";
        const priceLabel = annual ? `$${amount / 100}/yr` : `$${amount / 100}/mo`;
        console.log(`\nCreating SUBSCRIPTION Checkout: ${t.name} (${priceLabel})\n`);
        lineItems = [{ name: t.name, unitAmount: amount, recurring: { interval } }];
        mode = "subscription";
        successUrl = "http://localhost:3000/dashboard?session_id={CHECKOUT_SESSION_ID}";
        cancelUrl = "http://localhost:3000/pricing.html?canceled=true";
    }

    console.log(`Email: ${email}`);
    console.log(`Mode:  ${mode}`);
    console.log(`Price: $${lineItems[0].unitAmount / 100}${mode === "subscription" ? "/" + (annual ? "yr" : "mo") : " one-time"}`);
    console.log();

    const session = await createCheckoutSession({
        mode,
        email,
        lineItems,
        successUrl,
        cancelUrl,
    });

    console.log("========================================");
    console.log("CHECKOUT SESSION CREATED (TEST MODE)");
    console.log("========================================");
    console.log(`Session ID: ${session.id}`);
    console.log(`Status:     ${session.status}`);
    console.log();
    console.log("OPEN THIS URL IN YOUR BROWSER:");
    console.log();
    console.log(`  ${session.url}`);
    console.log();
    console.log("TEST CARD (no real charge):");
    console.log("  Card: 4242 4242 4242 4242");
    console.log("  Exp:  12/34 (any future date)");
    console.log("  CVC:  123 (any 3 digits)");
    console.log("  ZIP:  42424");
    console.log();
    console.log("After payment, check your Stripe dashboard:");
    console.log("  https://dashboard.stripe.com/test/payments");
}

main().catch(err => {
    console.error("FAILED:", err.message);
    process.exit(1);
});
