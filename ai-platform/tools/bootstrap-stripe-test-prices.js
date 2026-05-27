#!/usr/bin/env node
/**
 * Create Simplebeacon test-mode Stripe products/prices. Prints env lines for .env.v1-internal.
 * Usage: STRIPE_SECRET_KEY=sk_test_... node tools/bootstrap-stripe-test-prices.js
 */
const Stripe = require('stripe');

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret || !secret.startsWith('sk_test_')) {
  console.error('Set STRIPE_SECRET_KEY=sk_test_... (test mode only)');
  process.exit(1);
}

const stripe = Stripe(secret);

const catalog = [
  {
    name: 'Cloud Teams Monthly',
    description: 'Hosted dashboard + scan history',
    unit_amount: 4900,
    recurring: { interval: 'month' }
  },
  {
    name: 'Cloud Teams Annual (Founding Member)',
    description: 'Annual Cloud Teams subscription - 20% savings',
    unit_amount: 39000,
    recurring: { interval: 'year' }
  },
  {
    name: 'Enterprise Perimeter Setup',
    description: 'Enterprise implementation setup',
    unit_amount: 500000,
    recurring: undefined
  },
  {
    name: 'Enterprise Monthly Retainer',
    description: 'Ongoing enterprise support',
    unit_amount: 250000,
    recurring: { interval: 'month' }
  }
];

const envKeys = [
  'STRIPE_PRICE_ID_TEAMS_MONTHLY',
  'STRIPE_PRICE_ID_TEAMS_ANNUAL',
  'STRIPE_PRICE_ID_ENTERPRISE_SETUP',
  'STRIPE_PRICE_ID_ENTERPRISE_RETAINER'
];

async function findOrCreate(item) {
  const products = await stripe.products.list({ limit: 100, active: true });
  let product = products.data.find((p) => p.name === item.name);
  if (!product) {
    product = await stripe.products.create({
      name: item.name,
      description: item.description
    });
    console.error(`Created product: ${product.name} (${product.id})`);
  } else {
    console.error(`Found product: ${product.name} (${product.id})`);
  }

  const prices = await stripe.prices.list({ product: product.id, limit: 100, active: true });
  let price = prices.data.find((p) => {
    if (p.unit_amount !== item.unit_amount) return false;
    const wantRecurring = Boolean(item.recurring);
    const hasRecurring = Boolean(p.recurring);
    if (wantRecurring !== hasRecurring) return false;
    if (wantRecurring && p.recurring.interval !== item.recurring.interval) return false;
    return true;
  });

  if (!price) {
    const params = {
      product: product.id,
      currency: 'usd',
      unit_amount: item.unit_amount
    };
    if (item.recurring) params.recurring = item.recurring;
    price = await stripe.prices.create(params);
    console.error(`Created price: ${price.id} (${item.unit_amount} cents)`);
  } else {
    console.error(`Found price: ${price.id}`);
  }

  return price.id;
}

async function main() {
  const priceIds = [];
  for (const item of catalog) {
    priceIds.push(await findOrCreate(item));
  }

  console.log('\n# Add to .env.v1-internal (test mode):');
  console.log('SIMPLEBEACON_MONETIZATION_ENABLED=true');
  console.log('STRIPE_SECRET_KEY=sk_test_...  # already set');
  for (let i = 0; i < envKeys.length; i++) {
    console.log(`${envKeys[i]}=${priceIds[i]}`);
  }
  console.log(`STRIPE_PRICE_ID=${priceIds[0]}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
