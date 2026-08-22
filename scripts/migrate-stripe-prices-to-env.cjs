#!/usr/bin/env node
/*
 * migrate-stripe-prices-to-env.cjs
 *
 * Fetch active Stripe Price objects and generate environment variable
 * assignments of the form `STRIPE_PRICE_{PRODUCT}_{MONTHLY|ANNUAL}=price_...`.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/migrate-stripe-prices-to-env.cjs
 *
 * Output:
 * - coming-soon/.env.stripe-prices.generated (shell-compatible assignments)
 * - coming-soon/stripe-price-env-map.json (full mapping)
 */

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
if (!key) {
  console.error('Error: STRIPE_SECRET_KEY (or STRIPE_API_KEY) must be set in the environment.');
  process.exit(1);
}

const stripe = Stripe(key);

function normalizeName(name) {
  return name
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

async function fetchAllPrices() {
  const prices = [];
  let hasMore = true;
  let startingAfter;
  while (hasMore) {
    const res = await stripe.prices.list({ limit: 100, starting_after: startingAfter });
    prices.push(...res.data);
    hasMore = res.has_more;
    if (hasMore) startingAfter = res.data[res.data.length - 1].id;
  }
  return prices;
}

async function resolveProduct(productRef) {
  if (!productRef) return null;
  if (typeof productRef === 'object') return productRef;
  try {
    return await stripe.products.retrieve(productRef);
  } catch (err) {
    console.warn('Warning: failed to retrieve product', productRef, err.message);
    return null;
  }
}

async function main() {
  console.log('Fetching Stripe prices...');
  const prices = await fetchAllPrices();
  console.log(`Found ${prices.length} prices.`);

  const map = {};
  for (const p of prices) {
    // Skip deactivated prices
    if (p.active === false) continue;

    const prod = await resolveProduct(p.product);
    const prodName = (prod && (prod.metadata && (prod.metadata.tier || prod.metadata.tier_key)) ) || (prod && prod.name) || p.nickname || 'UNKNOWN';
    const normalized = normalizeName(String(prodName || 'UNKNOWN'));

    if (!p.recurring) {
      // one-time prices are not mapped to STRIPE_PRICE_* by default
      const keyName = `ONE_TIME_${normalized}`;
      map[keyName] = map[keyName] || [];
      map[keyName].push({ priceId: p.id, currency: p.currency, unit_amount: p.unit_amount });
      continue;
    }

    const interval = p.recurring.interval === 'year' ? 'ANNUAL' : 'MONTHLY';
    const envVar = `STRIPE_PRICE_${normalized}_${interval}`;

    // Avoid clobbering existing env vars in the running environment
    if (process.env[envVar]) {
      console.log(`Skipping ${envVar} (already set in environment)`);
      map[envVar] = process.env[envVar];
      continue;
    }

    map[envVar] = p.id;
  }

  // Write outputs
  const outDir = path.join(__dirname, '..', 'coming-soon');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const envLines = [];
  for (const [k, v] of Object.entries(map)) {
    if (Array.isArray(v)) {
      envLines.push(`# ${k} -> ${JSON.stringify(v)}`);
    } else {
      envLines.push(`${k}=${v}`);
    }
  }

  const envPath = path.join(outDir, '.env.stripe-prices.generated');
  fs.writeFileSync(envPath, envLines.join('\n') + '\n');
  console.log('Wrote', envPath);

  const jsonPath = path.join(outDir, 'stripe-price-env-map.json');
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2));
  console.log('Wrote', jsonPath);

  console.log('Done. Review the generated files and copy desired entries into your deployment environment.');
}

main().catch((err) => {
  console.error('Error:', err && err.stack ? err.stack : err);
  process.exit(1);
});
