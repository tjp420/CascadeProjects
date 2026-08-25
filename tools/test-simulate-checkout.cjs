// Simulate checkout session params locally without calling Stripe
// Usage: node tools/test-simulate-checkout.cjs [product] [email]

const path = require("path");

// Set test env vars here (temporary, in-process)
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_simulated_local";
// Provide a valid mapping for team_pro_monthly from ai-platform/server/config/stripe.cjs
process.env.STRIPE_PRICE_ID_TEAM_PRO_MONTHLY =
  process.env.STRIPE_PRICE_ID_TEAM_PRO_MONTHLY ||
  "price_1U2fn7AQ0e20kzI8lXYh295F";
process.env.STRIPE_PRICE_ID_TEAM_PRO_ANNUAL =
  process.env.STRIPE_PRICE_ID_TEAM_PRO_ANNUAL ||
  "price_1U2fnYAQ0e20kzI8EI2LjRQC";
process.env.SIMPLEBEACON_APP_URL =
  process.env.SIMPLEBEACON_APP_URL || "http://localhost:54355";

const args = process.argv.slice(2);
const product = (args[0] || "team_pro_monthly").trim();
const email = (args[1] || "you@example.com").trim();

const {
  resolvePriceId,
  checkoutModeForProduct,
  getAppBaseUrl,
} = require("../ai-platform/src/api/billing/license-utils.cjs");

console.log("Simulating checkout for product:", product, "email:", email);

const priceId = resolvePriceId(product);
const stripeClientAvailable =
  !!require("../ai-platform/src/api/billing/license-utils.cjs").getStripeClient();

console.log("Resolved priceId:", priceId);
console.log("Stripe client available:", stripeClientAvailable ? "YES" : "NO");

const baseUrl = getAppBaseUrl();
const mode = checkoutModeForProduct(product);

const successPath = [
  "/dashboard/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}",
  "/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}",
];

const teamCheckoutProducts = new Set([
  "startup_monthly",
  "startup_annual",
  "growth_monthly",
  "growth_annual",
  "teams_monthly",
  "teams_annual",
  "team_monthly",
  "team_annual",
]);
const success = teamCheckoutProducts.has(product)
  ? successPath[0]
  : successPath[1];

const sessionParams = {
  mode,
  customer_email: email,
  line_items: priceId ? [{ price: priceId, quantity: 1 }] : [],
  success_url: `${baseUrl}${success}`,
  cancel_url: `${baseUrl}/pricing?canceled=true`,
  metadata: { email, product },
};

if (mode === "subscription") {
  sessionParams.subscription_data = { metadata: { email, product } };
}

console.log("\n--- Simulated session params ---");
console.log(JSON.stringify(sessionParams, null, 2));

console.log(
  "\nNote: This script only builds the session params and does not call Stripe.",
);
console.log(
  "If `priceId` is null or `Stripe client available` is NO, set the corresponding env vars in your .env and restart the server.",
);
