/**
 * Stripe Product Setup for SimpleBeacon Custom Plan
 *
 * Creates one Stripe product per scan type with a one-time price.
 * Run with:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/setup-stripe-products.cjs
 *
 * Output: prints product ID + price ID for each scan so you can reference them
 *         in your code or set env vars like STRIPE_PRICE_GATE, STRIPE_PRICE_MOCK, etc.
 */

const Stripe = require("stripe");

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY env var first."); // simplebeacon-ignore pii-logging — CLI usage message, not data logging
  process.exit(1);
}

const stripe = new Stripe(secretKey);

const SCAN_OPTIONS = [
  { id: "gate", name: "Security Gate Scan", price: 29 },
  { id: "mock", name: "Mock Data Detection", price: 19 },
  { id: "ai", name: "AI Import Flags", price: 19 },
  { id: "debug", name: "Debug Artifact Scan", price: 19 },
  { id: "codebase", name: "Codebase Analysis", price: 49 },
  { id: "reduction", name: "File Reduction", price: 29 },
  { id: "data-quality", name: "Data Quality", price: 39 },
  { id: "npm", name: "NPM Audit", price: 29 },
  { id: "compliance", name: "Compliance Checklist", price: 49 },
  { id: "euai", name: "EU AI Act Patterns", price: 99 },
  { id: "build", name: "Build Readiness", price: 19 },
  { id: "governance", name: "Governance Audit", price: 19 },
];

async function createProductAndPrice(opt) {
  const product = await stripe.products.create({
    name: opt.name,
    description: `SimpleBeacon ${opt.name} — one-time add-on`,
    metadata: { scanId: opt.id, type: "simplebeacon_custom_scan" },
  });

  const price = await stripe.prices.create({
    unit_amount: opt.price * 100,
    currency: "usd",
    product: product.id,
    metadata: { scanId: opt.id },
  });

  return {
    productId: product.id,
    priceId: price.id,
    scanId: opt.id,
    price: opt.price,
  };
}

(async () => {
  console.log(
    "Creating Stripe products for SimpleBeacon Custom Plan scans...\n",
  );
  const results = [];

  for (const opt of SCAN_OPTIONS) {
    try {
      const r = await createProductAndPrice(opt);
      results.push(r);
      console.log(
        `${r.scanId.padEnd(14)}  $${String(r.price).padStart(3)}  ${r.priceId}`,
      );
    } catch (err) {
      console.error(`Failed for ${opt.id}:`, err.message);
    }
  }

  console.log("\n=== Environment Variables ===");
  for (const r of results) {
    console.log(
      `STRIPE_PRICE_${r.scanId.replace(/-/g, "_").toUpperCase()}=${r.priceId}`,
    );
  }

  console.log("\n=== How to use in checkout.cjs ===");
  console.log(`Instead of ad-hoc price_data, you can switch to:
  line_items: scans.map(id => ({ price: process.env['STRIPE_PRICE_' + id.toUpperCase().replace('-','_')], quantity: 1 }))
This gives you better reporting in the Stripe Dashboard.`);
})();
